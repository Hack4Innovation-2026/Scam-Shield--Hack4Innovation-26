// Scan history: on the server for signed-in users (scans are saved automatically when the request
// carries their token), in localStorage for guests.
import { fetchHistory } from '../api/client';

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

export const loadHistory = (user) => (user ? fetchHistory() : Promise.resolve(readLocal()));

export const saveScan = async (user, record) => {
  if (user) return;   // already stored by the backend with the scan
  writeLocal([record, ...readLocal()]);
};
