/**
 * IFH Shop Module
 * ================
 * Manages the virtual shop: browsing items, purchasing, and inventory.
 */

import { db, auth, shopItemsCollection } from './firebase.js';
import {
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    orderBy,
    serverTimestamp,
    increment,
    addDoc
} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { spendCoins, getUserBalance, updateBalanceDisplay } from './coins.js';
import { ECONOMY } from './config/economy.js';
import { notyf } from './ui.js';
import { generateRandomIVs, generateInstanceId, getQualityTier, getTotalIVs } from './utils/pet-utils.js';

// ============================================
// SHOP ITEMS MANAGEMENT
// ============================================

/**
 * Get all available shop items
 * @param {string} category - Optional category filter
 * @returns {Promise<Array>} List of shop items
 */
export async function getShopItems(category = null) {
    try {
        let items = [];
        const snapshot = await getDocs(shopItemsCollection);

        items = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(item => item.active !== false); // Only active items

        // Filter by category if specified
        if (category && category !== 'all') {
            items = items.filter(item => item.category === category);
        }

        // Sort: limited items first, then by price
        items.sort((a, b) => {
            if (a.isLimited && !b.isLimited) return -1;
            if (!a.isLimited && b.isLimited) return 1;
            return a.price - b.price;
        });

        return items;
    } catch (error) {
        console.error('Error fetching shop items:', error);
        return [];
    }
}

/**
 * Get a single shop item by ID
 * @param {string} itemId - Item ID
 * @returns {Promise<Object|null>} Item data or null
 */
export async function getShopItem(itemId) {
    try {
        const docRef = doc(db, 'shopItems', itemId);
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) return null;
        return { id: snapshot.id, ...snapshot.data() };
    } catch (error) {
        console.error('Error fetching shop item:', error);
        return null;
    }
}

/**
 * Check if an item is available (in stock, not expired)
 * @param {Object} item - Shop item
 * @returns {boolean} Whether item can be purchased
 */
export function isItemAvailable(item) {
    // Check stock
    if (item.stock !== undefined && item.stock !== null && item.stock <= 0) {
        return false;
    }

    // Check expiration for limited items
    if (item.availableUntil) {
        const expiryDate = item.availableUntil.toDate ? item.availableUntil.toDate() : new Date(item.availableUntil);
        if (expiryDate < new Date()) {
            return false;
        }
    }

    return true;
}

// ============================================
// PURCHASING
// ============================================

