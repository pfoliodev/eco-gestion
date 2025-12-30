import { db, flashcardsCollection, auth } from './firebase.js';
import {
    getDocs,
    doc,
    deleteDoc,
    updateDoc,
    addDoc,
    serverTimestamp,
    query,
    where,
    collection,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { state, setFlashcards, setCurrentStudySession } from './state.js';
import { notyf, showPage } from './ui.js';

// ============================================
// CRUD OPERATIONS
// ============================================

/**
 * Load all flashcards from Firestore
 */
export async function loadFlashcards() {
    try {
        const querySnapshot = await getDocs(flashcardsCollection);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFlashcards(data);
        return data;
    } catch (error) {
        console.error("Error loading flashcards:", error);
        notyf.error("Erreur de chargement des flashcards.");
        return [];
    }
}

/**
 * Load flashcards for a specific course
 */
export async function loadFlashcardsByCourse(courseId) {
    try {
        const q = query(flashcardsCollection, where("courseId", "==", courseId));
        const querySnapshot = await getDocs(q);
        const courseFlashcards = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Update state.flashcards with course flashcards (merge with existing)
        const otherFlashcards = state.flashcards.filter(f => f.courseId !== courseId);
        setFlashcards([...otherFlashcards, ...courseFlashcards]);

        return courseFlashcards;
    } catch (error) {
        console.error("Error loading course flashcards:", error);
        return [];
    }
}

/**
 * Load flashcards by subject
 */
export async function loadFlashcardsBySubject(subject) {
    try {
        const q = query(flashcardsCollection, where("subject", "==", subject));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error loading subject flashcards:", error);
        return [];
    }
}

/**
 * Create a new flashcard
 */
export async function createFlashcard(flashcardData) {
    try {
        const data = {
            ...flashcardData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            status: 'synced'
        };
        const docRef = await addDoc(flashcardsCollection, data);
        const newFlashcard = { id: docRef.id, ...data, createdAt: { seconds: Math.floor(Date.now() / 1000) } };
        state.flashcards.push(newFlashcard);
        notyf.success('Flashcard créée !');
        return newFlashcard;
    } catch (error) {
        console.error("Error creating flashcard:", error);
        notyf.error("Erreur lors de la création.");
        return null;
    }
}

/**
 * Update an existing flashcard
 */
export async function updateFlashcard(flashcardId, updates) {
    try {
        updates.updatedAt = serverTimestamp();
        await updateDoc(doc(db, 'flashcards', flashcardId), updates);

        // Update local state
        const index = state.flashcards.findIndex(f => f.id === flashcardId);
        if (index !== -1) {
            state.flashcards[index] = { ...state.flashcards[index], ...updates };
        }

        notyf.success('Flashcard modifiée !');
        return true;
    } catch (error) {
        console.error("Error updating flashcard:", error);
        notyf.error("Erreur lors de la modification.");
        return false;
    }
}

/**
 * Delete a flashcard
 */
export async function deleteFlashcard(flashcardId) {
    try {
        await deleteDoc(doc(db, 'flashcards', flashcardId));
        setFlashcards(state.flashcards.filter(f => f.id !== flashcardId));
        notyf.success('Flashcard supprimée !');
        return true;
    } catch (error) {
        console.error("Error deleting flashcard:", error);
        notyf.error("Erreur lors de la suppression.");
        return false;
    }
}

/**
 * Start a simple study session (random order)
 */
export function startStudySession(flashcards, courseId = null, subject = null) {
    if (!flashcards || flashcards.length === 0) {
        notyf.error('Aucune flashcard disponible');
        return null;
    }

    // Simple shuffle of all cards
    const shuffledCards = [...flashcards].sort(() => Math.random() - 0.5);

    const session = {
        courseId,
        subject,
        cards: shuffledCards,
        currentIndex: 0,
        completed: 0,
        startTime: new Date()
    };

    setCurrentStudySession(session);
    return session;
}

/**
 * Move to next card (simple navigation)
 */
export async function nextCard() {
    const session = state.currentStudySession;
    if (!session) return null;

    // Move to next card
    session.currentIndex++;
    session.completed++;

    if (session.currentIndex >= session.cards.length) {
        // Session complete
        setCurrentStudySession(null);
        return { complete: true, reviewed: session.completed };
    }

    setCurrentStudySession(session);
    return { complete: false, currentIndex: session.currentIndex };
}

/**
 * Process answer and move to next card
 */


/**
 * Get current card in session
 */
export function getCurrentCard() {
    const session = state.currentStudySession;
    if (!session || session.currentIndex >= session.cards.length) return null;
    return session.cards[session.currentIndex];
}

// ============================================
// SYNC & UTILITIES
// ============================================

/**
 * Simple hash function for content comparison
 */
export function hashContent(content) {
    let hash = 0;
    if (!content || content.length === 0) return hash.toString();

    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
}

/**
 * Mark flashcards as outdated when course content changes
 */
export async function markFlashcardsOutdated(courseId, newContentHash) {
    const courseFlashcards = state.flashcards.filter(f => f.courseId === courseId);

    for (const flashcard of courseFlashcards) {
        if (flashcard.sourceContentHash !== newContentHash) {
            await updateFlashcard(flashcard.id, { status: 'outdated' });
        }
    }
}

/**
 * Get available subjects with flashcard counts
 */
export function getSubjectsWithFlashcards() {
    const subjectMap = {};

    state.flashcards.forEach(card => {
        if (!subjectMap[card.subject]) {
            subjectMap[card.subject] = 0;
        }
        subjectMap[card.subject]++;
    });

    return Object.entries(subjectMap).map(([subject, count]) => ({ subject, count }));
}
