/**
 * Quests Module
 * ==============
 * Core logic for daily/weekly quest system.
 */

import { db, auth } from './firebase.js';
import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    serverTimestamp,
    Timestamp
} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { DAILY_QUESTS, WEEKLY_QUESTS, QUEST_CONFIG } from './config/quests.js';
import { addCoins } from './coins.js';

// ============================================
// DYNAMIC CONFIGURATION
// ============================================

let cachedConfig = {
    daily: DAILY_QUESTS,
    weekly: WEEKLY_QUESTS,
    config: QUEST_CONFIG
};

/**
 * Load quest configuration from Firestore
 * Falls back to static config if missing
 */
export async function loadQuestConfig() {
    try {
        const configRef = doc(db, 'settings', 'questConfig');
        const configSnap = await getDoc(configRef);

        if (configSnap.exists()) {
            const data = configSnap.data();
            cachedConfig = {
                daily: data.daily || DAILY_QUESTS,
                weekly: data.weekly || WEEKLY_QUESTS,
                config: { ...QUEST_CONFIG, ...(data.params || {}) }
            };
            console.log("Loaded dynamic quest config");
        }
    } catch (e) {
        console.warn("Failed to load quest config, using defaults:", e);
    }
}

/**
 * Save new configuration (Admin Only)
 */
export async function saveQuestConfig(newConfig) {
    try {
        const configRef = doc(db, 'settings', 'questConfig');
        await setDoc(configRef, newConfig, { merge: true });

        // Update local cache
        if (newConfig.daily) cachedConfig.daily = newConfig.daily;
        if (newConfig.weekly) cachedConfig.weekly = newConfig.weekly;
        if (newConfig.params) cachedConfig.config = { ...cachedConfig.config, ...newConfig.params };

        return { success: true };
    } catch (e) {
        console.error("Error saving config:", e);
        return { success: false, error: e };
    }
}

export function getDailyQuests() { return cachedConfig.daily; }
export function getWeeklyQuests() { return cachedConfig.weekly; }
export function getQuestParams() { return cachedConfig.config; }

// ============================================
// QUEST ASSIGNMENT
// ============================================

/**
 * Get the start of today (midnight) as a Timestamp
 */
function getTodayStart() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Timestamp.fromDate(now);
}

/**
 * Get the start of the current week (Monday midnight) as a Timestamp
 */
function getWeekStart() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return Timestamp.fromDate(monday);
}

/**
 * Get end of today (tomorrow midnight)
 */
function getTodayEnd() {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    return Timestamp.fromDate(now);
}

/**
 * Get end of current week (Sunday 23:59)
 */
function getWeekEnd() {
    const monday = getWeekStart().toDate();
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return Timestamp.fromDate(sunday);
}

/**
 * Shuffle array and pick N random items
 */
function pickRandom(arr, count) {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, arr.length));
}

/**
 * Assign daily quests to user (called on login/init)
 * Only assigns if no valid daily quests exist
 */
export async function assignDailyQuests() {
    if (!auth.currentUser) return;

    const userId = auth.currentUser.uid;
    const questsRef = collection(db, 'users', userId, 'quests');
    const todayStart = getTodayStart();

    // Check if user already has today's daily quests
    const existingSnap = await getDocs(questsRef);
    const existingDailies = existingSnap.docs.filter(d => {
        const data = d.data();
        return data.type === 'daily' && data.assignedAt?.toDate() >= todayStart.toDate();
    });

    if (existingDailies.length >= getQuestParams().DAILY_COUNT) {
        // console.log("Daily quests already assigned");
        return; // Already has today's quests
    }

    // Clear old daily quests
    for (const docSnap of existingSnap.docs) {
        if (docSnap.data().type === 'daily') {
            await deleteDoc(doc(questsRef, docSnap.id));
        }
    }

    // Assign new quests
    const availableQuests = getDailyQuests();
    const countToAssign = getQuestParams().DAILY_COUNT - existingDailies.length;

    if (countToAssign <= 0) return;

    const selected = pickRandom(availableQuests, countToAssign);
    const todayEnd = getTodayEnd();

    for (const quest of selected) {
        await setDoc(doc(questsRef, quest.id), {
            templateId: quest.id,
            type: 'daily',
            title: quest.title,
            description: quest.description,
            icon: quest.icon,
            target: quest.target,
            metric: quest.metric,
            rewards: quest.rewards,
            progress: 0,
            claimed: false,
            assignedAt: serverTimestamp(),
            expiresAt: todayEnd
        });
    }

    console.log('✅ Daily quests assigned');
}

/**
 * Assign weekly quests to user
 * Only assigns if no valid weekly quests exist
 */
