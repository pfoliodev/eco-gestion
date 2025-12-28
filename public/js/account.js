import { auth, bugsCollection } from './firebase.js';
import { getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { state } from './state.js';
import { notyf } from './ui.js';

export async function loadAccount() {
    if (!auth.currentUser) return;

    const user = auth.currentUser;
    document.getElementById('user-display-email').textContent = user.email;
    document.getElementById('user-role-badge').textContent = state.isAdmin ? 'Administrateur' : 'Utilisateur';

    await loadUserBugs();
}

export async function loadUserBugs() {
    if (!auth.currentUser) return;

    const tbody = document.getElementById('user-bugs-table-body');
    if (!tbody) return;

    try {
        // Find bugs where userId matches OR if userId is missing, try fallback matching by email/name
        const q = query(
            bugsCollection,
            where('userId', '==', auth.currentUser.uid)
        );

        const snap = await getDocs(q);
        const bugs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Manual sort by date since we might not have a composite index for userId + createdAt yet
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
