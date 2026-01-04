import { auth, bugsCollection, db, storage } from './firebase.js';
import { getDocs, query, where, doc, getDoc, setDoc, collection, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-storage.js";
import { state } from './state.js';
import { notyf } from './ui.js';
import { loadUserFavorites } from './favorites.js';
import { getUserBadges, getAllBadgeDefinitions, getUserBadgeStats, unlockBadge, removeUserBadge, showBadgeUnlockedPopup, getBadgeById } from './badges.js';
import { getUserInventory, equipItem, unequipItem, useConsumable } from './shop.js';
import { getUserBalance, formatCoins, getTransactionHistory } from './coins.js';
import { STARTER_PETS } from './config/pets.js';

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
    await loadUserStats();
    await loadUserStats();
    await loadInventory();
    await loadUserPet();
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

                // Dragon Egg Discovery! 🐉
                if (section === 'badges') {
                    showDragonInConsole();
                }

                // Reload stats when entering stats section
                if (section === 'stats') {
                    loadUserStats();
                }
            }
        });
    });
}

function showDragonInConsole() {
    const dragon = `
   ___====-_  _-====___
          _--^^^#####//      \\\\\\\\#####^^^--_
       _-^##########// (    ) \\\\\\\\##########^-_
      -############//  |\\\\^^/|  \\\\\\\\############-
    _/############//   (@::@)   \\\\\\\\############\\\\_
   /#############((     \\\\\\\\//     ))#############\\\\
   -###############\\\\\\\\    (oo)    //###############-
   -#################\\\\\\\\  / VV \\\\  //#################-
   -###################\\\\\\\\/      \\\\//###################-
   _#/|##########/\\\\\\\\######(   /\\\\\\\\   )######/\\\\\\\\##########|\\\\\\#_
   |/ |# /\\# /\\# /\\/  \\# /\\##\\  |  |  /# /\\#/  \\/\\# /\\# /\\# | \\|
   \`  |/  V  V  \`   V  \\# \\ |  | / #/  V   '  V  V  \\|  '
      \`   \`  \`      \`   /  /    \\  \\   '      '  '   '
                       /  /      \\  \\
                      /_ /        \\ _\\`;

    console.log("%c🐲 VOUS AVEZ RÉVEILLÉ LE DRAGON ! 🐲", "color: #4f46e5; font-size: 20px; font-weight: bold;");
    console.log("%c" + dragon, "color: #4f46e5; font-family: monospace; font-weight: bold;");
    console.log("%cUn secret est tapi ici... Appuie sur F12 pour sceller le pacte.", "color: #64748b; font-style: italic;");
}

// F12 Listener for the Dragon Badge
document.addEventListener('keydown', async (e) => {
    // We check if we are on the account page AND in the badges section
    const accountPage = document.getElementById('page-mon-compte');
    const badgesSection = document.getElementById('account-section-badges');

    const isVisible = accountPage && accountPage.classList.contains('active') &&
        badgesSection && badgesSection.classList.contains('active');

    if (e.key === 'F12' && isVisible) {
        if (!auth.currentUser) return;

        try {
            const res = await unlockBadge('code_guardian');
            if (res && !res.alreadyUnlocked) {
                console.log("%c✨ LE PACTE EST SCELLÉ ! ✨", "color: #10b981; font-weight: bold;");

                // Show standard celebratory popup
                const badge = await getBadgeById('code_guardian');
                if (badge) {
                    showBadgeUnlockedPopup(badge);
                }

                notyf.success("Badge 'Gardien du Code' débloqué ! 🐉");
                // Refresh badges display
                allBadgesCache = []; // Force refresh
                await loadUserBadges();
            }
        } catch (error) {
            console.error("Erreur lors du déblocage f12:", error);
        }
    }
});

// Refresh badges when navigating to account page
document.addEventListener('pageChange', (e) => {
    if (e.detail.pageId === 'mon-compte' || e.detail.pageId === 'page-mon-compte') {
        loadUserBadges(true); // Force refresh
    }
});

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
// USER STATISTICS SECTION
// ============================================

