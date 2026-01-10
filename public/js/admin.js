import { db, usersCollection, bugsCollection, coursesCollection } from './firebase.js';
import { getDocs, getDoc, doc, updateDoc, setDoc, deleteDoc, query, orderBy, where, serverTimestamp, collection, limit, getCountFromServer, increment } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { state } from './state.js';
import { auth } from './firebase.js';
import { notyf } from './ui.js';
import { getAllSuccesDefinitions, createSucces, updateSucces, deleteSucces, seedDefaultSucces, cleanupDuplicateSucces } from './succes.js';
import { updateFeatureFlag } from './features.js';
import { escapeHtml, sanitizeAttribute } from './security.js';
import { getOverviewStats, getAllCourseStats, getTopUsers } from './stats.js';
import { getShopItems, createShopItem, updateShopItem, deleteShopItem, seedDefaultShopItems } from './shop.js';
import { adminGiftCoins } from './coins.js';
import { CATEGORIES_CONFIG } from './course.js';
import { createEvaluation, updateEvaluation, deleteEvaluation, getEvaluations } from './evaluations.js';

export async function loadUsers() {
    if (!state.isAdmin) return;
    console.log("Admin JS Updated - vFixFilters");
    try {
        const snap = await getDocs(usersCollection);
        const allUsers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Filter out archived users
        const activeUsers = allUsers.filter(user => !user.archived);

        renderUsers(activeUsers);
    } catch (error) {
        notyf.error("Erreur de chargement des utilisateurs.");
    }
}

export function renderUsers(users) {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Aucun utilisateur trouvé.</td></tr>';
        return;
    }
    tbody.innerHTML = users.map(user => {
        const date = user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';
        const role = user.role || 'student';
        const firstname = escapeHtml(user.firstname || 'N/A');
        const lastname = escapeHtml(user.lastname || 'N/A');
        const email = escapeHtml(user.email || 'N/A');
        const safeUserId = sanitizeAttribute(user.id);
        const isCurrentUser = user.id === auth.currentUser?.uid;

        return `
            <tr>
                <td>${email}</td>
                <td>${firstname}</td>
                <td>${lastname}</td>
                <td><span class="role-badge ${role}">${role === 'admin' ? 'Administrateur' : 'Étudiant'}</span></td>
                <td>${date}</td>
                <td>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn-gift-coins" data-user-id="${safeUserId}" data-user-name="${firstname}" title="Offrir des IFH Coins">
                            🪙
                        </button>
                        <button class="btn-change-role" data-user-id="${safeUserId}" data-new-role="${role === 'admin' ? 'student' : 'admin'}" ${isCurrentUser ? 'disabled' : ''}>
                            ${role === 'admin' ? 'Rétrograder' : 'Promouvoir'}
                        </button>
                        <button class="btn-delete" data-user-id="${safeUserId}" ${isCurrentUser ? 'disabled' : ''} title="${isCurrentUser ? 'Vous ne pouvez pas supprimer votre propre compte' : 'Supprimer cet utilisateur'}">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>`;
    }).join('');

    // Add event listeners after rendering - use requestAnimationFrame for better browser compatibility
    requestAnimationFrame(() => {
        const usersTableBody = document.getElementById('users-table-body');
        if (!usersTableBody) return;

        usersTableBody.querySelectorAll('.btn-gift-coins').forEach(btn => {
            btn.addEventListener('click', function () {
                const userId = this.dataset.userId;
                const userName = this.dataset.userName;
                openGiftCoinsModal(userId, userName);
            });
        });

        usersTableBody.querySelectorAll('.btn-change-role').forEach(btn => {
            btn.addEventListener('click', function () {
                const userId = this.dataset.userId;
                const newRole = this.dataset.newRole;
                changeUserRole(userId, newRole);
            });
        });

        usersTableBody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', function () {
                const userId = this.dataset.userId;
                deleteUser(userId);
            });
        });
    });
}

export async function changeUserRole(userId, newRole) {
    if (!state.isAdmin || userId === auth.currentUser.uid) {
        notyf.error("Action non autorisée.");
        return;
    }
    try {
        await updateDoc(doc(db, 'users', userId), { role: newRole });
        notyf.success(`Rôle modifié.`);
        loadUsers();
    } catch (error) {
        notyf.error("Erreur lors de la modification.");
    }
}

export async function deleteUser(userId) {
    // Prevent admin from deleting their own account
    if (userId === auth.currentUser?.uid) {
        notyf.error("Vous ne pouvez pas supprimer votre propre compte.");
        return;
    }

    if (!state.isAdmin) {
        notyf.error("Action non autorisée.");
        return;
    }

    // Confirmation dialog
    if (!confirm("Êtes-vous sûr de vouloir archiver cet utilisateur ? Vous pourrez le restaurer plus tard.")) {
        return;
    }

    try {
        console.log('Attempting to archive user:', userId);

        // Archive the user instead of deleting
        await updateDoc(doc(db, 'users', userId), {
            archived: true,
            archivedAt: serverTimestamp()
        });

        notyf.success('Utilisateur archivé avec succès.');
        loadUsers();
    } catch (error) {
        console.error("Error archiving user:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);

        let errorMessage = "Erreur lors de l'archivage de l'utilisateur.";

        if (error.code === 'permission-denied') {
            errorMessage = "Permission refusée. Vérifiez que vous êtes bien administrateur.";
        } else if (error.message) {
            errorMessage = `Erreur: ${error.message}`;
        }

        notyf.error(errorMessage);
    }
}

window.changeUserRole = changeUserRole;
window.deleteUser = deleteUser;

// ============================================
// GIFT IFH COINS 
// ============================================

let giftCoinsTargetUserId = null;

function openGiftCoinsModal(userId, userName) {
    giftCoinsTargetUserId = userId;

    // Create modal if it doesn't exist
    let modal = document.getElementById('gift-coins-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'gift-coins-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <h3>🪙 Offrir des IFH Coins</h3>
                <p id="gift-coins-user" style="color: var(--text-secondary); margin-bottom: 1.5rem;"></p>
                <form id="gift-coins-form">
                    <div class="form-group">
                        <label for="gift-coins-amount">Montant *</label>
                        <input type="number" id="gift-coins-amount" min="1" max="100000" placeholder="100" required>
                    </div>
                    <div class="form-group">
                        <label for="gift-coins-reason">Raison</label>
                        <input type="text" id="gift-coins-reason" placeholder="Ex: Récompense événement">
                    </div>
                    <div class="form-actions" style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                        <button type="submit" class="btn-primary" style="flex: 1;">Envoyer</button>
                        <button type="button" id="cancel-gift-coins" class="btn-cancel">Annuler</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);

        // Event listeners
        document.getElementById('cancel-gift-coins').addEventListener('click', closeGiftCoinsModal);
        document.getElementById('gift-coins-form').addEventListener('submit', handleGiftCoins);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeGiftCoinsModal();
        });
    }

    // Update user name
    document.getElementById('gift-coins-user').textContent = `Destinataire: ${userName || userId}`;
    document.getElementById('gift-coins-amount').value = '';
    document.getElementById('gift-coins-reason').value = '';

    modal.style.display = 'flex';
}

function closeGiftCoinsModal() {
    const modal = document.getElementById('gift-coins-modal');
    if (modal) modal.style.display = 'none';
    giftCoinsTargetUserId = null;
}

async function handleGiftCoins(e) {
    e.preventDefault();

    if (!giftCoinsTargetUserId || !state.isAdmin) {
        notyf.error('Action non autorisée');
        return;
    }

    const amount = parseInt(document.getElementById('gift-coins-amount').value, 10);
    const reason = document.getElementById('gift-coins-reason').value.trim() || 'Cadeau admin';

    if (!amount || amount <= 0) {
        notyf.error('Montant invalide');
        return;
    }

    try {
        await adminGiftCoins(giftCoinsTargetUserId, amount, reason);
        notyf.success(`🪙 ${amount} IFH offerts avec succès !`);
        closeGiftCoinsModal();
    } catch (error) {
        console.error('Error gifting coins:', error);
        notyf.error('Erreur lors de l\'envoi des coins');
    }
}

export function initAdminSidebar() {
    const sidebarLinks = document.querySelectorAll('.admin-sidebar .sidebar-link');
    const sidebarToggle = document.getElementById('sidebar-toggle');

    const sidebar = document.querySelector('.admin-sidebar');

    // Sidebar navigation
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            if (!section) return;

            const targetSection = document.getElementById(`admin-section-${section}`);
            if (!targetSection) return;

            // Update active link
            sidebarLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Update active section
            document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
            targetSection.classList.add('active');

            // Load data for section
            if (section === 'courses') loadCourseManagement();
            if (section === 'bugs') loadBugs();
            if (section === 'succes') loadSuccesAdmin();
            if (section === 'archived-courses') loadArchivedCourses();
            if (section === 'archived-users') loadArchivedUsers();
            if (section === 'reminders') {
                // Import is already at top of main.js
                window.loadAdminReminders();
                window.initReminderForm();
            }
            if (section === 'config') {
                loadConfig();
            }
            if (section === 'stats') {
                loadAdminStats();
            }
            if (section === 'shop') {
                loadShopAdmin();
            }
            if (section === 'pets') {
                loadPetsAdmin();
            }
            if (section === 'database') {
                loadDatabase();
            }
            if (section === 'professors') {
                initProfessorDialogues();
            }
            if (section === 'evaluations') {
                loadEvaluationsAdmin();
            }

            // Close sidebar on mobile after selection
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
            }
        });
    });

    // Sidebar toggle for mobile
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    // Bug Detail Modal Listeners
    document.getElementById('close-bug-detail-modal')?.addEventListener('click', closeBugDetail);
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('bug-detail-modal');
        if (e.target === modal) closeBugDetail();
    });
}

