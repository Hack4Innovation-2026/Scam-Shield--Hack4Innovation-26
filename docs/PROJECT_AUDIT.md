# Scam Shield: Architecture Audit & Improvement Procedure

_Audit date: 2026-10-30 · branch `fix-and-run` · no code changed yet_

---

## 1. What the repo actually is

Every file was uploaded flat into the repo root through GitHub's "Add files via upload". The code imports from folders that **don't exist in the repo**:

| Imported as | Lives at |
|---|---|
| `./screens/HomeScreen` etc. | `./HomeScreen.jsx` (root) |
| `./components/NotificationSimulation` | `./NotificationSimulation.jsx` |
| `./context/AuthContext`, `./config/firebase` | root |
| `./utils/mockEngine`, `./utils/ScamShieldPlugin` | root |
| backend `routes.*`, `services.*`, `schemas.*`, `database.*`, `utils.*`, `models/*.pkl` | inside **`BackendScam.zip`**, also flat |

So **neither the frontend nor the backend can run as committed.** The original folder layout has to be rebuilt (step 0 below).

The repo also contains build output and IDE/Gradle files that shouldn't be in git: `index-BQgIae7u.js` / `index-CZYwPGt-.css` (Vite build), `index.html` (the *built* one, pointing to `/assets/...`), `app-debug.apk` (4 MB), `executionHistory.bin`, `outputFiles.bin`, `*.lock`, `*.probe`, `*.properties`, `workspace.xml`, `misc.xml`, `modules.xml`, `deviceStreaming.xml`, `*.iml`, `.package-lock.json` (a copy from `node_modules`). `local.properties` leaks a teammate's local SDK path.

---

## 2. Architecture (as intended)

```
┌──────────────────────── React 19 + Vite + Capacitor (Android) ──────────────────────┐
│ PermissionScreen → LoginScreen → Home / Scan / History / Settings                   │
│        │                         │                                                  │
│  ScamShield native plugin   ScanScreen ─► ProcessingScreen ─► analyzeInput()         │
│  (NotificationListener,           (text | email | call | image)   utils/mockEngine.js │
│   showToast) — Java source           │                                    │         │
│   NOT in repo, only the APK          └─ ResultScreen / ReportScreen       │         │
│                                                                           │         │
│  Firebase: Auth (imported, unused), Firestore (write only if logged in)   │         │
└───────────────────────────────────────────────────────────────────────────┼─────────┘
                       text/email/call: computed IN THE BROWSER (mock)  ────┘
                       image: POST http://localhost:8000/scan/image  ──► 404 (route doesn't exist)

┌────────────────────────────── FastAPI backend (BackendScam.zip) ────────────────────┐
│ POST /api/v1/analyze/        {text, source}                                         │
│ POST /api/v1/analyze/email/  {subject, body, sender_email}                          │
│ POST /api/v1/analyze/image/  multipart file  (OCR is a hard-coded string)           │
│                 │                                                                   │
│        unified_analyzer.pipeline_analyze_input                                      │
│   1 preprocessing.process_and_mask_pii   (regex masks digits/emails/phones)         │
│   2 url_analyzer.get_url_risk            (shorteners, TLDs, IPs, hyphens) → 0-100   │
│   3 behavioral_engine.analyze_intent     (urgency/fear/reward/authority regex)→0-100│
│   4 ml_engine.get_ml_prediction          (TF-IDF+RF for sms, CountVec+RF for email, │
│                                           random numbers for "notifications")       │
│                                           + keyword boosts on top          → 0-100  │
│   5 risk_scorer   0.4·url + 0.3·behav + 0.3·ml → safe <40 ≤ suspicious < 70 ≤ scam  │
│   6 explanation_engine / advice_engine   (rule-based text)                          │
│   7 connection.store_analyzed_message    (MongoDB via motor)                        │
└─────────────────────────────────────────────────────────────────────────────────────┘

Training (root):
  train_scam_shield.py → scam_shield_vectorizer.pkl + scam_shield_rf_model.pkl  (SMS, 3 classes)
  scamemail.ipynb / t1.py → emailvectorizer.pkl + emailscam_model.pkl          (email, binary)
  scam_shield_core.py  → standalone SMS predictor (not used by backend)
```

