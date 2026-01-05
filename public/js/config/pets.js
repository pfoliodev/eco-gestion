export const PROFESSOR = {
    name: "Vladimir Inalta",
    role: "Professeur & Mentor",
    dialogues: {
        intro: [
            "Bonjour ! Je suis le Professeur Vladimir Inalta.",
            "Bienvenue sur Cours de B1C2. Ici, nous apprenons à maîtriser les cours tout en s'amusant.",
            "Mais il est dangereux de partir seul ! J'ai ici 3 compagnons spéciaux pour toi.",
            "Chacun d'eux possède un potentiel unique. Leurs stats varient selon la chance !",
            "Lequel souhaites-tu adopter ?"
        ],
        confirmation: (petName) => `Tu as choisi ${petName} ? Excellent choix ! Prends-en grand soin.`,
        greeting: "Ravi de te revoir ! Comment va ton compagnon ?",
        evolution: [
            "Incroyable ! Je n'en crois pas mes yeux !",
            "Ton compagnon a atteint le niveau 16 et est prêt à transcender sa forme actuelle !",
            "C'est un moment rare et précieux. Es-tu prêt à assister à son évolution ?"
        ],
        evolutionComplete: (oldName, newName) => `Félicitations ! ${oldName} a évolué en ${newName} ! Quelle magnificence !`
    },
    image: "/images/prof/vladimir.png"
};

export const STARTER_PETS = [
    {
        id: "feerale",
        name: "Féerale",
        type: "Fée / Nature",
        description: "Une créature douce et bienveillante. Elle évolue grâce à l'entraide et aux interactions sociales.",
        flavorText: "Féerale papillonne joyeusement autour de vous, répandant une douce lumière apaisante.",
        image: "/images/pets/feerale.png",
        color: "#ffdef0",
        // Base stats (niveau 1 sans IV)
        baseStats: {
            intelligence: 5,
            creativity: 7,
            social: 6
        },
        // Croissance par niveau (Augmentée pour être visible)
        statGrowth: {
            intelligence: 0.8,
            creativity: 1.0,
            social: 0.9
        },
        // Legacy stats (kept for backward compatibility)
        stats: {
            intelligence: 3,
            creativity: 5,
            social: 4
        },
        evolution: {
            id: "celestiale",
            name: "Célestiale",
            type: "Fée / Cosmique",
            description: "Transcendée par la connaissance, ses ailes portent désormais l'éclat des galaxies.",
            flavorText: "Célestiale flotte majestueusement, ses ailes cosmiques scintillant d'étoiles infinies.",
            image: "/images/pets/celestiale.png",
            color: "#d4b8ff",
            // Evolved form has better growth
            baseStats: {
                intelligence: 8,
                creativity: 10,
                social: 9
            },
            statGrowth: {
                intelligence: 1.2,
                creativity: 1.5,
                social: 1.3
            }
        }
    },
    {
        id: "voltor",
        name: "Voltor",
        type: "Électrique / Vitesse",
        description: "Vif et énergique ! Il adore quand tu complètes tes tâches rapidement et sans erreur.",
        flavorText: "Voltor crépite d'énergie ! Il semble impatient de foncer sur le prochain défi.",
        image: "/images/pets/voltor.png",
        color: "#ffeb3b",
        baseStats: {
            intelligence: 6,
            creativity: 5,
            social: 5
        },
        statGrowth: {
            intelligence: 0.9,
            creativity: 0.8,
            social: 0.8
        },
        evolution: {
            id: "voltonnerre",
            name: "Voltonnerre",
            type: "Foudre / Vitesse",
            description: "Une boule d'énergie pure capable de générer des orages. Sa vitesse est inégalée.",
            flavorText: "L'air crépite autour de Voltonnerre. Il est prêt à foudroyer n'importe quel obstacle !",
            image: "/images/pets/voltonnerre.png",
            color: "#facc15",
            baseStats: {
                intelligence: 9,
                creativity: 8,
                social: 7
            },
            statGrowth: {
                intelligence: 1.3,
                creativity: 1.1,
                social: 1.1
            }
        },
        stats: {
            intelligence: 4,
            creativity: 3,
            social: 3
        },

    },
    {
        id: "ombrage",
        name: "Ombrage",
        type: "Ombre / Mystère",
        description: "Observateur silencieux. Il voit ce que les autres ignorent et apprend de chaque erreur.",
        flavorText: "Ombrage vous observe en silence depuis l'obscurité, le regard perçant de sagesse.",
        image: "/images/pets/ombrage.png",
        color: "#a855f7",
        baseStats: {
            intelligence: 7,
            creativity: 6,
            social: 4
        },
        statGrowth: {
            intelligence: 1.0,
            creativity: 0.9,
            social: 0.7
        },
        stats: {
            intelligence: 5,
            creativity: 4,
            social: 2
        },
        evolution: {
            id: "lunombre",
            name: "Lunombre",
            type: "Ombre / Lunaire",
            description: "Maître des arcanes lunaires. Ses runes brillent d'une lueur protectrice.",
            flavorText: "Lunombre projette une aura mystique. La lueur de ses lunes dévoile des secrets anciens.",
            image: "/images/pets/lunombre.png",
            color: "#6b2c91",
            baseStats: {
                intelligence: 10,
                creativity: 9,
                social: 7
            },
            statGrowth: {
                intelligence: 1.4,
                creativity: 1.2,
                social: 1.0
            }
        }
    }
];

// XP configuration
export const XP_CONFIG = {
    // XP needed to reach next level = currentLevel + 100
    getLevelXP: (level) => level + 100,

    // XP rewards
    REWARDS: {
        QUIZ_COMPLETE: 25,        // Base XP for completing a quiz
        QUIZ_PERFECT: 50,         // Bonus for perfect score
        DAILY_LOGIN: 15,          // Daily connection bonus
        COURSE_VIEW: 5            // Viewing a course
    }
};

// Evolution levels (for future multi-evolution support)
export const EVOLUTION_LEVELS = {
    FIRST: 16,
    SECOND: 36,  // Future
    THIRD: 55    // Future
};