let currentBugs = []; // Local cache for detail view

export async function loadBugs() {
    if (!state.isAdmin) return;
    try {
        const snap = await getDocs(bugsCollection);
        currentBugs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderBugs(currentBugs);
    } catch (error) {
        console.error("Error loading bugs:", error);
        notyf.error("Erreur de chargement des signalements.");
    }
}

export function renderBugs(bugs) {
    const tbody = document.getElementById('bugs-table-body');
    if (!tbody) return;
    if (!bugs || bugs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem;">Aucun signalement. Tout va bien ! ☀️</td></tr>';
        return;
    }

    const sortedBugs = [...bugs].sort((a, b) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
    });

    tbody.innerHTML = sortedBugs.map(bug => {
        let date = 'Date en attente...';
        if (bug.createdAt && bug.createdAt.seconds) {
            date = new Date(bug.createdAt.seconds * 1000).toLocaleString('fr-FR');
        }
        const isResolved = bug.status === 'resolved';
        const statusClass = isResolved ? 'status-resolved' : 'status-new';
        const statusLabel = isResolved ? 'Résolu' : 'Nouveau';

        // Sanitize all bug data
        const safeUser = escapeHtml(bug.user);
        const safeSubject = escapeHtml(bug.subject);
        const safeDescription = escapeHtml(bug.description);
        const safeBugId = sanitizeAttribute(bug.id);

        return `
            <tr class="bug-row" onclick="viewBugDetail('${safeBugId}')">
                <td><strong>${safeUser}</strong></td>
                <td>
                    <div style="font-weight: 600;">${safeSubject}</div>
                    <div class="text-truncate-2" style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">${safeDescription}</div>
                </td>
                <td><small>${date}</small></td>
                <td><span class="bug-status ${statusClass}">${statusLabel}</span></td>
                <td>
                    <div style="display: flex; gap: 0.5rem;" onclick="event.stopPropagation()">
                        <button class="btn-bug-action ${isResolved ? 'btn-bug-reopen' : 'btn-bug-solve'}" 
                                onclick="toggleBugStatus('${safeBugId}', '${bug.status}')">
                            ${isResolved ? 'Réouvrir' : 'Résoudre'}
                        </button>
                        <button class="btn-delete" style="padding: 0.4rem 0.6rem;" onclick="deleteBug('${safeBugId}')">🗑️</button>
                    </div>
                </td>
            </tr>`;
    }).join('');
}

export function viewBugDetail(bugId) {
    const bug = currentBugs.find(b => b.id === bugId);
    if (!bug) return;

    const modal = document.getElementById('bug-detail-modal');
    if (!modal) return;

    const isResolved = bug.status === 'resolved';

    document.getElementById('bug-detail-subject').textContent = bug.subject;
    document.getElementById('bug-detail-description').textContent = bug.description;
    document.getElementById('bug-detail-user').textContent = bug.user;

    let date = 'Date inconnue';
    if (bug.createdAt && bug.createdAt.seconds) {
        date = new Date(bug.createdAt.seconds * 1000).toLocaleString('fr-FR');
    }
    document.getElementById('bug-detail-date').textContent = date;

    const statusSpan = document.getElementById('bug-detail-status');
    statusSpan.textContent = isResolved ? 'Résolu' : 'Nouveau';
    statusSpan.className = `bug-status ${isResolved ? 'status-resolved' : 'status-new'}`;

    const actionsDiv = document.getElementById('bug-detail-actions');
    actionsDiv.innerHTML = `
        <button class="btn-bug-action ${isResolved ? 'btn-bug-reopen' : 'btn-bug-solve'}" 
                onclick="toggleBugStatus('${bug.id}', '${bug.status}'); closeBugDetail();">
            ${isResolved ? 'Réouvrir le bug' : 'Marquer comme résolu'}
        </button>
    `;

    modal.style.display = 'flex';
}

export function closeBugDetail() {
    const modal = document.getElementById('bug-detail-modal');
    if (modal) modal.style.display = 'none';
}

window.viewBugDetail = viewBugDetail;
window.closeBugDetail = closeBugDetail;

export async function toggleBugStatus(bugId, currentStatus) {
    const newStatus = currentStatus === 'resolved' ? 'new' : 'resolved';
    try {
        await updateDoc(doc(db, 'bugs', bugId), { status: newStatus });
        notyf.success('Statut mis à jour.');
        loadBugs();
    } catch (error) {
        notyf.error("Erreur de mise à jour.");
    }
}

export async function deleteBug(bugId) {
    if (!confirm("Supprimer ce signalement ?")) return;
    try {
        await deleteDoc(doc(db, 'bugs', bugId));
        notyf.success('Signalement supprimé.');
        loadBugs();
    } catch (error) {
        notyf.error("Erreur de suppression.");
    }
}

window.toggleBugStatus = toggleBugStatus;
window.deleteBug = deleteBug;

export function loadCourseManagement() {
    const tbody = document.getElementById('courses-table-body');
    if (!tbody) return;

    // Hide exercise section when loading course management
    const exerciseSection = document.getElementById('course-exercises-section');
    if (exerciseSection) exerciseSection.style.display = 'none';

    const courses = state.courses.filter(c => !c.archived);

    if (courses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">Aucun cours disponible.</td></tr>';
        return;
    }

    // Separate courses and exercices
    const coursesOnly = courses.filter(c => c.type === 'cours' || !c.type);

    if (coursesOnly.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">Aucun cours disponible.</td></tr>';
        return;
    }

    tbody.innerHTML = coursesOnly.map(course => {
        const type = course.type || 'cours';
        const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
        const linkedExercises = course.linkedExercises || [];
        const exerciseCount = linkedExercises.length;
        const exerciseNames = linkedExercises
            .map(id => state.courses.find(c => c.id === id)?.title)
            .filter(Boolean)
            .join(', ') || 'Aucun';

        return `
            <tr>
                <td><strong>${course.title}</strong></td>
                <td>${course.subject}</td>
                <td><span class="course-type-tag type-${type}">${typeLabel}</span></td>
                <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${exerciseNames}">
                    <span class="exercise-count-badge">${exerciseCount}</span> ${exerciseNames}
                </td>
                <td>
                    <div class="table-actions">
                        <button class="btn-link-exercises" data-course-id="${course.id}" title="Lier des exercices">
                            🔗
                        </button>
                        <button class="btn-icon-action btn-edit" data-course-id="${course.id}" title="Modifier">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="btn-icon-action btn-delete" data-course-id="${course.id}" title="Archiver">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>`;
    }).join('');

    // Add event listeners
    requestAnimationFrame(() => {
        // Link exercises button
        tbody.querySelectorAll('.btn-link-exercises').forEach(btn => {
            btn.addEventListener('click', function () {
                const courseId = this.dataset.courseId;
                displayCourseExercises(courseId);
            });
        });

        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', function () {
                const courseId = this.dataset.courseId;
                import('./course.js').then(module => {
                    import('./state.js').then(stateModule => {
                        stateModule.setCurrentCourseId(courseId);
                        module.editCourse();
                    });
                });
            });
        });

        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async function () {
                const courseId = this.dataset.courseId;
                if (!confirm('Êtes-vous sûr de vouloir archiver ce cours ?')) return;

                try {
                    await updateDoc(doc(db, 'courses', courseId), {
                        archived: true,
                        archivedAt: serverTimestamp()
                    });
                    notyf.success('Cours archivé avec succès');
                    loadCourseManagement();
                } catch (error) {
                    notyf.error("Erreur lors de l'archivage.");
                }
            });
        });
    });
}