**Models confirmed by loading the pickles:**

| File | Type | Classes | Vectorizer |
|---|---|---|---|
| `scam_shield_rf_model.pkl` (= `sms_model.pkl` in zip) | RandomForest, 50 trees, depth 20 | `['digital_arrest', 'general_spam', 'safe']` | TF-IDF, 5 000 features, 1-2 grams |
| `emailscam_model.pkl` (= `email_model.pkl`) | RandomForest, 100 trees | `[0, 1]` | CountVectorizer, 66 111 terms, trained on **stemmed, stop-word-stripped** text |

**Data flow in practice today:** the user types into ScanScreen. For text, email or call, `mockEngine.js` computes a score in the browser from keyword lists and a string hash, so **the ML models are never used by the app.** For images, the request goes to a URL that doesn't exist, and the catch block returns a coin-flip from a hash of the filename. History is kept only in React state and is lost on reload.

---

## 3. Issues found

### 3a. Broken (won't run, or gives wrong answers)

| # | Where | Problem |
|---|---|---|
| B1 | whole repo | Flat layout. Every import path is wrong; the backend is inside a zip. |
| B2 | `index.html` | This is the *built* HTML (`/assets/index-*.js`), not the Vite source (`/src/main.jsx`). `npm run dev` won't boot the app. |
| B3 | `ml_engine.py` (SMS) | `probs[1]` is used as "scam probability", but `classes_` = `[digital_arrest, general_spam, safe]`. Index 1 is **general_spam only**, so **digital-arrest probability is ignored entirely**. Should be `1 − P(safe)`. |
| B4 | `ml_engine.py` (SMS) | `prediction == 1` compares a string label to an int, so it is always False. |
| B5 | `ml_engine.py` (email) | Email model was trained on lower-cased, punctuation-stripped, stop-word-removed, Porter-stemmed text. The backend feeds it raw, PII-masked text, so most tokens miss the vocabulary. |
| B6 | `unified_analyzer.py` | PII masking runs **before** ML and URL analysis. Numbers become `******` / `[PHONE]`, which the models never saw, and URLs that contain digits get mangled. |
| B7 | `connection.py` | With no MongoDB running, every `insert_one` blocks for motor's 30 s server-selection timeout, so **every request takes about 30 s**. |
| B8 | `mockEngine.js` | Image upload posts to `/scan/image`. The backend route is `/api/v1/analyze/image/`, and the frontend expects a different response shape (`threat_level`, `ela_image_base64`, …) from an ELA forensics service that doesn't exist. |
| B9 | backend | No CORS middleware, so the browser at `localhost:5173` is blocked from calling `:8000`. |
| B10 | routes | Routes are declared as `"/"`, so `POST /api/v1/analyze` (no slash) gets a 307 redirect. Some clients drop the body on redirect. |
| B11 | `t1.py`, `scamemail.ipynb` | Hard-coded `C:\Users\aatha\...` paths. They only run on one machine. |
| B12 | requirements | Root `requirements.txt` lacks fastapi, uvicorn and motor. The zip's version lacks pandas, joblib, nltk and python-multipart (needed for `UploadFile`), lists `motor` twice, and pins nothing. Pickles were made with an unknown sklearn version. |
| B13 | `firebase.js` | `appId` is an **Android** app id (`:android:`). The web SDK needs a Web app id. |

### 3b. Missing

