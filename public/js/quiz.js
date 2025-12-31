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
    const q = query(quizzesCollection, where("courseId", "==", courseId), orderBy("createdAt", "asc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
export async function submitQuizResult(quizId, courseId, score, totalQuestions, answers) {
    if (!auth.currentUser) throw new Error("User must be logged in");

    const resultData = {
        quizId,
        courseId,
        userId: auth.currentUser.uid,
        score,
        totalQuestions,
        answers, // Optional: store individual answers for review
        completedAt: serverTimestamp()
    };

    return await addDoc(resultsCollection, resultData);
}

// Get user's best score for a quiz
export async function getUserQuizBestScore(quizId) {
    if (!auth.currentUser) return null;

    const q = query(
        resultsCollection,
        where("quizId", "==", quizId),
        where("userId", "==", auth.currentUser.uid),
        orderBy("score", "desc") // Get highest score
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].data();
}

// Get all previous attempts for a user on a quiz
export async function getUserQuizHistory(quizId) {
    if (!auth.currentUser) return [];

    const q = query(
        resultsCollection,
        where("quizId", "==", quizId),
        where("userId", "==", auth.currentUser.uid),
        orderBy("completedAt", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