async function loadUserStats() {
    if (!auth.currentUser) return;

    const userId = auth.currentUser.uid;

    try {
        // Fetch all data in parallel
        const [coursesViewed, quizHistory, favorites, badges] = await Promise.all([
            getCoursesViewedCount(userId),
            getQuizHistory(userId),
            getFavoritesCount(userId),
            getUserBadges()
        ]);

        // Calculate stats from quiz history
        const quizCount = quizHistory.length;
        // Calculate average score as percentage (score / totalQuestions * 100)
        const avgScore = quizCount > 0
            ? Math.round(quizHistory.reduce((sum, q) => {
                const percent = q.totalQuestions > 0 ? (q.score / q.totalQuestions) * 100 : 0;
                return sum + percent;
            }, 0) / quizCount)
            : 0;
        const bestTime = quizHistory.length > 0
            ? Math.min(...quizHistory.filter(q => q.duration).map(q => q.duration))
            : null;

        // Debug: Log calculated stats
        console.log('User stats calculated:', { coursesViewed, quizCount, avgScore, badgesCount: badges.length, favoritesCount: favorites, bestTime });

        // Render stats cards
        renderUserStats({
            coursesViewed,
            quizCount,
            avgScore,
            badgesCount: badges.length,
            favoritesCount: favorites,
            bestTime
        });

        // Render quiz history table
        renderQuizHistory(quizHistory.slice(0, 5)); // Last 5 quizzes

    } catch (error) {
        console.error("Error loading user stats:", error);
    }
}

async function getCoursesViewedCount(userId) {
    try {
        const viewsRef = collection(db, 'courseViews');
        const q = query(viewsRef, where('userId', '==', userId));
        const snap = await getDocs(q);
        return snap.size;
    } catch {
        return 0;
    }
}

async function getQuizHistory(userId) {
    try {
        const historyRef = collection(db, 'quiz_results');
        const q = query(
            historyRef,
            where('userId', '==', userId)
        );
        const snap = await getDocs(q);
        const quizzes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Sort by date (newest first) in memory
        return quizzes.sort((a, b) => {
            const dateA = a.completedAt?.seconds || 0;
            const dateB = b.completedAt?.seconds || 0;
            return dateB - dateA;
        });
    } catch {
        return [];
    }
}

async function getFavoritesCount(userId) {
    try {
        // Favorites are stored as an array in the user document
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        const favorites = userDoc.data()?.favorites || [];
        return favorites.length;
    } catch {
        return 0;
    }
}

function renderUserStats(stats) {
    // Update each stat card
    const setStatValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    setStatValue('user-stat-courses-viewed', stats.coursesViewed);
    setStatValue('user-stat-quizzes-completed', stats.quizCount);
    // Ensure avgScore is a valid number
    const avgScoreDisplay = (typeof stats.avgScore === 'number' && !isNaN(stats.avgScore))
        ? stats.avgScore + '%'
        : '-';
    setStatValue('user-stat-avg-score', avgScoreDisplay);
    setStatValue('user-stat-badges-count', stats.badgesCount);
    setStatValue('user-stat-favorites-count', stats.favoritesCount);
    setStatValue('user-stat-best-time', stats.bestTime ? formatDuration(stats.bestTime) : '-');
}

function formatDuration(seconds) {
    if (!seconds || seconds === Infinity) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function renderQuizHistory(quizzes) {
    const tbody = document.getElementById('user-quiz-history-body');
    if (!tbody) return;

    if (quizzes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-secondary);">Aucun quiz complété pour le moment.</td></tr>';
        return;
    }

    tbody.innerHTML = quizzes.map(quiz => {
        const date = quiz.completedAt
            ? new Date(quiz.completedAt.seconds * 1000).toLocaleDateString('fr-FR')
            : 'N/A';
        // Calculate score as percentage
        const scorePercent = quiz.totalQuestions > 0
            ? Math.round((quiz.score / quiz.totalQuestions) * 100)
            : 0;
        const scoreClass = scorePercent >= 80 ? 'score-high' : (scorePercent >= 50 ? 'score-medium' : 'score-low');
        const duration = formatDuration(quiz.duration);

        // Find course title from state
        const course = state.courses.find(c => c.id === quiz.courseId);
        const courseTitle = course ? course.title : 'Cours inconnu';

        return `
            <tr>
                <td style="font-weight: 500;">${courseTitle}</td>
                <td><span class="quiz-score ${scoreClass}">${scorePercent}%</span></td>
                <td style="color: var(--text-secondary);">${duration}</td>
                <td style="color: var(--text-secondary);">${date}</td>
            </tr>
        `;
    }).join('');
}