/**
 * Purchase an item from the shop
 * @param {string} itemId - Item ID to purchase
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function purchaseItem(itemId, qty = 1) {
    if (!auth.currentUser) {
        return { success: false, error: 'Non authentifié' };
    }

    // Ensure qty is valid
    qty = parseInt(qty);
    if (isNaN(qty) || qty < 1) qty = 1;

    try {
        // Get item details
        const item = await getShopItem(itemId);
        if (!item) {
            return { success: false, error: 'Article non trouvé' };
        }

        // Check availability
        if (!isItemAvailable(item)) {
            return { success: false, error: 'Article non disponible' };
        }

        // Stock check for limited items
        if (item.stock !== undefined && item.stock !== null && item.stock < qty) {
            return { success: false, error: `Stock insuffisant (${item.stock} restants)` };
        }

        // Check if user already owns it (unless it's a consumable or companion)
        // Consumables can be bought multiple times
        // Companions can also be bought multiple times (each has unique IVs)
        if (item.category !== ECONOMY.CATEGORIES.CONSUMABLE && item.category !== ECONOMY.CATEGORIES.COMPANION) {
            if (qty > 1) return { success: false, error: "Impossible d'acheter plusieurs exemplaires de cet objet." };

            const hasItem = await userOwnsItem(itemId);
            if (hasItem) {
                return { success: false, error: 'Vous possédez déjà cet article' };
            }
        }

        // Check balance
        const totalCost = item.price * qty;
        const balance = await getUserBalance();
        if (balance < totalCost) {
            return { success: false, error: 'Solde insuffisant', balance, price: totalCost };
        }

        // Deduct coins
        const spendResult = await spendCoins(totalCost, 'shop_purchase', itemId, {
            itemName: item.name,
            category: item.category,
            quantity: qty
        });

        if (!spendResult.success) {
            return { success: false, error: spendResult.error };
        }

        // Add item to user's inventory
        const userId = auth.currentUser.uid;

        // Handle companions specially - each purchase creates a unique instance with IVs
        if (item.category === ECONOMY.CATEGORIES.COMPANION) {
            const instanceId = generateInstanceId();
            const ivs = generateRandomIVs();
            const qualityTier = getQualityTier(ivs);

            const inventoryData = {
                itemId,
                instanceId,
                itemName: item.name,
                category: item.category,
                purchasedAt: serverTimestamp(),
                equipped: false,
                quantity: 1,
                // Pet-specific data
                level: 1,
                xp: 0,
                ivs: ivs,
                evolutionBonus: { intelligence: 0, creativity: 0, social: 0 },
                evolved: false,
                stats: item.stats || { intelligence: 1, creativity: 1, social: 1 },
                nickname: item.name,
                type: item.type || 'Compagnon',
                image: item.image
            };

            // Use instanceId as the document ID to allow multiple of same pet
            const inventoryRef = doc(db, 'users', userId, 'inventory', instanceId);
            await setDoc(inventoryRef, inventoryData);

            // Log the quality for the user
            console.log(`[Shop] New ${item.name} acquired with quality: ${qualityTier.name} (IVs: ${getTotalIVs(ivs)}/45)`);

            // Show quality notification
            notyf.success(`Nouveau compagnon: ${item.name} (${qualityTier.emoji} ${qualityTier.name})`);

        } else {
            // Non-companion items
            const inventoryRef = doc(db, 'users', userId, 'inventory', itemId);
            const inventorySnap = await getDoc(inventoryRef);

            if (item.category === ECONOMY.CATEGORIES.CONSUMABLE && inventorySnap.exists()) {
                // Stack consumables
                await updateDoc(inventoryRef, {
                    quantity: increment(qty),
                    updatedAt: serverTimestamp(),
                    image: item.image // Update image in case it changed or was missing
                });
            } else {
                // Create new inventory item
                const inventoryData = {
                    itemId,
                    itemName: item.name,
                    category: item.category,
                    purchasedAt: serverTimestamp(),
                    equipped: false,
                    quantity: qty
                };

                // Only add optional fields if they exist
                if (item.image) inventoryData.image = item.image;
                if (item.icon) inventoryData.icon = item.icon;

                await setDoc(inventoryRef, inventoryData);
            }
        }

        // Decrease stock if limited
        if (item.stock !== undefined && item.stock !== null) {
            const itemRef = doc(db, 'shopItems', itemId);
            await updateDoc(itemRef, {
                stock: increment(-qty)
            });
        }

        updateBalanceDisplay(spendResult.newBalance);

        return {
            success: true,
            newBalance: spendResult.newBalance,
            item
        };

    } catch (error) {
        console.error('Error purchasing item:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// USER INVENTORY
// ============================================

/**
 * Get user's inventory
 * @param {string} category - Optional category filter
 * @returns {Promise<Array>} List of owned items
 */
