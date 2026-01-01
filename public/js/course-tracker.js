import { markCourseAsRead } from './badges.js';

/**
 * Tracks if a user has scrolled to the bottom of the course content
 * to mark it as "read".
 */
export function initCourseReadingTracker(courseId) {
    const content = document.querySelector('.course-detail-content');
    if (!content) return;

    // Reset indicator if any
    let hasReachedBottom = false;

    const checkScroll = () => {
        if (hasReachedBottom) return;

        // Check if the bottom of the content is visible
        const rect = content.getBoundingClientRect();
        const winHeight = window.innerHeight;

        if (rect.bottom <= winHeight + 100) {
            hasReachedBottom = true;
            markCourseAsRead(courseId);
            window.removeEventListener('scroll', checkScroll);
        }
    };

    window.addEventListener('scroll', checkScroll);
    // Initial check in case it's a short course
    setTimeout(checkScroll, 500);
}
