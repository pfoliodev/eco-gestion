import { app } from './firebase-config.js';
import { getFirestore, collection, getDocs, doc, addDoc, deleteDoc, updateDoc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js";

const db = getFirestore(app);
const auth = getAuth(app);
const coursesCollection = collection(db, 'courses');
const usersCollection = collection(db, 'users');
let courses = []; // This will be populated from Firestore
let isAdmin = false; // Track if current user is admin

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
// TinyMCE initialization
function initTinyMCE() {
    tinymce.init({
        selector: '#editor-container',
        height: 400,
        menubar: true,
        plugins: [
            'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
            'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
            'insertdatetime', 'media', 'table', 'help', 'wordcount'
        ],
        toolbar: 'undo redo | blocks | ' +
            'bold italic backcolor | alignleft aligncenter ' +
            'alignright alignjustify | bullist numlist outdent indent | ' +
            'removeformat | code | help',
        content_style: 'body { font-family:Inter,sans-serif; font-size:14px }',
        skin: 'oxide',
        content_css: 'default'
    });
}


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

        // Load related courses
        renderRelatedCourses(course.subject, id);

        showPage('course-detail');
    }
}

function renderRelatedCourses(subject, currentCourseId) {
    const relatedCoursesList = document.getElementById('related-courses-list');

    // Filter courses by same subject, excluding current course
    const relatedCourses = courses.filter(c =>
        c.subject === subject && c.id !== currentCourseId
    );

    if (relatedCourses.length === 0) {
        relatedCoursesList.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.875rem; text-align: center; padding: 1rem 0;">Aucun autre cours dans ce sujet.</p>';
        return;
    }

    relatedCoursesList.innerHTML = relatedCourses.map(course => {
        const type = course.type || 'cours';
        const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);

        return `
            <div class="related-course-item" onclick="viewCourse('${course.id}')">
                <div class="related-course-title">${course.title}</div>
                <span class="related-course-type">${typeLabel}</span>
            </div>
        `;
    }).join('');
}

// Make viewCourse available globally for onclick handlers
window.viewCourse = viewCourse;


function editCourse() {
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
                document.getElementById('course-type').value = 'cours';
                document.getElementById('course-category').value = '';
                showPage('ajouter');
            }
            else if (href === '#admin') {
                if (isAdmin) {
                    loadUsers();
                    showPage('admin');
                } else {
                    notyf.error("Accès non autorisé.");
                }
            }
            else if (href === '#login') showPage('login');
        });
    });
}

function initEventListeners() {
    // Search and filter
    document.getElementById('course-search').addEventListener('input', renderCourses);
    document.getElementById('course-filter').addEventListener('change', renderCourses);

    // Static buttons
    document.getElementById('add-course-btn').addEventListener('click', () => {
        document.getElementById('form-title').textContent = 'Ajouter un nouveau cours';
        document.getElementById('course-form').reset();
        document.getElementById('course-id').value = '';
        document.getElementById('course-type').value = 'cours';
        document.getElementById('course-category').value = '';
        if (tinymce.get('editor-container')) {
            tinymce.get('editor-container').setContent('');
        }
        showPage('ajouter');
    });
    document.getElementById('cancel-form-btn').addEventListener('click', cancelForm);
    document.getElementById('back-to-courses-btn').addEventListener('click', backToCourses);
    document.getElementById('edit-course-btn').addEventListener('click', editCourse);
    document.getElementById('delete-course-btn').addEventListener('click', deleteCourse);

    // Event delegation for dynamic buttons
    document.getElementById('course-grid').addEventListener('click', e => {
        if (e.target && e.target.classList.contains('btn-view')) {
            const courseId = e.target.dataset.id;
            viewCourse(courseId);
        }
    });
}

// Check user role from Firestore
async function getUserRole(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            return userDoc.data().role || 'student';
        } else {
            // Create default student role for new users
            await setDoc(doc(db, 'users', userId), {
                role: 'student',
                email: auth.currentUser.email,
                createdAt: new Date()
            });
            return 'student';
        }
    } catch (error) {
        console.error("Error getting user role:", error);
        return 'student'; // Default to student on error
    }
}

