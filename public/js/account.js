import { auth, bugsCollection, db, storage } from './firebase.js';
import { getDocs, query, where, doc, getDoc, setDoc, updateDoc, collection, orderBy, limit, deleteDoc } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-storage.js";
import { state } from './state.js';
import { notyf } from './ui.js';
import { loadUserFavorites } from './favorites.js';
import { getUserBadges, getAllBadgeDefinitions, getUserBadgeStats, unlockBadge, removeUserBadge, showBadgeUnlockedPopup, getBadgeById } from './badges.js';
import { getUserInventory, equipItem, unequipItem, useConsumable } from './shop.js';
import { getUserBalance, formatCoins, getTransactionHistory } from './coins.js';
import { STARTER_PETS, PROFESSOR, XP_CONFIG, EVOLUTION_LEVELS } from './config/pets.js';
import {
    calculatePetStats,
    getQualityTier,
    getQualityHTML,
    getTotalIVs,
    getXPForNextLevel,
    canEvolve,
    applyEvolution,
    STAT_CONFIG
} from './utils/pet-utils.js';

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

    // Find pet definition for stats calculation
    // currentPet.id might be instanceId (e.g. "1767..."), so we need to find the species ID
    // usually stored in itemId (e.g. "pet_ombrage") or we need to try finding it directly if it's a legacy pet
    // Fix: If evolved, rely on valid ID. Otherwise prefer itemId if available.
    let speciesId = (currentPet.evolved && currentPet.id) ? currentPet.id : (currentPet.itemId ? currentPet.itemId.replace('pet_', '') : currentPet.id.replace('pet_', ''));
    let petDefinition = STARTER_PETS.find(p => p.id === speciesId);

    // Final fallback: if speciesId provided didn't match (maybe it was an instanceId), try to find the item in inventory by instanceId
    if (!petDefinition && ownedCompanions) {
        // Try to find an inventory item that matches this instance ID
        const inventoryItem = ownedCompanions.find(i => i.instanceId === speciesId || i.id === speciesId || i.instanceId === currentPet.id);

        if (inventoryItem) {
            // Check if itemId exists
            if (inventoryItem.itemId) {
                speciesId = inventoryItem.itemId.replace('pet_', '');
                petDefinition = STARTER_PETS.find(p => p.id === speciesId);
            }
            // If itemId is missing (corrupted data), Try matching by NAME as a last resort
            if (!petDefinition && inventoryItem.itemName) {
                petDefinition = STARTER_PETS.find(p => p.name === inventoryItem.itemName || p.name === inventoryItem.name);
            }
        }
    }

    // Absolute last resort: Match by currentPet.name directly
    if (!petDefinition && currentPet.name) {
        petDefinition = STARTER_PETS.find(p => p.name === currentPet.name);
    }

    // Check if this is an evolved form
    if (!petDefinition) {
        // Search in evolutions
        for (const starter of STARTER_PETS) {
            if (starter.evolution && starter.evolution.id === currentPet.id) {
                petDefinition = starter.evolution;
                break;
            }
        }
    }

    // Fallback for missing data
    if (!currentPet.image || !currentPet.type) {
        if (petDefinition) {
            currentPet.image = currentPet.image || petDefinition.image;
            currentPet.type = currentPet.type || petDefinition.type;
            currentPet.color = currentPet.color || petDefinition.color;
        }
    }

    // Calculate stats using new system (if IVs exist and are valid) or fallback to legacy
    let calculatedStats;
    let hasNewSystem = currentPet.ivs !== undefined && currentPet.ivs !== null;

    if (hasNewSystem && petDefinition) {
        calculatedStats = calculatePetStats(petDefinition, currentPet);
    } else {
        // Legacy: use stored stats directly
        calculatedStats = currentPet.stats || { intelligence: 0, creativity: 0, social: 0 };
    }

    // Calculate level progress using new formula
    const xpNeeded = getXPForNextLevel(currentPet.level || 1);
    const progressPercent = Math.min(100, Math.floor(((currentPet.xp || 0) / xpNeeded) * 100));

    // Get quality tier if IVs exist
    const qualityTier = hasNewSystem ? getQualityTier(currentPet.ivs) : null;

    // Build quality stars display with rarity-specific colors
    let qualityDisplay = '';
    if (qualityTier) {
        // Define rarity-specific colors and styles
        const rarityStyles = {
            'Commun': {
                color: '#9ca3af',
                bgColor: 'rgba(156, 163, 175, 0.15)',
                stars: '⭐',
                glow: 'none'
            },
            'Rare': {
                color: '#3b82f6',
                bgColor: 'rgba(59, 130, 246, 0.15)',
                stars: '⭐⭐',
                glow: '0 0 8px rgba(59, 130, 246, 0.5)'
            },
            'Épique': {
                color: '#a855f7',
                bgColor: 'rgba(168, 85, 247, 0.15)',
                stars: '⭐⭐⭐',
                glow: '0 0 12px rgba(168, 85, 247, 0.6)'
            },
            'Légendaire': {
                color: '#f59e0b',
                bgColor: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(249, 115, 22, 0.2))',
                stars: '🌟',
                glow: '0 0 15px rgba(245, 158, 11, 0.7)'
            }
        };

        const style = rarityStyles[qualityTier.name] || rarityStyles['Commun'];

        qualityDisplay = `<span class="pet-quality-stars" style="margin-left: 0.5rem; padding: 0.2rem 0.6rem; background: ${style.bgColor}; border-radius: 12px; font-size: 1.1rem; filter: drop-shadow(${style.glow}); cursor: help; display: inline-flex; align-items: center; -webkit-text-fill-color: initial;" title="${qualityTier.name} (IV: ${getTotalIVs(currentPet.ivs)}/45)">${style.stars}</span>`;
    }

    // Lookup personalized flavor text
    let flavorText = `${currentPet.nickname || currentPet.name} vous regarde avec attention. Il semble prêt à apprendre !`;

    // ConfigPetForFlavor was redundant and dangerous; rely on the correctly resolved petDefinition
    if (petDefinition && petDefinition.flavorText) {
        flavorText = petDefinition.flavorText;
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
                    <h3 class="pet-name-large">${currentPet.name}${qualityDisplay}</h3>
                    <div class="pet-badges">
                        <span class="pet-type-badge">${currentPet.type || 'Compagnon'}</span>
                        <span class="pet-level-badge">Niveau ${currentPet.level || 1}</span>
                        ${currentPet.evolved ? '<span class="pet-evolved-badge">✨ Évolué</span>' : ''}
                    </div>
                </div>
            </div>

            <div class="pet-stats-container">
                <div class="pet-progress-section">
                    <div class="progress-label">
                        <span>Expérience</span>
                        <span>${currentPet.xp || 0} / ${xpNeeded} XP</span>
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
                        <div class="stat-value">${calculatedStats.intelligence}</div>
                        <div class="stat-effect">+${Math.floor(calculatedStats.intelligence / 2)}% XP Quiz</div>
                    </div>
                    <div class="pet-stat-item" title="Augmente la chance de trouver des pièces">
                        <div class="stat-icon">🎨</div>
                        <div class="stat-name">Créativité</div>
                        <div class="stat-value">${calculatedStats.creativity}</div>
                        <div class="stat-effect">+${Math.floor(calculatedStats.creativity / 2)}% Chance Coins</div>
                    </div>
                    <div class="pet-stat-item" title="Augmente le bonus de connexion quotidienne">
                        <div class="stat-icon">🤝</div>
                        <div class="stat-name">Social</div>
                        <div class="stat-value">${calculatedStats.social}</div>
                        <div class="stat-effect">+${Math.floor(calculatedStats.social)}% Bonus Jour</div>
                    </div>
                </div>
                
                ${hasNewSystem ? `
                <div class="pet-iv-section" style="margin-top: 1.5rem;">
                    <div class="pet-iv-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                        <h4 style="margin: 0; color: var(--text-secondary); display: flex; align-items: center; gap: 0.5rem;">
                            🧬 Potentiel Génétique
                        </h4>
                        <span class="pet-iv-badge" style="padding: 0.25rem 0.75rem; background: ${qualityTier.color}20; color: ${qualityTier.color}; border-radius: 20px; font-weight: 600; font-size: 0.85rem;">
                            ${qualityTier.emoji} ${qualityTier.name}
                        </span>
                    </div>
                    <div class="pet-iv-bars" style="display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; background: rgba(0,0,0,0.02); border-radius: 12px; border: 1px solid rgba(0,0,0,0.05);">
                        <div class="iv-bar-row" style="display: flex; align-items: center; gap: 0.75rem;">
                            <span style="font-size: 1.25rem;">🧠</span>
                            <span style="width: 30px; font-size: 0.8rem; color: var(--text-secondary);">INT</span>
                            <div style="flex: 1; height: 8px; background: rgba(59, 130, 246, 0.15); border-radius: 4px; overflow: hidden;">
                                <div style="height: 100%; width: ${(currentPet.ivs.intelligence / 15) * 100}%; background: linear-gradient(90deg, #3b82f6, #60a5fa); border-radius: 4px; transition: width 0.5s ease;"></div>
                            </div>
                            <span style="width: 30px; text-align: right; font-weight: 600; color: #3b82f6;">${currentPet.ivs.intelligence}</span>
                        </div>
                        <div class="iv-bar-row" style="display: flex; align-items: center; gap: 0.75rem;">
                            <span style="font-size: 1.25rem;">🎨</span>
                            <span style="width: 30px; font-size: 0.8rem; color: var(--text-secondary);">CRE</span>
                            <div style="flex: 1; height: 8px; background: rgba(168, 85, 247, 0.15); border-radius: 4px; overflow: hidden;">
                                <div style="height: 100%; width: ${(currentPet.ivs.creativity / 15) * 100}%; background: linear-gradient(90deg, #a855f7, #c084fc); border-radius: 4px; transition: width 0.5s ease;"></div>
                            </div>
                            <span style="width: 30px; text-align: right; font-weight: 600; color: #a855f7;">${currentPet.ivs.creativity}</span>
                        </div>
                        <div class="iv-bar-row" style="display: flex; align-items: center; gap: 0.75rem;">
                            <span style="font-size: 1.25rem;">💖</span>
                            <span style="width: 30px; font-size: 0.8rem; color: var(--text-secondary);">SOC</span>
                            <div style="flex: 1; height: 8px; background: rgba(236, 72, 153, 0.15); border-radius: 4px; overflow: hidden;">
                                <div style="height: 100%; width: ${(currentPet.ivs.social / 15) * 100}%; background: linear-gradient(90deg, #ec4899, #f472b6); border-radius: 4px; transition: width 0.5s ease;"></div>
                            </div>
                            <span style="width: 30px; text-align: right; font-weight: 600; color: #ec4899;">${currentPet.ivs.social}</span>
                        </div>
                    </div>
                    <div class="pet-iv-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem; padding: 0.5rem 0;">
                        <span style="font-size: 0.8rem; color: var(--text-secondary);">Total IVs</span>
                        <span style="font-size: 1.1rem; font-weight: 700; background: linear-gradient(135deg, #f59e0b, #f97316); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">${getTotalIVs(currentPet.ivs)}/45</span>
                    </div>
                </div>
                ` : ''}
            </div>
            
            <div class="pet-flavor-text">
                <p>"${flavorText}"</p>
            </div>

            ${petDefinition && petDefinition.evolution ? `
            <div class="pet-action-footer" style="margin-top: 1.5rem; text-align: center;">
                <button onclick="handleEvolutionClick()" class="btn-evolution-glow">
                    ✨ Faire évoluer !
                </button>
            </div>
            ` : ''}


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

    // Filter out the current pet AND its pre-evolution form if evolved
    const filteredCompanions = ownedCompanions.filter(p => {
        // ABSOLUTE RULE: If it's equipped, it's the current pet. Don't show it in "Other Companions".
        if (p.equipped) return false;

        // If we have instance IDs (new system), rely on them for exact matching
        if (currentPet.instanceId && p.instanceId) {
            // If instance IDs match, it's the same pet
            if (currentPet.instanceId === p.instanceId) return false;
        }

        // Check by Inventory Document ID (itemId) if available - most robust
        if (currentPet.itemId && p.itemId && currentPet.itemId === p.itemId) {
            return false;
        }

        // Fallback for legacy pets or mixed cases:
        // Identify pets by their "species" ID (e.g. "ombrage" from "pet_ombrage")
        const petIdFromItem = p.id.replace('pet_', '');
        const itemPetId = p.itemId?.replace('pet_', '') || petIdFromItem;

        // Also check if species matches AND we don't have instance IDs differentiation
        // (This prevents showing duplicates if logic above fails, but allows multiple Ombrage if they are distinct instances)
        if (!p.instanceId && !currentPet.instanceId && (itemPetId === currentPet.id || petIdFromItem === currentPet.id)) {
            return false;
        }

        return true;
    });

    if (filteredCompanions.length > 0) {
        html += `
    <div class="other-pets-section">
                <h3>Mes Compagnons</h3>
                <div class="pets-grid">
                    ${filteredCompanions.map(p => {
            let petImage = p.image;
            if (!petImage && p.id.startsWith('pet_')) {
                petImage = `/images/pets/${p.id.replace('pet_', '')}.png`;
            }

            // Get level and IVs if available
            const petLevel = p.level || 1;
            const petIVs = p.ivs || null;
            const ivTotal = petIVs ? (petIVs.intelligence + petIVs.creativity + petIVs.social) : null;

            // Get quality tier
            let qualityEmoji = '';
            let qualityColor = '#9ca3af';
            let qualityName = 'Commun';
            if (ivTotal !== null) {
                if (ivTotal >= 41) { qualityEmoji = '🌟'; qualityColor = '#f59e0b'; qualityName = 'Légendaire'; }
                else if (ivTotal >= 31) { qualityEmoji = '⭐⭐⭐'; qualityColor = '#a855f7'; qualityName = 'Épique'; }
                else if (ivTotal >= 16) { qualityEmoji = '⭐⭐'; qualityColor = '#3b82f6'; qualityName = 'Rare'; }
                else { qualityEmoji = '⭐'; qualityColor = '#9ca3af'; qualityName = 'Commun'; }
            }

            // Build custom tooltip HTML
            const ivTooltipHTML = petIVs ? `
                <div class="iv-tooltip">
                    <div class="iv-tooltip-content">
                        <div class="iv-tooltip-header">
                            <span class="iv-tooltip-title">🧬 Potentiel Génétique</span>
                            <span class="iv-tooltip-quality" style="background: ${qualityColor}30; color: ${qualityColor};">${qualityName}</span>
                        </div>
                        <div class="iv-stats-grid">
                            <div class="iv-stat-row" data-stat="intelligence">
                                <span class="iv-stat-icon">🧠</span>
                                <span class="iv-stat-name">INT</span>
                                <div class="iv-stat-bar">
                                    <div class="iv-stat-fill" style="width: ${(petIVs.intelligence / 15) * 100}%;"></div>
                                </div>
                                <span class="iv-stat-value">${petIVs.intelligence}</span>
                            </div>
                            <div class="iv-stat-row" data-stat="creativity">
                                <span class="iv-stat-icon">🎨</span>
                                <span class="iv-stat-name">CRE</span>
                                <div class="iv-stat-bar">
                                    <div class="iv-stat-fill" style="width: ${(petIVs.creativity / 15) * 100}%;"></div>
                                </div>
                                <span class="iv-stat-value">${petIVs.creativity}</span>
                            </div>
                            <div class="iv-stat-row" data-stat="social">
                                <span class="iv-stat-icon">💖</span>
                                <span class="iv-stat-name">SOC</span>
                                <div class="iv-stat-bar">
                                    <div class="iv-stat-fill" style="width: ${(petIVs.social / 15) * 100}%;"></div>
                                </div>
                                <span class="iv-stat-value">${petIVs.social}</span>
                            </div>
                        </div>
                        <div class="iv-tooltip-footer">
                            <span class="iv-total-label">Total</span>
                            <span class="iv-total-value">${ivTotal}/45</span>
                        </div>
                    </div>
                </div>
            ` : `
                <div class="iv-tooltip">
                    <div class="iv-tooltip-content">
                        <div class="iv-tooltip-legacy">
                            <div class="iv-tooltip-legacy-icon">📦</div>
                            <div class="iv-tooltip-legacy-text">
                                Pet legacy<br>
                                <small>IVs non disponibles</small>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Badge for IV display (show legacy badge if no IVs)
            const ivBadge = petIVs
                ? `<span class="pet-iv-badge" style="font-size: 0.7rem; padding: 0.1rem 0.3rem; background: ${qualityColor}20; color: ${qualityColor}; border-radius: 4px;">
                    ${qualityEmoji} IV
                    ${ivTooltipHTML}
                   </span>`
                : `<span class="pet-iv-badge" style="font-size: 0.65rem; padding: 0.1rem 0.3rem; background: #64748b20; color: #64748b; border-radius: 4px;">
                    📦 Legacy
                    ${ivTooltipHTML}
                   </span>`;

            return `
                        <div class="pet-card-small" onclick="switchPet('${p.id}')">
                            <div class="pet-card-icon">
                                ${petImage ? `<img src="${petImage}" alt="${p.itemName}">` : (p.icon || '🐾')}
                            </div>
                            <div class="pet-card-info">
                                <h4>${p.itemName || p.name}</h4>
                                <div class="pet-card-meta" style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem;">
                                    <span class="pet-level-small" style="font-size: 0.75rem; color: var(--text-secondary);">Lvl ${petLevel}</span>
                                    ${ivBadge}
                                </div>
                            </div>
                            <button class="btn-switch">Choisir</button>
                        </div>
                        `;
        }).join('')}
                </div>
            </div >
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

    // Add debug button for admins
    if (state.isAdmin) {
        const debugSection = document.createElement('div');
        debugSection.className = 'pet-debug-section';
        debugSection.style.cssText = 'margin-top: 2rem; padding: 1rem; background: rgba(255,0,0,0.05); border: 1px dashed #ff6b6b; border-radius: 8px;';
        debugSection.innerHTML = `
            <p style="font-size: 0.8rem; color: #ff6b6b; margin-bottom: 0.75rem; text-align: center;">🔧 Debug Admin</p>
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; margin-bottom: 0.75rem;">
                <button class="btn-debug-pet" data-pet="feerale" style="font-size: 0.8rem; padding: 0.4rem 0.8rem; background: #ffdef0; border: 1px solid #ff9fc4; border-radius: 6px; cursor: pointer;">
                    🧚 Féerale Lvl 16
                </button>
                <button class="btn-debug-pet" data-pet="voltor" style="font-size: 0.8rem; padding: 0.4rem 0.8rem; background: #ffeb3b; border: 1px solid #fdd835; border-radius: 6px; cursor: pointer;">
                    ⚡ Voltor Lvl 16
                </button>
                <button class="btn-debug-pet" data-pet="ombrage" style="font-size: 0.8rem; padding: 0.4rem 0.8rem; background: #5c5470; color: white; border: 1px solid #3d3554; border-radius: 6px; cursor: pointer;">
                    🌑 Ombrage Lvl 16
                </button>
            </div>
            <div style="display: flex; gap: 0.5rem; justify-content: center;">
                <button id="btn-set-level" class="btn-secondary" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;">
                    📊 Modifier niveau
                </button>
                <button id="btn-add-xp" class="btn-secondary" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;">
                    ✨ +100 XP
                </button>
            </div>
`;
        container.appendChild(debugSection);

        // Pet reset buttons
        debugSection.querySelectorAll('.btn-debug-pet').forEach(btn => {
            btn.onclick = async () => {
                const petId = btn.dataset.pet;
                const petConfig = STARTER_PETS.find(p => p.id === petId);
                if (!petConfig) return;

                try {
                    const { generateRandomIVs, generateInstanceId } = await import('./utils/pet-utils.js');
                    const randomIVs = generateRandomIVs();

                    // SAFETY: Unequip current inventory items to prevent "ghost" equipped pets
                    // when forcing a debug pet overwrite.
                    const qInv = query(collection(db, 'users', auth.currentUser.uid, 'inventory'), where('equipped', '==', true));
                    const snap = await getDocs(qInv);
                    const updates = [];
                    snap.forEach(doc => {
                        updates.push(updateDoc(doc.ref, { equipped: false }));
                    });
                    await Promise.all(updates);

                    await setDoc(doc(db, 'users', auth.currentUser.uid), {
                        pet: {
                            id: petConfig.id,
                            name: petConfig.name,
                            type: petConfig.type,
                            image: petConfig.image,
                            color: petConfig.color,
                            level: 16,
                            xp: 0,
                            ivs: randomIVs,
                            evolutionBonus: { intelligence: 0, creativity: 0, social: 0 },
                            evolved: false,
                            instanceId: generateInstanceId(),
                            obtainedAt: new Date().toISOString()
                        }
                    }, { merge: true });

                    const hasEvolution = petConfig.evolution !== null;
                    notyf.success(`${petConfig.name} Lvl 16! ${hasEvolution ? '(peut évoluer)' : '(pas d\'évolution)'} `);
                    loadUserPet();
                } catch (e) {
                    console.error(e);
                    notyf.error('Erreur lors de la réinitialisation.');
                }
            };
        });

        // Set level button
        document.getElementById('btn-set-level').onclick = async () => {
            const newLevel = prompt('Nouveau niveau (1-100) :', currentPet.level || 1);
            if (!newLevel) return;

            const level = parseInt(newLevel);
            if (isNaN(level) || level < 1 || level > 100) {
                notyf.error('Niveau invalide (1-100)');
                return;
            }

            try {
                await setDoc(doc(db, 'users', auth.currentUser.uid), {
                    pet: { level: level, xp: 0 }
                }, { merge: true });
                notyf.success(`Niveau changé à ${level} `);
                loadUserPet();
            } catch (e) {
                notyf.error('Erreur');
            }
        };

        // Add XP button
        document.getElementById('btn-add-xp').onclick = async () => {
            try {
                const { processXPGain } = await import('./utils/pet-utils.js');
                const result = processXPGain(currentPet.level || 1, currentPet.xp || 0, 100);

                await setDoc(doc(db, 'users', auth.currentUser.uid), {
                    pet: { level: result.newLevel, xp: result.newXP }
                }, { merge: true });

                if (result.levelsGained > 0) {
                    notyf.success(`Level up! Niveau ${result.newLevel} `);
                } else {
                    notyf.success(`+ 100 XP`);
                }
                loadUserPet();
            } catch (e) {
                notyf.error('Erreur');
            }
        };
    }
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

        // [SELF-REPAIR] Fix "Ghost Equipped" items
        // If an item is marked equipped in inventory but is NOT the currently active pet in userData,
        // it means it was left in a dirty state (e.g. by debug tools). Fix it.
        try {
            const userDocRef = doc(db, 'users', auth.currentUser.uid);
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) {
                const userData = userSnap.data();
                if (userData && userData.pet) {
                    const currentPet = userData.pet;
                    const currentInstanceId = currentPet.instanceId;
                    const currentItemId = currentPet.itemId;

                    inventory.forEach(item => {
                        if (item.equipped) {
                            const matchesInstance = currentInstanceId && item.instanceId === currentInstanceId;
                            const matchesItem = currentItemId && item.itemId === currentItemId;

                            if (!matchesInstance && !matchesItem) {
                                console.warn("Auto-fixing ghost equipped item:", item.itemName);
                                updateDoc(doc(db, 'users', auth.currentUser.uid, 'inventory', item.itemId), { equipped: false });
                                item.equipped = false;
                            }
                        }
                    });
                }
            }
        } catch (err) {
            console.error("Self-repair error:", err);
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

        // Admin: Add Delete Button
        let adminBtn = '';
        let itemDetails = '';

        // Companion stats for display
        if (item.category === 'companion' && item.level) {
            const ivTotal = item.ivs ? (item.ivs.intelligence + item.ivs.creativity + item.ivs.social) : 0;
            const ivText = item.ivs ? `${ivTotal} IV` : '';
            itemDetails = `Lvl ${item.level} ${ivText ? '• ' + ivText : ''} `;
        }

        if (state.isAdmin) {
            const detailStr = itemDetails || '';
            adminBtn = `<button class="btn-secondary" onclick="event.stopPropagation(); window.deleteItem('${item.itemId}', '${(item.itemName || '').replace(/'/g, "\\'")}', '${detailStr}')" style="width:100%; margin-top:0.5rem; padding:0.4rem; font-size:0.8rem; background:#fee2e2; color:#ef4444; border:1px solid #fecaca;">🗑️ Supprimer (Admin)</button>`;
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
                ${itemDetails ? `<div style="font-size:0.85rem; color:var(--primary-color); font-weight:bold; margin-bottom:0.3rem;">${itemDetails}</div>` : ''}
                ${actionBtn}
                ${adminBtn}
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

// Admin Cleanup Tool
window.deleteItem = async (itemId, itemName, details = '') => {
    const detailMsg = details ? `\n(${details})` : '';
    if (!confirm(`ADMIN: Supprimer définitivement "${itemName}"${detailMsg} de l'inventaire ?`)) return;

    try {
        const userId = auth.currentUser.uid;
        await deleteDoc(doc(db, 'users', userId, 'inventory', itemId));
        notyf.success(`Item supprimé: ${itemName}`);
        loadInventory();
        if (typeof loadUserPet === 'function') loadUserPet();
    } catch (e) {
        console.error("Error deleting item:", e);
        notyf.error("Erreur lors de la suppression.");
    }
};

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

// ============================================
// PET EVOLUTION SYSTEM
// ============================================

function getPetDefinition(petId) {
    return STARTER_PETS.find(p => p.id === petId);
}

export async function checkEvolutionAvailable() {
    if (!auth.currentUser) return null;

    try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (!userDoc.exists()) return null;

        const userData = userDoc.data();
        const petData = userData.pet;

        console.log('[Evolution] petData:', petData);
        // Normalize ID similar to renderPetDashboard
        const rawId = petData?.id || '';
        const speciesId = petData?.itemId ? petData.itemId.replace('pet_', '') : rawId.replace('pet_', '');

        console.log('[Evolution] Normalized ID:', speciesId, 'petData.level:', petData?.level);

        if (!petData || petData.evolved) return null; // Already evolved or no pet

        // Robust definition lookup
        let petDef = STARTER_PETS.find(p => p.id === speciesId);

        // Fallback: Match by NAME if ID failed (handles instance IDs)
        if (!petDef && petData.name) {
            console.log('[Evolution] ID lookup failed. Trying fallback by Name:', petData.name);
            petDef = STARTER_PETS.find(p => p.name === petData.name);
        }

        console.log('[Evolution] petDef:', petDef?.name, 'evolution:', petDef?.evolution);

        if (!petDef || !petDef.evolution) return null; // No evolution available

        // Use new level-based evolution check
        const evolutionLevel = EVOLUTION_LEVELS?.FIRST || STAT_CONFIG.FIRST_EVOLUTION_LEVEL;
        const petLevel = petData.level || 1;

        console.log('[Evolution] Required level:', evolutionLevel, 'Current level:', petLevel);

        if (petLevel >= evolutionLevel) {
            // Also merge config properties (flavor text etc) which might be needed
            return { petData, petDef: { ...petDef, ...petData } };
        }

        return null;
    } catch (e) {
        console.error("Error checking evolution:", e);
        return null;
    }
}

let evolutionDialogueIndex = 0;
let currentEvolutionData = null;

function startEvolutionSequence(evolutionData) {
    currentEvolutionData = evolutionData;
    evolutionDialogueIndex = 0;

    const modal = document.getElementById('evolution-modal');
    const dialoguePhase = document.getElementById('evolution-dialogue-phase');
    const animPhase = document.getElementById('evolution-animation-phase');
    const resultPhase = document.getElementById('evolution-result-phase');

    // Reset phases
    dialoguePhase.style.display = 'flex';
    animPhase.style.display = 'none';
    resultPhase.style.display = 'none';

    // Reset next button text
    const nextBtn = document.getElementById('evolution-next-btn');
    if (nextBtn) nextBtn.textContent = '▼';

    // Show first dialogue
    showNextEvolutionDialogue();

    // Ensure listeners are attached (fix for stuck button)
    initEvolutionListeners();

    // Show modal with animation
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 50);
}

