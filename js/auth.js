// FILE: js/auth.js (REPLACE entire file)

/**
 * Authenticates the user anonymously using Firebase.
 * If a user is already signed in, it returns the existing user.
 * Otherwise, it creates a new anonymous user.
 * @returns {Promise<firebase.User|null>} A promise that resolves with the Firebase user object, or null on failure.
 */
export async function authenticate() {
    try {
        // Access the globally available 'firebase' object from the script tags
        const auth = firebase.auth();

        // Check if a user is already signed in
        let user = auth.currentUser;
        if (user) {
            console.log("Existing anonymous user found:", user.uid);
            return user;
        }

        // If not, sign in anonymously
        const userCredential = await auth.signInAnonymously();
        console.log("New anonymous user created:", userCredential.user.uid);
        return userCredential.user;

    } catch (error) {
        console.error("Firebase Anonymous Authentication Failed:", error);
        document.body.innerHTML = `
            <div style="padding: 2em; text-align: center;">
                <h1>Verbindung fehlgeschlagen</h1>
                <p>Es konnte keine Verbindung zum Server hergestellt werden. Bitte überprüfen Sie Ihre Internetverbindung und laden Sie die Seite neu.</p>
                <p><i>Fehlerdetails: ${error.message}</i></p>
            </div>
        `;
        return null; // Stop the app from loading further
    }
}