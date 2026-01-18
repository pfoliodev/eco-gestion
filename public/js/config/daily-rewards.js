export const DAILY_REWARDS = [
    { day: 1, type: 'coins', amount: 10, label: '10 Coins' },
    { day: 2, type: 'coins', amount: 20, label: '20 Coins' },
    { day: 3, type: 'coins', amount: 30, label: '30 Coins' },
    { day: 4, type: 'coins', amount: 50, label: '50 Coins' },
    { day: 5, type: 'coins', amount: 75, label: '75 Coins' },
    { day: 6, type: 'coins', amount: 100, label: '100 Coins' },
    { day: 7, type: 'mega_box', amount: 1, label: 'Coffre Épique' } // Special reward
];

export const STREAK_RULES = {
    RESET_HOURS: 48, // Used to buffer "yesterday" check if needed, but logic is usually Date based
    CYCLE_DAYS: 7
};
