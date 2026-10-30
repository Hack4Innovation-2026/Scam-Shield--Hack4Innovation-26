// Client for the Scam Shield FastAPI backend.
//
// VITE_API_URL unset  -> relative URLs; in `npm run dev` Vite proxies /api to the backend (no CORS).
// VITE_API_URL set    -> calls that origin directly (production, or the Android app, where the
//                        emulator reaches the host machine at http://10.0.2.2:8000).

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const TIMEOUT_MS = 20000;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const humanize = (s) => (s ? s.split('_').map(capitalize).join(' ') : s);

// Backend snake_case response -> the camelCase shape the screens render.
const toResult = (data, displaySource) => ({
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
  source: displaySource || capitalize(data.source),
  signals: data.signals || {},
  mlCategory: data.ml_category ? humanize(data.ml_category) : null,
  extractedText: data.extracted_text || null,
  report: {
    reportRecommended: data.report.report_recommended,
    reportLink: data.report.report_link || 'https://cybercrime.gov.in',
    reportSummary: data.report.report_summary,
  },
});

async function request(path, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, signal: controller.signal });
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
    const detail = Array.isArray(body?.detail) ? body.detail.map(d => d.msg).join('; ') : body?.detail;
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
