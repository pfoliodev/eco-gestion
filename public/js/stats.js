/**
 * Admin Statistics Module
 * Fetches and aggregates statistics for admin dashboard
 */
import { db } from './firebase.js';
import {
    collection,
    getDocs,
    query,
    where,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";

const courseViewsCollection = collection(db, 'courseViews');
const quizResultsCollection = collection(db, 'quiz_results');
const usersCollection = collection(db, 'users');
const coursesCollection = collection(db, 'courses');

// ============================================
// COURSE STATISTICS
// ============================================

/**
 * Get statistics for all courses
 * @returns {Object} courseId -> { uniqueViews, totalViews }
 */
export async function getCourseViewStats() {
    try {
        const snapshot = await getDocs(courseViewsCollection);
        const stats = {};

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const courseId = data.courseId;
            if (!courseId) return;

            if (!stats[courseId]) {
                stats[courseId] = { uniqueViews: 0, totalViews: 0 };
            }
            stats[courseId].uniqueViews += 1;
            stats[courseId].totalViews += (data.viewCount || 1);
        });

        return stats;
    } catch (error) {
        console.error('Error fetching course view stats:', error);
        return {};
    }
}

/**
 * Get aggregated stats for all courses with course details
 * @returns {Array} Array of course objects with stats
 */
export async function getAllCourseStats() {
    try {
        const [courseSnapshot, viewStats, quizStats] = await Promise.all([
            getDocs(coursesCollection),
            getCourseViewStats(),
            getQuizStatsByCourse()
        ]);

        const courses = courseSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(c => !c.archived);

        return courses.map(course => ({
            id: course.id,
            title: course.title,
            subject: course.subject,
            type: course.type || 'cours',
            uniqueViews: viewStats[course.id]?.uniqueViews || 0,
            totalViews: viewStats[course.id]?.totalViews || 0,
            quizAttempts: quizStats[course.id]?.attempts || 0,
            avgScore: quizStats[course.id]?.avgScore || null,
            avgDuration: quizStats[course.id]?.avgDuration || null
        }));
    } catch (error) {
        console.error('Error fetching all course stats:', error);
        return [];
    }
}

// ============================================
// QUIZ STATISTICS
// ============================================

/**
 * Get quiz statistics grouped by course
 * @returns {Object} courseId -> { attempts, avgScore, perfectCount }
 */
export async function getQuizStatsByCourse() {
    try {
        const snapshot = await getDocs(quizResultsCollection);
        const stats = {};

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const courseId = data.courseId;
            if (!courseId) return;

            if (!stats[courseId]) {
                stats[courseId] = {
                    attempts: 0,
                    totalScore: 0,
                    totalQuestions: 0,
                    perfectCount: 0,
                    totalDuration: 0,
                    durationCount: 0
                };
            }

            stats[courseId].attempts += 1;
            stats[courseId].totalScore += data.score || 0;
            stats[courseId].totalQuestions += data.totalQuestions || 0;

            if (data.score === data.totalQuestions) {
                stats[courseId].perfectCount += 1;
            }

            // Track duration
            if (data.duration && data.duration > 0) {
                stats[courseId].totalDuration += data.duration;
                stats[courseId].durationCount += 1;
            }
        });

        // Calculate averages
        Object.keys(stats).forEach(courseId => {
            const s = stats[courseId];
            s.avgScore = s.totalQuestions > 0
                ? Math.round((s.totalScore / s.totalQuestions) * 100)
                : null;
            s.avgDuration = s.durationCount > 0
                ? Math.round(s.totalDuration / s.durationCount)
                : null;
        });

        return stats;
    } catch (error) {
        console.error('Error fetching quiz stats:', error);
        return {};
    }
}

/**
 * Get overall quiz statistics
 * @returns {Object} { totalAttempts, avgScore, perfectRate }
 */
export async function getOverallQuizStats() {
    try {
        const snapshot = await getDocs(quizResultsCollection);
        let totalAttempts = 0;
        let totalScore = 0;
        let totalQuestions = 0;
        let perfectCount = 0;
        let totalDuration = 0;
        let durationCount = 0;

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            totalAttempts += 1;
            totalScore += data.score || 0;
            totalQuestions += data.totalQuestions || 0;
            if (data.score === data.totalQuestions) {
                perfectCount += 1;
            }
            if (data.duration && data.duration > 0) {
                totalDuration += data.duration;
                durationCount += 1;
            }
        });

        return {
            totalAttempts,
            avgScore: totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0,
            perfectRate: totalAttempts > 0 ? Math.round((perfectCount / totalAttempts) * 100) : 0,
            avgDuration: durationCount > 0 ? Math.round(totalDuration / durationCount) : null
        };
    } catch (error) {
        console.error('Error fetching overall quiz stats:', error);
        return { totalAttempts: 0, avgScore: 0, perfectRate: 0, avgDuration: null };
    }
}

