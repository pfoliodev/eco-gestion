import { db, usersCollection, bugsCollection, coursesCollection } from './firebase.js';
import { getDocs, doc, updateDoc, deleteDoc, query, orderBy, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { state } from './state.js';
import { auth } from './firebase.js';
import { notyf } from './ui.js';
import { getAllBadgeDefinitions, createBadge, updateBadge, deleteBadge, seedDefaultBadges, cleanupDuplicateBadges } from './badges.js';

export async function loadUsers() {
    if (!state.isAdmin) return;
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
        const firstname = user.firstname || 'N/A';
        const lastname = user.lastname || 'N/A';
        const isCurrentUser = user.id === auth.currentUser?.uid;

        return `
            <tr>
                <td>${user.email || 'N/A'}</td>
                <td>${firstname}</td>
                <td>${lastname}</td>
                <td><span class="role-badge ${role}">${role === 'admin' ? 'Administrateur' : 'Étudiant'}</span></td>
                <td>${date}</td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn-change-role" data-user-id="${user.id}" data-new-role="${role === 'admin' ? 'student' : 'admin'}" ${isCurrentUser ? 'disabled' : ''}>
                            ${role === 'admin' ? 'Rétrograder' : 'Promouvoir'}
                        </button>
                        <button class="btn-delete" data-user-id="${user.id}" ${isCurrentUser ? 'disabled' : ''} title="${isCurrentUser ? 'Vous ne pouvez pas supprimer votre propre compte' : 'Supprimer cet utilisateur'}">
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
            if (section === 'badges') loadBadgesAdmin();
            if (section === 'archived-courses') loadArchivedCourses();
            if (section === 'archived-users') loadArchivedUsers();
            if (section === 'reminders') {
                // Import is already at top of main.js
                window.loadAdminReminders();
                window.initReminderForm();
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

        return `
            <tr class="bug-row" onclick="viewBugDetail('${bug.id}')">
                <td><strong>${bug.user}</strong></td>
                <td>
                    <div style="font-weight: 600;">${bug.subject}</div>
                    <div class="text-truncate-2" style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">${bug.description}</div>
                </td>
                <td><small>${date}</small></td>
                <td><span class="bug-status ${statusClass}">${statusLabel}</span></td>
                <td>
                    <div style="display: flex; gap: 0.5rem;" onclick="event.stopPropagation()">
                        <button class="btn-bug-action ${isResolved ? 'btn-bug-reopen' : 'btn-bug-solve'}" 
                                onclick="toggleBugStatus('${bug.id}', '${bug.status}')">
                            ${isResolved ? 'Réouvrir' : 'Résoudre'}
                        </button>
                        <button class="btn-delete" style="padding: 0.4rem 0.6rem;" onclick="deleteBug('${bug.id}')">🗑️</button>
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
// BADGES ADMIN MANAGEMENT
// ============================================

let currentEditingBadgeId = null;

export async function loadBadgesAdmin() {
    if (!state.isAdmin) return;

    try {
        const badges = await getAllBadgeDefinitions();
        renderBadgesAdmin(badges);
        initBadgeAdminListeners();
    } catch (error) {
        console.error("Error loading badges:", error);
        notyf.error("Erreur de chargement des badges.");
    }
}

function renderBadgesAdmin(badges) {
    const tbody = document.getElementById('badges-table-body');
    if (!tbody) return;

    if (badges.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Aucun badge créé. Cliquez sur "Initialiser les badges par défaut" pour commencer.</td></tr>';
        return;
    }

    tbody.innerHTML = badges.map(badge => {
        const categoryLabel = {
            'progression': 'Progression',
            'excellence': 'Excellence',
            'special': 'Spécial'
        }[badge.category] || badge.category;

        const requirementLabel = formatRequirement(badge.requirement);

        return `
            <tr>
                <td style="width: 60px; text-align: center;">
                    ${badge.icon && badge.icon.includes('/')
                ? `<img src="${badge.icon}" alt="${badge.name}" style="width: 40px; height: 40px; object-fit: contain; display: block; margin: 0 auto;">`
                : `<span style="font-size: 2rem; display: block;">${badge.icon || '🏆'}</span>`}
                </td>
                <td><strong>${badge.name}</strong></td>
                <td style="max-width: 200px; color: var(--text-secondary);">${badge.description || '-'}</td>
                <td><span class="badge-category-tag category-${badge.category}">${categoryLabel}</span></td>
                <td><code style="font-size: 0.8rem;">${requirementLabel}</code></td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn-edit-badge" data-badge-id="${badge.id}" title="Modifier">✏️</button>
                        <button class="btn-delete-badge" data-badge-id="${badge.id}" title="Supprimer">🗑️</button>
                    </div>
                </td>
            </tr>`;
    }).join('');

    // Add event listeners
    requestAnimationFrame(() => {
        tbody.querySelectorAll('.btn-edit-badge').forEach(btn => {
            btn.addEventListener('click', function () {
                const badgeId = this.dataset.badgeId;
                const badge = badges.find(b => b.id === badgeId);
                openBadgeEditor(badge);
            });
        });

        tbody.querySelectorAll('.btn-delete-badge').forEach(btn => {
            btn.addEventListener('click', async function () {
                const badgeId = this.dataset.badgeId;
                if (confirm('Supprimer ce badge ?')) {
                    try {
                        await deleteBadge(badgeId);
                        notyf.success('Badge supprimé');
                        loadBadgesAdmin();
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

function initBadgeAdminListeners() {
    // Seed badges button
    const seedBtn = document.getElementById('seed-badges-btn');
    if (seedBtn && !seedBtn._listenerAdded) {
        seedBtn._listenerAdded = true;
        seedBtn.addEventListener('click', async () => {
            try {
                const result = await seedDefaultBadges();
                notyf.success(result.message);
                loadBadgesAdmin();
            } catch (error) {
                notyf.error('Erreur lors de l\'initialisation');
            }
        });
    }

    // Cleanup duplicates button
    const cleanupBtn = document.getElementById('cleanup-badges-btn');
    if (cleanupBtn && !cleanupBtn._listenerAdded) {
        cleanupBtn._listenerAdded = true;
        cleanupBtn.addEventListener('click', async () => {
            if (!confirm('Voulez-vous supprimer les anciens badges en double ? (Cela ne supprimera que les versions avec des IDs aléatoires qui correspondent aux noms par défaut)')) return;
            try {
                const result = await cleanupDuplicateBadges();
                notyf.success(result.message);
                loadBadgesAdmin();
            } catch (error) {
                console.error('Cleanup error:', error);
                notyf.error('Erreur lors du nettoyage');
            }
        });
    }

    // Add badge button
    const addBtn = document.getElementById('add-badge-btn');
    if (addBtn && !addBtn._listenerAdded) {
        addBtn._listenerAdded = true;
        addBtn.addEventListener('click', () => openBadgeEditor(null));
    }

    // Requirement type change
    const reqTypeSelect = document.getElementById('badge-requirement-type');
    if (reqTypeSelect && !reqTypeSelect._listenerAdded) {
        reqTypeSelect._listenerAdded = true;
        reqTypeSelect.addEventListener('change', function () {
            const valueGroup = document.getElementById('badge-requirement-value-group');
            const loyaltyGroup = document.getElementById('badge-requirement-loyalty-group');

            const typesWithValue = ['quiz_count', 'perfect_count', 'streak', 'perfect_unique_count', 'perfect_streak', 'favorite_count', 'speed_perfect', 'sunday_warrior'];

            valueGroup.style.display = typesWithValue.includes(this.value) ? 'block' : 'none';
            loyaltyGroup.style.display = this.value === 'loyalty' ? 'block' : 'none';
        });
    }

    // Badge form submit
    const form = document.getElementById('badge-form');
    if (form && !form._listenerAdded) {
        form._listenerAdded = true;
        form.addEventListener('submit', handleBadgeFormSubmit);
    }

    // Cancel button
    const cancelBtn = document.getElementById('cancel-badge-btn');
    if (cancelBtn && !cancelBtn._listenerAdded) {
        cancelBtn._listenerAdded = true;
        cancelBtn.addEventListener('click', closeBadgeEditor);
    }
}

function openBadgeEditor(badge = null) {
    const modal = document.getElementById('badge-editor-modal');
    const title = document.getElementById('badge-modal-title');
    const form = document.getElementById('badge-form');

    currentEditingBadgeId = badge ? badge.id : null;
    title.textContent = badge ? 'Modifier le Badge' : 'Nouveau Badge';
    form.reset();

    if (badge) {
        document.getElementById('badge-id').value = badge.id;
        document.getElementById('badge-name').value = badge.name || '';
        document.getElementById('badge-icon').value = badge.icon || '';
        document.getElementById('badge-description').value = badge.description || '';
        document.getElementById('badge-category').value = badge.category || 'progression';
        document.getElementById('badge-secret').checked = !!badge.secret;
        document.getElementById('badge-hint').value = badge.hint || '';

        if (badge.requirement) {
            const type = badge.requirement.type || 'first_quiz';
            document.getElementById('badge-requirement-type').value = type;

            if (badge.requirement.value !== undefined) {
                document.getElementById('badge-requirement-value').value = badge.requirement.value;
            }
            if (type === 'loyalty') {
                document.getElementById('badge-requirement-days').value = badge.requirement.days || 30;
                document.getElementById('badge-requirement-quizzes').value = badge.requirement.quizzes || 10;
            }
        }
    }

    // Show/hide fields based on requirement type
    const reqType = document.getElementById('badge-requirement-type').value;
    const typesWithValue = ['quiz_count', 'perfect_count', 'streak', 'perfect_unique_count', 'perfect_streak', 'favorite_count', 'speed_perfect', 'sunday_warrior'];

    document.getElementById('badge-requirement-value-group').style.display = typesWithValue.includes(reqType) ? 'block' : 'none';
    document.getElementById('badge-requirement-loyalty-group').style.display = reqType === 'loyalty' ? 'block' : 'none';

    modal.style.display = 'flex';
}

function closeBadgeEditor() {
    const modal = document.getElementById('badge-editor-modal');
    if (modal) modal.style.display = 'none';
    currentEditingBadgeId = null;
}

async function handleBadgeFormSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('badge-name').value.trim();
    const icon = document.getElementById('badge-icon').value.trim() || '🏆';
    const description = document.getElementById('badge-description').value.trim();
    const category = document.getElementById('badge-category').value;
    const secret = document.getElementById('badge-secret').checked;
    const hint = document.getElementById('badge-hint').value.trim();
    const requirementType = document.getElementById('badge-requirement-type').value;

    const requirement = { type: requirementType };
    const typesWithValue = ['quiz_count', 'perfect_count', 'streak', 'perfect_unique_count', 'perfect_streak', 'favorite_count', 'speed_perfect', 'sunday_warrior'];

    if (typesWithValue.includes(requirementType)) {
        requirement.value = parseInt(document.getElementById('badge-requirement-value').value) || 1;
    } else if (requirementType === 'loyalty') {
        requirement.days = parseInt(document.getElementById('badge-requirement-days').value) || 30;
        requirement.quizzes = parseInt(document.getElementById('badge-requirement-quizzes').value) || 10;
    }

    const badgeData = {
        name,
        icon,
        description,
        category,
        secret,
        hint,
        requirement
    };

    try {
        if (currentEditingBadgeId) {
            await updateBadge(currentEditingBadgeId, badgeData);
            notyf.success('Badge mis à jour');
        } else {
            await createBadge(badgeData);
            notyf.success('Badge créé');
        }
        closeBadgeEditor();
        loadBadgesAdmin();
    } catch (error) {
        console.error("Error saving badge:", error);
        notyf.error("Erreur d'enregistrement");
    }
}

window.loadBadgesAdmin = loadBadgesAdmin;
