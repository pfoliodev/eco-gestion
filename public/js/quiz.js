import { db } from './firebase.js';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    where,
    serverTimestamp,
    getDoc,
    orderBy
} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { auth } from './firebase.js';

const quizzesCollection = collection(db, 'quizzes');
const resultsCollection = collection(db, 'quiz_results');

// --- CRUD Operations ---

// Create a new quiz
export async function createQuiz(courseId, quizData) {
    if (!auth.currentUser) throw new Error("Unauthorized");

    // quizData should contain: title, questions (array of objects)
    const data = {
        courseId,
        ...quizData,
        createdAt: serverTimestamp(),
        authorId: auth.currentUser.uid
    };

    return await addDoc(quizzesCollection, data);
}

// Update an existing quiz
export async function updateQuiz(quizId, quizData) {
    if (!auth.currentUser) throw new Error("Unauthorized");
    const docRef = doc(db, 'quizzes', quizId);
    return await updateDoc(docRef, { ...quizData, updatedAt: serverTimestamp() });
}

// Delete a quiz
export async function deleteQuiz(quizId) {
    if (!auth.currentUser) throw new Error("Unauthorized");
    return await deleteDoc(doc(db, 'quizzes', quizId));
}

// Fetch quizzes for a specific course
export async function getQuizzesByCourse(courseId) {
    const q = query(quizzesCollection, where("courseId", "==", courseId));
    const snapshot = await getDocs(q);

    return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateA - dateB;
        });
}

// Get a single quiz by ID
export async function getQuizById(quizId) {
    const docRef = doc(db, 'quizzes', quizId);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() };
}

// --- Results Handling ---

// Submit a quiz result with Intelligence Bonus
export async function submitQuizResult(quizId, courseId, score, totalQuestions, answers, duration = null) {
    if (!auth.currentUser) throw new Error("User must be logged in");

    // Default XP calculation (e.g., 10 XP per correct answer)
    let xpEarned = score * 10;
    let bonusXp = 0;

    // --- INTELLIGENCE BONUS ---
    try {
        // Fetch user's active pet from pets collection
        const petsCollection = collection(db, 'pets');
        const petsQuery = query(petsCollection, where('userId', '==', auth.currentUser.uid), where('isActive', '==', true));
        const petsSnap = await getDocs(petsQuery);

        if (!petsSnap.empty) {
            const petData = petsSnap.docs[0].data();
            const petDocId = petsSnap.docs[0].id;

            if (petData.stats) {
                const intellect = petData.stats.intelligence || 0;
                if (intellect > 0) {
                    // Bonus: +1% XP per INT point
                    bonusXp = Math.floor(xpEarned * (intellect / 100));
                    xpEarned += bonusXp;
                    console.log(`🧠 Intelligence Bonus applied: +${bonusXp} XP`);
                }

                // Pet XP & Leveling Logic
                let petLevel = petData.level || 1;
                let petXp = petData.xp || 0;
                const xpGain = 10 + Math.floor(score * 2);

                petXp += xpGain;

                // Threshold: Level * 100 (Level 1 needs 100, Level 2 needs 200...)
                const xpNeeded = petLevel * 100;

                let leveledUp = false;
                if (petXp >= xpNeeded) {
                    petXp -= xpNeeded;
                    petLevel++;
                    leveledUp = true;

                    // Boost Stats on Level Up
                    const currentStats = petData.stats || { intelligence: 1, creativity: 1, social: 1 };
                    currentStats.intelligence += 1;
                    currentStats.creativity += 1;
                    currentStats.social += 1;

                    // Update the pet in the pets collection
                    await updateDoc(doc(db, 'pets', petDocId), {
                        xp: petXp,
                        level: petLevel,
                        stats: currentStats
                    });

                    if (leveledUp) {
                        console.log(`🎉 LEVEL UP! ${petData.name} is now level ${petLevel}`);
                    }
                } else {
                    // Just update xp if no level up
                    await updateDoc(doc(db, 'pets', petDocId), {
                        xp: petXp
                    });
                }
            }
        }
    } catch (e) {
        console.warn("Could not apply pet bonus:", e);
    }

    const resultData = {
        quizId,
        courseId,
        userId: auth.currentUser.uid,
        score,
        totalQuestions,
        answers, // Optional: store individual answers for review
        duration, // Time in seconds to complete the quiz
        xpEarned, // Track earned XP
        bonusXp,  // Track bonus part
        completedAt: serverTimestamp()
    };

    return await addDoc(resultsCollection, resultData);
}

// Get user's best score for a quiz
export async function getUserQuizBestScore(quizId) {
    if (!auth.currentUser) return null;

    // Fetch all user results for this quiz indirectly by fetching all results for user
    // or just fetch by userId and filter by quizId in JS to avoid composite index
    const q = query(resultsCollection, where("userId", "==", auth.currentUser.uid));
    const snapshot = await getDocs(q);

    const results = snapshot.docs
        .map(doc => doc.data())
        .filter(r => r.quizId === quizId)
        .sort((a, b) => (b.score / b.totalQuestions) - (a.score / a.totalQuestions));

    return results.length > 0 ? results[0] : null;
}

// Get all previous attempts for a user on a quiz
export async function getUserQuizHistory(quizId) {
    if (!auth.currentUser) return [];

    const q = query(resultsCollection, where("userId", "==", auth.currentUser.uid));
    const snapshot = await getDocs(q);

    return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(r => r.quizId === quizId)
        .sort((a, b) => (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0));
}

// Get all user best scores mapped by courseId
export async function getAllUserBestScores() {
    if (!auth.currentUser) return {};

    const q = query(resultsCollection, where("userId", "==", auth.currentUser.uid));
    const snapshot = await getDocs(q);

    const bestScores = {};

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const courseId = data.courseId;
        if (!courseId || !data.totalQuestions) return;

        const percent = (data.score / data.totalQuestions) * 100;

        if (!bestScores[courseId] || percent > bestScores[courseId].percent) {
            bestScores[courseId] = {
                percent: Math.round(percent),
                validated: percent >= 80
            };
        }
    });

    return bestScores;
}
