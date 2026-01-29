# LMS Box v3.0 - Antigravity Documentation

## ⚠️ Context is Code
This project uses the **Antigravity Documentation** standard. Before contributing or using AI agents, you **MUST** read the files in the `.context/` directory.

- **Rules & Role:** `.antigravity/rules.md` (Read this first!)
- **Tech Stack:** `.context/tech-stack.md` (Strict constraints: Vanilla JS, No Build)
- **Design:** `.context/design-system.md` (Academic Vibe, Raw CSS)
- **Architecture:** `.context/architecture.md` (System understanding)

---

## Project Overview
LMS Box is a lightweight, serverless Learning Management System designed to deliver structured, multi-step assignments defined purely by JSON files.

### Quick Start (Local Development)
1. **No Build Required:** Simply serve the root directory via a local server.
   - e.g., `python -m http.server` or VS Code Live Server.
2. **Configuration:** Ensure `js/firebase-config.js` is set up with valid credentials.
3. **Access:**
   - **Student View:** `http://localhost:8000/index.html?id=assignment1` (or use `login.html`)
   - **Teacher Dashboard:** `http://localhost:8000/dashboard/teacher.html` 
     *(Note: Requires an account with the `isTeacher` claim. Run `node set-teacher-claim.js` locally to promote a user.)*

### Directory Structure
- `/assignments`: JSON definitions for learning content.
- `/js`: Core application logic (ES Modules).
- `/dashboard`: Teacher and Admin interfaces.
- `/css`: Raw CSS styles.