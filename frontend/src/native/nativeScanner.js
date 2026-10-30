// Bridge to the Android background scanner (frontend/android/.../ScamShieldPlugin.java).
// On the web every call is a no-op, so screens can use it unconditionally.
import { Capacitor } from '@capacitor/core';
import ScamShield from '../utils/ScamShieldPlugin';
import { API_BASE, getToken, toResult, sourceLabel } from '../api/client';

export const isNative = Capacitor.isNativePlatform();

const EMPTY_STATUS = { notificationAccess: false, sms: false, postNotifications: false };

/** Give the background scanner the API address and the current login token. */
export const syncNativeConfig = async () => {
  if (!isNative) return null;
  try {
    return await ScamShield.configure({ apiUrl: API_BASE, token: getToken() || '' });
  } catch (err) {
    console.warn('Could not configure background scanner:', err);
    return null;
  }
};

export const getNativeStatus = async () => {
  if (!isNative) return EMPTY_STATUS;
  try {
    return await ScamShield.getStatus();
  } catch {
    return EMPTY_STATUS;
  }
};

export const openNotificationAccessSettings = () => isNative && ScamShield.openNotificationSettings();
export const requestSmsPermission = () => (isNative ? ScamShield.requestSmsPermission() : getNativeStatus());
export const requestAlertPermission = () => (isNative ? ScamShield.requestNotificationPermission() : getNativeStatus());

/** Native scan event -> history record in the same shape as an in-app scan. */
export const eventToRecord = (event) => ({
  ...toResult(event.result, sourceLabel(event.source || 'notifications')),
  id: event.scannedAt || Date.now(),
  date: new Date(event.scannedAt || Date.now()).toISOString(),
  scannedText: event.text,
  background: true,
  app: event.app,
});

/** Background scans that finished while the app was closed, newest first (consumed once). */
export const drainBackgroundScans = async () => {
  if (!isNative) return [];
  try {
    const { events } = await ScamShield.drainBackgroundScans();
    return (events || []).filter(e => e?.result).map(eventToRecord).reverse();
  } catch {
    return [];
  }
};

/**
 * Subscribe to background scans and to "user tapped a scam alert".
 * Returns an unsubscribe function.
 */
export const subscribeToNativeScans = ({ onScan, onOpen }) => {
  if (!isNative) return () => {};
  const handles = [
    ScamShield.addListener('scanResult', (event) => event?.result && onScan(eventToRecord(event))),
    ScamShield.addListener('openResult', (event) => event?.result && onOpen(eventToRecord(event))),
  ];
  // Cold start from an alert: the event was captured before the web app was listening.
  ScamShield.getPendingResult()
    .then(({ event }) => event?.result && onOpen(eventToRecord(event)))
    .catch(() => {});
  return () => handles.forEach(h => Promise.resolve(h).then(l => l.remove()));
};