function showNextEvolutionDialogue() {
    const dialogues = PROFESSOR.dialogues.evolution;
    const textEl = document.getElementById('evolution-dialogue-text');
    const nextBtn = document.getElementById('evolution-next-btn');

    if (evolutionDialogueIndex < dialogues.length) {
        textEl.textContent = dialogues[evolutionDialogueIndex];
        evolutionDialogueIndex++;

        if (evolutionDialogueIndex >= dialogues.length) {
            nextBtn.textContent = "C'est parti !";
        }
    } else {
        // Start animation phase
        startEvolutionAnimation();
    }
}

function startEvolutionAnimation() {
    const dialoguePhase = document.getElementById('evolution-dialogue-phase');
    const animPhase = document.getElementById('evolution-animation-phase');

    dialoguePhase.style.display = 'none';
    animPhase.style.display = 'flex';

    // After animation plays (e.g., 4 seconds), show result
    setTimeout(() => {
        completeEvolution();
    }, 4000);
}

async function completeEvolution() {
    const animPhase = document.getElementById('evolution-animation-phase');
    const resultPhase = document.getElementById('evolution-result-phase');

    const { petData, petDef } = currentEvolutionData;
    const evolvedForm = petDef.evolution;

    // Apply evolution with random stat boost
    const evolvedPetData = applyEvolution(petData, evolvedForm);

    // Log the boost for debugging
    console.log('[Evolution] Stat boost applied:', evolvedPetData.lastEvolutionBoost);

    // Update Firestore
    try {
        await setDoc(doc(db, 'users', auth.currentUser.uid), {
            pet: evolvedPetData
        }, { merge: true });

        // Update Inventory Item if it exists
        if (evolvedPetData.itemId) {
            console.log('[Evolution] Updating inventory item:', evolvedPetData.itemId);
            await setDoc(doc(db, 'users', auth.currentUser.uid, 'inventory', evolvedPetData.itemId), {
                itemName: evolvedPetData.name,
                itemId: `pet_${evolvedPetData.id}`, // Update species reference
                image: evolvedPetData.image,
                level: evolvedPetData.level,
                ivs: evolvedPetData.ivs || null,
                evolutionBonus: evolvedPetData.evolutionBonus || null,
                evolved: true,
                evolvedAt: new Date()
            }, { merge: true });
        }

        // Show boost notification
        const boost = evolvedPetData.lastEvolutionBoost;
        notyf.success(`Boost d'évolution: +${boost.intelligence} INT, +${boost.creativity} CRE, +${boost.social} SOC`);
    } catch (e) {
        console.error("Error saving evolution:", e);
        notyf.error("Erreur lors de la sauvegarde de l'évolution.");
    }

    // Show result
    document.getElementById('evolution-new-pet-img').src = evolvedForm.image;
    document.getElementById('evolution-new-pet-name').textContent = evolvedForm.name;
    document.getElementById('evolution-new-pet-flavor').textContent = evolvedForm.flavorText;

    animPhase.style.display = 'none';
    resultPhase.style.display = 'flex';
}

function closeEvolutionModal() {
    const modal = document.getElementById('evolution-modal');
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
        loadUserPet(); // Reload pet display
    }, 500);
}

// Attach event listeners for evolution modal
function initEvolutionListeners() {
    const nextBtn = document.getElementById('evolution-next-btn');
    const closeBtn = document.getElementById('evolution-close-btn');

    if (nextBtn) nextBtn.onclick = showNextEvolutionDialogue;
    if (closeBtn) closeBtn.onclick = closeEvolutionModal;
}



// Expose globally
window.startEvolutionSequence = startEvolutionSequence;
window.closeEvolutionModal = closeEvolutionModal;

window.handleEvolutionClick = async () => {
    const btn = document.querySelector('.btn-evolution-glow');
    if (btn) {
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.style.opacity = '0.8';
        btn.innerHTML = '⏳ Chargement...';

        try {
            const evolutionData = await checkEvolutionAvailable();
            if (evolutionData) {
                startEvolutionSequence(evolutionData);
            } else {
                notyf.error("L'évolution n'est plus disponible.");
                setTimeout(() => window.location.reload(), 1500);
            }
        } catch (e) {
            console.error(e);
            notyf.error("Erreur technique.");
        } finally {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.innerHTML = originalText;
        }
    }
};
