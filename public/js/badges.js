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
import { getUserQuizHistory } from './quiz.js';

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
export async function getUserUniqueQuizCount() {
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
export async function getUserPerfectScoreCount() {
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

/**
 * Update user's streak and last quiz date
 */
export async function updateStreakData() {
    if (!auth.currentUser) return { streak: 0 };

    const userRef = doc(db, 'users', auth.currentUser.uid);
    const userSnap = await getDoc(userRef);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    let streak = 0;
    let lastDate = null;

    if (userSnap.exists()) {
        const data = userSnap.data();
        lastDate = data.lastQuizDate ? new Date(data.lastQuizDate.seconds * 1000) : null;
        streak = data.quizStreak || 0;

        if (lastDate) {
            const lastDateDay = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate()).getTime();
            const diffDays = (today - lastDateDay) / (1000 * 60 * 60 * 24);

            if (diffDays === 1) {
                // Consecutive day
                streak += 1;
            } else if (diffDays > 1) {
                // Streak broken
                streak = 1;
            } else if (diffDays === 0) {
                // Already did a quiz today, keep streak as is
            }
        } else {
            streak = 1;
        }
    } else {
        streak = 1;
    }

    await updateDoc(userRef, {
        quizStreak: streak,
        lastQuizDate: serverTimestamp()
    });

    return { streak };
}

/**
 * Update user's perfect score streak
 */
export async function updatePerfectStreakData(isPerfect) {
    if (!auth.currentUser) return { streak: 0 };

    const userRef = doc(db, 'users', auth.currentUser.uid);
    const userSnap = await getDoc(userRef);
    let streak = 0;

    if (userSnap.exists()) {
        const data = userSnap.data();
        streak = data.perfectStreak || 0;

        if (isPerfect) {
            streak += 1;
        } else {
            streak = 0;
        }
    } else {
        streak = isPerfect ? 1 : 0;
    }

    await updateDoc(userRef, { perfectStreak: streak });
    return { streak };
}

/**
 * Mark a course as read for the user
 */
export async function markCourseAsRead(courseId) {
    if (!auth.currentUser) return;

    const userRef = doc(db, 'users', auth.currentUser.uid);
    const userSnap = await getDoc(userRef);
    let readCourses = [];

    if (userSnap.exists()) {
        readCourses = userSnap.data().readCourses || [];
    }

    if (!readCourses.includes(courseId)) {
        readCourses.push(courseId);
        await updateDoc(userRef, { readCourses });
    }
}

/**
 * Get user's perfect score count on unique courses
 */
export async function getUserUniquePerfectCourseCount() {
    if (!auth.currentUser) return 0;

    const resultsRef = collection(db, 'quiz_results');
    const q = query(resultsRef,
        where('userId', '==', auth.currentUser.uid)
    );
    const snapshot = await getDocs(q);

    const perfectCourses = new Set();
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.score === data.totalQuestions && data.courseId) {
            perfectCourses.add(data.courseId);
        }
    });

    return perfectCourses.size;
}

/**
 * Get all user stats related to badges for progress display
 */
export async function getUserBadgeStats() {
    if (!auth.currentUser) return null;

    const userRef = doc(db, 'users', auth.currentUser.uid);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : {};

    const [uniqueQuizCount, perfectScoreCount, uniquePerfectCourseCount] = await Promise.all([
        getUserUniqueQuizCount(),
        getUserPerfectScoreCount(),
        getUserUniquePerfectCourseCount()
    ]);

    return {
        uniqueQuizCount,
        perfectScoreCount,
        uniquePerfectCourseCount,
        quizStreak: userData.quizStreak || 0,
        perfectStreak: userData.perfectStreak || 0,
        readCourses: userData.readCourses || [],
        favoritesCount: userData.favorites?.length || 0,
        accountAgeDays: userData.createdAt ? Math.floor((new Date() - new Date(userData.createdAt.seconds * 1000)) / (1000 * 60 * 60 * 24)) : 0,
        bugCount: 0 // Will be updated if needed
    };
}

/**
 * Check and unlock badges after a quiz is completed
 * @param {string} quizId - The quiz ID
 * @param {number} score - User's score
 * @param {number} total - Total questions
 * @param {string} quizTitleValue - Quiz title for metadata
 * @param {string} courseId - Course ID
 * @param {Object} options - Additional data (duration, type, etc.)
 */
