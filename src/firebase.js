import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// HIER IST DER FIX:
// Wir laden den Schlüssel aus der .env Datei (VITE_FIREBASE_API_KEY)
// Anstatt ihn hart reinzuschreiben.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY, 
  authDomain: "lumina-foto-app.firebaseapp.com",
  projectId: "lumina-foto-app",
  storageBucket: "lumina-foto-app.firebasestorage.app", // KORRIGIERTER WERT
  messagingSenderId: "413881037726",
  appId: "1:413881037726:web:ec0fecd5d0db9f0e1c9c8f"
};

// Initialisieren
const app = initializeApp(firebaseConfig);

// Dienste exportieren
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
