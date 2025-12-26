// ⚠️ ATTENTION: Remplacez les valeurs ci-dessous par votre propre configuration Firebase.
// Vous pouvez trouver ces informations dans la console Firebase de votre projet.
// https://console.firebase.google.com/

const firebaseConfig = {
  apiKey: "VOTRE_API_KEY",
  authDomain: "VOTRE_AUTH_DOMAIN",
  projectId: "VOTRE_PROJECT_ID",
  storageBucket: "VOTRE_STORAGE_BUCKET",
  messagingSenderId: "VOTRE_MESSAGING_SENDER_ID",
  appId: "VOTRE_APP_ID"
};

// Ne modifiez pas le code ci-dessous
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-app.js";
const app = initializeApp(firebaseConfig);
export { app };
