import { initTinyMCE, showPage, notyf } from './ui.js';
import { initAuth } from './auth.js';
import { initForm, loadCourses, renderCourses, updateFilters, viewCourse, editCourse, deleteCourse } from './course.js';
import { initAdminTabs, loadUsers } from './admin.js';
import { isAdmin } from './state.js';

// Global exports for inline HTML handlers
window.viewCourse = viewCourse;

function initNavigation() {
    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const href = link.getAttribute('href');
            if (href === '#accueil') showPage('accueil');
            else if (href === '#cours') showPage('cours');
            else if (href === '#ajouter') {
                document.getElementById('form-title').textContent = 'Nouveau cours';
                document.getElementById('course-form').reset();
                document.getElementById('course-id').value = '';
                showPage('ajouter');
            }
            else if (href === '#admin') {
                if (isAdmin) { loadUsers(); showPage('admin'); }
                else notyf.error("Accès non autorisé.");
            }
            else if (href === '#login') showPage('login');
        });
    });
}

function initEventListeners() {
    document.getElementById('course-search')?.addEventListener('input', renderCourses);
    document.getElementById('course-filter')?.addEventListener('change', renderCourses);
    document.getElementById('add-course-btn')?.addEventListener('click', () => {
        document.getElementById('form-title').textContent = 'Nouveau cours';
        document.getElementById('course-form').reset();
        document.getElementById('course-id').value = '';
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
}

document.addEventListener('DOMContentLoaded', () => {
    initTinyMCE();
    initAuth();
    initForm();
    initNavigation();
    initAdminTabs();
    initEventListeners();
    loadCourses();
    showPage('accueil');
});

// Reacting to page changes if needed
document.addEventListener('pageChange', (e) => {
    if (e.detail.pageId === 'cours') {
        renderCourses();
        updateFilters();
    }
});
