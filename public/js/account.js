import { auth, bugsCollection, db, storage } from './firebase.js';
import { getDocs, query, where, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-storage.js";
import { state } from './state.js';
import { notyf } from './ui.js';
import { loadUserFavorites } from './favorites.js';
import { getAllBadgeDefinitions, getUserBadges } from './badges.js';

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
        // Get all badge definitions and user's unlocked badges
        const [allBadges, userBadges] = await Promise.all([
            getAllBadgeDefinitions(),
            getUserBadges()
        ]);

        // Create a set of unlocked badge IDs for quick lookup
        const unlockedBadgeIds = new Set(userBadges.map(ub => ub.badgeId));

        if (allBadges.length === 0) {
            container.innerHTML = '<div class="empty-badges">Aucun badge disponible pour le moment.</div>';
            return;
        }

        // Sort badges: unlocked first, then locked
        const sortedBadges = [...allBadges].sort((a, b) => {
            const aUnlocked = unlockedBadgeIds.has(a.id);
            const bUnlocked = unlockedBadgeIds.has(b.id);
            if (aUnlocked && !bUnlocked) return -1;
            if (!aUnlocked && bUnlocked) return 1;
            return 0;
        });

        container.innerHTML = sortedBadges.map(badge => {
            const isUnlocked = unlockedBadgeIds.has(badge.id);
            const userBadge = userBadges.find(ub => ub.badgeId === badge.id);
            const unlockedDate = userBadge?.unlockedAt
                ? new Date(userBadge.unlockedAt.seconds * 1000).toLocaleDateString('fr-FR')
                : null;

            return `
                <div class="badge-card ${isUnlocked ? 'unlocked' : 'locked'}">
                    <div class="badge-icon">${badge.icon || '🏆'}</div>
                    <div class="badge-info">
                        <h4 class="badge-name">${badge.name}</h4>
                        <p class="badge-description">${badge.description || ''}</p>
                        ${isUnlocked
                    ? `<span class="badge-date">Débloqué le ${unlockedDate}</span>`
                    : '<span class="badge-locked-label">🔒 Verrouillé</span>'
                }
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error("Error loading badges:", error);
        container.innerHTML = '<div class="error-msg">Erreur de chargement des badges.</div>';
    }
}

