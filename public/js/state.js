export let courses = [];
export let isAdmin = false;
export let currentCourseId = null;

export function setCourses(newCourses) {
    courses = newCourses;
}

export function setIsAdmin(val) {
    isAdmin = val;
}

export function setCurrentCourseId(id) {
    currentCourseId = id;
}
