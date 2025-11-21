# LMS Box v3.0 - Detailed Implementation Plan

## Phase 1: Quick Wins (2-3 weeks)

### 1.1 Real-time Collaboration Indicators

#### Overview
Add visual indicators showing which students are actively working, recently active, or idle. This gives teachers situational awareness for timely interventions.

#### Technical Implementation

**Step 1: Add Presence Tracking (Week 1, Days 1-2)**

**File: `js/renderer.js`** - Add heartbeat function
```javascript
// Add after imports
let presenceInterval = null;

export function startPresenceTracking(userUid, assignmentId, pageId) {
    stopPresenceTracking(); // Clean up any existing interval
    
    const db = firebase.firestore();
    const updatePresence = async () => {
        try {
            await db.collection('presence').doc(userUid).set({
                assignmentId: assignmentId,
                pageId: pageId,
                lastActive: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'active'
            }, { merge: true });
        } catch (error) {
            console.error("Presence update failed:", error);
        }
    };
    
    // Update immediately
    updatePresence();
    
    // Then every 5 seconds
    presenceInterval = setInterval(updatePresence, 5000);
}

export function stopPresenceTracking() {
    if (presenceInterval) {
        clearInterval(presenceInterval);
        presenceInterval = null;
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', stopPresenceTracking);
```

**File: `js/app.js`** - Integrate presence tracking
```javascript
// Import the new functions
import { renderPage, loadAndRenderAnswers, setupQuillListeners, startPresenceTracking, stopPresenceTracking } from './renderer.js';

// Modify navigateToStep function
async function navigateToStep(index) {
    if (!state.assignmentData || index < 0 || index >= state.assignmentData.pages.length) return;
    
    // Stop tracking previous page
    stopPresenceTracking();
    
    state.currentStepIndex = index;
    const currentPageData = state.assignmentData.pages[index];
    
    renderPage(currentPageData, stepperContentEl);
    await loadAndRenderAnswers(state.firebaseUser.uid, state.assignmentId, currentPageData);
    setupQuillListeners(state.firebaseUser.uid, state.assignmentId, currentPageData);
    
    // Start tracking new page
    startPresenceTracking(state.firebaseUser.uid, state.assignmentId, currentPageData.id);
    
    updateSidebarActiveState();
    updateNavigationButtons();
}
```

**Step 2: Display Presence in Teacher Dashboard (Week 1, Days 3-4)**

**File: `dashboard/teacher.css`** - Add status indicators
```css
/* Add to end of file */
.presence-indicator {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    margin-right: 8px;
    border: 2px solid white;
    box-shadow: 0 0 3px rgba(0,0,0,0.3);
}

.presence-active {
    background-color: #28a745; /* Green */
    animation: pulse 2s infinite;
}

.presence-recent {
    background-color: #ffc107; /* Yellow */
}

.presence-idle {
    background-color: #6c757d; /* Gray */
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

.student-card .meta-info {
    font-size: 0.75rem;
    color: #6c757d;
    margin-top: 4px;
}
```

**File: `dashboard/teacher.js`** - Add presence listener
```javascript
// Add to state object
let state = {
    // ... existing properties
    presenceData: {} // NEW
};

// Add new function after initDashboard()
function initPresenceListener() {
    db.collection('presence').onSnapshot(snap => {
        state.presenceData = {};
        snap.forEach(doc => {
            state.presenceData[doc.id] = doc.data();
        });
        // Refresh student list if we're viewing one
        if (state.selectedClassId && state.selectedAssignmentId) {
            renderStudentList();
        }
    });
}

// Call it in initDashboard()
function initDashboard() {
    // ... existing listeners
    initPresenceListener(); // ADD THIS
}

// Modify renderStudentList() to include presence
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
        
        // NEW: Check presence
        let presenceIndicator = '<span class="presence-indicator presence-idle"></span>';
        let presenceText = '';
        
        const presence = state.presenceData[student.id];
        if (presence && presence.lastActive) {
            const lastActive = presence.lastActive.toDate();
            const secondsAgo = (now - lastActive) / 1000;
            
            if (secondsAgo < 30) {
                presenceIndicator = '<span class="presence-indicator presence-active"></span>';
                presenceText = '<span class="meta-info">🟢 Gerade aktiv</span>';
            } else if (secondsAgo < 300) { // 5 minutes
                presenceIndicator = '<span class="presence-indicator presence-recent"></span>';
                const minAgo = Math.floor(secondsAgo / 60);
                presenceText = `<span class="meta-info">🟡 Vor ${minAgo} Min.</span>`;
            } else {
                presenceText = '<span class="meta-info">⚫ Inaktiv</span>';
            }
        }
        
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
                <span class="status ${statusClass}">${statusText}</span>
                ${presenceText}
            </div>
        `;
        
        card.addEventListener('click', () => {
            state.selectedStudentId = student.id;
            renderStudentList();
            renderDetailView();
        });
        els.studentListContent.appendChild(card);
    });
}
```

**Step 3: Firestore Security Rules (Week 1, Day 5)**

Add to Firebase Console → Firestore → Rules:
```javascript
match /presence/{userId} {
  // Users can write their own presence
  allow write: if request.auth != null && request.auth.uid == userId;
  // Teachers can read all presence
  allow read: if request.auth.token.isTeacher == true;
}
```

**Testing Checklist:**
- [ ] Open student view, verify presence document created in Firestore
- [ ] Switch pages, verify `pageId` updates
- [ ] Close tab, verify presence stops updating
- [ ] Open teacher dashboard, verify green dot appears for active student
- [ ] Wait 1 minute, verify dot turns yellow
- [ ] Wait 5+ minutes, verify dot turns gray

---

### 1.2 Immediate Feedback System

#### Overview
Allow teachers to add inline comments and quick feedback stamps to student work while monitoring live.

#### Technical Implementation

**Step 1: Database Schema Design (Week 2, Day 1)**

**Firestore Structure:**
```
/feedback
  /{studentId}
    /{assignmentId}
      /{pageId}
        /{elementId}: [
          {
            text: "Great analysis!",
            type: "positive" | "warning" | "question",
            timestamp: Timestamp,
            teacherId: "abc123",
            teacherName: "Herr Schmidt"
          }
        ]
