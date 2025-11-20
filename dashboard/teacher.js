// FILE: dashboard/teacher.js
import { firebaseConfig } from '../js/firebase-config.js';

// --- CONFIG ---
// URL for the Cloud Function to create users (from your previous setup)
const CREATE_USER_URL = 'https://get-all-submissions-305371665876.europe-west6.run.app/createUserAccount';

// --- INITIALIZE FIREBASE ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- STATE ---
let state = {
    user: null,
    classes: [],
    users: [], // All students
    submissions: {}, // Map: userId -> { assignmentId -> data }
    
    // Selection State
    selectedClassId: null,
    selectedAssignmentId: null,
    selectedStudentId: null,
    
    // Cache for assignment JSON structures
    assignmentDefinitions: {} 
};

// --- DOM ELEMENTS ---
const els = {
    loginOverlay: document.getElementById('login-overlay'),
    dashboard: document.getElementById('dashboard-container'),
    navContent: document.getElementById('nav-content'),
    studentListContent: document.getElementById('student-list-content'),
    detailContent: document.getElementById('detail-content'),
    detailTitle: document.getElementById('detail-title'),
    studentListTitle: document.getElementById('student-list-title'),
    addStudentBtn: document.getElementById('add-student-btn'),
    modal: document.getElementById('modal-overlay'),
    modalBody: document.getElementById('modal-body'),
    modalTitle: document.getElementById('modal-title')
};

// --- AUTHENTICATION ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        const token = await user.getIdTokenResult();
        if (token.claims.isTeacher) {
            state.user = user;
            els.loginOverlay.classList.remove('visible');
            initDashboard();
        } else {
            alert("Keine Lehrer-Berechtigung.");
            auth.signOut();
        }
    } else {
        els.loginOverlay.classList.add('visible');
    }
});

document.getElementById('login-btn').addEventListener('click', () => {
    const email = document.getElementById('teacher-email').value;
    const pass = document.getElementById('teacher-password').value;
    auth.signInWithEmailAndPassword(email, pass).catch(e => alert(e.message));
});

document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());

// --- DATA FETCHING (REAL-TIME) ---
function initDashboard() {
    // 1. Fetch Classes (One-time)
    db.collection('classes').where('teacherId', '==', state.user.uid).onSnapshot(snap => {
        state.classes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderNav();
    });

    // 2. Fetch All Users (One-time or Snapshot)
    db.collection('users').onSnapshot(snap => {
        state.users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (state.selectedClassId) renderStudentList();
    });

    // 3. Fetch Submissions (REAL-TIME)
    // We listen to ALL submissions. In a production app with thousands of students, 
    // you would filter this query. For now, this enables the "Live" view.
    db.collection('submissions').onSnapshot(snap => {
        state.submissions = {};
        snap.forEach(doc => {
            state.submissions[doc.id] = doc.data();
        });
        
        // If we are currently viewing a student, re-render their answers immediately
        if (state.selectedStudentId && state.selectedAssignmentId) {
            renderDetailView();
        }
        // Update student list indicators
        if (state.selectedClassId && state.selectedAssignmentId) {
            renderStudentList();
        }
        // Update Nav (to discover new assignments)
        renderNav();
    });
}

