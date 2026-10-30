import joblib
import os
import csv
import sys # Added to gracefully exit if models are missing
from datetime import datetime

# PERMANENT FIX: Always look in the folder where THIS script is saved
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(os.path.dirname(BASE_DIR), 'backend', 'models')

# Load models safely
try:
    vectorizer = joblib.load(os.path.join(MODELS_DIR, 'sms_vectorizer.pkl'))
    model = joblib.load(os.path.join(MODELS_DIR, 'sms_model.pkl'))
    print("Models loaded successfully from:", BASE_DIR)
except FileNotFoundError:
    print(f"\nCRITICAL ERROR: ML Models not found in {BASE_DIR}")
    print("Please ensure 'sms_vectorizer.pkl' and 'sms_model.pkl' are in that folder.")
    sys.exit(1)

# --- DATA COLLECTION FOR FUTURE AI TRAINING ---
def log_for_future_training(text, predicted_category, risk_score):
    """
    Saves user-submitted SMS data into a CSV file for future retraining.
    """
    log_file = os.path.join(BASE_DIR, 'user_reported_data.csv')
    file_exists = os.path.isfile(log_file)
    
    try:
        with open(log_file, mode='a', newline='', encoding='utf-8') as file:
            writer = csv.writer(file)
            if not file_exists:
                writer.writerow(['timestamp', 'text', 'ai_predicted_label', 'risk_score', 'verified_label'])
            
            writer.writerow([datetime.now().strftime("%Y-%m-%d %H:%M:%S"), text, predicted_category, risk_score, ""])
    except Exception as e:
        print(f"Could not log data: {e}")

# --- MAIN SMS ANALYSIS ENGINE ---
def analyze_sms(text: str) -> dict:
    """
    Evaluates an SMS text message and returns a Risk Score JSON.
    """
    if not text or not str(text).strip():
        return {"error": "No SMS text provided."}

    # 1. Vectorize the text
    vec_text = vectorizer.transform([text])

    # 2. Predict Category and Get Probabilities
    prediction = model.predict(vec_text)[0]
    probabilities = model.predict_proba(vec_text)[0]
    class_probs = dict(zip(model.classes_, probabilities))

    # 3. Calculate Overall Risk Score
    safe_prob = class_probs.get('safe', 0.0)
    risk_score = (1.0 - safe_prob) * 100 

    # 4. Format Output
    is_scam = prediction != 'safe'
    
    response = {
        "is_scam": bool(is_scam),
        "risk_score_percentage": round(risk_score, 2),
        "detected_category": str(prediction).replace('_', ' ').title(),
        "platform": "SMS",
        "analyzed_text_preview": text[:120] + "..." if len(text) > 120 else text,
        "action_recommended": "Block & Report" if risk_score > 75 else "Proceed with Caution" if risk_score > 40 else "Safe"
    }

    # Log the data for continuous learning
    log_for_future_training(text, str(prediction), round(risk_score, 2))

    return response

# --- Quick Test ---
if __name__ == "__main__":
    import json
    # Test 1: Digital Arrest SMS
    test_msg = "URGENT: Mumbai Cyber Police. Your Aadhar card is linked to money laundering. Do not disconnect or face digital arrest."
    result = analyze_sms(text=test_msg)
    print("SMS Test Result:\n", json.dumps(result, indent=4))