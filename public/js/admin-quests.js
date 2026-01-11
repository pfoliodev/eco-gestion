import {
    loadQuestConfig,
    getDailyQuests,
    getWeeklyQuests,
    getQuestParams,
    saveQuestConfig
} from './quests.js';

import { notyf } from './ui.js';

/**
 * Initialize Quest Administration
 */
export async function initQuestAdmin() {
    await loadQuestConfig();
    renderQuestConfig();

    // Attach event listeners for save buttons
    document.getElementById('save-quest-config-btn')?.addEventListener('click', handleSaveConfig);
}

/**
 * Render the quest configuration UI
 */
function renderQuestConfig() {
    const container = document.getElementById('quest-config-container');
    if (!container) return;

    const dailyQuests = getDailyQuests();
    const weeklyQuests = getWeeklyQuests();
    const params = getQuestParams();

    let html = `
        <div class="quest-params-card" style="margin-bottom: 2rem; padding: 1.5rem; background: var(--surface-color); border: 1px solid var(--border-color); border-radius: 12px;">
            <h3>⚙️ Paramètres Généraux</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                <div class="form-group">
                    <label>Quêtes Quotidiennes (par jour)</label>
                    <input type="number" id="param-daily-count" value="${params.DAILY_COUNT}" min="1" max="5">
                </div>
                <div class="form-group">
                    <label>Quêtes Hebdomadaires (par semaine)</label>
                    <input type="number" id="param-weekly-count" value="${params.WEEKLY_COUNT}" min="1" max="5">
                </div>
            </div>
        </div>

        <h3>📅 Quêtes Quotidiennes</h3>
        <div class="quests-config-grid" style="display: grid; gap: 1rem; margin-bottom: 2rem;">
            ${dailyQuests.map((q, index) => renderQuestCard(q, 'daily', index)).join('')}
        </div>

        <h3>🏆 Quêtes Hebdomadaires</h3>
        <div class="quests-config-grid" style="display: grid; gap: 1rem;">
            ${weeklyQuests.map((q, index) => renderQuestCard(q, 'weekly', index)).join('')}
        </div>
        
         <div class="form-actions" style="margin-top: 2rem; position: sticky; bottom: 20px; text-align: right;">
            <button id="save-quest-config-btn" class="btn-primary" style="padding: 1rem 2rem; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                💾 Enregistrer la configuration
            </button>
        </div>
    `;

    container.innerHTML = html;

    // Re-attach listener because we wiped innerHTML (or delegate)
    document.getElementById('save-quest-config-btn')?.addEventListener('click', handleSaveConfig);
}

function renderQuestCard(quest, type, index) {
    return `
        <div class="quest-config-card" data-type="${type}" data-index="${index}" style="background: var(--surface-hover); padding: 1rem; border-radius: 8px; border-left: 4px solid var(--primary-color);">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="font-size: 1.5rem;">${quest.icon}</span>
                    <div>
                        <strong style="display: block;">${quest.title}</strong>
                        <span style="font-size: 0.85rem; color: var(--text-secondary);">${quest.id}</span>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label style="font-size: 0.8rem;">Objectif (Target)</label>
                    <input type="number" class="config-target" value="${quest.target}" min="1" style="padding: 0.4rem;">
                </div>
                <div class="form-group">
                    <label style="font-size: 0.8rem;">Récompense (IFH)</label>
                    <input type="number" class="config-coins" value="${quest.rewards.coins}" min="0" style="padding: 0.4rem;">
                </div>
                <div class="form-group">
                    <label style="font-size: 0.8rem;">Récompense (XP)</label>
                    <input type="number" class="config-xp" value="${quest.rewards.xp}" min="0" style="padding: 0.4rem;">
                </div>
            </div>
        </div>
    `;
}

async function handleSaveConfig() {
    const btn = document.getElementById('save-quest-config-btn');
    const originalText = btn.textContent;
    btn.textContent = "Enregistrement...";
    btn.disabled = true;

    try {
        const dailyCount = parseInt(document.getElementById('param-daily-count').value);
        const weeklyCount = parseInt(document.getElementById('param-weekly-count').value);

        const newDaily = collectQuests('daily');
        const newWeekly = collectQuests('weekly');

        const newConfig = {
            daily: newDaily,
            weekly: newWeekly,
            params: {
                DAILY_COUNT: dailyCount,
                WEEKLY_COUNT: weeklyCount
            }
        };

        const result = await saveQuestConfig(newConfig);

        if (result.success) {
            notyf.success("Configuration des quêtes enregistrée !");
        } else {
            notyf.error("Erreur lors de l'enregistrement");
        }
    } catch (e) {
        console.error(e);
        notyf.error("Erreur inattendue");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

function collectQuests(type) {
    const dailyQuests = getDailyQuests(); // fallback source for immutable props
    const weeklyQuests = getWeeklyQuests();
    const source = type === 'daily' ? dailyQuests : weeklyQuests;

    const cards = document.querySelectorAll(`.quest-config-card[data-type="${type}"]`);
    return Array.from(cards).map((card, index) => {
        const original = source[index];
        return {
            ...original,
            target: parseInt(card.querySelector('.config-target').value),
            rewards: {
                coins: parseInt(card.querySelector('.config-coins').value),
                xp: parseInt(card.querySelector('.config-xp').value)
            }
        };
    });
}
