import { db, coursesCollection, auth } from './firebase.js';
import { getDocs, doc, deleteDoc, updateDoc, addDoc, serverTimestamp, collection } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { state, setCourses, setCurrentCourseId, setUserProgress } from './state.js';
import { notyf, showPage } from './ui.js';
import { updateCourseFlashcardsSidebar } from './flashcard-ui.js';
import { renderQuizList, renderQuizAdmin } from './quiz-ui.js';
import { getAllUserBestScores } from './quiz.js';
import { trackCourseView, getCourseViewers, getCourseViewersCount, getAllCourseViewers, renderViewerAvatars, renderViewersList } from './courseViews.js';
import { escapeHtml, sanitizeAttribute } from './security.js';
import { applyFeatureFlags } from './features.js';
import { playProfessorCinematic } from './cinematic.js';

// Module state for category navigation
let currentCategory = null;

// Categories configuration
const CATEGORIES_CONFIG = {
    'Eco/Gestion': {
        id: 'eco-gestion',
        label: 'Eco/Gestion',
        className: 'eco-gestion',
        image: '/images/prof/prof_ecogestion.png'
    },
    'English in Hospitality': {
        id: 'english-hospitality',
        label: 'English in Hospitality',
        className: 'english-hospitality',
        image: '/images/prof/prof_english.png'
    },
    'Fondamentaux du marketing': {
        id: 'marketing',
        label: 'Fondamentaux du marketing',
        className: 'marketing',
        image: '/images/prof/prof_marketing.png'
    }
};

// Helper to normalize category
const normalizeCategory = (cat) => {
    if (!cat) return 'Autre';
    const lower = cat.toLowerCase();
    if (lower.includes('english') || lower.includes('anglais')) return 'English in Hospitality';
    if (lower.includes('eco') || lower.includes('gestion')) return 'Eco/Gestion';
    if (lower.includes('marketing')) return 'Fondamentaux du marketing';
    return cat;
};

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
                    } catch (e) {
                        console.error("Migration error:", e);
                    }
                }
            });
        }

        // Filter out archived courses
        const activeCourses = data.filter(course => !course.archived);

        setCourses(activeCourses);

        // Load Professor Dialogues
        try {
            const dialogSnap = await getDocs(collection(db, 'professor_dialogues'));
            state.profDialogues = {};
            dialogSnap.forEach(doc => {
                state.profDialogues[doc.id] = doc.data().messages;
            });
        } catch (e) { console.error("Error loading dialogues", e); }

        // Initialize back button listener
        const backBtn = document.getElementById('back-to-categories-btn');
        if (backBtn) {
            backBtn.onclick = backToCategories;
        }

        // Load User Quiz Progress (Moved to auth.js to wait for login)
        // if (auth.currentUser) { ... }

        // Update global stats (for Home page)
        updateGlobalStats();

        // Load recent courses (for Home page)
        loadRecentCourses();

        // Initial render: Categories view
        renderCategories();

    } catch (error) {
        console.error(error);
        notyf.error("Erreur de chargement des cours.");
    }
}

export function updateGlobalStats() {
    const numCourses = state.courses.filter(c => c.type === 'cours' || !c.type).length;
    const numExercises = state.courses.filter(c => c.type === 'exercice').length;

    // Attempt to find stat elements (present on Home page)
    const statCourses = document.getElementById('stat-courses');
    const statExercises = document.getElementById('stat-exercises');

    if (statCourses) statCourses.textContent = numCourses;
    if (statExercises) statExercises.textContent = numExercises;
}

