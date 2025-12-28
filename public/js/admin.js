import { db, usersCollection, bugsCollection, coursesCollection } from './firebase.js';
import { getDocs, doc, updateDoc, deleteDoc, query, orderBy, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { state } from './state.js';
import { auth } from './firebase.js';
import { notyf } from './ui.js';

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
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.admin-sidebar');

    // Sidebar navigation
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;

            // Update active link
            sidebarLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Update active section
            document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
            document.getElementById(`admin-section-${section}`).classList.add('active');

            // Load data for section
            if (section === 'courses') loadCourseManagement();
            if (section === 'bugs') loadBugs();
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
                <td><span class="bug-status ${statusClass}">${statusLabel}</span><br><small>${date}</small></td>
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
    const select = document.getElementById('select-course');
    if (!select) return;
    const clist = state.courses.filter(c => c.type === 'cours' || !c.type);
    select.innerHTML = '<option value="">-- Choisir un cours --</option>' + clist.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
    select.onchange = (e) => e.target.value ? displayCourseExercises(e.target.value) : document.getElementById('course-exercises-section').style.display = 'none';
}

export function displayCourseExercises(courseId) {
    const course = state.courses.find(c => c.id === courseId);
    const list = document.getElementById('available-exercises-list');
    const allEx = state.courses.filter(c => c.type === 'exercice');
    const linked = course?.linkedExercises || [];

    list.innerHTML = allEx.map(ex => `
        <label class="exercise-label">
            <input type="checkbox" class="exercise-checkbox" data-exercise-id="${ex.id}" ${linked.includes(ex.id) ? 'checked' : ''}>
            <div><strong>${ex.title}</strong><br><small>${ex.subject}</small></div>
        </label>`).join('') || '<p>Aucun exercice.</p>';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn-primary';
    saveBtn.style.width = '100%';
    saveBtn.textContent = 'Enregistrer';
    saveBtn.onclick = () => saveLinkedExercises(courseId);
    list.appendChild(saveBtn);
    document.getElementById('course-exercises-section').style.display = 'block';
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
