import { app } from '../firebase-config.js';
import { getFirestore, collection } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-storage.js";

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const coursesCollection = collection(db, 'courses');
export const usersCollection = collection(db, 'users');
export const bugsCollection = collection(db, 'bugs');