// --- RENDER: PANE 1 (Navigation) ---
function renderNav() {
    els.navContent.innerHTML = '';

    // 1. Discover all unique Assignment IDs from the submissions
    // This allows us to see assignments even if we don't have a database table for them
    const discoveredAssignments = new Set();
    Object.values(state.submissions).forEach(sub => {
        Object.keys(sub).forEach(assignmentId => discoveredAssignments.add(assignmentId));
    });
    const assignmentList = Array.from(discoveredAssignments).sort();

    if (state.classes.length === 0) {
        els.navContent.innerHTML = '<p>Keine Klassen gefunden.</p>';
        return;
    }

    state.classes.forEach(cls => {
        const group = document.createElement('div');
        group.className = 'nav-group';
        
        const header = document.createElement('div');
        header.className = 'nav-class-header';
        header.textContent = cls.className;
        // Clicking header selects class but no assignment
        header.addEventListener('click', () => selectClass(cls.id));
        
        group.appendChild(header);

        // Render discovered assignments under each class
        // (In a real app, you might want to assign specific assignments to classes, 
        // but here we show all available assignments for simplicity)
        if (assignmentList.length > 0) {
            assignmentList.forEach(assId => {
                const item = document.createElement('div');
                item.className = 'nav-assignment-item';
                item.textContent = `📄 ${assId}`;
                if (state.selectedClassId === cls.id && state.selectedAssignmentId === assId) {
                    item.classList.add('active');
                }
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectClass(cls.id);
                    selectAssignment(assId);
                });
                group.appendChild(item);
            });
        } else {
            const empty = document.createElement('div');
            empty.className = 'nav-assignment-item';
            empty.style.fontStyle = 'italic';
            empty.textContent = 'Keine Abgaben gefunden';
            group.appendChild(empty);
        }

        els.navContent.appendChild(group);
    });
}

function selectClass(classId) {
    state.selectedClassId = classId;
    state.selectedAssignmentId = null;
    state.selectedStudentId = null;
    els.addStudentBtn.disabled = false;
    renderNav(); // Update active states
    renderStudentList();
    els.detailContent.innerHTML = '<div class="empty-state"><p>Wählen Sie eine Aufgabe aus.</p></div>';
    els.detailTitle.textContent = 'Ansicht';
}

async function selectAssignment(assignmentId) {
    state.selectedAssignmentId = assignmentId;
    state.selectedStudentId = null;
    renderNav();
    renderStudentList();
    els.detailContent.innerHTML = '<div class="empty-state"><p>Wählen Sie einen Schüler aus.</p></div>';
    els.detailTitle.textContent = `Aufgabe: ${assignmentId}`;

    // Fetch the JSON definition for this assignment so we can render questions nicely
    if (!state.assignmentDefinitions[assignmentId]) {
        try {
            const res = await fetch(`../assignments/${assignmentId}.json`);
            if (res.ok) {
                state.assignmentDefinitions[assignmentId] = await res.json();
            }
        } catch (e) {
            console.warn("Could not load assignment definition JSON", e);
        }
    }
}

// --- RENDER: PANE 2 (Student List) ---
function renderStudentList() {
    els.studentListContent.innerHTML = '';
    
    if (!state.selectedClassId) {
        els.studentListContent.innerHTML = '<p class="placeholder-text">Bitte Klasse wählen.</p>';
        return;
    }

    const students = state.users.filter(u => u.classId === state.selectedClassId);
    
    if (students.length === 0) {
        els.studentListContent.innerHTML = '<p class="placeholder-text">Keine Schüler in dieser Klasse.</p>';
        return;
    }

    students.forEach(student => {
        const card = document.createElement('div');
        card.className = 'student-card';
        if (state.selectedStudentId === student.id) card.classList.add('active');

        // Check status
        let statusText = 'Noch nicht begonnen';
        let statusClass = 'empty';
        
        if (state.selectedAssignmentId) {
            const sub = state.submissions[student.id];
            if (sub && sub[state.selectedAssignmentId]) {
                // Count answers
                const pages = sub[state.selectedAssignmentId];
                let answerCount = 0;
                Object.values(pages).forEach(p => answerCount += Object.keys(p).length);
                statusText = `In Bearbeitung (${answerCount} Antworten)`;
                statusClass = 'active';
            }
        }

        card.innerHTML = `
            <span class="name">${student.displayName}</span>
            <span class="status ${statusClass}">${statusText}</span>
        `;
        
        card.addEventListener('click', () => {
            state.selectedStudentId = student.id;
            renderStudentList(); // Update active class
            renderDetailView();
        });

        els.studentListContent.appendChild(card);
    });
}

