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
    assignmentDefinitions: {},
    selectedPageIndex: 0
};

// --- DOM ELEMENTS ---
const els = {
    loginOverlay: document.getElementById('login-overlay'),
    navContent: document.getElementById('nav-content'),
    studentListContent: document.getElementById('student-list-content'),
    detailContent: document.getElementById('detail-content'),
    detailTitle: document.getElementById('detail-title'),
    studentListTitle: document.getElementById('student-list-title'),
    studentControls: document.getElementById('student-controls'),
    prevStudentBtn: document.getElementById('prev-student-btn'),
    nextStudentBtn: document.getElementById('next-student-btn'),
    studentIndicator: document.getElementById('student-indicator'),
    stepControls: document.getElementById('step-controls'),
    prevPageBtn: document.getElementById('prev-page-btn'),
    nextPageBtn: document.getElementById('next-page-btn'),
    pageIndicator: document.getElementById('page-indicator'),
    pageSelect: document.getElementById('page-select')
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
els.prevPageBtn.addEventListener('click', () => {
    const definition = state.assignmentDefinitions[state.selectedAssignmentId];
    if (!definition || state.selectedPageIndex <= 0) return;
    state.selectedPageIndex -= 1;
    renderDetailView();
});
els.prevStudentBtn.addEventListener('click', () => {
    navigateStudent(-1);
});
els.nextStudentBtn.addEventListener('click', () => {
    navigateStudent(1);
});
els.nextPageBtn.addEventListener('click', () => {
    const definition = state.assignmentDefinitions[state.selectedAssignmentId];
    if (!definition || state.selectedPageIndex >= definition.pages.length - 1) return;
    state.selectedPageIndex += 1;
    renderDetailView();
});
els.pageSelect.addEventListener('change', () => {
    const definition = state.assignmentDefinitions[state.selectedAssignmentId];
    if (!definition) return;
    const nextIndex = parseInt(els.pageSelect.value, 10);
    if (Number.isNaN(nextIndex)) return;
    state.selectedPageIndex = nextIndex;
    const students = getOrderedStudents();
    const autoSelected = ensureSelectedStudent(students);
    if (autoSelected) {
        renderStudentList();
    }
    updateStepControls(definition);
    renderDetailView();
});

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

    // --- CUSTOM FILTERS (NEW) ---
    const customFilters = [
        { id: 'all_submitted', className: '🌟 Alle mit Antworten' },
        { id: 'unassigned', className: '⚠️ Ohne Klasse' }
    ];

    customFilters.forEach(filter => {
        const group = document.createElement('div');
        group.className = 'nav-group custom-filter-group'; // Add a class for styling if needed
        if (state.selectedClassId === filter.id) group.classList.add('active-group'); // Optional styling

        const header = document.createElement('div');
        header.className = 'nav-class-header';
        header.textContent = filter.className;
        header.style.fontWeight = "bold";

        if (state.selectedClassId === filter.id) {
            header.style.background = "#e9ecef"; // Highlight active state
            header.style.color = "#000";
        }

        header.addEventListener('click', () => selectClass(filter.id));
        group.appendChild(header);

        // If selected, show assignments too? 
        // For "All Submitted" it makes sense to show discovered assignments so you can filter ALL students by assignment
        if (state.selectedClassId === filter.id && assignmentList.length > 0) {
            assignmentList.forEach(assId => {
                const item = document.createElement('div');
                item.className = 'nav-assignment-item';
                item.textContent = `📄 ${assId}`;
                if (state.selectedAssignmentId === assId) {
                    item.classList.add('active');
                }
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectClass(filter.id);
                    selectAssignment(assId);
                });
                group.appendChild(item);
            });
        }

        els.navContent.appendChild(group);
    });

    // Separator
    const sep = document.createElement('hr');
    sep.style.margin = "10px 0";
    sep.style.border = "none";
    sep.style.borderTop = "1px solid #ddd";
    els.navContent.appendChild(sep);
    // ----------------------------

    if (state.classes.length === 0) {
        // Keep the message but append it after custom filters
        const msg = document.createElement('div');
        msg.innerHTML = '<p style="padding:10px; color:#666;">Keine regulären Klassen gefunden.</p>';
        els.navContent.appendChild(msg);
    }

    state.classes.forEach(cls => {
        const group = document.createElement('div');
        group.className = 'nav-group';

        const header = document.createElement('div');
        header.className = 'nav-class-header';
        header.textContent = cls.className;
        if (state.selectedClassId === cls.id) {
            header.style.background = "#e9ecef";
            header.style.color = "#000";
        }
        header.addEventListener('click', () => selectClass(cls.id));
        group.appendChild(header);

        if (state.selectedClassId === cls.id && assignmentList.length > 0) { // Only show assignments if class is selected to save space? Or always? Original was always (nested in logic). 
            // Original logic: "if (assignmentList.length > 0)" was inside the loop, so it showed for all classes. 
            // To match "accordion" style or keep it clean, maybe only show for active? 
            // User didn't ask for accordion, but previous code showed them always. Let's keep it simple.
            // Actually, original code appended them to every group. Let's keep that behavior.
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
        }
        // Custom Handling for empty assignments in regular classes
        if (assignmentList.length === 0) {
            group.innerHTML += '<div class="nav-assignment-item" style="font-style:italic; color:#999;">Keine aktiven Aufgaben</div>';
        }
        els.navContent.appendChild(group);
    });
}