export function displayCourseExercises(courseId) {
    const course = state.courses.find(c => c.id === courseId);
    if (!course) return;

    const section = document.getElementById('course-exercises-section');
    const titleEl = document.getElementById('linking-course-title');
    const list = document.getElementById('available-exercises-list');
    const allEx = state.courses.filter(c => c.type === 'exercice' && !c.archived);
    const linked = course?.linkedExercises || [];

    // Update title
    if (titleEl) titleEl.textContent = `Lier des exercices à : ${course.title}`;

    if (allEx.length === 0) {
        list.innerHTML = '<p style="padding: 1rem; color: var(--text-secondary);">Aucun exercice disponible. Créez d\'abord des exercices.</p>';
        section.style.display = 'block';
        return;
    }

    list.innerHTML = allEx.map(ex => `
        <label class="exercise-label">
            <input type="checkbox" class="exercise-checkbox" data-exercise-id="${ex.id}" ${linked.includes(ex.id) ? 'checked' : ''}>
            <div><strong>${ex.title}</strong><br><small>${ex.subject}</small></div>
        </label>`).join('');

    // Add buttons
    const btnContainer = document.createElement('div');
    btnContainer.className = 'exercise-linking-buttons';
    btnContainer.innerHTML = `
        <button class="btn-primary" id="save-exercises-btn">Enregistrer</button>
        <button class="btn-cancel" id="cancel-linking-btn">Annuler</button>
    `;
    list.appendChild(btnContainer);

    // Event listeners
    document.getElementById('save-exercises-btn').onclick = () => saveLinkedExercises(courseId);
    document.getElementById('cancel-linking-btn').onclick = () => {
        section.style.display = 'none';
    };

    section.style.display = 'block';
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export async function saveLinkedExercises(courseId) {
    const linked = Array.from(document.querySelectorAll('.exercise-checkbox:checked')).map(cb => cb.dataset.exerciseId);
    try {
        await updateDoc(doc(db, 'courses', courseId), { linkedExercises: linked });
        const idx = state.courses.findIndex(c => c.id === courseId);
        if (idx !== -1) state.courses[idx].linkedExercises = linked;
        notyf.success('Liaison enregistrée !');
    } catch (error) {
        notyf.error("Erreur d'enregistrement.");
    }
}
window.saveLinkedExercises = saveLinkedExercises;

// Archived Courses Management
export async function loadArchivedCourses() {
    if (!state.isAdmin) return;
    try {
        const querySnapshot = await getDocs(coursesCollection);
        const archivedCourses = querySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(course => course.archived === true);

        renderArchivedCourses(archivedCourses);
    } catch (error) {
        console.error("Error loading archived courses:", error);
        notyf.error("Erreur de chargement des cours archivés.");
    }
}

export function renderArchivedCourses(courses) {
    const tbody = document.getElementById('archived-courses-table-body');
    if (!tbody) return;

    if (courses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">Aucun cours archivé.</td></tr>';
        return;
    }

    tbody.innerHTML = courses.map(course => {
        const type = course.type || 'cours';
        const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
        const archivedDate = course.archivedAt ?
            new Date(course.archivedAt.seconds * 1000).toLocaleDateString('fr-FR') :
            'N/A';

        return `
            <tr>
                <td><strong>${course.title}</strong></td>
                <td>${course.subject}</td>
                <td><span class="course-type-tag type-${type}">${typeLabel}</span></td>
                <td>${archivedDate}</td>
                <td>
                    <button class="btn-primary" data-course-id="${course.id}" style="padding: 0.5rem 1rem;">
                        Restaurer
                    </button>
                </td>
            </tr>`;
    }).join('');

    // Add event listeners for restore buttons
    requestAnimationFrame(() => {
        tbody.querySelectorAll('.btn-primary').forEach(btn => {
            btn.addEventListener('click', function () {
                const courseId = this.dataset.courseId;
                restoreCourse(courseId);
            });
        });
    });
}

export async function restoreCourse(courseId) {
    if (!state.isAdmin) {
        notyf.error("Action non autorisée.");
        return;
    }

    if (!confirm("Êtes-vous sûr de vouloir restaurer ce cours ?")) {
        return;
    }

    try {
        // Remove archived flags
        await updateDoc(doc(db, 'courses', courseId), {
            archived: false,
            archivedAt: null
        });

        notyf.success('Cours restauré avec succès !');

        // Reload archived courses list
        loadArchivedCourses();

        // Note: The main course list will be updated when the user navigates back to it
    } catch (error) {
        console.error("Error restoring course:", error);
        notyf.error("Erreur lors de la restauration du cours.");
    }
}

window.restoreCourse = restoreCourse;

// Archived Users Management
export async function loadArchivedUsers() {
    if (!state.isAdmin) return;
    try {
        const snap = await getDocs(usersCollection);
        const archivedUsers = snap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(user => user.archived === true);

        renderArchivedUsers(archivedUsers);
    } catch (error) {
        console.error("Error loading archived users:", error);
        notyf.error("Erreur de chargement des utilisateurs archivés.");
    }
}

export function renderArchivedUsers(users) {
    const tbody = document.getElementById('archived-users-table-body');
    if (!tbody) return;

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Aucun utilisateur archivé.</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => {
        const role = user.role || 'student';
        const firstname = user.firstname || 'N/A';
        const lastname = user.lastname || 'N/A';
        const archivedDate = user.archivedAt ?
            new Date(user.archivedAt.seconds * 1000).toLocaleDateString('fr-FR') :
            'N/A';

        return `
            <tr>
                <td>${user.email || 'N/A'}</td>
                <td>${firstname}</td>
                <td>${lastname}</td>
                <td><span class="role-badge ${role}">${role === 'admin' ? 'Administrateur' : 'Étudiant'}</span></td>
                <td>${archivedDate}</td>
                <td>
                    <button class="btn-primary" data-user-id="${user.id}" style="padding: 0.5rem 1rem;">
                        Restaurer
                    </button>
                </td>
            </tr>`;
    }).join('');

    // Add event listeners for restore buttons
    requestAnimationFrame(() => {
        tbody.querySelectorAll('.btn-primary').forEach(btn => {
            btn.addEventListener('click', function () {
                const userId = this.dataset.userId;
                restoreUser(userId);
            });
        });
    });
}

export async function restoreUser(userId) {
    if (!state.isAdmin) {
        notyf.error("Action non autorisée.");
        return;
    }

    if (!confirm("Êtes-vous sûr de vouloir restaurer cet utilisateur ?")) {
        return;
    }

    try {
        // Remove archived flags
        await updateDoc(doc(db, 'users', userId), {
            archived: false,
            archivedAt: null
        });

        notyf.success('Utilisateur restauré avec succès !');

        // Reload archived users list
        loadArchivedUsers();
    } catch (error) {
        console.error("Error restoring user:", error);
        notyf.error("Erreur lors de la restauration de l'utilisateur.");
    }
}

window.restoreUser = restoreUser;

// ============================================
// EVALUATIONS MANAGEMENT
// ============================================

export async function loadEvaluationsAdmin() {
    if (!state.isAdmin) return;
    try {
        const evaluations = await getEvaluations();
        renderEvaluationsAdmin(evaluations);
    } catch (error) {
        console.error("Error loading evaluations:", error);
        notyf.error("Erreur de chargement des évaluations.");
    }
}

