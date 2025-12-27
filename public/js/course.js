import { db, coursesCollection } from './firebase.js';
import { getDocs, doc, deleteDoc, updateDoc, addDoc } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { courses, setCourses, isAdmin, currentCourseId, setCurrentCourseId } from './state.js';
import { notyf, showPage } from './ui.js';

export async function loadCourses() {
    try {
        const querySnapshot = await getDocs(coursesCollection);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCourses(data);
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

    let filteredCourses = courses.filter(course => {
        const matchesSearch = course.title.toLowerCase().includes(searchTerm) ||
            course.subject.toLowerCase().includes(searchTerm) ||
            course.description.toLowerCase().includes(searchTerm);
        const matchesSubject = !subjectFilter || course.subject === subjectFilter;
        return matchesSearch && matchesSubject;
    });

    grid.innerHTML = filteredCourses.map(course => {
        const type = course.type || 'cours';
        const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);

        return `
        <div class="course-card" data-course-id="${course.id}">
            <h3>${course.title}</h3>
            <div style="margin-bottom: 0.75rem;">
                <div style="margin-bottom: 0.5rem;">
                    <span class="course-subject-tag">${course.subject}</span>
                    <span class="course-type-tag type-${type}">${typeLabel}</span>
                </div>
                ${course.category ? `<div style="font-size: 0.85rem; color: #64748b;"><strong style="color: #4f46e5;">Catégorie :</strong> ${course.category}</div>` : ''}
            </div>
            <p>${course.description}</p>
            <div class="course-card-actions">
                <button class="btn-view" data-id="${course.id}">Voir le cours</button>
            </div>
        </div>
    `}).join('');

    // Update stats
    const numCourses = courses.filter(c => c.type === 'cours' || !c.type).length;
    const numExercises = courses.filter(c => c.type === 'exercice').length;
    const statCourses = document.getElementById('stat-courses');
    const statExercises = document.getElementById('stat-exercises');
    if (statCourses) statCourses.textContent = numCourses;
    if (statExercises) statExercises.textContent = numExercises;
}

export function updateFilters() {
    const filter = document.getElementById('course-filter');
    if (!filter) return;
    const subjects = [...new Set(courses.map(course => course.subject))];
    filter.innerHTML = '<option value="">Tous les sujets</option>' +
        subjects.map(subject => `<option value="${subject}">${subject}</option>`).join('');
}

export function viewCourse(id) {
    const course = courses.find(c => c.id === id);
    if (course) {
        setCurrentCourseId(id);
        const type = course.type || 'cours';
        const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);

        document.getElementById('course-content').innerHTML = `
            <h2>${course.title}</h2>
            <div>
                <span class="course-subject-tag">${course.subject}</span>
                <span class="course-type-tag type-${type}">${typeLabel}</span>
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
    const currentCourse = courses.find(c => c.id === currentId);

    let related = [];
    let title = 'Cours du même sujet';

    if (currentCourse?.type === 'exercice') {
        title = 'Cours associés';
        related = courses.filter(c => (c.type === 'cours' || !c.type) && c.linkedExercises?.includes(currentId));
        if (related.length === 0) {
            related = courses.filter(c => (c.type === 'cours' || !c.type) && c.subject === subject && c.id !== currentId);
        }
    } else {
        related = courses.filter(c => (c.type === 'cours' || !c.type) && c.subject === subject && c.id !== currentId);
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

    const currentCourse = courses.find(c => c.id === currentId);
    if (!currentCourse || currentCourse.type === 'exercice') {
        sec.style.display = 'none';
        checkSidebarVisibility();
        return;
    }

    const linkedIds = currentCourse.linkedExercises || [];
    const related = courses.filter(c => linkedIds.includes(c.id));

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
            await deleteDoc(doc(db, 'courses', currentCourseId));
            setCourses(courses.filter(c => c.id !== currentCourseId));
            notyf.success('Cours supprimé avec succès');
            setCurrentCourseId(null);
            showPage('cours');
        } catch (error) {
            notyf.error("Erreur lors de la suppression.");
        } finally {
            modal.style.display = 'none';
        }
    };
    confirmBtn.onclick = handleConfirm;
    cancelBtn.onclick = () => modal.style.display = 'none';
}

export function editCourse() {
    const course = courses.find(c => c.id === currentCourseId);
    if (course) {
        document.getElementById('form-title').textContent = 'Modifier le cours';
        document.getElementById('course-id').value = course.id;
        document.getElementById('course-title').value = course.title;
        document.getElementById('course-subject').value = course.subject;
        document.getElementById('course-type').value = course.type || 'cours';
        document.getElementById('course-category').value = course.category || '';
        document.getElementById('course-description').value = course.description;
        tinymce.get('editor-container').setContent(course.content);
        showPage('ajouter');
    }
}

export function initForm() {
    const form = document.getElementById('course-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!isAdmin) {
            notyf.error("Permissions insuffisantes.");
            return;
        }

        const courseId = document.getElementById('course-id').value;
        const data = {
            title: document.getElementById('course-title').value,
            subject: document.getElementById('course-subject').value,
            type: document.getElementById('course-type').value,
            category: document.getElementById('course-category').value,
            description: document.getElementById('course-description').value,
            content: tinymce.get('editor-container').getContent()
        };

        try {
            if (courseId) {
                await updateDoc(doc(db, 'courses', courseId), data);
                const updated = courses.map(c => c.id === courseId ? { id: courseId, ...data } : c);
                setCourses(updated);
                notyf.success('Modifié !');
            } else {
                const docRef = await addDoc(coursesCollection, data);
                courses.push({ id: docRef.id, ...data });
                notyf.success('Ajouté !');
            }
            form.reset();
            tinymce.get('editor-container').setContent('');
            showPage('cours');
        } catch (error) {
            notyf.error("Erreur d'enregistrement.");
        }
    });
}