// ============================================
// USER STATISTICS
// ============================================

/**
 * Get user activity statistics
 * @returns {Object} { totalUsers, activeToday, activeWeek, activeMonth }
 */
export async function getUserActivityStats() {
    try {
        const snapshot = await getDocs(usersCollection);
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;

        let totalUsers = 0;
        let activeToday = 0;
        let activeWeek = 0;
        let activeMonth = 0;

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.archived) return;

            totalUsers += 1;

            if (data.lastQuizDate) {
                const lastActive = data.lastQuizDate.seconds * 1000;
                const diffDays = (now - lastActive) / dayMs;

                if (diffDays <= 1) activeToday += 1;
                if (diffDays <= 7) activeWeek += 1;
                if (diffDays <= 30) activeMonth += 1;
            }
        });

        return { totalUsers, activeToday, activeWeek, activeMonth };
    } catch (error) {
        console.error('Error fetching user activity stats:', error);
        return { totalUsers: 0, activeToday: 0, activeWeek: 0, activeMonth: 0 };
    }
}

/**
 * Get top users by quiz activity
 * @param {number} topN - Number of top users to return
 * @returns {Array} Array of user objects with stats
 */
export async function getTopUsers(topN = 10) {
    try {
        const [usersSnapshot, resultsSnapshot] = await Promise.all([
            getDocs(usersCollection),
            getDocs(quizResultsCollection)
        ]);

        // Build user map
        const usersMap = {};
        usersSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.archived) return;
            usersMap[doc.id] = {
                id: doc.id,
                email: data.email,
                firstname: data.firstname || '',
                lastname: data.lastname || '',
                quizStreak: data.quizStreak || 0,
                quizCount: 0,
                perfectCount: 0,
                totalScore: 0,
                totalQuestions: 0
            };
        });

        // Aggregate quiz results
        resultsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const userId = data.userId;
            if (!usersMap[userId]) return;

            usersMap[userId].quizCount += 1;
            usersMap[userId].totalScore += data.score || 0;
            usersMap[userId].totalQuestions += data.totalQuestions || 0;
            if (data.score === data.totalQuestions) {
                usersMap[userId].perfectCount += 1;
            }
        });

        // Calculate avg and sort
        const users = Object.values(usersMap).map(u => ({
            ...u,
            avgScore: u.totalQuestions > 0
                ? Math.round((u.totalScore / u.totalQuestions) * 100)
                : 0
        }));

        // Sort by quiz count, then by average score
        users.sort((a, b) => {
            if (b.quizCount !== a.quizCount) return b.quizCount - a.quizCount;
            return b.avgScore - a.avgScore;
        });

        return users.slice(0, topN);
    } catch (error) {
        console.error('Error fetching top users:', error);
        return [];
    }
}

// ============================================
// AGGREGATED OVERVIEW
// ============================================

/**
 * Get overview statistics for dashboard cards
 * @returns {Object} All overview stats
 */
export async function getOverviewStats() {
    try {
        const [courseStats, quizStats, userStats] = await Promise.all([
            getCourseViewStats(),
            getOverallQuizStats(),
            getUserActivityStats()
        ]);

        // Calculate total views
        let totalUniqueViews = 0;
        let totalViews = 0;
        Object.values(courseStats).forEach(s => {
            totalUniqueViews += s.uniqueViews;
            totalViews += s.totalViews;
        });

        return {
            totalUniqueViews,
            totalViews,
            totalQuizAttempts: quizStats.totalAttempts,
            avgQuizScore: quizStats.avgScore,
            perfectRate: quizStats.perfectRate,
            avgDuration: quizStats.avgDuration,
            totalUsers: userStats.totalUsers,
            activeToday: userStats.activeToday,
            activeWeek: userStats.activeWeek,
            activeMonth: userStats.activeMonth
        };
    } catch (error) {
        console.error('Error fetching overview stats:', error);
        return null;
    }
}