function renderEvaluationsAdmin(evaluations) {
    const tbody = document.getElementById('evaluations-table-body');
    const addBtn = document.getElementById('add-evaluation-btn');

    if (addBtn) {
        addBtn.onclick = () => openEvaluationEditor();
    }

    if (!tbody) return;

    if (evaluations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Aucune évaluation créée.</td></tr>';
        return;
    }

    tbody.innerHTML = evaluations.map(ev => {
        const safeTitle = escapeHtml(ev.title);
        const tags = ev.tags ? ev.tags.join(', ') : '';

        return `
            <tr>
                <td><strong>${safeTitle}</strong></td>
                <td><span class="role-badge" style="background: var(--surface-hover); color: var(--text-main);">${ev.categoryId}</span></td>
                <td>${tags}</td>
                <td>${ev.questionCount}</td>
                <td>${ev.timeLimit} min</td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn-icon-action btn-edit-eval" data-id="${ev.id}" title="Modifier">
                             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="btn-icon-action btn-delete-eval" data-id="${ev.id}" title="Supprimer">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Listeners
    requestAnimationFrame(() => {
        tbody.querySelectorAll('.btn-edit-eval').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                // Fetch latest data or find in memory
                // Re-fetch to be safe or pass full object
                const evaluations = await getEvaluations();
                const ev = evaluations.find(e => e.id === id);
                openEvaluationEditor(ev);
            });
        });

        tbody.querySelectorAll('.btn-delete-eval').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                if (confirm("Supprimer cette évaluation ?")) {
                    try {
                        await deleteEvaluation(id);
                        notyf.success("Évaluation supprimée");
                        loadEvaluationsAdmin();
                    } catch (e) {
                        notyf.error("Erreur de suppression");
                    }
                }
            });
        });
    });
}

function openEvaluationEditor(evaluation = null) {
    const modal = document.getElementById('evaluation-editor-modal');
    modal.style.display = 'flex';

    // Fill fields
    document.getElementById('evaluation-id').value = evaluation ? evaluation.id : '';
    document.getElementById('evaluation-title').value = evaluation ? evaluation.title : '';
    document.getElementById('evaluation-category').value = evaluation ? evaluation.categoryId : '';
    document.getElementById('evaluation-tags').value = evaluation ? evaluation.tags.join(', ') : '';
    document.getElementById('evaluation-count').value = evaluation ? evaluation.questionCount : 20;
    document.getElementById('evaluation-time').value = evaluation ? evaluation.timeLimit : 30;
    document.getElementById('evaluation-modal-title').textContent = evaluation ? 'Modifier Évaluation' : 'Nouvelle Évaluation';

    // Save Handler
    const form = document.getElementById('evaluation-form');
    // Remove old listener to avoid dupes (naive way: rely on onclick on submit button or clone)
    // Better: use one global listener. But here we are initializing on open.
    // Let's attach onsubmit once or replace node.

    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    newForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('evaluation-id').value;
        const data = {
            title: document.getElementById('evaluation-title').value,
            categoryId: document.getElementById('evaluation-category').value,
            tags: document.getElementById('evaluation-tags').value.split(',').map(t => t.trim()).filter(Boolean),
            questionCount: parseInt(document.getElementById('evaluation-count').value),
            timeLimit: parseInt(document.getElementById('evaluation-time').value)
        };

        try {
            if (id) {
                await updateEvaluation(id, data);
                notyf.success("Mis à jour !");
            } else {
                await createEvaluation(data);
                notyf.success("Créé !");
            }
            modal.style.display = 'none';
            loadEvaluationsAdmin();
        } catch (err) {
            console.error(err);
            notyf.error("Erreur d'enregistrement");
        }
    };

    document.getElementById('cancel-evaluation-btn').onclick = () => {
        modal.style.display = 'none';
    };
}

// ============================================
// SUCCES ADMIN MANAGEMENT
// ============================================

let currentEditingSuccesId = null;

export async function loadSuccesAdmin() {
    if (!state.isAdmin) return;

    try {
        const succes = await getAllSuccesDefinitions();
        renderSuccesAdmin(succes);
        initSuccesAdminListeners();
    } catch (error) {
        console.error("Error loading succes:", error);
        notyf.error("Erreur de chargement des succes.");
    }
}

// ============================================
// DATABASE VISUALIZATION
// ============================================

const KNOWN_COLLECTIONS = [
    'users', 'courses', 'bugs', 'shop_items', 'succes',
    'quiz_results', 'favorites', 'coin_transactions', 'pets'
];

export async function loadDatabase() {
    if (!state.isAdmin) return;

    const grid = document.getElementById('db-stats-grid');
    if (!grid) return;

    grid.innerHTML = '<div class="loading-spinner">Chargement des données...</div>';

    // Hide detail view if open
    document.getElementById('db-collection-detail').style.display = 'none';

    try {
        const stats = await Promise.all(KNOWN_COLLECTIONS.map(async (colName) => {
            return await fetchCollectionData(colName);
        }));

        renderDatabaseStats(stats);
    } catch (error) {
        console.error("Error loading database stats:", error);
        notyf.error("Erreur lors du chargement de la base de données.");
        grid.innerHTML = '<p class="error-text">Erreur de chargement.</p>';
    }

    // Add event listener for refresh button
    const refreshBtn = document.getElementById('refresh-database-btn');
    if (refreshBtn) {
        // Remove old listener to avoid duplicates
        const newBtn = refreshBtn.cloneNode(true);
        refreshBtn.parentNode.replaceChild(newBtn, refreshBtn);
        newBtn.addEventListener('click', loadDatabase);
    }
}

async function fetchCollectionData(collectionName) {
    try {
        const colRef = collection(db, collectionName);

        // 1. Get Count (Estimate or Exact)
        let count = 'N/A';
        try {
            // Check if getCountFromServer is available (v9 modular SDK)
            // If not available, we might fall back to reading metadata or just listing docs (expensive for large DBs)
            // For now, let's assume valid SDK or handle error
            if (typeof getCountFromServer === 'function') {
                const snapshot = await getCountFromServer(colRef);
                count = snapshot.data().count;
            } else {
                // Fallback: Get all docs (Use with caution on large DBs, maybe limit?)
                // Actually, let's just use a small sample query to test existence if we can't count cheap
                const snap = await getDocs(query(colRef, limit(1000))); // Hard limit for safety
                count = snap.size + (snap.size === 1000 ? '+' : '');
            }
        } catch (e) {
            console.warn(`Could not count ${collectionName}`, e);
        }

        // 2. Get Sample for Schema Inference
        const sampleSnap = await getDocs(query(colRef, limit(5)));
        const samples = sampleSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        return {
            name: collectionName,
            count: count,
            samples: samples
        };
    } catch (error) {
        console.error(`Error fetching ${collectionName}:`, error);
        return { name: collectionName, count: 'Err', samples: [] };
    }
}

function renderDatabaseStats(statsData) {
    const grid = document.getElementById('db-stats-grid');
    if (!grid) return;

    if (statsData.length === 0) {
        grid.innerHTML = '<p>Aucune collection trouvée.</p>';
        return;
    }

    grid.innerHTML = statsData.map(stat => {
        const icon = getCollectionIcon(stat.name);
        return `
            <div class="db-collection-card" onclick="viewCollectionDetail('${stat.name}')">
                <h3>
                    ${stat.name}
                    <span class="count-badge">${stat.count}</span>
                </h3>
                <div class="db-icon">${icon}</div>
                <p style="font-size: 0.85rem; color: var(--text-secondary);">
                    ${stat.samples.length > 0 ? 'Données disponibles' : 'Collection vide'}
                </p>
            </div>
        `;
    }).join('');

    // Store data globally or partially for detail view
    window.dbStatsCache = statsData;
}

function getCollectionIcon(name) {
    const map = {
        'users': '👥', 'courses': '📚', 'bugs': '🐞',
        'shop_items': '🛒', 'succes': '🏆', 'quiz_results': '📝',
        'favorites': '❤️', 'coin_transactions': '🪙', 'pets': '🐾'
    };
    return map[name] || '📂';
}

export function viewCollectionDetail(collectionName) {
    const data = window.dbStatsCache?.find(s => s.name === collectionName);
    if (!data) return;

    const container = document.getElementById('db-collection-detail');
    const nameEl = document.getElementById('detail-collection-name');
    const schemaList = document.getElementById('detail-schema-list');
    const sampleJson = document.getElementById('detail-sample-json');

    if (!container || !nameEl) return;

    nameEl.textContent = `Collection: ${collectionName}`;

    // Inferred Schema
    const schema = inferSchema(data.samples);
    if (Object.keys(schema).length === 0) {
        schemaList.innerHTML = '<li><em>Aucun schéma détecté (collection vide ?)</em></li>';
    } else {
        schemaList.innerHTML = Object.entries(schema).map(([field, type]) => `
            <li>
                <strong>${field}</strong>
                <span class="type-badge">${type}</span>
            </li>
        `).join('');
    }

    // Sample Data - Table View
    if (data.samples.length > 0) {
        // Create a more readable table view
        const tableView = createTableView(data.samples, schema);
        sampleJson.innerHTML = `
            <div class="db-view-controls">
                <button class="btn-view-toggle active" data-view="table">📊 Table</button>
                <button class="btn-view-toggle" data-view="json">📄 JSON</button>
            </div>
            <div class="db-table-view" style="display: block;">${tableView}</div>
            <div class="db-json-view" style="display: none;">
                <pre>${JSON.stringify(data.samples, null, 2)}</pre>
            </div>
        `;

        // Add toggle listeners
        sampleJson.querySelectorAll('.btn-view-toggle').forEach(btn => {
            btn.addEventListener('click', function () {
                const view = this.dataset.view;
                sampleJson.querySelectorAll('.btn-view-toggle').forEach(b => b.classList.remove('active'));
                this.classList.add('active');

                if (view === 'table') {
                    sampleJson.querySelector('.db-table-view').style.display = 'block';
                    sampleJson.querySelector('.db-json-view').style.display = 'none';
                } else {
                    sampleJson.querySelector('.db-table-view').style.display = 'none';
                    sampleJson.querySelector('.db-json-view').style.display = 'block';
                }
            });
        });
    } else {
        sampleJson.innerHTML = '<p style="padding: 1rem; color: var(--text-secondary);">Aucune donnée disponible</p>';
    }

    container.style.display = 'block';

    // Smooth scroll
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function createTableView(samples, schema) {
    if (!samples || samples.length === 0) return '<p>Aucune donnée</p>';

    // Get top 5-6 most important fields (exclude very nested objects)
    const fields = Object.keys(schema).slice(0, 6);

    let html = '<div class="db-data-table-wrapper"><table class="db-data-table"><thead><tr>';
    html += fields.map(f => `<th>${f}</th>`).join('');
    html += '<th>Actions</th></tr></thead><tbody>';

    samples.forEach((doc, idx) => {
        html += '<tr>';
        fields.forEach(field => {
            let value = doc[field];

            // Format the value for display
            if (value === null || value === undefined) {
                value = '<em>null</em>';
            } else if (typeof value === 'object') {
                if (value.seconds) {
                    // Firestore Timestamp
                    value = new Date(value.seconds * 1000).toLocaleString('fr-FR');
                } else if (Array.isArray(value)) {
                    value = `[${value.length} items]`;
                } else {
                    value = '{...}';
                }
            } else if (typeof value === 'string' && value.length > 50) {
                value = value.substring(0, 50) + '...';
            }

            html += `<td>${value}</td>`;
        });

        html += `<td><button class="btn-expand-doc" onclick="expandDocument(${idx})" title="Voir le document complet">🔍</button></td>`;
        html += '</tr>';
    });

    html += '</tbody></table></div>';

    // Store samples globally for expand function
    window.currentDetailSamples = samples;

    return html;
}

window.expandDocument = function (index) {
    const doc = window.currentDetailSamples?.[index];
    if (!doc) return;

    // Create a modal to show the full document
    let modal = document.getElementById('doc-detail-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'doc-detail-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px; max-height: 80vh; overflow: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
                    <h3>Document Complet</h3>
                    <button id="close-doc-detail" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-secondary);">✖</button>
                </div>
                <pre id="doc-detail-content" class="json-viewer"></pre>
            </div>
        `;
        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
        document.getElementById('close-doc-detail').addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    document.getElementById('doc-detail-content').textContent = JSON.stringify(doc, null, 2);
    modal.style.display = 'flex';
};

function inferSchema(samples) {
    if (!samples || samples.length === 0) return {};
    const schema = {};

    // Merge keys from all samples
    samples.forEach(doc => {
        Object.keys(doc).forEach(key => {
            const val = doc[key];
            let type = typeof val;
            if (val === null) type = 'null';
            else if (Array.isArray(val)) type = 'array';
            else if (val instanceof Object && val.seconds) type = 'timestamp'; // Firestore Timestamp guess

            // Simple conflict resolution: overwrite
            if (!schema[key] || schema[key] === 'null') {
                schema[key] = type;
            }
        });
    });
    return schema;
}

export function closeCollectionDetail() {
    const container = document.getElementById('db-collection-detail');
    if (container) container.style.display = 'none';
}
window.viewCollectionDetail = viewCollectionDetail;
window.closeCollectionDetail = closeCollectionDetail;

// ============================================
// PETS ADMIN MANAGEMENT
// ============================================

let currentPets = [];
let filteredPets = [];

export async function loadPetsAdmin() {
    if (!state.isAdmin) return;

    try {
        // Fetch all pets from the pets collection
        const petsCollection = collection(db, 'pets');
        const petsSnap = await getDocs(petsCollection);
        currentPets = [];

        // Fetch all users for owner names
        const usersSnap = await getDocs(usersCollection);
        const usersMap = new Map();
        usersSnap.docs.forEach(doc => {
            const userData = doc.data();
            usersMap.set(doc.id, {
                firstname: userData.firstname || 'Unknown',
                lastname: userData.lastname || ''
            });
        });

        // 3. [NEW] Fetch Inventories to validate ownership (Strict Mode)
        const userInventoryValidated = new Map(); // userId -> Set<speciesId>

        const inventoryPromises = usersSnap.docs.map(async (userDoc) => {
            const uid = userDoc.id;
            const inventoryRef = collection(db, 'users', uid, 'inventory');
            const invSnap = await getDocs(inventoryRef);

            const ownedSpecies = new Set();
            invSnap.docs.forEach(invDoc => {
                const invId = invDoc.id;
                // Inventory IDs are usually 'pet_lunombre' or just 'lunombre'
                // We normalize by removing 'pet_' prefix to match pet.petId
                const species = invId.replace(/^pet_/, '').toLowerCase();
                ownedSpecies.add(species);

                // Also check 'itemId' field if present (sometimes different from doc ID)
                const data = invDoc.data();
                if (data.itemId) {
                    ownedSpecies.add(data.itemId.replace(/^pet_/, '').toLowerCase());
                }
            });
            userInventoryValidated.set(uid, ownedSpecies);
        });

        await Promise.all(inventoryPromises);

        petsSnap.docs.forEach(doc => {
            const pet = doc.data();
            const petId = doc.id;
            const userId = pet.userId;
            const speciesId = (pet.petId || pet.id || 'unknown').toLowerCase();

            // [STRICT FILTER] Check if user actually owns this pet species
            // Allow if:
            // 1. Pet is Active (Equipped)
            // 2. Species exists in User's Inventory
            const userOwned = userInventoryValidated.get(userId);
            const isOwned = userOwned && (userOwned.has(speciesId) || userOwned.has(petId)); // Check species or direct ID

            if (!pet.isActive && !isOwned) {
                // Skip this pet (Ghost/Stale record)
                return;
            }

            // Get owner name from users map
            const owner = usersMap.get(userId) || { firstname: 'Unknown', lastname: '' };

            currentPets.push({
                id: petId, // Document ID from pets collection
                userId: userId,
                ownerName: `${owner.firstname} ${owner.lastname}`.trim(),
                name: pet.name || 'Sans nom',
                petId: speciesId,
                level: pet.level || 1,
                xp: pet.xp || 0,
                affectionLevel: pet.affectionLevel || 0,
                isActive: pet.isActive,
                adoptedAt: pet.adoptedAt,
                // Include full pet data for potential future use
                petData: pet
            });
        });

        // ===================================
        // DEDUPLICATION & FILTERING LOGIC
        // ===================================

        // 1. Group pets by User + Type (Normalized)
        const petsByOwnerAndType = new Map();
        const knownSpecies = new Set(['feerale', 'celestiale', 'voltor', 'voltonnerre', 'ombrage', 'lunombre']);

        currentPets.forEach(pet => {
            let speciesKey = pet.petId;

            // Normalize key if it looks like a unique ID (long string) or isn't a known species
            if (!knownSpecies.has(speciesKey) || speciesKey.length > 20) {
                // Fallback: Map name to species key (basic approximation)
                const lowerName = (pet.name || '').toLowerCase();
                if (lowerName.includes('lum')) speciesKey = 'lunombre'; // Catch typo/variations
                else if (lowerName.includes('lunombre')) speciesKey = 'lunombre';
                else if (lowerName.includes('celestiale')) speciesKey = 'celestiale';
                else if (lowerName.includes('feerale')) speciesKey = 'feerale';
                else if (lowerName.includes('voltonnerre')) speciesKey = 'voltonnerre';
                else if (lowerName.includes('voltor')) speciesKey = 'voltor';
                else if (lowerName.includes('ombrage')) speciesKey = 'ombrage';
            }

            const key = `${pet.userId}_${speciesKey}`;

            if (!petsByOwnerAndType.has(key)) {
                petsByOwnerAndType.set(key, []);
            }
            petsByOwnerAndType.get(key).push(pet);
        });

        // 2. Select the "Best" candidate for each group
        const uniquePets = [];
        let hiddenDuplicatesCount = 0;

        petsByOwnerAndType.forEach((group) => {
            if (group.length === 1) {
                uniquePets.push(group[0]);
            } else {
                // Sorting priorities:
                // 1. isActive (Equipped)
                // 2. Highest Level
                // 3. Highest XP
                // 4. Most recently Adopted/Created
                group.sort((a, b) => {
                    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
                    if (a.level !== b.level) return b.level - a.level;
                    if (a.xp !== b.xp) return b.xp - a.xp;
                    // Fallback to time (assuming newer is better/active)
                    const timeA = a.adoptedAt?.seconds || 0;
                    const timeB = b.adoptedAt?.seconds || 0;
                    return timeB - timeA;
                });

                // Keep the best one
                uniquePets.push(group[0]);
                hiddenDuplicatesCount += (group.length - 1);
            }
        });

        // Update the main list to only use unique pets
        currentPets = uniquePets;

        // Calculate and display statistics
        displayPetsStats(currentPets, hiddenDuplicatesCount);

        // Render table
        filteredPets = [...currentPets];
        renderPetsTable(filteredPets);

        // Add filter listeners
        initPetsFilters();
    } catch (error) {
        console.error('Error loading pets:', error);
        notyf.error('Erreur lors du chargement des compagnons.');
    }
}

function displayPetsStats(pets, hiddenCount = 0) {
    document.getElementById('stat-total-pets').innerHTML = `
        ${pets.length} 
        ${hiddenCount > 0 ? `<span style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-top: 0.2rem;">(+${hiddenCount} masqués)</span>` : ''}
    `;

    // Count evolved pets (those with petId that ends in evolution forms)
    const evolvedPets = pets.filter(p =>
        ['celestiale', 'voltonnerre', 'lunombre'].includes(p.petId)
    );
    document.getElementById('stat-evolved-pets').textContent = evolvedPets.length;

    // Average level
    const avgLevel = pets.length > 0
        ? Math.round(pets.reduce((sum, p) => sum + (p.level || 1), 0) / pets.length)
        : 0;
    document.getElementById('stat-avg-level').textContent = avgLevel;

    // Average affection
    const avgAffection = pets.length > 0
        ? Math.round(pets.reduce((sum, p) => sum + (p.affectionLevel || 0), 0) / pets.length)
        : 0;
    document.getElementById('stat-avg-affection').textContent = avgAffection;
}

function renderPetsTable(pets) {
    const tbody = document.getElementById('pets-table-body');
    if (!tbody) return;

    if (pets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">Aucun compagnon trouvé.</td></tr>';
        return;
    }

    tbody.innerHTML = pets.map(pet => {
        const adoptedDate = pet.adoptedAt?.seconds
            ? new Date(pet.adoptedAt.seconds * 1000).toLocaleDateString('fr-FR')
            : 'N/A';

        const petName = pet.name || 'Sans nom';
        const petType = pet.petId || 'Unknown';
        const level = pet.level || 1;
        const xp = pet.xp || 0;
        const affection = pet.affectionLevel || 0;

        return `
            <tr>
                <td><strong>${escapeHtml(petName)}</strong></td>
                <td>${escapeHtml(pet.ownerName)}</td>
                <td><span class="pet-type-badge">${escapeHtml(petType)}</span></td>
                <td>${level}</td>
                <td>${xp}</td>
                <td>${affection}%</td>
                <td>${adoptedDate}</td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn-icon-action" onclick="givePetXP('${sanitizeAttribute(pet.id)}')" title="Donner 1500 XP" style="background: #eab308; color: white;">
                            ⚡
                        </button>
                        <button class="btn-delete" onclick="deletePet('${sanitizeAttribute(pet.id)}')" title="Supprimer">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function initPetsFilters() {
    const typeFilter = document.getElementById('filter-pet-type');
    const evolutionFilter = document.getElementById('filter-pet-evolution');
    const resetBtn = document.getElementById('reset-pets-filters');

    if (typeFilter) {
        typeFilter.addEventListener('change', applyPetsFilters);
    }
    if (evolutionFilter) {
        evolutionFilter.addEventListener('change', applyPetsFilters);
    }
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            typeFilter.value = 'all';
            evolutionFilter.value = 'all';
            applyPetsFilters();
        });
    }
}

