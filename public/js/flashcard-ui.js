import {
    loadFlashcards,
    loadFlashcardsByCourse,
    createFlashcard,
    updateFlashcard,
    deleteFlashcard,
    startStudySession,
    nextCard,
    getCurrentCard,
    getSubjectsWithFlashcards,
    hashContent
} from './flashcard.js';
import { state, setCurrentStudySession } from './state.js';
import { notyf, showPage, initTinyMCE } from './ui.js';

// ============================================
// FLASHCARDS HOME PAGE
// ============================================

export async function renderFlashcardsHome() {
    const list = document.getElementById('flashcard-subject-grid');
    if (!list) return; // Not on flashcards page

    list.innerHTML = '<div class="loading-spinner">Chargement...</div>';

    await loadFlashcards();
    // Progress loading removed as not needed for stats anymore

    // Render subject grid
    const subjects = getSubjectsWithFlashcards();

    if (subjects.length === 0) {
        list.innerHTML = `
            <div class="fc-empty-state">
                <p>Aucune flashcard disponible.</p>
            </div>
        `;
    } else {
        list.innerHTML = subjects.map(({ subject, count }) => {
            return `
                <div class="subject-card" data-subject="${subject}">
                    <div class="subject-icon">📚</div>
                    <div class="subject-info">
                        <h3>${subject}</h3>
                    </div>
                    <div class="subject-stats">
                        <span class="subject-count">${count} cartes</span>
                    </div>
                    <button class="btn-primary btn-small" data-action="study-subject">Réviser</button>
                </div>
            `;
        }).join('');
    }

    // Update start button (always enabled if there are cards)
    const startBtn = document.getElementById('start-all-review');
    if (startBtn) {
        const totalCards = state.flashcards.length;
        startBtn.disabled = totalCards === 0;
        startBtn.textContent = totalCards > 0
            ? `🎯 Commencer la révision (${totalCards} cartes)`
            : '📚 Aucune flashcard disponible';
    }
}

// ============================================
// STUDY SESSION
// ============================================

function showCurrentCard() {
    const card = getCurrentCard();
    if (!card) return;

    const session = state.currentStudySession;
    const flashcard = document.getElementById('flashcard');

    // Update progress bar
    const progressText = document.getElementById('study-progress-text');
    const progressBar = document.getElementById('study-progress-bar');
    const completed = session.currentIndex;
    const total = session.cards.length;

    progressText.textContent = `${completed + 1} / ${total}`;
    progressBar.style.width = `${((completed + 1) / total) * 100}%`;

    // Hide navigation buttons immediately
    document.getElementById('rating-buttons').style.display = 'none';

    // If card is flipped, first unflip it, then update content after animation
    if (flashcard.classList.contains('flipped')) {
        flashcard.classList.remove('flipped');

        // Wait for flip animation to complete (350ms), then update content
        setTimeout(() => {
            updateCardContent(card);
        }, 350);
    } else {
        // Card is already showing front, update immediately
        updateCardContent(card);
    }
}

function updateCardContent(card) {
    // Display question
    document.getElementById('flashcard-question').innerHTML = card.question;
    document.getElementById('flashcard-answer').innerHTML = card.answer;

    // Display explanation if exists
    const explanationSection = document.getElementById('flashcard-explanation-section');
    const explanationContent = document.getElementById('flashcard-explanation');
    if (card.explanation && card.explanation.trim()) {
        explanationContent.innerHTML = card.explanation;
        explanationSection.style.display = 'block';
    } else {
        explanationSection.style.display = 'none';
    }
}

function flipCard() {
    const flashcard = document.getElementById('flashcard');
    flashcard.classList.add('flipped');
    document.getElementById('rating-buttons').style.display = 'block';
}

async function handleNextCard() {
    const result = await nextCard();

    if (result && result.complete) {
        // Show completion modal
        document.getElementById('study-complete').style.display = 'flex';
        document.getElementById('complete-stats').textContent = `Vous avez révisé ${result.reviewed} cartes !`;
    } else {
        showCurrentCard();
    }
}

function startStudy(flashcards, courseId = null, subject = null) {
    const session = startStudySession(flashcards, courseId, subject);

    if (!session) {
        return;
    }

    // Update subject label
    const label = document.getElementById('study-subject-label');
    if (subject) {
        label.textContent = subject;
    } else if (courseId) {
        const course = state.courses.find(c => c.id === courseId);
        label.textContent = course?.title || 'Révision';
    } else {
        label.textContent = 'Toutes les matières';
    }

    // Reset study complete modal
    document.getElementById('study-complete').style.display = 'none';

    showPage('flashcards-study');
    showCurrentCard();
}

// Free study mode - allows reviewing ALL cards regardless of due date
function startFreeStudy(flashcards, courseId = null, subject = null) {
    startStudy(flashcards, courseId, subject); // Reuse logic as startStudy is now free study
}

// ============================================
// ADMIN: MANAGE FLASHCARDS
// ============================================

let editingFlashcardId = null;

