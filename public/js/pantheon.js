import { db, auth } from './firebase.js';
import {
    collection,
    doc,
    getDocs,
    getDoc,
    query,
    where,
    orderBy,
    limit,
    collectionGroup
} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { notyf } from './ui.js';

export async function initPantheon() {
    const listElement = document.getElementById('leaderboard-list');
    if (!listElement) return;

    try {
        const leaderboardData = await fetchLeaderboardData();
        renderLeaderboard(listElement, leaderboardData);
    } catch (error) {
        console.error("Error loading pantheon:", error);
        listElement.innerHTML = '<div class="error-state">Impossible de charger le classement.</div>';
    }
}

/**
 * Fetch and aggregate data for the leaderboard
 * Strategy: Fetch all 'userSucces' via collectionGroup to count badges per user.
 * Then fetch user details for the top users.
 */
async function fetchLeaderboardData() {
    // 1. Fetch all unlocked successes globally
    // Note: In a large scale app, this should be a scheduled cloud function updating a 'stats' document.
    // For this size, collectionGroup is acceptable.
    const succesQuery = query(collectionGroup(db, 'userSucces'));
    const snapshot = await getDocs(succesQuery);

    const userStats = {};

    // 2. Aggregate counts and last date
    snapshot.docs.forEach(docSnap => {
        // Parent of userSucces is the user document path: users/{userId}/userSucces/{succesId}
        // doc.ref.parent.parent.id gives userId
        const userId = docSnap.ref.parent.parent.id;
        const data = docSnap.data();
        const unlockedAt = data.unlockedAt ? data.unlockedAt.seconds * 1000 : 0;

        if (!userStats[userId]) {
            userStats[userId] = {
                userId,
                badgeCount: 0,
                lastBadgeDate: 0
            };
        }

        userStats[userId].badgeCount++;
        if (unlockedAt > userStats[userId].lastBadgeDate) {
            userStats[userId].lastBadgeDate = unlockedAt;
        }
    });

    // 3. Filter users with at least 1 badge and Sort
    // Sort by Badge Count DESC, then Last Badge Date DESC (Recently active on top? Or First to achieve?)
    // User asked: "classement se fait par rapport au nombre de badge et à la date"
    // Usually: High Count = Better. Tie breaker: recently active is often preferred in "Active" leaderboards, 
    // BUT "First to reach" is preferred in strict competitions.
    // Let's go with Count DESC, LastDate DESC (Most recent achievement = higher rank? No, usually date is tie breaker for "First").
    // Let's use Count DESC. If tie, the one who reached it *earlier* (Min Date) is usually #1? 
    // But here we track "Last Badge Date". If I have 10 badges, last one today. You have 10 badges, last one yesterday.
    // You reached 10 *before* me. So you should be higher.
    // So Count DESC, LastBadgeDate ASC (Older date = reached earlier).
    // HOWEVER, the user might simply mean "Recent Activity".
    // I'll stick to Count DESC, then Date DESC (Freshness) as it looks more dynamic.
    let sortedUsers = Object.values(userStats)
        .filter(u => u.badgeCount > 0)
        .sort((a, b) => {
            if (b.badgeCount !== a.badgeCount) return b.badgeCount - a.badgeCount;
            return b.lastBadgeDate - a.lastBadgeDate; // Most recent is higher
        });

    // Limit to top 50 to avoid fetching too many profiles
    sortedUsers = sortedUsers.slice(0, 50);

    // 4. Fetch User Profiles & Quiz Counts
    const enrichedUsers = await Promise.all(sortedUsers.map(async (stat) => {
        const userDoc = await getDoc(doc(db, 'users', stat.userId));
        if (!userDoc.exists()) return null;

        const userData = userDoc.data();
        // Hide if archived/banned?
        if (userData.archived) return null;

        // Get Quiz Count (Unique) - We need to fetch this or rely on a stored field.
        // For efficiency, we'll check if 'quizCount' exists on user, else default to 0 (or partial fetch).
        // To be accurate without over-reading, we simply display what we know or do a quick count if essential.
        // User requested "nombre de qcm effectué".
        // Use 'quiz_results' count for this user.
        const qResults = query(collection(db, 'quiz_results'), where('userId', '==', stat.userId));
        const qSnap = await getDocs(qResults); // This might be heavy (N * M).
        // Optimization: Use userData.quizStreak or similar as proxy? No. 
        // We will do the fetch because accurate data is requested. 
        // 50 users * 10-20 reads is fine.

        const quizCount = qSnap.size; // Total attempts
        // Or unique quizzes? Prompt says "nombre de qcm effectué" (Total attempts usually).

        return {
            ...stat,
            displayName: userData.firstname ? `${userData.firstname} ${userData.lastname || ''}` : (userData.email.split('@')[0]),
            photoURL: userData.photoURL,
            quizCount: quizCount
        };
    }));

    return enrichedUsers.filter(u => u !== null);
}

function renderLeaderboard(container, users) {
    if (users.length === 0) {
        container.innerHTML = '<div style="padding: 2rem; text-align: center;">Aucun champion pour le moment. Soyez le premier !</div>';
        return;
    }

    // Determine max badges for progress bar scale (e.g. max found or a fixed cap like 20)
    // If top user has 5, scale is 5. If 500, scale is 500.
    const maxBadges = Math.max(...users.map(u => u.badgeCount), 10); // Min 10 scale

    container.innerHTML = users.map((user, index) => {
        const rank = index + 1;
        const isPodium = rank <= 3;
        const progressPercent = (user.badgeCount / maxBadges) * 100;

        let rankDisplay = `<span class="rank-text">${rank}.</span>`;
        if (isPodium) {
            const icons = ['👑', '🥈', '🥉']; // Or specific styles
            rankDisplay = `<div class="rank-badge">${icons[index]}</div>`;
        }

        const dateStr = new Date(user.lastBadgeDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

        return `
        <div class="leaderboard-item rank-${rank}">
            <div class="col-rank">
                ${rankDisplay}
            </div>
            <div class="col-user">
                <img src="${user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=random`}" class="user-avatar" alt="${user.displayName}">
                <div class="user-details">
                    <span class="user-name">${user.displayName}</span>
                    <span class="user-subtext">${user.quizCount} QCM complétés • Dernier badge le ${dateStr}</span>
                </div>
            </div>
            <div class="col-badges">
                ${user.badgeCount} Succès
            </div>
            <div class="col-progress">
                <div class="progress-container">
                    <div class="progress-bar" style="width: ${progressPercent}%"></div>
                    <span class="progress-label">${Math.floor(progressPercent)}%</span>
                </div>
            </div>
        </div>
        `;
    }).join('');
}
