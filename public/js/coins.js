/**
 * IFH Coins Module
 * =================
 * Core module for managing virtual currency (IFH Coins).
 * Handles balance, transactions, and real-time listeners.
 */

import { db, auth } from './firebase.js';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    limit,
    serverTimestamp,
    increment,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { ECONOMY } from './config/economy.js';

// ============================================
// BALANCE MANAGEMENT
// ============================================

/**
 * Get current user's coin balance
 * @returns {Promise<number>} Current balance
 */
export async function getUserBalance() {
    if (!auth.currentUser) return 0;

    try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            return userSnap.data().balance || 0;
        }
        return 0;
    } catch (error) {
        console.error('Error getting balance:', error);
        return 0;
    }
}

/**
 * Get user's total earned coins (lifetime)
 * @returns {Promise<number>} Total earned
 */
export async function getTotalEarned() {
    if (!auth.currentUser) return 0;

    try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            return userSnap.data().totalEarned || 0;
        }
        return 0;
    } catch (error) {
        console.error('Error getting total earned:', error);
        return 0;
    }
}

/**
 * Initialize balance listener for real-time updates
 * @param {function} callback - Called with new balance value
 * @returns {function} Unsubscribe function
 */
export function initBalanceListener(callback) {
    if (!auth.currentUser) return () => { };

    const userRef = doc(db, 'users', auth.currentUser.uid);

    return onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
            const balance = snap.data().balance || 0;
            callback(balance);
        }
    }, (error) => {
        console.error('Balance listener error:', error);
    });
}

// ============================================
// TRANSACTIONS
// ============================================

/**
 * Add coins to user's balance
 * @param {number} amount - Amount to add
 * @param {string} reason - Reason code (quiz_complete, badge_unlock, etc.)
 * @param {string} relatedId - Optional related entity ID (quizId, badgeId, etc.)
 * @param {object} metadata - Optional additional data
 * @returns {Promise<{success: boolean, newBalance: number, transaction: object}>}
 */