export async function assignWeeklyQuests() {
    if (!auth.currentUser) return;

    const userId = auth.currentUser.uid;
    const questsRef = collection(db, 'users', userId, 'quests');
    const weekStart = getWeekStart();

    // Check if user already has this week's quests
    const existingSnap = await getDocs(questsRef);
    const existingWeeklies = existingSnap.docs.filter(d => {
        const data = d.data();
        return data.type === 'weekly' && data.assignedAt?.toDate() >= weekStart.toDate();
    });

    if (existingWeeklies.length >= getQuestParams().WEEKLY_COUNT) {
        return; // Already has this week's quests
    }

    // Clear old weekly quests
    for (const docSnap of existingSnap.docs) {
        if (docSnap.data().type === 'weekly') {
            await deleteDoc(doc(questsRef, docSnap.id));
        }
    }

    // Assign new weekly quests
    const availableQuests = getWeeklyQuests();
    const countToAssign = getQuestParams().WEEKLY_COUNT;
    const selected = pickRandom(availableQuests, countToAssign);
    const weekEnd = getWeekEnd();

    for (const quest of selected) {
        await setDoc(doc(questsRef, quest.id), {
            templateId: quest.id,
            type: 'weekly',
            title: quest.title,
            description: quest.description,
            icon: quest.icon,
            target: quest.target,
            metric: quest.metric,
            rewards: quest.rewards,
            progress: 0,
            claimed: false,
            assignedAt: serverTimestamp(),
            expiresAt: weekEnd
        });
    }

    console.log('✅ Weekly quests assigned');
}

/**
 * Initialize quests on login (assigns if needed)
 */
export async function initializeQuests() {
    await assignDailyQuests();
    await assignWeeklyQuests();
}

// ============================================
// QUEST PROGRESS
// ============================================

/**
 * Get all active quests for the current user
 */
export async function getActiveQuests() {
    if (!auth.currentUser) return { daily: [], weekly: [] };

    const userId = auth.currentUser.uid;
    const questsRef = collection(db, 'users', userId, 'quests');
    const snapshot = await getDocs(questsRef);

    const now = new Date();
    const daily = [];
    const weekly = [];

    snapshot.docs.forEach(docSnap => {
        const data = { id: docSnap.id, ...docSnap.data() };

        // Check if expired
        if (data.expiresAt && data.expiresAt.toDate() < now) {
            return; // Skip expired
        }

        if (data.type === 'daily') {
            daily.push(data);
        } else if (data.type === 'weekly') {
            weekly.push(data);
        }
    });

    return { daily, weekly };
}

/**
 * Update progress for all quests matching a metric
 * @param {string} metric - The metric type (quiz_complete, course_view, etc.)
 * @param {number} amount - Amount to add (default 1)
 */
export async function updateQuestProgress(metric, amount = 1) {
    if (!auth.currentUser) return;

    const userId = auth.currentUser.uid;
    const questsRef = collection(db, 'users', userId, 'quests');
    const snapshot = await getDocs(questsRef);

    const now = new Date();
    const updates = [];

    for (const docSnap of snapshot.docs) {
        const data = docSnap.data();

        // Skip if expired, already claimed, or different metric
        if (data.expiresAt && data.expiresAt.toDate() < now) continue;
        if (data.claimed) continue;
        if (data.metric !== metric) continue;

        const newProgress = Math.min((data.progress || 0) + amount, data.target);
        const updateData = { progress: newProgress };

        // Mark as completed if target reached
        if (newProgress >= data.target && !data.completedAt) {
            updateData.completedAt = serverTimestamp();
        }

        updates.push(updateDoc(doc(questsRef, docSnap.id), updateData));
    }

    await Promise.all(updates);

    if (updates.length > 0) {
        console.log(`📊 Quest progress updated: ${metric} +${amount}`);
    }
}

/**
 * Claim rewards for a completed quest
 * @param {string} questId - The quest document ID
 */
export async function claimQuestReward(questId) {
    if (!auth.currentUser) return { success: false, error: 'Not logged in' };

    const userId = auth.currentUser.uid;
    const questRef = doc(db, 'users', userId, 'quests', questId);
    const questSnap = await getDoc(questRef);

    if (!questSnap.exists()) {
        return { success: false, error: 'Quest not found' };
    }

    const quest = questSnap.data();

    // Validation
    if (quest.claimed) {
        return { success: false, error: 'Already claimed' };
    }

    if (quest.progress < quest.target) {
        return { success: false, error: 'Quest not complete' };
    }

    // Award coins
    const coinsAwarded = quest.rewards?.coins || 0;
    if (coinsAwarded > 0) {
        await addCoins(coinsAwarded, 'quest_reward', questId, {
            questTitle: quest.title
        });
    }

    // TODO: Award XP to pet if needed

    // Mark as claimed
    await updateDoc(questRef, {
        claimed: true,
        claimedAt: serverTimestamp()
    });

    return {
        success: true,
        rewards: quest.rewards,
        questTitle: quest.title
    };
}

/**
 * Get count of claimable (completed but not claimed) quests
 */
export async function getClaimableQuestCount() {
    if (!auth.currentUser) return 0;

    const { daily, weekly } = await getActiveQuests();
    const all = [...daily, ...weekly];

    return all.filter(q => q.progress >= q.target && !q.claimed).length;
}

// ============================================
// HELPERS FOR HOOKS
// ============================================

/**
 * Called when a quiz is completed
 * @param {boolean} isPerfect - Was it a perfect score?
 */
export async function onQuizComplete(isPerfect = false) {
    await updateQuestProgress('quiz_complete', 1);
    if (isPerfect) {
        await updateQuestProgress('quiz_perfect', 1);
    }
}

/**
 * Called when a course is viewed
 */
export async function onCourseView() {
    await updateQuestProgress('course_view', 1);
}

/**
 * Called on login
 */
export async function onLogin() {
    await updateQuestProgress('login', 1);
    await updateQuestProgress('login_day', 1); // For weekly streak
}