```

**Step 2: Teacher UI for Adding Feedback (Week 2, Days 2-3)**

**File: `dashboard/teacher.css`** - Add feedback styles
```css
/* Add to end of file */
.feedback-toolbar {
    position: sticky;
    top: 0;
    background: white;
    border-bottom: 2px solid #e9ecef;
    padding: 10px;
    display: flex;
    gap: 10px;
    z-index: 100;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.feedback-mode-toggle {
    padding: 8px 16px;
    border: 2px solid #007bff;
    background: white;
    color: #007bff;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
}

.feedback-mode-toggle.active {
    background: #007bff;
    color: white;
}

.feedback-mode-toggle:hover {
    background: #e7f1ff;
}

.qa-pair {
    position: relative;
    border: 2px solid transparent;
    transition: border-color 0.2s;
}

.qa-pair.feedback-enabled:hover {
    border-color: #007bff;
    border-radius: 4px;
    cursor: pointer;
}

.feedback-list {
    margin-top: 10px;
    padding-left: 20px;
}

.feedback-item {
    display: flex;
    align-items: start;
    gap: 10px;
    padding: 8px;
    margin-bottom: 8px;
    border-radius: 4px;
    font-size: 0.9rem;
}

.feedback-item.positive {
    background: #d4edda;
    border-left: 4px solid #28a745;
}

.feedback-item.warning {
    background: #fff3cd;
    border-left: 4px solid #ffc107;
}

.feedback-item.question {
    background: #d1ecf1;
    border-left: 4px solid #17a2b8;
}

.feedback-item .icon {
    font-size: 1.2rem;
}

.feedback-item .content {
    flex: 1;
}

.feedback-item .meta {
    font-size: 0.75rem;
    color: #6c757d;
    margin-top: 4px;
}

.feedback-form {
    margin-top: 10px;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 4px;
    display: none;
}

.feedback-form.visible {
    display: block;
}

.feedback-form textarea {
    width: 100%;
    padding: 8px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    resize: vertical;
    min-height: 60px;
    font-family: inherit;
}

.feedback-form .button-group {
    display: flex;
    gap: 8px;
    margin-top: 10px;
}

.feedback-form button {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
}

.feedback-form .btn-positive {
    background: #28a745;
    color: white;
}

.feedback-form .btn-warning {
    background: #ffc107;
    color: #212529;
}

.feedback-form .btn-question {
    background: #17a2b8;
    color: white;
}

.feedback-form .btn-cancel {
    background: #6c757d;
    color: white;
}
```

**File: `dashboard/teacher.js`** - Add feedback functionality
```javascript
// Add to state
let state = {
    // ... existing
    feedbackMode: false,
    feedbackData: {}
};

// Add feedback listener to initDashboard()
function initDashboard() {
    // ... existing listeners
    
    // Listen to feedback
    db.collection('feedback').onSnapshot(snap => {
        state.feedbackData = {};
        snap.forEach(doc => {
            state.feedbackData[doc.id] = doc.data();
        });
        if (state.selectedStudentId && state.selectedAssignmentId) {
            renderDetailView();
        }
    });
}

// Modify renderDetailView() to include feedback
function renderDetailView() {
    if (!state.selectedStudentId || !state.selectedAssignmentId) return;

    const student = state.users.find(u => u.id === state.selectedStudentId);
    const submission = state.submissions[state.selectedStudentId]?.[state.selectedAssignmentId] || {};
    const definition = state.assignmentDefinitions[state.selectedAssignmentId];
    const studentFeedback = state.feedbackData[state.selectedStudentId]?.[state.selectedAssignmentId] || {};

    els.detailTitle.textContent = `${student.displayName} - ${state.selectedAssignmentId}`;
    els.detailContent.innerHTML = '';
    
    // Add feedback toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'feedback-toolbar';
    toolbar.innerHTML = `
        <button id="feedback-toggle" class="feedback-mode-toggle">
            📝 Feedback-Modus
        </button>
        <span style="color:#6c757d; font-size:0.9rem;">
            Klicken Sie auf Antworten, um Feedback zu geben
        </span>
    `;
    els.detailContent.appendChild(toolbar);
    
    // Toggle feedback mode
    toolbar.querySelector('#feedback-toggle').addEventListener('click', (e) => {
        state.feedbackMode = !state.feedbackMode;
        e.target.classList.toggle('active', state.feedbackMode);
        document.querySelectorAll('.qa-pair').forEach(qa => {
            qa.classList.toggle('feedback-enabled', state.feedbackMode);
        });
    });

    if (definition) {
        definition.pages.forEach(page => {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'assignment-page';
            pageDiv.innerHTML = `<h2>${page.title}</h2>`;
            
            const pageAnswers = submission[page.id] || {};
            const pageFeedback = studentFeedback[page.id] || {};
            
            page.elements.forEach(el => {
                if (el.type === 'quill') {
                    const answer = pageAnswers[el.id] || '<span style="color:#ccc;">Keine Antwort</span>';
                    const feedbackList = pageFeedback[el.id] || [];
                    
                    const qaDiv = document.createElement('div');
                    qaDiv.className = 'qa-pair';
                    qaDiv.dataset.pageId = page.id;
                    qaDiv.dataset.elementId = el.id;
                    
                    qaDiv.innerHTML = `
                        <div class="question">${el.question}</div>
                        <div class="answer">${answer}</div>
                    `;
                    
                    // Add existing feedback
                    if (feedbackList.length > 0) {
                        const fbDiv = document.createElement('div');
                        fbDiv.className = 'feedback-list';
                        feedbackList.forEach(fb => {
                            const icons = {positive: '✅', warning: '⚠️', question: '❓'};
                            fbDiv.innerHTML += `
                                <div class="feedback-item ${fb.type}">
                                    <span class="icon">${icons[fb.type]}</span>
                                    <div class="content">
                                        ${fb.text}
                                        <div class="meta">${fb.teacherName} • ${fb.timestamp.toDate().toLocaleString('de-DE')}</div>
                                    </div>
                                </div>
                            `;
                        });
                        qaDiv.appendChild(fbDiv);
                    }
                    
                    // Add feedback form (initially hidden)
                    const formDiv = document.createElement('div');
                    formDiv.className = 'feedback-form';
                    formDiv.innerHTML = `
                        <textarea placeholder="Ihr Feedback..."></textarea>
                        <div class="button-group">
                            <button class="btn-positive" data-type="positive">✅ Gut</button>
                            <button class="btn-warning" data-type="warning">⚠️ Überarbeiten</button>
                            <button class="btn-question" data-type="question">❓ Frage</button>
                            <button class="btn-cancel">Abbrechen</button>
                        </div>
                    `;
                    qaDiv.appendChild(formDiv);
                    
                    // Click handler for feedback mode
                    qaDiv.addEventListener('click', (e) => {
                        if (state.feedbackMode && !e.target.closest('.feedback-form')) {
                            // Close other forms
                            document.querySelectorAll('.feedback-form').forEach(f => f.classList.remove('visible'));
                            formDiv.classList.add('visible');
                            formDiv.querySelector('textarea').focus();
                        }
                    });
                    
                    // Feedback submission
                    formDiv.querySelectorAll('button[data-type]').forEach(btn => {
                        btn.addEventListener('click', () => submitFeedback(
                            state.selectedStudentId,
                            state.selectedAssignmentId,
                            page.id,
                            el.id,
                            formDiv.querySelector('textarea').value,
                            btn.dataset.type
                        ));
                    });
                    
                    formDiv.querySelector('.btn-cancel').addEventListener('click', () => {
                        formDiv.classList.remove('visible');
                        formDiv.querySelector('textarea').value = '';
                    });
                    
                    pageDiv.appendChild(qaDiv);
                }
            });
            els.detailContent.appendChild(pageDiv);
        });
    }
}

// Add new function
async function submitFeedback(studentId, assignmentId, pageId, elementId, text, type) {
    if (!text.trim()) {
        alert("Bitte geben Sie einen Feedback-Text ein.");
        return;
    }
    
    try {
        const feedbackItem = {
            text: text.trim(),
            type: type,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            teacherId: state.user.uid,
            teacherName: state.user.displayName || state.user.email
        };
        
        await db.collection('feedback').doc(studentId).set({
            [assignmentId]: {
                [pageId]: {
                    [elementId]: firebase.firestore.FieldValue.arrayUnion(feedbackItem)
                }
            }
        }, { merge: true });
        
        // Close form
        document.querySelectorAll('.feedback-form').forEach(f => {
            f.classList.remove('visible');
            f.querySelector('textarea').value = '';
        });
        
    } catch (error) {
        console.error("Feedback submission failed:", error);
        alert("Fehler beim Speichern des Feedbacks.");
    }
}
```

**Step 3: Student View for Feedback (Week 2, Days 4-5)**

**File: `js/renderer.js`** - Add feedback display
```javascript
// Add after renderQuillEditorStructure function
export function renderFeedbackNotifications(userUid, assignmentId, pageId, elementId, container) {
    const db = firebase.firestore();
    
    db.collection('feedback').doc(userUid).onSnapshot(doc => {
        if (!doc.exists) return;
        
        const data = doc.data();
        const feedbackList = data?.[assignmentId]?.[pageId]?.[elementId] || [];
        
        // Remove old feedback display
        const oldFeedback = container.querySelector('.student-feedback-list');
        if (oldFeedback) oldFeedback.remove();
        
        if (feedbackList.length > 0) {
            const feedbackDiv = document.createElement('div');
            feedbackDiv.className = 'student-feedback-list';
            feedbackDiv.style.cssText = `
                margin-top: 10px;
                padding: 12px;
                background: #fff3cd;
                border-left: 4px solid #ffc107;
                border-radius: 4px;
            `;
            
            feedbackDiv.innerHTML = '<strong>💬 Feedback von Ihrem Lehrer:</strong>';
            
            feedbackList.forEach(fb => {
                const icons = {positive: '✅', warning: '⚠️', question: '❓'};
                feedbackDiv.innerHTML += `
                    <div style="margin-top:8px; padding:8px; background:white; border-radius:4px;">
                        ${icons[fb.type]} ${fb.text}
                    </div>
                `;
            });
            
            container.appendChild(feedbackDiv);
        }
    });
}
```

**File: `js/app.js`** - Integrate feedback display
```javascript
// Import updated function
import { renderPage, loadAndRenderAnswers, setupQuillListeners, startPresenceTracking, stopPresenceTracking, renderFeedbackNotifications } from './renderer.js';

async function navigateToStep(index) {
    // ... existing code ...
    
    await loadAndRenderAnswers(state.firebaseUser.uid, state.assignmentId, currentPageData);
    setupQuillListeners(state.firebaseUser.uid, state.assignmentId, currentPageData);
    
    // NEW: Setup feedback listeners for each element
    currentPageData.elements.forEach(element => {
        if (element.type === 'quill') {
            const editorDiv = document.getElementById(`quill-editor-${element.id}`);
            if (editorDiv) {
                const wrapper = editorDiv.closest('.quill-element');
                renderFeedbackNotifications(
                    state.firebaseUser.uid,
                    state.assignmentId,
                    currentPageData.id,
                    element.id,
                    wrapper
                );
            }
        }
    });
    
    // ... rest of code ...
}
```

**Step 4: Firestore Security Rules (Week 2, Day 5)**

```javascript
match /feedback/{studentId} {
  // Students can read their own feedback
  allow read: if request.auth != null && request.auth.uid == studentId;
  // Teachers can write feedback
  allow write: if request.auth.token.isTeacher == true;
}
```

**Testing Checklist:**
- [ ] Teacher can toggle feedback mode
- [ ] Clicking answer shows feedback form
- [ ] Submitting feedback saves to Firestore
- [ ] Student view shows yellow notification box with feedback
- [ ] Multiple feedback items display correctly
- [ ] Feedback persists across page reloads

---

### 1.3 Self-Assessment Prompts

#### Overview
Add reflection prompts that appear after students complete sections, encouraging metacognition.

#### Technical Implementation

**Step 1: Update Assignment JSON Schema (Week 3, Day 1)**

**File: `assignments/assignment1.json`** - Add reflection elements
```json
{
  "assignmentId": "komplexe-ausbildungsaufgabe-v2",
  "assignmentTitle": "blabla Ausbildungsaufgabe",
  "pages": [
    {
      "id": "aufgabe-und-ziele",
      "title": "Aufgabe und Ziele",
      "elements": [
        {
          "type": "text",
          "content": "<h2>Aufgabenbeschreibung</h2>..."
        },
        {
          "type": "quill",
          "id": "q1_beschreibung",
          "question": "Beschreiben Sie..."
        },
        {
          "type": "self-assessment",
          "id": "sa1_confidence",
          "triggerAfterWords": 50,
          "triggerElement": "q1_beschreibung",
          "prompts": [
            {
              "type": "rating",
              "question": "Wie sicher fühlen Sie sich mit Ihrer Antwort?",
              "scale": 5,
              "labels": ["Sehr unsicher", "Unsicher", "Neutral", "Sicher", "Sehr sicher"]
            },
            {
              "type": "text",
              "question": "Was war am schwierigsten bei dieser Aufgabe?",
              "placeholder": "Beschreiben Sie die größte Herausforderung..."
            },
            {
              "type": "text",
              "question": "Wenn Sie 10 Minuten mehr Zeit hätten, was würden Sie verbessern?",
              "placeholder": "Ihre Ideen zur Verbesserung..."
            }
          ]
        }
      ]
    }
  ]
}
```

**Step 2: Render Self-Assessment Component (Week 3, Days 2-3)**

**File: `css/styles.css`** - Add self-assessment styles
```css
/* Add to end of file */
.self-assessment-container {
    margin-top: 20px;
    padding: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 8px;
    color: white;
    display: none;
    animation: slideIn 0.4s ease-out;
}

.self-assessment-container.visible {
    display: block;
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.self-assessment-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 15px;
    font-size: 1.1rem;
    font-weight: 600;
}

.self-assessment-prompt {
    background: rgba(255, 255, 255, 0.15);
    padding: 15px;
    border-radius: 6px;
    margin-bottom: 15px;
    backdrop-filter: blur(10px);
}

.self-assessment-prompt:last-child {
    margin-bottom: 0;
}

.self-assessment-question {
    font-weight: 500;
    margin-bottom: 12px;
}

.rating-scale {
    display: flex;
    justify-content: space-between;
    gap: 8px;
}

.rating-option {
    flex: 1;
    text-align: center;
}

.rating-option input[type="radio"] {
    display: none;
}

.rating-option label {
    display: block;
    padding: 12px 8px;
    background: rgba(255, 255, 255, 0.2);
    border: 2px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.85rem;
}

.rating-option input[type="radio"]:checked + label {
    background: white;
    color: #667eea;
    border-color: white;
    font-weight: 600;
}

.rating-option label:hover {
    background: rgba(255, 255, 255, 0.3);
}

.self-assessment-textarea {
    width: 100%;
    padding: 10px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    font-family: inherit;
    resize: vertical;
    min-height: 80px;
}

.self-assessment-textarea::placeholder {
    color: rgba(255, 255, 255, 0.6);
}

.self-assessment-textarea:focus {
    outline: none;
    border-color: white;
    background: rgba(255, 255, 255, 0.15);
}

.word-count-trigger {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.7);
    text-align: right;
    margin-top: 8px;
}
```

**File: `js/renderer.js`** - Add self-assessment rendering
```javascript
// Add after renderQuillEditorStructure function

