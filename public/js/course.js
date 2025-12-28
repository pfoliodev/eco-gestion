import { db, coursesCollection, auth } from './firebase.js';
import { getDocs, doc, deleteDoc, updateDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { state, setCourses, setCurrentCourseId } from './state.js';
import { notyf, showPage } from './ui.js';

export async function loadCourses() {
    try {
        const querySnapshot = await getDocs(coursesCollection);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Silent migration for legacy courses
        if (state.isAdmin) {
            data.forEach(async course => {
                if (!course.createdAt || !course.author) {
                    const updates = {};
                    if (!course.createdAt) updates.createdAt = serverTimestamp();
                    if (!course.author && auth.currentUser) updates.author = auth.currentUser.displayName || auth.currentUser.email.split('@')[0];

                    try {
                        await updateDoc(doc(db, 'courses', course.id), updates);
                        console.log(`Migrated course: ${course.id}`);
                    } catch (e) {
                        console.error("Migration error:", e);
                    }
                }
            });
        }

        // Filter out archived courses
        const activeCourses = data.filter(course => !course.archived);

        setCourses(activeCourses);
        renderCourses();
        updateFilters();
    } catch (error) {
        notyf.error("Erreur de chargement des cours.");
    }
}

export function renderCourses() {
    const grid = document.getElementById('course-grid');
    if (!grid) return;

    const searchTerm = document.getElementById('course-search')?.value.toLowerCase() || '';
    const subjectFilter = document.getElementById('course-filter')?.value || '';
    const typeFilter = document.getElementById('course-type-filter')?.value || '';

    let filteredCourses = state.courses.filter(course => {
        const matchesSearch = course.title.toLowerCase().includes(searchTerm) ||
            course.subject.toLowerCase().includes(searchTerm) ||
            course.description.toLowerCase().includes(searchTerm);
        const matchesSubject = !subjectFilter || course.subject === subjectFilter;
        // Handle 'cours' type which can be null/undefined in DB
        const currentType = course.type || 'cours';
        const matchesType = !typeFilter || currentType === typeFilter;

        return matchesSearch && matchesSubject && matchesType;
    });

    grid.innerHTML = filteredCourses.map(course => {
        const type = course.type || 'cours';
        const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
        const dateStr = course.createdAt ? new Date(course.createdAt.seconds * 1000).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR');

        return `
        <div class="course-card" data-course-id="${course.id}">
            <h3>${course.title}</h3>
            <div style="margin-bottom: 0.75rem;">
                <div style="margin-bottom: 0.5rem;">
                    <span class="course-subject-tag">${course.subject}</span>
                    <span class="course-type-tag type-${type}">${typeLabel}</span>
                </div>
                ${course.category ? `<div style="font-size: 0.85rem; color: #64748b;"><strong style="color: #4f46e5;">Catégorie :</strong> ${course.category}</div>` : ''}
                <div class="course-metadata">
                    <span>👤 ${course.author || 'Anonyme'}</span>
                    <span>📅 ${dateStr}</span>
                </div>
            </div>
            <p>${course.description}</p>
            <div class="course-card-actions">
                <button class="btn-view" data-id="${course.id}">Voir le cours</button>
            </div>
        </div>
    `}).join('');

    // Update stats
    const numCourses = state.courses.filter(c => c.type === 'cours' || !c.type).length;
    const numExercises = state.courses.filter(c => c.type === 'exercice').length;
    const statCourses = document.getElementById('stat-courses');
    const statExercises = document.getElementById('stat-exercises');
    if (statCourses) statCourses.textContent = numCourses;
    if (statExercises) statExercises.textContent = numExercises;

    // Load recent courses for homepage
    loadRecentCourses();
}

export function updateFilters() {
    const filter = document.getElementById('course-filter');
    if (!filter) return;
    const subjects = [...new Set(state.courses.map(course => course.subject))];
    filter.innerHTML = '<option value="">Tous les sujets</option>' +
        subjects.map(subject => `<option value="${subject}">${subject}</option>`).join('');
}

export function viewCourse(id) {
    const course = state.courses.find(c => c.id === id);
    if (course) {
        setCurrentCourseId(id);
        const type = course.type || 'cours';
        const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);

        const dateStr = course.createdAt ? new Date(course.createdAt.seconds * 1000).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR');

        document.getElementById('course-content').innerHTML = `
            <h2>${course.title}</h2>
            <div style="margin-bottom: 1.5rem;">
                <span class="course-subject-tag">${course.subject}</span>
                <span class="course-type-tag type-${type}">${typeLabel}</span>
                <div class="course-metadata" style="margin-top: 0.75rem; font-size: 0.9rem;">
                    <span>👤 <strong>Auteur :</strong> ${course.author || 'Anonyme'}</span>
                    <span>📅 <strong>Publié le :</strong> ${dateStr}</span>
                </div>
            </div>
            ${course.content}
        `;

        renderRelatedCourses(course.subject, id);
        renderRelatedExercises(course.subject, id);
        showPage('course-detail');
        window.scrollTo(0, 0);
    }
}

