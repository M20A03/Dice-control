import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCuFK5p7ImtfafBj3R-cVB-yO9G4a0MrXc",
  authDomain: "dice-roller-choice.firebaseapp.com",
  databaseURL: "https://dice-roller-choice-default-rtdb.firebaseio.com",
  projectId: "dice-roller-choice",
  storageBucket: "dice-roller-choice.firebasestorage.app",
  messagingSenderId: "531482729711",
  appId: "1:531482729711:web:d2fd3490c6fcde60d08f1a",
  measurementId: "G-0SVW2JEDNE"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
