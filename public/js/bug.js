import { auth, bugsCollection } from './firebase.js';
import { addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { notyf } from './ui.js';

export function initBugSystem() {
    const fab = document.getElementById('bug-fab');
    const modal = document.getElementById('bug-modal');
    const closeBtn = document.getElementById('close-bug-modal');
    const form = document.getElementById('bug-form');
    const userField = document.getElementById('bug-user');

    if (!fab || !modal) return;

    fab.addEventListener('click', () => {
        if (auth.currentUser) {
            userField.value = auth.currentUser.displayName || auth.currentUser.email;
        } else {
            userField.value = 'Utilisateur non connecté';
        }
        modal.style.display = 'flex';
    });

    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        form.reset();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
            user: userField.value,
            subject: document.getElementById('bug-subject').value,
            description: document.getElementById('bug-description').value,
            createdAt: serverTimestamp(),
            status: 'new'
        };

        try {
            await addDoc(bugsCollection, data);
            notyf.success('Signalement envoyé ! Merci 🙏');
            modal.style.display = 'none';
            form.reset();
        } catch (error) {
            console.error("Bug report error:", error);
            notyf.error("Erreur lors de l'envoi du signalement.");
        }
    });

    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            form.reset();
        }
    });
}
