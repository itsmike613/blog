import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDxHEQmcAxRxSn6JV4VuPBbuRGsvOjIqN8",
    authDomain: "blog-4733c.firebaseapp.com",
    projectId: "blog-4733c",
    storageBucket: "blog-4733c.firebasestorage.app",
    messagingSenderId: "1097110927699",
    appId: "1:1097110927699:web:13779608fd86a424da89a6",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export { auth, db, provider, signInWithPopup, onAuthStateChanged, signOut, doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, serverTimestamp };