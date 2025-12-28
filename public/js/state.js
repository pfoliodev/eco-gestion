export const state = {
    courses: [],
    isAdmin: false,
    currentCourseId: null,
    user: null
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

export function setUser(user) {
    state.user = user;
}