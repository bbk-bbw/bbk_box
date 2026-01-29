# System Architecture

## High-Level Overview
LMS Box follows a **Serverless SPA (Single Page Application)** architecture.
- **Frontend:** Static HTML/JS files hosted on any static web server (Firebase Hosting recommended).
- **Backend:** Firebase Firestore (NoSQL DB) + Firebase Auth.
- **Logic:** Heavy client-side logic using ES Modules (`import/export`).

## Data Flow
1. **Assignment Load:**
   - `index.html?id=xyz` -> `app.js` parses ID.
   - Fetches `assignments/xyz.json`.
   - `renderer.js` generates DOM (Stepper + Quill Editors).
2. **Input & Auto-Save:**
   - User types in Quill -> `text-change` event.
   - `renderer.js` triggers `debouncedSave`.
   - Writes to Firestore `submissions/{uid}` (Nested map structure).
3. **Live Monitoring:**
   - `teacher.js` -> Firestore `onSnapshot` listener.
   - Updates `state.submissions` and re-renders UI instantly.

## Key File Relationships
- `assignment.json`: The schema/definition of the content.
- `renderer.js`: The engine that turns JSON into UI and handles Auto-Save.
- `teacher.js`: The dashboard logic (Read-heavy, listens to changes).
- `admin.js`: Management logic (Write-heavy, creates users/classes).
- `printer.js`: Generates a separate print-friendly HTML view.

## Database Schema (Firestore)
- **`users/{uid}`**: 
  - `displayName`, `email`, `role` ('student'/'teacher'), `classId`, `registeredAt`.
- **`classes/{classId}`**: 
  - `className`, `teacherId`, `registrationCode`.
- **`submissions/{uid}`**: 
  - Structure: `{ [assignmentId]: { [pageId]: { [elementId]: HTMLString } } }`.
- **`presence/{uid}`**: 
  - `status`, `lastActive` (Timestamp), `assignmentId`, `pageId`.