import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB5-OKPSAWuIYT9g-1rmLhyx9t0BqvOcM4",
  authDomain: "opsflow-f3b39.firebaseapp.com",
  projectId: "opsflow-f3b39",
  storageBucket: "opsflow-f3b39.firebasestorage.app",
  messagingSenderId: "907557761683",
  appId: "1:907557761683:web:04d706b5b2bc918f795366"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
