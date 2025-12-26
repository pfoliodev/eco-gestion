// ⚠️ ATTENTION: Remplacez les valeurs ci-dessous par votre propre configuration Firebase.
// Vous pouvez trouver ces informations dans la console Firebase de votre projet.
// https://console.firebase.google.com/

const firebaseConfig = {
  apiKey: "AIzaSyAORwn_pzOaOYEYYxcTrAQowkcCCWG-88Y",
  authDomain: "eco-gestion-d764e.firebaseapp.com",
  projectId: "eco-gestion-d764e",
  storageBucket: "eco-gestion-d764e.firebasestorage.app",
  messagingSenderId: "726385041984",
  appId: "1:726385041984:web:c1c6bd5e0fed934162b5a5",
  measurementId: "G-B6PN1TYS20"
};

// Ne modifiez pas le code ci-dessous
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-app.js";
const app = initializeApp(firebaseConfig);
export { app };
