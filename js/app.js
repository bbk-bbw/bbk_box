// FILE: js/app.js (REPLACE entire file)

import { printAnswers } from './printer.js';
import { firebaseConfig } from './firebase-config.js';
// We no longer need to import 'authenticate'
import { renderPage, loadAndRenderAnswers, setupQuillListeners } from './renderer.js';

// --- Initialize Firebase ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// --- DOM Elements ---
const assignmentTitleEl = document.getElementById('assignment-title');
const stepperNavEl = document.getElementById('stepper-nav');
const stepperContentEl = document.getElementById('stepper-content');
const prevStepBtn = document.getElementById('prev-step-btn');
const nextStepBtn = document.getElementById('next-step-btn');
const printBtn = document.getElementById('print-btn');
const logoutBtn = document.getElementById('logout-btn');

// --- State Management ---
let state = {
    assignmentData: null,
    currentStepIndex: 0,
    firebaseUser: null, // This will be populated by our auth listener
};

// --- Auth State Listener ---
// This is the new entry point for the application.
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // User is signed in.
        console.log("User is logged in:", user.uid);
        state.firebaseUser = user;
        initializeApp(); // Now we can start the app
    } else {
        // User is signed out.
        console.log("User is not logged in. Redirecting to login page.");
        // Redirect to the login page
        window.location.href = 'login.html';
    }
});

// --- App Functions (These are now called only AFTER a user is confirmed to be logged in) ---

async function initializeApp() {
    try {
        const response = await fetch('assignment.json');
        if (!response.ok) throw new Error(`Failed to load assignment.json: ${response.statusText}`);
        const data = await response.json();
        state.assignmentData = data;

        assignmentTitleEl.textContent = data.assignmentTitle;
        renderSidebar(data.pages);
        await navigateToStep(0);

    } catch (error) {
        console.error("Application initialization failed:", error);
        stepperContentEl.innerHTML = `<p style="color: red;">Error loading assignment: ${error.message}</p>`;
    }
}

async function navigateToStep(index) {
    if (!state.assignmentData || index < 0 || index >= state.assignmentData.pages.length) return;
    state.currentStepIndex = index;
    const currentPageData = state.assignmentData.pages[index];
    renderPage(currentPageData, stepperContentEl);
    await loadAndRenderAnswers(state.firebaseUser.uid, currentPageData);
    setupQuillListeners(state.firebaseUser.uid, currentPageData);
    updateSidebarActiveState();
    updateNavigationButtons();
}

function updateSidebarActiveState() {
    stepperNavEl.querySelectorAll('a').forEach((link, idx) => {
        link.classList.toggle('active', idx === state.currentStepIndex);
    });
}

function updateNavigationButtons() {
    prevStepBtn.disabled = state.currentStepIndex === 0;
    nextStepBtn.disabled = state.currentStepIndex === state.assignmentData.pages.length - 1;
}

function renderSidebar(pages) {
    stepperNavEl.innerHTML = '';
    pages.forEach((page, index) => {
        const link = document.createElement('a');
        link.href = '#';
        link.textContent = page.title;
        link.dataset.index = index;
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateToStep(index);
        });
        stepperNavEl.appendChild(link);
    });
}

// --- Event Listeners ---
prevStepBtn.addEventListener('click', () => navigateToStep(state.currentStepIndex - 1));
nextStepBtn.addEventListener('click', () => navigateToStep(state.currentStepIndex + 1));
printBtn.addEventListener('click', () => printAnswers(state.assignmentData, state.firebaseUser.uid));
logoutBtn.addEventListener('click', () => {
    auth.signOut(); // This will trigger the onAuthStateChanged listener and redirect
});