async function renderFlashcardsAdmin(courseId) {
    const course = state.courses.find(c => c.id === courseId);
    if (!course) {
        notyf.error('Cours non trouvé');
        showPage('cours');
        return;
    }

    // Update course info
    document.getElementById('fc-admin-course-title').textContent = course.title;
    document.getElementById('fc-admin-course-subject').textContent = course.subject;

    // Load flashcards for this course
    const flashcards = await loadFlashcardsByCourse(courseId);

    // Check for outdated flashcards
    const hasOutdated = flashcards.some(f => f.status === 'outdated');
    document.getElementById('fc-sync-alert').style.display = hasOutdated ? 'flex' : 'none';

    // Update count
    document.getElementById('fc-count').textContent = flashcards.length;

    // Render list
    const list = document.getElementById('fc-list');
    const emptyState = document.getElementById('fc-empty');

    if (flashcards.length === 0) {
        emptyState.style.display = 'block';
        list.querySelectorAll('.fc-item').forEach(el => el.remove());
    } else {
        emptyState.style.display = 'none';

        const items = flashcards.map(fc => `
        <div class="fc-item ${fc.status === 'outdated' ? 'fc-outdated' : ''}" data-id="${fc.id}">
            <div class="fc-item-content">
                <div class="fc-item-question">
                    <strong>Q:</strong> ${fc.question}
                </div>
                <div class="fc-item-answer">
                    <strong>R:</strong> ${fc.answer}
                </div>
                ${fc.status === 'outdated' ? '<span class="fc-outdated-badge">⚠️ À vérifier</span>' : ''}
            </div>
            <div class="fc-item-actions">
                <button class="btn-edit btn-small" data-action="edit-fc">✏️</button>
                <button class="btn-delete btn-small" data-action="delete-fc">🗑️</button>
            </div>
        </div>
    `).join('');

        // Keep empty state element but add new items
        list.innerHTML = items + emptyState.outerHTML;
        document.getElementById('fc-empty').style.display = 'none';
    }

    // Reset form
    resetFlashcardForm();

    // Initialize editors
    initFlashcardEditors();
}

function initFlashcardEditors() {
    // Remove existing instances if any to avoid duplicates
    tinymce.remove('#fc-question-editor');
    tinymce.remove('#fc-answer-editor');
    tinymce.remove('#fc-explanation-editor');

    initTinyMCE('#fc-question-editor', {
        height: 180,
        placeholder: 'Entrez la question...',
        menubar: false,
        toolbar: 'undo redo | bold italic | bullist numlist | removeformat'
    });
    initTinyMCE('#fc-answer-editor', {
        height: 180,
        placeholder: 'La réponse courte...',
        menubar: false,
        toolbar: 'undo redo | bold italic | bullist numlist | removeformat'
    });
    initTinyMCE('#fc-explanation-editor', {
        height: 220,
        placeholder: 'Explication détaillée, exemples, contexte...',
        menubar: false,
        toolbar: 'undo redo | bold italic | bullist numlist | removeformat'
    });
}

function resetFlashcardForm() {
    editingFlashcardId = null;
    document.getElementById('fc-edit-id').value = '';

    tinymce.get('fc-question-editor')?.setContent('');
    tinymce.get('fc-answer-editor')?.setContent('');
    tinymce.get('fc-explanation-editor')?.setContent('');

    document.getElementById('fc-form-title').textContent = 'Ajouter une flashcard';
    document.getElementById('fc-submit-btn').textContent = 'Ajouter';
    document.getElementById('fc-cancel-btn').style.display = 'none';
}

function editFlashcardForm(flashcard) {
    editingFlashcardId = flashcard.id;
    document.getElementById('fc-edit-id').value = flashcard.id;

    tinymce.get('fc-question-editor')?.setContent(flashcard.question || '');
    tinymce.get('fc-answer-editor')?.setContent(flashcard.answer || '');
    tinymce.get('fc-explanation-editor')?.setContent(flashcard.explanation || '');

    document.getElementById('fc-form-title').textContent = 'Modifier la flashcard';
    document.getElementById('fc-submit-btn').textContent = 'Enregistrer';
    document.getElementById('fc-cancel-btn').style.display = 'inline-block';

    // Scroll to form
    document.querySelector('.fc-form-section').scrollIntoView({ behavior: 'smooth' });
}

// ============================================
// COURSE DETAIL INTEGRATION
// ============================================

export async function updateCourseFlashcardsSidebar(courseId) {
    const flashcards = await loadFlashcardsByCourse(courseId);


    const countEl = document.getElementById('course-fc-count');
    const studyBtn = document.getElementById('study-course-flashcards');
    const manageBtn = document.getElementById('manage-course-flashcards');
    const section = document.getElementById('flashcards-sidebar-section');

    if (!countEl) return;

    countEl.textContent = flashcards.length;

    // Show study button if there are ANY flashcards
    if (studyBtn) {
        studyBtn.style.display = flashcards.length > 0 ? 'inline-block' : 'none';
        studyBtn.textContent = `🎯 Réviser`;
    }

    // Show manage button for admins
    if (manageBtn) {
        manageBtn.style.display = state.isAdmin ? 'inline-block' : 'none';
    }

    // Show section
    if (section) {
        section.style.display = 'block';
    }
}

