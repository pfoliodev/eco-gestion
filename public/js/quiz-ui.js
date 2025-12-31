import {
    createQuiz,
    updateQuiz,
    deleteQuiz,
    getQuizzesByCourse,
    getQuizById,
    submitQuizResult,
    getUserQuizBestScore
} from './quiz.js';
import { notyf, showPage } from './ui.js';
import { state } from './state.js';
import { auth } from './firebase.js';

// --- Global UI State ---
let currentQuiz = null;
let currentQuizQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = {}; // { questionIndex: selectedOptionIndex }

// --- Admin: List & Manage Quizzes ---

export async function renderQuizAdmin(courseId) {
    const list = document.getElementById('quiz-admin-list');
    if (!list) return;

    list.innerHTML = '<div class="loading-spinner">Chargement des QCM...</div>';

    try {
        const quizzes = await getQuizzesByCourse(courseId);

        if (quizzes.length === 0) {
            list.innerHTML = '<p class="empty-state">Aucun QCM créé pour ce cours.</p>';
        } else {
            list.innerHTML = quizzes.map(q => `
                <div class="quiz-item-admin" data-id="${q.id}">
                    <div class="quiz-info">
                        <h4>${q.title}</h4>
                        <span class="quiz-meta">${q.questions.length} questions</span>
                    </div>
                    <div class="quiz-actions">
                        <button class="btn-icon btn-edit-quiz" title="Modifier">✏️</button>
                        <button class="btn-icon btn-delete-quiz" title="Supprimer">🗑️</button>
                    </div>
                </div>
            `).join('');

            // Add listeners
            list.querySelectorAll('.btn-edit-quiz').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.closest('.quiz-item-admin').dataset.id;
                    const quiz = quizzes.find(q => q.id === id);
                    openQuizEditor(quiz);
                });
            });

            list.querySelectorAll('.btn-delete-quiz').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (confirm("Supprimer ce QCM ?")) {
                        const id = e.target.closest('.quiz-item-admin').dataset.id;
                        await deleteQuiz(id);
                        renderQuizAdmin(courseId);
                        renderQuizList(courseId); // Update public list too
                    }
                });
            });
        }
    } catch (e) {
        console.error(e);
        notyf.error("Erreur de chargement des QCM");
    }
}

// --- Admin: Quiz Editor ---

export function openQuizEditor(quiz = null) {
    const modal = document.getElementById('quiz-editor-modal');
    modal.style.display = 'flex';

    const form = document.getElementById('quiz-form');
    const questionsContainer = document.getElementById('quiz-questions-container');

    // Reset form
    form.reset();
    document.getElementById('quiz-id').value = quiz ? quiz.id : '';
    document.getElementById('quiz-title').value = quiz ? quiz.title : '';
    questionsContainer.innerHTML = '';

    // Existing questions or one empty question
    const questions = quiz ? quiz.questions : [{ text: '', options: ['', '', '', ''], correctIndex: 0, explanation: '' }];

    questions.forEach((q, index) => addQuestionField(index, q));

    document.getElementById('add-question-btn').onclick = () => {
        addQuestionField(document.querySelectorAll('.question-block').length);
    };
}

function addQuestionField(index, data = null) {
    const container = document.getElementById('quiz-questions-container');
    const div = document.createElement('div');
    div.className = 'question-block';
    div.innerHTML = `
        <div class="question-header">
            <h5>Question ${index + 1}</h5>
            ${index > 0 ? '<button type="button" class="btn-remove-q text-danger">Supprimer</button>' : ''}
        </div>
        <div class="form-group">
            <label>Énoncé</label>
            <input type="text" class="q-text" required value="${data ? data.text : ''}" placeholder="Quelle est la capitale de...">
        </div>
        <div class="options-grid">
            ${[0, 1, 2, 3].map(i => `
                <div class="option-row">
                    <input type="radio" name="correct-${index}" value="${i}" ${data && data.correctIndex === i ? 'checked' : (i === 0 && !data ? 'checked' : '')}>
                    <input type="text" class="q-option" required value="${data ? data.options[i] : ''}" placeholder="Réponse ${i + 1}">
                </div>
            `).join('')}
        </div>
        <div class="form-group">
            <label>Explication (visible après réponse)</label>
            <textarea class="q-explanation" rows="2" placeholder="Car Paris est la capitale...">${data ? data.explanation || '' : ''}</textarea>
        </div>
    `;

    if (index > 0) {
        div.querySelector('.btn-remove-q').onclick = () => div.remove();
    }

    container.appendChild(div);
}

