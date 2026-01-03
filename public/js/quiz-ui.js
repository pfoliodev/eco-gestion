import {
    createQuiz,
    updateQuiz,
    deleteQuiz,
    getQuizzesByCourse,
    getQuizById,
    submitQuizResult,
    getUserQuizBestScore
} from './quiz.js';
import { checkAndUnlockBadges, updateStreakData, updatePerfectStreakData } from './badges.js';
import { notyf, showPage } from './ui.js';
import { state } from './state.js';
import { auth } from './firebase.js';
import { addCoins, showCoinGainAnimation, updateBalanceDisplay } from './coins.js';
import { calculateQuizReward } from './config/economy.js';

// --- Global UI State ---
let currentQuiz = null;
let currentQuizQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = {};
let quizStartTime = null;
let lastQuizCoinsEarned = null; // Store coins earned for display

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
    const questionId = data?.id || Math.random().toString(36).substr(2, 9);
    div.innerHTML = `
        <div class="question-header">
            <h5>Question</h5>
            ${index >= 0 ? '<button type="button" class="btn-remove-q text-danger">Supprimer</button>' : ''}
        </div>
        <div class="form-group">
            <label>Énoncé</label>
            <input type="text" class="q-text" required value="${data ? data.text : ''}" placeholder="Quelle est la capitale de...">
        </div>
        <div class="options-grid">
            ${[0, 1, 2, 3].map(i => `
                <div class="option-row">
                    <input type="radio" name="correct-${questionId}" value="${i}" ${data && data.correctIndex === i ? 'checked' : (i === 0 && !data ? 'checked' : '')}>
                    <input type="text" class="q-option" required value="${data ? data.options[i] : ''}" placeholder="Réponse ${i + 1}">
                </div>
            `).join('')}
        </div>
        <div class="form-group">
            <label>Explication (visible après réponse)</label>
            <textarea class="q-explanation" rows="2" placeholder="Car Paris est la capitale...">${data ? data.explanation || '' : ''}</textarea>
        </div>
    `;

    div.querySelector('.btn-remove-q').onclick = () => {
        div.remove();
        // Optionnel : renvoyer un événement ou mettre à jour les labels si nécessaire
    };

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

        const questions = Array.from(questionBlocks).map((block) => {
            const text = block.querySelector('.q-text').value;
            const explanation = block.querySelector('.q-explanation').value;
            const options = Array.from(block.querySelectorAll('.q-option')).map(opt => opt.value);
            const checkedRadio = block.querySelector('input[type="radio"]:checked');
            const correctIndex = checkedRadio ? parseInt(checkedRadio.value) : 0;

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
    quizStartTime = Date.now();
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

        // Calculate duration in seconds
        const duration = quizStartTime ? Math.floor((Date.now() - quizStartTime) / 1000) : null;

        // Save result and check for badges
        try {
            await submitQuizResult(currentQuiz.id, currentQuiz.courseId, score, currentQuizQuestions.length, userAnswers, duration);
            // Update streaks
            await updateStreakData();
            await updatePerfectStreakData(score === currentQuizQuestions.length);

            // Check and unlock badges after quiz completion
            await checkAndUnlockBadges(currentQuiz.id, score, currentQuizQuestions.length, currentQuiz.title, currentQuiz.courseId, { duration });

            // Award IFH Coins for quiz completion
            const userStreak = state.user?.quizStreak || 0;
            const reward = calculateQuizReward(score, currentQuizQuestions.length, duration, userStreak);
            lastQuizCoinsEarned = reward;

            const result = await addCoins(reward.total, 'quiz_complete', currentQuiz.id, {
                quizTitle: currentQuiz.title,
                score,
                total: currentQuizQuestions.length,
                duration,
                breakdown: reward.breakdown
            });

            if (result.success) {
                updateBalanceDisplay(result.newBalance);
            }
        } catch (e) {
            console.error("Failed to save result", e);
        }

        showQuizResults(score, currentQuizQuestions.length);
    };
}

