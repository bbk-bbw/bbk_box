// FILE: dashboard/teacher.js
import { firebaseConfig } from '../js/firebase-config.js';

// --- INITIALIZE FIREBASE ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- STATE ---
let state = {
    user: null,
    classes: [],
    users: [],
    submissions: {},
    presenceData: {}, // NEW: Store presence data
    selectedClassId: null,
    selectedAssignmentId: null,
    selectedStudentId: null,
    assignmentDefinitions: {} 
};

// --- DOM ELEMENTS ---
const els = {
    loginOverlay: document.getElementById('login-overlay'),
    navContent: document.getElementById('nav-content'),
    studentListContent: document.getElementById('student-list-content'),
    detailContent: document.getElementById('detail-content'),
    detailTitle: document.getElementById('detail-title'),
    studentListTitle: document.getElementById('student-list-title')
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

// --- DATA FETCHING ---
function initDashboard() {
    // Listen to Classes
    db.collection('classes').where('teacherId', '==', state.user.uid).onSnapshot(snap => {
        state.classes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderNav();
    });

    // Listen to Users
    db.collection('users').onSnapshot(snap => {
        state.users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (state.selectedClassId) renderStudentList();
    });

    // Listen to Submissions
    db.collection('submissions').onSnapshot(snap => {
        state.submissions = {};
        snap.forEach(doc => {
            state.submissions[doc.id] = doc.data();
        });
        if (state.selectedStudentId && state.selectedAssignmentId) renderDetailView();
        if (state.selectedClassId && state.selectedAssignmentId) renderStudentList();
        renderNav();
    });

    // Listen to Presence (NEW)
    initPresenceListener();
}

function initPresenceListener() {
    db.collection('presence').onSnapshot(snap => {
        state.presenceData = {};
        snap.forEach(doc => {
            state.presenceData[doc.id] = doc.data();
        });
        // Refresh student list if we're viewing one to update dots
        if (state.selectedClassId) {
            renderStudentList();
        }
    });
}

// --- RENDER LOGIC ---
function renderNav() {
    els.navContent.innerHTML = '';
    
    // Discover Assignments
    const discoveredAssignments = new Set();
    Object.values(state.submissions).forEach(sub => {
        Object.keys(sub).forEach(assignmentId => discoveredAssignments.add(assignmentId));
    });
    const assignmentList = Array.from(discoveredAssignments).sort();

    if (state.classes.length === 0) {
        els.navContent.innerHTML = '<p style="padding:10px; color:#666;">Keine Klassen gefunden. Bitte erstellen Sie Klassen in der Verwaltung.</p>';
        return;
    }

    state.classes.forEach(cls => {
        const group = document.createElement('div');
        group.className = 'nav-group';
        
        const header = document.createElement('div');
        header.className = 'nav-class-header';
        header.textContent = cls.className;
        header.addEventListener('click', () => selectClass(cls.id));
        group.appendChild(header);

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
            group.innerHTML += '<div class="nav-assignment-item" style="font-style:italic; color:#999;">Keine aktiven Aufgaben</div>';
        }
        els.navContent.appendChild(group);
    });
}

function selectClass(classId) {
    state.selectedClassId = classId;
    state.selectedAssignmentId = null;
    state.selectedStudentId = null;
    renderNav();
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

    if (!state.assignmentDefinitions[assignmentId]) {
        try {
            const res = await fetch(`../assignments/${assignmentId}.json`);
            if (res.ok) state.assignmentDefinitions[assignmentId] = await res.json();
        } catch (e) { console.warn("JSON load failed", e); }
    }
}

function renderStudentList() {
    els.studentListContent.innerHTML = '';
    if (!state.selectedClassId) return;

    const students = state.users.filter(u => u.classId === state.selectedClassId);
    if (students.length === 0) {
        els.studentListContent.innerHTML = '<p class="placeholder-text">Keine Schüler in dieser Klasse.</p>';
        return;
    }

    const now = new Date();

    students.forEach(student => {
        const card = document.createElement('div');
        card.className = 'student-card';
        if (state.selectedStudentId === student.id) card.classList.add('active');

        let statusText = 'Inaktiv';
        let statusClass = 'empty';
        
        // --- PRESENCE LOGIC (NEW) ---
        let presenceIndicator = '<span class="presence-indicator presence-idle" title="Offline"></span>';
        let presenceText = '';
        
        const presence = state.presenceData[student.id];
        if (presence && presence.lastActive) {
            const lastActive = presence.lastActive.toDate();
            const secondsAgo = (now - lastActive) / 1000;
            
            if (secondsAgo < 30) {
                presenceIndicator = '<span class="presence-indicator presence-active" title="Aktiv"></span>';
                presenceText = '<span class="meta-info">🟢 Gerade aktiv</span>';
            } else if (secondsAgo < 300) { // 5 minutes
                presenceIndicator = '<span class="presence-indicator presence-recent" title="Kürzlich aktiv"></span>';
                const minAgo = Math.floor(secondsAgo / 60);
                presenceText = `<span class="meta-info">🟡 Vor ${minAgo} Min.</span>`;
            } else {
                presenceText = '<span class="meta-info">⚫ Inaktiv</span>';
            }
        }

        // Submission Count Logic
        if (state.selectedAssignmentId) {
            const sub = state.submissions[student.id];
            if (sub && sub[state.selectedAssignmentId]) {
                const pages = sub[state.selectedAssignmentId];
                let count = 0;
                Object.values(pages).forEach(p => count += Object.keys(p).length);
                statusText = `${count} Antworten`;
                statusClass = 'active';
            }
        }

        card.innerHTML = `
            <div>
                ${presenceIndicator}<span class="name">${student.displayName}</span>
            </div>
            <span class="status ${statusClass}">${statusText} ${presenceText}</span>
        `;
        
        card.addEventListener('click', () => {
            state.selectedStudentId = student.id;
            renderStudentList();
            renderDetailView();
        });
        els.studentListContent.appendChild(card);
    });
}

function renderDetailView() {
    if (!state.selectedStudentId || !state.selectedAssignmentId) return;

    const student = state.users.find(u => u.id === state.selectedStudentId);
    const submission = state.submissions[state.selectedStudentId]?.[state.selectedAssignmentId] || {};
    const definition = state.assignmentDefinitions[state.selectedAssignmentId];

    els.detailTitle.textContent = `${student.displayName} - ${state.selectedAssignmentId}`;
    els.detailContent.innerHTML = '';

    if (definition) {
        definition.pages.forEach(page => {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'assignment-page';
            pageDiv.innerHTML = `<h2>${page.title}</h2>`;
            const pageAnswers = submission[page.id] || {};
            page.elements.forEach(el => {
                if (el.type === 'quill') {
                    const answer = pageAnswers[el.id] || '<span style="color:#ccc;">Keine Antwort</span>';
                    pageDiv.innerHTML += `<div class="qa-pair"><div class="question">${el.question}</div><div class="answer">${answer}</div></div>`;
                }
            });
            els.detailContent.appendChild(pageDiv);
        });
    } else {
        // Fallback for missing JSON
        Object.keys(submission).forEach(pageId => {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'assignment-page';
            pageDiv.innerHTML = `<h2>Page: ${pageId}</h2>`;
            const answers = submission[pageId];
            Object.keys(answers).forEach(qId => {
                pageDiv.innerHTML += `<div class="qa-pair"><div class="question">ID: ${qId}</div><div class="answer">${answers[qId]}</div></div>`;
            });
            els.detailContent.appendChild(pageDiv);
        });
    }
}