// ============================================
// BADGES SECTION
// ============================================

async function loadUserBadges(forceRefresh = false) {
    const container = document.getElementById('badges-container');
    if (!container) return;

    try {
        // Load badge definitions only once (cache them)
        if (!allBadgesCache || allBadgesCache.length === 0) {
            allBadgesCache = await getAllBadgeDefinitions();
        }

        // Always fetch fresh user data if forceRefresh is true or if not yet loaded
        if (forceRefresh || !userStatsCache || userBadgesCache.length === 0) {
            const [userBadges, stats] = await Promise.all([
                getUserBadges(),
                getUserBadgeStats()
            ]);
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

        const isSecret = badge.secret && !isUnlocked;
        const displayName = isSecret ? '???' : badge.name;
        const displayDescription = isSecret ? (badge.hint || 'Un badge mystérieux... Continuez à explorer !') : (badge.description || '');

        return `
            <div class="badge-card ${isUnlocked ? 'unlocked' : 'locked'} ${isSecret ? 'secret' : ''}">
                <div class="badge-icon">
                    ${isSecret ? '❓' : (badge.icon && badge.icon.includes('/')
                ? `<img src="${badge.icon}" alt="${badge.name}">`
                : (badge.icon || '🏆'))}
                </div>
                <div class="badge-info">
                    <h4 class="badge-name">${displayName}</h4>
                    <p class="badge-description">${displayDescription}</p>
                    
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
        case 'console_found':
            current = 0; // It's a secret, so it's always "0" until it's "1"
            break;
        case 'course_read':
            current = (stats.readCourses && stats.readCourses.length > 0) ? 1 : 0;
            break;
        case 'favorite_count':
            current = stats.favoritesCount || 0;
            break;
        case 'loyalty':
            current = stats.accountAgeDays || 0;
            target = req.days || 30;
            break;
        case 'sunday_warrior':
            // Today's contribution only if it's Sunday
            const isSunday = new Date().getDay() === 0;
            current = isSunday ? 1 : 0; // Simplified for display
            break;
        case 'speed_perfect':
        case 'comeback_perfect':
        case 'first_bug':
            current = 0; // Non-trackable progress
            target = 1;
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

// ============================================
// PET SECTION
// ============================================

export async function loadUserPet() {
    if (!auth.currentUser) return;

    const container = document.getElementById('pet-dashboard-content');
    if (!container) return;

    try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();

        if (userData && userData.pet) {
            await renderPetDashboard(userData.pet);
        } else {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem;">
                    <p style="margin-bottom: 1rem; color: var(--text-secondary);">Vous n'avez pas encore de compagnon.</p>
                    <button class="btn-primary" onclick="window.location.reload()">Rencontrer le Professeur</button>
                </div>
            `;
        }
    } catch (error) {
        console.error("Error loading pet:", error);
        container.innerHTML = '<div class="error-msg">Erreur de chargement du compagnon.</div>';
    }
}