export function renderCategories() {
    const categoryGrid = document.getElementById('category-grid');
    const courseGrid = document.getElementById('course-grid');
    const courseControls = document.getElementById('course-controls');
    const backBtn = document.getElementById('back-to-categories-btn');
    const title = document.getElementById('courses-title');

    if (!categoryGrid) return;

    // Reset view to categories
    categoryGrid.style.display = 'grid';
    courseGrid.style.display = 'none';
    courseControls.style.display = 'none';
    if (backBtn) backBtn.style.display = 'none';
    if (title) title.textContent = 'Mes Cours';

    // Count courses per category
    const counts = {};
    state.courses.forEach(c => {
        const cat = normalizeCategory(c.category);
        counts[cat] = (counts[cat] || 0) + 1;
    });
    console.log("Categories found:", counts);

    // Dynamic Category Discovery
    const priorityCategories = ['Eco/Gestion', 'English in Hospitality', 'Fondamentaux du marketing'];
    const otherCategories = Object.keys(counts).filter(c => !priorityCategories.includes(c) && c !== 'Autre').sort();

    // Merge lists: Priority first, then others
    const categoriesToRender = [...priorityCategories, ...otherCategories];

    // Always include 'Autre' at the end if it has any courses
    if (counts['Autre'] > 0) {
        categoriesToRender.push('Autre');
    }

    categoryGrid.innerHTML = categoriesToRender.map(catName => {
        const config = CATEGORIES_CONFIG[catName] || {
            className: 'default',
            label: catName,
            image: null,
            id: null
        };
        const count = counts[catName] || 0;

        const imageHtml = config.image
            ? `<img src="${config.image}" alt="Professeur ${config.label}" class="category-prof-img">`
            : `<div class="category-prof-img" style="font-size: 80px; display: flex; align-items: center; justify-content: center;">📚</div>`;

        // Cinematic Button logic
        let playBtnHtml = '';
        if (config.id && state.profDialogues && state.profDialogues[config.id] && state.profDialogues[config.id].length > 0) {
            playBtnHtml = `<button class="btn-play-cinematic" onclick="event.stopPropagation(); window.playCinematic('${config.id}')" style="position: absolute; top: 15px; right: 15px; z-index: 10; width: 44px; height: 44px; border-radius: 50%; background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.4); font-size: 1.5rem; cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); transition: transform 0.2s, background 0.2s;" onmouseover="this.style.transform='scale(1.1)'; this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.transform='scale(1)'; this.style.background='rgba(255,255,255,0.2)'" title="Message du professeur">💬</button>`;
        }

        return `
        <div class="category-card ${config.className}" onclick="selectCategory('${catName.replace(/'/g, "\\'")}')">
            ${playBtnHtml}
            ${imageHtml}
            <div class="category-content">
                <h3 class="category-name">${config.label}</h3>
                <span class="category-count">${count} cours</span>
            </div>
            <div class="category-arrow">➜</div>
        </div>
        `;
    }).join('');
}

// Helpers for Cinematics
window.playCinematic = function (catId) {
    const dialogues = state.profDialogues && state.profDialogues[catId];
    // Find config by ID
    const catName = Object.keys(CATEGORIES_CONFIG).find(key => CATEGORIES_CONFIG[key].id === catId);
    const config = catName ? CATEGORIES_CONFIG[catName] : null;

    if (config && dialogues) {
        let themeColor = '#2563eb';
        if (catId === 'eco-gestion') themeColor = '#0d9488';
        if (catId === 'english-hospitality') themeColor = '#be185d';
        if (catId === 'marketing') themeColor = '#3b82f6';

        playProfessorCinematic(config.image, dialogues, themeColor);
    }
};

// Ensure selectCategory is globally available for onclick
window.selectCategory = function (category) {
    currentCategory = category;
    renderCourses();
};

export function backToCategories() {
    currentCategory = null;
    renderCategories();
}