function applyPetsFilters() {
    const typeFilter = document.getElementById('filter-pet-type').value;
    const evolutionFilter = document.getElementById('filter-pet-evolution').value;

    filteredPets = currentPets.filter(pet => {
        // Type filter
        if (typeFilter !== 'all' && pet.petId !== typeFilter) {
            return false;
        }

        // Evolution filter
        if (evolutionFilter !== 'all') {
            const isEvolved = ['celestiale', 'voltonnerre', 'lunombre'].includes(pet.petId);
            if (evolutionFilter === 'evolved' && !isEvolved) return false;
            if (evolutionFilter === 'base' && isEvolved) return false;
        }

        return true;
    });

    renderPetsTable(filteredPets);
}

async function givePetXP(petId) {
    if (!confirm('Donner 1500 XP à ce compagnon ?')) return;

    try {
        // [FIX] Read current pet data to calculate level up
        const petRef = doc(db, 'pets', petId);
        const petSnap = await getDoc(petRef); // Ensure getDoc is imported if not already, or use getDocs if needed but getDoc is better

        if (!petSnap.exists()) {
            notyf.error("Compagnon introuvable.");
            return;
        }

        const currentPet = petSnap.data();

        // Dynamically import utility to avoid top-level dependency issues if any
        const { processXPGain } = await import('./utils/pet-utils.js');
        const result = processXPGain(currentPet.level || 1, currentPet.xp || 0, 1500);

        await updateDoc(petRef, {
            level: result.newLevel,
            xp: result.newXP
        });

        if (result.levelsGained > 0) {
            notyf.success(`1500 XP ajoutés ! Level UP -> ${result.newLevel}`);
        } else {
            notyf.success('1500 XP ajoutés !');
        }

        loadPetsAdmin();
    } catch (error) {
        console.error('Error giving XP:', error);
        notyf.error("Erreur lors de l'ajout d'XP.");
    }
}