async function renderPetDashboard(petData) {
    const container = document.getElementById('pet-dashboard-content');
    if (!container) return;

    // 1. Get all owned companions
    let ownedCompanions = [];
    try {
        const inventory = await getUserInventory('companion');
        ownedCompanions = inventory;
    } catch (err) {
        console.error("Error fetching companions:", err);
    }

    // Hydrate current pet data (fix for existing users)
    let currentPet = { ...petData };
    if (!currentPet.image || !currentPet.type) {
        const configPet = STARTER_PETS.find(p => p.id === currentPet.id);
        if (configPet) {
            currentPet.image = currentPet.image || configPet.image;
            currentPet.type = currentPet.type || configPet.type;
            currentPet.color = currentPet.color || configPet.color;
        }
    }

    // Calculate level progress
    const xpNeeded = currentPet.level * 100;
    const progressPercent = Math.min(100, Math.floor((currentPet.xp / xpNeeded) * 100));

    // Lookup personalized flavor text
    let flavorText = `${currentPet.nickname || currentPet.name} vous regarde avec attention. Il semble prêt à apprendre !`;
    const configPetForFlavor = STARTER_PETS.find(p => p.id === currentPet.id);
    if (configPetForFlavor && configPetForFlavor.flavorText) {
        flavorText = configPetForFlavor.flavorText;
    }

    // Render Hero Section (Active Pet)
    let html = `
        <div class="pet-profile-card pet-theme-${currentPet.id}" style="border-top: 3px solid ${currentPet.color || 'var(--primary-color)'}">
            <div class="pet-header">
                <div class="pet-visual-container">
                    <div class="pet-avatar-large">
                        <img src="${currentPet.image}" alt="${currentPet.name}" class="pet-image-anim">
                    </div>
                    <!-- Effect Particles -->
                    <div class="effect-particle p1"></div>
                    <div class="effect-particle p2"></div>
                    <div class="effect-particle p3"></div>
                    
                    <div class="pet-shadow"></div>
                </div>
                <div class="pet-identity">
                    <h3 class="pet-name-large">${currentPet.name}</h3>
                    <div class="pet-badges">
                        <span class="pet-type-badge">${currentPet.type || 'Compagnon'}</span>
                        <span class="pet-level-badge">Niveau ${currentPet.level}</span>
                    </div>
                </div>
            </div>

            <div class="pet-stats-container">
                <div class="pet-progress-section">
                    <div class="progress-label">
                        <span>Expérience</span>
                        <span>${currentPet.xp} / ${xpNeeded} XP</span>
                    </div>
                    <div class="pet-xp-bar">
                        <div class="pet-xp-fill" style="width: ${progressPercent}%"></div>
                    </div>
                </div>

                <div class="pet-attributes-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <h4 style="margin:0; color:var(--text-secondary);">Statistiques</h4>
                    <button class="pet-info-btn" onclick="document.getElementById('stats-info-modal').style.display='flex'" title="Plus d'infos">i</button>
                </div>

                <div class="pet-attributes-grid">
                    <div class="pet-stat-item" title="Augmente l'XP gagnée dans les quiz">
                        <div class="stat-icon">🧠</div>
                        <div class="stat-name">Intelligence</div>
                        <div class="stat-value">${currentPet.stats?.intelligence || 0}</div>
                        <div class="stat-effect">+${(currentPet.stats?.intelligence || 0)}% XP Quiz</div>
                    </div>
                    <div class="pet-stat-item" title="Augmente la chance de trouver des pièces">
                        <div class="stat-icon">🎨</div>
                        <div class="stat-name">Créativité</div>
                        <div class="stat-value">${currentPet.stats?.creativity || 0}</div>
                        <div class="stat-effect">+${(currentPet.stats?.creativity || 0)}% Chance Coins</div>
                    </div>
                    <div class="pet-stat-item" title="Augmente le bonus de connexion quotidienne">
                        <div class="stat-icon">🤝</div>
                        <div class="stat-name">Social</div>
                        <div class="stat-value">${currentPet.stats?.social || 0}</div>
                        <div class="stat-effect">+${(currentPet.stats?.social || 0) * 2}% Bonus Jour</div>
                    </div>
                </div>
            </div>
            
            <div class="pet-flavor-text">
                <p>"${flavorText}"</p>
            </div>
        </div>

        <!-- STATS INFO MODAL -->
        <div id="stats-info-modal" class="modal-overlay" style="display:none;" onclick="if(event.target===this)this.style.display='none'">
            <div class="modal-content" style="max-width: 500px;">
                <h3 style="margin-top:0;">Comprendre les Stats de votre Compagnon</h3>
                <div class="stats-explanation-list">
                    <div class="stat-explain-item" style="margin-bottom: 1rem; display: flex; gap: 0.8rem; align-items: flex-start;">
                        <span style="font-size: 1.5rem;">🧠</span>
                        <div>
                            <strong>Intelligence</strong>
                            <p style="margin:0.2rem 0 0; font-size: 0.9rem; color: var(--text-secondary);">Augmente l'expérience (XP) gagnée par votre compagnon à chaque bon quiz. Plus il est intelligent, plus il évolue vite !</p>
                        </div>
                    </div>
                    <div class="stat-explain-item" style="margin-bottom: 1rem; display: flex; gap: 0.8rem; align-items: flex-start;">
                        <span style="font-size: 1.5rem;">🎨</span>
                        <div>
                            <strong>Créativité</strong>
                            <p style="margin:0.2rem 0 0; font-size: 0.9rem; color: var(--text-secondary);">Augmente la chance de trouver des pièces (Coins) bonus aléatoires en naviguant sur le site.</p>
                        </div>
                    </div>
                    <div class="stat-explain-item" style="margin-bottom: 1rem; display: flex; gap: 0.8rem; align-items: flex-start;">
                        <span style="font-size: 1.5rem;">🤝</span>
                        <div>
                            <strong>Social</strong>
                            <p style="margin:0.2rem 0 0; font-size: 0.9rem; color: var(--text-secondary);">Multiplie votre bonus de connexion quotidien. Un compagnon sociable vous rapporte plus de pièces chaque jour !</p>
                        </div>
                    </div>
                </div>
                <button class="btn-primary" onclick="document.getElementById('stats-info-modal').style.display='none'" style="width:100%; margin-top:1rem;">Compris !</button>
            </div>
        </div>
    `;

    // 3. Render Other Companions Grid
    if (ownedCompanions.length > 1) { // More than just the active one (which is simulated in inventory)
        html += `
            <div class="other-pets-section">
                <h3>Mes Compagnons</h3>
                <div class="pets-grid">
                    ${ownedCompanions.map(p => {
            const isEquipped = p.id === `pet_${currentPet.id}` || (p.itemName === currentPet.name && !p.id.startsWith('pet_'));
            // Simplified check: usually ID is pet_X. Active pet might not match exactly if starter.
            // Robust check: 
            const isCurrent = p.itemId === `pet_${currentPet.id}` || p.id === `pet_${currentPet.id}`;

            if (isCurrent) return ''; // Skip active pet

            // We need the image. Inventory item might not have it if it's minimal.
            // We rely on shop item data or a known path. 
            // Hack: construct path from ID or use icon if available.
            // Ideally inventory items should have 'image' or 'icon' preserved.
            // shop.js/getUserInventory adds 'icon' from shop item if available? No, it fetched data.
            // Let's assume shop.js seed puts image in shop item, and purchase puts it in inventory?
            // purchaseItem puts 'itemName', 'category'. It doesn't put image.
            // BUT getUserInventory returns data from doc.
            // Let's try to infer image from ID if missing.

            let petImage = p.image;
            if (!petImage && p.id.startsWith('pet_')) {
                petImage = `/images/pets/${p.id.replace('pet_', '')}.png`;
            }

            return `
                        <div class="pet-card-small" onclick="switchPet('${p.id}')">
                            <div class="pet-card-icon">
                                ${petImage ? `<img src="${petImage}" alt="${p.itemName}">` : (p.icon || '🐾')}
                            </div>
                            <div class="pet-card-info">
                                <h4>${p.itemName || p.name}</h4>
                            </div>
                            <button class="btn-switch">Choisir</button>
                        </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;
    }

    container.innerHTML = html;

    // Attach switch handler to window for onclick access (simplest path)
    window.switchPet = async (petId) => {
        try {
            const res = await equipItem(petId);
            if (res.success) {
                notyf.success("Compagnon changé !");
                // Reload dashboard
                loadUserPet();
            } else {
                notyf.error(res.error || "Erreur lors du changement.");
            }
        } catch (e) {
            console.error(e);
            notyf.error("Erreur technique.");
        }
    };
}

