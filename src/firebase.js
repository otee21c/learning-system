import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCH26rhHE0JqmHAVPtDuV7boZFGRiv02SY",
  authDomain: "learning-system-f5bdf.firebaseapp.com",
  projectId: "learning-system-f5bdf",
  storageBucket: "learning-system-f5bdf.firebasestorage.app",
  messagingSenderId: "306626548155",
  appId: "1:306626548155:web:a80779f7c60ef23c8d749e"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);