function selectClass(classId) {
    state.selectedClassId = classId;
    state.selectedAssignmentId = null;
    state.selectedStudentId = null;
    state.selectedPageIndex = 0;
    renderNav();
    renderStudentList();
    els.detailContent.innerHTML = '<div class="empty-state"><p>Wählen Sie eine Aufgabe aus.</p></div>';
    els.detailTitle.textContent = 'Ansicht';
    updateStudentControls();
    updateStepControls();
}

async function selectAssignment(assignmentId) {
    state.selectedAssignmentId = assignmentId;
    state.selectedStudentId = null;
    state.selectedPageIndex = 0;
    renderNav();
    renderStudentList();
    els.detailContent.innerHTML = '<div class="empty-state"><p>Wählen Sie einen Schüler aus.</p></div>';
    els.detailTitle.textContent = `Aufgabe: ${assignmentId}`;
    updateStudentControls();
    updateStepControls();

    if (!state.assignmentDefinitions[assignmentId]) {
        try {
            const res = await fetch(`../assignments/${assignmentId}.json`);
            if (res.ok) state.assignmentDefinitions[assignmentId] = await res.json();
        } catch (e) { console.warn("JSON load failed", e); }
    }

    updateStepControls(state.assignmentDefinitions[assignmentId]);
}

function renderStudentList() {
    els.studentListContent.innerHTML = '';
    if (!state.selectedClassId) return;

    const students = getOrderedStudents();
    const autoSelected = ensureSelectedStudent(students);
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
            state.selectedPageIndex = 0;
            renderStudentList();
            renderDetailView();
        });
        els.studentListContent.appendChild(card);
    });

    if (autoSelected) {
        renderDetailView();
    }
}

function getOrderedStudents() {
    if (!state.selectedClassId) return [];

    let filteredUsers = [];

    if (state.selectedClassId === 'unassigned') {
        const classIds = new Set(state.classes.map(c => c.id));
        filteredUsers = state.users.filter(u => !u.classId || !classIds.has(u.classId));
    } else if (state.selectedClassId === 'all_submitted') {
        filteredUsers = state.users.filter(u => {
            const sub = state.submissions[u.id];
            // Check if they have ANY submission keys
            return sub && Object.keys(sub).length > 0;
        });
    } else {
        filteredUsers = state.users.filter(u => u.classId === state.selectedClassId);
    }

    return filteredUsers
        .slice()
        .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
}

function ensureSelectedStudent(students) {
    if (!state.selectedAssignmentId || students.length === 0) return false;
    if (!state.selectedStudentId || !students.some(s => s.id === state.selectedStudentId)) {
        state.selectedStudentId = students[0].id;
        return true;
    }
    return false;
}

function updateStudentControls() {
    const students = getOrderedStudents();
    if (!state.selectedStudentId || students.length === 0) {
        els.studentControls.classList.add('hidden');
        return;
    }

    const idx = students.findIndex(s => s.id === state.selectedStudentId);
    if (idx === -1) {
        els.studentControls.classList.add('hidden');
        return;
    }

    els.studentIndicator.textContent = `Schüler ${idx + 1}/${students.length}: ${students[idx].displayName}`;
    els.prevStudentBtn.disabled = idx === 0;
    els.nextStudentBtn.disabled = idx === students.length - 1;
    els.studentControls.classList.remove('hidden');
}

function navigateStudent(direction) {
    const students = getOrderedStudents();
    if (!state.selectedStudentId || students.length === 0) return;
    const idx = students.findIndex(s => s.id === state.selectedStudentId);
    if (idx === -1) return;

    const nextIndex = idx + direction;
    if (nextIndex < 0 || nextIndex >= students.length) return;

    state.selectedStudentId = students[nextIndex].id;
    renderStudentList();
    renderDetailView();
}

function updateStepControls(definition) {
    if (!state.selectedAssignmentId || !definition || !definition.pages || definition.pages.length === 0) {
        els.stepControls.classList.add('hidden');
        return;
    }

    if (state.selectedPageIndex < 0) state.selectedPageIndex = 0;
    if (state.selectedPageIndex >= definition.pages.length) state.selectedPageIndex = definition.pages.length - 1;

    const currentPage = definition.pages[state.selectedPageIndex];
    if (!els.pageSelect.options.length || els.pageSelect.options.length !== definition.pages.length) {
        els.pageSelect.innerHTML = '';
        definition.pages.forEach((page, idx) => {
            const option = document.createElement('option');
            option.value = idx;
            option.textContent = `Schritt ${idx + 1}: ${page.title}`;
            els.pageSelect.appendChild(option);
        });
    }
    els.pageSelect.value = String(state.selectedPageIndex);
    els.pageIndicator.textContent = `Schritt ${state.selectedPageIndex + 1}/${definition.pages.length}: ${currentPage.title}`;
    els.prevPageBtn.disabled = state.selectedPageIndex === 0;
    els.nextPageBtn.disabled = state.selectedPageIndex === definition.pages.length - 1;
    els.stepControls.classList.remove('hidden');
}

function renderDetailView() {
    if (!state.selectedStudentId || !state.selectedAssignmentId) return;

    const student = state.users.find(u => u.id === state.selectedStudentId);
    const submission = state.submissions[state.selectedStudentId]?.[state.selectedAssignmentId] || {};
    const definition = state.assignmentDefinitions[state.selectedAssignmentId];

    els.detailTitle.textContent = `${student.displayName} - ${state.selectedAssignmentId}`;
    els.detailContent.innerHTML = '';

    if (definition) {
        updateStepControls(definition);
        updateStudentControls();
        const page = definition.pages[state.selectedPageIndex];
        if (!page) return;

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
    } else {
        updateStepControls();
        updateStudentControls();
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






