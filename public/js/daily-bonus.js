
import { db, auth } from './firebase.js';
import { doc, getDoc, updateDoc, increment, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { DAILY_REWARDS, STREAK_RULES } from './config/daily-rewards.js';
import { addCoins } from './coins.js';
import { notyf } from './ui.js';

/**
 * Check if user is eligible for specific daily bonus
 */
export async function checkDailyBonus() {
    if (!auth.currentUser) return;

    try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) return;

        const userData = userSnap.data();
        const lastLogin = userData.stats?.lastLoginDate?.toDate();
        const currentStreak = userData.stats?.streak || 0;

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Midnight today

        let newStreak = currentStreak;
        let showModal = false;

        let diffDays = null;

        if (!lastLogin) {
            // First time login ever or since feature add
            newStreak = 1;
            showModal = true;
        } else {
            const lastLoginDate = new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate());
            const diffTime = Math.abs(today - lastLoginDate);
            diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 0) {
                // Already logged in today
                const lastBonus = userData.stats?.lastBonusDate?.toDate();
                if (lastBonus) {
                    const lastBonusDay = new Date(lastBonus.getFullYear(), lastBonus.getMonth(), lastBonus.getDate());
                    if (lastBonusDay.getTime() === today.getTime()) {
                        return; // Already claimed today
                    }
                }
                // If not claimed but logged in today (re-opened tab), show modal to claim
                showModal = true;
            } else if (diffDays === 1) {
                // Consecutive day
                newStreak = currentStreak + 1;
                showModal = true;
            } else {
                // Missed a day
                newStreak = 1;
                showModal = true;
            }
        }

        console.log("Daily Bonus Check:", { lastLogin, diffDays, lastBonus: userData.stats?.lastBonusDate });

        if (showModal) {
            console.log("Showing Daily Bonus Modal! Streak:", newStreak);
            renderDailyBonusModal(newStreak);
        } else {
            console.log("No bonus to show.");
        }

    } catch (error) {
        console.error("Error checking daily bonus:", error);
    }
}

// Debug Helper
window.forceDailyBonus = (streak = 1) => renderDailyBonusModal(streak);

/**
 * Render the Daily Bonus Modal
 */
function renderDailyBonusModal(streak) {
    // Remove existing if any
    const existing = document.querySelector('.daily-bonus-overlay');
    if (existing) existing.remove();

    // Calculate Cycle Day (1-7)
    const cycleDay = ((streak - 1) % STREAK_RULES.CYCLE_DAYS) + 1;

    // Get Reward
    const reward = DAILY_REWARDS.find(r => r.day === cycleDay) || DAILY_REWARDS[0];

    const overlay = document.createElement('div');
    overlay.className = 'daily-bonus-overlay';

    // Generate Grid HTML
    const gridHtml = DAILY_REWARDS.map(r => {
        const isCompleted = r.day < cycleDay;
        const isToday = r.day === cycleDay;
        const statusClass = isCompleted ? 'completed' : (isToday ? 'active today' : '');
        const icon = r.type === 'mega_box' ? '🎁' : '🪙';

        return `
            <div class="streak-card ${statusClass}">
                <span class="streak-day">J${r.day}</span>
                <span class="streak-icon">${isCompleted ? '✅' : icon}</span>
                <span class="streak-amount">${r.label}</span>
            </div>
        `;
    }).join('');

    overlay.innerHTML = `
        <div class="daily-bonus-modal">
            <div class="daily-bonus-content">
                <h2 class="daily-title">Bonus Journalier</h2>
                <p class="daily-subtitle">Série actuelle : <strong style="color: #FFD700">${streak} jours</strong> 🔥</p>
                
                <div class="streak-grid">
                    ${gridHtml}
                </div>

                <button class="btn-claim" id="btn-claim-bonus">
                    RÉCLAMER ${reward.label}
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Event Listener
    document.getElementById('btn-claim-bonus').onclick = () => claimBonus(streak, reward, overlay);
}

/**
 * Handle Claim Logic
 */
async function claimBonus(streak, reward, overlay) {
    if (!auth.currentUser) return;

    const btn = document.getElementById('btn-claim-bonus');
    btn.disabled = true;
    btn.textContent = 'Récupération...';

    try {
        const userRef = doc(db, 'users', auth.currentUser.uid);

        // Update Stats
        await updateDoc(userRef, {
            'stats.streak': streak,
            'stats.lastLoginDate': serverTimestamp(),
            'stats.lastBonusDate': serverTimestamp()
        });

        // Give Reward
        if (reward.type === 'coins') {
            await addCoins(reward.amount, 'daily_bonus', `day_${streak}`, { streak: streak });
        } else if (reward.type === 'mega_box') {
            // Handle Special Reward
            await addCoins(500, 'daily_bonus_mega', `day_${streak}_mega`);
            notyf.success('Coffre Épique ouvert ! +500 Coins ! 💎');
        }

        // Close UI
        overlay.style.animation = 'fadeOut 0.3s forwards';
        setTimeout(() => overlay.remove(), 300);

        // Success Visuals
        notyf.success(`Bonus récupéré ! +${reward.amount} Coins`);

        // Trigger Confetti
        showConfetti();

    } catch (error) {
        console.error("Claim error:", error);
        notyf.error("Erreur lors de la récupération.");
        btn.disabled = false;
        btn.textContent = 'Réessayer';
    }
}

/**
 * Simple Confetti Implementation
 */
function showConfetti() {
    // Check if canvas-confetti library is available
    if (window.confetti) {
        window.confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#FFD700', '#FFA500', '#10B981', '#3B82F6']
        });
        return;
    }

    // Fallback: CSS Particle Explosion
    const colors = ['#FFD700', '#FFA500', '#10B981', '#FF5252'];
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'fixed';
        particle.style.left = '50%';
        particle.style.top = '50%';
        particle.style.width = '10px';
        particle.style.height = '10px';
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        particle.style.borderRadius = '50%';
        particle.style.pointerEvents = 'none';
        particle.style.zIndex = '9999';

        const angle = Math.random() * Math.PI * 2;
        const velocity = 5 + Math.random() * 10;
        const tx = Math.cos(angle) * velocity * 20;
        const ty = Math.sin(angle) * velocity * 20;

        particle.animate([
            { transform: 'translate(0, 0) scale(1)', opacity: 1 },
            { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 }
        ], {
            duration: 1000 + Math.random() * 500,
            easing: 'cubic-bezier(0, .9, .57, 1)'
        }).onfinish = () => particle.remove();

        document.body.appendChild(particle);
    }
}