function renderSelfAssessment(element, container, userUid, assignmentId, pageId) {
    const saDiv = document.createElement('div');
    saDiv.className = 'self-assessment-container';
    saDiv.id = `self-assessment-${element.id}`;
    
    let html = `
        <div class="self-assessment-header">
            <span>🤔</span>
            <span>Selbstreflexion</span>
        </div>
    `;
    
    element.prompts.forEach((prompt, idx) => {
        const promptId = `${element.id}_prompt${idx}`;
        
        html += `<div class="self-assessment-prompt">
            <div class="self-assessment-question">${prompt.question}</div>`;
        
        if (prompt.type === 'rating') {
            html += `<div class="rating-scale">`;
            for (let i = 1; i <= prompt.scale; i++) {
                const label = prompt.labels[i-1] || i;
                html += `
                    <div class="rating-option">
                        <input type="radio" id="${promptId}_${i}" name="${promptId}" value="${i}">
                        <label for="${promptId}_${i}">${i}<br><small>${label}</small></label>
                    </div>
                `;
            }
            html += `</div>`;
        } else if (prompt.type === 'text') {
            html += `
                <textarea 
                    class="self-assessment-textarea" 
                    data-prompt-id="${promptId}"
                    placeholder="${prompt.placeholder || 'Ihre Gedanken...'}"
                ></textarea>
            `;
        }
        
        html += `</div>`;
    });
    
    saDiv.innerHTML = html;
    container.appendChild(saDiv);
    
    // Setup auto-save for self-assessment responses
    saDiv.querySelectorAll('input[type="radio"], textarea').forEach(input => {
        input.addEventListener('change', () => saveSelfAssessment(userUid, assignmentId, pageId, element.id, saDiv));
        if (input.tagName === 'TEXTAREA') {
            input.addEventListener('input', debounce(() => {
                saveSelfAssessment(userUid, assignmentId, pageId, element.id, saDiv);
            }, 1000));
        }
    });
    
    // Load existing responses
    loadSelfAssessment(userUid, assignmentId, pageId, element.id, saDiv);
}

async function saveSelfAssessment(userUid, assignmentId, pageId, elementId, container) {
    const db = firebase.firestore();
    const responses = {};
    
    // Collect all responses
    container.querySelectorAll('input[type="radio"]:checked').forEach(input => {
        responses[input.name] = parseInt(input.value);
    });
    
    container.querySelectorAll('textarea').forEach(textarea => {
        responses[textarea.dataset.promptId] = textarea.value;
    });
    
    try {
        await db.collection('submissions').doc(userUid).set({
            [assignmentId]: {
                [pageId]: {
                    [`${elementId}_self_assessment`]: responses
                }
            }
        }, { merge: true });
        
        console.log('Self-assessment saved:', responses);
    } catch (error) {
        console.error('Error saving self-assessment:', error);
    }
}

async function loadSelfAssessment(userUid, assignmentId, pageId, elementId, container) {
    const db = firebase.firestore();
    const doc = await db.collection('submissions').doc(userUid).get();
    
    if (doc.exists) {
        const data = doc.data();
        const responses = data?.[assignmentId]?.[pageId]?.[`${elementId}_self_assessment`] || {};
        
        // Populate radio buttons
        Object.keys(responses).forEach(key => {
            const input = container.querySelector(`input[name="${key}"][value="${responses[key]}"]`);
            if (input) input.checked = true;
            
            const textarea = container.querySelector(`textarea[data-prompt-id="${key}"]`);
            if (textarea) textarea.value = responses[key];
        });
    }
}

// Modify renderPage to include self-assessment elements
export function renderPage(pageObject, container) {
    container.innerHTML = '';

    if (pageObject.helpText) {
        const details = document.createElement('details');
        details.innerHTML = `<summary>Weitere Informationen</summary>${pageObject.helpText}`;
        container.appendChild(details);
    }

    pageObject.elements.forEach(element => {
        if (element.type === 'text') {
            renderTextBlock(element, container);
        } else if (element.type === 'quill') {
            renderQuillEditorStructure(element, container);
        } else if (element.type === 'self-assessment') {
            // Self-assessment is rendered later after trigger conditions are met
            // We'll handle this in setupSelfAssessmentTriggers
        }
    });
}

// NEW: Setup triggers for self-assessment
export function setupSelfAssessmentTriggers(userUid, assignmentId, pageObject, container) {
    pageObject.elements.forEach(element => {
        if (element.type === 'self-assessment') {
            const triggerEditor = document.getElementById(`quill-editor-${element.triggerElement}`);
            
            if (triggerEditor && triggerEditor.__quill) {
                const checkTrigger = () => {
                    const text = triggerEditor.__quill.getText();
                    const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;
                    
                    const saContainer = document.getElementById(`self-assessment-${element.id}`);
                    
                    if (wordCount >= element.triggerAfterWords) {
                        if (!saContainer) {
                            // Render self-assessment if not already present
                            const wrapper = triggerEditor.closest('.quill-element') || container;
                            renderSelfAssessment(element, wrapper, userUid, assignmentId, pageObject.id);
                        } else {
                            saContainer.classList.add('visible');
                        }
                    }
                };
                
                // Check on text change
                triggerEditor.__quill.on('text-change', checkTrigger);
                
                // Check immediately in case content already exists
                setTimeout(checkTrigger, 500);
            }
        }
    });
}

async function syncPendingSubmissions() {
    // Get all clients (tabs/windows)
    const clients = await self.clients.matchAll();
    
    // Send message to all clients to trigger sync
    clients.forEach(client => {
        client.postMessage({
            type: 'SYNC_REQUEST',
            timestamp: Date.now()
        });
    });
    
    console.log('[SW] Sync request sent to all clients');
}
```

**File: `js/sync-manager.js`** - Add message listener
```javascript
// Add to setupListeners()
setupListeners() {
    // ... existing listeners ...
    
    // Listen for service worker sync requests
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data.type === 'SYNC_REQUEST') {
                console.log('[Sync] Received sync request from SW');
                this.syncAll();
            }
        });
    }
}
```

**Testing Checklist:**
- [ ] Install PWA via "Add to Home Screen"
- [ ] Turn off internet, verify offline page works
- [ ] Make changes offline, verify "Offline gespeichert" indicator
- [ ] Go back online, verify automatic sync with success message
- [ ] Check IndexedDB (Chrome DevTools → Application → IndexedDB) for queued items
- [ ] Close app completely, reopen, verify sync still works
- [ ] Test on mobile device for true PWA experience

---

### 2.2 Rich Analytics Dashboard

#### Overview
Create comprehensive data visualizations showing completion rates, time-on-task, engagement patterns, and answer quality metrics.

#### Technical Implementation

**Step 1: Enhanced Data Collection (Week 6, Days 2-5)**

**File: `js/analytics-tracker.js`** - NEW file
```javascript
// analytics-tracker.js - Collects granular usage data

export class AnalyticsTracker {
    constructor(userUid, assignmentId) {
        this.userUid = userUid;
        this.assignmentId = assignmentId;
        this.sessionStart = Date.now();
        this.currentPage = null;
        this.pageStartTime = null;
        this.editEvents = [];
        this.focusTime = 0;
        this.lastFocusTime = null;
        
        this.setupTracking();
    }
    
