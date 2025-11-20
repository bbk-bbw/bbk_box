// FILE: js/app.js
import { printAnswers } from './printer.js';
import { firebaseConfig } from './firebase-config.js';
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
    assignmentId: null, // NEW: Store the ID
    assignmentData: null,
    currentStepIndex: 0,
    firebaseUser: null,
};

// --- Auth State Listener ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        console.log("User is logged in:", user.uid);
        state.firebaseUser = user;
        initializeApp();
    } else {
        window.location.href = 'login.html';
    }
});

// --- App Functions ---

async function initializeApp() {
    try {
        // 1. Get Assignment ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');

        if (!id) {
            throw new Error("Keine Aufgaben-ID in der URL gefunden. (z.B. ?id=assignment1)");
        }

        state.assignmentId = id;

        // 2. Fetch the specific JSON file
        const response = await fetch(`assignments/${id}.json`);
        
        if (!response.ok) {
            if (response.status === 404) throw new Error(`Aufgabe "${id}" wurde nicht gefunden.`);
            throw new Error(`Fehler beim Laden: ${response.statusText}`);
        }

        const data = await response.json();
        state.assignmentData = data;

        // 3. Render
        assignmentTitleEl.textContent = data.assignmentTitle;
        renderSidebar(data.pages);
        await navigateToStep(0);

    } catch (error) {
        console.error("Application initialization failed:", error);
        stepperContentEl.innerHTML = `
            <div style="padding: 20px; color: #721c24; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px;">
                <h3>Fehler</h3>
                <p>${error.message}</p>
                <p><small>Bitte überprüfen Sie die URL.</small></p>
            </div>`;
        // Disable controls on error
        prevStepBtn.disabled = true;
        nextStepBtn.disabled = true;
        printBtn.disabled = true;
    }
}

async function navigateToStep(index) {
    if (!state.assignmentData || index < 0 || index >= state.assignmentData.pages.length) return;
    state.currentStepIndex = index;
    const currentPageData = state.assignmentData.pages[index];
    
    renderPage(currentPageData, stepperContentEl);
    
    // Pass assignmentId to ensure we load/save to the correct "bucket" in Firestore
    await loadAndRenderAnswers(state.firebaseUser.uid, state.assignmentId, currentPageData);
    setupQuillListeners(state.firebaseUser.uid, state.assignmentId, currentPageData);
    
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
// Pass assignmentId to printer
printBtn.addEventListener('click', () => printAnswers(state.assignmentData, state.firebaseUser.uid, state.assignmentId));
logoutBtn.addEventListener('click', () => auth.signOut());