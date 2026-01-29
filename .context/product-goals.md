# Product Goals & Mission

## Primary Objective
LMS Box v3.0 is a lightweight, serverless Learning Management System designed to deliver structured, multi-step JSON-defined assignments to students without requiring complex infrastructure or user accounts for initial access.

## Core User Stories
- **Student:** I want to access an assignment via a link/code, work on it step-by-step, and have my progress auto-saved so I don't lose work.
- **Student:** I want to register for a class using a simple code provided by the teacher.
- **Teacher (Monitor):** I want to see a live dashboard of all students in my class, knowing who is online and viewing their answers in real-time as they type.
- **Teacher (Admin):** I want to create classes and reset passwords via a simple interface without needing a developer.
- **System:** I want to define assignments purely in JSON so that content creation is decoupled from code.

## Success Criteria
1. **Zero-Friction Entry:** Students must be able to register using just a Class Code.
2. **Real-Time Latency:** Teacher dashboard updates (presence/answers) should appear within seconds (via Firestore `onSnapshot`).
3. **Printability:** `printer.js` must generate a clean, grading-ready PDF of any student submission.

## Scope Boundaries
- **Out of Scope:** Automated grading (AI grading), native mobile apps, complex role management (Super-Admin vs Admin), chat features.
- **In Scope:** Manual database updates via provided scripts for high-level admin tasks (e.g., promoting a user to Teacher).