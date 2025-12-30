// Course Favorites Management
import { db, auth } from './firebase.js';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { notyf } from './ui.js';
import { state } from './state.js';

// Toggle favorite status for a course
export async function toggleFavorite(courseId) {
    if (!auth.currentUser) {
        notyf.error("Vous devez être connecté pour ajouter des favoris.");
        return;
    }

    try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
        const favorites = userData.favorites || [];

        if (favorites.includes(courseId)) {
            // Remove from favorites
            await updateDoc(userRef, {
                favorites: arrayRemove(courseId)
            });
            notyf.success('Retiré des favoris');
        } else {
            // Add to favorites
            await updateDoc(userRef, {
                favorites: arrayUnion(courseId)
            });
            notyf.success('Ajouté aux favoris ⭐');
        }

        // Update UI
        updateFavoriteButton(courseId);

        // Reload favorites if on account page
        if (window.location.hash === '#mon-compte') {
            loadUserFavorites();
        }
    } catch (error) {
        console.error("Error toggling favorite:", error);
        notyf.error("Erreur lors de la mise à jour des favoris.");
    }
}

// Check if a course is in favorites
export async function isFavorite(courseId) {
    if (!auth.currentUser) return false;

    try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        const favorites = userDoc.data()?.favorites || [];
        return favorites.includes(courseId);
    } catch (error) {
        console.error("Error checking favorite:", error);
        return false;
    }
}

// Update favorite button UI
async function updateFavoriteButton(courseId) {
    const btn = document.querySelector(`.btn-favorite[data-course-id="${courseId}"]`);
    if (!btn) return;

    const isFav = await isFavorite(courseId);
    if (isFav) {
        btn.classList.add('active');
        btn.setAttribute('title', 'Retirer des favoris');
    } else {
        btn.classList.remove('active');
        btn.setAttribute('title', 'Ajouter aux favoris');
    }
}

// Update all favorite buttons on the page
export async function updateAllFavoriteButtons() {
    if (!auth.currentUser) return;

    const buttons = document.querySelectorAll('.btn-favorite');
    for (const btn of buttons) {
        const courseId = btn.dataset.courseId;
        if (courseId) {
            const isFav = await isFavorite(courseId);
            if (isFav) {
                btn.classList.add('active');
                btn.setAttribute('title', 'Retirer des favoris');
            } else {
                btn.classList.remove('active');
                btn.setAttribute('title', 'Ajouter aux favoris');
            }
        }
    }
}

// Load user's favorite courses
export async function loadUserFavorites() {
    if (!auth.currentUser) return;

    try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        const favorites = userDoc.data()?.favorites || [];

        if (favorites.length === 0) {
            renderEmptyFavorites();
            return;
        }

        // Get favorite courses from state
        const favoriteCourses = state.courses.filter(course =>
            favorites.includes(course.id) && !course.archived
        );

        renderFavoriteCourses(favoriteCourses);
    } catch (error) {
        console.error("Error loading favorites:", error);
        notyf.error("Erreur lors du chargement des favoris.");
    }
}

// Render favorite courses in account page
function renderFavoriteCourses(courses) {
    const container = document.getElementById('favorites-list');
    if (!container) return;

    if (courses.length === 0) {
        renderEmptyFavorites();
        return;
    }

    container.innerHTML = courses.map(course => {
        const type = course.type || 'cours';
        const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);

        return `
            <div class="favorite-course-card">
                <div class="favorite-course-header">
                    <h4>${course.title}</h4>
                    <span class="course-type-tag type-${type}">${typeLabel}</span>
                </div>
                <p class="favorite-course-subject">${course.subject}</p>
                <div class="favorite-course-actions">
                    <button class="btn-primary" onclick="viewCourse('${course.id}')">
                        Consulter
                    </button>
                    <button class="btn-icon-action btn-delete" onclick="toggleFavorite('${course.id}')" title="Retirer des favoris">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                    </button>
                </div>
            </div>`;
    }).join('');
}

// Render empty state
function renderEmptyFavorites() {
    const container = document.getElementById('favorites-list');
    if (!container) return;

    container.innerHTML = `
        <div class="empty-favorites">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
            <h3>Aucun cours favori</h3>
            <p>Ajoutez des cours à vos favoris pour les retrouver facilement ici.</p>
            <a href="#cours" class="btn-primary">Parcourir les cours</a>
        </div>`;
}

// Export for global access
window.toggleFavorite = toggleFavorite;
