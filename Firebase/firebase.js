import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyBmyk1CJ0Z1oTsxXL_kA67KHjz3F3AoSBc",
    authDomain: "roomc-83293.firebaseapp.com",
    projectId: "roomc-83293",
    storageBucket: "roomc-83293.appspot.com", // Modified this line
    messagingSenderId: "756629527166",
    appId: "1:756629527166:web:25f03678f866e6a593162f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;