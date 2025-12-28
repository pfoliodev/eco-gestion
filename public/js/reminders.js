// Evaluation Reminders Management
import { db, auth } from './firebase.js';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { notyf } from './ui.js';
import { state } from './state.js';

const remindersCollection = collection(db, 'reminders');

// Load reminders for homepage
export async function loadReminders() {
    try {
        const q = query(remindersCollection, orderBy('date', 'asc'));
        const snap = await getDocs(q);
        const reminders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Filter future reminders only
        const now = new Date();
        const futureReminders = reminders.filter(reminder => {
            const reminderDate = reminder.date.toDate();
            return reminderDate >= now;
        });

        renderReminders(futureReminders);
    } catch (error) {
        console.error("Error loading reminders:", error);
    }
}

// Render reminders on homepage
export function renderReminders(reminders) {
    const container = document.getElementById('reminders-list');
    if (!container) return;

    if (reminders.length === 0) {
        const section = document.querySelector('.reminders-section');
        if (section) section.style.display = 'none';
        return;
    }

    const section = document.querySelector('.reminders-section');
    if (section) section.style.display = 'block';

    container.innerHTML = reminders.map(reminder => {
        const daysUntil = calculateDaysUntil(reminder.date.toDate());
        const urgencyClass = getUrgencyClass(daysUntil);
        const dateFormatted = reminder.date.toDate().toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        return `
            <div class="reminder-card ${urgencyClass}">
                <div class="reminder-header">
                    <h4 class="reminder-title">${reminder.title}</h4>
                    <span class="reminder-countdown">${formatCountdown(daysUntil)}</span>
                </div>
                <p class="reminder-date">📅 ${dateFormatted}</p>
                <p class="reminder-description">${reminder.description || ''}</p>
            </div>`;
    }).join('');
}

// Calculate days until evaluation
function calculateDaysUntil(date) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const evalDate = new Date(date);
    evalDate.setHours(0, 0, 0, 0);
    const diffTime = evalDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

// Format countdown text
function formatCountdown(days) {
    if (days === 0) return "Aujourd'hui !";
    if (days === 1) return "Demain";
    if (days < 0) return "Passée";
    return `Dans ${days} jours`;
}

// Get urgency class based on days
function getUrgencyClass(days) {
    if (days <= 3) return 'urgent';
    if (days <= 7) return 'warning';
    return 'normal';
}

// Admin: Load reminders
export async function loadAdminReminders() {
    if (!state.isAdmin) return;

    try {
        const q = query(remindersCollection, orderBy('date', 'asc'));
        const snap = await getDocs(q);
        const reminders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        renderAdminReminders(reminders);
    } catch (error) {
        console.error("Error loading admin reminders:", error);
        notyf.error("Erreur de chargement des rappels.");
    }
}

// Render admin reminders list
export function renderAdminReminders(reminders) {
    const tbody = document.getElementById('reminders-table-body');
    if (!tbody) return;

    if (reminders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem;">Aucun rappel créé.</td></tr>';
        return;
    }

    tbody.innerHTML = reminders.map(reminder => {
        const dateFormatted = reminder.date.toDate().toLocaleDateString('fr-FR');
        const daysUntil = calculateDaysUntil(reminder.date.toDate());

        return `
            <tr>
                <td><strong>${reminder.title}</strong></td>
                <td>${dateFormatted}</td>
                <td>${formatCountdown(daysUntil)}</td>
                <td class="reminder-actions">
                    <button class="btn-icon-action btn-edit btn-edit-reminder" data-id="${reminder.id}" title="Modifier">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn-icon-action btn-delete btn-delete-reminder" data-id="${reminder.id}" title="Supprimer">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                </td>
            </tr>`;
    }).join('');

    // Add event listeners
    requestAnimationFrame(() => {
        tbody.querySelectorAll('.btn-edit-reminder').forEach(btn => {
            btn.addEventListener('click', function () {
                const reminderId = this.dataset.id;
                const reminder = reminders.find(r => r.id === reminderId);
                if (reminder) editReminder(reminder);
            });
        });

        tbody.querySelectorAll('.btn-delete-reminder').forEach(btn => {
            btn.addEventListener('click', function () {
                const reminderId = this.dataset.id;
                deleteReminder(reminderId);
            });
        });
    });
}

