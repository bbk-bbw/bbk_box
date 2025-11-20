// FILE: js/login.js
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

// --- Handle Sign Up (Self-Registration) ---
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const codeInput = signupForm['signup-code'].value.trim().toUpperCase();
    const displayName = signupForm['signup-name'].value;
    const email = signupForm['signup-email'].value;
    const password = signupForm['signup-password'].value;

    statusMessage.textContent = 'Prüfe Code...';

    try {
        // 1. Verify the Class Code
        const classQuery = await db.collection('classes')
            .where('registrationCode', '==', codeInput)
            .get();

        if (classQuery.empty) {
            throw new Error("Ungültiger Klassen-Code. Bitte überprüfen Sie die Eingabe.");
        }

        const classId = classQuery.docs[0].id;
        const className = classQuery.docs[0].data().className;

        statusMessage.textContent = `Code akzeptiert für "${className}". Erstelle Konto...`;

        // 2. Create Auth User
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // 3. Create User Profile in Firestore linked to the Class
        await db.collection('users').doc(user.uid).set({
            displayName: displayName,
            email: email,
            role: 'student',
            classId: classId, // Automatically assigned!
            registeredAt: new Date()
        });

        // 4. Redirect
        window.location.href = getRedirectUrl();

    } catch (error) {
        statusMessage.textContent = `Fehler: ${error.message}`;
        console.error("Signup Error:", error);
    }
});

// --- Handle Login ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginForm['login-email'].value;
    const password = loginForm['login-password'].value;

    try {
        statusMessage.textContent = 'Melde an...';
        await auth.signInWithEmailAndPassword(email, password);
        window.location.href = getRedirectUrl();
    } catch (error) {
        statusMessage.textContent = `Fehler: ${error.message}`;
    }
});

// --- Handle Password Reset ---
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

// FILE: js/login.js (Neue Hilfsfunktion)

function getRedirectUrl() {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    // Wenn ein Redirect-Parameter da ist, nutze ihn. Sonst gehe zur Standard-Startseite.
    return redirect ? decodeURIComponent(redirect) : 'index.html';
}