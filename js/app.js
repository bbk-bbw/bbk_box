// FILE: js/app.js (Final Version)

import { printAnswers } from './printer.js';
import { firebaseConfig } from './firebase-config.js';
import { authenticate } from './auth.js';
import { renderPage, loadAndRenderAnswers, setupQuillListeners } from './renderer.js';

// --- DOM Elements ---
const assignmentTitleEl = document.getElementById('assignment-title');
const stepperNavEl = document.getElementById('stepper-nav');
const stepperContentEl = document.getElementById('stepper-content');
const prevStepBtn = document.getElementById('prev-step-btn');
const nextStepBtn = document.getElementById('next-step-btn');
const printBtn = document.getElementById('print-btn');

// --- State Management ---
let state = {
    assignmentData: null,
    currentStepIndex: 0,
    firebaseUser: null,
};

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

async function initializeApp() {
    try {
        // Use the global 'firebase' object
        firebase.initializeApp(firebaseConfig);
        console.log("Firebase Initialized");

        const user = await authenticate();
        if (!user) return;
        state.firebaseUser = user;

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

// --- Event Listeners ---
prevStepBtn.addEventListener('click', () => navigateToStep(state.currentStepIndex - 1));
nextStepBtn.addEventListener('click', () => navigateToStep(state.currentStepIndex + 1));
printBtn.addEventListener('click', () => {
    printAnswers(state.assignmentData, state.firebaseUser.uid);
});

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', initializeApp);