    setupTracking() {
        // Track focus/blur for actual engaged time
        window.addEventListener('focus', () => {
            this.lastFocusTime = Date.now();
        });
        
        window.addEventListener('blur', () => {
            if (this.lastFocusTime) {
                this.focusTime += Date.now() - this.lastFocusTime;
                this.lastFocusTime = null;
            }
        });
        
        // Track before unload
        window.addEventListener('beforeunload', () => {
            this.saveSession();
        });
        
        // Auto-save every 2 minutes
        setInterval(() => this.saveSession(), 120000);
    }
    
    startPage(pageId) {
        // Save previous page timing if exists
        if (this.currentPage && this.pageStartTime) {
            this.savePageTiming();
        }
        
        this.currentPage = pageId;
        this.pageStartTime = Date.now();
    }
    
    trackEdit(pageId, elementId, contentLength, editType = 'change') {
        this.editEvents.push({
            pageId: pageId,
            elementId: elementId,
            timestamp: Date.now(),
            contentLength: contentLength,
            editType: editType, // 'change', 'paste', 'delete'
            sessionTime: Date.now() - this.sessionStart
        });
    }
    
    async savePageTiming() {
        if (!this.currentPage || !this.pageStartTime) return;
        
        const timeSpent = Date.now() - this.pageStartTime;
        const db = firebase.firestore();
        
        try {
            await db.collection('analytics').doc(this.userUid).set({
                [this.assignmentId]: {
                    pageTiming: {
                        [this.currentPage]: firebase.firestore.FieldValue.increment(timeSpent)
                    }
                }
            }, { merge: true });
        } catch (error) {
            console.error('Failed to save page timing:', error);
        }
    }
    
    async saveSession() {
        const db = firebase.firestore();
        
        // Calculate metrics
        const totalTime = Date.now() - this.sessionStart;
        const engagedTime = this.focusTime + (this.lastFocusTime ? Date.now() - this.lastFocusTime : 0);
        const engagementRate = (engagedTime / totalTime) * 100;
        
        // Count edits by page
        const editsByPage = {};
        this.editEvents.forEach(event => {
            if (!editsByPage[event.pageId]) {
                editsByPage[event.pageId] = 0;
            }
            editsByPage[event.pageId]++;
        });
        
        try {
            await db.collection('analytics').doc(this.userUid).set({
                [this.assignmentId]: {
                    sessions: firebase.firestore.FieldValue.arrayUnion({
                        startTime: this.sessionStart,
                        totalTime: totalTime,
                        engagedTime: engagedTime,
                        engagementRate: engagementRate,
                        editCount: this.editEvents.length,
                        editsByPage: editsByPage
                    }),
                    lastActive: firebase.firestore.FieldValue.serverTimestamp()
                }
            }, { merge: true });
            
            console.log('[Analytics] Session saved:', {
                totalTime: Math.round(totalTime / 1000) + 's',
                engagementRate: Math.round(engagementRate) + '%'
            });
            
        } catch (error) {
            console.error('Failed to save session analytics:', error);
        }
    }
}
```

**File: `js/renderer.js`** - Integrate analytics tracking
```javascript
// Add import
import { AnalyticsTracker } from './analytics-tracker.js';

// Add to module scope
let analyticsTracker = null;

// Modify setupQuillListeners to track edits
export function setupQuillListeners(userUid, assignmentId, pageObject) {
    // Initialize tracker if not exists
    if (!analyticsTracker) {
        analyticsTracker = new AnalyticsTracker(userUid, assignmentId);
    }
    
    // Notify tracker of page start
    analyticsTracker.startPage(pageObject.id);
    
    pageObject.elements.forEach(element => {
        if (element.type === 'quill') {
            const editorDiv = document.getElementById(`quill-editor-${element.id}`);
            if (editorDiv && editorDiv.__quill) {
                editorDiv.__quill.on('text-change', (delta, oldDelta, source) => {
                    const content = editorDiv.__quill.root.innerHTML;
                    const textLength = editorDiv.__quill.getText().length;
                    
                    // Track the edit
                    analyticsTracker.trackEdit(
                        pageObject.id, 
                        element.id, 
                        textLength,
                        source === 'user' ? 'change' : 'paste'
                    );
                    
                    // Save to Firestore (existing code)
                    debouncedSave(userUid, assignmentId, pageObject.id, element.id, content);
                });
            }
        }
    });
}
```

**Step 2: Create Analytics Dashboard UI (Week 7, Days 1-3)**

**File: `dashboard/analytics.html`** - NEW file
```html
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Analytics Dashboard</title>
    <link rel="stylesheet" href="teacher.css">
    <style>
        .analytics-container {
            padding: 20px;
            max-width: 1400px;
            margin: 0 auto;
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .metric-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-left: 4px solid #007bff;
        }
        
        .metric-card h3 {
            margin: 0 0 10px 0;
            font-size: 0.9rem;
            color: #6c757d;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .metric-value {
            font-size: 2.5rem;
            font-weight: 700;
            color: #212529;
        }
        
        .metric-label {
            font-size: 0.85rem;
            color: #6c757d;
            margin-top: 5px;
        }
        
        .chart-container {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }
        
        .chart-container h2 {
            margin-top: 0;
            font-size: 1.2rem;
            color: #343a40;
        }
        
        .filters {
            background: white;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: flex;
            gap: 15px;
            align-items: center;
        }
        
        .filters select {
            padding: 8px 12px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            font-size: 0.9rem;
        }
        
        .export-btn {
            margin-left: auto;
            padding: 8px 16px;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
        }
    </style>
</head>
<body>
    <div class="header-bar">
        <h2>📊 Analytics Dashboard</h2>
        <div>
            <a href="teacher.html">← Zurück zum Monitor</a>
            <button id="logout-btn" class="small-btn">Logout</button>
        </div>
    </div>
    
    <div class="analytics-container">
        <div class="filters">
            <label>Klasse:</label>
            <select id="class-filter">
                <option value="">Alle Klassen</option>
            </select>
            
            <label>Aufgabe:</label>
            <select id="assignment-filter">
                <option value="">Alle Aufgaben</option>
            </select>
            
            <label>Zeitraum:</label>
            <select id="timeframe-filter">
                <option value="7">Letzte 7 Tage</option>
                <option value="30" selected>Letzte 30 Tage</option>
                <option value="90">Letzte 90 Tage</option>
                <option value="all">Alle Zeit</option>
            </select>
            
            <button id="export-btn" class="export-btn">📥 Export CSV</button>
        </div>
        
        <div class="metrics-grid">
            <div class="metric-card">
                <h3>Aktive Schüler</h3>
                <div class="metric-value" id="metric-active-students">-</div>
                <div class="metric-label">in gewähltem Zeitraum</div>
            </div>
            
            <div class="metric-card">
                <h3>Durchschn. Bearbeitungszeit</h3>
                <div class="metric-value" id="metric-avg-time">-</div>
                <div class="metric-label">pro Schüler</div>
            </div>
            
            <div class="metric-card">
                <h3>Abschlussrate</h3>
                <div class="metric-value" id="metric-completion-rate">-</div>
                <div class="metric-label">vollständig bearbeitet</div>
            </div>
            
            <div class="metric-card">
                <h3>Durchschn. Wortanzahl</h3>
                <div class="metric-value" id="metric-avg-words">-</div>
                <div class="metric-label">pro Antwort</div>
            </div>
        </div>
        
        <div class="chart-container">
            <h2>Aktivität über Zeit</h2>
            <canvas id="activity-chart" height="80"></canvas>
        </div>
        
        <div class="chart-container">
            <h2>Engagement-Rate pro Schüler</h2>
            <canvas id="engagement-chart" height="100"></canvas>
        </div>
        
        <div class="chart-container">
            <h2>Abschlussrate pro Seite</h2>
            <canvas id="completion-heatmap" height="80"></canvas>
        </div>
    </div>
    
    <script src="https://www.gstatic.com/firebasejs/9.15.0/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.15.0/firebase-auth-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore-compat.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <script src="analytics.js" type="module"></script>
</body>
</html>
```

**Step 3: Analytics Processing Logic (Week 7, Days 4-5 + Week 8, Days 1-2)**

**File: `dashboard/analytics.js`** - NEW file
```javascript
import { firebaseConfig } from '../js/firebase-config.js';

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let state = {
    user: null,
    classes: [],
    users: [],
    analytics: {},
    submissions: {},
    filters: {
        classId: '',
        assignmentId: '',
        timeframe: 30
    }
};

let charts = {};

// Auth check
auth.onAuthStateChanged(async (user) => {
    if (user) {
        const token = await user.getIdTokenResult();
        if (token.claims.isTeacher) {
            state.user = user;
            initDashboard();
        } else {
            window.location.href = 'teacher.html';
        }
    } else {
        window.location.href = 'teacher.html';
    }
});

document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());

async function initDashboard() {
    // Fetch all necessary data
    const classSnap = await db.collection('classes')
        .where('teacherId', '==', state.user.uid)
        .get();
    state.classes = classSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const userSnap = await db.collection('users').get();
    state.users = userSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const analyticsSnap = await db.collection('analytics').get();
    analyticsSnap.forEach(doc => {
        state.analytics[doc.id] = doc.data();
    });
    
    const submissionsSnap = await db.collection('submissions').get();
    submissionsSnap.forEach(doc => {
        state.submissions[doc.id] = doc.data();
    });
    
    // Populate filters
    populateFilters();
    setupFilterListeners();
    
    // Render initial data
    renderDashboard();
}

