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
    increment
} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { spendCoins, getUserBalance, updateBalanceDisplay } from './coins.js';
import { ECONOMY } from './config/economy.js';
import { notyf } from './ui.js';

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
export async function purchaseItem(itemId) {
    if (!auth.currentUser) {
        return { success: false, error: 'Non authentifié' };
    }

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

        // Check if user already owns this item (for non-consumable items)
        if (item.category !== 'boost') {
            const hasItem = await userOwnsItem(itemId);
            if (hasItem) {
                return { success: false, error: 'Vous possédez déjà cet article' };
            }
        }

        // Check balance
        const balance = await getUserBalance();
        if (balance < item.price) {
            return { success: false, error: 'Solde insuffisant', balance, price: item.price };
        }

        // Deduct coins
        const spendResult = await spendCoins(item.price, 'shop_purchase', itemId, {
            itemName: item.name,
            category: item.category
        });

        if (!spendResult.success) {
            return { success: false, error: spendResult.error };
        }

        // Add item to user's inventory
        const userId = auth.currentUser.uid;
        const inventoryRef = doc(db, 'users', userId, 'inventory', itemId);

        await setDoc(inventoryRef, {
            itemId,
            itemName: item.name,
            category: item.category,
            purchasedAt: serverTimestamp(),
            equipped: false
        });

        // Decrease stock if limited
        if (item.stock !== undefined && item.stock !== null) {
            const itemRef = doc(db, 'shopItems', itemId);
            await updateDoc(itemRef, {
                stock: increment(-1)
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
        const snapshot = await getDocs(inventoryRef);

        let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

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
        const inventoryRef = doc(db, 'users', userId, 'inventory', itemId);
        const snapshot = await getDoc(inventoryRef);
        return snapshot.exists();
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
        const allInventory = await getUserInventory(category);
        for (const item of allInventory) {
            if (item.equipped && item.id !== itemId) {
                const otherRef = doc(db, 'users', userId, 'inventory', item.id);
                await updateDoc(otherRef, { equipped: false });
            }
        }

        // Equip this item
        await updateDoc(inventoryRef, { equipped: true });

        // Update user document with equipped item reference
        const userRef = doc(db, 'users', userId);
        const updateData = {};

        if (category === ECONOMY.CATEGORIES.THEME) {
            updateData.equippedTheme = itemId;
        } else if (category === ECONOMY.CATEGORIES.FRAME) {
            updateData.equippedFrame = itemId;
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
