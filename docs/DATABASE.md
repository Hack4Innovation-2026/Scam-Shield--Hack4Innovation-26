# Data storage

Scam Shield stores everything in **MongoDB**, written only by the backend:

| Collection | Holds |
|---|---|
| `analyzed_messages` | every analysis, PII-masked. Scans by signed-in users carry their `user_id`. |
| `users` | accounts: name, email (unique), bcrypt password hash, creation date |

MongoDB is optional. Without it, scanning works but accounts, history and stats are unavailable, and guests keep their history in the browser.

## What MongoDB is used for

Each request to an `/api/v1/analyze*` endpoint stores one document in `analyzed_messages`:

```json
{
  "timestamp": "2026-10-30T15:42:10Z",
  "source": "sms",
  "risk_score": 97,
  "level": "scam",
  "scam_type": "digital_arrest",
  "intent": "fear / urgency",
  "signals": { "url": null, "behavioral": 100.0, "ml": 75.8 },
  "ml_category": "digital_arrest",
  "urls": [],
  "url_flags": [],
  "original_text_masked": "URGENT: Mumbai Cyber Police ... call [PHONE]",
  "metadata": { "filename": "shot.png" }
}
```

That record serves three purposes:

1. **Analytics.** `GET /api/v1/stats?days=30` aggregates it: totals by verdict, the most common scam types, and the input channels.
2. **Retraining data.** Masked messages and their verdicts are the raw material for the next model version.
3. **Per-user history.** `GET /api/v1/history` returns the signed-in user's scans, using the `{user_id: 1, timestamp: -1}` index.
4. **Audit trail.** It records which signals produced each verdict, so false positives can be investigated.

**Privacy.** OTPs, phone numbers, account numbers and email addresses are replaced with placeholders *before* storage. The sender's email address is not stored.

**Indexes** (created on startup): `{timestamp: -1}` and `{level: 1, timestamp: -1}` for stats, `{user_id: 1, timestamp: -1}` for history, and a unique index on `users.email`.

**Retention.** Scans expire automatically: the `{timestamp: -1}` index is a TTL index, and MongoDB deletes each scan `SCAN_RETENTION_DAYS` days after its `timestamp` (default 90; its background job runs about once a minute). `SCAN_RETENTION_DAYS=0` keeps scans forever, with a plain index. Only `analyzed_messages` expires; `users` has no TTL, so accounts never expire. Users can also delete their own scans at any time with `DELETE /api/v1/history` (Settings → *Delete my history* in the app).

Databases created before this setting already have a `{timestamp: -1}` index without TTL. Creating an index with the same key and different options raises `IndexOptionsConflict`, so startup (`ensure_scan_expiry` in `app/database/connection.py`) checks the existing index first:

| Existing `{timestamp: -1}` index | Setting | What startup does |
|---|---|---|
| none (fresh database) | any | creates it, with TTL unless the setting is `0` |
| same TTL as the setting | any | nothing |
| no TTL, or a different TTL | > 0 | `collMod` sets `expireAfterSeconds` in place (MongoDB 5.1+, which includes Atlas); drops and recreates the index if that fails |
| has TTL | `0` | drops and recreates it without TTL (`collMod` cannot remove TTL) |

The startup log says which happened, for example `Scan retention: 90 days (timestamp TTL index converted with collMod)`. If the setup fails, the API logs a warning and starts anyway; scans then don't expire until the next successful startup.

**Passwords** are never stored. Only bcrypt hashes are, and API responses never include them.

## Why a document database here

MongoDB is a NoSQL **document** database: it stores JSON-like documents rather than rows in fixed tables. Compared with a relational (SQL) database such as PostgreSQL:

| | MongoDB (document) | PostgreSQL (relational) |
|---|---|---|
| Data shape | Each record is one self-contained document; fields can vary | Fixed columns; variable parts need extra tables or JSONB |
| Fit for this data | Natural: lists (`urls`, `url_flags`), a nested `signals` object, `metadata` that differs per channel | Workable: `JSONB` columns or child tables |
| Schema changes | Add a field and new documents carry it | Requires a migration |
| Relationships / joins | Weak; data is denormalised | Strong; foreign keys, joins, constraints |
| Transactions across records | Supported, but not its strength | Core strength |
| Analytics | Aggregation pipeline | SQL, generally more expressive |

**Why it fits Scam Shield.** The stored data is an append-only log of independent, nested records. Nothing joins with anything else, and the shape changes as detection signals are added. A document store handles that with no migrations.

**When SQL would be the better choice.** User accounts with billing, relationships between reports, cases and users, or strict consistency across many records. PostgreSQL with a `JSONB` column would also serve this project well. The choice is a fit-for-purpose trade-off, not a matter of one being universally better.

## Connecting MongoDB

The backend reads one setting: `MONGO_URI` in `backend/.env`. If it is empty, persistence is off and the API still works.

### Option A: MongoDB Atlas (cloud, free tier; recommended, and required for deployment)

1. Create a free account at <https://www.mongodb.com/cloud/atlas/register> and create a free **M0** cluster.
2. **Database Access** → *Add New Database User*. Choose password authentication and give the user *Read and write to any database*.
3. **Network Access** → *Add IP Address*. Add your current IP for local development. A hosted backend whose IP changes needs `0.0.0.0/0`, so keep the database password strong.
4. **Connect** → *Drivers* → copy the connection string and insert your user's password:
   ```
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
   ```
   If the password contains special characters (`@ : / ? # %`), URL-encode them.
5. Put it in `backend/.env` (this file is gitignored and must never be committed):
   ```
   MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
   MONGO_DB=scam_detection_db
   ```

### Option B: local MongoDB

```bash
winget install MongoDB.Server        # Windows (runs as a service on port 27017)
brew install mongodb-community       # macOS, then: brew services start mongodb-community
```
```
MONGO_URI=mongodb://localhost:27017
```

### Option C: Docker

`docker compose up --build` starts the API together with MongoDB and sets `MONGO_URI` automatically.

### Verify

Restart the backend. The startup log should show `Connected to MongoDB database 'scam_detection_db'`, and then:

```bash
curl localhost:8000/                       # "database": true
curl "localhost:8000/api/v1/stats?days=7"  # counts grow as you scan messages
```

If the server is unreachable, the API logs a warning and keeps running without persistence.

### Running the persistence tests

```bash
TEST_MONGO_URI=mongodb://localhost:27017 pytest tests/test_database.py
```
Each run uses a throwaway database (`scam_shield_test_<random>`) and drops it afterwards.