async function showQuizResults(score, total) {
    const container = document.getElementById('quiz-player-container');
    const percentage = Math.round((score / total) * 100);

    // SVG Progress logic
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    let message = '';
    let emoji = '';
    if (percentage === 100) { message = "Parfait !"; emoji = "🏆"; }
    else if (percentage >= 80) { message = "Excellent !"; emoji = "🌟"; }
    else if (percentage >= 50) { message = "Bien joué !"; emoji = "👍"; }
    else { message = "Continue à réviser !"; emoji = "💪"; }

    // Check for next quiz
    let nextQuizBtn = '';
    try {
        const quizzes = await getQuizzesByCourse(currentQuiz.courseId);
        const currentIndex = quizzes.findIndex(q => q.id === currentQuiz.id);
        if (currentIndex !== -1 && currentIndex < quizzes.length - 1) {
            const nextQuiz = quizzes[currentIndex + 1];
            nextQuizBtn = `<button class="btn-success" onclick="startQuiz('${nextQuiz.id}')">QCM Suivant →</button>`;
        }
    } catch (e) {
        console.error("Error finding next quiz", e);
    }

    container.innerHTML = `
        <div class="quiz-result-card animate__animated animate__fadeInUp">
            <h3>${currentQuiz.title}</h3>
            
            <div class="score-circle-container">
                <svg class="score-circle-svg" width="160" height="160">
                    <circle class="score-circle-bg" cx="80" cy="80" r="${radius}"></circle>
                    <circle class="score-circle-bar" cx="80" cy="80" r="${radius}" 
                            style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${circumference};"></circle>
                </svg>
                <div class="score-circle-text">
                    <span class="score-value-major">${score}</span>
                    <span class="score-value-total">sur ${total}</span>
                </div>
            </div>

            <p class="score-message">${message} ${emoji}</p>
            
            ${lastQuizCoinsEarned ? `
            <div class="coins-earned-card">
                <div class="coins-earned-header">
                    <span class="coin-icon-large">🪙</span>
                    <span class="coins-total">+${lastQuizCoinsEarned.total} IFH</span>
                </div>
                <div class="coins-breakdown">
                    ${lastQuizCoinsEarned.breakdown.map(b => `
                        <div class="coins-breakdown-item">
                            <span class="breakdown-label">${b.label}</span>
                            <span class="breakdown-amount">+${b.amount}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
            
            <div class="quiz-result-actions">
                ${nextQuizBtn}
                <button class="btn-secondary" onclick="startQuiz('${currentQuiz.id}')">🔄 Recommencer</button>
                <button class="btn-primary" onclick="showPage('course-detail')">🏠 Retour au cours</button>
            </div>
        </div>

        <div class="quiz-correction">
            <h4>Correction détaillée</h4>
            <div class="correction-grid">
                ${currentQuizQuestions.map((q, i) => {
        const isCorrect = userAnswers[i] === q.correctIndex;
        const userAnswerTxt = q.options[userAnswers[i]] || "Aucune réponse";
        const correctTxt = q.options[q.correctIndex];

        return `
                        <div class="correction-item ${isCorrect ? 'correct' : 'incorrect'} animate__animated animate__fadeInUp" style="animation-delay: ${i * 0.1}s">
                            <p class="q-title">Question ${i + 1}: ${q.text}</p>
                            
                            <div class="user-ans">
                                <strong>Ta réponse :</strong> ${userAnswerTxt} ${isCorrect ? '✅' : '❌'}
                            </div>
                            
                            ${!isCorrect ? `
                            <div class="correct-ans">
                                <strong>Bonne réponse :</strong> ${correctTxt}
                            </div>
                            ` : ''}
                            
                            ${q.explanation ? `
                            <div class="explanation">
                                💡 ${q.explanation}
                            </div>
                            ` : ''}
                        </div>
                    `;
    }).join('')}
            </div>
        </div>
    `;

    // Trigger score circle animation after rendering
    setTimeout(() => {
        const bar = container.querySelector('.score-circle-bar');
        if (bar) {
            bar.style.strokeDashoffset = offset;
        }
    }, 100);

    window.scrollTo({ top: 0, behavior: 'smooth' });
}