// ============================================
// EVENT LISTENERS & INITIALIZATION
// ============================================

function initFlashcardEventListeners() {
    // Flashcards home - Start review
    document.getElementById('start-all-review')?.addEventListener('click', async () => {
        await loadFlashcards();
        startStudy(state.flashcards);
    });

    // Subject card click
    document.getElementById('flashcard-subject-grid')?.addEventListener('click', async (e) => {
        const subjectCard = e.target.closest('.subject-card');
        const studyBtn = e.target.closest('[data-action="study-subject"]');

        if (studyBtn && subjectCard) {
            const subject = subjectCard.dataset.subject;
            const subjectFlashcards = state.flashcards.filter(f => f.subject === subject);
            startStudy(subjectFlashcards, null, subject);
        }
    });

    // Study page - Card flip
    document.getElementById('flashcard')?.addEventListener('click', flipCard);

    // Study page - Next Card Button
    document.getElementById('next-card-btn')?.addEventListener('click', handleNextCard);

    // Study page - Exit
    document.getElementById('exit-study')?.addEventListener('click', () => {
        setCurrentStudySession(null);
        showPage('flashcards');
    });

    // Study page - Back to flashcards after completion
    document.getElementById('back-to-flashcards')?.addEventListener('click', () => {
        showPage('flashcards');
    });

    // Course detail - Study course flashcards
    document.getElementById('study-course-flashcards')?.addEventListener('click', async () => {
        const courseId = state.currentCourseId;
        if (!courseId) return;

        const flashcards = await loadFlashcardsByCourse(courseId);
        startStudy(flashcards, courseId);
    });

    // Course detail - Manage flashcards (admin)
    document.getElementById('manage-course-flashcards')?.addEventListener('click', () => {
        const courseId = state.currentCourseId;
        if (!courseId || !state.isAdmin) return;

        showPage('flashcards-admin');
        renderFlashcardsAdmin(courseId);
    });

    // Admin - Back button
    document.getElementById('back-from-fc-admin')?.addEventListener('click', () => {
        if (state.currentCourseId) {
            showPage('course-detail');
        } else {
            showPage('cours');
        }
    });

    // Admin - Form submission
    document.getElementById('flashcard-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const courseId = state.currentCourseId;
        const course = state.courses.find(c => c.id === courseId);

        const question = tinymce.get('fc-question-editor')?.getContent().trim() || '';
        const answer = tinymce.get('fc-answer-editor')?.getContent().trim() || '';
        const explanation = tinymce.get('fc-explanation-editor')?.getContent().trim() || '';

        if (!question || !answer || question === '<p></p>' || answer === '<p></p>') {
            notyf.error('Veuillez remplir la question et la réponse');
            return;
        }

        const flashcardId = document.getElementById('fc-edit-id').value;

        if (flashcardId) {
            // Update existing
            await updateFlashcard(flashcardId, {
                question,
                answer,
                explanation,
                status: 'synced',
                sourceContentHash: hashContent(course?.content || '')
            });
        } else {
            // Create new
            await createFlashcard({
                courseId,
                subject: course?.subject || '',
                question,
                answer,
                explanation,
                sourceContentHash: hashContent(course?.content || '')
            });
        }

        renderFlashcardsAdmin(courseId);
    });

    // Admin - Cancel edit
    document.getElementById('fc-cancel-btn')?.addEventListener('click', resetFlashcardForm);

    // Admin - Edit/Delete flashcard
    document.getElementById('fc-list')?.addEventListener('click', async (e) => {
        const item = e.target.closest('.fc-item');
        if (!item) return;

        const flashcardId = item.dataset.id;
        const flashcard = state.flashcards.find(f => f.id === flashcardId);

        if (e.target.closest('[data-action="edit-fc"]')) {
            if (flashcard) editFlashcardForm(flashcard);
        }

        if (e.target.closest('[data-action="delete-fc"]')) {
            if (confirm('Supprimer cette flashcard ?')) {
                await deleteFlashcard(flashcardId);
                renderFlashcardsAdmin(state.currentCourseId);
            }
        }
    });

    // Admin - Mark all as synced
    document.getElementById('fc-mark-synced')?.addEventListener('click', async () => {
        const courseId = state.currentCourseId;
        const flashcards = await loadFlashcardsByCourse(courseId);
        const course = state.courses.find(c => c.id === courseId);
        const newHash = hashContent(course?.content || '');

        for (const fc of flashcards) {
            if (fc.status === 'outdated') {
                await updateFlashcard(fc.id, { status: 'synced', sourceContentHash: newHash });
            }
        }

        notyf.success('Flashcards synchronisées');
        renderFlashcardsAdmin(courseId);
    });
}

// Page change handler
function handlePageChange(pageId) {
    if (pageId === 'flashcards') {
        renderFlashcardsHome();
    }
}

export function initFlashcards() {
    initFlashcardEventListeners();

    // Listen for page changes
    document.addEventListener('pageChange', (e) => {
        handlePageChange(e.detail.pageId);
    });
}
