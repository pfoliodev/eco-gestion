import { app } from './firebase-config.js';
import { getFirestore, collection, getDocs, doc, addDoc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";

const db = getFirestore(app);
const coursesCollection = collection(db, 'courses');
let courses = []; // This will be populated from Firestore

const notyf = new Notyf({
    duration: 3000,
    position: {
        x: 'right',
        y: 'top',
    },
    types: [
        {
            type: 'success',
            background: '#28a745',
            icon: false
        },
        {
            type: 'error',
            background: '#dc3545',
            duration: 5000,
            icon: false
        }
    ]
});

let currentCourseId = null;
let quill = null;



function showPage(pageId) {

    const pages = document.querySelectorAll('.page');

    pages.forEach(page => page.classList.remove('active'));

    

    const targetPage = document.getElementById(pageId);

    if (targetPage) {

        targetPage.classList.add('active');

    }

    

    if (pageId === 'cours') {

        renderCourses();

        updateFilters();

    }

}

function renderCourses() {
    const grid = document.getElementById('course-grid');
    const searchTerm = document.getElementById('course-search').value.toLowerCase();
    const subjectFilter = document.getElementById('course-filter').value;
    
    let filteredCourses = courses.filter(course => {
        const matchesSearch = course.title.toLowerCase().includes(searchTerm) || 
                             course.subject.toLowerCase().includes(searchTerm) ||
                             course.description.toLowerCase().includes(searchTerm);
        const matchesSubject = !subjectFilter || course.subject === subjectFilter;
        return matchesSearch && matchesSubject;
    });
    
    grid.innerHTML = filteredCourses.map(course => `
        <div class="course-card" data-course-id="${course.id}">
            <h3>${course.title}</h3>
            <span class="course-subject-tag">${course.subject}</span>
            <p>${course.description}</p>
            <div class="course-card-actions">
                <button class="btn-view" onclick="viewCourse(${course.id})">Voir le cours</button>
            </div>
        </div>
    `).join('');
    
    // Mettre à jour les statistiques
    document.querySelectorAll('.stat-card h3')[0].textContent = courses.length;
    document.querySelectorAll('.stat-card h3')[1].textContent = courses.reduce((sum, course) => 
        sum + (course.content.match(/<h3>/g) || []).length, 0
    );
}

function updateFilters() {
    const subjects = [...new Set(courses.map(course => course.subject))];
    const filter = document.getElementById('course-filter');
    filter.innerHTML = '<option value="">Tous les sujets</option>' + 
        subjects.map(subject => `<option value="${subject}">${subject}</option>`).join('');
}

function viewCourse(id) {
    const course = courses.find(c => c.id === id);
    if (course) {
        currentCourseId = id;
        document.getElementById('course-content').innerHTML = `
            <h2>${course.title}</h2>
            <span class="course-subject-tag">${course.subject}</span>
            ${course.content}
        `;
        showPage('course-detail');
    }
}

function editCourse() {
    const course = courses.find(c => c.id === currentCourseId);
    if (course) {
        document.getElementById('form-title').textContent = 'Modifier le cours';
        document.getElementById('course-id').value = course.id;
        document.getElementById('course-title').value = course.title;
        document.getElementById('course-subject').value = course.subject;
        document.getElementById('course-description').value = course.description;
        quill.root.innerHTML = course.content;
        
        showPage('ajouter');
    }
}

function deleteCourse() {
    const modal = document.getElementById('delete-modal');
    modal.style.display = 'flex';

    const confirmBtn = document.getElementById('confirm-delete');
    const cancelBtn = document.getElementById('cancel-delete');

    const handleConfirm = async () => {
        try {
            await deleteDoc(doc(db, 'courses', currentCourseId));
            courses = courses.filter(c => c.id !== currentCourseId);
            notyf.success('Cours supprimé avec succès');
            backToCourses();
        } catch (error) {
            console.error("Error deleting course: ", error);
            notyf.error("Erreur lors de la suppression du cours.");
        } finally {
            modal.style.display = 'none';
        }
    };

    const handleCancel = () => {
        modal.style.display = 'none';
    };

    confirmBtn.addEventListener('click', handleConfirm, { once: true });
    cancelBtn.addEventListener('click', handleCancel, { once: true });
}

function cancelForm() {
    document.getElementById('course-form').reset();
    currentCourseId = null;
    showPage('cours');
}

async function loadCourses() {
    try {
        const querySnapshot = await getDocs(coursesCollection);
        courses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCourses();
        updateFilters();
    } catch (error) {
        console.error("Error loading courses: ", error);
        notyf.error("Erreur de chargement des cours.");
    }
}

function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-menu a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const href = link.getAttribute('href');
            if (href === '#accueil') showPage('accueil');
            else if (href === '#cours') showPage('cours');
            else if (href === '#ajouter') {
                document.getElementById('form-title').textContent = 'Ajouter un nouveau cours';
                document.getElementById('course-form').reset();
                document.getElementById('course-id').value = '';
                showPage('ajouter');
            }
        });
    });
    
    // Gérer la recherche et le filtrage
    document.getElementById('course-search').addEventListener('input', renderCourses);
    document.getElementById('course-filter').addEventListener('change', renderCourses);
}

function initForm() {
    const form = document.getElementById('course-form');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const courseId = document.getElementById('course-id').value;
        const courseData = {
            title: document.getElementById('course-title').value,
            subject: document.getElementById('course-subject').value,
            description: document.getElementById('course-description').value,
            content: quill.root.innerHTML
        };

        try {
            if (courseId) {
                // Modification
                const courseRef = doc(db, 'courses', courseId);
                await updateDoc(courseRef, courseData);
                const index = courses.findIndex(c => c.id === courseId);
                if (index !== -1) {
                    courses[index] = { id: courseId, ...courseData };
                }
                notyf.success('Cours modifié avec succès!');
            } else {
                // Création
                const docRef = await addDoc(coursesCollection, courseData);
                const newCourse = { id: docRef.id, ...courseData };
                courses.push(newCourse);
                notyf.success('Cours ajouté avec succès!');
            }
            
            form.reset();
            quill.root.innerHTML = '';
            currentCourseId = null;
            showPage('cours');
        } catch (error) {
            console.error("Error saving course: ", error);
            notyf.error("Erreur lors de l'enregistrement du cours.");
        }
    });
}

function initQuillEditor() {
    quill = new Quill('#editor-container', {
        theme: 'snow',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['link'],
                ['clean']
            ]
        }
    });
}

function backToCourses() {
    currentCourseId = null;
    showPage('cours');
}

function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;
    const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-sun"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12"x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
    const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-moon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

    let isDarkMode = localStorage.getItem('theme') === 'dark';

    const applyTheme = () => {
        if (isDarkMode) {
            body.classList.add('dark-mode');
            themeToggle.innerHTML = sunIcon;
        } else {
            body.classList.remove('dark-mode');
            themeToggle.innerHTML = moonIcon;
        }
    };

    themeToggle.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        applyTheme();
    });

    applyTheme();
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initQuillEditor();
    initForm();
    initNavigation();
    loadCourses(); // This will now fetch from Firestore and then render
    showPage('accueil');
});