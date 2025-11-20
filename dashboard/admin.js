// FILE: dashboard/admin.js
import { firebaseConfig } from '../js/firebase-config.js';

// --- CONFIG ---
const CREATE_USER_URL = 'https://get-all-submissions-305371665876.europe-west6.run.app/createUserAccount';

// --- INIT ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let state = {
    user: null,
    classes: [],
    users: []
};

// --- AUTH CHECK ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        const token = await user.getIdTokenResult();
        if (token.claims.isTeacher) {
            state.user = user;
            initAdmin();
        } else {
            alert("Zugriff verweigert.");
            window.location.href = 'teacher.html';
        }
    } else {
        window.location.href = 'teacher.html'; // Redirect to login on main dashboard
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    auth.signOut().then(() => window.location.href = 'teacher.html');
});

function initAdmin() {
    // Fetch Classes
    db.collection('classes').where('teacherId', '==', state.user.uid).onSnapshot(snap => {
        state.classes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderClassList();
        updateClassSelects();
    });

    // Fetch Users
    db.collection('users').onSnapshot(snap => {
        state.users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderStudentList();
    });
}

// --- CLASS MANAGEMENT ---
document.getElementById('create-class-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('class-name').value;
    try {
        await db.collection('classes').add({
            className: name,
            teacherId: state.user.uid,
            registrationCode: Math.random().toString(36).substring(7).toUpperCase()
        });
        document.getElementById('class-name').value = '';
        alert(`Klasse "${name}" erstellt.`);
    } catch (err) {
        alert("Fehler: " + err.message);
    }
});

// FILE: dashboard/admin.js (Update this function)

function renderClassList() {
    const container = document.getElementById('class-list');
    container.innerHTML = '';
    
    if (state.classes.length === 0) {
        container.innerHTML = '<p style="color:#777; font-style:italic;">Keine Klassen vorhanden.</p>';
        return;
    }

    state.classes.forEach(cls => {
        const div = document.createElement('div');
        div.className = 'list-item';
        
        // We use a data attribute on the button to know which ID to delete
        div.innerHTML = `
            <div class="list-item-content">
                <strong>${cls.className}</strong>
                <span style="font-family:monospace; background:#eee; padding:2px 5px; margin-left:10px; font-size:0.9em;">Code: ${cls.registrationCode || '-'}</span>
            </div>
            <button class="delete-btn" title="Klasse löschen" data-id="${cls.id}">🗑</button>
        `;
        
        // Add click listener to the delete button
        const deleteBtn = div.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => handleDeleteClass(cls.id, cls.className));
        
        container.appendChild(div);
    });
}

function updateClassSelects() {
    const createSelect = document.getElementById('student-class-select');
    const filterSelect = document.getElementById('filter-class-select');
    
    const options = state.classes.map(c => `<option value="${c.id}">${c.className}</option>`).join('');
    
    createSelect.innerHTML = '<option value="">Klasse wählen...</option>' + options;
    
    const currentFilter = filterSelect.value;
    filterSelect.innerHTML = '<option value="">Alle Klassen anzeigen</option>' + options;
    filterSelect.value = currentFilter;
}

// --- STUDENT MANAGEMENT ---
document.getElementById('create-student-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Erstelle...';

    const classId = document.getElementById('student-class-select').value;
    const name = document.getElementById('student-name').value;
    const email = document.getElementById('student-email').value;
    const pass = document.getElementById('student-pass').value;

    try {
        const token = await state.user.getIdToken();
        const res = await fetch(CREATE_USER_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                idToken: token,
                classId: classId,
                displayName: name,
                email: email,
                password: pass
            })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        
        alert("Schüler erfolgreich erstellt!");
        e.target.reset();
    } catch (err) {
        console.error(err);
        alert("Fehler: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
});

document.getElementById('filter-class-select').addEventListener('change', renderStudentList);

// FILE: dashboard/admin.js (Update this function)

function renderStudentList() {
    const container = document.getElementById('student-list');
    const filterId = document.getElementById('filter-class-select').value;
    
    container.innerHTML = '';
    
    let students = state.users.filter(u => u.role !== 'teacher');
    if (filterId) {
        students = students.filter(u => u.classId === filterId);
    }

    if (students.length === 0) {
        container.innerHTML = '<p style="color:#777; font-style:italic;">Keine Schüler gefunden.</p>';
        return;
    }

    students.forEach(s => {
        const cls = state.classes.find(c => c.id === s.classId);
        const div = document.createElement('div');
        div.className = 'list-item';
        
        div.innerHTML = `
            <div class="list-item-content">
                <div style="font-weight:bold;">${s.displayName}</div>
                <div style="font-size:0.85em; color:#666;">${s.email}</div>
                <div style="font-size:0.85em; background:#e9ecef; padding:2px 6px; border-radius:4px; display:inline-block; margin-top:4px;">
                    ${cls ? cls.className : 'Keine Klasse'}
                </div>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="reset-btn" title="Passwort-Reset E-Mail senden" data-email="${s.email}">🔑</button>
                <button class="delete-btn" title="Schüler entfernen" data-id="${s.id}">🗑</button>
            </div>
        `;
        
        // Attach Reset Listener
        div.querySelector('.reset-btn').addEventListener('click', () => handleResetPassword(s.email));
        
        // Attach Delete Listener (Logic for this needs to be added if you want to delete students too)
        div.querySelector('.delete-btn').addEventListener('click', () => handleDeleteStudent(s.id, s.displayName));

        container.appendChild(div);
    });
}

// Add these helper functions to admin.js

async function handleResetPassword(email) {
    if(confirm(`Soll eine E-Mail zum Zurücksetzen des Passworts an ${email} gesendet werden?`)) {
        try {
            await auth.sendPasswordResetEmail(email);
            alert("E-Mail wurde versendet.");
        } catch (e) {
            alert("Fehler: " + e.message);
        }
    }
}

async function handleDeleteStudent(studentId, studentName) {
    if(confirm(`Möchten Sie ${studentName} wirklich aus der Liste entfernen? (Hinweis: Der Login bleibt bestehen, nur die Verknüpfung wird gelöscht)`)) {
        try {
            await db.collection('users').doc(studentId).delete();
            alert("Schüler entfernt.");
        } catch (e) {
            alert("Fehler: " + e.message);
        }
    }
}

// FILE: dashboard/admin.js (Add this function at the bottom)

async function handleDeleteClass(classId, className) {
    // 1. Confirm with the user
    const confirmed = confirm(`Sind Sie sicher, dass Sie die Klasse "${className}" löschen möchten?\n\nDie Schüler bleiben erhalten, sind aber keiner Klasse mehr zugeordnet.`);
    
    if (!confirmed) return;

    try {
        // 2. Delete from Firestore
        await db.collection('classes').doc(classId).delete();
        
        // Note: We do not need to manually update the UI here because 
        // the onSnapshot listener in initAdmin() will trigger automatically!
        alert(`Klasse "${className}" wurde gelöscht.`);
        
    } catch (error) {
        console.error("Error deleting class:", error);
        alert("Fehler beim Löschen: " + error.message);
    }
}