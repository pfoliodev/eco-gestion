
import { db } from './firebase.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";

async function verifyShopItems() {
    console.log("🔍 Verifying shop items...");
    const snapshot = await getDocs(collection(db, 'shopItems'));
    if (snapshot.empty) {
        console.log("❌ No items found in shopItems collection.");
        return;
    }

    let foundConsumables = 0;
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.category === 'consumable') {
            console.log(`✅ Found Consumable: ${data.name} (ID: ${doc.id})`);
            foundConsumables++;
        }
    });

    if (foundConsumables === 0) {
        console.log("❌ No consumables found! You might need to re-run the seed script.");
    } else {
        console.log(`✨ Found ${foundConsumables} consumables.`);
    }
}

verifyShopItems();
