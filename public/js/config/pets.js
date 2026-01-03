export const PROFESSOR = {
    name: "Vladimir Inalta",
    role: "Professeur & Mentor",
    dialogues: {
        intro: [
            "Bonjour ! Je suis le Professeur Vladimir Inalta.",
            "Bienvenue sur Cours de B1C2. Ici, nous apprenons à maîtriser les cours tout en s'amusant.",
            "Mais il est dangereux de partir seul ! J'ai ici 3 compagnons spéciaux pour toi.",
            "Chacun d'eux possède un potentiel d'évolution unique lié à tes progrès.",
            "Lequel souhaites-tu adopter ?"
        ],
        confirmation: (petName) => `Tu as choisi ${petName} ? Excellent choix ! Prends-en grand soin.`,
        greeting: "Ravi de te revoir ! Comment va ton compagnon ?"
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
        stats: {
            intelligence: 3,
            creativity: 5,
            social: 4
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
        stats: {
            intelligence: 4,
            creativity: 3,
            social: 3
        }
    },
    {
        id: "ombrage",
        name: "Ombrage",
        type: "Ombre / Mystère",
        description: "Calme et observateur. Il gagne en puissance lorsque tu résous des problèmes complexes.",
        flavorText: "Ombrage vous observe en silence depuis l'obscurité, le regard perçant de sagesse.",
        image: "/images/pets/ombrage.png",
        color: "#5c5470",
        stats: {
            intelligence: 5,
            creativity: 4,
            social: 2
        }
    }
];