export function renderCourses() {
    const grid = document.getElementById('course-grid');
    const categoryGrid = document.getElementById('category-grid');
    const courseControls = document.getElementById('course-controls');
    const backBtn = document.getElementById('back-to-categories-btn');
    const title = document.getElementById('courses-title');

    if (!grid) return;

    // If no category selected, show categories instead
    if (!currentCategory) {
        renderCategories();
        return;
    }

    // Switch view to courses
    if (categoryGrid) categoryGrid.style.display = 'none';
    grid.style.display = 'grid';
    if (courseControls) courseControls.style.display = 'flex';
    if (backBtn) backBtn.style.display = 'inline-flex';
    if (title) title.textContent = currentCategory;

    const searchTerm = document.getElementById('course-search')?.value.toLowerCase() || '';
    const subjectFilter = document.getElementById('course-filter')?.value || '';
    const typeFilter = document.getElementById('course-type-filter')?.value || '';

    let filteredCourses = state.courses.filter(course => {
        // Category Filter (Critical!)
        if (normalizeCategory(course.category) !== currentCategory) return false;

        const matchesSearch = course.title.toLowerCase().includes(searchTerm) ||
            course.subject.toLowerCase().includes(searchTerm) ||
            course.description.toLowerCase().includes(searchTerm);

        // Subject filter might be redundant with category but keeping it for sub-filtering if needed
        const matchesSubject = !subjectFilter || course.subject === subjectFilter;

        const currentType = course.type || 'cours';
        const matchesType = !typeFilter || currentType === typeFilter;

        return matchesSearch && matchesSubject && matchesType;
    });

    if (filteredCourses.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 2rem;">Aucun cours trouvé dans cette catégorie.</p>`;
    } else {
        grid.innerHTML = filteredCourses.map(course => {
            const type = course.type || 'cours';
            const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
            const dateStr = course.createdAt ? new Date(course.createdAt.seconds * 1000).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR');

            // Sanitize all user-controlled data
            const safeTitle = escapeHtml(course.title);
            const safeSubject = escapeHtml(course.subject);
            const safeCategory = escapeHtml(course.category);
            const safeAuthor = escapeHtml(course.author || 'Anonyme');
            const safeDescription = escapeHtml(course.description);
            const safeId = sanitizeAttribute(course.id);

            // Quiz Progress Badge
            let progressHtml = '';
            if (state.userProgress && state.userProgress[course.id]) {
                const p = state.userProgress[course.id];
                if (p.validated) {
                    progressHtml = `<span class="course-progress-tag success" title="QCM Validé : ${p.percent}%">✅ ${p.percent}%</span>`;
                } else {
                    progressHtml = `<span class="course-progress-tag progress" title="Meilleur score : ${p.percent}%">⚡ ${p.percent}%</span>`;
                }
            }

            return `
            <div class="course-card" data-course-id="${safeId}">
                ${state.user ? `
                <button class="btn-favorite" data-course-id="${safeId}" onclick="toggleFavorite('${safeId}')" title="Ajouter aux favoris">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                </button>
                ` : ''}
                <h3>${safeTitle}</h3>
                <div class="course-card-content">
                    <div class="course-tags">
                        <span class="course-subject-tag">${safeSubject}</span>
                        <span class="course-type-tag type-${type}">${typeLabel}</span>
                        ${progressHtml}
                    </div>
                    <div class="course-metadata">
                        <span>👤 ${safeAuthor}</span>
                        <span>📅 ${dateStr}</span>
                    </div>
                </div>
                <p>${safeDescription}</p>
                <div class="course-card-footer">
                    <div class="course-viewers-preview" id="viewers-${safeId}"></div>
                    <button class="btn-view" data-id="${safeId}">Voir le cours</button>
                </div>
            </div>
        `}).join('');
    }

    // Update favorite buttons status
    if (state.user) {
        import('./favorites.js').then(module => {
            module.updateAllFavoriteButtons();
        });

        // Load viewers for each course card
        loadCourseCardViewers(filteredCourses);
    }

    // Update stats (global or filtered? maybe filtered by category is better here)
    // Actually the logic for global stats usually sits outside this, currently just keeping it updated relative to view might be confusing
    // Let's stick to global stats or filtered stats? 
    // The previous code calculated stats based on `state.courses` (all). Let's keep it based on filtered for context or all?
    // User asked for "Mes cours" -> Categories -> Courses. 
    // Let's recalculate stats based on ALL courses to show total platform content, logic was:
    const numCourses = state.courses.filter(c => c.type === 'cours' || !c.type).length;
    const numExercises = state.courses.filter(c => c.type === 'exercice').length;

    // Attempt to find stat elements
    const statCourses = document.getElementById('stat-courses');
    const statExercises = document.getElementById('stat-exercises');
    if (statCourses) statCourses.textContent = numCourses;
    if (statExercises) statExercises.textContent = numExercises;

    // Update filters based on filtered courses (so subject filter only shows subjects in this category)
    updateFilters(filteredCourses);
}

export function updateFilters(currentCourses = state.courses) {
    const filter = document.getElementById('course-filter');
    if (!filter) return;

    // If inside a category, we might want to filter subjects available only in that category
    // But updateFilters is called initially with all courses.
    // Let's rely on the passed courses.

    const subjects = [...new Set(currentCourses.map(course => course.subject))];
    const currentVal = filter.value;

    filter.innerHTML = '<option value="">Tous les sujets</option>' +
        subjects.map(subject => `<option value="${subject}">${subject}</option>`).join('');

    // Restore selection if possible
    if (currentVal && subjects.includes(currentVal)) {
        filter.value = currentVal;
    }
}

