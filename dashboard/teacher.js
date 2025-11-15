// FILE: dashboard/teacher.js (Final Corrected Version)
import { firebaseConfig } from '../js/firebase-config.js';

const CREATE_USER_URL = 'https://get-all-submissions-305371665876.europe-west6.run.app/createUserAccount';

// --- INITIALIZE FIREBASE ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore(); // This was missing

// --- GLOBAL STATE ---
let state = {
    user: null,
    idToken: null,
    classes: [],
    users: [],
    submissions: {},
    selectedClassId: null,
};

// --- DOM ELEMENTS ---
const loginOverlay = document.getElementById('login-overlay');
const dashboardContainer = document.getElementById('dashboard-container');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const sidebarContent = document.getElementById('sidebar-content');
const viewerPlaceholder = document.getElementById('viewer-placeholder');
const viewerContent = document.getElementById('viewer-content');

// --- AUTHENTICATION ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        const idTokenResult = await user.getIdTokenResult();
        if (idTokenResult.claims.isTeacher) {
            state.user = user;
            state.idToken = await user.getIdToken();
            loginOverlay.classList.remove('visible');
            dashboardContainer.style.display = 'flex';
            initializeApp();
        } else {
            alert("Zugriff verweigert. Sie sind nicht als Lehrer registriert.");
            auth.signOut();
        }
    } else {
        state = { user: null, idToken: null, classes: [], users: [], submissions: {}, selectedClassId: null };
        dashboardContainer.style.display = 'none';
        loginOverlay.classList.add('visible');
    }
});

loginBtn.addEventListener('click', () => {
    const email = document.getElementById('teacher-email').value;
    const password = document.getElementById('teacher-password').value;
    auth.signInWithEmailAndPassword(email, password).catch(err => {
        document.getElementById('login-status').textContent = err.message;
    });
});

logoutBtn.addEventListener('click', () => auth.signOut());

// --- MAIN APP LOGIC ---
async function initializeApp() {
    sidebarContent.innerHTML = '<p>Lade Daten...</p>';
    await fetchData();
    renderClassesTab();
}

// --- THIS IS THE CORRECTED fetchData FUNCTION ---
async function fetchData() {
    try {
        // Teachers can read all these collections based on our security rules.
        // We no longer need to call the old 'getAllSubmissions' function.
        const classesPromise = db.collection('classes').where('teacherId', '==', state.user.uid).get();
        const usersPromise = db.collection('users').get();
        const submissionsPromise = db.collection('submissions').get();

        const [classSnap, userSnap, submissionSnap] = await Promise.all([classesPromise, usersPromise, submissionsPromise]);

        state.classes = classSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.users = userSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.submissions = {};
        submissionSnap.forEach(doc => { state.submissions[doc.id] = doc.data(); });
    } catch (error) {
        console.error("Error fetching data directly from Firestore:", error);
        sidebarContent.innerHTML = `<p style="color:red;">Fehler beim Laden der Daten: ${error.message}</p>`;
    }
}

// --- RENDER FUNCTIONS (No changes below this line) ---
function renderClassesTab() {
    const classListHtml = state.classes.map(c => `<div class="class-item" data-id="${c.id}">${c.className}</div>`).join('') || '<i>Noch keine Klassen erstellt.</i>';
    sidebarContent.innerHTML = `
        <div id="class-list">${classListHtml}</div>
        <div class="form-section">
            <h4>Neue Klasse erstellen</h4>
            <form id="add-class-form">
                <input type="text" name="className" placeholder="Name der Klasse" required>
                <button type="submit">Erstellen</button>
            </form>
        </div>
    `;
    document.getElementById('add-class-form').addEventListener('submit', handleAddClass);
}