function initAuth() {
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');
    const loginNavLink = document.getElementById('login-nav-link');
    const adminActions = document.getElementById('admin-actions');
    const addCourseBtn = document.querySelector('.courses-header .btn-primary');
    const addCourseNavLink = document.querySelector('.nav-menu a[href="#ajouter"]');
    const adminNavLink = document.getElementById('admin-nav-link');

    onAuthStateChanged(auth, async user => {
        if (user) {
            // User is signed in - check their role
            const userRole = await getUserRole(user.uid);
            isAdmin = (userRole === 'admin');

            loginNavLink.style.display = 'none';
            logoutBtn.style.display = 'inline-flex';

            // Only show admin controls if user is admin
            if (isAdmin) {
                adminActions.style.display = 'flex';
                addCourseBtn.style.display = 'inline-flex';
                addCourseNavLink.style.display = 'inline-flex';
                adminNavLink.style.display = 'inline-flex';
            } else {
                adminActions.style.display = 'none';
                addCourseBtn.style.display = 'none';
                addCourseNavLink.style.display = 'none';
                adminNavLink.style.display = 'none';
            }
        } else {
            // User is signed out
            isAdmin = false;
            loginNavLink.style.display = 'inline-flex';
            logoutBtn.style.display = 'none';
            adminActions.style.display = 'none';
            addCourseBtn.style.display = 'none';
            addCourseNavLink.style.display = 'none';
            adminNavLink.style.display = 'none';
            if (document.querySelector('.page.active').id === 'ajouter') {
                showPage('cours');
            }
        }
    });

    loginForm.addEventListener('submit', async e => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            notyf.success('Connexion réussie !');
            showPage('cours');
        } catch (error) {
            console.error("Login error:", error);
            let errorMessage = 'Une erreur est survenue lors de la connexion.';

            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                errorMessage = 'Email ou mot de passe incorrect.';
            } else if (error.code === 'auth/operation-not-allowed') {
                errorMessage = 'La connexion par Email/Mot de passe n\'est pas activée dans Firebase.';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Trop de tentatives échouées. Veuillez réessayer plus tard.';
            }

            notyf.error(errorMessage);
        }
    });

    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            notyf.success('Déconnexion réussie.');
            showPage('accueil');
        } catch (error) {
            console.error("Logout error:", error);
            notyf.error('Erreur lors de la déconnexion.');
        }
    });

    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', async () => {
            const provider = new GoogleAuthProvider();
            try {
                await signInWithPopup(auth, provider);
                notyf.success('Connexion Google réussie !');
                showPage('cours');
            } catch (error) {
                console.error("Google Login error:", error);
                if (error.code === 'auth/popup-closed-by-user') {
                    notyf.error('La connexion a été annulée.');
                } else {
                    notyf.error('Erreur lors de la connexion Google.');
                }
            }
        });
    }
}

function initForm() {
    const form = document.getElementById('course-form');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!auth.currentUser) {
            notyf.error("Vous devez être connecté pour effectuer cette action.");
            return;
        }

        if (!isAdmin) {
            notyf.error("Vous n'avez pas les permissions pour effectuer cette action.");
            return;
        }

        const courseId = document.getElementById('course-id').value;
        const courseData = {
            title: document.getElementById('course-title').value,
            subject: document.getElementById('course-subject').value,
            type: document.getElementById('course-type').value,
            category: document.getElementById('course-category').value,
            description: document.getElementById('course-description').value,
            content: tinymce.get('editor-container').getContent()
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
            tinymce.get('editor-container').setContent('');
            document.getElementById('course-type').value = 'cours';
            currentCourseId = null;
            showPage('cours');
        } catch (error) {
            console.error("Error saving course: ", error);
            notyf.error("Erreur lors de l'enregistrement du cours.");
        }
    });
}

// Admin User Management Functions
async function loadUsers() {
    if (!isAdmin) {
        notyf.error("Accès non autorisé.");
        return;
    }

    try {
        const usersSnapshot = await getDocs(usersCollection);
        const users = usersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        renderUsers(users);
    } catch (error) {
        console.error("Error loading users:", error);
        notyf.error("Erreur lors du chargement des utilisateurs.");
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('users-table-body');

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-secondary);">Aucun utilisateur trouvé.</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => {
        const createdDate = user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString('fr-FR') : 'N/A';
        const currentRole = user.role || 'student';
        const newRole = currentRole === 'admin' ? 'student' : 'admin';
        const buttonText = currentRole === 'admin' ? 'Rétrograder en Étudiant' : 'Promouvoir en Admin';

        return `
            <tr>
                <td>${user.email || 'N/A'}</td>
                <td><span class="role-badge ${currentRole}">${currentRole === 'admin' ? 'Administrateur' : 'Étudiant'}</span></td>
                <td>${createdDate}</td>
                <td>
                    <button class="btn-change-role" onclick="changeUserRole('${user.id}', '${newRole}')">
                        ${buttonText}
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function changeUserRole(userId, newRole) {
    if (!isAdmin) {
        notyf.error("Accès non autorisé.");
        return;
    }

    // Prevent admin from changing their own role
    if (userId === auth.currentUser.uid) {
        notyf.error("Vous ne pouvez pas modifier votre propre rôle.");
        return;
    }

    try {
        await updateDoc(doc(db, 'users', userId), {
            role: newRole
        });
        notyf.success(`Rôle modifié avec succès en ${newRole === 'admin' ? 'Administrateur' : 'Étudiant'}.`);
        loadUsers(); // Reload the users table
    } catch (error) {
        console.error("Error changing user role:", error);
        notyf.error("Erreur lors de la modification du rôle.");
    }
}

// Make changeUserRole available globally
window.changeUserRole = changeUserRole;


function backToCourses() {
    currentCourseId = null;
    showPage('cours');
}


document.addEventListener('DOMContentLoaded', () => {
    initTinyMCE();
    initAuth();
    initForm();
    initNavigation();
    initEventListeners();
    loadCourses(); // This will now fetch from Firestore and then render
    showPage('accueil');
});