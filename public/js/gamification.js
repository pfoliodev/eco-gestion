import { db } from './firebase.js';
import { doc, getDoc, updateDoc, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { addCoins } from './coins.js';
import { notyf } from './ui.js';

/**
 * Checks and awards daily login bonus with Social stat boost
 */
export async function checkDailyBonus(user) {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);

    try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) return;

        const data = snap.data();
        const lastLogin = data.lastDailyBonus ? data.lastDailyBonus.toDate() : null;
        const now = new Date();

        // Check if different day
        if (!lastLogin || lastLogin.getDate() !== now.getDate() || lastLogin.getMonth() !== now.getMonth()) {

            // Base Bonus
            let bonusAmount = 50;
            let socialBonus = 0;

            // Apply Social Stat Bonus
            if (data.pet && data.pet.stats) {
                const social = data.pet.stats.social || 0;
                // +2% per Social point, e.g., 4 social => +8%
                socialBonus = Math.floor(bonusAmount * (social * 0.02));
            }

            const totalBonus = bonusAmount + socialBonus;

            // Award Coins
            await addCoins(totalBonus, 'daily_bonus');

            // Update User
            await updateDoc(userRef, {
                lastDailyBonus: serverTimestamp()
            });

            // Notify
            setTimeout(() => {
                if (socialBonus > 0) {
                    notyf.success(`📅 Bonus Quotidien : +${bonusAmount} 🪙 (+${socialBonus} 🤝)`);
                } else {
                    notyf.success(`📅 Bonus Quotidien : +${totalBonus} 🪙`);
                }
            }, 2000); // Delay slightly to let UI load
        }
    } catch (e) {
        console.error("Daily bonus check failed", e);
    }
}

/**
 * Randomly triggers a "Creative Discovery" (Coin drop)
 * Call this when finishing a course or major interaction
 */
export async function triggerCreativeDiscovery(user) {
    if (!user) return;

    try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        const data = snap.data();

        if (data.pet && data.pet.stats) {
            const creativity = data.pet.stats.creativity || 0;
            const baseChance = 0.1; // 10% base chance
            const chance = baseChance + (creativity * 0.05); // +5% per creativity point

            if (Math.random() < chance) {
                const amount = 10 + Math.floor(Math.random() * 20); // 10-30 coins
                await addCoins(amount, 'creative_discovery');
                notyf.success(`🎨 Inspiration Créative ! Vous trouvez +${amount} 🪙`);
            }
        }
    } catch (e) {
        console.error("Creative discovery failed", e);
    }
}
