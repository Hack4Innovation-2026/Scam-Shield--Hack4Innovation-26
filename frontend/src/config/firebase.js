import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// TODO: Replace these placeholders with your actual Firebase project config
// You can get this securely from the Firebase Console -> Project Settings
const firebaseConfig = {
  apiKey: "AIzaSyDt5mCfVxja9eLz4lPxP9haqv8ivCwEFD0",
  authDomain: "scam-shield-270a4.firebaseapp.com",
  projectId: "scam-shield-270a4",
  storageBucket: "scam-shield-270a4.firebasestorage.app",
  messagingSenderId: "898082147757",
  appId: "1:898082147757:android:083790ab88fbe77aa6a524" // Pulled from google-services.json
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export commonly used Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