function populateFilters() {
    const classFilter = document.getElementById('class-filter');
    state.classes.forEach(cls => {
        const option = document.createElement('option');
        option.value = cls.id;
        option.textContent = cls.className;
        classFilter.appendChild(option);
    });
    
    // Get unique assignment IDs
    const assignments = new Set();
    Object.values(state.submissions).forEach(sub => {
        Object.keys(sub).forEach(aid => assignments.add(aid));
    });
    
    const assignmentFilter = document.getElementById('assignment-filter');
    Array.from(assignments).sort().forEach(aid => {
        const option = document.createElement('option');
        option.value = aid;
        option.textContent = aid;
        assignmentFilter.appendChild(option);
    });
}

function setupFilterListeners() {
    document.getElementById('class-filter').addEventListener('change', (e) => {
        state.filters.classId = e.target.value;
        renderDashboard();
    });
    
    document.getElementById('assignment-filter').addEventListener('change', (e) => {
        state.filters.assignmentId = e.target.value;
        renderDashboard();
    });
    
    document.getElementById('timeframe-filter').addEventListener('change', (e) => {
        state.filters.timeframe = e.target.value === 'all' ? Infinity : parseInt(e.target.value);
        renderDashboard();
    });
    
    document.getElementById('export-btn').addEventListener('click', exportToCSV);
}

function getFilteredData() {
    const now = Date.now();
    const timeframeCutoff = state.filters.timeframe === Infinity ? 
        0 : now - (state.filters.timeframe * 24 * 60 * 60 * 1000);
    
    // Filter students by class
    let students = state.users.filter(u => u.role !== 'teacher');
    if (state.filters.classId) {
        students = students.filter(u => u.classId === state.filters.classId);
    }
    
    // Collect data for filtered students
    const data = {
        students: [],
        totalSessions: 0,
        totalTime: 0,
        totalEngagedTime: 0,
        totalWords: 0,
        wordCount: 0,
        completionByPage: {}
    };
    
    students.forEach(student => {
        const studentAnalytics = state.analytics[student.id] || {};
        const studentSubmissions = state.submissions[student.id] || {};
        
        let studentData = {
            id: student.id,
            name: student.displayName,
            sessions: [],
            submissions: {},
            totalTime: 0,
            engagedTime: 0,
            engagementRate: 0
        };
        
        // Process each assignment
        Object.keys(studentAnalytics).forEach(assignmentId => {
            if (state.filters.assignmentId && assignmentId !== state.filters.assignmentId) {
                return;
            }
            
            const assignmentData = studentAnalytics[assignmentId];
            
            // Filter sessions by timeframe
            if (assignmentData.sessions) {
                const filteredSessions = assignmentData.sessions.filter(s => 
                    s.startTime >= timeframeCutoff
                );
                
                studentData.sessions.push(...filteredSessions);
                
                filteredSessions.forEach(session => {
                    studentData.totalTime += session.totalTime;
                    studentData.engagedTime += session.engagedTime;
                    data.totalTime += session.totalTime;
                    data.totalEngagedTime += session.engagedTime;
                    data.totalSessions++;
                });
            }
            
            // Process submissions
            if (studentSubmissions[assignmentId]) {
                studentData.submissions[assignmentId] = studentSubmissions[assignmentId];
                
                // Count words and completion
                Object.keys(studentSubmissions[assignmentId]).forEach(pageId => {
                    const page = studentSubmissions[assignmentId][pageId];
                    
                    if (!data.completionByPage[pageId]) {
                        data.completionByPage[pageId] = { completed: 0, total: 0 };
                    }
                    data.completionByPage[pageId].total++;
                    
                    let pageHasContent = false;
                    Object.values(page).forEach(answer => {
                        if (typeof answer === 'string') {
                            const text = answer.replace(/<[^>]*>/g, '').trim();
                            const words = text.split(/\s+/).filter(w => w.length > 0).length;
                            if (words > 0) {
                                data.totalWords += words;
                                data.wordCount++;
                                pageHasContent = true;
                            }
                        }
                    });
                    
                    if (pageHasContent) {
                        data.completionByPage[pageId].completed++;
                    }
                });
            }
        });
        
        if (studentData.totalTime > 0) {
            studentData.engagementRate = (studentData.engagedTime / studentData.totalTime) * 100;
            data.students.push(studentData);
        }
    });
    
    return data;
}

function renderDashboard() {
    const data = getFilteredData();
    
    // Update metric cards
    document.getElementById('metric-active-students').textContent = data.students.length;
    
    const avgTimeMinutes = data.students.length > 0 ? 
        Math.round((data.totalTime / data.students.length) / 60000) : 0;
    document.getElementById('metric-avg-time').textContent = avgTimeMinutes + 'm';
    
    const completionRates = Object.values(data.completionByPage);
    const avgCompletion = completionRates.length > 0 ?
        Math.round((completionRates.reduce((sum, p) => sum + (p.completed / p.total), 0) / completionRates.length) * 100) : 0;
    document.getElementById('metric-completion-rate').textContent = avgCompletion + '%';
    
    const avgWords = data.wordCount > 0 ? Math.round(data.totalWords / data.wordCount) : 0;
    document.getElementById('metric-avg-words').textContent = avgWords;
    
    // Render charts
    renderActivityChart(data);
    renderEngagementChart(data);
    renderCompletionHeatmap(data);
}

function renderActivityChart(data) {
    const ctx = document.getElementById('activity-chart').getContext('2d');
    
    // Group sessions by day
    const dayData = {};
    data.students.forEach(student => {
        student.sessions.forEach(session => {
            const date = new Date(session.startTime).toLocaleDateString('de-DE');
            if (!dayData[date]) dayData[date] = 0;
            dayData[date]++;
        });
    });
    
    const sortedDates = Object.keys(dayData).sort((a, b) => {
        return new Date(a.split('.').reverse().join('-')) - new Date(b.split('.').reverse().join('-'));
    });
    
    if (charts.activity) charts.activity.destroy();
    
    charts.activity = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [{
                label: 'Aktive Sessions',
                data: sortedDates.map(date => dayData[date]),
                borderColor: '#007bff',
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
    });
}

function renderEngagementChart(data) {
    const ctx = document.getElementById('engagement-chart').getContext('2d');
    
    const sortedStudents = data.students.sort((a, b) => b.engagementRate - a.engagementRate);
    
    if (charts.engagement) charts.engagement.destroy();
    
    charts.engagement = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedStudents.map(s => s.name),
            datasets: [{
                label: 'Engagement-Rate (%)',
                data: sortedStudents.map(s => Math.round(s.engagementRate)),
                backgroundColor: sortedStudents.map(s => {
                    if (s.engagementRate >= 70) return '#28a745';
                    if (s.engagementRate >= 40) return '#ffc107';
                    return '#dc3545';
                })
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y',
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { beginAtZero: true, max: 100 }
            }
        }
    });
}

function renderCompletionHeatmap(data) {
    const ctx = document.getElementById('completion-heatmap').getContext('2d');
    
    const pages = Object.keys(data.completionByPage).sort();
    const completionRates = pages.map(pageId => {
        const page = data.completionByPage[pageId];
        return Math.round((page.completed / page.total) * 100);
    });
    
    if (charts.completion) charts.completion.destroy();
    
    charts.completion = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: pages,
            datasets: [{
                label: 'Abschlussrate (%)',
                data: completionRates,
                backgroundColor: '#007bff'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, max: 100 }
            }
        }
    });
}

