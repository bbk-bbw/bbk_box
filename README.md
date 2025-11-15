Of course. A high-quality README is essential for any project. Here is a detailed, professional README file that explains the project's purpose, architecture, setup, and the critical workings of the backend deployment.

---

# LMS Box v2.1 - Flexible Stepper Application

## Project Overview

LMS Box v2.1 is a modern, data-driven web application designed to deliver multi-page assignments to students in a "stepper" format, similar to the H5P Documentation Tool. This project is a complete evolution from a rigid, single-page application to a flexible, secure, and scalable platform powered by Google Firebase.

The system allows teachers to manage classes and students, while students can sign up, log in from any device, and have their work saved to the cloud in real-time. The entire structure of an assignment is defined by a single `assignment.json` file, making it incredibly easy to create new learning modules without changing any code.

### Core Features

*   **Data-Driven Content:** Assignment structure (pages, questions, text) is dynamically rendered from a single `assignment.json` file.
*   **Secure User Authentication:** Full user management system with email/password accounts, powered by Firebase Authentication.
*   **Role-Based Access Control:** A secure distinction between "student" and "teacher" roles, enforced by Firebase Security Rules and Custom Claims.
*   **Real-time Cloud Storage:** All student answers are saved automatically and securely to Cloud Firestore as they type.
*   **Teacher Management Dashboard:** A dedicated interface for teachers to:
    *   Create and manage classes.
    *   Manually create student accounts and assign them to classes.
    *   View all student submissions in a clean, organized interface.
*   **Student Self-Registration:** Teachers can generate a unique registration link for each class, allowing students to sign up and be automatically enrolled.

---

## Technical Architecture

The application is built on a modern, serverless architecture using Google Firebase and static web technologies.

### 1. Student Frontend

*   **Technology:** HTML, CSS, Vanilla JavaScript (ES6 Modules).
*   **Frameworks/Libraries:** Quill.js for the rich-text editor, Firebase SDK (v9 compat) for backend communication.
*   **Functionality:**
    *   A protected, single-page application (`index.html`) that renders the assignment stepper.
    *   A public login/signup page (`login.html`).
    *   Fetches the assignment structure from `assignment.json`.
    *   Authenticates users against Firebase Auth.
    *   Reads and writes student submission data directly and securely to Cloud Firestore.

### 2. Teacher Dashboard

*   **Technology:** HTML, CSS, Vanilla JavaScript.
*   **Functionality:**
    *   A protected admin panel for teachers.
    *   Logs in teachers using Firebase Authentication and verifies their "teacher" role.
    *   Reads data directly from Firestore (`users`, `classes`, `submissions`) to display class and student information.
    *   Calls a dedicated Google Cloud Function (`createUserAccount`) to securely create new student accounts, as this action cannot be performed from the client-side.

### 3. Google Firebase Backend

*   **Firebase Authentication:**
    *   Manages all user accounts using the **Email/Password** provider.
    *   Uses **Custom Claims** (`isTeacher: true`) to securely assign roles to users.
*   **Cloud Firestore (Database):**
    *   A NoSQL database that stores all application data.
    *   **`submissions/{studentUid}`:** Stores all answers for a given student.
    *   **`users/{userUid}`:** Stores profile information for each user, including their role and class ID.
    *   **`classes/{classId}`:** Stores details for each class, including its name and a unique registration code.
*   **Firestore Security Rules:**
    *   The core of the application's security.
    *   Ensures students can only read/write their own data.
    *   Grants teachers read-access to all student data and full control over classes.
*   **Google Cloud Functions:**
    *   Provides server-side logic for actions that cannot or should not be done on the client.
    *   **`createUserAccount`:** A secure HTTP-triggered function that allows an authenticated teacher to create new student accounts in the system.

---

## Project Setup & Installation

To run this project, you will need a Google Firebase account.

### Step 1: Firebase Project Setup