async function deletePet(petId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce compagnon ?')) return;

    try {
        await deleteDoc(doc(db, 'pets', petId));
        notyf.success('Compagnon supprimé avec succès.');
        loadPetsAdmin();
    } catch (error) {
        console.error('Error deleting pet:', error);
        notyf.error('Erreur lors de la suppression du compagnon.');
    }
}

window.givePetXP = givePetXP;
window.deletePet = deletePet;

// ============================================
// SUCCES ADMIN MANAGEMENT (RENDERING)
// ============================================

function renderSuccesAdmin(succesList) {
    const tbody = document.getElementById('succes-table-body');
    if (!tbody) return;

    if (succesList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Aucun succès créé. Cliquez sur "Initialiser les succès par défaut" pour commencer.</td></tr>';
        return;
    }

    tbody.innerHTML = succesList.map(succes => {
        const categoryLabel = {
            'progression': 'Progression',
            'excellence': 'Excellence',
            'special': 'Spécial'
        }[succes.category] || succes.category;

        const requirementLabel = formatRequirement(succes.requirement);

        return `
            <tr>
                <td style="width: 60px; text-align: center;">
                    ${succes.icon && succes.icon.includes('/')
                ? `<img src="${succes.icon}" alt="${succes.name}" style="width: 40px; height: 40px; object-fit: contain; display: block; margin: 0 auto;">`
                : `<span style="font-size: 2rem; display: block;">${succes.icon || '🏆'}</span>`}
                </td>
                <td><strong>${succes.name}</strong></td>
                <td style="max-width: 200px; color: var(--text-secondary);">${succes.description || '-'}</td>
                <td><span class="succes-category-tag category-${succes.category}">${categoryLabel}</span></td>
                <td><code style="font-size: 0.8rem;">${requirementLabel}</code></td>
                <td>
                    <div class="table-actions">
                        <button class="btn-icon-action btn-edit-succes" data-succes-id="${succes.id}" title="Modifier">
                            ✏️
                        </button>
                        <button class="btn-icon-action btn-delete-succes" data-succes-id="${succes.id}" title="Supprimer">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>`;
    }).join('');

    // Add event listeners
    requestAnimationFrame(() => {
        tbody.querySelectorAll('.btn-edit-succes').forEach(btn => {
            btn.addEventListener('click', function () {
                const succesId = this.dataset.succesId;
                const succes = succesList.find(s => s.id === succesId);
                openSuccesEditor(succes);
            });
        });

        tbody.querySelectorAll('.btn-delete-succes').forEach(btn => {
            btn.addEventListener('click', async function () {
                const succesId = this.dataset.succesId;
                if (confirm('Supprimer ce succès ?')) {
                    try {
                        await deleteSucces(succesId);
                        notyf.success('Succès supprimé');
                        loadSuccesAdmin();
                    } catch (error) {
                        notyf.error('Erreur de suppression');
                    }
                }
            });
        });
    });
}

function formatRequirement(requirement) {
    if (!requirement) return 'N/A';

    switch (requirement.type) {
        case 'first_quiz':
            return 'Premier QCM';
        case 'quiz_count':
            return `${requirement.value} QCM`;
        case 'perfect_score':
            return 'Score 100%';
        case 'perfect_unique_count':
            return `${requirement.value} cours parfaits`;
        case 'perfect_streak':
            return `${requirement.value}x 100% de suite`;
        case 'course_read':
            return 'Lu avant QCM';
        case 'favorite_count':
            return `${requirement.value} favoris`;
        case 'speed_perfect':
            return `100% en <${requirement.value}s`;
        case 'comeback_perfect':
            return '100% après échec';
        case 'first_bug':
            return 'Premier bug';
        case 'loyalty':
            return `${requirement.days}j & ${requirement.quizzes} QCM`;
        case 'sunday_warrior':
            return `${requirement.value} QCM le dimanche`;
        default:
            return requirement.type;
    }
}

function initSuccesAdminListeners() {
    // Seed succes button
    const seedBtn = document.getElementById('seed-succes-btn');
    if (seedBtn && !seedBtn._listenerAdded) {
        seedBtn._listenerAdded = true;
        seedBtn.addEventListener('click', async () => {
            try {
                const result = await seedDefaultSucces();
                notyf.success(result.message);
                loadSuccesAdmin();
            } catch (error) {
                notyf.error('Erreur lors de l\'initialisation');
            }
        });
    }

    // Cleanup duplicates button
    const cleanupBtn = document.getElementById('cleanup-succes-btn');
    if (cleanupBtn && !cleanupBtn._listenerAdded) {
        cleanupBtn._listenerAdded = true;
        cleanupBtn.addEventListener('click', async () => {
            if (!confirm('Voulez-vous supprimer les anciens succès en double ? (Cela ne supprimera que les versions avec des IDs aléatoires qui correspondent aux noms par défaut)')) return;
            try {
                const result = await cleanupDuplicateSucces();
                notyf.success(result.message);
                loadSuccesAdmin();
            } catch (error) {
                console.error('Cleanup error:', error);
                notyf.error('Erreur lors du nettoyage');
            }
        });
    }

    // Add succes button
    const addBtn = document.getElementById('add-succes-btn');
    if (addBtn && !addBtn._listenerAdded) {
        addBtn._listenerAdded = true;
        addBtn.addEventListener('click', () => openSuccesEditor(null));
    }

    // Requirement type change
    const reqTypeSelect = document.getElementById('succes-requirement-type');
    if (reqTypeSelect && !reqTypeSelect._listenerAdded) {
        reqTypeSelect._listenerAdded = true;
        reqTypeSelect.addEventListener('change', function () {
            const valueGroup = document.getElementById('succes-requirement-value-group');
            const loyaltyGroup = document.getElementById('succes-requirement-loyalty-group');

            const typesWithValue = ['quiz_count', 'perfect_count', 'streak', 'perfect_unique_count', 'perfect_streak', 'favorite_count', 'speed_perfect', 'sunday_warrior'];

            valueGroup.style.display = typesWithValue.includes(this.value) ? 'block' : 'none';
            loyaltyGroup.style.display = this.value === 'loyalty' ? 'block' : 'none';
        });
    }

    // Succes form submit
    const form = document.getElementById('succes-form');
    if (form && !form._listenerAdded) {
        form._listenerAdded = true;
        form.addEventListener('submit', handleSuccesFormSubmit);
    }

    // Cancel button
    const cancelBtn = document.getElementById('cancel-succes-btn');
    if (cancelBtn && !cancelBtn._listenerAdded) {
        cancelBtn._listenerAdded = true;
        cancelBtn.addEventListener('click', closeSuccesEditor);
    }
}

function openSuccesEditor(succes = null) {
    const modal = document.getElementById('succes-editor-modal');
    const title = document.getElementById('succes-modal-title');
    const form = document.getElementById('succes-form');

    currentEditingSuccesId = succes ? succes.id : null;
    title.textContent = succes ? 'Modifier le Succès' : 'Nouveau Succès';
    form.reset();

    if (succes) {
        document.getElementById('succes-id').value = succes.id;
        document.getElementById('succes-name').value = succes.name || '';
        document.getElementById('succes-icon').value = succes.icon || '';
        document.getElementById('succes-description').value = succes.description || '';
        document.getElementById('succes-category').value = succes.category || 'progression';
        document.getElementById('succes-secret').checked = !!succes.secret;
        document.getElementById('succes-hint').value = succes.hint || '';

        if (succes.requirement) {
            const type = succes.requirement.type || 'first_quiz';
            document.getElementById('succes-requirement-type').value = type;

            if (succes.requirement.value !== undefined) {
                document.getElementById('succes-requirement-value').value = succes.requirement.value;
            }
            if (type === 'loyalty') {
                document.getElementById('succes-requirement-days').value = succes.requirement.days || 30;
                document.getElementById('succes-requirement-quizzes').value = succes.requirement.quizzes || 10;
            }
        }
    }

    // Show/hide fields based on requirement type
    const reqType = document.getElementById('succes-requirement-type').value;
    const typesWithValue = ['quiz_count', 'perfect_count', 'streak', 'perfect_unique_count', 'perfect_streak', 'favorite_count', 'speed_perfect', 'sunday_warrior'];

    document.getElementById('succes-requirement-value-group').style.display = typesWithValue.includes(reqType) ? 'block' : 'none';
    document.getElementById('succes-requirement-loyalty-group').style.display = reqType === 'loyalty' ? 'block' : 'none';

    modal.style.display = 'flex';
}

