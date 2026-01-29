# Technology Stack & Constraints

## Core Frameworks
- **Frontend:** HTML5, Native CSS3, Vanilla JavaScript (ES6 Modules).
- **Backend:** Serverless (Firebase Authentication, Firestore).
- **Runtime:** Browser-based (Client-Side Rendering). Node.js is used **ONLY** for local admin scripts (e.g., `set-teacher-claim.js`).

## Critical Libraries (CDN Only)
- **Firebase SDK:** v9.15.0 (Compat libraries used: `firebase-app-compat`, `firebase-auth-compat`, `firestore-compat`).
- **Rich Text Editor:** Quill.js v1.3.6 (Snow Theme).
- **Build Tools:** **NONE**. The browser must run `index.html` directly from the filesystem or a simple local server.

## Data & State
- **Database:** Google Firestore.
- **Auth:** Firebase Auth (Email/Password for accounts + Anonymous for initial load).
- **Routing:** URL Parameters (e.g., `?id=assignment1`). Logic handled in `app.js`.

## Strict Constraints
1. **No NPM/Build Pipeline:** Do not introduce `package.json` dependencies for the frontend. Keep it CDN-based.
2. **Secret Management:** `firebase-config.js` is public. Do NOT put Admin SDK keys in the frontend. Admin tasks run locally via Node.
3. **Legacy Support:** Maintain compatibility with the existing JSON assignment structure (`assignmentId`, `pages`, `elements`).
4. **CSS Strategy:** Use **Raw CSS**. Do not introduce Tailwind, Bootstrap, or other CSS frameworks. Stick to `css/styles.css` and `dashboard/teacher.css`.