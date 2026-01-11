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
// RENDERING (ACCOUNT PAGE)
// ============================================

/**
 * Render the full quests section (Account Page)
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
                        ${renderQuestListHTML(daily)}
                    </div>
                </div>

                <!-- Weekly Quests -->
                <div class="quests-section weekly">
                    <div class="quests-header">
                        <h3><span class="quests-icon">📅</span> Quêtes de la Semaine</h3>
                        <span class="quests-reset-timer" id="weekly-reset-timer"></span>
                    </div>
                    <div class="quests-grid" id="weekly-quests-grid">
                        ${renderQuestListHTML(weekly)}
                    </div>
                </div>
            </div>
        `;

        // Attach claim handlers (refresh full section)
        attachClaimHandlers(container, () => renderQuestsSection(container));

        // Update reset timers
        updateResetTimers();

    } catch (error) {
        console.error('Error rendering quests:', error);
        container.innerHTML = '<p class="error-msg">Erreur de chargement des quêtes.</p>';
    }
}

/**
 * Helper to render HTML for a list of quests
 */
function renderQuestListHTML(quests) {
    if (!quests || quests.length === 0) {
        return '<p class="no-quests">Aucune quête active.</p>';
    }
    return quests.map(q => renderQuestCard(q)).join('');
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
 * @param {HTMLElement} containerScope - Scope to search for buttons
 * @param {Function} refreshCallback - Function to call after successful claim
 */
function attachClaimHandlers(containerScope, refreshCallback) {
    containerScope.querySelectorAll('.btn-claim-quest').forEach(btn => {
        // Clone to remove old listeners if re-binding not handled upstream
        // But here we re-render HTML usually so it's fresh elements.

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

                // Update Badge
                await updateQuestBadge();

                // Refresh UI via callback
                if (refreshCallback) await refreshCallback();

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

    if (dailyTimer) dailyTimer.textContent = getResetText('daily');
    if (weeklyTimer) weeklyTimer.textContent = getResetText('weekly');
}

function getResetText(type) {
    const now = new Date();
    if (type === 'daily') {
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);
        const diff = midnight - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `Reset dans ${hours}h ${minutes}m`;
    } else {
        const dayOfWeek = now.getDay();
        const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
        return `Reset dans ${daysUntilMonday} jour${daysUntilMonday > 1 ? 's' : ''}`;
    }
}

// ============================================
// GLOBAL MODALUI
// ============================================

let currentModalTab = 'daily';

export async function initQuestModal() {
    const fab = document.getElementById('quest-fab');
    const modal = document.getElementById('quest-modal');
    const closeBtn = document.getElementById('close-quest-modal');
    const tabs = document.querySelectorAll('.quest-tab');

    // Setup FAB
    if (fab) {
        fab.addEventListener('click', () => {
            // Only open if logged in
            if (!auth.currentUser) {
                window.location.hash = '#login';
                return;
            }
            openQuestModal();
        });
    }

    if (!modal) return;

    // Close button
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    // Outside click
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Tab Switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentModalTab = tab.dataset.tab;
            renderModalContent();
        });
    });
}

async function openQuestModal() {
    const modal = document.getElementById('quest-modal');
    if (!modal) return;

    modal.style.display = 'flex';
    renderModalContent();
}

async function renderModalContent() {
    const list = document.getElementById('quest-modal-list');
    const timer = document.getElementById('quest-modal-timer');

    if (!list) return;

    list.innerHTML = '<div class="loading-spinner">...</div>';

    const { daily, weekly } = await getActiveQuests();
    const quests = currentModalTab === 'daily' ? daily : weekly;

    list.innerHTML = renderQuestListHTML(quests);

    if (timer) {
        timer.textContent = getResetText(currentModalTab);
    }

    attachClaimHandlers(list, () => renderModalContent());
}

// ============================================
// BADGE NOTIFICATION
// ============================================

export async function updateQuestBadge() {
    const count = await getClaimableQuestCount();

    // Sidebar badge
    const badge = document.getElementById('quest-badge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }

    // FAB Badge (New)
    const fabBadge = document.getElementById('quest-fab-badge');
    if (fabBadge) {
        fabBadge.textContent = '!';
        fabBadge.style.display = count > 0 ? 'flex' : 'none';

        // Add pulse animation if claimable
        if (count > 0) {
            fabBadge.style.animation = 'bounce 1s infinite';
        } else {
            fabBadge.style.animation = 'none';
        }
    }
}

// ============================================
// COMPLETION TOAST
// ============================================

export function showQuestCompleteToast(questTitle, rewards) {
    notyf.success({
        message: `✨ Quête terminée: ${questTitle}`,
        duration: 4000
    });
}

// ============================================
// INIT
// ============================================

export async function initQuestUI() {
    await updateQuestBadge();
    await initQuestModal();
}


