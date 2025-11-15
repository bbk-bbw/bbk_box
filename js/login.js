// FILE: js/login.js (NEW FILE)
import { firebaseConfig } from './firebase-config.js';

// --- Initialize Firebase ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- DOM Elements ---
const loginView = document.getElementById('login-view');
const signupView = document.getElementById('signup-view');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const showSignupBtn = document.getElementById('show-signup');
const showLoginBtn = document.getElementById('show-login');
const forgotPasswordBtn = document.getElementById('forgot-password');
const statusMessage = document.getElementById('status-message');

// --- Event Handlers ---

// Handle Sign Up
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const displayName = signupForm['signup-name'].value;
    const email = signupForm['signup-email'].value;
    const password = signupForm['signup-password'].value;

    try {
        statusMessage.textContent = 'Konto wird erstellt...';
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // CRITICAL: Create a user profile document in Firestore
        await db.collection('users').doc(user.uid).set({
            displayName: displayName,
            email: email,
            role: 'student',
            classId: null // No class assigned yet
        });

        // Redirect to the main app after successful signup and profile creation
        window.location.href = 'index.html';

    } catch (error) {
        statusMessage.textContent = `Fehler: ${error.message}`;
        console.error("Signup Error:", error);
    }
});

// Handle Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginForm['login-email'].value;
    const password = loginForm['login-password'].value;

    try {
        statusMessage.textContent = 'Melde an...';
        await auth.signInWithEmailAndPassword(email, password);
        // Redirect to the main app after successful login
        window.location.href = 'index.html';
    } catch (error) {
        statusMessage.textContent = `Fehler: ${error.message}`;
        console.error("Login Error:", error);
    }
});

// Handle Password Reset
forgotPasswordBtn.addEventListener('click', async () => {
    const email = loginForm['login-email'].value;
    if (!email) {
        alert("Bitte geben Sie Ihre E-Mail-Adresse in das E-Mail-Feld ein, um Ihr Passwort zurückzusetzen.");
        return;
    }
    try {
        await auth.sendPasswordResetEmail(email);
        alert("Eine E-Mail zum Zurücksetzen des Passworts wurde an Sie gesendet.");
    } catch (error) {
        alert(`Fehler: ${error.message}`);
    }
});

// --- UI Toggling ---
showSignupBtn.addEventListener('click', () => {
    loginView.style.display = 'none';
    signupView.style.display = 'block';
    statusMessage.textContent = '';
});

showLoginBtn.addEventListener('click', () => {
    signupView.style.display = 'none';
    loginView.style.display = 'block';
    statusMessage.textContent = '';
});