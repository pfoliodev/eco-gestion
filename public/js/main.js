import { initTinyMCE, showPage, notyf } from './ui.js';
import { db, auth } from './firebase.js';
import { doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { initAuth } from './auth.js';
import { initForm, loadCourses, renderCourses, updateFilters, viewCourse, editCourse, deleteCourse, loadRecentCourses } from './course.js';
import { initAdminSidebar, loadUsers } from './admin.js';
import { initBugSystem } from './bug.js';
import { loadAccount } from './account.js';
import { state } from './state.js';
import { loadMultipleTemplates } from './template-loader.js';
import { initGDPR } from './gdpr.js';
import { loadReminders, loadAdminReminders, initReminderForm } from './reminders.js';
import { initFlashcards } from './flashcard-ui.js';
import { initQuizEditor } from './quiz-ui.js';
import { initQuestUI } from './quest-ui.js';
import { initFeatures, applyFeatureFlags } from './features.js';
import { downloadCourseAsPdf } from './pdf-export.js';
import { initShopPage } from './shop-ui.js';
import { seedDefaultSucces } from './succes.js';
// seedDefaultSucces(); // Uncomment to seed, then comment out. 
// Actually, let's run it once safely if possible or just rely on manual trigger if I can't.
// User didn't ask for admin panel seeding.
// Let's run it.
// seedDefaultSucces().then(r => console.log(r));

window.viewCourse = viewCourse;
window.showPage = showPage;

function initNavigation() {
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href^="#"]');
        if (link) {
            e.preventDefault();
            const href = link.getAttribute('href');

            if (href === '#accueil') showPage('accueil');
            else if (href === '#evenements') showPage('evenements');
            else if (href === '#ajouter') {
                document.getElementById('form-title').textContent = 'Nouveau cours';
                document.getElementById('course-form').reset();
                document.getElementById('course-id').value = '';
                if (auth.currentUser) {
                    document.getElementById('course-author').value = auth.currentUser.displayName || auth.currentUser.email.split('@')[0];
                }
                tinymce.get('editor-container')?.setContent('');
                showPage('ajouter');
            }
            else if (href === '#admin') {
                if (state.isAdmin) { loadUsers(); showPage('admin'); }
                else notyf.error("Accès non autorisé.");
            }
            else if (href === '#login') showPage('login');
            else if (href === '#register') showPage('register');
            else if (href === '#flashcards') showPage('flashcards');
            else if (href === '#shop') {
                showPage('shop');
                initShopPage();
            }
            else if (href === '#mon-compte') {
                loadAccount();
                showPage('mon-compte');
            }
            else if (href === '#pantheon') {
                showPage('pantheon');
            }
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
        showPage('accueil');
        renderCourses();
    });

    document.getElementById('card-exercises')?.addEventListener('click', () => {
        const typeFilter = document.getElementById('course-type-filter');
        if (typeFilter) typeFilter.value = 'exercice';
        showPage('accueil');
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
    document.getElementById('cancel-form-btn')?.addEventListener('click', () => showPage('accueil'));
    document.getElementById('back-to-courses-btn')?.addEventListener('click', () => showPage('accueil'));
    document.getElementById('edit-course-btn')?.addEventListener('click', editCourse);
    document.getElementById('delete-course-btn')?.addEventListener('click', deleteCourse);

    document.getElementById('course-grid')?.addEventListener('click', e => {
        if (e.target.classList.contains('btn-view')) viewCourse(e.target.dataset.id);
    });

    document.getElementById('profile-btn')?.addEventListener('click', () => {
        loadAccount();
        showPage('mon-compte');
    });

    // PDF Download button - use event delegation for dynamically loaded content
    document.addEventListener('click', (e) => {
        if (e.target.closest('#download-pdf-btn')) {
            e.preventDefault();
            if (state.currentCourseId) {
                downloadCourseAsPdf(state.currentCourseId);
            }
        }
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

    // Close menu when clicking on nav action buttons (login, account, etc.)
    const navActionButtons = document.querySelectorAll('.nav-actions a, .nav-actions button');
    navActionButtons.forEach(button => {
        button.addEventListener('click', () => {
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


function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const moonIcon = document.getElementById('theme-icon-moon');
    const sunIcon = document.getElementById('theme-icon-sun');

    // Check saved theme or system preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Set initial theme - default to system if no save, but prioritize save
    const currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', currentTheme);

    function updateIcon(theme) {
        if (theme === 'dark') {
            moonIcon.style.display = 'none';
            sunIcon.style.display = 'block';
        } else {
            moonIcon.style.display = 'block';
            sunIcon.style.display = 'none';
        }
    }

    updateIcon(currentTheme);

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const newTheme = current === 'dark' ? 'light' : 'dark';

            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateIcon(newTheme);
        });
    }
}

// Initialize application after loading templates
async function initApp() {
    try {
        // Load all templates first
        await loadMultipleTemplates([
            { containerId: 'header-container', path: '/templates/components/header.html' },
            { containerId: 'modals-container', path: '/templates/components/modals.html' },
            { containerId: 'footer-container', path: '/templates/components/footer.html' },
            { containerId: 'cookie-banner-container', path: '/templates/components/cookie-banner.html' },
            { containerId: 'page-accueil', path: '/templates/pages/home.html' },
            { containerId: 'page-evenements', path: '/templates/pages/events.html' },
            { containerId: 'page-ajouter', path: '/templates/pages/course-form.html' },
            { containerId: 'page-course-detail', path: '/templates/pages/course-detail.html' },
            { containerId: 'page-flashcards', path: '/templates/pages/flashcards.html' },
            { containerId: 'page-flashcards-study', path: '/templates/pages/flashcards-study.html' },
            { containerId: 'page-flashcards-admin', path: '/templates/pages/flashcards-admin.html' },
            { containerId: 'page-quiz-player', path: '/templates/pages/quiz-player.html' },
            { containerId: 'page-login', path: '/templates/pages/login.html' },
            { containerId: 'page-register', path: '/templates/pages/register.html' },
            { containerId: 'page-admin', path: '/templates/pages/admin.html' },
            { containerId: 'page-mon-compte', path: '/templates/pages/account.html' },
            { containerId: 'page-privacy-policy', path: '/templates/pages/privacy-policy.html' },
            { containerId: 'page-legal-notice', path: '/templates/pages/legal-notice.html' },
            { containerId: 'page-shop', path: '/templates/pages/shop.html' },
            { containerId: 'page-pantheon', path: '/templates/pages/pantheon.html' }
        ]);

        // Initialize app after templates are loaded
        initTheme(); // Initialize theme early
        await initFeatures();
        initTinyMCE();
        initAuth();
        initForm();
        initNavigation();
        initAdminSidebar();
        initBugSystem();
        initEventListeners();
        initMobileMenu();
        initGDPR();
        loadCourses();
        loadReminders();
        initFlashcards();
        initQuizEditor();
        initQuestUI();

        // Dynamic import for carousel to avoid blocking
        import('./carousel.js').then(module => {
            module.initHomeCarousel();
        });

        showPage('accueil');
    } catch (error) {
        console.error('Failed to initialize app:', error);
        notyf.error('Erreur lors du chargement de l\'application');
    }
}

document.addEventListener('DOMContentLoaded', initApp);

// Update QCM card button based on auth state
function updateQcmCardButton() {
    const buttonContainer = document.getElementById('qcm-card-button');
    if (!buttonContainer) return;

    if (state.user) {
        // User is logged in - show "Voir les cours" (Home)
        buttonContainer.innerHTML = '<button class="btn-primary" onclick="showPage(\'accueil\')">Voir les cours</button>';
    } else {
        // User is not logged in - show "Se connecter"
        buttonContainer.innerHTML = '<button class="btn-primary" onclick="showPage(\'login\')">Se connecter</button>';
    }
}

// Export for use in auth.js
window.updateQcmCardButton = updateQcmCardButton;

// Reacting to page changes if needed
document.addEventListener('pageChange', (e) => {
    applyFeatureFlags();
    updateQcmCardButton(); // Update button when page changes
    if (e.detail.pageId === 'accueil') {
        renderCourses();
        updateFilters();
    }
    if (e.detail.pageId === 'pantheon') {
        import('./pantheon.js').then(module => {
            module.initPantheon();
        });
    }
});

// ============================================
// THE DRAGON EGG 🐉 (Easter Egg)
// ============================================
window.revealDragon = async () => {
    const dragon = `
   ___====-_  _-====___
          _--^^^#####//      \\\\\\\\#####^^^--_
       _-^##########// (    ) \\\\\\\\##########^-_
      -############//  |\\\\^^/|  \\\\\\\\############-
    _/############//   (@::@)   \\\\\\\\############\\\\_
   /#############((     \\\\\\\\//     ))#############\\\\
   -###############\\\\\\\\    (oo)    //###############-
   -#################\\\\\\\\  / VV \\\\  //#################-
   -###################\\\\\\\\/      \\\\//###################-
   _#/|##########/\\\\\\\\######(   /\\\\\\\\   )######/\\\\\\\\##########|\\\\\\#_
   |/ |# /\\# /\\# /\\/  \\# /\\##\\  |  |  /# /\\#/  \\/\\# /\\# /\\# | \\|
   \`  |/  V  V  \`   V  \\# \\ |  | / #/  V   '  V  V  \\|  '
      \`   \`  \`      \`   /  /    \\  \\   '      '  '   '
                       /  /      \\  \\
                      /_ /        \\ _\\`;

    console.log("%c🐲 VOUS AVEZ RÉVEILLÉ LE DRAGON ! 🐲", "color: #4f46e5; font-size: 20px; font-weight: bold;");
    console.log("%c" + dragon, "color: #4f46e5; font-family: monospace; font-weight: bold;");

    if (!auth.currentUser) {
        console.log("%cConnectez-vous pour réclamer ce badge !", "color: #ef4444; font-weight: bold;");
        return;
    }

    try {
        const res = await unlockBadge('code_guardian');
        if (res && !res.alreadyUnlocked) {
            console.log("%c✨ NOUVEAU BADGE DÉBLOQUÉ ! ✨", "color: #10b981; font-weight: bold;");
            notyf.success("Badge 'Gardien du Code' débloqué ! 🐉");
        } else {
            console.log("%cVous possédez déjà ce badge.", "color: #64748b; font-style: italic;");
        }
    } catch (error) {
        console.error("Erreur lors du déblocage du badge du dragon:", error);
    }
};

// Hint for the curious
console.log("%cLa curiosité est récompensée... Essaye de taper revealDragon()", "color: transparent;");
// Time Tracking
setInterval(async () => {
    if (auth.currentUser) {
        try {
            const userRef = doc(db, 'users', auth.currentUser.uid);
            await updateDoc(userRef, {
                totalTimeSpent: increment(60)
            });
        } catch (e) {
            // fail silently
        }
    }
}, 60000);
