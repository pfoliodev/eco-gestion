import { PROFESSOR, STARTER_PETS } from './config/pets.js';
import { db } from './firebase.js';
import { doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";

export class PetSelection {
    constructor(user) {
        this.user = user;
        this.container = null;
        this.currentDialogueIndex = 0;
        this.isTyping = false;
        this.selectedPet = null;
    }

    async checkAndTrigger() {
        if (!this.user) return;

        // Check if user already has a pet
        const userRef = doc(db, "users", this.user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            if (!userData.pet) {
                this.initUI();
            }
        }
    }

    initUI() {
        // Create modal container
        this.container = document.createElement('div');
        this.container.className = 'pet-selection-overlay';
        this.container.innerHTML = `
            <div class="pet-selection-container">
                <div class="professor-area">
                    <img src="${PROFESSOR.image}" alt="Professor Vladimir" class="professor-image">
                    <div class="dialogue-box">
                        <span class="professor-name">${PROFESSOR.name}</span>
                        <p class="dialogue-text"></p>
                        <button class="dialogue-next-btn">▼</button>
                    </div>
                </div>
                <div class="pets-selection-area">
                    ${STARTER_PETS.map(pet => `
                        <div class="pet-card" data-pet-id="${pet.id}" style="--pet-color: ${pet.color}">
                            <div class="pet-image-container">
                                <img src="${pet.image}" alt="${pet.name}" class="pet-image">
                            </div>
                            <div class="pet-info">
                                <h3 class="pet-name">${pet.name}</h3>
                                <span class="pet-type">${pet.type}</span>
                                <p class="pet-description" style="display:block; font-size: 0.8rem; margin-top: 0.5rem; opacity: 0.8;">${pet.description}</p>
                            </div>
                            <button class="pet-select-btn">Choisir ${pet.name}</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        document.body.appendChild(this.container);

        // Bind events
        this.bindEvents();

        // Start animation sequence
        setTimeout(() => this.container.classList.add('active'), 100);
        setTimeout(() => {
            this.container.querySelector('.professor-image').classList.add('visible');
        }, 500);
        setTimeout(() => {
            this.container.querySelector('.dialogue-box').classList.add('visible');
            this.typeDialogue(PROFESSOR.dialogues.intro[0]);
        }, 1000);
    }

    bindEvents() {
        const nextBtn = this.container.querySelector('.dialogue-next-btn');
        const petCards = this.container.querySelectorAll('.pet-card');

        // Next dialogue
        nextBtn.addEventListener('click', () => {
            if (this.isTyping) {
                // Skip typing
                this.finishTyping();
            } else {
                this.nextDialogue();
            }
        });

        // Pet selection
        petCards.forEach(card => {
            card.addEventListener('click', (e) => {
                const petId = card.dataset.petId;
                this.selectPet(petId);
            });

            // Also handle button click specifically if needed, but card click covers it
        });
    }

    typeDialogue(text) {
        // Clear any existing typing timeout
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
            this.typingTimeout = null;
        }

        const dialogueEl = this.container.querySelector('.dialogue-text');
        dialogueEl.textContent = '';
        this.isTyping = true;
        this.currentText = text;

        let i = 0;
        const speed = 30; // ms per char

        const type = () => {
            if (i < text.length) {
                dialogueEl.textContent += text.charAt(i);
                i++;
                this.typingTimeout = setTimeout(type, speed);
            } else {
                this.isTyping = false;
                this.typingTimeout = null;
            }
        };
        type();
    }

    finishTyping() {
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
            this.typingTimeout = null;
        }

        const dialogueEl = this.container.querySelector('.dialogue-text');
        dialogueEl.textContent = this.currentText;
        this.isTyping = false;
    }

    nextDialogue() {
        if (this.currentDialogueIndex < PROFESSOR.dialogues.intro.length - 1) {
            this.currentDialogueIndex++;
            this.typeDialogue(PROFESSOR.dialogues.intro[this.currentDialogueIndex]);

            // Show pets when we reach the specific line (e.g., the last one)
            if (this.currentDialogueIndex === PROFESSOR.dialogues.intro.length - 1) {
                this.container.querySelector('.pets-selection-area').classList.add('visible');
            }
        }
    }

    selectPet(petId) {
        // UI feedback
        this.container.querySelectorAll('.pet-card').forEach(c => c.classList.remove('selected'));
        const card = this.container.querySelector(`.pet-card[data-pet-id="${petId}"]`);
        card.classList.add('selected');

        this.selectedPet = STARTER_PETS.find(p => p.id === petId);

        // Professor confirmation
        this.typeDialogue(PROFESSOR.dialogues.confirmation(this.selectedPet.name));

        // Transform the next button to "Confirm" or add a confirm button
        // For this flow, let's just create a confirm action after a brief delay or change the button

        const nextBtn = this.container.querySelector('.dialogue-next-btn');
        nextBtn.textContent = "CONFIRMER";

        // Remove old listener and add new one for confirmation
        const newBtn = nextBtn.cloneNode(true);
        nextBtn.parentNode.replaceChild(newBtn, nextBtn);

        newBtn.addEventListener('click', () => this.confirmSelection());
    }

    async confirmSelection() {
        if (!this.selectedPet) return;

        try {
            const userRef = doc(db, "users", this.user.uid);

            // Initial pet state
            const petData = {
                id: this.selectedPet.id,
                name: this.selectedPet.name,
                nickname: this.selectedPet.name, // Can be changed later
                type: this.selectedPet.type,
                image: this.selectedPet.image,
                color: this.selectedPet.color,
                level: 1,
                xp: 0,
                stats: this.selectedPet.stats,
                evolutionStage: 1,
                obtainedAt: new Date().toISOString()
            };

            await updateDoc(userRef, {
                pet: petData
            });

            // Close modal with animation
            this.container.classList.remove('active');
            setTimeout(() => {
                this.container.remove();
                // Reload or trigger UI update
                window.location.reload();
            }, 500);

        } catch (error) {
            console.error("Error saving pet:", error);
            alert("Une erreur est survenue lors de l'adoption. Veuillez réessayer.");
        }
    }
}
