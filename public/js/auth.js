import { auth, db } from './firebase.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js";
import { setIsAdmin, state } from './state.js';
import { notyf, showPage } from './ui.js';

export async function createUserProfile(userId, email, firstName = '', lastName = '', photoURL = null) {
    try {
        const userData = {
            role: 'student',
            email: email,
            createdAt: new Date()
        };

        if (firstName) userData.firstname = firstName;
        if (lastName) userData.lastname = lastName;
        if (photoURL) userData.photoURL = photoURL;

        await setDoc(doc(db, 'users', userId), userData);
        return userData;
    } catch (error) {
        console.error("Error creating user profile:", error);
        throw error;
    }
}

export async function getUserRole(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            const userData = userDoc.data();

            // Update profile button icon if photoURL exists
            if (userData.photoURL) {
                const profileBtn = document.getElementById('profile-btn');
                if (profileBtn) {
                    profileBtn.innerHTML = `<img src="${userData.photoURL}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
                }
            } else {
                const profileBtn = document.getElementById('profile-btn');
                if (profileBtn) {
                    profileBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px; pointer-events: none;">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M17 21v-2a4 4 0 0 0-4-4H11a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>`;
                }
            }

            return userData.role || 'student';
        } else {
            await createUserProfile(userId, auth.currentUser.email);
            const profileBtn = document.getElementById('profile-btn');
            if (profileBtn) {
                profileBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px; pointer-events: none;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M17 21v-2a4 4 0 0 0-4-4H11a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>`;
            }
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
    const profileBtn = document.getElementById('profile-btn');

    onAuthStateChanged(auth, async user => {
        if (user) {
            const userRole = await getUserRole(user.uid);
            setIsAdmin(userRole === 'admin');

            loginNavLink.style.display = 'none';
            logoutBtn.style.display = 'inline-flex';
            if (profileBtn) profileBtn.style.display = 'flex';

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
            loginNavLink.style.display = 'flex';
            logoutBtn.style.display = 'none';
            adminActions.style.display = 'none';
            if (addCourseBtn) addCourseBtn.style.display = 'none';
            if (addCourseNavLink) addCourseNavLink.style.display = 'none';
            adminNavLink.style.display = 'none';
            if (profileBtn) {
                profileBtn.style.display = 'none';
                profileBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px; pointer-events: none;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M17 21v-2a4 4 0 0 0-4-4H11a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>`; // Reset icon on logout
            }
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
                console.error('Google login error:', error);
                let errorMessage = 'Erreur lors de la connexion Google.';

                // Provide more specific error messages
                if (error.code === 'auth/popup-blocked') {
                    errorMessage = 'Popup bloquée. Veuillez autoriser les popups pour ce site.';
                } else if (error.code === 'auth/popup-closed-by-user') {
                    errorMessage = 'Connexion annulée.';
                } else if (error.code === 'auth/unauthorized-domain') {
                    errorMessage = 'Domaine non autorisé. Veuillez contacter l\'administrateur.';
                } else if (error.code === 'auth/cancelled-popup-request') {
                    errorMessage = 'Une autre fenêtre de connexion est déjà ouverte.';
                } else if (error.message) {
                    errorMessage = `Erreur: ${error.message}`;
                }

                notyf.error(errorMessage);
            }
        });
    }

    // Registration form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const passwordConfirm = document.getElementById('register-password-confirm').value;
            const firstName = document.getElementById('register-firstname').value.trim();
            const lastName = document.getElementById('register-lastname').value.trim();

            // Validate password match
            if (password !== passwordConfirm) {
                notyf.error('Les mots de passe ne correspondent pas.');
                return;
            }

            try {
                // Create Firebase user
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);

                // Create user profile in Firestore
                await createUserProfile(userCredential.user.uid, email, firstName, lastName);

                notyf.success('Inscription réussie ! Bienvenue !');
                showPage('cours');
            } catch (error) {
                console.error('Registration error:', error);
                let errorMessage = 'Erreur lors de l\'inscription.';

                if (error.code === 'auth/email-already-in-use') {
                    errorMessage = 'Cet email est déjà utilisé.';
                } else if (error.code === 'auth/invalid-email') {
                    errorMessage = 'Email invalide.';
                } else if (error.code === 'auth/weak-password') {
                    errorMessage = 'Le mot de passe doit contenir au moins 6 caractères.';
                } else if (error.code === 'auth/operation-not-allowed') {
                    errorMessage = 'L\'inscription par email est désactivée.';
                } else if (error.message) {
                    errorMessage = `Erreur: ${error.message}`;
                }

                notyf.error(errorMessage);
            }
        });
    }

    // Google registration button
    const googleRegisterBtn = document.getElementById('google-register-btn');
    if (googleRegisterBtn) {
        googleRegisterBtn.addEventListener('click', async () => {
            const provider = new GoogleAuthProvider();
            try {
                const result = await signInWithPopup(auth, provider);

                // Check if user already exists, if not create profile
                const userDoc = await getDoc(doc(db, 'users', result.user.uid));
                if (!userDoc.exists()) {
                    await createUserProfile(
                        result.user.uid,
                        result.user.email,
                        result.user.displayName?.split(' ')[0] || '',
                        result.user.displayName?.split(' ').slice(1).join(' ') || '',
                        result.user.photoURL
                    );
                }

                notyf.success('Inscription Google réussie !');
                showPage('cours');
            } catch (error) {
                console.error('Google registration error:', error);
                let errorMessage = 'Erreur lors de l\'inscription Google.';

                if (error.code === 'auth/popup-blocked') {
                    errorMessage = 'Popup bloquée. Veuillez autoriser les popups pour ce site.';
                } else if (error.code === 'auth/popup-closed-by-user') {
                    errorMessage = 'Inscription annulée.';
                } else if (error.code === 'auth/unauthorized-domain') {
                    errorMessage = 'Domaine non autorisé. Veuillez contacter l\'administrateur.';
                } else if (error.code === 'auth/cancelled-popup-request') {
                    errorMessage = 'Une autre fenêtre d\'inscription est déjà ouverte.';
                } else if (error.message) {
                    errorMessage = `Erreur: ${error.message}`;
                }

                notyf.error(errorMessage);
            }
        });
    }
}