function renderStudentsTab() {
    const classOptions = state.classes.map(c => `<option value="${c.id}">${c.className}</option>`).join('');
    let studentListHtml = '<i>Wählen Sie eine Klasse, um Schüler anzuzeigen.</i>';
    if (state.selectedClassId) {
        const studentsInClass = state.users.filter(u => u.classId === state.selectedClassId);
        studentListHtml = studentsInClass.map(s => `
            <div class="student-item" data-id="${s.id}">
                <strong>${s.displayName}</strong><br>
                <small>${s.email}</small>
            </div>
        `).join('') || '<i>Keine Schüler in dieser Klasse.</i>';
    }
    sidebarContent.innerHTML = `
        <select id="class-selector" style="width:100%; padding:8px; margin-bottom:1em;">
            <option value="">Klasse auswählen...</option>
            ${classOptions}
        </select>
        <div id="student-list">${studentListHtml}</div>
        <div class="form-section">
            <h4>Neuen Schüler hinzufügen</h4>
            <form id="add-student-form">
                <select name="classId" required><option value="">Klasse zuweisen...</option>${classOptions}</select>
                <input type="text" name="displayName" placeholder="Name des Schülers" required>
                <input type="email" name="email" placeholder="E-Mail des Schülers" required>
                <input type="text" name="password" placeholder="Initialpasswort" required>
                <button type="submit">Hinzufügen</button>
            </form>
        </div>
    `;
    const classSelector = document.getElementById('class-selector');
    if (state.selectedClassId) classSelector.value = state.selectedClassId;
    classSelector.addEventListener('change', (e) => {
        state.selectedClassId = e.target.value;
        renderStudentsTab();
    });
    document.getElementById('add-student-form').addEventListener('submit', handleAddStudent);
    attachStudentListListeners();
}

function renderSubmissionContent(studentId) {
    viewerPlaceholder.style.display = 'none';
    viewerContent.innerHTML = '';
    const submission = state.submissions[studentId];
    const student = state.users.find(u => u.id === studentId);
    if (!submission) {
        viewerContent.innerHTML = `<h3>Für ${student?.displayName || 'diesen Schüler'} wurde noch keine Abgabe gefunden.</h3>`;
        return;
    }
    let contentHtml = `<h1>Abgabe von ${student?.displayName || 'Schüler'}</h1>`;
    for (const pageId in submission) {
        contentHtml += `<div class="assignment-block"><h2>Seite: ${pageId}</h2>`;
        const pageData = submission[pageId];
        for (const questionId in pageData) {
            const answer = pageData[questionId] || '<p><i>Keine Antwort.</i></p>';
            contentHtml += `
                <div style="margin-top: 1.5em;">
                    <p style="font-weight: bold; margin-bottom: 0.5em;">Frage-ID: ${questionId}</p>
                    <div class="answer-box"><div class="ql-snow"><div class="ql-editor">${answer}</div></div></div>
                </div>
            `;
        }
        contentHtml += `</div>`;
    }
    viewerContent.innerHTML = contentHtml;
}

// --- EVENT HANDLERS & HELPERS ---
function attachTabEventListeners() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.target.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            if (tab === 'classes') renderClassesTab();
            else if (tab === 'students') renderStudentsTab();
        });
    });
}
attachTabEventListeners();

function attachStudentListListeners() {
    document.querySelectorAll('#student-list .student-item').forEach(item => {
        item.addEventListener('click', () => renderSubmissionContent(item.dataset.id));
    });
}

async function handleAddClass(e) {
    e.preventDefault();
    const form = e.target;
    const className = form.className.value;
    if (!className) return;
    const registrationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
        await db.collection('classes').add({ className, teacherId: state.user.uid, registrationCode });
        await initializeApp();
    } catch (error) {
        console.error("Error adding class:", error);
        alert("Klasse konnte nicht erstellt werden.");
    }
}

async function handleAddStudent(e) {
    e.preventDefault();
    const form = e.target;
    const payload = {
        idToken: state.idToken,
        classId: form.classId.value,
        displayName: form.displayName.value,
        email: form.email.value,
        password: form.password.value,
    };

    if (CREATE_USER_URL.includes('YOUR_CREATE_USER_FUNCTION_URL')) {
        alert('Konfigurationsfehler: Die URL der Cloud Function ist in teacher.js nicht festgelegt.');
        return;
    }
    
    try {
        const response = await fetch(CREATE_USER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        alert(result.message);
        await initializeApp();
        renderStudentsTab();
    } catch (error) {
        console.error("Error adding student:", error);
        alert(`Fehler: ${error.message}`);
    }
}