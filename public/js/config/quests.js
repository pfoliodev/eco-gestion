/**
 * Quest Configuration
 * ===================
 * Defines all available daily and weekly quests.
 */

export const DAILY_QUESTS = [
    {
        id: 'daily_3_quiz',
        title: 'Étudiant assidu',
        description: 'Complète 3 QCM',
        icon: '📝',
        target: 3,
        metric: 'quiz_complete',
        rewards: { coins: 50, xp: 25 }
    },
    {
        id: 'daily_perfect',
        title: 'Sans faute',
        description: 'Obtiens un score parfait sur un QCM',
        icon: '🎯',
        target: 1,
        metric: 'quiz_perfect',
        rewards: { coins: 75, xp: 40 }
    },
    {
        id: 'daily_course',
        title: 'Curieux',
        description: 'Consulte 2 cours',
        icon: '📖',
        target: 2,
        metric: 'course_view',
        rewards: { coins: 30, xp: 15 }
    },
    {
        id: 'daily_login',
        title: 'Fidèle',
        description: 'Connecte-toi aujourd\'hui',
        icon: '👋',
        target: 1,
        metric: 'login',
        rewards: { coins: 20, xp: 10 }
    },
    {
        id: 'daily_5_quiz',
        title: 'Machine de guerre',
        description: 'Complète 5 QCM',
        icon: '⚡',
        target: 5,
        metric: 'quiz_complete',
        rewards: { coins: 100, xp: 50 }
    }
];

export const WEEKLY_QUESTS = [
    {
        id: 'weekly_10_quiz',
        title: 'Champion de la semaine',
        description: 'Complète 10 QCM cette semaine',
        icon: '🏆',
        target: 10,
        metric: 'quiz_complete',
        rewards: { coins: 200, xp: 100 }
    },
    {
        id: 'weekly_3_perfect',
        title: 'Perfectionniste',
        description: 'Obtiens 3 scores parfaits',
        icon: '💎',
        target: 3,
        metric: 'quiz_perfect',
        rewards: { coins: 250, xp: 120 }
    },
    {
        id: 'weekly_streak_5',
        title: 'Régularité',
        description: 'Connecte-toi 5 jours différents',
        icon: '🔥',
        target: 5,
        metric: 'login_day',
        rewards: { coins: 150, xp: 75 }
    },
    {
        id: 'weekly_15_course',
        title: 'Bibliophile',
        description: 'Consulte 15 cours',
        icon: '📚',
        target: 15,
        metric: 'course_view',
        rewards: { coins: 175, xp: 85 }
    }
];

// Number of quests to assign
export const QUEST_CONFIG = {
    DAILY_COUNT: 3,      // Random quests assigned each day
    WEEKLY_COUNT: 2,     // Random quests assigned each week
    RESET_HOUR: 0,       // Midnight (local time)
    WEEKLY_RESET_DAY: 1  // Monday
};