export async function addCoins(amount, reason, relatedId = null, metadata = {}) {
    if (!auth.currentUser) {
        return { success: false, error: 'Not authenticated' };
    }

    if (amount <= 0) {
        return { success: false, error: 'Amount must be positive' };
    }

    try {
        const userId = auth.currentUser.uid;
        const userRef = doc(db, 'users', userId);
        const transactionsRef = collection(db, 'users', userId, 'transactions');

        // Update user balance
        await updateDoc(userRef, {
            balance: increment(amount),
            totalEarned: increment(amount)
        });

        // Create transaction record
        const transaction = {
            type: ECONOMY.TRANSACTION_TYPES.EARN,
            amount,
            reason,
            relatedId,
            metadata,
            createdAt: serverTimestamp()
        };

        await addDoc(transactionsRef, transaction);

        // Get new balance
        const newBalance = await getUserBalance();

        console.log(`💰 +${amount} IFH (${reason})`, { newBalance });

        return { success: true, newBalance, transaction };

    } catch (error) {
        console.error('Error adding coins:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Spend coins from user's balance
 * @param {number} amount - Amount to spend
 * @param {string} reason - Reason code (shop_purchase, trade, etc.)
 * @param {string} relatedId - Optional related entity ID (itemId, tradeId, etc.)
 * @param {object} metadata - Optional additional data
 * @returns {Promise<{success: boolean, newBalance: number, error?: string}>}
 */
export async function spendCoins(amount, reason, relatedId = null, metadata = {}) {
    if (!auth.currentUser) {
        return { success: false, error: 'Not authenticated' };
    }

    if (amount <= 0) {
        return { success: false, error: 'Amount must be positive' };
    }

    try {
        const userId = auth.currentUser.uid;
        const userRef = doc(db, 'users', userId);

        // Check current balance
        const currentBalance = await getUserBalance();
        if (currentBalance < amount) {
            return { success: false, error: 'Insufficient balance', currentBalance };
        }

        const transactionsRef = collection(db, 'users', userId, 'transactions');

        // Deduct from balance
        await updateDoc(userRef, {
            balance: increment(-amount),
            totalSpent: increment(amount)
        });

        // Create transaction record
        const transaction = {
            type: ECONOMY.TRANSACTION_TYPES.SPEND,
            amount: -amount,
            reason: metadata.itemName || reason,
            relatedId,
            metadata,
            createdAt: serverTimestamp()
        };

        await addDoc(transactionsRef, transaction);

        // Get new balance
        const newBalance = await getUserBalance();

        console.log(`💸 -${amount} IFH (${reason})`, { newBalance });

        return { success: true, newBalance };

    } catch (error) {
        console.error('Error spending coins:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Transfer coins between users (for trades)
 * @param {string} toUserId - Recipient user ID
 * @param {number} amount - Amount to transfer
 * @param {string} tradeId - Trade ID for reference
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function transferCoins(toUserId, amount, tradeId) {
    if (!auth.currentUser) {
        return { success: false, error: 'Not authenticated' };
    }

    if (amount <= 0) {
        return { success: false, error: 'Amount must be positive' };
    }

    try {
        const fromUserId = auth.currentUser.uid;

        // Verify sender has enough balance
        const currentBalance = await getUserBalance();
        if (currentBalance < amount) {
            return { success: false, error: 'Insufficient balance' };
        }

        // Deduct from sender
        const fromUserRef = doc(db, 'users', fromUserId);
        await updateDoc(fromUserRef, {
            balance: increment(-amount)
        });

        // Add to recipient
        const toUserRef = doc(db, 'users', toUserId);
        await updateDoc(toUserRef, {
            balance: increment(amount)
        });

        // Create transaction records for both users
        const senderTransaction = {
            type: ECONOMY.TRANSACTION_TYPES.TRADE_OUT,
            amount: -amount,
            reason: 'trade_transfer',
            relatedId: tradeId,
            toUserId,
            createdAt: serverTimestamp()
        };

        const recipientTransaction = {
            type: ECONOMY.TRANSACTION_TYPES.TRADE_IN,
            amount,
            reason: 'trade_received',
            relatedId: tradeId,
            fromUserId,
            createdAt: serverTimestamp()
        };

        await addDoc(collection(db, 'users', fromUserId, 'transactions'), senderTransaction);
        await addDoc(collection(db, 'users', toUserId, 'transactions'), recipientTransaction);

        return { success: true };

    } catch (error) {
        console.error('Error transferring coins:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// TRANSACTION HISTORY
// ============================================

/**
 * Get user's transaction history
 * @param {number} limitCount - Number of transactions to fetch
 * @returns {Promise<Array>} List of transactions
 */
export async function getTransactionHistory(limitCount = 20) {
    if (!auth.currentUser) return [];

    try {
        const userId = auth.currentUser.uid;
        const transactionsRef = collection(db, 'users', userId, 'transactions');
        const q = query(transactionsRef, orderBy('createdAt', 'desc'), limit(limitCount));

        const snap = await getDocs(q);
        return snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

    } catch (error) {
        console.error('Error getting transaction history:', error);
        return [];
    }
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

/**
 * Admin: Gift coins to a user
 * @param {string} userId - Target user ID
 * @param {number} amount - Amount to gift
 * @param {string} adminNote - Reason for gift
 * @returns {Promise<{success: boolean}>}
 */
export async function adminGiftCoins(userId, amount, adminNote = '') {
    if (!auth.currentUser) {
        return { success: false, error: 'Not authenticated' };
    }

    try {
        const userRef = doc(db, 'users', userId);
        const transactionsRef = collection(db, 'users', userId, 'transactions');

        await updateDoc(userRef, {
            balance: increment(amount),
            totalEarned: increment(amount > 0 ? amount : 0)
        });

        await addDoc(transactionsRef, {
            type: ECONOMY.TRANSACTION_TYPES.ADMIN_GIFT,
            amount,
            reason: 'admin_gift',
            adminNote,
            adminId: auth.currentUser.uid,
            createdAt: serverTimestamp()
        });

        return { success: true };

    } catch (error) {
        console.error('Error gifting coins:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// UI HELPERS
// ============================================

/**
 * Format coin amount for display
 * @param {number} amount - Amount to format
 * @returns {string} Formatted string
 */
export function formatCoins(amount) {
    if (amount >= 1000000) {
        return (amount / 1000000).toFixed(1) + 'M';
    }
    if (amount >= 1000) {
        return (amount / 1000).toFixed(1) + 'K';
    }
    return amount.toString();
}

/**
 * Get transaction reason label
 * @param {string} reason - Reason code
 * @returns {string} Human-readable label
 */
export function getTransactionLabel(reason) {
    const labels = {
        'quiz_complete': 'Quiz complété',
        'quiz_perfect': 'Score parfait',
        'badge_unlock': 'Badge débloqué',
        'course_complete': 'Cours terminé',
        'shop_purchase': 'Achat boutique',
        'trade_transfer': 'Échange envoyé',
        'trade_received': 'Échange reçu',
        'admin_gift': 'Cadeau admin',
        'first_login': 'Bonus de bienvenue',
        'refund': 'Remboursement'
    };
    return labels[reason] || reason;
}

// ============================================
// BALANCE UI UPDATE
// ============================================

/**
 * Update the balance display in navbar
 * @param {number} balance - Current balance
 */
export function updateBalanceDisplay(balance) {
    const balanceElements = document.querySelectorAll('.coin-amount');
    balanceElements.forEach(el => {
        el.textContent = formatCoins(balance);
    });
}

/**
 * Show coin gain animation
 * @param {number} amount - Amount gained
 * @param {HTMLElement} sourceElement - Element to animate from (optional)
 */
export function showCoinGainAnimation(amount, sourceElement = null) {
    const popup = document.createElement('div');
    popup.className = 'coin-gain-popup';
    popup.innerHTML = `
        <span class="coin-gain-icon">🪙</span>
        <span class="coin-gain-amount">+${amount}</span>
    `;

    if (sourceElement) {
        const rect = sourceElement.getBoundingClientRect();
        popup.style.left = rect.left + rect.width / 2 + 'px';
        popup.style.top = rect.top + 'px';
    } else {
        popup.style.left = '50%';
        popup.style.top = '20%';
    }

    document.body.appendChild(popup);

    // Animate
    requestAnimationFrame(() => {
        popup.classList.add('animate');
    });

    setTimeout(() => popup.remove(), 2000);
}

// Export for testing/debugging
if (typeof window !== 'undefined') {
    window.coinsDebug = {
        getUserBalance,
        addCoins,
        spendCoins,
        getTransactionHistory
    };
}
