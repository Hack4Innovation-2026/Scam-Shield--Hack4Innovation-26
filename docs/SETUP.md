# Local setup

How to get Scam Shield running on a new machine. On Windows it takes about 10 minutes, most of it downloads.

## 1. Install the prerequisites

| Tool | Version | Windows install | Required for |
|---|---|---|---|
| Git | any | `winget install Git.Git` | cloning the repo |
| Python | 3.12 or newer | `winget install Python.Python.3.12` | backend |
| Node.js | 20 or newer | `winget install OpenJS.NodeJS.LTS` | frontend |
| Tesseract OCR | 5.x | `winget install UB-Mannheim.TesseractOCR` | screenshot scanning (optional) |

Run these in **PowerShell**. When they finish, **close and reopen PowerShell** so the new commands are on `PATH`.

Check:
```powershell
git --version
python --version
node --version
```

If `python` opens the Microsoft Store instead of printing a version, turn off the Store alias: *Settings → Apps → Advanced app settings → App execution aliases → python.exe → Off*. Then reopen PowerShell.

## 2. Get the code

```powershell
cd $HOME\Documents
git clone https://github.com/Hack4Innovation-2026/Scam-Shield--Hack4Innovation-26.git
cd Scam-Shield--Hack4Innovation-26
```

If the latest changes have not been merged into `main` yet, check out the working branch:
```powershell
git checkout fix-and-run
```

## 3. Run the setup script

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
```

The script:
- checks Python, Node and Tesseract
- creates `backend\.venv` and installs the Python packages
- creates `backend\.env` from the example file, with a generated `JWT_SECRET` for login tokens
- installs the frontend packages
- confirms the ML models load

It is safe to run again at any time, for example after pulling new changes.

`-ExecutionPolicy Bypass` applies only to this one command. It does not change any system setting.

## 4. Connect the database (optional)

Without a database the app works fully, but scans are not stored and `/api/v1/stats` returns `503`.

The database password is **not** in the repository, so each machine needs it in its own `backend\.env`:

1. Open `backend\.env` and set `MONGO_URI` to the same Atlas connection string used on your other machine. Copy it from that machine's `backend\.env`, or get a fresh one from Atlas: *Connect → Drivers*. Never commit this file or paste it into chats or issues.
2. **Allow this machine's IP in Atlas:** cloud.mongodb.com → *Security → Network Access → Add IP Address → Add Current IP Address*. Each network (home, college, hotspot) has a different IP, so repeat this when you change networks.

Full details: [DATABASE.md](DATABASE.md).

## 5. Start the app

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start.ps1
```

Two windows open, one for the backend and one for the frontend, and the app opens in your browser:

| | URL |
|---|---|
| App | http://localhost:5173 |
| API docs | http://localhost:8000/docs |
| Health check | http://localhost:8000/ (shows `"database": true` when MongoDB is connected) |

On the login screen, use **Sign Up** to create an account (needs the database from step 4), or **Continue as Guest**. Accounts work on both machines because they live in MongoDB.

**To stop the app**, close both windows or press `Ctrl+C` in each.

## 6. Run the tests

```powershell
cd backend
.\.venv\Scripts\python -m pytest
```
The tests never write to the database configured in `.env`.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Port 8000 is already in use` | The app is already running. Close the old *Scam Shield* windows. If no window is open, find the process with `Get-NetTCPConnection -LocalPort 8000` and end it in Task Manager. |
| App shows *"Scan failed - server unreachable"* | The backend window shows an error, or it was closed. Restart with `scripts\start.ps1`. |
| Backend log: `MongoDB unavailable ... bad auth` | Wrong password in `MONGO_URI`. Reset the database user's password in Atlas (*Database Access → Edit → Edit Password*) and update `.env`. |
| Backend log: `MongoDB unavailable ... timed out` | This machine's IP is not allowed in Atlas Network Access, or the network blocks port 27017. Try a phone hotspot. |
| Screenshot scan returns *OCR unavailable* | Install Tesseract (step 1) and restart the backend. |
| `pip install` fails building a package | Python is too new for a pinned package, or too old. Install Python 3.12 and delete `backend\.venv`, then re-run the setup script. |
| `running scripts is disabled on this system` | Use the full command shown above, including `powershell -ExecutionPolicy Bypass -File`. |

## macOS / Linux

The scripts are for Windows. On macOS or Linux, run the equivalent steps by hand:
```bash
# prerequisites: brew install python@3.12 node tesseract   (Ubuntu: apt install python3.12-venv nodejs npm tesseract-ocr)
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env                       # then add MONGO_URI
uvicorn main:app --reload --port 8000      # terminal 1

cd ../frontend
npm install
npm run dev                                # terminal 2 -> http://localhost:5173
```
