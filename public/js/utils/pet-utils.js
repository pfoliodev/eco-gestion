/**
 * Pet Utility Functions
 * Handles stat calculations, IVs, quality ratings, and evolution logic
 */

// ============================================
// CONSTANTS
// ============================================

export const STAT_CONFIG = {
    IV_MIN: 0,
    IV_MAX: 15,
    EVOLUTION_BONUS_MIN: 2,
    EVOLUTION_BONUS_MAX: 5,
    FIRST_EVOLUTION_LEVEL: 16,
    MAX_LEVEL: 100
};

// Quality tiers based on total IVs (max = 45)
export const QUALITY_TIERS = [
    { name: 'Commun', stars: 1, emoji: '⭐', minIV: 0, maxIV: 15, color: '#9ca3af' },
    { name: 'Rare', stars: 2, emoji: '⭐⭐', minIV: 16, maxIV: 30, color: '#3b82f6' },
    { name: 'Épique', stars: 3, emoji: '⭐⭐⭐', minIV: 31, maxIV: 40, color: '#a855f7' },
    { name: 'Légendaire', stars: 4, emoji: '🌟', minIV: 41, maxIV: 45, color: '#f59e0b' }
];

// ============================================
// IV GENERATION
// ============================================

/**
 * Generate a single random IV
 * @returns {number} Random IV between IV_MIN and IV_MAX
 */
export function generateSingleIV() {
    return Math.floor(Math.random() * (STAT_CONFIG.IV_MAX - STAT_CONFIG.IV_MIN + 1)) + STAT_CONFIG.IV_MIN;
}

/**
 * Generate random IVs for all stats
 * @returns {object} Object with intelligence, creativity, social IVs
 */
export function generateRandomIVs() {
    return {
        intelligence: generateSingleIV(),
        creativity: generateSingleIV(),
        social: generateSingleIV()
    };
}

/**
 * Calculate total IVs
 * @param {object} ivs - IVs object
 * @returns {number} Sum of all IVs
 */
export function getTotalIVs(ivs) {
    if (!ivs) return 0;
    return (ivs.intelligence || 0) + (ivs.creativity || 0) + (ivs.social || 0);
}

// ============================================
// QUALITY RATING
// ============================================

/**
 * Get quality tier based on total IVs
 * @param {object} ivs - IVs object
 * @returns {object} Quality tier object
 */
export function getQualityTier(ivs) {
    if (!ivs) return QUALITY_TIERS[0]; // Return common tier for null IVs

    const total = getTotalIVs(ivs);

    for (let i = QUALITY_TIERS.length - 1; i >= 0; i--) {
        if (total >= QUALITY_TIERS[i].minIV) {
            return QUALITY_TIERS[i];
        }
    }

    return QUALITY_TIERS[0]; // Default to common
}

/**
 * Get quality display HTML
 * @param {object} ivs - IVs object
 * @returns {string} HTML string for quality display
 */
export function getQualityHTML(ivs) {
    if (!ivs) return ''; // Return empty for null IVs
    const tier = getQualityTier(ivs);
    return `<span class="pet-quality" style="color: ${tier.color};" title="${tier.name} (IV: ${getTotalIVs(ivs)}/45)">${tier.emoji}</span>`;
}

// ============================================
// STAT CALCULATION
// ============================================

/**
 * Calculate a single final stat
 * @param {number} baseStat - Base stat of the species
 * @param {number} growth - Growth rate per level
 * @param {number} level - Current level
 * @param {number} iv - Individual Value
 * @param {number} evolutionBonus - Bonus from evolution (default 0)
 * @returns {number} Final calculated stat (floored)
 */
export function calculateSingleStat(baseStat, growth, level, iv, evolutionBonus = 0) {
    const finalStat = baseStat + (level * growth) + iv + evolutionBonus;
    return Math.floor(finalStat);
}

/**
 * Calculate all stats for a pet
 * @param {object} petDefinition - Pet species definition from STARTER_PETS
 * @param {object} petInstance - Pet instance data (level, ivs, evolutionBonus)
 * @returns {object} Calculated stats
 */
export function calculatePetStats(petDefinition, petInstance) {
    const level = petInstance.level || 1;
    const ivs = petInstance.ivs || { intelligence: 0, creativity: 0, social: 0 };
    const evolutionBonus = petInstance.evolutionBonus || { intelligence: 0, creativity: 0, social: 0 };

    // Use baseStats and statGrowth from definition, fallback to old stats format
    const baseStats = petDefinition.baseStats || petDefinition.stats || { intelligence: 3, creativity: 3, social: 3 };
    const growth = petDefinition.statGrowth || { intelligence: 0.15, creativity: 0.15, social: 0.15 };

    return {
        intelligence: calculateSingleStat(
            baseStats.intelligence,
            growth.intelligence,
            level,
            ivs.intelligence || 0,
            evolutionBonus.intelligence || 0
        ),
        creativity: calculateSingleStat(
            baseStats.creativity,
            growth.creativity,
            level,
            ivs.creativity || 0,
            evolutionBonus.creativity || 0
        ),
        social: calculateSingleStat(
            baseStats.social,
            growth.social,
            level,
            ivs.social || 0,
            evolutionBonus.social || 0
        )
    };
}

// ============================================
// LEVELING SYSTEM
// ============================================

