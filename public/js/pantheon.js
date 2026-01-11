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
import { GYM_BADGES } from './gym-badges.js';
import { getAllSuccesDefinitions } from './succes.js';

export async function initPantheon() {
    const listElement = document.getElementById('leaderboard-list');
    if (!listElement) return;

    if (!auth.currentUser) {
        listElement.innerHTML = `
            <div class="lock-state" style="text-align: center; padding: 3rem; background: var(--surface-color); border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🔒</div>
                <h3 style="margin-bottom: 0.5rem; color: var(--text-main);">Classement verrouillé</h3>
                <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Connectez-vous pour voir le classement et vos badges.</p>
                <button onclick="showPage('login')" class="btn btn-primary">Se connecter</button>
            </div>
        `;
        return;
    }

    try {
        const leaderboardData = await fetchLeaderboardData();
        renderLeaderboard(listElement, leaderboardData);
    } catch (error) {
        console.error("Error loading pantheon:", error);
        listElement.innerHTML = '<div class="error-state">Impossible de charger le classement (Erreur de permission ou réseau).</div>';
    }
}

/**
 * Fetch and aggregate data for the leaderboard
 * Strategy: Fetch all 'userSucces' via collectionGroup to count badges per user.
 * Then fetch user details for the top users.
 */
async function fetchLeaderboardData() {
    // 1. Fetch all unlocked gym badges globally
    const badgesQuery = query(collectionGroup(db, 'gymBadges'));
    const snapshot = await getDocs(badgesQuery);

    // 2. Prep definitions map
    const badgeMap = {};
    GYM_BADGES.forEach(b => badgeMap[b.id] = b);

    const userStats = {};

    // 3. Aggregate counts and data
    snapshot.docs.forEach(docSnap => {
        const userId = docSnap.ref.parent.parent.id;
        const data = docSnap.data();
        const unlockedAt = data.unlockedAt ? data.unlockedAt.seconds * 1000 : 0;

        if (!userStats[userId]) {
            userStats[userId] = {
                userId,
                badgeCount: 0,
                lastBadgeDate: 0,
                unlockedBadges: [] // Store IDs
            };
        }

        userStats[userId].badgeCount++;
        // data.id or docSnap.id is the badgeId.
        userStats[userId].unlockedBadges.push({
            id: docSnap.id,
            date: unlockedAt
        });

        if (unlockedAt > userStats[userId].lastBadgeDate) {
            userStats[userId].lastBadgeDate = unlockedAt;
        }
    });

    // Attach icons to user stats
    Object.values(userStats).forEach(stat => {
        stat.badges = stat.unlockedBadges
            .map(item => {
                const def = badgeMap[item.id];
                return def ? { ...def, unlockedAt: item.date } : null;
            })
            .filter(b => b) // Filter out unknown IDs
            .slice(0, 10);
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

    // 4. Fetch User Profiles & Quiz Counts & SUCCES
    const allSuccesDefs = await getAllSuccesDefinitions();
    const succesMap = {};
    allSuccesDefs.forEach(s => succesMap[s.id] = s);

    const enrichedUsers = await Promise.all(sortedUsers.map(async (stat) => {
        const userDoc = await getDoc(doc(db, 'users', stat.userId));
        if (!userDoc.exists()) return null;

        const userData = userDoc.data();
        if (userData.archived) return null;

        // Quiz Count
        const qResults = query(collection(db, 'quiz_results'), where('userId', '==', stat.userId));
        const qSnap = await getDocs(qResults);
        const quizCount = qSnap.size;

        // Active Pet
        let activePet = null;
        try {
            const petQuery = query(collection(db, 'pets'), where('userId', '==', stat.userId), where('isActive', '==', true), limit(1));
            const petSnap = await getDocs(petQuery);
            if (!petSnap.empty) {
                activePet = petSnap.docs[0].data();
            }
        } catch (err) { console.error(err); }

        // Successes (Achievements)
        let userSucces = [];
        try {
            const succesQuery = collection(db, 'users', stat.userId, 'userSucces');
            const succesSnap = await getDocs(succesQuery);
            userSucces = succesSnap.docs.map(d => {
                const sId = d.data().succesId || d.id;
                const def = succesMap[sId];
                return def ? { ...def, unlockedAt: d.data().unlockedAt } : null;
            }).filter(s => s);
        } catch (err) { console.error("Error fetching user succes", err); }

        return {
            ...stat,
            displayName: userData.firstname ? `${userData.firstname} ${userData.lastname || ''}` : (userData.email.split('@')[0]),
            photoURL: userData.photoURL,
            quizCount: quizCount,
            badges: stat.badges,
            activePet: activePet,
            successes: userSucces
        };
    }));

    return enrichedUsers.filter(u => u !== null);
}

// Global store for modal access
let currentLeaderboardData = [];

function renderLeaderboard(container, users) {
    currentLeaderboardData = users; // Store for global access

    if (users.length === 0) {
        container.innerHTML = '<div style="padding: 2rem; text-align: center;">Aucun champion pour le moment. Soyez le premier !</div>';
        return;
    }

    container.innerHTML = users.map((user, index) => {
        const rank = index + 1;
        const isPodium = rank <= 3;

        // Gym Badges
        const badgeIconsHtml = user.badges.map(b => {
            const unlockDate = b.unlockedAt ? new Date(b.unlockedAt).toLocaleDateString('fr-FR') : '';
            return `
            <div class="pantheon-badge-icon" data-tooltip="${b.name} (${unlockDate})">
                ${b.image ? `<img src="${b.image}">` : '🏅'}
            </div>
        `}).join('');

        // Achievements (Succès)
        const MAX_SUCCES_DISPLAY = 5;
        const visibleSucces = user.successes.slice(0, MAX_SUCCES_DISPLAY);
        const hiddenSucces = user.successes.slice(MAX_SUCCES_DISPLAY);

        let succesHtml = visibleSucces.map(s => `
            <span class="user-succes-icon" data-tooltip="${s.name}" style="font-size: 1.2rem; cursor: help; margin-right: 4px;">
                ${s.icon && s.icon.includes('/') ? `<img src="${s.icon}" style="width: 20px; height: 20px;">` : (s.icon || '🏆')}
            </span>
        `).join('');

        if (hiddenSucces.length > 0) {
            succesHtml += `
            <span class="user-succes-more clickable" onclick="window.showAllSucces('${user.userId}')" data-tooltip="Voir les ${hiddenSucces.length} autres succès" style="font-size: 0.9rem; background: var(--surface-color-hover); padding: 2px 8px; border-radius: 12px; cursor: pointer; color: var(--text-secondary); border: 1px solid var(--border-color); transition: all 0.2s;">
                +${hiddenSucces.length}
            </span>`;
        }

        const succesContainer = user.successes.length > 0 ? `
            <div class="user-succes-row" style="margin-top: 6px; display: flex; align-items: center; flex-wrap: wrap;">
                ${succesHtml}
            </div>
        ` : '';


        let rankDisplay = `<span class="rank-text">${rank}.</span>`;
        if (isPodium) {
            const icons = ['👑', '🥈', '🥉'];
            rankDisplay = `<div class="rank-badge">${icons[index]}</div>`;
        }

        return `
        <div class="leaderboard-item rank-${rank}">
            <div class="col-rank">
                ${rankDisplay}
            </div>
            <div class="col-user">
                <div class="user-avatar-container">
                    <img src="${user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=random`}" class="user-avatar" alt="${user.displayName}">
                    ${user.activePet && user.activePet.image ? `<span class="user-pet-wrapper" data-tooltip="🐾 ${user.activePet.name} (Niv. ${user.activePet.level || 1})"><img src="${user.activePet.image}" class="user-pet-icon"></span>` : ''}
                </div>
                <div class="user-details">
                    <span class="user-name">${user.displayName}</span>
                    <span class="user-subtext">${user.quizCount} QCM complétés</span>
                </div>
            </div>
            <div class="col-count">
                <span class="badge-count-pill">${user.badgeCount}</span>
            </div>
            <div class="col-badges-list">
                <div class="badges-grid">
                    ${badgeIconsHtml}
                    ${user.badgeCount > 10 ? `<span class="more-badges">+${user.badgeCount - 10}</span>` : ''}
                </div>
            </div>
            <div class="col-succes-list">
                 ${succesContainer}
            </div>
        </div>
        `;
    }).join('');
}

// Global modal function
window.showAllSucces = function (userId) {
    const user = currentLeaderboardData.find(u => u.userId === userId);
    if (!user) return;

    // Create Modal HTML
    const modalHtml = `
    <div class="pantheon-modal-overlay active" onclick="this.classList.remove('active'); setTimeout(() => this.remove(), 300);">
        <div class="pantheon-modal" onclick="event.stopPropagation()">
            <button class="pantheon-modal-close" onclick="this.closest('.pantheon-modal-overlay').classList.remove('active'); setTimeout(() => this.closest('.pantheon-modal-overlay').remove(), 300);">×</button>
            <div class="pantheon-modal-header">
                <h3>Succès de ${user.displayName}</h3>
                <span class="badge-count-pill">${user.successes.length} Succès</span>
            </div>
            <div class="pantheon-modal-grid">
                ${user.successes.map(s => {
        const date = s.unlockedAt ? new Date(s.unlockedAt.seconds * 1000).toLocaleDateString('fr-FR') : '';
        return `
                    <div class="succes-grid-item" title="${s.description || ''}">
                        <div class="succes-grid-icon">
                             ${s.icon && s.icon.includes('/') ? `<img src="${s.icon}">` : (s.icon || '🏆')}
                        </div>
                        <div class="succes-grid-info">
                            <div class="succes-name">${s.name}</div>
                            <div class="succes-date">${date}</div>
                        </div>
                    </div>
                    `;
    }).join('')}
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
};
