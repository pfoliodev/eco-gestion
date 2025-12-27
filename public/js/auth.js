import { auth, db } from './firebase.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js";
import { setIsAdmin, state } from './state.js';
import { notyf, showPage } from './ui.js';

export async function getUserRole(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            return userDoc.data().role || 'student';
        } else {
            await setDoc(doc(db, 'users', userId), {
                role: 'student',
                email: auth.currentUser.email,
                createdAt: new Date()
            });
            return 'student';
        }
    } catch (error) {
        console.error("Error getting user role:", error);
        return 'student';
    }
}

export function initAuth() {
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');
    const loginNavLink = document.getElementById('login-nav-link');
    const adminActions = document.getElementById('admin-actions');
    const addCourseBtn = document.querySelector('.courses-header .btn-primary');
    const addCourseNavLink = document.querySelector('.nav-menu a[href="#ajouter"]');
    const adminNavLink = document.getElementById('admin-nav-link');

    onAuthStateChanged(auth, async user => {
        if (user) {
            const userRole = await getUserRole(user.uid);
            setIsAdmin(userRole === 'admin');

            loginNavLink.style.display = 'none';
            logoutBtn.style.display = 'inline-flex';

            if (state.isAdmin) {
                adminActions.style.display = 'flex';
                if (addCourseBtn) addCourseBtn.style.display = 'inline-flex';
                if (addCourseNavLink) addCourseNavLink.style.display = 'inline-flex';
                adminNavLink.style.display = 'inline-flex';
            } else {
                adminActions.style.display = 'none';
                if (addCourseBtn) addCourseBtn.style.display = 'none';
                if (addCourseNavLink) addCourseNavLink.style.display = 'none';
                adminNavLink.style.display = 'none';
            }
        } else {
            setIsAdmin(false);
            loginNavLink.style.display = 'inline-flex';
            logoutBtn.style.display = 'none';
            adminActions.style.display = 'none';
            if (addCourseBtn) addCourseBtn.style.display = 'none';
            if (addCourseNavLink) addCourseNavLink.style.display = 'none';
            adminNavLink.style.display = 'none';
            if (document.querySelector('.page.active').id === 'ajouter') {
                showPage('cours');
            }
        }
    });

    if (loginForm) {
        loginForm.addEventListener('submit', async e => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            try {
                await signInWithEmailAndPassword(auth, email, password);
                notyf.success('Connexion réussie !');
                showPage('cours');
            } catch (error) {
                console.error("Login error:", error);
                let errorMessage = 'Email ou mot de passe incorrect.';
                notyf.error(errorMessage);
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                notyf.success('Déconnexion réussie.');
                showPage('accueil');
            } catch (error) {
                notyf.error('Erreur lors de la déconnexion.');
            }
        });
    }

    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', async () => {
            const provider = new GoogleAuthProvider();
            try {
                await signInWithPopup(auth, provider);
                notyf.success('Connexion Google réussie !');
                showPage('cours');
            } catch (error) {
                notyf.error('Erreur lors de la connexion Google.');
            }
        });
    }
}
