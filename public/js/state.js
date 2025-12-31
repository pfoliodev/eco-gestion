export const state = {
    courses: [],
    isAdmin: false,
    currentCourseId: null,
    user: null, // From origin/main
    // Flashcard features (HEAD)
    flashcards: [],
    userProgress: {},
    currentStudySession: null,
    features: {
        flashcards: true,
        badges: true,
        reminders: true,
        quiz: true
    }
};

export function setFeatures(features) {
    state.features = { ...state.features, ...features };
}

export function setCourses(newCourses) {
    state.courses = newCourses;
}

export function setIsAdmin(val) {
    state.isAdmin = val;
}

export function setCurrentCourseId(id) {
    state.currentCourseId = id;
}

export function setUser(user) {
    state.user = user;
}

export function setFlashcards(newFlashcards) {
    state.flashcards = newFlashcards;
}

export function setUserProgress(progress) {
    state.userProgress = progress;
}

export function updateCardProgress(flashcardId, progressData) {
    state.userProgress[flashcardId] = progressData;
}

export function setCurrentStudySession(session) {
    state.currentStudySession = session;
}