export function initQuizEditor() {
    const form = document.getElementById('quiz-form');
    if (!form) return;

    form.onsubmit = async (e) => {
        e.preventDefault();

        const quizId = document.getElementById('quiz-id').value;
        const title = document.getElementById('quiz-title').value;
        const questionBlocks = document.querySelectorAll('.question-block');

        const questions = Array.from(questionBlocks).map((block, index) => {
            const text = block.querySelector('.q-text').value;
            const explanation = block.querySelector('.q-explanation').value;
            const options = Array.from(block.querySelectorAll('.q-option')).map(opt => opt.value);
            const correctIndex = parseInt(block.querySelector(`input[name="correct-${index}"]:checked`).value);

            return { text, options, correctIndex, explanation };
        });

        try {
            if (quizId) {
                await updateQuiz(quizId, { title, questions });
                notyf.success("QCM mis à jour");
            } else {
                await createQuiz(state.currentCourseId, { title, questions });
                notyf.success("QCM créé");
            }

            document.getElementById('quiz-editor-modal').style.display = 'none';
            renderQuizAdmin(state.currentCourseId);
            renderQuizList(state.currentCourseId);
        } catch (err) {
            console.error(err);
            notyf.error("Erreur d'enregistrement");
        }
    };

    document.getElementById('cancel-quiz-btn').onclick = () => {
        document.getElementById('quiz-editor-modal').style.display = 'none';
    };
}


// --- Student: Quiz List & Taking ---

