/**
 * IFH Coins Economy Configuration
 * ================================
 * All monetary values are centralized here for easy adjustment.
 * Modify these values to balance the in-app economy.
 */

export const ECONOMY = {
    // ============================================
    // EARNING RATES
    // ============================================

    // Quiz rewards
    QUIZ_COMPLETE: 10,          // Base reward for completing a quiz
    QUIZ_PERFECT_BONUS: 25,     // Additional bonus for 100% score
    QUIZ_SPEED_BONUS: 15,       // Bonus for completing quiz under time threshold
    QUIZ_SPEED_THRESHOLD: 60,   // Seconds - threshold for speed bonus

    // Learning rewards
    COURSE_COMPLETE: 15,        // Reward for fully reading a course
    FLASHCARD_SESSION: 5,       // Reward per flashcard study session

    // Achievement rewards
    BADGE_UNLOCK: 50,           // Reward when unlocking a badge
    FIRST_LOGIN_BONUS: 100,     // One-time bonus for new users

    // Streak rewards
    STREAK_MULTIPLIER: 1.5,     // Multiplier for daily streak (applied to quiz rewards)
    STREAK_THRESHOLD: 3,        // Days of streak needed to activate multiplier

    // ============================================
    // SPECIAL BONUSES
    // ============================================

    SUNDAY_MULTIPLIER: 2.0,     // Double coins on Sundays
    WEEKEND_MULTIPLIER: 1.25,   // 25% bonus on weekends (Sat/Sun)

    // ============================================
    // LIMITS (Anti-farming protection)
    // ============================================

    DAILY_EARN_CAP: null,       // Set to number to limit daily earnings (null = no limit)
    QUIZ_COOLDOWN: 0,           // Seconds between quiz rewards for same quiz (0 = no cooldown)

    // ============================================
    // SHOP CATEGORIES
    // ============================================

    CATEGORIES: {
        THEME: 'theme',
        FRAME: 'frame',
        BADGE: 'badge',
        BOOST: 'boost',
        AVATAR: 'avatar',
        BACKGROUND: 'background',
        COMPANION: 'companion',
        CONSUMABLE: 'consumable'
    },

    // ============================================
    // TRANSACTION TYPES
    // ============================================

    TRANSACTION_TYPES: {
        EARN: 'earn',
        SPEND: 'spend',
        TRADE_IN: 'trade_in',
        TRADE_OUT: 'trade_out',
        ADMIN_GIFT: 'admin_gift',
        REFUND: 'refund'
    },

    // ============================================
    // TRADE SETTINGS
    // ============================================

    TRADE_FEE_PERCENT: 0,       // % fee on trades (0 = no fee)
    TRADE_OFFER_EXPIRY: 7,      // Days before trade offer expires
    MAX_ITEMS_PER_TRADE: 5,     // Maximum items in a single trade
};

/**
 * Calculate total quiz reward based on performance
 * @param {number} score - User's score
 * @param {number} total - Total questions
 * @param {number} duration - Time taken in seconds
 * @param {number} streak - Current daily streak
 * @returns {object} - { base, bonuses, total, breakdown }
 */
export function calculateQuizReward(score, total, duration = null, streak = 0) {
    let base = ECONOMY.QUIZ_COMPLETE;
    const bonuses = [];

    // Perfect score bonus
    if (score === total) {
        bonuses.push({ type: 'perfect', amount: ECONOMY.QUIZ_PERFECT_BONUS, label: 'Score parfait!' });
    }

    // Speed bonus
    if (duration && duration <= ECONOMY.QUIZ_SPEED_THRESHOLD) {
        bonuses.push({ type: 'speed', amount: ECONOMY.QUIZ_SPEED_BONUS, label: 'Bonus vitesse!' });
    }

    // Calculate subtotal before multipliers
    let subtotal = base + bonuses.reduce((sum, b) => sum + b.amount, 0);

    // Streak multiplier
    if (streak >= ECONOMY.STREAK_THRESHOLD) {
        const multipliedAmount = Math.floor(subtotal * (ECONOMY.STREAK_MULTIPLIER - 1));
        if (multipliedAmount > 0) {
            bonuses.push({ type: 'streak', amount: multipliedAmount, label: `Streak x${ECONOMY.STREAK_MULTIPLIER}` });
        }
        subtotal += multipliedAmount;
    }

    // Weekend/Sunday bonus
    const today = new Date().getDay();
    if (today === 0) { // Sunday
        const sundayBonus = Math.floor(subtotal * (ECONOMY.SUNDAY_MULTIPLIER - 1));
        bonuses.push({ type: 'sunday', amount: sundayBonus, label: 'Bonus Dimanche!' });
        subtotal += sundayBonus;
    } else if (today === 6) { // Saturday
        const weekendBonus = Math.floor(subtotal * (ECONOMY.WEEKEND_MULTIPLIER - 1));
        bonuses.push({ type: 'weekend', amount: weekendBonus, label: 'Bonus Weekend!' });
        subtotal += weekendBonus;
    }

    return {
        base,
        bonuses,
        total: subtotal,
        breakdown: [
            { label: 'Quiz complété', amount: base },
            ...bonuses
        ]
    };
}

export default ECONOMY;