function closeSuccesEditor() {
    const modal = document.getElementById('succes-editor-modal');
    if (modal) modal.style.display = 'none';
    currentEditingSuccesId = null;
}

async function handleSuccesFormSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('succes-name').value.trim();
    const icon = document.getElementById('succes-icon').value.trim() || '🏆';
    const description = document.getElementById('succes-description').value.trim();
    const category = document.getElementById('succes-category').value;
    const secret = document.getElementById('succes-secret').checked;
    const hint = document.getElementById('succes-hint').value.trim();
    const requirementType = document.getElementById('succes-requirement-type').value;

    const requirement = { type: requirementType };
    const typesWithValue = ['quiz_count', 'perfect_count', 'streak', 'perfect_unique_count', 'perfect_streak', 'favorite_count', 'speed_perfect', 'sunday_warrior'];

    if (typesWithValue.includes(requirementType)) {
        requirement.value = parseInt(document.getElementById('succes-requirement-value').value) || 1;
    } else if (requirementType === 'loyalty') {
        requirement.days = parseInt(document.getElementById('succes-requirement-days').value) || 30;
        requirement.quizzes = parseInt(document.getElementById('succes-requirement-quizzes').value) || 10;
    }

    const succesData = {
        name,
        icon,
        description,
        category,
        secret,
        hint,
        requirement
    };

    try {
        if (currentEditingSuccesId) {
            await updateSucces(currentEditingSuccesId, succesData);
            notyf.success('Succès mis à jour');
        } else {
            await createSucces(succesData);
            notyf.success('Succès créé');
        }
        closeSuccesEditor();
        loadSuccesAdmin();
    } catch (error) {
        console.error("Error saving succes:", error);
        notyf.error("Erreur d'enregistrement");
    }
}

window.loadSuccesAdmin = loadSuccesAdmin;

export function loadConfig() {
    const { features } = state;

    const checkboxes = {
        'feature-flashcards': features.flashcards,
        'feature-succes': features.succes,
        'feature-quiz': features.quiz,
        'feature-reminders': features.reminders
    };

    Object.entries(checkboxes).forEach(([id, value]) => {
        const cb = document.getElementById(id);
        if (cb) cb.checked = value;
    });

    initConfigListeners();
}

function initConfigListeners() {
    const featureIds = ['flashcards', 'badges', 'quiz', 'reminders'];

    featureIds.forEach(feature => {
        const checkbox = document.getElementById(`feature-${feature}`);
        if (checkbox && !checkbox.dataset.listenerAdded) {
            checkbox.addEventListener('change', async (e) => {
                const isEnabled = e.target.checked;
                try {
                    await updateFeatureFlag(feature, isEnabled);
                    notyf.success(`Fonctionnalité ${feature} mise à jour.`);
                } catch (error) {
                    notyf.error("Erreur lors de la mise à jour.");
                    e.target.checked = !isEnabled; // Revert on error
                }
            });
            checkbox.dataset.listenerAdded = 'true';
        }
    });
}

// ============================================
// STATISTICS DASHBOARD
// ============================================

export async function loadAdminStats() {
    if (!state.isAdmin) return;

    try {
        // Show loading state
        document.getElementById('stat-total-views').textContent = '...';
        document.getElementById('stat-unique-views').textContent = '...';
        document.getElementById('stat-quiz-attempts').textContent = '...';
        document.getElementById('stat-avg-score').textContent = '...';
        document.getElementById('stat-total-users').textContent = '...';
        document.getElementById('stat-active-week').textContent = '...';

        // Fetch all stats in parallel
        const [overview, courseStats, topUsers] = await Promise.all([
            getOverviewStats(),
            getAllCourseStats(),
            getTopUsers(10)
        ]);

        renderOverviewStats(overview);
        renderCourseStats(courseStats);
        renderTopUsers(topUsers);

        // Setup refresh button
        const refreshBtn = document.getElementById('refresh-stats-btn');
        if (refreshBtn && !refreshBtn._listenerAdded) {
            refreshBtn.addEventListener('click', () => loadAdminStats());
            refreshBtn._listenerAdded = true;
        }
    } catch (error) {
        console.error('Error loading admin stats:', error);
        notyf.error("Erreur de chargement des statistiques.");
    }
}

function renderOverviewStats(overview) {
    if (!overview) return;

    document.getElementById('stat-total-views').textContent = overview.totalViews.toLocaleString('fr-FR');
    document.getElementById('stat-unique-views').textContent = overview.totalUniqueViews.toLocaleString('fr-FR');
    document.getElementById('stat-quiz-attempts').textContent = overview.totalQuizAttempts.toLocaleString('fr-FR');
    document.getElementById('stat-avg-score').textContent = overview.avgQuizScore + '%';
    document.getElementById('stat-total-users').textContent = overview.totalUsers.toLocaleString('fr-FR');
    document.getElementById('stat-active-week').textContent = overview.activeWeek.toLocaleString('fr-FR');
    document.getElementById('stat-avg-duration').textContent = overview.avgDuration ? formatDuration(overview.avgDuration) : '-';
}

function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '-';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function renderCourseStats(courses) {
    const tbody = document.getElementById('course-stats-table-body');
    if (!tbody) return;

    if (!courses || courses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Aucune donnée disponible.</td></tr>';
        return;
    }

    // Sort by total views descending
    const sorted = [...courses].sort((a, b) => b.totalViews - a.totalViews);

    tbody.innerHTML = sorted.map(course => {
        const scoreClass = course.avgScore >= 80 ? 'excellent' : course.avgScore >= 50 ? 'good' : 'average';
        const scoreDisplay = course.avgScore !== null ? `<span class="score-badge ${scoreClass}">${course.avgScore}%</span>` : '-';
        const durationDisplay = course.avgDuration ? formatDuration(course.avgDuration) : '-';

        return `
            <tr>
                <td><strong>${escapeHtml(course.title)}</strong></td>
                <td>${escapeHtml(course.subject)}</td>
                <td>${course.uniqueViews}</td>
                <td>${course.totalViews}</td>
                <td>${course.quizAttempts}</td>
                <td>${scoreDisplay}</td>
                <td>${durationDisplay}</td>
            </tr>`;
    }).join('');
}

function renderTopUsers(users) {
    const tbody = document.getElementById('top-users-table-body');
    if (!tbody) return;

    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Aucun utilisateur avec activité.</td></tr>';
        return;
    }

    tbody.innerHTML = users.map((user, index) => {
        const rank = index + 1;
        const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'default';
        const displayName = user.firstname && user.lastname
            ? `${user.firstname} ${user.lastname}`
            : user.email?.split('@')[0] || 'Anonyme';
        const scoreClass = user.avgScore >= 80 ? 'excellent' : user.avgScore >= 50 ? 'good' : 'average';

        return `
            <tr>
                <td><span class="rank-badge ${rankClass}">${rank}</span></td>
                <td><strong>${escapeHtml(displayName)}</strong></td>
                <td>${user.quizCount}</td>
                <td><span class="score-badge ${scoreClass}">${user.avgScore}%</span></td>
                <td>${user.perfectCount}</td>
                <td>${user.quizStreak} jours</td>
            </tr>`;
    }).join('');
}

window.loadAdminStats = loadAdminStats;

// ============================================
// SHOP ADMIN MANAGEMENT
// ============================================

let currentEditingShopItemId = null;

export async function loadShopAdmin() {
    if (!state.isAdmin) return;

    try {
        const items = await getShopItems('all');
        renderShopItemsAdmin(items);
        initShopAdminListeners();
    } catch (error) {
        console.error("Error loading shop items:", error);
        notyf.error("Erreur de chargement des articles.");
    }
}

