const admin = require("firebase-admin");

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function setTeacher(email) {
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { isTeacher: true });
  console.log("Set isTeacher for:", user.uid);
}

setTeacher("petered79@gmail.com").catch(console.error);