export async function getUserInventory(category = null) {
    if (!auth.currentUser) return [];

    try {
        const userId = auth.currentUser.uid;
        const inventoryRef = collection(db, 'users', userId, 'inventory');
        const [inventorySnap, petsSnap] = await Promise.all([
            getDocs(inventoryRef),
            getDocs(query(collection(db, 'pets'), where('userId', '==', userId), where('isActive', '==', true)))
        ]);

        let items = inventorySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Add current active pet as an inventory item
        if (!petsSnap.empty) {
            const currentPet = petsSnap.docs[0].data();
            const shopItemId = `pet_${currentPet.id}`; // Convention: shop ID = pet_ + petId

            // Remove the static inventory item if it exists (to replace with dynamic one)
            // Strategy: Remove any item marked as 'equipped' OR matching the current pet ID
            // This handles cases where ID changed after evolution (e.g. pet_feerale -> pet_celestiale)
            items = items.filter(i => !i.equipped && i.id !== shopItemId && i.itemId !== shopItemId);

            // Add virtual inventory item with full pet data
            items.push({
                id: shopItemId,
                itemId: shopItemId,
                itemName: currentPet.name,
                category: ECONOMY.CATEGORIES.COMPANION,
                equipped: true, // It's their current pet
                // Include all pet stats for display
                level: currentPet.level || 1,
                xp: currentPet.xp || 0,
                ivs: currentPet.ivs || null,
                evolutionBonus: currentPet.evolutionBonus || null,
                evolved: currentPet.evolved || false,
                image: currentPet.image,
                type: currentPet.type
            });
        }

        if (category && category !== 'all') {
            items = items.filter(item => item.category === category);
        }

        return items;
    } catch (error) {
        console.error('Error fetching inventory:', error);
        return [];
    }
}

/**
 * Check if user owns a specific item
 * @param {string} itemId - Item ID
 * @returns {Promise<boolean>}
 */