function renderShopItemsAdmin(items) {
    const tbody = document.getElementById('shop-items-table-body');
    if (!tbody) return;

    // Update stats
    const activeItems = items.filter(i => i.active !== false);
    document.getElementById('stat-total-shop-items').textContent = activeItems.length;

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Aucun article. Cliquez sur "Initialiser les articles par défaut" pour commencer.</td></tr>';
        return;
    }

    const categoryLabels = {
        'theme': '🎨 Thème',
        'frame': '🖼️ Cadre',
        'succes': '🏅 Succès',
        'boost': '⚡ Boost'
    };

    tbody.innerHTML = items.map(item => {
        const isActive = item.active !== false;
        const stockText = item.stock === undefined || item.stock === null ? 'Illimité' : item.stock;
        const stockClass = item.stock !== undefined && item.stock !== null && item.stock <= 5 ? 'low-stock' : '';

        return `
            <tr class="${!isActive ? 'inactive-row' : ''}">
                <td>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 1.75rem;">
                            ${item.image
                ? `<img src="${item.image}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: contain;">`
                : (item.icon && item.icon.includes('/')
                    ? `<img src="${item.icon}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: contain;">`
                    : (item.icon || '🎁'))}
                        </div>
                        <div>
                            <strong>${escapeHtml(item.name)}</strong>
                            ${item.isLimited ? '<span class="badge-limited" style="margin-left: 0.5rem; font-size: 0.7rem; background: #ef4444; color: white; padding: 0.15rem 0.4rem; border-radius: 4px;">Limité</span>' : ''}
                        </div>
                    </div>
                </td>
                <td>${categoryLabels[item.category] || item.category}</td>
                <td><strong style="color: #fbbf24;">🪙 ${item.price}</strong></td>
                <td class="${stockClass}">${stockText}</td>
                <td>
                    <span class="bug-status ${isActive ? 'status-resolved' : 'status-new'}">
                        ${isActive ? 'Actif' : 'Inactif'}
                    </span>
                </td>
                <td>
                    <div class="table-actions">
                        <button class="btn-icon-action btn-edit-shop-item" data-item-id="${item.id}" title="Modifier">
                            ✏️
                        </button>
                        <button class="btn-icon-action btn-toggle-shop-item" data-item-id="${item.id}" data-active="${isActive}" title="${isActive ? 'Désactiver' : 'Activer'}">
                            ${isActive ? '🔒' : '🔓'}
                        </button>
                        <button class="btn-icon-action btn-delete-shop-item" data-item-id="${item.id}" title="Supprimer">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>`;
    }).join('');

    // Add event listeners
    requestAnimationFrame(() => {
        tbody.querySelectorAll('.btn-edit-shop-item').forEach(btn => {
            btn.addEventListener('click', function () {
                const itemId = this.dataset.itemId;
                const item = items.find(i => i.id === itemId);
                openShopItemEditor(item);
            });
        });

        tbody.querySelectorAll('.btn-toggle-shop-item').forEach(btn => {
            btn.addEventListener('click', async function () {
                const itemId = this.dataset.itemId;
                const isActive = this.dataset.active === 'true';
                try {
                    await updateShopItem(itemId, { active: !isActive });
                    notyf.success(isActive ? 'Article désactivé' : 'Article activé');
                    loadShopAdmin();
                } catch (error) {
                    notyf.error('Erreur de mise à jour');
                }
            });
        });

        tbody.querySelectorAll('.btn-delete-shop-item').forEach(btn => {
            btn.addEventListener('click', async function () {
                const itemId = this.dataset.itemId;
                if (confirm('Supprimer cet article définitivement ?')) {
                    try {
                        await deleteShopItem(itemId);
                        notyf.success('Article supprimé');
                        loadShopAdmin();
                    } catch (error) {
                        notyf.error('Erreur de suppression');
                    }
                }
            });
        });
    });
}

function initShopAdminListeners() {
    // Seed default items button
    const seedBtn = document.getElementById('seed-shop-btn');
    if (seedBtn && !seedBtn.dataset.listenerAdded) {
        seedBtn.dataset.listenerAdded = 'true';
        seedBtn.addEventListener('click', async () => {
            if (confirm('Cela va créer les articles par défaut. Continuer ?')) {
                try {
                    await seedDefaultShopItems();
                    notyf.success('Articles par défaut créés !');
                    loadShopAdmin();
                } catch (error) {
                    notyf.error('Erreur lors de la création');
                }
            }
        });
    }

    // Add new item button
    const addBtn = document.getElementById('add-shop-item-btn');
    if (addBtn && !addBtn.dataset.listenerAdded) {
        addBtn.dataset.listenerAdded = 'true';
        addBtn.addEventListener('click', () => openShopItemEditor());
    }

    // Cancel button in modal
    const cancelBtn = document.getElementById('cancel-shop-item-btn');
    if (cancelBtn && !cancelBtn.dataset.listenerAdded) {
        cancelBtn.dataset.listenerAdded = 'true';
        cancelBtn.addEventListener('click', closeShopItemEditor);
    }

    // Form submission
    const form = document.getElementById('shop-item-form');
    if (form && !form.dataset.listenerAdded) {
        form.dataset.listenerAdded = 'true';
        form.addEventListener('submit', handleShopItemFormSubmit);
    }

    // Close modal on click outside
    const modal = document.getElementById('shop-item-editor-modal');
    if (modal && !modal.dataset.listenerAdded) {
        modal.dataset.listenerAdded = 'true';
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeShopItemEditor();
        });
    }
}

function openShopItemEditor(item = null) {
    const modal = document.getElementById('shop-item-editor-modal');
    const title = document.getElementById('shop-item-modal-title');
    const form = document.getElementById('shop-item-form');

    if (!modal || !form) return;

    currentEditingShopItemId = item?.id || null;
    title.textContent = item ? 'Modifier l\'article' : 'Nouvel Article';

    // Fill form
    document.getElementById('shop-item-id').value = item?.id || '';
    document.getElementById('shop-item-name').value = item?.name || '';
    document.getElementById('shop-item-icon').value = item?.icon || '';
    document.getElementById('shop-item-description').value = item?.description || '';
    document.getElementById('shop-item-category').value = item?.category || 'theme';
    document.getElementById('shop-item-price').value = item?.price || '';
    document.getElementById('shop-item-stock').value = item?.stock ?? '';
    document.getElementById('shop-item-active').checked = item?.active !== false;
    document.getElementById('shop-item-limited').checked = item?.isLimited || false;

    // Handle expiry date
    const expiryInput = document.getElementById('shop-item-expiry');
    if (item?.availableUntil) {
        const date = item.availableUntil.toDate ? item.availableUntil.toDate() : new Date(item.availableUntil);
        expiryInput.value = date.toISOString().split('T')[0];
    } else {
        expiryInput.value = '';
    }

    modal.style.display = 'flex';
}

function closeShopItemEditor() {
    const modal = document.getElementById('shop-item-editor-modal');
    if (modal) modal.style.display = 'none';
    currentEditingShopItemId = null;
}

async function handleShopItemFormSubmit(e) {
    e.preventDefault();

    const itemData = {
        name: document.getElementById('shop-item-name').value.trim(),
        icon: document.getElementById('shop-item-icon').value.trim() || '🎁',
        description: document.getElementById('shop-item-description').value.trim(),
        category: document.getElementById('shop-item-category').value,
        price: parseInt(document.getElementById('shop-item-price').value, 10),
        active: document.getElementById('shop-item-active').checked,
        isLimited: document.getElementById('shop-item-limited').checked
    };

    // Handle optional stock
    const stockValue = document.getElementById('shop-item-stock').value;
    if (stockValue !== '') {
        itemData.stock = parseInt(stockValue, 10);
    }

    // Handle optional expiry date
    const expiryValue = document.getElementById('shop-item-expiry').value;
    if (expiryValue) {
        itemData.availableUntil = new Date(expiryValue);
    }

    try {
        if (currentEditingShopItemId) {
            await updateShopItem(currentEditingShopItemId, itemData);
            notyf.success('Article mis à jour !');
        } else {
            await createShopItem(itemData);
            notyf.success('Article créé !');
        }
        closeShopItemEditor();
        loadShopAdmin();
    } catch (error) {
        console.error('Error saving shop item:', error);
        notyf.error('Erreur lors de l\'enregistrement');
    }
}

window.loadShopAdmin = loadShopAdmin;

// ============================================
// PROFESSOR DIALOGUES MANAGEMENT
// ============================================

let currentProfCategory = '';

async function initProfessorDialogues() {
    const selector = document.getElementById('prof-category-select');
    const editor = document.getElementById('prof-dialogues-editor');
    const messagesList = document.getElementById('prof-messages-list');
    const addBtn = document.getElementById('add-prof-message-btn');
    const saveBtn = document.getElementById('save-prof-dialogues-btn');

    if (!selector || selector.dataset.initialized) return;

    // Populate selector dynamically
    selector.innerHTML = '<option value="">Sélectionner...</option>';
    Object.values(CATEGORIES_CONFIG).forEach(cat => {
        if (cat.id !== 'autre') {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.label;
            selector.appendChild(option);
        }
    });

    selector.dataset.initialized = 'true';

    selector.addEventListener('change', async (e) => {
        const category = e.target.value;
        currentProfCategory = category;

        if (!category) {
            editor.style.display = 'none';
            return;
        }

        editor.style.display = 'block';
        messagesList.innerHTML = '<p>Chargement...</p>';

        try {
            const docRef = doc(db, 'professor_dialogues', category);
            const docSnap = await getDoc(docRef);

            messagesList.innerHTML = ''; // Clear loading text

            if (docSnap.exists() && docSnap.data().messages) {
                const messages = docSnap.data().messages;
                messages.forEach(msg => addMessageInput(messagesList, msg));
            } else {
                // Add one empty input by default
                addMessageInput(messagesList, '');
            }
        } catch (error) {
            console.error("Error loading dialogues:", error);
            notyf.error("Erreur chargement dialogues.");
        }
    });

    addBtn.addEventListener('click', () => {
        addMessageInput(messagesList, '');
    });

    saveBtn.addEventListener('click', async () => {
        if (!currentProfCategory) return;

        const inputs = messagesList.querySelectorAll('textarea');
        const messages = Array.from(inputs).map(input => input.value.trim()).filter(val => val !== '');

        try {
            await setDoc(doc(db, 'professor_dialogues', currentProfCategory), {
                messages: messages,
                updatedAt: serverTimestamp()
            });
            notyf.success("Dialogues sauvegardés !");
        } catch (error) {
            console.error("Error saving dialogues:", error);
            notyf.error("Erreur sauvegarde.");
        }
    });
}

function addMessageInput(container, value) {
    const div = document.createElement('div');
    div.className = 'prof-message-row';
    div.style.cssText = 'display: flex; gap: 0.5rem; margin-bottom: 0.5rem; align-items: flex-start;';

    div.innerHTML = `
        <textarea class="form-control" rows="2" style="flex: 1;" placeholder="Saisir le message du professeur...">${value || ''}</textarea>
        <button class="btn-delete" style="padding: 0.5rem;" title="Supprimer ce message">🗑️</button>
    `;

    div.querySelector('.btn-delete').addEventListener('click', () => {
        div.remove();
    });

    container.appendChild(div);
}

