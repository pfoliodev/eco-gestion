import { auth, bugsCollection, db, storage } from './firebase.js';
import { getDocs, query, where, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-storage.js";
import { state } from './state.js';
import { notyf } from './ui.js';
import { loadUserFavorites } from './favorites.js';
import { getAllBadgeDefinitions, getUserBadges, getUserBadgeStats } from './badges.js';

let allBadgesCache = [];
let userBadgesCache = [];
let userStatsCache = null;
let currentBadgeFilter = 'all';

export async function loadAccount() {
    if (!auth.currentUser) return;

    const user = auth.currentUser;
    const userDocRef = doc(db, 'users', user.uid);

    // Load static data
    document.getElementById('user-display-email').textContent = user.email;
    document.getElementById('user-role-badge').textContent = state.isAdmin ? 'Administrateur' : 'Utilisateur';

    // Load Firestore data
    try {
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userData.firstname) document.getElementById('profile-firstname').value = userData.firstname;
            if (userData.lastname) document.getElementById('profile-lastname').value = userData.lastname;

            if (userData.firstname || userData.lastname) {
                document.getElementById('user-display-name').textContent = `${userData.firstname || ''} ${userData.lastname || ''}`.trim();
            } else {
                document.getElementById('user-display-name').textContent = 'Mon Compte';
            }

            if (userData.photoURL) {
                document.getElementById('account-avatar').src = userData.photoURL;
                document.getElementById('profile-pic-url').value = userData.photoURL;
                const navIcon = document.getElementById('profile-btn');
                if (navIcon) navIcon.innerHTML = `<img src="${userData.photoURL}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
            }
        }
    } catch (error) {
        console.error("Error loading profile:", error);
    }

    await loadUserBugs();
    await loadUserFavorites();
    await loadUserBadges();
    initProfileForm();
    initAccountSidebar();
    initBadgeFilters();
}

// Initialize account sidebar navigation
function initAccountSidebar() {
    const sidebarLinks = document.querySelectorAll('.account-sidebar-nav .sidebar-link');

    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.accountSection;

            // Update active link
            sidebarLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Update active section
            document.querySelectorAll('.account-content .account-section').forEach(s => s.classList.remove('active'));
            const targetSection = document.getElementById(`account-section-${section}`);
            if (targetSection) {
                targetSection.classList.add('active');
            }
        });
    });
}

function initProfileForm() {
    const form = document.getElementById('profile-form');
    const avatarImg = document.getElementById('account-avatar');
    const urlInput = document.getElementById('profile-pic-url');

    if (urlInput) {
        urlInput.oninput = (e) => {
            if (e.target.value.trim() !== '') {
                avatarImg.src = e.target.value;
            }
        };
    }

    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Enregistrement...';

            try {
                const user = auth.currentUser;
                const firstname = document.getElementById('profile-firstname').value;
                const lastname = document.getElementById('profile-lastname').value;
                const photoURL = urlInput.value || avatarImg.src;

                // Update Firestore
                const userDocData = {
                    firstname,
                    lastname,
                    photoURL,
                    email: user.email,
                    role: state.isAdmin ? 'admin' : 'user',
                    updatedAt: new Date()
                };

                await setDoc(doc(db, 'users', user.uid), userDocData, { merge: true });

                notyf.success('Profil mis à jour ! ✨');
                loadAccount(); // Refresh
            } catch (error) {
                console.error("Error saving profile:", error);
                notyf.error('Erreur lors de la sauvegarde : ' + (error.message || 'Inconnue'));
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Enregistrer les modifications';
            }
        };
    }
}

export async function loadUserBugs() {
    if (!auth.currentUser) return;

    const tbody = document.getElementById('user-bugs-table-body');
    if (!tbody) return;

    try {
        const q = query(
            bugsCollection,
            where('userId', '==', auth.currentUser.uid)
        );

        const snap = await getDocs(q);
        const bugs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const sortedBugs = bugs.sort((a, b) => {
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA;
        });

        renderUserBugs(sortedBugs);
    } catch (error) {
        console.error("Error loading user bugs:", error);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-secondary); padding: 2rem;">Erreur de chargement.</td></tr>';
    }
}

function renderUserBugs(bugs) {
    const tbody = document.getElementById('user-bugs-table-body');
    if (!tbody) return;

    if (bugs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 2rem; color: var(--text-secondary);">Vous n\'avez encore signalé aucun bug. Merci ! 🌟</td></tr>';
        return;
    }

    tbody.innerHTML = bugs.map(bug => {
        const date = bug.createdAt ? new Date(bug.createdAt.seconds * 1000).toLocaleDateString('fr-FR') : 'N/A';
        const isResolved = bug.status === 'resolved';
        const statusLabel = isResolved ? 'Résolu' : 'Nouveau';
        const statusClass = isResolved ? 'status-resolved' : 'status-new';

        return `
            <tr>
                <td style="font-weight: 500;">${bug.subject}</td>
                <td style="color: var(--text-secondary);">${date}</td>
                <td><span class="bug-status ${statusClass}">${statusLabel}</span></td>
            </tr>
        `;
    }).join('');
}

// ============================================
// BADGES SECTION
// ============================================

async function loadUserBadges() {
    const container = document.getElementById('badges-container');
    if (!container) return;

    try {
        if (allBadgesCache.length === 0 || !userStatsCache) {
            const [allBadges, userBadges, stats] = await Promise.all([
                getAllBadgeDefinitions(),
                getUserBadges(),
                getUserBadgeStats()
            ]);
            allBadgesCache = allBadges;
            userBadgesCache = userBadges;
            userStatsCache = stats;
        }

        renderBadges();
    } catch (error) {
        console.error("Error loading badges:", error);
        container.innerHTML = '<div class="error-msg">Erreur de chargement des badges.</div>';
    }
}

function renderBadges() {
    const container = document.getElementById('badges-container');
    const unlockedBadgeIds = new Set(userBadgesCache.map(ub => ub.badgeId));

    const filteredBadges = allBadgesCache.filter(badge => {
        const isUnlocked = unlockedBadgeIds.has(badge.id);
        const progress = calculateProgress(badge, userStatsCache);
        const isInProgress = !isUnlocked && progress.percent > 0;

        if (currentBadgeFilter === 'unlocked') return isUnlocked;
        if (currentBadgeFilter === 'locked') return !isUnlocked && !isInProgress;
        if (currentBadgeFilter === 'in-progress') return isInProgress;
        return true;
    });

    if (filteredBadges.length === 0) {
        container.innerHTML = `<div class="empty-badges">Aucun badge trouvé pour ce filtre.</div>`;
        return;
    }

    // Sort: unlocked first, then in-progress, then locked
    const sortedFiltered = [...filteredBadges].sort((a, b) => {
        const aUnlocked = unlockedBadgeIds.has(a.id);
        const bUnlocked = unlockedBadgeIds.has(b.id);
        if (aUnlocked && !bUnlocked) return -1;
        if (!aUnlocked && bUnlocked) return 1;

        const aProg = calculateProgress(a, userStatsCache).percent;
        const bProg = calculateProgress(b, userStatsCache).percent;
        return bProg - aProg;
    });

    container.innerHTML = sortedFiltered.map(badge => {
        const isUnlocked = unlockedBadgeIds.has(badge.id);
        const userBadge = userBadgesCache.find(ub => ub.badgeId === badge.id);
        const unlockedDate = userBadge?.unlockedAt
            ? new Date(userBadge.unlockedAt.seconds * 1000).toLocaleDateString('fr-FR')
            : null;

        const progress = calculateProgress(badge, userStatsCache);

        return `
            <div class="badge-card ${isUnlocked ? 'unlocked' : 'locked'}">
                <div class="badge-icon">
                    ${badge.icon && badge.icon.includes('/')
                ? `<img src="${badge.icon}" alt="${badge.name}">`
                : (badge.icon || '🏆')}
                </div>
                <div class="badge-info">
                    <h4 class="badge-name">${badge.name}</h4>
                    <p class="badge-description">${badge.description || ''}</p>
                    
                    ${isUnlocked
                ? `<span class="badge-date">Débloqué le ${unlockedDate}</span>`
                : `
                        <div class="badge-progress-container">
                            <div class="badge-progress-bar" style="width: ${progress.percent}%"></div>
                            <span class="badge-progress-text">${progress.current} / ${progress.target}</span>
                        </div>
                        <span class="badge-locked-label">🔒 ${progress.percent > 0 ? 'En cours...' : 'Verrouillé'}</span>
                        `
            }
                </div>
            </div>
        `;
    }).join('');
}

function calculateProgress(badge, stats) {
    if (!badge.requirement || !stats) return { percent: 0, current: 0, target: 0 };

    const req = badge.requirement;
    let current = 0;
    let target = req.value || 1;

    switch (req.type) {
        case 'first_quiz':
            current = stats.uniqueQuizCount >= 1 ? 1 : 0;
            break;
        case 'quiz_count':
            current = stats.uniqueQuizCount;
            break;
        case 'perfect_score':
            current = stats.perfectScoreCount >= 1 ? 1 : 0;
            break;
        case 'perfect_count':
            current = stats.perfectScoreCount;
            break;
        case 'streak':
            current = stats.quizStreak;
            break;
        case 'perfect_unique_count':
            current = stats.uniquePerfectCourseCount;
            break;
        case 'perfect_streak':
            current = stats.perfectStreak;
            break;
        case 'course_read':
            current = (stats.readCourses && stats.readCourses.length > 0) ? 1 : 0;
            break;
        default:
            current = 0;
    }

    const percent = Math.min(100, Math.floor((current / target) * 100));
    return { percent, current, target };
}

function initBadgeFilters() {
    const filters = document.querySelectorAll('[data-badge-filter]');
    filters.forEach(btn => {
        btn.onclick = () => {
            filters.forEach(f => f.classList.remove('active'));
            btn.classList.add('active');
            currentBadgeFilter = btn.dataset.badgeFilter;
            renderBadges();
        };
    });
}
