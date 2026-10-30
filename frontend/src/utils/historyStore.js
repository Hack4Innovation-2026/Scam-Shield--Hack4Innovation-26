// Scan history persistence: Firestore (users/{uid}/scans) when signed in, localStorage for guests.
import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';

const LOCAL_KEY = 'scamShieldHistory';
const MAX_ITEMS = 100;

const readLocal = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || [];
  } catch {
    return [];
  }
};

const writeLocal = (items) => {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // storage full or blocked: history just won't survive a reload
  }
};

export const loadHistory = async (user) => {
  if (user && db) {
    const q = query(collection(db, `users/${user.uid}/scans`), orderBy('date', 'desc'), limit(MAX_ITEMS));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  }
  return readLocal();
};

export const saveScan = async (user, record) => {
  if (user && db) {
    await addDoc(collection(db, `users/${user.uid}/scans`), record);
    return;
  }
  writeLocal([record, ...readLocal()]);
};