export function viewCourse(id) {
    const course = state.courses.find(c => c.id === id);
    if (course) {
        setCurrentCourseId(id);
        const type = course.type || 'cours';
        const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);

        const dateStr = course.createdAt ? new Date(course.createdAt.seconds * 1000).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR');

        // Sanitize user-controlled data
        const safeTitle = escapeHtml(course.title);
        const safeSubject = escapeHtml(course.subject);
        const safeAuthor = escapeHtml(course.author || 'Anonyme');

        document.getElementById('course-content').innerHTML = `
            <h2>${safeTitle}</h2>
            <div style="margin-bottom: 1.5rem;">
                <span class="course-subject-tag">${safeSubject}</span>
                <span class="course-type-tag type-${type}">${typeLabel}</span>
                <div class="course-metadata" style="margin-top: 0.75rem; font-size: 0.9rem;">
                    <span>👤 <strong>Auteur :</strong> ${safeAuthor}</span>
                    <span>📅 <strong>Publié le :</strong> ${dateStr}</span>
                </div>
            </div>
            ${course.content}

            <!-- Quizzes Section -->
            <div class="course-quizzes-section">
                <h3>📝 QCM de révision</h3>
                <div id="course-quizzes-list">
                    <!-- Loaded dynamically -->
                </div>
            </div>

            ${state.isAdmin ? `
            <!-- Admin Quiz Management -->
            <div class="course-admin-section" style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid var(--border-color);">
                <h3>Administration QCM</h3>
                <button class="btn-primary btn-small" onclick="openQuizEditor()" style="margin-bottom: 1rem;">+ Nouveau QCM</button>
                <div id="quiz-admin-list"></div>
            </div>
            ` : ''}
        `;

        renderQuizList(id);
        if (state.isAdmin) {
            // Expose openQuizEditor globally first or import it dynamically if needed by inline onclick.
            // Actually, the button onclick="openQuizEditor()" needs it global.
            import('./quiz-ui.js').then(module => {
                window.openQuizEditor = module.openQuizEditor;
                module.renderQuizAdmin(id);
            });
        }

        renderRelatedCourses(course.subject, id);
        renderRelatedExercises(course.subject, id);
        updateCourseFlashcardsSidebar(id);

        // Track this view and load viewers sidebar
        if (state.user) {
            trackCourseView(id);
            loadCourseViewersSidebar(id);
            // Initialize reading tracker for the "Érudit" badge
            import('./course-tracker.js').then(module => {
                module.initCourseReadingTracker(id);
            });
        }

        showPage('course-detail');
        applyFeatureFlags(); // Apply feature visibility after page load
        window.scrollTo(0, 0);

        // Creativity Bonus Check (Random coin drop)
        if (state.user) {
            import('./gamification.js').then(module => {
                module.triggerCreativeDiscovery(state.user);
            });
        }
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

    // Clear legacy inline styles
    layout.style.gridTemplateColumns = '';

    if (visibleSections.length === 0) {
        sidebar.style.display = 'none';
        layout.classList.remove('has-sidebar');
    } else {
        sidebar.style.display = 'flex';
        layout.classList.add('has-sidebar');
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

// ============================================
// COURSE VIEWERS DISPLAY
// ============================================

/**
 * Load viewers avatars for all course cards
 */
async function loadCourseCardViewers(courses) {
    for (const course of courses) {
        const container = document.getElementById(`viewers-${course.id}`);
        if (!container) continue;

        try {
            const [viewers, count] = await Promise.all([
                getCourseViewers(course.id, 5),
                getCourseViewersCount(course.id)
            ]);

            if (count > 0) {
                container.innerHTML = renderViewerAvatars(viewers, count);
            }
        } catch (error) {
            console.error(`Error loading viewers for course ${course.id}:`, error);
        }
    }
}

/**
 * Load viewers sidebar for course detail page
 */
async function loadCourseViewersSidebar(courseId) {
    const container = document.getElementById('course-viewers-section');
    if (!container) return;

    try {
        const [viewers, count] = await Promise.all([
            getAllCourseViewers(courseId),
            getCourseViewersCount(courseId)
        ]);

        const headerEl = container.querySelector('.viewers-count');
        if (headerEl) {
            headerEl.textContent = `👁️ Vu par ${count} étudiant${count > 1 ? 's' : ''}`;
        }

        const listContainer = container.querySelector('#viewers-list-container');
        if (listContainer) {
            if (count > 0) {
                listContainer.innerHTML = `
                    ${renderViewerAvatars(viewers.slice(0, 5), count)}
                    <div id="viewers-full-list" class="viewers-full-list" style="display: none;">
                        ${renderViewersList(viewers, count)}
                    </div>
                    ${count > 5 ? `<button class="btn-show-viewers" onclick="toggleViewersList()">Voir tous</button>` : ''}
                `;
            } else {
                listContainer.innerHTML = '<p class="no-viewers">Soyez le premier à voir ce cours !</p>';
            }
        }

        container.style.display = 'block';
    } catch (error) {
        console.error("Error loading viewers sidebar:", error);
    }
}

// Toggle full viewers list
window.toggleViewersList = function () {
    const list = document.getElementById('viewers-full-list');
    const btn = document.querySelector('.btn-show-viewers');
    if (list && btn) {
        const isHidden = list.style.display === 'none';
        list.style.display = isHidden ? 'block' : 'none';
        btn.textContent = isHidden ? 'Masquer' : 'Voir tous';
    }
};
