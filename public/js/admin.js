import { db, usersCollection } from './firebase.js';
import { getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { isAdmin, courses } from './state.js';
import { auth } from './firebase.js';
import { notyf } from './ui.js';

export async function loadUsers() {
    if (!isAdmin) return;
    try {
        const snap = await getDocs(usersCollection);
        const users = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderUsers(users);
    } catch (error) {
        notyf.error("Erreur de chargement des utilisateurs.");
    }
}

export function renderUsers(users) {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem;">Aucun utilisateur trouvé.</td></tr>';
        return;
    }
    tbody.innerHTML = users.map(user => {
        const date = user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';
        const role = user.role || 'student';
        return `
            <tr>
                <td>${user.email || 'N/A'}</td>
                <td><span class="role-badge ${role}">${role === 'admin' ? 'Administrateur' : 'Étudiant'}</span></td>
                <td>${date}</td>
                <td>
                    <button class="btn-change-role" onclick="changeUserRole('${user.id}', '${role === 'admin' ? 'student' : 'admin'}')">
                        ${role === 'admin' ? 'Rétrograder' : 'Promouvoir'}
                    </button>
                </td>
            </tr>`;
    }).join('');
}

export async function changeUserRole(userId, newRole) {
    if (!isAdmin || userId === auth.currentUser.uid) {
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
window.changeUserRole = changeUserRole;

export function initAdminTabs() {
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            document.querySelectorAll('.admin-tab, .admin-tab-content').forEach(el => el.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`admin-${target}-tab`).classList.add('active');
            if (target === 'courses') loadCourseManagement();
        });
    });
}

export function loadCourseManagement() {
    const select = document.getElementById('select-course');
    if (!select) return;
    const clist = courses.filter(c => c.type === 'cours' || !c.type);
    select.innerHTML = '<option value="">-- Choisir un cours --</option>' + clist.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
    select.onchange = (e) => e.target.value ? displayCourseExercises(e.target.value) : document.getElementById('course-exercises-section').style.display = 'none';
}

export function displayCourseExercises(courseId) {
    const course = courses.find(c => c.id === courseId);
    const list = document.getElementById('available-exercises-list');
    const allEx = courses.filter(c => c.type === 'exercice');
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
        const idx = courses.findIndex(c => c.id === courseId);
        if (idx !== -1) courses[idx].linkedExercises = linked;
        notyf.success('Liaison enregistrée !');
    } catch (error) {
        notyf.error("Erreur d'enregistrement.");
    }
}
window.saveLinkedExercises = saveLinkedExercises;