export function renderRelatedCourses(subject, currentId) {
    const list = document.getElementById('related-courses-list');
    if (!list) return;
    const section = list.closest('.sidebar-section');
    const currentCourse = state.courses.find(c => c.id === currentId);

    let related = [];
    let title = 'Cours du même sujet';

    if (currentCourse?.type === 'exercice') {
        title = 'Cours associés';
        related = state.courses.filter(c => (c.type === 'cours' || !c.type) && c.linkedExercises?.includes(currentId));
        if (related.length === 0) {
            related = state.courses.filter(c => (c.type === 'cours' || !c.type) && c.subject === subject && c.id !== currentId);
        }
    } else {
        related = state.courses.filter(c => (c.type === 'cours' || !c.type) && c.subject === subject && c.id !== currentId);
    }

    section.querySelector('h3').textContent = title;
    if (related.length === 0) {
        section.style.display = 'none';
        checkSidebarVisibility();
        return;
    }

    section.style.display = 'block';
    checkSidebarVisibility();
    list.innerHTML = related.map(c => `
        <div class="related-course-item" onclick="viewCourse('${c.id}')">
            <div class="related-course-title">${c.title}</div>
            <span class="related-course-type">${(c.type || 'cours').charAt(0).toUpperCase() + (c.type || 'cours').slice(1)}</span>
        </div>
    `).join('');
}

export function renderRelatedExercises(subject, currentId) {
    const list = document.getElementById('related-exercises-list');
    const sec = document.getElementById('exercises-sidebar-section');
    if (!list || !sec) return;

    const currentCourse = state.courses.find(c => c.id === currentId);
    if (!currentCourse || currentCourse.type === 'exercice') {
        sec.style.display = 'none';
        checkSidebarVisibility();
        return;
    }

    const linkedIds = currentCourse.linkedExercises || [];
    const related = state.courses.filter(c => linkedIds.includes(c.id));

    if (related.length === 0) {
        sec.style.display = 'none';
        checkSidebarVisibility();
        return;
    }

    sec.style.display = 'block';
    checkSidebarVisibility();
    list.innerHTML = related.map(ex => `
        <div class="related-course-item" onclick="viewCourse('${ex.id}')">
            <div class="related-course-title">${ex.title}</div>
            <span class="related-course-type">Exercice</span>
        </div>
    `).join('');
}

export function checkSidebarVisibility() {
    const sidebar = document.querySelector('.course-sidebar-left');
    const layout = document.querySelector('.course-detail-layout');
    if (!sidebar || !layout) return;
    const visibleSections = sidebar.querySelectorAll('.sidebar-section[style*="display: block"]');
    if (visibleSections.length === 0) {
        sidebar.style.display = 'none';
        layout.style.gridTemplateColumns = '1fr';
    } else {
        sidebar.style.display = 'flex';
        layout.style.gridTemplateColumns = '310px 1fr';
    }
}

export async function deleteCourse() {
    const modal = document.getElementById('delete-modal');
    modal.style.display = 'flex';

    const confirmBtn = document.getElementById('confirm-delete');
    const cancelBtn = document.getElementById('cancel-delete');

    const handleConfirm = async () => {
        try {
            // Archive the course instead of deleting it
            await updateDoc(doc(db, 'courses', state.currentCourseId), {
                archived: true,
                archivedAt: serverTimestamp()
            });

            // Remove from local state
            setCourses(state.courses.filter(c => c.id !== state.currentCourseId));
            notyf.success('Cours archivé avec succès');
            setCurrentCourseId(null);
            showPage('cours');
        } catch (error) {
            notyf.error("Erreur lors de l'archivage.");
        } finally {
            modal.style.display = 'none';
        }
    };
    confirmBtn.onclick = handleConfirm;
    cancelBtn.onclick = () => modal.style.display = 'none';
}

