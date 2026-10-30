# Deployment

The recommended free setup:

```
Browser ──► Vercel (React static build) ──► Render (FastAPI, Docker) ──► MongoDB Atlas
                    │
                    └──► Firebase Auth / Firestore (optional)
```

| Component | Host | Plan |
|---|---|---|
| Frontend | Vercel (or Netlify) | Free |
| Backend API | Render, from `render.yaml` | Free |
| Database | MongoDB Atlas M0 | Free |

Free Render services sleep after about 15 minutes idle. The first request after that takes 30–60 s while the service wakes up.

## 1. Database: MongoDB Atlas

Create the cluster, database user and network rule as described in [DATABASE.md](DATABASE.md#option-a-mongodb-atlas-cloud-free-tier-recommended-and-required-for-deployment). For a hosted backend, the network access list must allow `0.0.0.0/0`. Keep the connection string at hand.

## 2. Backend: Render

1. Sign in at <https://render.com> with GitHub.
2. **New → Blueprint** → select this repository. Render reads `render.yaml` and creates the `scam-shield-api` service from `backend/Dockerfile`. The image includes Tesseract, so screenshot scanning works.
3. When prompted, set:
   - `MONGO_URI`: the Atlas connection string
   - `CORS_ORIGINS`: the frontend URL from step 3, e.g. `https://scam-shield.vercel.app`. Set a placeholder for now and update it after step 3.
4. Deploy. Check `https://<service>.onrender.com/` (should show `"database": true`) and `/docs`.

## 3. Frontend: Vercel

1. Sign in at <https://vercel.com> with GitHub → **Add New → Project** → import this repository.
2. Settings:
   - **Root Directory:** `frontend`
   - **Framework preset:** Vite (build `npm run build`, output `dist`)
   - **Environment variables:**
     - `VITE_API_URL` = `https://<service>.onrender.com`
     - `VITE_FIREBASE_*`: optional, see `frontend/.env.example`
3. Deploy, then copy the production URL back into Render's `CORS_ORIGINS` and redeploy the backend.
4. If Firebase is used, add the Vercel domain under Firebase Console → Authentication → Settings → **Authorized domains**.

`VITE_*` variables are compiled into the bundle at build time. After changing them, redeploy the frontend.

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and on every pull request:

| Job | What it checks |
|---|---|
| Backend tests | full pytest suite with Tesseract and a MongoDB service container |
| Frontend | `npm ci`, ESLint, production build |
| Docker image | builds `backend/Dockerfile` and smoke-tests the running container |

Render and Vercel redeploy automatically when `main` changes.

## Android build (optional)

```bash
cd frontend
VITE_API_URL=https://<service>.onrender.com npm run build
npx cap sync android
npx cap open android        # build and run from Android Studio
```
The native `ScamShield` notification plugin is not part of this repository.
