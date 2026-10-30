// Client for the Scam Shield FastAPI backend.
//
// VITE_API_URL unset  -> relative URLs; in `npm run dev` Vite proxies /api to the backend (no CORS).
// VITE_API_URL set    -> calls that origin directly (production, or the Android app, where the
//                        emulator reaches the host machine at http://10.0.2.2:8000).

import { Capacitor } from '@capacitor/core';

// Inside the Android app there is no dev proxy, so an absolute URL is required; 10.0.2.2 is the
// emulator's alias for the development PC. Build with VITE_API_URL for a phone or a deployed API.
const NATIVE_DEFAULT_API = 'http://10.0.2.2:8000';
const API_URL = (import.meta.env.VITE_API_URL || (Capacitor.isNativePlatform() ? NATIVE_DEFAULT_API : '')).replace(/\/$/, '');

// Absolute API base (the native background scanner needs one even when the web app uses the proxy).
export const API_BASE = API_URL || window.location.origin;
const TIMEOUT_MS = 20000;
const TOKEN_KEY = 'scamShieldToken';

// Login token, sent as a Bearer header so scans are saved to the signed-in user's history.
export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage blocked: the session just won't survive a reload
  }
};
// Fired when the server rejects the stored token, so the app can sign the user out.
export const UNAUTHORIZED_EVENT = 'scamshield:unauthorized';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const humanize = (s) => (s ? s.split('_').map(capitalize).join(' ') : s);

const SOURCE_LABELS = {
  sms: 'SMS', url: 'URL', email: 'Email', image: 'Screenshot', whatsapp: 'WhatsApp',
  instagram: 'Instagram', telegram: 'Telegram', notifications: 'Notification',
};
const sourceLabel = (s) => SOURCE_LABELS[s] || capitalize(s);

// Backend snake_case response -> the camelCase shape the screens render.
export const toResult = (data, displaySource) => ({
  riskScore: data.risk_score,
  level: data.level,
  scamType: humanize(data.scam_type),
  intent: humanize(data.intent),
  confidence: capitalize(data.confidence),
  reason: data.reason,
  advice: data.advice,
  action: data.action,
  urls: data.urls || [],
  urlFlags: data.url_flags || [],
  source: displaySource || sourceLabel(data.source),
  signals: data.signals || {},
  mlCategory: data.ml_category ? humanize(data.ml_category) : null,
  extractedText: data.extracted_text || null,
  report: {
    reportRecommended: data.report.report_recommended,
    reportLink: data.report.report_link || 'https://cybercrime.gov.in',
    reportSummary: data.report.report_summary,
  },
});

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const token = getToken();
  const headers = { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers, signal: controller.signal });
  } catch (err) {
    const reason = err.name === 'AbortError' ? 'timed out' : 'is unreachable';
    throw new ApiError(`The Scam Shield server ${reason}. Make sure the backend is running.`, 0);
  } finally {
    clearTimeout(timer);
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    // non-JSON error page
  }
  if (!response.ok) {
    // The Vite dev proxy answers 502/504 without a JSON body when the backend is down.
    if (!body && [502, 504].includes(response.status)) {
      throw new ApiError('The Scam Shield server is unreachable. Make sure the backend is running.', 0);
    }
    if (response.status === 401 && token) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    const detail = Array.isArray(body?.detail)
      ? body.detail.map(d => `${d.loc?.at(-1) ?? 'field'}: ${d.msg}`).join('; ')
      : body?.detail;
    throw new ApiError(detail || `Request failed (${response.status})`, response.status);
  }
  return body;
}

const postJson = (path, payload) =>
  request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

export const analyzeText = async (text, source = 'sms') =>
  toResult(await postJson('/api/v1/analyze', { text, source: source.toLowerCase() }), source);

export const analyzeEmail = async ({ subject, body, sender }) =>
  toResult(await postJson('/api/v1/analyze/email', { subject: subject || '', body: body || '', sender_email: sender }), 'Email');

export const analyzeUrl = async (url) =>
  toResult(await postJson('/api/v1/analyze/url', { url }), 'URL');

export const analyzeImage = async (file) => {
  const form = new FormData();
  form.append('file', file);
  return toResult(await request('/api/v1/analyze/image', { method: 'POST', body: form }), 'Screenshot');
};

// Dispatch a ScanScreen payload to the matching endpoint.
export const analyzeInput = (payload) => {
  switch (payload.type) {
    case 'email': return analyzeEmail(payload);
    case 'url': return analyzeUrl(payload.url);
    case 'image': return analyzeImage(payload.image);
    default: return analyzeText(payload.text, payload.source || 'SMS');
  }
};

// ---------------------------------------------------------------- accounts
export const register = (name, email, password) => postJson('/api/v1/auth/register', { name, email, password });
export const login = (email, password) => postJson('/api/v1/auth/login', { email, password });
export const fetchMe = () => request('/api/v1/auth/me');

// Server-side history for the signed-in user, in the same shape as a fresh scan result.
export const fetchHistory = async () => {
  const items = await request('/api/v1/history');
  return items.map(item => ({ ...toResult(item), id: item.id, date: item.timestamp }));
};