// ============================================
// INVENTORY SECTION
// ============================================

let currentInventoryFilter = 'all';

async function loadInventory() {
    if (!auth.currentUser) return;

    try {
        // Load balance
        const balance = await getUserBalance();
        const balanceEl = document.getElementById('account-balance-value');
        if (balanceEl) {
            balanceEl.textContent = formatCoins(balance);
        }

        // Load inventory items
        const inventory = await getUserInventory();

        // [HOTFIX] Fetch shop items to ensure images are up to date even if not saved in inventory
        // (Fixes display for items bought before the image patch)
        try {
            const shopItemsRef = collection(db, 'shopItems');
            const shopSnapshot = await getDocs(shopItemsRef);
            const shopImageMap = new Map();

            shopSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.image) {
                    shopImageMap.set(doc.id, data.image);
                }
            });

            // Enrich inventory items
            inventory.forEach(item => {
                if (!item.image && shopImageMap.has(item.itemId)) {
                    item.image = shopImageMap.get(item.itemId);
                }
            });
        } catch (e) {
            console.warn("Could not fetch shop images for enrichment:", e);
        }

        renderInventoryItems(inventory);

        // Initialize inventory filters
        initInventoryFilters(inventory);

        // Initialize transactions button
        initTransactionsButton();

    } catch (error) {
        console.error('Error loading inventory:', error);
    }
}