| # | What |
|---|---|
| M1 | **No URL-scan endpoint**, even though URL analysis exists internally. |
| M2 | **No real OCR.** The image route always analyses the same hard-coded sentence. |
| M3 | **Training datasets aren't in the repo**: `sms_scam_detection_dataset_merged_with_lang.csv` and `spam_ham_dataset.csv`. This **blocks evaluation and retraining.** |
| M4 | Native Android plugin source (`ScamShield` NotificationListener / `showToast`) and the `android/` project. Only the APK is present. |
| M5 | No tests, no `.env.example`, no Dockerfile, no real README (it's the Vite template). |
| M6 | No frontend API client and no `VITE_API_URL` config. |
| M7 | No persistent history. Firestore writes are gated on `auth.currentUser`, which is never set because auth is mocked. |
| M8 | No honest evaluation. Existing scripts use a non-stratified single split and report accuracy only. |

### 3c. Hard-coded or fake

| # | Where | What |
|---|---|---|
| H1 | `AuthContext.jsx` | Login and signup accept **any** email and password. |
| H2 | `ml_engine.py` | `notifications` source returns **`random.uniform(40, 90)`**. |
| H3 | `image_routes.py` | OCR text is a constant string. |
| H4 | `ScanScreen.jsx` | Image tab sets `payload.text = "Congratulations! You've won…"` regardless of the image. |
| H5 | `mockEngine.js` (call) | `Math.random() > 0.6` decides if a number is a scam. Carrier, location and report count are invented ("AT&T Wireless", "New York"). |
| H6 | `mockEngine.js` | `if (text.includes('wa-verify-secure.xyz')) riskScore = 98` is a demo override. |
| H7 | `ml_engine.py` | About 40 hand-tuned keyword boosts plus a ×1.3 "amplify" factor stacked on the model, which double-counts `behavioral_engine`. |
| H8 | `risk_scorer.py` | Fixed weights 0.4/0.3/0.3. **A message with no URL can score at most 60, so it can never reach "scam" (≥ 70).** A link-free "digital arrest" SMS is capped at "suspicious". `report_recommended ≥ 95` is effectively unreachable. |
| H9 | `ProcessingScreen.jsx` | Step animation is fixed `setTimeout` theatre, unrelated to real processing. |
| H10 | `firebase.js` | Config committed in source. Firebase web keys aren't secret, but they should come from `VITE_FIREBASE_*` env vars so each dev or deploy uses its own project. |

### 3d. Smaller quality issues
- `url_analyzer.extract_urls` regex matches `e.g.`, `Rs.500`, `3.5`. Any of these gives a +10 "URL present" score.
- `except Exception → HTTPException(500, str(e))` leaks internals.
- `datetime.utcnow()` is deprecated.
- `.pyc` files are in the zip.
- `ProcessingScreen` effect depends on `onComplete`, which is recreated every render, so analysis can fire twice under StrictMode.

---

## 4. Improvement procedure (proposed, not yet implemented)

Each phase leaves the project runnable, gets its own commit, and lists what "done" means. Phases 0 to 5 map to your six requests. Items marked ⚑ need your decision (see §5).

### Phase 0: Restructure (prerequisite for everything)
1. `git mv` the frontend into a standard Vite layout:
   ```
   frontend/
     index.html            ← rewritten source version (/src/main.jsx)
     package.json, vite.config.js, eslint.config.js, capacitor.config.json
     public/ favicon.svg icons.svg
     src/ main.jsx App.jsx App.css index.css
          screens/*.jsx  components/NotificationSimulation.jsx
          context/AuthContext.jsx  config/firebase.js
          utils/mockEngine.js  utils/ScamShieldPlugin.js  assets/hero.png react.svg vite.svg
   ```
2. Unzip `BackendScam.zip` into:
   ```
   backend/
     main.py
     app/routes/ app/services/ app/schemas/ app/database/ app/utils/   (with __init__.py)
     models/  sms_model.pkl sms_vectorizer.pkl email_model.pkl email_vectorizer.pkl email_preprocess_tools.pkl
   ml/
     train_sms.py (was train_scam_shield.py)  train_email.py (was notebook + t1.py, paths fixed)
     scam_shield_core.py  data/ (gitignored, you supply CSVs)
   ```
   Drop `.pyc` files and the duplicate root `.pkl` copies.
3. Delete committed build and IDE output. Replace `.gitignore` with a proper Node + Python + Android one. Keep `app-debug.apk` out of git and attach it to a GitHub Release instead ⚑.

**Done when:** `git status` is clean, imports resolve, and nothing generated is tracked.

### Phase 1: Backend runs (your step 2)
1. `backend/requirements.txt`, pinned: fastapi, uvicorn[standard], pydantic, python-multipart, scikit-learn (matched to the pickle version, re-saved if needed), joblib, numpy, scipy, pandas, nltk, motor, python-dotenv. Separate `requirements-dev.txt`: pytest, httpx.
2. `backend/.env.example`: `MONGO_URI=` (empty means persistence disabled), `MONGO_DB=scam_detection_db`, `CORS_ORIGINS=http://localhost:5173`, `MODELS_DIR=./models`, `LOG_LEVEL=info`.
3. Make Mongo **optional**: skip it when `MONGO_URI` is unset, and use `serverSelectionTimeoutMS=2000` with logging, never blocking (fixes B7).
4. Add CORS middleware from env (B9). Accept routes with and without a trailing slash (B10).
5. Load models once at startup in `lifespan` and fail fast with a clear message if any file is missing.

**Done when:** `uvicorn main:app` starts, `/docs` loads, and `/` returns ok in under 100 ms without Mongo.

### Phase 2: Correctness fixes + tests (your step 3)
Code fixes:
- B3/B4: SMS scam probability = `1 − P(safe)`. Also return `predicted_category` (`digital_arrest` / `general_spam` / `safe`) so the UI can show the scam type the model actually found.
- B5: apply the same stem and stop-word cleaner to email input as at training time (shared `ml/text_cleaning.py`).
- B6: run ML and URL analysis on the **raw** text. Mask PII only for what gets stored or logged.
- M1: add `POST /api/v1/analyze/url  {url}`.
- H2: remove random "notifications" scores and route notifications to the SMS model.
- H8: rebalance the scorer. When no URL is present, renormalise the weights over the signals that exist (behaviour plus ML), so a link-free scam can reach "scam". Document thresholds in one config module.
- H7: reduce `ml_engine` keyword boosts. `behavioral_engine` already covers intent, so the model output stays the model output. ⚑
- Generic 500 messages with server-side logging. `datetime.now(timezone.utc)`.

Tests (`backend/tests/`, FastAPI `TestClient`):
- Each endpoint (SMS, email, URL, image) returns 200 with the correct schema. Invalid payloads return 422.
- Behavioural cases: an obvious digital-arrest SMS scores ≥ 70, a benign "see you at 5" scores < 40, a `bit.ly` link is flagged, and an IP-address URL is flagged.
- Unit tests for `url_analyzer`, `behavioral_engine` and `risk_scorer`.
- A test that **would have caught B3**: P(scam) for a digital-arrest sample > 0.5.

I'll report which fixes were in the code and which in the tests, as you asked.

### Phase 3: Frontend against the real backend (your step 4)
1. `src/api/client.js`: `VITE_API_URL` (default `http://localhost:8000`), with `analyzeText`, `analyzeEmail`, `analyzeUrl`, `analyzeImage`, and a timeout plus readable error. Map the backend's snake_case to the shape the screens use (`risk_score → riskScore`, etc.).
2. Replace `mockEngine` calls for text, email and image. On network failure, show an explicit "backend offline" state. **No silent fake results** ⚑.
3. Add a URL tab to ScanScreen. Remove the hard-coded image text (H4).
4. Call tab: no backend exists for it. Either hide it, or keep it with a clear "Demo / simulated" badge ⚑.
5. `vite.config.js`: dev proxy `/api → :8000` as a CORS-free alternative.
6. Firebase: move config to `VITE_FIREBASE_*` in `frontend/.env.example`. Wire real Firebase Auth (email/password and Google) in `AuthContext` when keys are present, and fall back to guest mode otherwise. Persist history to Firestore per user and load it on login (M7, H1). Fix the web `appId` (B13).
7. Fix the double-fire in `ProcessingScreen`. Drive the step animation from the real request.

**Firebase values you'll supply yourself** (Firebase Console → Project settings → *Your apps* → **Web app**, created if none exists):
`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` (the **web** one, `1:…:web:…`).
You also need to enable the Email/Password (and Google) sign-in providers, add `localhost` to Authorized domains, and set Firestore rules so users can only read and write `users/{uid}/scans`.

**Done when:** `npm run dev` loads, a scan hits the backend (visible in the network tab), and results and history render.

### Phase 4: Honest evaluation (your step 5)
`ml/evaluate.py`:
- Loads the dataset. **Requires the CSVs ⚑ (M3).**
- `StratifiedShuffleSplit` / `train_test_split(stratify=y)` 80/20 hold-out, with a fixed seed.
- Every model is a `Pipeline([("tfidf", TfidfVectorizer(...)), ("clf", ...)])`, so **TF-IDF is fit only on training folds** inside CV and only on the train split for the hold-out. No leakage.
- `StratifiedKFold(5)` CV on the training set: mean ± std of precision, recall, F1 and PR-AUC.
- Hold-out report: precision, recall, F1 (per class plus macro), confusion matrix, PR-AUC. For the 3-class SMS set, report both the multi-class view and the binary **scam-vs-safe** view, which is what the app actually uses.
- Compares RandomForest (current settings), LogisticRegression, MultinomialNB and LinearSVC (via `CalibratedClassifierCV` or `decision_function` for PR-AUC).
- Writes `ml/results/metrics.json`, `metrics.md` and a PR-curve PNG for the README.
- Optional ⚑: if another model clearly wins, retrain and swap it into `backend/models/`.

### Phase 5: Interview polish (your step 6)
- `README.md`: one-paragraph pitch, Mermaid architecture diagram (renders on GitHub), quick-start (backend, frontend, Docker), API table with curl examples, evaluation table from Phase 4, design decisions, known limitations (no OCR or call DB if so decided, the Android plugin, dataset provenance), and roadmap.
- `backend/Dockerfile`: `python:3.12-slim`, non-root user, deps layer cached, models copied, `uvicorn` on `$PORT`, healthcheck on `/`. Plus `.dockerignore`. Optional `docker-compose.yml` with Mongo.
- Optional: a GitHub Actions workflow running pytest and the frontend build/lint on each push.

---

## 5. Decisions needed before implementing

1. **Datasets (blocker for Phase 4).** Where are `sms_scam_detection_dataset_merged_with_lang.csv` and `spam_ham_dataset.csv`? They're needed to evaluate or retrain anything.
2. **Image scanning.** Use real OCR with `pytesseract` (already pip-installed here, but needs the Tesseract binary: `winget install UB-Mannheim.TesseractOCR`, plus `apt install tesseract-ocr` in Docker), or keep the endpoint and return "OCR not configured" honestly?
3. **Call tab.** Hide it, or keep it labelled as a simulation?
4. **Offline fallback.** When the backend is down, show an error state (recommended) or keep the browser-side mock clearly labelled "offline estimate"?
5. **Keyword boosts in `ml_engine`.** Remove them so evaluation numbers reflect the real model (recommended), or keep a reduced version?
6. **Build artefacts.** OK to delete `app-debug.apk`, the built bundle and the Gradle/IDE files from git? They stay in history.
7. **Python version.** This machine has Python 3.14. I'd target **3.12** in Docker and keep the code 3.12–3.14 compatible.

### Decisions taken (2026-10-30)
| Question | Decision |
|---|---|
| Datasets | Original CSVs unavailable. Evaluate on the public **UCI SMS Spam Collection** instead (numbers are *not* comparable to the original training data). |
| Image scanning | Real OCR with Tesseract. Return 503 if the binary isn't installed. |
| Call tab / offline mock | Hide the call tab. Show an explicit error when the backend is unreachable. No fabricated results. |
| Restructure, artefact cleanup, keyword boosts | Approved. Run phases 0–5, one commit per phase. |
