import { db, auth } from './firebase.js';
import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    serverTimestamp,
    query,
    where
} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";

// Configuration for Gym Badges
export const GYM_BADGES = [
    {
        id: 'badge_eco_gestion',
        subject: 'Eco/Gestion',
        name: 'Badge Gestion',
        description: 'Décerné pour avoir vaincu le Professeur en Éco-Gestion.',
        image: '/images/badges/badge_eco_gestion.png',
        triggerTag: 'eco-gestion'
    }
];

/**
 * Unlock a Gym Badge for the user
 * @param {string} badgeId - The ID of the badge to unlock
 */
export async function unlockGymBadge(badgeId) {
    if (!auth.currentUser) return { success: false, error: 'Not logged in' };

    const userBadgeRef = doc(db, 'users', auth.currentUser.uid, 'gymBadges', badgeId);

    try {
        const snap = await getDoc(userBadgeRef);
        if (snap.exists()) {
            const badgeDef = GYM_BADGES.find(b => b.id === badgeId);
            return { success: true, isNew: false, badge: snap.data(), def: badgeDef };
        }

        // New Unlock!
        const badgeDef = GYM_BADGES.find(b => b.id === badgeId);
        if (!badgeDef) return { success: false, error: 'Invalid Badge ID' };

        const newBadgeData = {
            badgeId: badgeId,
            unlockedAt: serverTimestamp(),
            name: badgeDef.name,
            subject: badgeDef.subject,
            image: badgeDef.image
        };

        await setDoc(userBadgeRef, newBadgeData);
        console.log(`🏅 Gym Badge Unlocked: ${badgeDef.name}`);

        return { success: true, isNew: true, badge: newBadgeData, def: badgeDef };

    } catch (error) {
        console.error("Error unlocking gym badge:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Get all Gym Badges unlocked by the current user
 */
export async function getUserGymBadges() {
    if (!auth.currentUser) return [];

    const badgesRef = collection(db, 'users', auth.currentUser.uid, 'gymBadges');
    try {
        const snap = await getDocs(badgesRef);
        return snap.docs.map(doc => doc.data());
    } catch (error) {
        console.error("Error fetching gym badges:", error);
        return [];
    }
}

/**
 * Determine which badge (if any) corresponds to a completed quiz/evaluation
 * @param {Object} quiz - The quiz object completed
 */
export function getBadgeForQuiz(quiz) {
    if (!quiz) return null;

    // Check by tag
    if (quiz.tags && quiz.tags.includes('eco-gestion')) {
        return GYM_BADGES.find(b => b.triggerTag === 'eco-gestion');
    }

    // Check by category
    if (quiz.category && (quiz.category.includes('Eco') || quiz.category.includes('Gestion'))) {
        return GYM_BADGES.find(b => b.subject === 'Eco/Gestion');
    }

    // Fallback: Check by Title (Robust for Demo)
    if (quiz.title && (quiz.title.includes('Gestion') || quiz.title.includes('Éco'))) {
        return GYM_BADGES.find(b => b.id === 'badge_eco_gestion');
    }

    return null;
}
