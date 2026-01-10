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
    getDoc
} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { auth } from './firebase.js';
import { getQuizzesByCourse, createQuiz } from './quiz.js';
import { state } from './state.js';

const evaluationsCollection = collection(db, 'evaluations');

// --- CRUD Operations ---

export async function createEvaluation(data) {
    if (!auth.currentUser) throw new Error("Unauthorized");

    const evaluationData = {
        ...data,
        createdAt: serverTimestamp(),
        authorId: auth.currentUser.uid,
        active: true
    };

    return await addDoc(evaluationsCollection, evaluationData);
}

export async function updateEvaluation(id, data) {
    if (!auth.currentUser) throw new Error("Unauthorized");
    const docRef = doc(db, 'evaluations', id);
    return await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
}

export async function deleteEvaluation(id) {
    if (!auth.currentUser) throw new Error("Unauthorized");
    return await deleteDoc(doc(db, 'evaluations', id));
}

export async function getEvaluations() {
    const snapshot = await getDocs(evaluationsCollection);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getEvaluationsByCategory(categoryId) {
    const q = query(evaluationsCollection, where("categoryId", "==", categoryId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// --- Logic ---

export async function startEvaluation(evaluationId) {
    // 1. Fetch Evaluation Config
    const evalRef = doc(db, 'evaluations', evaluationId);
    const evalSnap = await getDoc(evalRef);
    if (!evalSnap.exists()) throw new Error("Assessment not found");
    const evaluation = evalSnap.data();

    if (!evaluation.tags || evaluation.tags.length === 0) {
        console.warn("Evaluation has no tags defined.");
        return null;
    }

    // 2. Fetch ALL quizzes (inefficient but safe for now, better to query by course if possible)
    // Since evaluations are per category, we can try to fetch quizzes for courses in that category.
    // However, quizzes are stored by 'courseId'. We don't have a direct index of quizzes by category.
    // We first need to get all courses in this category.

    // We assume 'state.courses' is loaded if this is called from the UI. 
    // If not, we might miss data. Ideally we should query firestore, but let's rely on state for now or fetch all quizzes.
    // Fetching all quizzes might be heavy. 
    // Alternative: The user selects a category. fetch all quizzes for all courses in that category.

    let candidatesQuestions = [];

    // Filter courses by category from global state or fetch them
    const coursesInCategory = state.courses.filter(c => {
        // Handle category normalization if needed, similar to course.js
        const cat = c.category;
        // Simple check, might need normalization function from course.js if exported
        return cat && (cat === evaluation.categoryId || normalizeCategoryLocal(cat) === evaluation.categoryId);
        // Note: evaluation.categoryId should match the ID in CATEGORIES_CONFIG e.g. 'eco-gestion'
    });

    // Helper to normalize category logic duplicated from course.js to be safe
    // Ideally should import it, but it's not exported as a standalone valid for this context easily without refactor.
    // Let's rely on flexible matching or just iterating all if few courses.

    // Optimization: query all quizzes and filter in memory (Firestore reads = 1 collection fetch)
    // Or loop courses.

    const quizzesSnap = await getDocs(collection(db, 'quizzes'));
    const allQuizzes = quizzesSnap.docs.map(d => d.data());

    // Filter quizzes that match the tags
    const taggedQuizzes = allQuizzes.filter(q => {
        if (!q.tags || !Array.isArray(q.tags)) return false;
        // Check if quiz has AT LEAST ONE of the evaluation tags
        return q.tags.some(tag => evaluation.tags.includes(tag));
    });

    taggedQuizzes.forEach(q => {
        if (q.questions) {
            candidatesQuestions.push(...q.questions);
        }
    });

    if (candidatesQuestions.length === 0) {
        throw new Error("No questions found for these tags.");
    }

    // 3. Select random questions up to questionCount
    const count = evaluation.questionCount || 20;
    const selectedQuestions = shuffleArray(candidatesQuestions).slice(0, count);

    // 4. Construct a temporary "Quiz" object to compatible with the player
    return {
        id: `eval_${evaluationId}_${Date.now()}`, // Temporary ID
        title: evaluation.title,
        questions: selectedQuestions,
        courseId: 'evaluation_mode', // Special ID
        isEvaluation: true,
        timeLimit: evaluation.timeLimit
    };
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}


// Duplicated helper to avoid circular dependency issues if course.js imports this
function normalizeCategoryLocal(cat) {
    if (!cat) return 'autre';
    const lower = cat.toLowerCase();
    if (lower.includes('english') || lower.includes('anglais')) return 'english-hospitality';
    if (lower.includes('eco') || lower.includes('gestion')) return 'eco-gestion';
    if (lower.includes('marketing')) return 'marketing';
    if (lower.includes('accueil') || lower.includes('réception')) return 'reception';
    if (lower.includes('excel')) return 'excel';
    if (lower.includes('vin') || lower.includes('oenologie')) return 'oenologie';
    if (lower.includes('rh')) return 'rh';
    return 'autre';
}
