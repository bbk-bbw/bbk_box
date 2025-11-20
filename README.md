# LMS Box v3.0 - Dynamic Assignment Platform

## Project Overview

LMS Box is a lightweight, serverless Learning Management System designed to deliver structured, multi-step assignments to students. It features a real-time teacher dashboard, student self-registration via class codes, and a flexible architecture where assignments are defined purely by JSON files.

The system allows students to work on specific assignments via unique URLs (e.g., `index.html?id=assignment1`), saves their progress automatically to the cloud, and allows teachers to monitor progress live.

### Core Features

*   **Multi-Assignment Support:** Host unlimited assignments. The content is loaded dynamically based on the URL parameter (e.g., `?id=math-101` loads `assignments/math-101.json`).
*   **Student Self-Registration:** Teachers generate a "Class Code" (e.g., `AX7AXF`). Students use this code to sign up, automatically linking them to the correct class.
*   **Live Teacher Monitor:** A read-only dashboard for teachers to watch student progress in real-time as they type.
*   **Admin Management Panel:** A separate interface to create classes, manage student accounts, reset passwords, and delete old data.
*   **Auto-Save:** Student answers (Rich Text) are saved to Google Firestore instantly.
*   **Printable Reports:** Students or teachers can generate a clean, printable PDF of the completed assignment.

---

## Project Structure

```text
/
├── assignments/           # Store your JSON assignment definitions here
│   ├── assignment1.json
│   └── ...
├── dashboard/             # Teacher interfaces
│   ├── admin.html         # Class & User Management (Write Access)
│   ├── admin.js
│   ├── teacher.html       # Live Monitor (Read-Only)
│   ├── teacher.js
│   └── teacher.css
├── js/                    # Core Application Logic
│   ├── app.js             # Routing & State Management
│   ├── auth.js            # Authentication Helpers
│   ├── login.js           # Login & Self-Registration Logic
│   ├── renderer.js        # Renders JSON to HTML & handles Auto-Save
│   ├── printer.js         # Generates Print Views
│   └── firebase-config.js # Firebase Credentials
├── index.html             # Student Assignment View
├── login.html             # Login/Signup Page
└── assignment.json        # (Legacy/Fallback file)