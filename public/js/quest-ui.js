/**
 * Quest UI Module
 * ================
 * Renders quest cards and handles UI interactions.
 */

import { getActiveQuests, claimQuestReward, getClaimableQuestCount } from './quests.js';
import { notyf } from './ui.js';
import { updateBalanceDisplay } from './coins.js';
import { auth } from './firebase.js';

// ============================================
// RENDERING
// ============================================

/**
 * Render the full quests section
 * @param {HTMLElement} container - Container element
 */
export async function renderQuestsSection(container) {
    if (!container) return;

    if (!auth.currentUser) {
        container.innerHTML = `
            <div class="quests-login-required">
                <div class="icon">🔒</div>
                <p>Connectez-vous pour accéder aux quêtes quotidiennes.</p>
                <a href="#login" class="btn-primary">Se connecter</a>
            </div>
        `;
        return;
    }

    container.innerHTML = '<div class="loading-spinner">Chargement des quêtes...</div>';

    try {
        const { daily, weekly } = await getActiveQuests();

        container.innerHTML = `
            <div class="quests-container">
                <!-- Daily Quests -->
                <div class="quests-section">
                    <div class="quests-header">
                        <h3><span class="quests-icon">☀️</span> Quêtes du Jour</h3>
                        <span class="quests-reset-timer" id="daily-reset-timer"></span>
                    </div>
                    <div class="quests-grid" id="daily-quests-grid">
                        ${daily.length > 0
                ? daily.map(q => renderQuestCard(q)).join('')
                : '<p class="no-quests">Aucune quête quotidienne active.</p>'
            }
                    </div>
                </div>

                <!-- Weekly Quests -->
                <div class="quests-section weekly">
                    <div class="quests-header">
                        <h3><span class="quests-icon">📅</span> Quêtes de la Semaine</h3>
                        <span class="quests-reset-timer" id="weekly-reset-timer"></span>
                    </div>
                    <div class="quests-grid" id="weekly-quests-grid">
                        ${weekly.length > 0
                ? weekly.map(q => renderQuestCard(q)).join('')
                : '<p class="no-quests">Aucune quête hebdomadaire active.</p>'
            }
                    </div>
                </div>
            </div>
        `;

        // Attach claim handlers
        attachClaimHandlers(container);

        // Update reset timers
        updateResetTimers();

    } catch (error) {
        console.error('Error rendering quests:', error);
        container.innerHTML = '<p class="error-msg">Erreur de chargement des quêtes.</p>';
    }
}

/**
 * Render a single quest card
 */
function renderQuestCard(quest) {
    const progress = quest.progress || 0;
    const target = quest.target || 1;
    const percent = Math.min(Math.round((progress / target) * 100), 100);
    const isComplete = progress >= target;
    const isClaimed = quest.claimed;

    let statusClass = '';
    let buttonHtml = '';

    if (isClaimed) {
        statusClass = 'claimed';
        buttonHtml = `<div class="quest-claimed-badge">✓ Récupéré</div>`;
    } else if (isComplete) {
        statusClass = 'claimable';
        buttonHtml = `<button class="btn-claim-quest" data-quest-id="${quest.id}">
            <span class="claim-icon">🎁</span> Récupérer
        </button>`;
    } else {
        buttonHtml = `<div class="quest-progress-text">${progress} / ${target}</div>`;
    }

    return `
        <div class="quest-card ${statusClass}" data-quest-id="${quest.id}">
            <div class="quest-icon">${quest.icon || '📋'}</div>
            <div class="quest-content">
                <h4 class="quest-title">${quest.title}</h4>
                <p class="quest-description">${quest.description}</p>
                <div class="quest-progress-bar">
                    <div class="quest-progress-fill" style="width: ${percent}%"></div>
                </div>
            </div>
            <div class="quest-rewards">
                <span class="reward-coins">🪙 ${quest.rewards?.coins || 0}</span>
            </div>
            <div class="quest-action">
                ${buttonHtml}
            </div>
        </div>
    `;
}

/**
 * Attach click handlers to claim buttons
 */
function attachClaimHandlers(container) {
    container.querySelectorAll('.btn-claim-quest').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const questId = btn.dataset.questId;
            btn.disabled = true;
            btn.innerHTML = '<span class="loading-dots">...</span>';

            const result = await claimQuestReward(questId);

            if (result.success) {
                notyf.success(`🎁 +${result.rewards.coins} Coins !`);

                // Update balance display
                const { getUserBalance } = await import('./coins.js');
                const newBalance = await getUserBalance();
                updateBalanceDisplay(newBalance);

                // Refresh quest display
                await renderQuestsSection(container.closest('.account-section') || container);
            } else {
                notyf.error(result.error || 'Erreur lors de la récupération');
                btn.disabled = false;
                btn.innerHTML = '<span class="claim-icon">🎁</span> Récupérer';
            }
        });
    });
}

/**
 * Update the reset timer displays
 */
function updateResetTimers() {
    const dailyTimer = document.getElementById('daily-reset-timer');
    const weeklyTimer = document.getElementById('weekly-reset-timer');

    if (dailyTimer) {
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);
        const diff = midnight - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        dailyTimer.textContent = `Reset dans ${hours}h ${minutes}m`;
    }

    if (weeklyTimer) {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
        weeklyTimer.textContent = `Reset dans ${daysUntilMonday} jour${daysUntilMonday > 1 ? 's' : ''}`;
    }
}

// ============================================
// BADGE NOTIFICATION
// ============================================

/**
 * Update the quest badge count in the sidebar
 */
export async function updateQuestBadge() {
    const badge = document.getElementById('quest-badge');
    if (!badge) return;

    const count = await getClaimableQuestCount();

    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

// ============================================
// COMPLETION TOAST
// ============================================

/**
 * Show a toast when a quest is completed
 */
export function showQuestCompleteToast(questTitle, rewards) {
    notyf.success({
        message: `✨ Quête terminée: ${questTitle}`,
        duration: 4000
    });
}

// ============================================
// INIT
// ============================================

/**
 * Initialize quest UI on page load
 */
export async function initQuestUI() {
    await updateQuestBadge();
}
