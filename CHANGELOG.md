# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1.0] - 2026-10-30

### Added
- `POST /api/v1/analyze/url`: a dedicated link-scanning endpoint.
- Screenshot scanning with Tesseract OCR. Returns `503` when the OCR engine is not installed.
- `GET /api/v1/stats`: scan statistics aggregated in MongoDB.
- Sender-domain checks for emails.
- Per-signal score breakdown (`signals`) and model category (`ml_category`) in every response.
- 75 pytest tests across endpoints, engines, accounts, configuration and persistence.
- Model evaluation (`ml/evaluate.py`): stratified hold-out plus 5-fold cross-validation, comparing Random Forest, Logistic Regression, Naive Bayes and Linear SVM.
- Accounts: separate Log In and Sign Up screens, backend registration and login (bcrypt + JWT), and per-user scan history in MongoDB (`/api/v1/auth/*`, `/api/v1/history`). Guests keep history in local storage.
- Android app with background scanning: a notification listener and SMS receiver scan incoming messages while the app is closed, raise a high-priority alert for scams (tapping it opens the result), and add every background scan to History with an *SMS / Notification · auto-scanned* badge. See `docs/ANDROID.md`.
- Frontend API client and a link scan tab.
- Dockerfile, docker-compose (API + MongoDB), GitHub Actions CI and a Render blueprint.

### Fixed
- The SMS scam probability ignored the `digital_arrest` class; it is now `1 − P(safe)`.
- Email text is now preprocessed exactly as during training (stemming, stop-words).
- Messages without links could never reach the *scam* band. The scorer now averages only the signals that apply.
- URL extraction no longer treats `Rs.500`, `e.g.` or email domains as links, and `t.co` no longer matches `microsoft.com`.
- Analysis runs on the original text. PII masking is applied only to the stored copy, and leaves links and IP addresses intact.
- Requests no longer stall for 30 s when MongoDB is unreachable.
- Combined intents (e.g. *fear / urgency*) now receive specific advice.

### Changed
- The repository is organised into `backend/`, `frontend/` and `ml/`.
- Configuration moved to environment variables (`.env.example` in each app).
- Rule-based keyword boosts were removed from the ML score. Behavioural rules live in a separate engine.
- `motor` was replaced with PyMongo's native async client.

### Removed
- Firebase (Auth and Firestore), replaced by the backend's own accounts.
- Simulated results: the random call-reputation tab, the offline fallback scores and the placeholder OCR text.
- Build artefacts and IDE files from version control.

## [1.0.0] - 2026-03-29
- Hackathon prototype (Hack4Innovation 2026).