function renderInventoryItems(items) {
    const grid = document.getElementById('inventory-items-grid');
    if (!grid) return;

    // Filter items based on current filter
    const filteredItems = currentInventoryFilter === 'all'
        ? items
        : items.filter(item => item.category === currentInventoryFilter);

    if (filteredItems.length === 0) {
        grid.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-secondary); grid-column: 1 / -1;">
                ${currentInventoryFilter === 'all'
                ? 'Votre inventaire est vide. <a href="#shop" style="color: var(--primary-color);">Visitez la boutique</a>'
                : 'Aucun article dans cette catégorie.'}
            </div>
        `;
        return;
    }

    grid.innerHTML = filteredItems.map(item => {
        let actionBtn = '';
        if (item.category === 'consumable') {
            const sName = (item.itemName || 'Objet').replace(/'/g, "\\'");
            const sImage = (item.image || '').replace(/'/g, "\\'");
            actionBtn = `<button class="btn-primary" onclick="window.confirmUse('${item.id}', '${sName}', ${item.quantity || 1}, '${sImage}')" style="width:100%; margin-top:0.5rem; padding:0.4rem; font-size:0.9rem;">Utiliser</button>`;
        }

        // Quantity badge
        const qtyBadge = item.quantity && item.quantity > 1
            ? `<div style="position:absolute; top:5px; right:5px; background:var(--primary-color); color:white; border-radius:12px; padding:2px 8px; font-size:0.8rem; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.2);">x${item.quantity}</div>`
            : '';

        return `
        <div class="inventory-item-card" style="position:relative;">
            ${qtyBadge}
            <div class="inventory-item-icon ${item.category === 'consumable' ? 'consumable-icon' : ''}">
                ${item.image ? `<img src="${item.image}" alt="${item.itemName}" style="width:100%; height:100%; object-fit:contain;">` : (item.icon || '🎁')}
            </div>
            <div class="inventory-item-info">
                <div class="inventory-item-name">${item.itemName || item.name || 'Article'}</div>
                <div class="inventory-item-category">${getCategoryLabel(item.category)}</div>
                ${actionBtn}
            </div>
        </div>
        `;
    }).join('');

    // ============================================
    // CUSTOM CONSUME MODAL LOGIC
    // ============================================

    let consumeState = { itemId: null, itemName: null, maxQty: 1, currentQty: 1 };

    window.openConsumeModal = (itemId, itemName, maxQty, imageUrl) => {
        const modal = document.getElementById('consume-modal');
        if (!modal) {
            // Fallback to legacy if modal missing
            window.confirmUseLegacy(itemId, itemName, maxQty);
            return;
        }

        consumeState = { itemId, itemName, maxQty, currentQty: 1 };

        document.getElementById('consume-item-name').textContent = itemName;
        document.getElementById('consume-qty-display').textContent = '1';

        // Preview image
        const previewContainer = document.getElementById('consume-item-preview');
        if (imageUrl) {
            previewContainer.innerHTML = `<div class="consumable-icon" style="width:100px;height:100px;display:flex;align-items:center;justify-content:center;overflow:hidden;"><img src="${imageUrl}" style="width:100%;height:100%;object-fit:contain;transform:scale(3.5);"></div>`;
        } else {
            previewContainer.innerHTML = `<div style="font-size:3rem;">🎁</div>`;
        }

        modal.style.display = 'flex';
    };

    window.closeConsumeModal = () => {
        const modal = document.getElementById('consume-modal');
        if (modal) modal.style.display = 'none';
    };

    window.adjustConsumeQty = (delta) => {
        let newQty = consumeState.currentQty + delta;
        newQty = Math.max(1, Math.min(newQty, consumeState.maxQty));

        consumeState.currentQty = newQty;
        document.getElementById('consume-qty-display').textContent = newQty;
    };

    const attachConsumeListener = () => {
        const btn = document.getElementById('btn-confirm-consume');
        if (btn) {
            btn.onclick = async () => {
                const btnRef = document.getElementById('btn-confirm-consume');
                btnRef.disabled = true;
                btnRef.textContent = '...';
                try {
                    const res = await useConsumable(consumeState.itemId, consumeState.currentQty);
                    if (res.success) {
                        notyf.success(res.message);
                        showStatBoostAnimation(res.message);
                        loadInventory();
                        if (typeof loadUserPet === 'function') loadUserPet();
                        window.closeConsumeModal();
                    } else {
                        notyf.error(res.error);
                    }
                } catch (e) {
                    console.error(e);
                    notyf.error("Erreur.");
                } finally {
                    btnRef.disabled = false;
                    btnRef.textContent = 'Confirmer';
                }
            };
        }
    };
    setTimeout(attachConsumeListener, 100);

    window.confirmUse = (itemId, itemName, maxQty = 1, imageUrl = '') => {
        if (maxQty > 1) {
            window.openConsumeModal(itemId, itemName, maxQty, imageUrl);
            attachConsumeListener();
        } else {
            if (confirm(`Utiliser ${itemName} ?`)) {
                useConsumable(itemId, 1).then(res => {
                    if (res.success) {
                        notyf.success(res.message);
                        loadInventory();
                        if (typeof loadUserPet === 'function') loadUserPet();
                    } else {
                        notyf.error(res.error);
                    }
                });
            }
        }
    };

    // Legacy Handler (renamed)
    window.confirmUseLegacy = async (itemId, itemName, maxQty = 1) => {
        let qtyToUse = 1;

        if (maxQty > 1) {
            const input = prompt(`Combien de "${itemName}" voulez-vous utiliser ? (Max: ${maxQty})`, "1");
            if (input === null) return; // Cancelled

            qtyToUse = parseInt(input);
            if (isNaN(qtyToUse) || qtyToUse < 1) {
                notyf.error("Quantité invalide.");
                return;
            }
            if (qtyToUse > maxQty) {
                notyf.error(`Vous n'en avez que ${maxQty}.`);
                return;
            }
        } else {
            if (!confirm(`Voulez-vous utiliser ${itemName} ?`)) return;
        }

        try {
            const res = await useConsumable(itemId, qtyToUse);
            if (res.success) {
                notyf.success(res.message || "Objet utilisé !");
                loadInventory(); // Reload inventory
                // Refresh pet stats visually if possible (requires page reload or re-fetching stats)
                if (typeof loadUserPet === 'function') loadUserPet();
            } else {
                notyf.error(res.error || "Erreur lors de l'utilisation.");
            }
        } catch (e) {
            console.error(e);
            notyf.error("Erreur technique.");
        }
    };
}

