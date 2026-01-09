import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Deine individuellen Zugangsdaten aus Bild 16
const firebaseConfig = {
  apiKey: "AIzaSyCQunJubKgmhBrhStukRm0yJi4I-Bk3UsA",
  authDomain: "lumina-foto-app.firebaseapp.com",
  projectId: "lumina-foto-app",
  storageBucket: "lumina-foto-app.firebasestorage.app",
  messagingSenderId: "413881037726",
  appId: "1:413881037726:web:ec0fecd5d0db9f0e1c9c8f"
};

// Initialisierung
const app = initializeApp(firebaseConfig);

// Exportiere die Dienste, damit du sie in anderen Dateien nutzen kannst
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);