export async function userOwnsItem(itemId) {
    if (!auth.currentUser) return false;

    try {
        const userId = auth.currentUser.uid;

        // Parallel check: Inventory AND pets collection (for active pet)
        const inventoryRef = doc(db, 'users', userId, 'inventory', itemId);

        const [inventorySnap, petsSnap] = await Promise.all([
            getDoc(inventoryRef),
            getDocs(query(collection(db, 'pets'), where('userId', '==', userId), where('isActive', '==', true)))
        ]);

        if (inventorySnap.exists()) return true;

        // Check if it's the active pet
        if (!petsSnap.empty) {
            const petId = petsSnap.docs[0].data().id;
            if (itemId === `pet_${petId}`) {
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error('Error checking item ownership:', error);
        return false;
    }
}

/**
 * Equip an item (theme, frame, etc.)
 * @param {string} itemId - Item ID to equip
 * @returns {Promise<{success: boolean}>}
 */
export async function equipItem(itemId) {
    if (!auth.currentUser) return { success: false };

    try {
        const userId = auth.currentUser.uid;

        // Get item from inventory
        const inventoryRef = doc(db, 'users', userId, 'inventory', itemId);
        const inventorySnap = await getDoc(inventoryRef);

        if (!inventorySnap.exists()) {
            return { success: false, error: 'Article non possédé' };
        }

        const itemData = inventorySnap.data();
        const category = itemData.category;

        // Unequip all other items in the same category
        // SKIP this for COMPANIONS because we handle swap specifically below (and starter pets might not exist as docs yet)
        if (category !== ECONOMY.CATEGORIES.COMPANION) {
            const allInventory = await getUserInventory(category);
            for (const item of allInventory) {
                if (item.equipped && item.id !== itemId) {
                    const otherRef = doc(db, 'users', userId, 'inventory', item.id);
                    await updateDoc(otherRef, { equipped: false });
                }
            }
        }
        // Equip this item
        // Note: For companions, we handle the update differently (swap logic below)
        if (category !== ECONOMY.CATEGORIES.COMPANION) {
            await updateDoc(inventoryRef, { equipped: true });
        }

        // Update user document with equipped item reference
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();
        const updateData = {};

        if (category === ECONOMY.CATEGORIES.THEME) {
            updateData.equippedTheme = itemId;
        } else if (category === ECONOMY.CATEGORIES.FRAME) {
            updateData.equippedFrame = itemId;
        } else if (category === ECONOMY.CATEGORIES.COMPANION) {
            // ============================================
            // COMPANION SWAP LOGIC (Persistent Stats)
            // ============================================

            // 1. Save CURRENT active pet state to pets collection and inventory
            const petsCollection = collection(db, 'pets');
            const activePetsQuery = query(petsCollection, where('userId', '==', userId), where('isActive', '==', true));
            const activePetsSnap = await getDocs(activePetsQuery);

            if (!activePetsSnap.empty) {
                const currentPetDocId = activePetsSnap.docs[0].id;
                const currentPet = activePetsSnap.docs[0].data();

                // Mark the current pet as inactive in pets collection
                await updateDoc(doc(db, 'pets', currentPetDocId), {
                    isActive: false
                });

                // Also save to inventory if not already there
                let currentPetInventoryId = currentPet.itemId || `pet_${currentPet.id}`;
                const currentPetRef = doc(db, 'users', userId, 'inventory', currentPetInventoryId);
                const safeImage = currentPet.image || `/images/pets/${currentPet.id}.png`;
                const safeType = currentPet.type || 'Compagnon';

                await setDoc(currentPetRef, {
                    itemId: currentPetInventoryId,
                    category: ECONOMY.CATEGORIES.COMPANION,
                    equipped: false,
                    // Save progress
                    level: currentPet.level || 1,
                    xp: currentPet.xp || 0,
                    stats: currentPet.stats || {},
                    nickname: currentPet.nickname || currentPet.name,
                    // Identity
                    itemName: currentPet.name,
                    image: safeImage,
                    type: safeType,
                    // New IV system data
                    ivs: currentPet.ivs || null,
                    evolutionBonus: currentPet.evolutionBonus || null,
                    evolved: currentPet.evolved || false,
                    instanceId: currentPet.instanceId || null
                }, { merge: true });
            }

            // 2. Load NEW pet state from inventory or create new pet in pets collection
            const newPetInventoryData = inventorySnap.data();

            // 3. Mark new pet as equipped in inventory (use setDoc to create if missing)
            await setDoc(inventoryRef, { equipped: true }, { merge: true });

            // 4. Create/Update pet in pets collection and mark as active
            const speciesId = newPetInventoryData.itemId ? newPetInventoryData.itemId.replace('pet_', '') : itemId.replace('pet_', '');

            // Check if this pet already exists in pets collection (from previous usage)
            const existingPetQuery = query(petsCollection, where('userId', '==', userId), where('instanceId', '==', newPetInventoryData.instanceId || itemId));
            const existingPetSnap = await getDocs(existingPetQuery);

            const petData = {
                userId: userId,
                id: speciesId.toLowerCase(),
                itemId: itemId,
                name: newPetInventoryData.itemName || newPetInventoryData.name,
                nickname: newPetInventoryData.nickname || newPetInventoryData.itemName,
                image: newPetInventoryData.image,
                type: newPetInventoryData.type || 'Compagnon',
                level: newPetInventoryData.level || 1,
                xp: newPetInventoryData.xp || 0,
                stats: newPetInventoryData.stats || { intelligence: 1, creativity: 1, social: 1 },
                ivs: newPetInventoryData.ivs || null,
                evolutionBonus: newPetInventoryData.evolutionBonus || null,
                evolved: newPetInventoryData.evolved || false,
                instanceId: newPetInventoryData.instanceId || null,
                isActive: true,
                obtainedAt: newPetInventoryData.purchasedAt || serverTimestamp()
            };

            if (!existingPetSnap.empty) {
                // Update existing pet doc
                await updateDoc(doc(db, 'pets', existingPetSnap.docs[0].id), petData);
            } else {
                // Create new pet doc
                await addDoc(petsCollection, petData);
            }
        }

        if (Object.keys(updateData).length > 0) {
            await updateDoc(userRef, updateData);
        }

        return { success: true };

    } catch (error) {
        console.error('Error equipping item:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Unequip an item
 * @param {string} itemId - Item ID to unequip
 * @returns {Promise<{success: boolean}>}
 */
export async function unequipItem(itemId) {
    if (!auth.currentUser) return { success: false };

    try {
        const userId = auth.currentUser.uid;
        const inventoryRef = doc(db, 'users', userId, 'inventory', itemId);
        const inventorySnap = await getDoc(inventoryRef);

        if (!inventorySnap.exists()) {
            return { success: false, error: 'Article non possédé' };
        }

        const itemData = inventorySnap.data();
        const category = itemData.category;

        // Unequip
        await updateDoc(inventoryRef, { equipped: false });

        // Update user document
        const userRef = doc(db, 'users', userId);
        const updateData = {};

        if (category === ECONOMY.CATEGORIES.THEME) {
            updateData.equippedTheme = null;
        } else if (category === ECONOMY.CATEGORIES.FRAME) {
            updateData.equippedFrame = null;
        }

        if (Object.keys(updateData).length > 0) {
            await updateDoc(userRef, updateData);
        }

        return { success: true };

    } catch (error) {
        console.error('Error unequipping item:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// ADMIN: SHOP ITEM CRUD
// ============================================

/**
 * Create a new shop item (Admin only)
 * @param {Object} itemData - Item data
 * @returns {Promise<{success: boolean, id?: string}>}
 */
export async function createShopItem(itemData) {
    if (!auth.currentUser) return { success: false };

    try {
        const docRef = doc(shopItemsCollection);
        await setDoc(docRef, {
            ...itemData,
            active: true,
            createdAt: serverTimestamp()
        });

        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Error creating shop item:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update a shop item (Admin only)
 * @param {string} itemId - Item ID
 * @param {Object} itemData - Updated data
 * @returns {Promise<{success: boolean}>}
 */
export async function updateShopItem(itemId, itemData) {
    if (!auth.currentUser) return { success: false };

    try {
        const docRef = doc(db, 'shopItems', itemId);
        await updateDoc(docRef, {
            ...itemData,
            updatedAt: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('Error updating shop item:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete a shop item (Admin only)
 * @param {string} itemId - Item ID
 * @returns {Promise<{success: boolean}>}
 */
export async function deleteShopItem(itemId) {
    if (!auth.currentUser) return { success: false };

    try {
        await deleteDoc(doc(db, 'shopItems', itemId));
        return { success: true };
    } catch (error) {
        console.error('Error deleting shop item:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// SEED DEFAULT SHOP ITEMS
// ============================================

/**
 * Seed default shop items for initial setup
 */
export async function seedDefaultShopItems() {
    const defaultItems = [
        // Themes
        {
            id: 'theme_midnight',
            name: 'Thème Minuit',
            description: 'Un thème sombre et élégant avec des accents violets.',
            price: 500,
            category: ECONOMY.CATEGORIES.THEME,
            icon: '🌙',
            preview: {
                '--bg-main': '#0f0f1a',
                '--primary': '#6366f1',
                '--accent': '#a855f7'
            }
        },
        {
            id: 'theme_ocean',
            name: 'Thème Océan',
            description: 'Un thème apaisant aux teintes bleues profondes.',
            price: 500,
            category: ECONOMY.CATEGORIES.THEME,
            icon: '🌊',
            preview: {
                '--bg-main': '#0c1929',
                '--primary': '#0ea5e9',
                '--accent': '#06b6d4'
            }
        },
        {
            id: 'theme_sunset',
            name: 'Thème Coucher de Soleil',
            description: 'Des couleurs chaudes inspirées du crépuscule.',
            price: 500,
            category: ECONOMY.CATEGORIES.THEME,
            icon: '🌅',
            preview: {
                '--bg-main': '#1a0f0c',
                '--primary': '#f97316',
                '--accent': '#ef4444'
            }
        },
        {
            id: 'theme_forest',
            name: 'Thème Forêt',
            description: 'Un thème nature aux tons verts relaxants.',
            price: 500,
            category: ECONOMY.CATEGORIES.THEME,
            icon: '🌲',
            preview: {
                '--bg-main': '#0c1a0f',
                '--primary': '#22c55e',
                '--accent': '#10b981'
            }
        },

        // Frames
        {
            id: 'frame_gold',
            name: 'Cadre Doré',
            description: 'Un cadre de profil doré pour briller.',
            price: 300,
            category: ECONOMY.CATEGORIES.FRAME,
            icon: '✨',
            borderStyle: '3px solid #fbbf24'
        },
        {
            id: 'frame_rainbow',
            name: 'Cadre Arc-en-ciel',
            description: 'Un cadre animé aux couleurs de l\'arc-en-ciel.',
            price: 750,
            category: ECONOMY.CATEGORIES.FRAME,
            icon: '🌈',
            borderStyle: 'animated-rainbow'
        },
        {
            id: 'frame_fire',
            name: 'Cadre Flamme',
            description: 'Un cadre ardent pour les plus motivés.',
            price: 600,
            category: ECONOMY.CATEGORIES.FRAME,
            icon: '🔥',
            borderStyle: '3px solid #ef4444'
        },

        // Limited Edition Example
        {
            id: 'badge_newyear2026',
            name: 'Badge Nouvel An 2026',
            description: 'Édition limitée pour célébrer 2026 !',
            price: 200,
            category: ECONOMY.CATEGORIES.BADGE,
            icon: '🎆',
            isLimited: true,
            stock: 100,
            availableUntil: new Date('2026-01-31')
        },

        // Compagnons
        {
            id: 'pet_feerale',
            name: 'Féerale',
            description: 'Un esprit de la nature bienveillant.',
            price: 2000,
            category: ECONOMY.CATEGORIES.COMPANION,
            icon: '<img src="/images/pets/feerale.png" class="shop-item-icon-img" alt="Féerale" />',
            image: '/images/pets/feerale.png',
            stats: { intelligence: 2, creativity: 5, social: 3 }
        },
        {
            id: 'pet_voltor',
            name: 'Voltor',
            description: 'Une boule d\'énergie pure en lévitation.',
            price: 2000,
            category: ECONOMY.CATEGORIES.COMPANION,
            icon: '<img src="/images/pets/voltor.png" class="shop-item-icon-img" alt="Voltor" />',
            image: '/images/pets/voltor.png',
            stats: { intelligence: 4, creativity: 2, social: 4 }
        },
        {
            id: 'pet_ombrage',
            name: 'Ombrage',
            description: 'Un spectre mystérieux aux pouvoirs obscurs.',
            price: 2000,
            category: ECONOMY.CATEGORIES.COMPANION,
            icon: '<img src="/images/pets/ombrage.png" class="shop-item-icon-img" alt="Ombrage" />',
            image: '/images/pets/ombrage.png',
            stats: { intelligence: 5, creativity: 2, social: 3 }
        },

        // Consumables
        {
            id: 'biscuit_charisme',
            name: "Biscuit de Charisme",
            description: "Un délicieux biscuit qui vous rend irrésistible. +1 Social.",
            price: 500,
            category: ECONOMY.CATEGORIES.CONSUMABLE,
            image: "/images/shop/biscuit_charisme.png",
            effect: { stat: 'social', value: 1 }
        },
        {
            id: 'potion_imagination',
            name: "Potion d'Imagination",
            description: "Une gorgée et les idées fusent ! +1 Créativité.",
            price: 500,
            category: ECONOMY.CATEGORIES.CONSUMABLE,
            image: "/images/shop/potion_imagination.png",
            effect: { stat: 'creativity', value: 1 }
        },
        {
            id: 'fiole_savoir',
            name: "Fiole de Savoir",
            description: "Concentré de connaissances pur. +1 Intelligence.",
            price: 500,
            category: ECONOMY.CATEGORIES.CONSUMABLE,
            image: "/images/shop/fiole_savoir.png",
            effect: { stat: 'intelligence', value: 1 }
        }
    ];

    let created = 0;
    let updated = 0;

    for (const item of defaultItems) {
        const { id, ...data } = item;
        const docRef = doc(db, 'shopItems', id);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
            await setDoc(docRef, {
                ...data,
                active: true,
                createdAt: serverTimestamp()
            });
            created++;
        } else {
            await updateDoc(docRef, {
                ...data,
                updatedAt: serverTimestamp()
            });
            updated++;
        }
    }

    return { created, updated, total: defaultItems.length };
}

// Expose for admin console
if (typeof window !== 'undefined') {
    window.seedDefaultShopItems = seedDefaultShopItems;
}

/**
 * Use a consumable item
 * @param {string} itemId - Item ID to use
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export async function useConsumable(itemId, qty = 1) {
    if (!auth.currentUser) return { success: false, error: 'Non connecté' };

    qty = parseInt(qty);
    if (isNaN(qty) || qty < 1) qty = 1;

    try {
        const userId = auth.currentUser.uid;
        const userRef = doc(db, 'users', userId);
        const inventoryRef = doc(db, 'users', userId, 'inventory', itemId);

        const [userSnap, inventorySnap] = await Promise.all([
            getDoc(userRef),
            getDoc(inventoryRef)
        ]);

        if (!inventorySnap.exists()) {
            return { success: false, error: "Vous ne possédez pas cet objet." };
        }

        const item = inventorySnap.data();
        if (item.category !== ECONOMY.CATEGORIES.CONSUMABLE) {
            return { success: false, error: "Cet objet n'est pas consommable." };
        }

        const currentQty = item.quantity || 1;
        if (currentQty < qty) {
            return { success: false, error: `Vous n'en avez que ${currentQty}.` };
        }

        // Get effect stat based on item ID
        let statToBoost = null;
        let boostAmount = 1;

        if (item.itemId === 'biscuit_charisme') statToBoost = 'social';
        else if (item.itemId === 'potion_imagination') statToBoost = 'creativity';
        else if (item.itemId === 'fiole_savoir') statToBoost = 'intelligence';

        if (!statToBoost) {
            return { success: false, error: "Effet inconnu pour cet objet." };
        }

        // Apply Effect (multiplied by qty)
        const totalBoost = boostAmount * qty;

        // Fetch active pet from pets collection
        const petsCollection = collection(db, 'pets');
        const activePetsQuery = query(petsCollection, where('userId', '==', userId), where('isActive', '==', true));
        const activePetsSnap = await getDocs(activePetsQuery);

        if (activePetsSnap.empty) {
            return { success: false, error: "Aucun compagnon actif trouvé." };
        }

        const petDocId = activePetsSnap.docs[0].id;
        const petData = activePetsSnap.docs[0].data();
        const petStats = petData.stats || { intelligence: 1, creativity: 1, social: 1 };

        if (petStats[statToBoost] !== undefined) {
            petStats[statToBoost] += totalBoost;
        } else {
            petStats[statToBoost] = totalBoost; // Init if missing
        }

        // Update pet in pets collection
        await updateDoc(doc(db, 'pets', petDocId), {
            stats: petStats
        });

        // Decrease Quantity or Remove from inventory
        if (currentQty > qty) {
            await updateDoc(inventoryRef, {
                quantity: increment(-qty)
            });
        } else {
            // Remove item
            await deleteDoc(inventoryRef);
        }

        return { success: true, message: `Miam ! +${totalBoost} ${statToBoost}` };

    } catch (error) {
        console.error("Error using consumable:", error);
        return { success: false, error: "Erreur technique." };
    }
}
