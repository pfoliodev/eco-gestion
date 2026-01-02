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

// Submit a quiz result
export async function submitQuizResult(quizId, courseId, score, totalQuestions, answers, duration = null) {
    if (!auth.currentUser) throw new Error("User must be logged in");

    const resultData = {
        quizId,
        courseId,
        userId: auth.currentUser.uid,
        score,
        totalQuestions,
        answers, // Optional: store individual answers for review
        duration, // Time in seconds to complete the quiz
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