/**
 * Calculate XP needed to reach next level
 * Formula: level * 100
 * @param {number} currentLevel - Current level
 * @returns {number} XP needed for next level
 */
export function getXPForNextLevel(currentLevel) {
    return currentLevel * 100;
}

/**
 * Calculate total XP needed from level 1 to target level
 * @param {number} targetLevel - Target level
 * @returns {number} Total cumulative XP
 */
export function getTotalXPForLevel(targetLevel) {
    // Sum of (level + 100) from 1 to (targetLevel - 1)
    // = Sum of levels + 100 * (targetLevel - 1)
    // = ((targetLevel - 1) * targetLevel / 2) + 100 * (targetLevel - 1)
    if (targetLevel <= 1) return 0;
    const n = targetLevel - 1;
    return (n * (n + 1)) / 2 + 100 * n;
}

/**
 * Check if pet can level up and return new level
 * @param {number} currentLevel - Current level
 * @param {number} currentXP - Current XP (for this level, not total)
 * @returns {object} { canLevelUp, xpRemaining, newLevel }
 */
export function checkLevelUp(currentLevel, currentXP) {
    if (currentLevel >= STAT_CONFIG.MAX_LEVEL) {
        return { canLevelUp: false, xpRemaining: currentXP, newLevel: currentLevel };
    }

    const xpNeeded = getXPForNextLevel(currentLevel);

    if (currentXP >= xpNeeded) {
        const xpRemaining = currentXP - xpNeeded;
        return { canLevelUp: true, xpRemaining, newLevel: currentLevel + 1 };
    }

    return { canLevelUp: false, xpRemaining: currentXP, newLevel: currentLevel };
}

/**
 * Process XP gain and handle multiple level ups
 * @param {number} currentLevel - Current level
 * @param {number} currentXP - Current XP for this level
 * @param {number} xpGain - XP to add
 * @returns {object} { newLevel, newXP, levelsGained }
 */
export function processXPGain(currentLevel, currentXP, xpGain) {
    let level = currentLevel;
    let xp = currentXP + xpGain;
    let levelsGained = 0;

    while (level < STAT_CONFIG.MAX_LEVEL) {
        const result = checkLevelUp(level, xp);
        if (result.canLevelUp) {
            level = result.newLevel;
            xp = result.xpRemaining;
            levelsGained++;
        } else {
            break;
        }
    }

    return { newLevel: level, newXP: xp, levelsGained };
}

// ============================================
// EVOLUTION SYSTEM
// ============================================

/**
 * Check if pet can evolve
 * @param {object} petData - Pet data with level and evolved status
 * @returns {boolean} True if evolution is available
 */
export function canEvolve(petData) {
    if (!petData) return false;
    if (petData.evolved) return false; // Already evolved
    return petData.level >= STAT_CONFIG.FIRST_EVOLUTION_LEVEL;
}

/**
 * Generate random evolution stat boost
 * @returns {object} Bonus stats object
 */
export function generateEvolutionBoost() {
    const min = STAT_CONFIG.EVOLUTION_BONUS_MIN;
    const max = STAT_CONFIG.EVOLUTION_BONUS_MAX;

    return {
        intelligence: Math.floor(Math.random() * (max - min + 1)) + min,
        creativity: Math.floor(Math.random() * (max - min + 1)) + min,
        social: Math.floor(Math.random() * (max - min + 1)) + min
    };
}

/**
 * Apply evolution to pet data
 * @param {object} currentPetData - Current pet data
 * @param {object} evolvedForm - Evolution form from pet definition
 * @returns {object} New pet data with evolution applied
 */
export function applyEvolution(currentPetData, evolvedForm) {
    const evolutionBoost = generateEvolutionBoost();

    // Merge existing evolution bonus with new one
    const existingBonus = currentPetData.evolutionBonus || { intelligence: 0, creativity: 0, social: 0 };
    const totalBonus = {
        intelligence: (existingBonus.intelligence || 0) + evolutionBoost.intelligence,
        creativity: (existingBonus.creativity || 0) + evolutionBoost.creativity,
        social: (existingBonus.social || 0) + evolutionBoost.social
    };

    return {
        ...currentPetData,
        id: evolvedForm.id,
        name: evolvedForm.name,
        type: evolvedForm.type,
        image: evolvedForm.image,
        color: evolvedForm.color,
        evolved: true,
        evolvedAt: new Date(),
        evolutionBonus: totalBonus,
        lastEvolutionBoost: evolutionBoost // Store the boost for display
    };
}

// ============================================
// PET CREATION
// ============================================

/**
 * Create a new pet instance with random IVs
 * @param {object} petDefinition - Pet species definition
 * @returns {object} New pet instance data
 */
export function createNewPetInstance(petDefinition) {
    const ivs = generateRandomIVs();

    return {
        id: petDefinition.id,
        name: petDefinition.name,
        type: petDefinition.type,
        image: petDefinition.image,
        color: petDefinition.color,
        level: 1,
        xp: 0,
        ivs: ivs,
        evolutionBonus: { intelligence: 0, creativity: 0, social: 0 },
        evolved: false,
        obtainedAt: new Date().toISOString(),
        instanceId: generateInstanceId() // Unique ID for this instance
    };
}

/**
 * Generate unique instance ID
 * @returns {string} Unique instance ID
 */
export function generateInstanceId() {
    return `pet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