export async function renderQuizList(courseId) {
    const container = document.getElementById('course-quizzes-list');
    if (!container) return; // Not on course page or section missing

    if (!state.user) {
        container.innerHTML = `
            <div class="locked-content">
                <p>🔒 Connectez-vous pour accéder aux QCM de révision.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '<div class="loading-mini">Chargement...</div>';

    try {
        const quizzes = await getQuizzesByCourse(courseId);

        if (quizzes.length === 0) {
            container.innerHTML = '<p class="text-muted">Aucun QCM disponible.</p>';
            return;
        }

        container.innerHTML = quizzes.map(q => `
            <div class="quiz-card" onclick="startQuiz('${q.id}')">
                <div class="quiz-icon">📝</div>
                <div class="quiz-details">
                    <h4>${q.title}</h4>
                    <span>${q.questions.length} questions</span>
                </div>
                <div class="quiz-arrow">→</div>
            </div>
        `).join('');

        // Expose startQuiz to global scope for onclick or add event listeners properly
        window.startQuiz = startQuiz;

    } catch (e) {
        console.error(e);
        container.innerHTML = '<p class="error-msg">Erreur de chargement.</p>';
    }
}

export async function startQuiz(quizId) {
    const quiz = await getQuizById(quizId);
    if (!quiz) return;

    currentQuiz = quiz;
    currentQuizQuestions = quiz.questions;
    currentQuestionIndex = 0;
    userAnswers = {};

    showPage('quiz-player');
    renderQuizPlayer();
}

function renderQuizPlayer() {
    const container = document.getElementById('quiz-player-container');
    const question = currentQuizQuestions[currentQuestionIndex];
    const total = currentQuizQuestions.length;

    container.innerHTML = `
        <div class="quiz-header">
            <h3>${currentQuiz.title}</h3>
            <span class="quiz-progress-txt">Question ${currentQuestionIndex + 1} / ${total}</span>
        </div>
        <div class="quiz-progress-bar">
            <div class="fill" style="width: ${((currentQuestionIndex + 1) / total) * 100}%"></div>
        </div>
        
        <div class="quiz-question-card">
            <h4 class="quiz-question-text">${question.text}</h4>
            
            <div class="quiz-options">
                ${question.options.map((opt, i) => `
                    <div class="quiz-option ${userAnswers[currentQuestionIndex] === i ? 'selected' : ''}" 
                         onclick="selectAnswer(${i})">
                        <span class="opt-letter">${String.fromCharCode(65 + i)}</span>
                        <span class="opt-text">${opt}</span>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="quiz-controls">
            ${currentQuestionIndex > 0 ?
            `<button class="btn-secondary" onclick="prevQuestion()">Précédent</button>` : '<div></div>'}
            
            ${currentQuestionIndex < total - 1 ?
            `<button class="btn-primary" onclick="nextQuestion()">Suivant</button>` :
            `<button class="btn-success" onclick="finishQuiz()">Terminer</button>`}
        </div>
    `;

    window.selectAnswer = (index) => {
        userAnswers[currentQuestionIndex] = index;
        renderQuizPlayer(); // Re-render to show selection
    };

    window.nextQuestion = () => {
        if (currentQuestionIndex < currentQuizQuestions.length - 1) {
            currentQuestionIndex++;
            renderQuizPlayer();
        }
    };

    window.prevQuestion = () => {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            renderQuizPlayer();
        }
    };

    window.finishQuiz = async () => {
        // Calculate score
        let score = 0;
        currentQuizQuestions.forEach((q, i) => {
            if (userAnswers[i] === q.correctIndex) {
                score++;
            }
        });

        // Save result
        try {
            await submitQuizResult(currentQuiz.id, score, currentQuizQuestions.length, userAnswers);
        } catch (e) {
            console.error("Failed to save result", e);
        }

        showQuizResults(score, currentQuizQuestions.length);
    };
}

async function showQuizResults(score, total) {
    const container = document.getElementById('quiz-player-container');
    const percentage = Math.round((score / total) * 100);
    let message = '';
    if (percentage === 100) message = "Parfait ! 🏆";
    else if (percentage >= 80) message = "Excellent ! 🌟";
    else if (percentage >= 50) message = "Bien joué ! 👍";
    else message = "Continue à réviser ! 💪";

    // Check for next quiz
    let nextQuizBtn = '';
    try {
        const quizzes = await getQuizzesByCourse(currentQuiz.courseId);
        // Assuming quizzes are sorted by createdAt ASC
        const currentIndex = quizzes.findIndex(q => q.id === currentQuiz.id);
        if (currentIndex !== -1 && currentIndex < quizzes.length - 1) {
            const nextQuiz = quizzes[currentIndex + 1];
            nextQuizBtn = `<button class="btn-success" onclick="startQuiz('${nextQuiz.id}')">Suite : ${nextQuiz.title} →</button>`;
        }
    } catch (e) {
        console.error("Error finding next quiz", e);
    }

    container.innerHTML = `
        <div class="quiz-result-card">
            <h3>Résultat</h3>
            <div class="score-circle">
                <span>${score}/${total}</span>
            </div>
            <p class="score-message">${message}</p>
            <div class="quiz-result-actions" style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                ${nextQuizBtn}
                <button class="btn-secondary" onclick="startQuiz('${currentQuiz.id}')">Recommencer</button>
                <button class="btn-primary" onclick="showPage('course-detail')">Retour au cours</button>
            </div>
        </div>

        <div class="quiz-correction">
            <h4>Correction</h4>
            ${currentQuizQuestions.map((q, i) => {
        const isCorrect = userAnswers[i] === q.correctIndex;
        const userAnswerTxt = q.options[userAnswers[i]] || "Aucune réponse";
        const correctTxt = q.options[q.correctIndex];

        return `
                <div class="correction-item ${isCorrect ? 'correct' : 'incorrect'}">
                    <p class="q-title"><strong>Q${i + 1}:</strong> ${q.text}</p>
                    <p class="user-ans">Votre réponse : ${userAnswerTxt} ${isCorrect ? '✅' : '❌'}</p>
                    ${!isCorrect ? `<p class="correct-ans">Bonne réponse : ${correctTxt}</p>` : ''}
                    ${q.explanation ? `<p class="explanation">💡 ${q.explanation}</p>` : ''}
                </div>
                `;
    }).join('')}
        </div>
    `;
}
