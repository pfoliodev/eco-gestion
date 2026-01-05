
import { db } from './firebase.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { ECONOMY } from './config/economy.js';

export async function seedConsumables() {
    const items = [
        {
            id: 'biscuit_charisme',
            name: "Biscuit de Charisme",
            price: 500,
            category: ECONOMY.CATEGORIES.CONSUMABLE,
            description: "Un délicieux biscuit qui vous rend irrésistible. +1 Social.",
            image: "/images/shop/biscuit_charisme.png",
            effect: { stat: 'social', value: 1 },
            active: true
        },
        {
            id: 'potion_imagination',
            name: "Potion d'Imagination",
            price: 500,
            category: ECONOMY.CATEGORIES.CONSUMABLE,
            description: "Une gorgée et les idées fusent ! +1 Créativité.",
            image: "/images/shop/potion_imagination.png",
            effect: { stat: 'creativity', value: 1 },
            active: true
        },
        {
            id: 'fiole_savoir',
            name: "Fiole de Savoir",
            price: 500,
            category: ECONOMY.CATEGORIES.CONSUMABLE,
            description: "Concentré de connaissances pur. +1 Intelligence.",
            image: "/images/shop/fiole_savoir.png",
            effect: { stat: 'intelligence', value: 1 },
            active: true
        }
    ];

    console.log("🌱 Seeding consumables...");
    for (const item of items) {
        await setDoc(doc(db, "shopItems", item.id), item);
        console.log(`✅ Added ${item.name}`);
    }
    console.log("✨ Seeding complete!");
}