// Create reminder
export async function createReminder(data) {
    if (!state.isAdmin) {
        notyf.error("Action non autorisée.");
        return;
    }

    try {
        await addDoc(remindersCollection, {
            title: data.title,
            date: Timestamp.fromDate(new Date(data.date)),
            description: data.description,
            createdAt: serverTimestamp(),
            createdBy: auth.currentUser.uid
        });

        notyf.success('Rappel créé avec succès !');
        loadAdminReminders();
        loadReminders(); // Refresh homepage

        // Reset form
        document.getElementById('reminder-form').reset();
    } catch (error) {
        console.error("Error creating reminder:", error);
        notyf.error("Erreur lors de la création du rappel.");
    }
}

// Edit reminder
function editReminder(reminder) {
    // Fill form with reminder data
    document.getElementById('reminder-title').value = reminder.title;
    document.getElementById('reminder-date').value = reminder.date.toDate().toISOString().split('T')[0];
    document.getElementById('reminder-description').value = reminder.description || '';

    // Change form to edit mode
    const form = document.getElementById('reminder-form');
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Mettre à jour';
    submitBtn.dataset.editId = reminder.id;

    // Scroll to form
    form.scrollIntoView({ behavior: 'smooth' });
}

// Update reminder
export async function updateReminder(id, data) {
    if (!state.isAdmin) {
        notyf.error("Action non autorisée.");
        return;
    }

    try {
        await updateDoc(doc(db, 'reminders', id), {
            title: data.title,
            date: Timestamp.fromDate(new Date(data.date)),
            description: data.description
        });

        notyf.success('Rappel mis à jour avec succès !');
        loadAdminReminders();
        loadReminders(); // Refresh homepage

        // Reset form
        const form = document.getElementById('reminder-form');
        form.reset();
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Créer le rappel';
        delete submitBtn.dataset.editId;
    } catch (error) {
        console.error("Error updating reminder:", error);
        notyf.error("Erreur lors de la mise à jour du rappel.");
    }
}

// Delete reminder
export async function deleteReminder(id) {
    if (!state.isAdmin) {
        notyf.error("Action non autorisée.");
        return;
    }

    if (!confirm("Êtes-vous sûr de vouloir supprimer ce rappel ?")) {
        return;
    }

    try {
        await deleteDoc(doc(db, 'reminders', id));
        notyf.success('Rappel supprimé avec succès !');
        loadAdminReminders();
        loadReminders(); // Refresh homepage
    } catch (error) {
        console.error("Error deleting reminder:", error);
        notyf.error("Erreur lors de la suppression du rappel.");
    }
}

// Initialize reminder form
export function initReminderForm() {
    const form = document.getElementById('reminder-form');
    if (!form) return;

    // Prevent multiple event listeners
    if (form.dataset.initialized === 'true') return;
    form.dataset.initialized = 'true';

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('reminder-title').value.trim();
        const date = document.getElementById('reminder-date').value;
        const description = document.getElementById('reminder-description').value.trim();

        if (!title || !date) {
            notyf.error("Veuillez remplir tous les champs obligatoires.");
            return;
        }

        const data = { title, date, description };
        const submitBtn = form.querySelector('button[type="submit"]');

        if (submitBtn.dataset.editId) {
            // Update mode
            await updateReminder(submitBtn.dataset.editId, data);
        } else {
            // Create mode
            await createReminder(data);
        }
    });
}

// Export for global access
window.loadReminders = loadReminders;
window.loadAdminReminders = loadAdminReminders;
window.initReminderForm = initReminderForm;
