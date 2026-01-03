/**
 * Trade System Module
 * ====================
 * Handles item trading between users.
 */

import { db, auth, tradeOffersCollection } from './firebase.js';
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
    addDoc
} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { transferCoins } from './coins.js';
import { ECONOMY } from './config/economy.js';
import { notyf } from './ui.js';

// Trade status constants
export const TRADE_STATUS = {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    REJECTED: 'rejected',
    CANCELLED: 'cancelled',
    EXPIRED: 'expired'
};

// ============================================
// CREATE & MANAGE TRADE OFFERS
// ============================================

/**
 * Create a new trade offer
 * @param {string} toUserId - Recipient user ID
 * @param {object} offer - Trade offer details
 * @param {Array<string>} offer.offeredItems - Item IDs being offered
 * @param {Array<string>} offer.requestedItems - Item IDs being requested
 * @param {number} offer.offeredCoins - Coins being offered (optional)
 * @param {number} offer.requestedCoins - Coins being requested (optional)
 * @returns {Promise<{success: boolean, tradeId?: string}>}
 */
export async function createTradeOffer(toUserId, offer = {}) {
    if (!auth.currentUser) {
        return { success: false, error: 'Non authentifié' };
    }

    const fromUserId = auth.currentUser.uid;

    if (fromUserId === toUserId) {
        return { success: false, error: 'Vous ne pouvez pas échanger avec vous-même' };
    }

    // Validate offer has something to trade
    const hasItems = (offer.offeredItems?.length > 0) || (offer.requestedItems?.length > 0);
    const hasCoins = (offer.offeredCoins > 0) || (offer.requestedCoins > 0);

    if (!hasItems && !hasCoins) {
        return { success: false, error: 'L\'offre doit contenir des articles ou des IFH' };
    }

    // Check item limits
    if (offer.offeredItems?.length > ECONOMY.MAX_ITEMS_PER_TRADE) {
        return { success: false, error: `Maximum ${ECONOMY.MAX_ITEMS_PER_TRADE} articles par échange` };
    }

    try {
        // Verify user owns the offered items
        for (const itemId of (offer.offeredItems || [])) {
            const hasItem = await userOwnsItem(fromUserId, itemId);
            if (!hasItem) {
                return { success: false, error: 'Vous ne possédez pas tous les articles proposés' };
            }
        }

        // Calculate expiry date
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + ECONOMY.TRADE_OFFER_EXPIRY);

        const tradeData = {
            fromUserId,
            toUserId,
            offeredItems: offer.offeredItems || [],
            requestedItems: offer.requestedItems || [],
            offeredCoins: offer.offeredCoins || 0,
            requestedCoins: offer.requestedCoins || 0,
            status: TRADE_STATUS.PENDING,
            createdAt: serverTimestamp(),
            expiresAt: expiryDate,
            message: offer.message || ''
        };

        const docRef = await addDoc(tradeOffersCollection, tradeData);

        return { success: true, tradeId: docRef.id };

    } catch (error) {
        console.error('Error creating trade offer:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Accept a trade offer
 * @param {string} offerId - Trade offer ID
 * @returns {Promise<{success: boolean}>}
 */
export async function acceptTradeOffer(offerId) {
    if (!auth.currentUser) {
        return { success: false, error: 'Non authentifié' };
    }

    try {
        const offerRef = doc(db, 'tradeOffers', offerId);
        const offerSnap = await getDoc(offerRef);

        if (!offerSnap.exists()) {
            return { success: false, error: 'Offre non trouvée' };
        }

        const offer = offerSnap.data();

        // Verify current user is the recipient
        if (offer.toUserId !== auth.currentUser.uid) {
            return { success: false, error: 'Vous ne pouvez pas accepter cette offre' };
        }

        // Check if offer is still pending
        if (offer.status !== TRADE_STATUS.PENDING) {
            return { success: false, error: 'Cette offre n\'est plus disponible' };
        }

        // Check if offer is expired
        const expiryDate = offer.expiresAt.toDate ? offer.expiresAt.toDate() : new Date(offer.expiresAt);
        if (expiryDate < new Date()) {
            await updateDoc(offerRef, { status: TRADE_STATUS.EXPIRED });
            return { success: false, error: 'Cette offre a expiré' };
        }

        // Verify recipient owns the requested items
        for (const itemId of offer.requestedItems) {
            const hasItem = await userOwnsItem(auth.currentUser.uid, itemId);
            if (!hasItem) {
                return { success: false, error: 'Vous ne possédez plus les articles demandés' };
            }
        }

        // Execute the trade
        // 1. Transfer items from sender to recipient
        for (const itemId of offer.offeredItems) {
            await transferItem(offer.fromUserId, offer.toUserId, itemId);
        }

        // 2. Transfer items from recipient to sender
        for (const itemId of offer.requestedItems) {
            await transferItem(offer.toUserId, offer.fromUserId, itemId);
        }

        // 3. Transfer coins if applicable
        if (offer.offeredCoins > 0) {
            // Sender gives coins to recipient
            await transferCoinsForTrade(offer.fromUserId, offer.toUserId, offer.offeredCoins, offerId);
        }

        if (offer.requestedCoins > 0) {
            // Recipient gives coins to sender
            await transferCoinsForTrade(offer.toUserId, offer.fromUserId, offer.requestedCoins, offerId);
        }

        // Update offer status
        await updateDoc(offerRef, {
            status: TRADE_STATUS.ACCEPTED,
            completedAt: serverTimestamp()
        });

        return { success: true };

    } catch (error) {
        console.error('Error accepting trade:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Reject a trade offer
 * @param {string} offerId - Trade offer ID
 * @returns {Promise<{success: boolean}>}
 */
export async function rejectTradeOffer(offerId) {
    if (!auth.currentUser) {
        return { success: false, error: 'Non authentifié' };
    }

    try {
        const offerRef = doc(db, 'tradeOffers', offerId);
        const offerSnap = await getDoc(offerRef);

        if (!offerSnap.exists()) {
            return { success: false, error: 'Offre non trouvée' };
        }

        const offer = offerSnap.data();

        // Verify current user is the recipient
        if (offer.toUserId !== auth.currentUser.uid) {
            return { success: false, error: 'Vous ne pouvez pas refuser cette offre' };
        }

        await updateDoc(offerRef, {
            status: TRADE_STATUS.REJECTED,
            rejectedAt: serverTimestamp()
        });

        return { success: true };

    } catch (error) {
        console.error('Error rejecting trade:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Cancel a trade offer (sender only)
 * @param {string} offerId - Trade offer ID
 * @returns {Promise<{success: boolean}>}
 */
export async function cancelTradeOffer(offerId) {
    if (!auth.currentUser) {
        return { success: false, error: 'Non authentifié' };
    }

    try {
        const offerRef = doc(db, 'tradeOffers', offerId);
        const offerSnap = await getDoc(offerRef);

        if (!offerSnap.exists()) {
            return { success: false, error: 'Offre non trouvée' };
        }

        const offer = offerSnap.data();

        // Verify current user is the sender
        if (offer.fromUserId !== auth.currentUser.uid) {
            return { success: false, error: 'Vous ne pouvez pas annuler cette offre' };
        }

        if (offer.status !== TRADE_STATUS.PENDING) {
            return { success: false, error: 'Cette offre ne peut plus être annulée' };
        }

        await updateDoc(offerRef, {
            status: TRADE_STATUS.CANCELLED,
            cancelledAt: serverTimestamp()
        });

        return { success: true };

    } catch (error) {
        console.error('Error cancelling trade:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// FETCH TRADE OFFERS
// ============================================

/**
 * Get pending trade offers for current user
 * @returns {Promise<{received: Array, sent: Array}>}
 */
export async function getPendingOffers() {
    if (!auth.currentUser) return { received: [], sent: [] };

    try {
        const userId = auth.currentUser.uid;

        // Get received offers
        const receivedQuery = query(
            tradeOffersCollection,
            where('toUserId', '==', userId),
            where('status', '==', TRADE_STATUS.PENDING)
        );

        // Get sent offers
        const sentQuery = query(
            tradeOffersCollection,
            where('fromUserId', '==', userId),
            where('status', '==', TRADE_STATUS.PENDING)
        );

        const [receivedSnap, sentSnap] = await Promise.all([
            getDocs(receivedQuery),
            getDocs(sentQuery)
        ]);

        const received = receivedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const sent = sentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return { received, sent };

    } catch (error) {
        console.error('Error fetching pending offers:', error);
        return { received: [], sent: [] };
    }
}

/**
 * Get trade history for current user
 * @param {number} limitCount - Number of trades to fetch
 * @returns {Promise<Array>}
 */
export async function getTradeHistory(limitCount = 20) {
    if (!auth.currentUser) return [];

    try {
        const userId = auth.currentUser.uid;

        // Get all trades involving the user
        const sentQuery = query(
            tradeOffersCollection,
            where('fromUserId', '==', userId)
        );

        const receivedQuery = query(
            tradeOffersCollection,
            where('toUserId', '==', userId)
        );

        const [sentSnap, receivedSnap] = await Promise.all([
            getDocs(sentQuery),
            getDocs(receivedQuery)
        ]);

        const allTrades = [
            ...sentSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), role: 'sender' })),
            ...receivedSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), role: 'receiver' }))
        ];

        // Sort by date and limit
        allTrades.sort((a, b) => {
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA;
        });

        return allTrades.slice(0, limitCount);

    } catch (error) {
        console.error('Error fetching trade history:', error);
        return [];
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a user owns a specific item
 * @param {string} userId - User ID
 * @param {string} itemId - Item ID
 * @returns {Promise<boolean>}
 */
async function userOwnsItem(userId, itemId) {
    try {
        const inventoryRef = doc(db, 'users', userId, 'inventory', itemId);
        const snap = await getDoc(inventoryRef);
        return snap.exists();
    } catch (error) {
        console.error('Error checking item ownership:', error);
        return false;
    }
}

/**
 * Transfer an item from one user to another
 * @param {string} fromUserId - Sender user ID
 * @param {string} toUserId - Recipient user ID
 * @param {string} itemId - Item ID
 */
async function transferItem(fromUserId, toUserId, itemId) {
    try {
        // Get item data from sender's inventory
        const fromInventoryRef = doc(db, 'users', fromUserId, 'inventory', itemId);
        const itemSnap = await getDoc(fromInventoryRef);

        if (!itemSnap.exists()) {
            throw new Error('Item not found in sender inventory');
        }

        const itemData = itemSnap.data();

        // Add to recipient's inventory
        const toInventoryRef = doc(db, 'users', toUserId, 'inventory', itemId);
        await setDoc(toInventoryRef, {
            ...itemData,
            equipped: false,
            acquiredVia: 'trade',
            transferredAt: serverTimestamp()
        });

        // Remove from sender's inventory
        await deleteDoc(fromInventoryRef);

        // If item was equipped, clear from user document
        if (itemData.equipped) {
            const userRef = doc(db, 'users', fromUserId);
            const updateData = {};

            if (itemData.category === 'theme') {
                updateData.equippedTheme = null;
            } else if (itemData.category === 'frame') {
                updateData.equippedFrame = null;
            }

            if (Object.keys(updateData).length > 0) {
                await updateDoc(userRef, updateData);
            }
        }

    } catch (error) {
        console.error('Error transferring item:', error);
        throw error;
    }
}

/**
 * Transfer coins between users for a trade
 * @param {string} fromUserId - Sender user ID
 * @param {string} toUserId - Recipient user ID
 * @param {number} amount - Amount to transfer
 * @param {string} tradeId - Trade ID for reference
 */
async function transferCoinsForTrade(fromUserId, toUserId, amount, tradeId) {
    try {
        // This requires adjusting the transferCoins function to work with specific user IDs
        // For now, we'll use direct document updates
        const fromUserRef = doc(db, 'users', fromUserId);
        const toUserRef = doc(db, 'users', toUserId);

        // Get current balances
        const [fromSnap, toSnap] = await Promise.all([
            getDoc(fromUserRef),
            getDoc(toUserRef)
        ]);

        const fromBalance = fromSnap.data()?.balance || 0;

        if (fromBalance < amount) {
            throw new Error('Insufficient balance for trade');
        }

        // Update balances
        await updateDoc(fromUserRef, {
            balance: fromBalance - amount
        });

        const toBalance = toSnap.data()?.balance || 0;
        await updateDoc(toUserRef, {
            balance: toBalance + amount
        });

    } catch (error) {
        console.error('Error transferring coins for trade:', error);
        throw error;
    }
}

/**
 * Get user info for display in trade UI
 * @param {string} userId - User ID
 * @returns {Promise<{displayName: string, photoURL: string}>}
 */
export async function getUserDisplayInfo(userId) {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            return { displayName: 'Utilisateur inconnu', photoURL: null };
        }

        const data = userSnap.data();
        const displayName = [data.firstname, data.lastname].filter(Boolean).join(' ') || data.email?.split('@')[0] || 'Utilisateur';

        return {
            displayName,
            photoURL: data.photoURL || null
        };
    } catch (error) {
        console.error('Error fetching user info:', error);
        return { displayName: 'Utilisateur', photoURL: null };
    }
}

/**
 * Search users for trading
 * @param {string} searchTerm - Search term (email or name)
 * @returns {Promise<Array>}
 */
export async function searchUsersForTrade(searchTerm) {
    if (!auth.currentUser || !searchTerm || searchTerm.length < 3) {
        return [];
    }

    try {
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);

        const searchLower = searchTerm.toLowerCase();
        const currentUserId = auth.currentUser.uid;

        const results = snapshot.docs
            .filter(doc => {
                if (doc.id === currentUserId) return false;

                const data = doc.data();
                const email = (data.email || '').toLowerCase();
                const firstname = (data.firstname || '').toLowerCase();
                const lastname = (data.lastname || '').toLowerCase();

                return email.includes(searchLower) ||
                    firstname.includes(searchLower) ||
                    lastname.includes(searchLower);
            })
            .slice(0, 10)
            .map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    displayName: [data.firstname, data.lastname].filter(Boolean).join(' ') || data.email?.split('@')[0],
                    email: data.email,
                    photoURL: data.photoURL
                };
            });

        return results;

    } catch (error) {
        console.error('Error searching users:', error);
        return [];
    }
}
