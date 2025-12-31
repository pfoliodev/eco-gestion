import { db, auth } from './firebase.js';
import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { notyf } from './ui.js';

const badgesCollection = collection(db, 'badges');

// ============================================
// BADGE DEFINITIONS (Admin CRUD)
// ============================================

/**
 * Get all badge definitions
 */
export async function getAllBadgeDefinitions() {
    const snapshot = await getDocs(badgesCollection);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get a single badge definition by ID
 */
export async function getBadgeById(badgeId) {
    const docRef = doc(db, 'badges', badgeId);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() };
}

/**
 * Create a new badge definition (Admin only)
 */
export async function createBadge(badgeData) {
    if (!auth.currentUser) throw new Error("Unauthorized");

    const data = {
        ...badgeData,
        createdAt: serverTimestamp()
    };

    return await addDoc(badgesCollection, data);
}

/**
 * Update a badge definition (Admin only)
 */
export async function updateBadge(badgeId, badgeData) {
    if (!auth.currentUser) throw new Error("Unauthorized");
    const docRef = doc(db, 'badges', badgeId);
    return await updateDoc(docRef, { ...badgeData, updatedAt: serverTimestamp() });
}

/**
 * Delete a badge definition (Admin only)
 */
export async function deleteBadge(badgeId) {
    if (!auth.currentUser) throw new Error("Unauthorized");
    return await deleteDoc(doc(db, 'badges', badgeId));
}

// ============================================
// USER BADGES (Unlocking & Display)
// ============================================

/**
 * Get all badges unlocked by the current user
 */
export async function getUserBadges() {
    if (!auth.currentUser) return [];

    const userBadgesRef = collection(db, 'users', auth.currentUser.uid, 'userBadges');
    const snapshot = await getDocs(userBadgesRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Check if user has a specific badge
 */
export async function userHasBadge(badgeId) {
    if (!auth.currentUser) return false;

    const docRef = doc(db, 'users', auth.currentUser.uid, 'userBadges', badgeId);
    const snapshot = await getDoc(docRef);
    return snapshot.exists();
}

/**
 * Unlock a badge for the current user
 */
export async function unlockBadge(badgeId, metadata = {}) {
    if (!auth.currentUser) throw new Error("User must be logged in");

    // Check if already unlocked
    if (await userHasBadge(badgeId)) {
        return { alreadyUnlocked: true };
    }

    const docRef = doc(db, 'users', auth.currentUser.uid, 'userBadges', badgeId);
    await setDoc(docRef, {
        badgeId,
        unlockedAt: serverTimestamp(),
        ...metadata
    });

    return { alreadyUnlocked: false, success: true };
}

/**
 * Get user's quiz completion count (unique quizzes)
 */
async function getUserUniqueQuizCount() {
    if (!auth.currentUser) return 0;

    const resultsRef = collection(db, 'quiz_results');
    const q = query(resultsRef, where('userId', '==', auth.currentUser.uid));
    const snapshot = await getDocs(q);

    // Count unique quiz IDs
    const uniqueQuizIds = new Set();
    snapshot.docs.forEach(doc => {
        uniqueQuizIds.add(doc.data().quizId);
    });

    return uniqueQuizIds.size;
}

/**
 * Get user's perfect score count
 */
async function getUserPerfectScoreCount() {
    if (!auth.currentUser) return 0;

    const resultsRef = collection(db, 'quiz_results');
    const q = query(resultsRef, where('userId', '==', auth.currentUser.uid));
    const snapshot = await getDocs(q);

    let count = 0;
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.score === data.totalQuestions) {
            count++;
        }
    });

    return count;
}

/**
 * Check if this is user's first attempt at this quiz
 */
async function isFirstAttempt(quizId) {
    if (!auth.currentUser) return false;

    const resultsRef = collection(db, 'quiz_results');
    const q = query(
        resultsRef,
        where('userId', '==', auth.currentUser.uid),
        where('quizId', '==', quizId)
    );
    const snapshot = await getDocs(q);

    // If only 1 result exists, this is the first (just submitted)
    return snapshot.docs.length === 1;
}

// ============================================
// BADGE CHECKING & UNLOCKING LOGIC
// ============================================

/**
 * Check and unlock badges after a quiz is completed
 * @param {string} quizId - The quiz ID
 * @param {number} score - User's score
 * @param {number} total - Total questions
 * @param {string} quizTitle - Quiz title for metadata
 */
