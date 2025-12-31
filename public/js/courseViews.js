// Course Views Management - Track who viewed courses
import { db, auth } from './firebase.js';
import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";

const courseViewsCollection = collection(db, 'courseViews');

// ============================================
// TRACK COURSE VIEW
// ============================================

/**
 * Track when a user views a course
 * Creates or updates the view record with cached user info
 */
export async function trackCourseView(courseId) {
    if (!auth.currentUser) return;

    try {
        // Get current user info for caching
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};

        const userName = userData.firstname ||
            auth.currentUser.displayName?.split(' ')[0] ||
            auth.currentUser.email?.split('@')[0] ||
            'Utilisateur';

        const userAvatar = userData.photoURL ||
            auth.currentUser.photoURL ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=6366f1&color=fff`;

        // Use composite key: courseId_userId to ensure uniqueness
        const viewId = `${courseId}_${auth.currentUser.uid}`;
        const viewRef = doc(db, 'courseViews', viewId);

        await setDoc(viewRef, {
            courseId,
            userId: auth.currentUser.uid,
            userName,
            userAvatar,
            viewedAt: serverTimestamp()
        }, { merge: true });

    } catch (error) {
        console.error("Error tracking course view:", error);
        // Silent fail - don't interrupt user experience
    }
}

// ============================================
// GET COURSE VIEWERS
// ============================================

/**
 * Get the most recent viewers of a course
 * @param {string} courseId - Course ID
 * @param {number} maxViewers - Maximum number of viewers to return (default 5)
 * @returns {Array} Array of viewer objects with avatar, name, viewedAt
 */
export async function getCourseViewers(courseId, maxViewers = 5) {
    if (!auth.currentUser) return [];

    try {
        // Try with orderBy first (requires composite index)
        const q = query(
            courseViewsCollection,
            where('courseId', '==', courseId),
            orderBy('viewedAt', 'desc'),
            limit(maxViewers)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        // Fallback: query without orderBy, sort client-side, then limit
        console.warn("Falling back to unordered query for viewers:", error.message);
        try {
            const q = query(
                courseViewsCollection,
                where('courseId', '==', courseId)
            );

            const snapshot = await getDocs(q);
            const viewers = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Sort client-side and limit
            return viewers
                .sort((a, b) => {
                    const aTime = a.viewedAt?.seconds || 0;
                    const bTime = b.viewedAt?.seconds || 0;
                    return bTime - aTime;
                })
                .slice(0, maxViewers);
        } catch (fallbackError) {
            console.error("Error getting course viewers:", fallbackError);
            return [];
        }
    }
}

/**
 * Get the total count of unique viewers for a course
 * @param {string} courseId - Course ID
 * @returns {number} Total number of unique viewers
 */
export async function getCourseViewersCount(courseId) {
    if (!auth.currentUser) return 0;

    try {
        const q = query(
            courseViewsCollection,
            where('courseId', '==', courseId)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.length;
    } catch (error) {
        console.error("Error getting viewers count:", error);
        return 0;
    }
}

/**
 * Get all viewers for a course (for detailed list)
 * @param {string} courseId - Course ID
 * @returns {Array} Array of all viewer objects
 */
export async function getAllCourseViewers(courseId) {
    if (!auth.currentUser) return [];

    try {
        // Try with orderBy first (requires composite index)
        const q = query(
            courseViewsCollection,
            where('courseId', '==', courseId),
            orderBy('viewedAt', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        // Fallback: query without orderBy and sort client-side
        console.warn("Falling back to unordered query:", error.message);
        try {
            const q = query(
                courseViewsCollection,
                where('courseId', '==', courseId)
            );

            const snapshot = await getDocs(q);
            const viewers = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Sort client-side by viewedAt descending
            return viewers.sort((a, b) => {
                const aTime = a.viewedAt?.seconds || 0;
                const bTime = b.viewedAt?.seconds || 0;
                return bTime - aTime;
            });
        } catch (fallbackError) {
            console.error("Error getting all course viewers:", fallbackError);
            return [];
        }
    }
}

// ============================================
// RENDER HELPERS
// ============================================

/**
 * Render viewer avatars as stacked circles
 * @param {Array} viewers - Array of viewer objects
 * @param {number} totalCount - Total count of viewers
 * @returns {string} HTML string
 */
export function renderViewerAvatars(viewers, totalCount = 0) {
    if (!viewers || viewers.length === 0) {
        return '';
    }

    const avatarsHtml = viewers.map((viewer, index) => `
        <div class="viewer-avatar" 
             style="z-index: ${viewers.length - index};" 
             title="${viewer.userName || 'Utilisateur'}">
            <img src="${viewer.userAvatar}" alt="${viewer.userName}" onerror="this.src='https://ui-avatars.com/api/?name=U&background=6366f1&color=fff'">
        </div>
    `).join('');

    const remaining = totalCount - viewers.length;
    const remainingHtml = remaining > 0
        ? `<span class="viewers-remaining">+${remaining}</span>`
        : '';

    return `
        <div class="viewers-avatars">
            ${avatarsHtml}
            ${remainingHtml}
        </div>
    `;
}

/**
 * Render full viewers list for sidebar
 * @param {Array} viewers - Array of viewer objects
 * @param {number} totalCount - Total count
 * @returns {string} HTML string
 */
export function renderViewersList(viewers, totalCount = 0) {
    if (!viewers || viewers.length === 0) {
        return '<p class="no-viewers">Aucun visiteur pour le moment</p>';
    }

    const listHtml = viewers.slice(0, 10).map(viewer => {
        const date = viewer.viewedAt?.seconds
            ? new Date(viewer.viewedAt.seconds * 1000).toLocaleDateString('fr-FR')
            : '';

        return `
            <div class="viewer-list-item">
                <img src="${viewer.userAvatar}" alt="${viewer.userName}" class="viewer-list-avatar" onerror="this.src='https://ui-avatars.com/api/?name=U&background=6366f1&color=fff'">
                <div class="viewer-list-info">
                    <span class="viewer-list-name">${viewer.userName}</span>
                    ${date ? `<span class="viewer-list-date">${date}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');

    const remaining = totalCount - 10;
    const moreHtml = remaining > 0
        ? `<p class="viewers-more">+ ${remaining} autres</p>`
        : '';

    return `
        <div class="viewers-list">
            ${listHtml}
            ${moreHtml}
        </div>
    `;
}