export function editCourse() {
    const course = state.courses.find(c => c.id === state.currentCourseId);
    if (course) {
        document.getElementById('form-title').textContent = 'Modifier le cours';
        document.getElementById('course-id').value = course.id;
        document.getElementById('course-title').value = course.title;
        document.getElementById('course-subject').value = course.subject;
        document.getElementById('course-author').value = course.author || '';
        document.getElementById('course-type').value = course.type || 'cours';
        document.getElementById('course-category').value = course.category || '';
        document.getElementById('course-description').value = course.description;

        const editor = tinymce.get('editor-container');
        if (editor) {
            editor.setContent(course.content);
        } else {
            document.getElementById('editor-container').value = course.content;
        }
        showPage('ajouter');
    }
}

export function initForm() {
    const form = document.getElementById('course-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!state.isAdmin) {
            notyf.error("Permissions insuffisantes.");
            return;
        }

        const courseId = document.getElementById('course-id').value;
        const editor = tinymce.get('editor-container');
        const content = editor ? editor.getContent() : document.getElementById('editor-container').value;

        const data = {
            title: document.getElementById('course-title').value,
            subject: document.getElementById('course-subject').value,
            author: document.getElementById('course-author').value,
            type: document.getElementById('course-type').value,
            category: document.getElementById('course-category').value,
            description: document.getElementById('course-description').value,
            content: content
        };

        try {
            if (courseId) {
                await updateDoc(doc(db, 'courses', courseId), data);
                const updated = state.courses.map(c => c.id === courseId ? { id: courseId, ...data } : c);
                setCourses(updated);
                notyf.success('Modifié !');
            } else {
                data.createdAt = serverTimestamp();
                const docRef = await addDoc(coursesCollection, data);
                // For local push, we can't use serverTimestamp directly as it's an object,
                // but loadCourses() will refresh it anyway.
                state.courses.push({ id: docRef.id, ...data, createdAt: { seconds: Math.floor(Date.now() / 1000) } });
                notyf.success('Ajouté !');
            }
            form.reset();
            if (editor) editor.setContent('');
            showPage('cours');
        } catch (error) {
            notyf.error("Erreur d'enregistrement.");
        }
    });
}

// Load recent courses for homepage
export function loadRecentCourses() {
    const container = document.getElementById('recent-courses-list');
    if (!container) return;

    // Get all courses and sort by creation date (most recent first)
    const recentCourses = [...state.courses]
        .filter(course => !course.archived)
        .sort((a, b) => {
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA;
        })
        .slice(0, 5); // Limit to 5 most recent

    if (recentCourses.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Aucun cours disponible pour le moment.</p>';
        return;
    }

    container.innerHTML = recentCourses.map(course => {
        const type = course.type || 'cours';
        const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
        // Try createdAt first, then updatedAt as fallback
        const timestamp = course.createdAt || course.updatedAt;
        const date = timestamp ?
            new Date(timestamp.seconds * 1000).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            }) :
            'Date inconnue';

        const author = course.author || 'Auteur inconnu';

        return `
            <div class="recent-course-item" data-id="${course.id}">
                <div class="recent-course-header">
                    <h4 class="recent-course-title">${course.title}</h4>
                    <span class="course-type-tag type-${type}">${typeLabel}</span>
                </div>
                <div class="recent-course-meta">
                    <span class="recent-course-subject">${course.subject}</span>
                    <div class="recent-course-info">
                        <span class="recent-course-author">✍️ ${author}</span>
                        <span class="recent-course-date">📅 ${date}</span>
                    </div>
                </div>
            </div>`;
    }).join('');

    // Add click handlers
    container.querySelectorAll('.recent-course-item').forEach(item => {
        item.addEventListener('click', () => {
            const courseId = item.dataset.id;
            viewCourse(courseId);
        });
    });
}