export async function checkAndUnlockBadges(quizId, score, total, quizTitle = '') {
    if (!auth.currentUser) return [];

    const unlockedBadges = [];
    const allBadges = await getAllBadgeDefinitions();

    // Check each badge's requirement
    for (const badge of allBadges) {
        if (!badge.requirement) continue;

        let shouldUnlock = false;
        const metadata = { quizId, quizTitle };

        switch (badge.requirement.type) {
            case 'first_quiz':
                // First quiz ever completed (unlock if user has at least 1 quiz)
                const uniqueCount = await getUserUniqueQuizCount();
                if (uniqueCount >= 1) {
                    shouldUnlock = true;
                }
                break;

            case 'quiz_count':
                // Completed X unique quizzes
                const count = await getUserUniqueQuizCount();
                if (count >= badge.requirement.value) {
                    shouldUnlock = true;
                }
                break;

            case 'perfect_score':
                // Got 100% on a quiz
                if (score === total) {
                    shouldUnlock = true;
                }
                break;

            case 'perfect_count':
                // Got X perfect scores
                const perfectCount = await getUserPerfectScoreCount();
                if (perfectCount >= badge.requirement.value) {
                    shouldUnlock = true;
                }
                break;
        }

        if (shouldUnlock) {
            const result = await unlockBadge(badge.id, metadata);
            if (!result.alreadyUnlocked) {
                unlockedBadges.push(badge);
            }
        }
    }

    // Show popups for newly unlocked badges
    for (const badge of unlockedBadges) {
        await showBadgeUnlockedPopup(badge);
    }

    return unlockedBadges;
}

// ============================================
// BADGE UNLOCKED POPUP
// ============================================

/**
 * Show a celebratory popup when a badge is unlocked
 */
export function showBadgeUnlockedPopup(badge) {
    return new Promise((resolve) => {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'badge-popup-overlay';
        overlay.innerHTML = `
            <div class="badge-popup">
                <div class="badge-popup-glow"></div>
                <div class="badge-popup-icon">${badge.icon || '🏆'}</div>
                <h3 class="badge-popup-title">Badge Débloqué !</h3>
                <p class="badge-popup-name">${badge.name}</p>
                <p class="badge-popup-description">${badge.description || ''}</p>
                <button class="btn-primary badge-popup-close">Super !</button>
            </div>
        `;

        document.body.appendChild(overlay);

        // Trigger animation
        requestAnimationFrame(() => {
            overlay.classList.add('visible');
        });

        // Close handler
        const closeBtn = overlay.querySelector('.badge-popup-close');
        const closePopup = () => {
            overlay.classList.remove('visible');
            setTimeout(() => {
                overlay.remove();
                resolve();
            }, 300);
        };

        closeBtn.onclick = closePopup;
        overlay.onclick = (e) => {
            if (e.target === overlay) closePopup();
        };
    });
}

// ============================================
// SEED DEFAULT BADGES (One-time setup)
// ============================================

/**
 * Seed default badges if none exist (call from admin panel)
 */
export async function seedDefaultBadges() {
    const existing = await getAllBadgeDefinitions();
    if (existing.length > 0) {
        return { message: 'Badges already exist', count: existing.length };
    }

    const defaultBadges = [
        {
            name: 'Premier Pas',
            description: 'Vous avez complété votre premier QCM !',
            icon: '🎯',
            category: 'progression',
            requirement: { type: 'first_quiz' }
        },
        {
            name: 'Explorateur',
            description: 'Vous avez complété 5 QCM différents.',
            icon: '🧭',
            category: 'progression',
            requirement: { type: 'quiz_count', value: 5 }
        },
        {
            name: 'Expert',
            description: 'Vous avez complété 10 QCM différents.',
            icon: '🏅',
            category: 'progression',
            requirement: { type: 'quiz_count', value: 10 }
        },
        {
            name: 'Perfectionniste',
            description: 'Vous avez obtenu un score parfait à un QCM.',
            icon: '💎',
            category: 'excellence',
            requirement: { type: 'perfect_score' }
        },
        {
            name: 'Série Gagnante',
            description: 'Vous avez obtenu 3 scores parfaits.',
            icon: '🔥',
            category: 'excellence',
            requirement: { type: 'perfect_count', value: 3 }
        }
    ];

    for (const badge of defaultBadges) {
        await createBadge(badge);
    }

    return { message: 'Default badges created', count: defaultBadges.length };
}
