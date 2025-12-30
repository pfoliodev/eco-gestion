export const state = {
    courses: [],
    isAdmin: false,
    currentCourseId: null,
    flashcards: [],
    userProgress: {},
    currentStudySession: null // { courseId, subject, cards, currentIndex }
};

export function setCourses(newCourses) {
    state.courses = newCourses;
}

export function setIsAdmin(val) {
    state.isAdmin = val;
}

export function setCurrentCourseId(id) {
    state.currentCourseId = id;
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