export async function checkAndUnlockBadges(quizId, score, total, quizTitleValue = '', courseId = null, options = {}) {
    if (!auth.currentUser) return [];

    const unlockedBadges = [];
    const allBadges = await getAllBadgeDefinitions();
    const now = new Date();
    const currentHour = now.getHours();

    // Get fresh user data
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : {};

    const currentStreak = userData.quizStreak || 0;
    const currentPerfectStreak = userData.perfectStreak || 0;
    const readCourses = userData.readCourses || [];

    // Check each badge's requirement
    for (const badge of allBadges) {
        if (!badge.requirement) continue;

        let shouldUnlock = false;
        const metadata = { quizId, quizTitle: quizTitleValue };

        switch (badge.requirement.type) {
            case 'first_quiz':
                const uniqueCount = await getUserUniqueQuizCount();
                if (uniqueCount >= 1) shouldUnlock = true;
                break;

            case 'quiz_count':
                const count = await getUserUniqueQuizCount();
                if (count >= badge.requirement.value) shouldUnlock = true;
                break;

            case 'perfect_score':
                if (score === total) shouldUnlock = true;
                break;

            case 'perfect_count':
                const perfectCount = await getUserPerfectScoreCount();
                if (perfectCount >= badge.requirement.value) shouldUnlock = true;
                break;

            case 'streak':
                if (currentStreak >= badge.requirement.value) shouldUnlock = true;
                break;

            case 'night_owl':
                if (currentHour >= 0 && currentHour < 5) shouldUnlock = true;
                break;

            case 'early_bird':
                if (currentHour >= 5 && currentHour < 8) shouldUnlock = true;
                break;

            case 'perfect_unique_count':
                // Major de Promo: X constant perfect courses
                const uniquePerfectCount = await getUserUniquePerfectCourseCount();
                if (uniquePerfectCount >= badge.requirement.value) shouldUnlock = true;
                break;

            case 'perfect_streak':
                // Sans Faute: X consecutive perfect scores
                if (currentPerfectStreak >= badge.requirement.value) shouldUnlock = true;
                break;

            case 'course_read':
                // Érudit: Course must be read before QCM
                if (courseId && readCourses.includes(courseId)) shouldUnlock = true;
                break;

            case 'favorite_count':
                if (userData.favorites?.length >= badge.requirement.value || options.isFavoriteAction) {
                    // Re-fetch user data if it's a trigger to be sure
                    const freshSnapshot = await getDoc(userRef);
                    const freshData = freshSnapshot.data();
                    if (freshData.favorites?.length >= badge.requirement.value) shouldUnlock = true;
                }
                break;

            case 'speed_perfect':
                if (score === total && options.duration && options.duration <= badge.requirement.value) shouldUnlock = true;
                break;

            case 'comeback_perfect':
                if (score === total) {
                    const history = await getUserQuizHistory(quizId);
                    const hadFail = history.some(h => (h.score / h.totalQuestions) < 0.5);
                    if (hadFail) shouldUnlock = true;
                }
                break;

            case 'first_bug':
                if (options.isBugReport) shouldUnlock = true;
                break;

            case 'loyalty':
                const ageDays = userData.createdAt ? Math.floor((new Date() - new Date(userData.createdAt.seconds * 1000)) / (1000 * 60 * 60 * 24)) : 0;
                const uniqueQuizzes = await getUserUniqueQuizCount();
                if (ageDays >= badge.requirement.days && uniqueQuizzes >= badge.requirement.quizzes) shouldUnlock = true;
                break;

            case 'sunday_warrior':
                if (now.getDay() === 0) {
                    // Count quizzes completed today
                    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const resultsRef = collection(db, 'quiz_results');
                    const q = query(resultsRef,
                        where('userId', '==', auth.currentUser.uid),
                        where('completedAt', '>=', todayStart)
                    );
                    const snap = await getDocs(q);
                    if (snap.size >= badge.requirement.value) shouldUnlock = true;
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
                <div class="badge-popup-icon">
                    ${badge.icon && badge.icon.includes('/')
                ? `<img src="${badge.icon}" alt="${badge.name}">`
                : (badge.icon || '🏆')}
                </div>
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
 * Seed default badges without duplicating or breaking existing progress
 */
export async function seedDefaultBadges() {
    const defaultBadges = [
        {
            id: 'first_steps',
            name: 'Premier Pas',
            description: 'Vous avez complété votre premier QCM !',
            icon: '🎯',
            category: 'progression',
            requirement: { type: 'first_quiz' }
        },
        {
            id: 'explorer',
            name: 'Explorateur',
            description: 'Vous avez complété 5 QCM différents.',
            icon: '🧭',
            category: 'progression',
            requirement: { type: 'quiz_count', value: 5 }
        },
        {
            id: 'expert',
            name: 'Expert',
            description: 'Vous avez complété 10 QCM différents.',
            icon: '🏅',
            category: 'progression',
            requirement: { type: 'quiz_count', value: 10 }
        },
        {
            id: 'perfectionist',
            name: 'Perfectionniste',
            description: 'Vous avez obtenu un score parfait à un QCM.',
            icon: '💎',
            category: 'excellence',
            requirement: { type: 'perfect_score' }
        },
        {
            id: 'winning_streak',
            name: 'Série Gagnante',
            description: 'Vous avez obtenu 3 scores parfaits.',
            icon: '🔥',
            category: 'excellence',
            requirement: { type: 'perfect_count', value: 3 }
        },
        {
            id: 'assiduous',
            name: 'Assidu',
            description: 'Vous avez complété au moins un QCM 3 jours de suite !',
            icon: '📅',
            category: 'progression',
            requirement: { type: 'streak', value: 3 }
        },
        {
            id: 'night_owl',
            name: 'Oiseau de nuit',
            description: 'Vous avez complété un QCM entre minuit et 5h du matin.',
            icon: '🦉',
            category: 'special',
            requirement: { type: 'night_owl' }
        },
        {
            id: 'early_bird',
            name: 'Lève-tôt',
            description: 'Vous avez complété un QCM entre 5h et 8h du matin.',
            icon: '🌅',
            category: 'special',
            requirement: { type: 'early_bird' }
        },
        {
            id: 'valedictorian',
            name: 'Major de Promo',
            description: 'Obtenir un score de 100% sur 5 cours différents.',
            icon: '🎓',
            category: 'excellence',
            requirement: { type: 'perfect_unique_count', value: 5 }
        },
        {
            id: 'flawless',
            name: 'Sans Faute',
            description: 'Enchaîner 3 QCM à la suite avec 100% sans aucune erreur.',
            icon: '⚡',
            category: 'excellence',
            requirement: { type: 'perfect_streak', value: 3 }
        },
        {
            id: 'scholar',
            name: 'Érudit',
            description: "Avoir lu l'intégralité d'un cours avant de lancer le QCM.",
            icon: '📖',
            category: 'excellence',
            requirement: { type: 'course_read' }
        },
        {
            id: 'librarian',
            name: 'Bibliothécaire',
            description: 'Ajouter 5 cours à ses favoris.',
            icon: '📚',
            category: 'special',
            requirement: { type: 'favorite_count', value: 5 }
        },
        {
            id: 'flash',
            name: 'Flash',
            description: 'Réussir un QCM avec 100% en moins de 30 secondes.',
            icon: '⚡',
            category: 'special',
            secret: true,
            hint: 'Il va falloir être vraiment rapide...',
            requirement: { type: 'speed_perfect', value: 30 }
        },
        {
            id: 'perseverant',
            name: 'Le Persévérant',
            description: 'Obtenir 100% à un QCM après avoir échoué à une tentative précédente.',
            icon: '🛡️',
            category: 'excellence',
            requirement: { type: 'comeback_perfect' }
        },
        {
            id: 'sentinel',
            name: 'Sentinelle',
            description: 'Aider à améliorer la plateforme en signalant votre premier bug.',
            icon: '🐞',
            category: 'special',
            requirement: { type: 'first_bug' }
        },
        {
            id: 'pillar',
            name: 'Pilier',
            description: 'Être inscrit depuis 30 jours et avoir complété 10 QCM.',
            icon: '🏛️',
            category: 'special',
            requirement: { type: 'loyalty', days: 30, quizzes: 10 }
        },
        {
            id: 'sunday_warrior',
            name: 'Guerrier du Dimanche',
            description: 'Compléter 3 QCM un dimanche.',
            icon: '⚔️',
            category: 'special',
            requirement: { type: 'sunday_warrior', value: 3 }
        }
    ];

    let createdCount = 0;
    let updatedCount = 0;

    for (const badge of defaultBadges) {
        const { id, ...data } = badge;
        const docRef = doc(db, 'badges', id);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
            await setDoc(docRef, {
                ...data,
                createdAt: serverTimestamp()
            });
            createdCount++;
        } else {
            // Update existing defaults to sync descriptions/requirements
            await updateDoc(docRef, {
                ...data,
                updatedAt: serverTimestamp()
            });
            updatedCount++;
        }
    }

    return {
        message: `${createdCount} badges créés, ${updatedCount} badges mis à jour.`,
        count: createdCount + updatedCount
    };
}

/**
 * Clean up old duplicate badges (with random IDs) that match default badge names
 */
export async function cleanupDuplicateBadges() {
    const fixedIds = ['first_steps', 'explorer', 'expert', 'perfectionist', 'winning_streak', 'assiduous', 'night_owl', 'early_bird', 'valedictorian', 'flawless', 'scholar'];
    const defaultNames = ['Premier Pas', 'Explorateur', 'Expert', 'Perfectionniste', 'Série Gagnante', 'Assidu', 'Oiseau de nuit', 'Lève-tôt', 'Major de Promo', 'Sans Faute', 'Érudit'];

    const snapshot = await getDocs(badgesCollection);
    let deletedCount = 0;

    for (const badgeDoc of snapshot.docs) {
        const id = badgeDoc.id;
        const data = badgeDoc.data();

        // If it's a random ID (not in fixedIds) AND the name matches a default
        if (!fixedIds.includes(id) && defaultNames.includes(data.name)) {
            await deleteDoc(doc(db, 'badges', id));
            deletedCount++;
        }
    }

    return { message: `${deletedCount} badges en double supprimés.`, count: deletedCount };
}
