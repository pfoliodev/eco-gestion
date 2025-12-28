import { initTinyMCE, showPage, notyf } from './ui.js';
import { auth } from './firebase.js';
import { initAuth } from './auth.js';
import { initForm, loadCourses, renderCourses, updateFilters, viewCourse, editCourse, deleteCourse } from './course.js';
import { initAdminTabs, loadUsers } from './admin.js';
import { initBugSystem } from './bug.js';
import { loadAccount } from './account.js';
import { state } from './state.js';
import { loadMultipleTemplates } from './template-loader.js';

// Global exports for inline HTML handlers
window.viewCourse = viewCourse;

function initNavigation() {
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href^="#"]');
        if (link) {
            e.preventDefault();
            const href = link.getAttribute('href');

            if (href === '#accueil') showPage('accueil');
            else if (href === '#cours') showPage('cours');
            else if (href === '#ajouter') {
                document.getElementById('form-title').textContent = 'Nouveau cours';
                document.getElementById('course-form').reset();
                document.getElementById('course-id').value = '';
                if (auth.currentUser) {
                    document.getElementById('course-author').value = auth.currentUser.displayName || auth.currentUser.email.split('@')[0];
                }
                showPage('ajouter');
            }
            else if (href === '#admin') {
                if (state.isAdmin) { loadUsers(); showPage('admin'); }
                else notyf.error("Accès non autorisé.");
            }
            else if (href === '#login') showPage('login');
        }
    });
}

function initEventListeners() {
    document.getElementById('course-search')?.addEventListener('input', renderCourses);
    document.getElementById('course-filter')?.addEventListener('change', renderCourses);
    document.getElementById('course-type-filter')?.addEventListener('change', renderCourses);

    // Dashboard navigation
    document.getElementById('card-courses')?.addEventListener('click', () => {
        const typeFilter = document.getElementById('course-type-filter');
        if (typeFilter) typeFilter.value = 'cours';
        showPage('cours');
        renderCourses();
    });

    document.getElementById('card-exercises')?.addEventListener('click', () => {
        const typeFilter = document.getElementById('course-type-filter');
        if (typeFilter) typeFilter.value = 'exercice';
        showPage('cours');
        renderCourses();
    });

    document.getElementById('add-course-btn')?.addEventListener('click', () => {
        document.getElementById('form-title').textContent = 'Nouveau cours';
        document.getElementById('course-form').reset();
        document.getElementById('course-id').value = '';
        if (auth.currentUser) {
            document.getElementById('course-author').value = auth.currentUser.displayName || auth.currentUser.email.split('@')[0];
        }
        tinymce.get('editor-container')?.setContent('');
        showPage('ajouter');
    });
    document.getElementById('cancel-form-btn')?.addEventListener('click', () => showPage('cours'));
    document.getElementById('back-to-courses-btn')?.addEventListener('click', () => showPage('cours'));
    document.getElementById('edit-course-btn')?.addEventListener('click', editCourse);
    document.getElementById('delete-course-btn')?.addEventListener('click', deleteCourse);

    document.getElementById('course-grid')?.addEventListener('click', e => {
        if (e.target.classList.contains('btn-view')) viewCourse(e.target.dataset.id);
    });

    document.getElementById('profile-btn')?.addEventListener('click', () => {
        loadAccount();
        showPage('mon-compte');
    });
}

function initMobileMenu() {
    const toggle = document.getElementById('mobile-menu-toggle');
    const navRight = document.querySelector('.nav-right');
    const navLinks = document.querySelectorAll('.nav-menu a');

    if (!toggle || !navRight) return;

    // Toggle menu on hamburger click
    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = navRight.classList.toggle('active');
        toggle.classList.toggle('active');
        document.body.classList.toggle('menu-open');
    });

    // Close menu when clicking on a navigation link
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navRight.classList.remove('active');
            toggle.classList.remove('active');
            document.body.classList.remove('menu-open');
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (navRight.classList.contains('active') &&
            !navRight.contains(e.target) &&
            !toggle.contains(e.target)) {
            navRight.classList.remove('active');
            toggle.classList.remove('active');
            document.body.classList.remove('menu-open');
        }
    });

    // Close menu on window resize if it gets too wide
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768 && navRight.classList.contains('active')) {
            navRight.classList.remove('active');
            toggle.classList.remove('active');
            document.body.classList.remove('menu-open');
        }
    });
}

// Initialize application after loading templates
async function initApp() {
    try {
        // Load all templates first
        await loadMultipleTemplates([
            { containerId: 'header-container', path: 'templates/components/header.html' },
            { containerId: 'modals-container', path: 'templates/components/modals.html' },
            { containerId: 'page-accueil', path: 'templates/pages/home.html' },
            { containerId: 'page-cours', path: 'templates/pages/courses.html' },
            { containerId: 'page-ajouter', path: 'templates/pages/course-form.html' },
            { containerId: 'page-course-detail', path: 'templates/pages/course-detail.html' },
            { containerId: 'page-login', path: 'templates/pages/login.html' },
            { containerId: 'page-admin', path: 'templates/pages/admin.html' },
            { containerId: 'page-mon-compte', path: 'templates/pages/account.html' }
        ]);

        // Initialize app after templates are loaded
        initTinyMCE();
        initAuth();
        initForm();
        initNavigation();
        initAdminTabs();
        initBugSystem();
        initEventListeners();
        initMobileMenu();
        loadCourses();
        showPage('accueil');
    } catch (error) {
        console.error('Failed to initialize app:', error);
        notyf.error('Erreur lors du chargement de l\'application');
    }
}

document.addEventListener('DOMContentLoaded', initApp);

// Reacting to page changes if needed
document.addEventListener('pageChange', (e) => {
    if (e.detail.pageId === 'cours') {
        renderCourses();
        updateFilters();
    }
});