function exportToCSV() {
    const data = getFilteredData();
    
    let csv = 'Name,Gesamtzeit (Min),Engagement-Rate (%),Sessions,Durchschn. Wortanzahl\n';
    
    data.students.forEach(student => {
        const totalWords = Object.values(student.submissions).reduce((sum, assignment) => {
            return sum + Object.values(assignment).reduce((pageSum, page) => {
                return pageSum + Object.values(page).filter(v => typeof v === 'string').reduce((answerSum, answer) => {
                    const text = answer.replace(/<[^>]*>/g, '').trim();
                    return answerSum + text.split(/\s+/).filter(w => w.length > 0).length;
                }, 0);
            }, 0);
        }, 0);
        
        const avgWords = student.sessions.length > 0 ? Math.round(totalWords / student.sessions.length) : 0;
        
        csv += `"${student.name}",${Math.round(student.totalTime / 60000)},${Math.round(student.engagementRate)},${student.sessions.length},${avgWords}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `analytics_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}
```

**Step 4: Link Analytics from Teacher Dashboard (Week 8, Day 3)**

**File: `dashboard/teacher.html`** - Add analytics link
```html
<div class="pane-header">
    <h3>Live Monitor</h3>
    <div style="display:flex; gap:5px;">
        <a href="analytics.html" class="small-btn" style="text-decoration:none; background:#17a2b8; color:white; display:inline-block; text-align:center;">📊 Analytics</a>
        <a href="admin.html" class="small-btn" style="text-decoration:none; background:#6c757d; color:white; display:inline-block; text-align:center;">Verwaltung</a>
        <button id="logout-btn" class="small-btn">Logout</button>
    </div>
</div>
```

**Testing Checklist:**
- [ ] Analytics tracker starts when student opens assignment
- [ ] Focus/blur events properly calculate engaged time
- [ ] Edit events are captured with correct metadata
- [ ] Analytics dashboard loads all historical data
- [ ] Filters update charts correctly
- [ ] CSV export contains accurate data
- [ ] Charts render properly on different screen sizes
- [ ] Data updates when new sessions are recorded

---

## Implementation Timeline Summary

| Week | Phase | Tasks | Deliverables |
|------|-------|-------|--------------|
| 1 | Quick Wins | Presence tracking, teacher UI | Green/yellow/gray dots in dashboard |
| 2 | Quick Wins | Feedback system | Teachers can comment, students see feedback |
| 3 | Quick Wins | Self-assessment | Reflection prompts appear after word count |
| 4 | PWA | Manifest, service worker, offline page | App installable, works offline |
| 5 | PWA | Offline queue, background sync | Changes sync automatically when online |
| 6 | PWA + Analytics | Complete PWA, start analytics | Full offline capability, data collection begins |
| 7 | Analytics | Dashboard UI, charts | Visual analytics dashboard |
| 8 | Analytics | Complete analytics, testing | Full analytics system with export |

## Deployment Checklist

### Pre-Launch
- [ ] Test all features in development environment
- [ ] Run Lighthouse audit for PWA (score >90)
- [ ] Test on multiple devices (iOS, Android, Desktop)
- [ ] Verify Firestore security rules are production-ready
- [ ] Create backup of existing data
- [ ] Document any breaking changes

### Launch
- [ ] Deploy updated files to hosting
- [ ] Monitor error logs for first 24 hours
- [ ] Gather initial user feedback
- [ ] Create user guide/tutorial for new features

### Post-Launch
- [ ] Schedule regular data exports
- [ ] Monitor analytics collection for anomalies
- [ ] Plan iteration based on usage patterns
- [ ] Consider additional features from pedagogical list

## Maintenance & Monitoring

**Weekly:**
- Check Firestore usage and costs
- Review error logs
- Monitor service worker cache size

**Monthly:**
- Analyze engagement metrics
- Collect teacher feedback
- Plan feature iterations

**Quarterly:**
- Review and optimize security rules
- Update dependencies
- Performance audit

## Support Resources

- Firebase Console: https://console.firebase.google.com
- Chart.js Docs: https://www.chart# LMS Box v3.0 - Detailed Implementation Plan

## Phase 1: Quick Wins (2-3 weeks)

### 1.1 Real-time Collaboration Indicators

#### Overview
Add visual indicators showing which students are actively working, recently active, or idle. This gives teachers situational awareness for timely interventions.

#### Technical Implementation

**Step 1: Add Presence Tracking (Week 1, Days 1-2)**

**File: `js/renderer.js`** - Add heartbeat function
```javascript
// Add after imports
let presenceInterval = null;

export function startPresenceTracking(userUid, assignmentId, pageId) {
    stopPresenceTracking(); // Clean up any existing interval
    
    const db = firebase.firestore();
    const updatePresence = async () => {
        try {
            await db.collection('presence').doc(userUid).set({
                assignmentId: assignmentId,
                pageId: pageId,
                lastActive: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'active'
            }, { merge: true });
        } catch (error) {
            console.error("Presence update failed:", error);
        }
    };
    
    // Update immediately
    updatePresence();
    
    // Then every 5 seconds
    presenceInterval = setInterval(updatePresence, 5000);
}

export function stopPresenceTracking() {
    if (presenceInterval) {
        clearInterval(presenceInterval);
        presenceInterval = null;
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', stopPresenceTracking);
```

**File: `js/app.js`** - Integrate presence tracking
```javascript
// Import the new functions
import { renderPage, loadAndRenderAnswers, setupQuillListeners, startPresenceTracking, stopPresenceTracking } from './renderer.js';

// Modify navigateToStep function
async function navigateToStep(index) {
    if (!state.assignmentData || index < 0 || index >= state.assignmentData.pages.length) return;
    
    // Stop tracking previous page
    stopPresenceTracking();
    
    state.currentStepIndex = index;
    const currentPageData = state.assignmentData.pages[index];
    
    renderPage(currentPageData, stepperContentEl);
    await loadAndRenderAnswers(state.firebaseUser.uid, state.assignmentId, currentPageData);
    setupQuillListeners(state.firebaseUser.uid, state.assignmentId, currentPageData);
    
    // Start tracking new page
    startPresenceTracking(state.firebaseUser.uid, state.assignmentId, currentPageData.id);
    
    updateSidebarActiveState();
    updateNavigationButtons();
}
```

**Step 2: Display Presence in Teacher Dashboard (Week 1, Days 3-4)**

**File: `dashboard/teacher.css`** - Add status indicators
```css
/* Add to end of file */
.presence-indicator {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    margin-right: 8px;
    border: 2px solid white;
    box-shadow: 0 0 3px rgba(0,0,0,0.3);
}

.presence-active {
    background-color: #28a745; /* Green */
    animation: pulse 2s infinite;
}

.presence-recent {
    background-color: #ffc107; /* Yellow */
}

.presence-idle {
    background-color: #6c757d; /* Gray */
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

.student-card .meta-info {
    font-size: 0.75rem;
    color: #6c757d;
    margin-top: 4px;
}
```

**File: `dashboard/teacher.js`** - Add presence listener
```javascript
// Add to state object
let state = {
    // ... existing properties
    presenceData: {} // NEW
};

// Add new function after initDashboard()
function initPresenceListener() {
    db.collection('presence').onSnapshot(snap => {
        state.presenceData = {};
        snap.forEach(doc => {
            state.presenceData[doc.id] = doc.data();
        });
        // Refresh student list if we're viewing one
        if (state.selectedClassId && state.selectedAssignmentId) {
            renderStudentList();
        }
    });
}

// Call it in initDashboard()
function initDashboard() {
    // ... existing listeners
    initPresenceListener(); // ADD THIS
}

// Modify renderStudentList() to include presence
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
        
        // NEW: Check presence
        let presenceIndicator = '<span class="presence-indicator presence-idle"></span>';
        let presenceText = '';
        
        const presence = state.presenceData[student.id];
        if (presence && presence.lastActive) {
            const lastActive = presence.lastActive.toDate();
            const secondsAgo = (now - lastActive) / 1000;
            
            if (secondsAgo < 30) {
                presenceIndicator = '<span class="presence-indicator presence-active"></span>';
                presenceText = '<span class="meta-info">🟢 Gerade aktiv</span>';
            } else if (secondsAgo < 300) { // 5 minutes
                presenceIndicator = '<span class="presence-indicator presence-recent"></span>';
                const minAgo = Math.floor(secondsAgo / 60);
                presenceText = `<span class="meta-info">🟡 Vor ${minAgo} Min.</span>`;
            } else {
                presenceText = '<span class="meta-info">⚫ Inaktiv</span>';
            }
        }
        
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
                <span class="status ${statusClass}">${statusText}</span>
                ${presenceText}
            </div>
        `;
        
        card.addEventListener('click', () => {
            state.selectedStudentId = student.id;
            renderStudentList();
            renderDetailView();
        });
        els.studentListContent.appendChild(card);
    });
}
```

**Step 3: Firestore Security Rules (Week 1, Day 5)**

Add to Firebase Console → Firestore → Rules:
```javascript
match /presence/{userId} {
  // Users can write their own presence
  allow write: if request.auth != null && request.auth.uid == userId;
  // Teachers can read all presence
  allow read: if request.auth.token.isTeacher == true;
}
```

**Testing Checklist:**
- [ ] Open student view, verify presence document created in Firestore
- [ ] Switch pages, verify `pageId` updates
- [ ] Close tab, verify presence stops updating
- [ ] Open teacher dashboard, verify green dot appears for active student
- [ ] Wait 1 minute, verify dot turns yellow
- [ ] Wait 5+ minutes, verify dot turns gray

---

### 1.2 Immediate Feedback System

#### Overview
Allow teachers to add inline comments and quick feedback stamps to student work while monitoring live.

#### Technical Implementation

**Step 1: Database Schema Design (Week 2, Day 1)**

**Firestore Structure:**
```
/feedback
  /{studentId}
    /{assignmentId}
      /{pageId}
        /{elementId}: [
          {
            text: "Great analysis!",
            type: "positive" | "warning" | "question",
            timestamp: Timestamp,
            teacherId: "abc123",
            teacherName: "Herr Schmidt"
          }
        ]
```

**Step 2: Teacher UI for Adding Feedback (Week 2, Days 2-3)**

**File: `dashboard/teacher.css`** - Add feedback styles
```css
/* Add to end of file */
.feedback-toolbar {
    position: sticky;
    top: 0;
    background: white;
    border-bottom: 2px solid #e9ecef;
    padding: 10px;
    display: flex;
    gap: 10px;
    z-index: 100;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.feedback-mode-toggle {
    padding: 8px 16px;
    border: 2px solid #007bff;
    background: white;
    color: #007bff;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
}

.feedback-mode-toggle.active {
    background: #007bff;
    color: white;
}

.feedback-mode-toggle:hover {
    background: #e7f1ff;
}

.qa-pair {
    position: relative;
    border: 2px solid transparent;
    transition: border-color 0.2s;
}

.qa-pair.feedback-enabled:hover {
    border-color: #007bff;
    border-radius: 4px;
    cursor: pointer;
}

.feedback-list {
    margin-top: 10px;
    padding-left: 20px;
}

.feedback-item {
    display: flex;
    align-items: start;
    gap: 10px;
    padding: 8px;
    margin-bottom: 8px;
    border-radius: 4px;
    font-size: 0.9rem;
}

.feedback-item.positive {
    background: #d4edda;
    border-left: 4px solid #28a745;
}

.feedback-item.warning {
    background: #fff3cd;
    border-left: 4px solid #ffc107;
}

.feedback-item.question {
    background: #d1ecf1;
    border-left: 4px solid #17a2b8;
}

.feedback-item .icon {
    font-size: 1.2rem;
}

.feedback-item .content {
    flex: 1;
}

.feedback-item .meta {
    font-size: 0.75rem;
    color: #6c757d;
    margin-top: 4px;
}

.feedback-form {
    margin-top: 10px;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 4px;
    display: none;
}

.feedback-form.visible {
    display: block;
}

.feedback-form textarea {
    width: 100%;
    padding: 8px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    resize: vertical;
    min-height: 60px;
    font-family: inherit;
}

.feedback-form .button-group {
    display: flex;
    gap: 8px;
    margin-top: 10px;
}

.feedback-form button {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
}

.feedback-form .btn-positive {
    background: #28a745;
    color: white;
}

.feedback-form .btn-warning {
    background: #ffc107;
    color: #212529;
}

.feedback-form .btn-question {
    background: #17a2b8;
    color: white;
}

.feedback-form .btn-cancel {
    background: #6c757d;
    color: white;
}
```

**File: `dashboard/teacher.js`** - Add feedback functionality
```javascript
// Add to state
let state = {
    // ... existing
    feedbackMode: false,
    feedbackData: {}
};

// Add feedback listener to initDashboard()
function initDashboard() {
    // ... existing listeners
    
    // Listen to feedback
    db.collection('feedback').onSnapshot(snap => {
        state.feedbackData = {};
        snap.forEach(doc => {
            state.feedbackData[doc.id] = doc.data();
        });
        if (state.selectedStudentId && state.selectedAssignmentId) {
            renderDetailView();
        }
    });
}

// Modify renderDetailView() to include feedback
function renderDetailView() {
    if (!state.selectedStudentId || !state.selectedAssignmentId) return;

    const student = state.users.find(u => u.id === state.selectedStudentId);
    const submission = state.submissions[state.selectedStudentId]?.[state.selectedAssignmentId] || {};
    const definition = state.assignmentDefinitions[state.selectedAssignmentId];
    const studentFeedback = state.feedbackData[state.selectedStudentId]?.[state.selectedAssignmentId] || {};

    els.detailTitle.textContent = `${student.displayName} - ${state.selectedAssignmentId}`;
    els.detailContent.innerHTML = '';
    
    // Add feedback toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'feedback-toolbar';
    toolbar.innerHTML = `
        <button id="feedback-toggle" class="feedback-mode-toggle">
            📝 Feedback-Modus
        </button>
        <span style="color:#6c757d; font-size:0.9rem;">
            Klicken Sie auf Antworten, um Feedback zu geben
        </span>
    `;
    els.detailContent.appendChild(toolbar);
    
    // Toggle feedback mode
    toolbar.querySelector('#feedback-toggle').addEventListener('click', (e) => {
        state.feedbackMode = !state.feedbackMode;
        e.target.classList.toggle('active', state.feedbackMode);
        document.querySelectorAll('.qa-pair').forEach(qa => {
            qa.classList.toggle('feedback-enabled', state.feedbackMode);
        });
    });

    if (definition) {
        definition.pages.forEach(page => {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'assignment-page';
            pageDiv.innerHTML = `<h2>${page.title}</h2>`;
            
            const pageAnswers = submission[page.id] || {};
            const pageFeedback = studentFeedback[page.id] || {};
            
            page.elements.forEach(el => {
                if (el.type === 'quill') {
                    const answer = pageAnswers[el.id] || '<span style="color:#ccc;">Keine Antwort</span>';
                    const feedbackList = pageFeedback[el.id] || [];
                    
                    const qaDiv = document.createElement('div');
                    qaDiv.className = 'qa-pair';
                    qaDiv.dataset.pageId = page.id;
                    qaDiv.dataset.elementId = el.id;
                    
                    qaDiv.innerHTML = `
                        <div class="question">${el.question}</div>
                        <div class="answer">${answer}</div>
                    `;
                    
                    // Add existing feedback
                    if (feedbackList.length > 0) {
                        const fbDiv = document.createElement('div');
                        fbDiv.className = 'feedback-list';
                        feedbackList.forEach(fb => {
                            const icons = {positive: '✅', warning: '⚠️', question: '❓'};
                            fbDiv.innerHTML += `
                                <div class="feedback-item ${fb.type}">
                                    <span class="icon">${icons[fb.type]}</span>
                                    <div class="content">
                                        ${fb.text}
                                        <div class="meta">${fb.teacherName} • ${fb.timestamp.toDate().toLocaleString('de-DE')}</div>
                                    </div>
                                </div>
                            `;
                        });
                        qaDiv.appendChild(fbDiv);
                    }
                    
                    // Add feedback form (initially hidden)
                    const formDiv = document.createElement('div');
                    formDiv.className = 'feedback-form';
                    formDiv.innerHTML = `
                        <textarea placeholder="Ihr Feedback..."></textarea>
                        <div class="button-group">
                            <button class="btn-positive" data-type="positive">✅ Gut</button>
                            <button class="btn-warning" data-type="warning">⚠️ Überarbeiten</button>
                            <button class="btn-question" data-type="question">❓ Frage</button>
                            <button class="btn-cancel">Abbrechen</button>
                        </div>
                    `;
                    qaDiv.appendChild(formDiv);
                    
                    // Click handler for feedback mode
                    qaDiv.addEventListener('click', (e) => {
                        if (state.feedbackMode && !e.target.closest('.feedback-form')) {
                            // Close other forms
                            document.querySelectorAll('.feedback-form').forEach(f => f.classList.remove('visible'));
                            formDiv.classList.add('visible');
                            formDiv.querySelector('textarea').focus();
                        }
                    });
                    
                    // Feedback submission
                    formDiv.querySelectorAll('button[data-type]').forEach(btn => {
                        btn.addEventListener('click', () => submitFeedback(
                            state.selectedStudentId,
                            state.selectedAssignmentId,
                            page.id,
                            el.id,
                            formDiv.querySelector('textarea').value,
                            btn.dataset.type
                        ));
                    });
                    
                    formDiv.querySelector('.btn-cancel').addEventListener('click', () => {
                        formDiv.classList.remove('visible');
                        formDiv.querySelector('textarea').value = '';
                    });
                    
                    pageDiv.appendChild(qaDiv);
                }
            });
            els.detailContent.appendChild(pageDiv);
        });
    }
}

// Add new function
async function submitFeedback(studentId, assignmentId, pageId, elementId, text, type) {
    if (!text.trim()) {
        alert("Bitte geben Sie einen Feedback-Text ein.");
        return;
    }
    
    try {
        const feedbackItem = {
            text: text.trim(),
            type: type,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            teacherId: state.user.uid,
            teacherName: state.user.displayName || state.user.email
        };
        
        await db.collection('feedback').doc(studentId).set({
            [assignmentId]: {
                [pageId]: {
                    [elementId]: firebase.firestore.FieldValue.arrayUnion(feedbackItem)
                }
            }
        }, { merge: true });
        
        // Close form
        document.querySelectorAll('.feedback-form').forEach(f => {
            f.classList.remove('visible');
            f.querySelector('textarea').value = '';
        });
        
    } catch (error) {
        console.error("Feedback submission failed:", error);
        alert("Fehler beim Speichern des Feedbacks.");
    }
}
```

**Step 3: Student View for Feedback (Week 2, Days 4-5)**

**File: `js/renderer.js`** - Add feedback display
```javascript
// Add after renderQuillEditorStructure function
export function renderFeedbackNotifications(userUid, assignmentId, pageId, elementId, container) {
    const db = firebase.firestore();
    
    db.collection('feedback').doc(userUid).onSnapshot(doc => {
        if (!doc.exists) return;
        
        const data = doc.data();
        const feedbackList = data?.[assignmentId]?.[pageId]?.[elementId] || [];
        
        // Remove old feedback display
        const oldFeedback = container.querySelector('.student-feedback-list');
        if (oldFeedback) oldFeedback.remove();
        
        if (feedbackList.length > 0) {
            const feedbackDiv = document.createElement('div');
            feedbackDiv.className = 'student-feedback-list';
            feedbackDiv.style.cssText = `
                margin-top: 10px;
                padding: 12px;
                background: #fff3cd;
                border-left: 4px solid #ffc107;
                border-radius: 4px;
            `;
            
            feedbackDiv.innerHTML = '<strong>💬 Feedback von Ihrem Lehrer:</strong>';
            
            feedbackList.forEach(fb => {
                const icons = {positive: '✅', warning: '⚠️', question: '❓'};
                feedbackDiv.innerHTML += `
                    <div style="margin-top:8px; padding:8px; background:white; border-radius:4px;">
                        ${icons[fb.type]} ${fb.text}
                    </div>
                `;
            });
            
            container.appendChild(feedbackDiv);
        }
    });
}
```

**File: `js/app.js`** - Integrate feedback display
```javascript
// Import updated function
import { renderPage, loadAndRenderAnswers, setupQuillListeners, startPresenceTracking, stopPresenceTracking, renderFeedbackNotifications } from './renderer.js';

async function navigateToStep(index) {
    // ... existing code ...
    
    await loadAndRenderAnswers(state.firebaseUser.uid, state.assignmentId, currentPageData);
    setupQuillListeners(state.firebaseUser.uid, state.assignmentId, currentPageData);
    
    // NEW: Setup feedback listeners for each element
    currentPageData.elements.forEach(element => {
        if (element.type === 'quill') {
            const editorDiv = document.getElementById(`quill-editor-${element.id}`);
            if (editorDiv) {
                const wrapper = editorDiv.closest('.quill-element');
                renderFeedbackNotifications(
                    state.firebaseUser.uid,
                    state.assignmentId,
                    currentPageData.id,
                    element.id,
                    wrapper
                );
            }
        }
    });
    
    // ... rest of code ...
}
```

**Step 4: Firestore Security Rules (Week 2, Day 5)**

```javascript
match /feedback/{studentId} {
  // Students can read their own feedback
  allow read: if request.auth != null && request.auth.uid == studentId;
  // Teachers can write feedback
  allow write: if request.auth.token.isTeacher == true;
}
```

**Testing Checklist:**
- [ ] Teacher can toggle feedback mode
- [ ] Clicking answer shows feedback form
- [ ] Submitting feedback saves to Firestore
- [ ] Student view shows yellow notification box with feedback
- [ ] Multiple feedback items display correctly
- [ ] Feedback persists across page reloads

---

### 1.3 Self-Assessment Prompts

#### Overview
Add reflection prompts that appear after students complete sections, encouraging metacognition.

#### Technical Implementation

**Step 1: Update Assignment JSON Schema (Week 3, Day 1)**

**File: `assignments/assignment1.json`** - Add reflection elements
```json
{
  "assignmentId": "komplexe-ausbildungsaufgabe-v2",
  "assignmentTitle": "blabla Ausbildungsaufgabe",
  "pages": [
    {
      "id": "aufgabe-und-ziele",
      "title": "Aufgabe und Ziele",
      "elements": [
        {
          "type": "text",
          "content": "<h2>Aufgabenbeschreibung</h2>..."
        },
        {
          "type": "quill",
          "id": "q1_beschreibung",
          "question": "Beschreiben Sie..."
        },
        {
          "type": "self-assessment",
          "id": "sa1_confidence",
          "triggerAfterWords": 50,
          "triggerElement": "q1_beschreibung",
          "prompts": [
            {
              "type": "rating",
              "question": "Wie sicher fühlen Sie sich mit Ihrer Antwort?",
              "scale": 5,
              "labels": ["Sehr unsicher", "Unsicher", "Neutral", "Sicher", "Sehr sicher"]
            },
            {
              "type": "text",
              "question": "Was war am schwierigsten bei dieser Aufgabe?",
              "placeholder": "Beschreiben Sie die größte Herausforderung..."
            },
            {
              "type": "text",
              "question": "Wenn Sie 10 Minuten mehr Zeit hätten, was würden Sie verbessern?",
              "placeholder": "Ihre Ideen zur Verbesserung..."
            }
          ]
        }
      ]
    }
  ]
}
```

**Step 2: Render Self-Assessment Component (Week 3, Days 2-3)**

**File: `css/styles.css`** - Add self-assessment styles
```css
/* Add to end of file */
.self-assessment-container {
    margin-top: 20px;
    padding: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 8px;
    color: white;
    display: none;
    animation: slideIn 0.4s ease-out;
}

.self-assessment-container.visible {
    display: block;
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.self-assessment-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 15px;
    font-size: 1.1rem;
    font-weight: 600;
}

.self-assessment-prompt {
    background: rgba(255, 255, 255, 0.15);
    padding: 15px;
    border-radius: 6px;
    margin-bottom: 15px;
    backdrop-filter: blur(10px);
}

.self-assessment-prompt:last-child {
    margin-bottom: 0;
}

.self-assessment-question {
    font-weight: 500;
    margin-bottom: 12px;
}

.rating-scale {
    display: flex;
    justify-content: space-between;
    gap: 8px;
}

.rating-option {
    flex: 1;
    text-align: center;
}

.rating-option input[type="radio"] {
    display: none;
}

.rating-option label {
    display: block;
    padding: 12px 8px;
    background: rgba(255, 255, 255, 0.2);
    border: 2px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.85rem;
}

.rating-option input[type="radio"]:checked + label {
    background: white;
    color: #667eea;
    border-color: white;
    font-weight: 600;
}

.rating-option label:hover {
    background: rgba(255, 255, 255, 0.3);
}

.self-assessment-textarea {
    width: 100%;
    padding: 10px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    font-family: inherit;
    resize: vertical;
    min-height: 80px;
}

.self-assessment-textarea::placeholder {
    color: rgba(255, 255, 255, 0.6);
}

.self-assessment-textarea:focus {
    outline: none;
    border-color: white;
    background: rgba(255, 255, 255, 0.15);
}

.word-count-trigger {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.7);
    text-align: right;
    margin-top: 8px;
}
```

**File: `js/renderer.js`** - Add self-assessment rendering
```javascript
// Add after renderQuillEditorStructure function

function renderSelfAssessment(element, container, userUid, assignmentId, pageId) {
    const saDiv = document.createElement('div');
    saDiv.className = 'self-assessment-container';
    saDiv.id = `self-assessment-${element.id}`;
    
    let html = `
        <div class="self-assessment-header">
            <span>🤔</span>
            <span>Selbstreflexion</span>
        </div>
    `;
    
    element.prompts.forEach((prompt, idx) => {
        const promptId = `${element.id}_prompt${idx}`;
        
        html += `<div class="self-assessment-prompt">
            <div class="self-assessment-question">${prompt.question}</div>`;
        
        if (prompt.type === 'rating') {
            html += `<div class="rating-scale">`;
            for (let i = 1; i <= prompt.scale; i++) {
                const label = prompt.labels[i-1] || i;
                html += `
                    <div class="rating-option">
                        <input type="radio" id="${promptId}_${i}" name="${promptId}" value="${i}">
                        <label for="${promptId}_${i}">${i}<br><small>${label}</small></label>
                    </div>
                `;
            }
            html += `</div>`;
        } else if (prompt.type === 'text') {
            html += `
                <textarea 
                    class="self-assessment-textarea" 
                    data-prompt-id="${promptId}"
                    placeholder="${prompt.placeholder || 'Ihre Gedanken...'}"
                ></textarea>
            `;
        }
        
        html += `</div>`;
    });
    
    saDiv.innerHTML = html;
    container.appendChild(saDiv);
    
    // Setup auto-save for self-assessment responses
    saDiv.querySelectorAll('input[type="radio"], textarea').forEach(input => {
        input.addEventListener('change', () => saveSelfAssessment(userUid, assignmentId, pageId, element.id, saDiv));
        if (input.tagName === 'TEXTAREA') {
            input.addEventListener('input', debounce(() => {
                saveSelfAssessment(userUid, assignmentId, pageId, element.id, saDiv);
            }, 1000));
        }
    });
    
    // Load existing responses
    loadSelfAssessment(userUid, assignmentId, pageId, element.id, saDiv);
}

async function saveSelfAssessment(userUid, assignmentId, pageId, elementId, container) {
    const db = firebase.firestore();
    const responses = {};
    
    // Collect all responses
    container.querySelectorAll('input[type="radio"]:checked').forEach(input => {
        responses[input.name] = parseInt(input.value);
    });
    
    container.querySelectorAll('textarea').forEach(textarea => {
        responses[textarea.dataset.promptId] = textarea.value;
    });
    
    try {
        await db.collection('submissions').doc(userUid).set({
            [assignmentId]: {
                [pageId]: {
                    [`${elementId}_self_assessment`]: responses
                }
            }
        }, { merge: true });
        
        console.log('Self-assessment saved:', responses);
    } catch (error) {
        console.error('Error saving self-assessment:', error);
    }
}

async function loadSelfAssessment(userUid, assignmentId, pageId, elementId, container) {
    const db = firebase.firestore();
    const doc = await db.collection('submissions').doc(userUid).get();
    
    if (doc.exists) {
        const data = doc.data();
        const responses = data?.[assignmentId]?.[pageId]?.[`${elementId}_self_assessment`] || {};
        
        // Populate radio buttons
        Object.keys(responses).forEach(key => {
            const input = container.querySelector(`input[name="${key}"][value="${responses[key]}"]`);
            if (input) input.checked = true;
            
            const textarea = container.querySelector(`textarea[data-prompt-id="${key}"]`);
            if (textarea) textarea.value = responses[key];
        });
    }
}

// Modify renderPage to include self-assessment elements
export function renderPage(pageObject, container) {
    container.innerHTML = '';

    if (pageObject.helpText) {
        const details = document.createElement('details');
        details.innerHTML = `<summary>Weitere Informationen</summary>${pageObject.helpText}`;
        container.appendChild(details);
    }

    pageObject.elements.forEach(element => {
        if (element.type === 'text') {
            renderTextBlock(element, container);
        } else if (element.type === 'quill') {
            renderQuillEditorStructure(element, container);
        } else if (element.type === 'self-assessment') {
            // Self-assessment is rendered later after trigger conditions are met
            // We'll handle this in setupSelfAssessmentTriggers
        }
    });
}

// NEW: Setup triggers for self-assessment
export function setupSelfAssessmentTriggers(userUid, assignmentId, pageObject, container) {
    pageObject.elements.forEach(element => {
        if (element.type === 'self-assessment') {
            const triggerEditor = document.getElementById(`quill-editor-${element.triggerElement}`);
            
            if (triggerEditor && triggerEditor.__quill) {
                const checkTrigger = () => {
                    const text = triggerEditor.__quill.getText();
                    const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;
                    
                    const saContainer = document.getElementById(`self-assessment-${element.id}`);
                    
                    if (wordCount >= element.triggerAfterWords) {
                        if (!saContainer) {
                            // Render self-assessment if not already present
                            const wrapper = triggerEditor.closest('.quill-element') || container;
                            renderSelfAssessment(element, wrapper, userUid, assignmentId, pageObject.id);
                        } else {
                            saContainer.classList.add('visible');
                        }
                    }
                };
                
                // Check on text change
                triggerEditor.__quill.on('text-change', checkTrigger);
                
                // Check immediately in case content already exists
                setTimeout(checkTrigger, 500);
            }
        }
    });
}