1.  Create a new project in the [Firebase Console](https://console.firebase.google.com/).
2.  **Enable Authentication:** Go to the "Authentication" section, click "Get Started", and enable the **Email/Password** sign-in provider.
3.  **Enable Firestore:** Go to the "Firestore Database" section and create a new database. Start in **Test Mode** for initial setup.
4.  **Get Firebase Config:** In your project settings (gear icon), under "Your apps", create a new "Web app". Copy the `firebaseConfig` object.

### Step 2: Frontend Configuration

1.  Clone or download the project repository.
2.  In the `js/` directory, create a file named `firebase-config.js`.
3.  Paste your copied `firebaseConfig` object into this file:
    ```javascript
    // js/firebase-config.js
    export const firebaseConfig = {
      apiKey: "AIzaSy*******************",
      authDomain: "your-project-id.firebaseapp.com",
      projectId: "your-project-id",
      // ... rest of your config keys
    };
    ```
4.  Serve the project files from a local web server. A simple way is to use the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension for VS Code.

### Step 3: Backend Deployment (Cloud Function)

The teacher dashboard requires a backend function to create users.

1.  **Go to Cloud Functions:** In your Firebase project, navigate to the Google Cloud Console and find "Cloud Functions".
2.  **Create a Function:**
    *   **Environment:** 1st Gen
    *   **Name:** `lms-teacher-backend` (or similar)
    *   **Trigger:** HTTP, Allow unauthenticated invocations.
3.  **Configure Code:**
    *   **Runtime:** Node.js (e.g., Node.js 20)
    *   **Entry Point:** `createUserAccount`
    *   Copy the contents of the provided `index.js` (server-side) into the `index.js` editor.
    *   Copy the contents of the provided `package.json` (server-side) into the `package.json` editor.
4.  **Deploy** the function.
5.  **Get the URL:** After deployment, go to the "Trigger" tab and copy the function's URL.
6.  **Update `teacher.js`:** In `dashboard/teacher.js`, paste the copied URL into the `CREATE_USER_URL` constant.

### Step 4: Set Your Teacher Role (One-Time Admin Action)

To manage the system, you must grant your own user account teacher privileges.

1.  Sign up for an account using the `login.html` page in your application.
2.  Find your User ID (UID) in the Firebase Authentication console.
3.  Follow the instructions in the project's implementation plan (Milestone 4, Task 2) to use the Google Cloud Shell to set a custom claim on your account. This involves temporarily adding admin code to your Cloud Function, calling it via `curl`, and then removing the code.

---

## Understanding the Backend Deployment (`index.js` & `package.json`)

The backend for this project runs as a single, efficient Google Cloud Function deployment that serves multiple purposes. Understanding how `index.js` and `package.json` work together is key.

### `package.json`

This file is the manifest for our Node.js backend.

```json
{
  "name": "teacher-dashboard-backend",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "functions-framework --target=createUserAccount"
  },
  "dependencies": {
    "@google-cloud/functions-framework": "^3.0.0",
    "firebase-admin": "^11.11.0"
  }
}
```

*   **`"main": "index.js"`**: Tells the Node.js runtime that our main application code is in the `index.js` file.
*   **`"dependencies"`**: Lists the external libraries our code needs.
    *   `@google-cloud/functions-framework`: The official library that wraps our code in a web server, allowing it to respond to HTTP requests.
    *   `firebase-admin`: The powerful Admin SDK that allows our server to perform privileged actions like creating users and bypassing security rules.
*   **`"scripts": { "start": ... }`**: This is the most critical line for deployment. When Google Cloud builds the container for our function, it runs `npm install` to get the dependencies, and then it runs `npm start` to boot the application.
    *   `functions-framework`: This command starts the web server.
    *   `--target=createUserAccount`: This flag tells the framework which exported function from `index.js` should be served. If we had multiple functions, we could remove this flag and use explicit exports to serve all of them.

### `index.js`

This file contains our actual server-side logic.

```javascript
// Import required libraries
const functions = require('@google-cloud/functions-framework');
const admin = require('firebase-admin');

// Initialize the Admin SDK once
admin.initializeApp();

// Define and export the function
exports.createUserAccount = functions.http('createUserAccount', async (req, res) => {
    // 1. Handle CORS preflight requests
    // ...

    // 2. Perform a security check to ensure the caller is a teacher
    // ...

    // 3. Execute the main logic (create a user in Auth and a profile in Firestore)
    // ...
});
```

**How it works:**

1.  **Initialization:** The `firebase-admin` library is initialized. When running on Google Cloud, it automatically finds the necessary credentials.
2.  **Function Definition:** `functions.http('functionName', ...)` registers a block of code as an HTTP-triggered function.
3.  **Export:** `exports.createUserAccount = ...` makes the function discoverable by the Functions Framework. The `--target=createUserAccount` in `package.json` tells the framework to find this specific export and expose it via the function's URL.
4.  **Execution Flow:** When an HTTP request hits the function's URL, the framework directs it to this code. The code first handles CORS, then performs a critical security check using the incoming `idToken` to verify the caller is a teacher. Only if this check passes does it proceed to the core logic of creating a new user. This ensures that only authorized teachers can add students to the system.