// --- RENDER: PANE 3 (Detail View) ---
function renderDetailView() {
    if (!state.selectedStudentId || !state.selectedAssignmentId) return;

    const student = state.users.find(u => u.id === state.selectedStudentId);
    const submission = state.submissions[state.selectedStudentId]?.[state.selectedAssignmentId] || {};
    const definition = state.assignmentDefinitions[state.selectedAssignmentId];

    els.detailTitle.textContent = `${student.displayName} - ${state.selectedAssignmentId}`;
    els.detailContent.innerHTML = '';

    // If we have the JSON definition, render nicely
    if (definition) {
        definition.pages.forEach(page => {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'assignment-page';
            pageDiv.innerHTML = `<h2>${page.title}</h2>`;

            const pageAnswers = submission[page.id] || {};

            page.elements.forEach(el => {
                if (el.type === 'quill') {
                    const answer = pageAnswers[el.id] || '<span style="color:#ccc; font-style:italic;">Keine Antwort</span>';
                    pageDiv.innerHTML += `
                        <div class="qa-pair">
                            <div class="question">${el.question}</div>
                            <div class="answer">${answer}</div>
                        </div>
                    `;
                }
            });
            els.detailContent.appendChild(pageDiv);
        });
    } else {
        // Fallback: Render raw data if JSON is missing
        els.detailContent.innerHTML = `
            <div style="padding:20px; background:#fff3cd; border:1px solid #ffeeba; border-radius:5px; margin-bottom:20px;">
                Warnung: Definitionsdatei <code>${state.selectedAssignmentId}.json</code> konnte nicht geladen werden. 
                Es werden Rohdaten angezeigt.
            </div>
        `;
        
        Object.keys(submission).forEach(pageId => {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'assignment-page';
            pageDiv.innerHTML = `<h2>Page ID: ${pageId}</h2>`;
            
            const answers = submission[pageId];
            Object.keys(answers).forEach(qId => {
                pageDiv.innerHTML += `
                    <div class="qa-pair">
                        <div class="question">ID: ${qId}</div>
                        <div class="answer">${answers[qId]}</div>
                    </div>
                `;
            });
            els.detailContent.appendChild(pageDiv);
        });
    }
}

// --- MODAL LOGIC (Add Student/Class) ---
// (Simplified for brevity - connects to your existing logic)
els.addStudentBtn.addEventListener('click', () => {
    openModal('Schüler hinzufügen', `
        <form id="create-student-form">
            <input type="text" id="new-name" placeholder="Name" required style="width:100%; padding:8px; margin-bottom:10px;">
            <input type="email" id="new-email" placeholder="E-Mail" required style="width:100%; padding:8px; margin-bottom:10px;">
            <input type="text" id="new-pass" placeholder="Passwort" required style="width:100%; padding:8px; margin-bottom:10px;">
            <button type="submit" class="action-btn">Erstellen</button>
        </form>
    `);
    document.getElementById('create-student-form').addEventListener('submit', handleCreateStudent);
});

document.getElementById('create-class-btn').addEventListener('click', () => {
    const name = prompt("Name der neuen Klasse:");
    if(name) {
        db.collection('classes').add({
            className: name,
            teacherId: state.user.uid,
            registrationCode: Math.random().toString(36).substring(7).toUpperCase()
        });
    }
});

document.getElementById('modal-close').addEventListener('click', () => {
    els.modal.classList.add('hidden');
});

function openModal(title, html) {
    els.modalTitle.textContent = title;
    els.modalBody.innerHTML = html;
    els.modal.classList.remove('hidden');
}

async function handleCreateStudent(e) {
    e.preventDefault();
    const name = document.getElementById('new-name').value;
    const email = document.getElementById('new-email').value;
    const pass = document.getElementById('new-pass').value;
    
    els.modalBody.innerHTML = '<p>Erstelle Konto...</p>';
    
    try {
        const token = await state.user.getIdToken();
        const res = await fetch(CREATE_USER_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                idToken: token,
                classId: state.selectedClassId,
                displayName: name,
                email: email,
                password: pass
            })
        });
        const data = await res.json();
        if(!res.ok) throw new Error(data.message);
        alert("Schüler erstellt!");
        els.modal.classList.add('hidden');
    } catch(err) {
        alert("Fehler: " + err.message);
        els.modal.classList.add('hidden');
    }
}