function getCategoryLabel(category) {
    const labels = {
        'theme': '🎨 Thème',
        'frame': '🖼️ Cadre',
        'badge': '🏅 Badge',
        'boost': '⚡ Boost',
        'consumable': '🍬 Consommable',
        'companion': '🐾 Compagnon'
    };
    return labels[category] || category;
}

function initInventoryFilters(inventory) {
    const filters = document.querySelectorAll('[data-inventory-filter]');

    filters.forEach(btn => {
        btn.onclick = () => {
            filters.forEach(f => f.classList.remove('active'));
            btn.classList.add('active');
            currentInventoryFilter = btn.dataset.inventoryFilter;
            renderInventoryItems(inventory);
        };
    });
}

function initTransactionsButton() {
    const btn = document.getElementById('show-transactions-btn');
    const section = document.getElementById('transactions-section');

    if (btn && section) {
        btn.onclick = async () => {
            if (section.style.display === 'none') {
                section.style.display = 'block';
                btn.innerHTML = '<span>📜</span> Masquer';

                // Load transactions
                const transactions = await getTransactionHistory(20);
                renderTransactions(transactions);
            } else {
                section.style.display = 'none';
                btn.innerHTML = '<span>📜</span> Historique';
            }
        };
    }
}

function renderTransactions(transactions) {
    const list = document.getElementById('transactions-list');
    if (!list) return;

    if (transactions.length === 0) {
        list.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Aucune transaction.</div>';
        return;
    }

    const reasonLabels = {
        'shop_purchase': '🛒 Achat boutique',
        'admin_gift': '🎁 Cadeau admin',
        'quiz_complete': '📝 Quiz terminé',
        'badge_unlock': '🏆 Badge débloqué',
        'first_login': '🌟 Bonus de bienvenue',
        'daily_bonus': '📅 Bonus quotidien',
        'trade_transfer': '📤 Échange envoyé',
        'trade_received': '📥 Échange reçu'
    };

    list.innerHTML = transactions.map(tx => {
        const isPositive = tx.amount > 0;
        const date = tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleDateString('fr-FR') : 'N/A';

        // Build transaction label
        let label;

        // Check if reason is a known code or an item name
        if (reasonLabels[tx.reason]) {
            // It's a known reason code
            label = reasonLabels[tx.reason];
            // Add item name from metadata if available
            if (tx.metadata?.itemName) {
                label = `🛒 ${tx.metadata.itemName}`;
            }
        } else if (tx.reason && tx.reason !== tx.type) {
            // Reason is likely an item name (new format)
            label = isPositive ? `📥 ${tx.reason}` : `🛒 ${tx.reason}`;
        } else {
            // Fallback to type icon
            label = isPositive ? '📥 Gain' : '📤 Dépense';
        }

        return `
            <div class="transaction-item ${isPositive ? 'positive' : 'negative'}">
                <div class="transaction-info">
                    <div class="transaction-type">${label}</div>
                    <div class="transaction-date">${date}</div>
                </div>
                <div class="transaction-amount ${isPositive ? 'positive' : 'negative'}">
                    ${isPositive ? '+' : ''}${tx.amount} 🪙
                </div>
            </div>
        `;
    }).join('');
}

function showStatBoostAnimation(message) {
    if (!message) return;
    const match = message.match(/([+-]\d+)\s+(\w+)/);
    if (!match) return;

    const amount = match[1];
    const stat = match[2];

    let icon = '⭐';
    let statClass = 'stat-boost-default';

    if (stat.includes('social')) { icon = '💖'; statClass = 'stat-boost-social'; }
    else if (stat.includes('creativity') || stat.includes('créativité')) { icon = '✨'; statClass = 'stat-boost-creativity'; }
    else if (stat.includes('intelligence')) { icon = '🧠'; statClass = 'stat-boost-intelligence'; }

    const animContainer = document.createElement('div');
    animContainer.className = `stat-boost-anim ${statClass}`;
    animContainer.innerHTML = `
        <div class="stat-boost-icon">${icon}</div>
        <div class="stat-boost-text">${amount} ${stat.charAt(0).toUpperCase() + stat.slice(1)}</div>
    `;

    document.body.appendChild(animContainer);

    setTimeout(() => {
        animContainer.remove();
    }, 2600);
}
