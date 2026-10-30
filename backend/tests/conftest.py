import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Never write test scans into the developer's real database from backend/.env.
# Set before app.config loads: load_dotenv does not override existing variables, so this also
# survives config reloads. Live persistence tests opt in via TEST_MONGO_URI (see test_database.py).
os.environ["MONGO_URI"] = ""

import main  # noqa: E402


@pytest.fixture(scope="session")
def client():
    # Context manager runs the lifespan, so models are loaded exactly as in production.
    with TestClient(main.app) as c:
        yield c


DIGITAL_ARREST_SMS = (
    "URGENT: Mumbai Cyber Police. Your Aadhar card is linked to money laundering. "
    "Do not disconnect or face digital arrest."
)
LOTTERY_SMS = "Congratulations! You have won Rs 50,000 lottery. Claim now at http://bit.ly/claim-prize"
KYC_SMS = "Your SBI account will be blocked today. Update KYC immediately: http://sbi-kyc-update.xyz"
BENIGN_SMS = "Hey, are we still meeting for lunch at 1pm tomorrow?"
BENIGN_SMS_2 = "Mom I reached home, will call you later"
