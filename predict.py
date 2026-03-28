import joblib
import scipy.sparse as sp
import sys # Added to gracefully stop the script on error

# Provide the EXACT path to where your .pkl files are saved
MODEL_PATH = r'C:\PYLab\sms_scam_model.pkl'
VECTORIZER_PATH = r'C:\PYLab\tfidf_vectorizer.pkl'

try:
    model = joblib.load(MODEL_PATH)
    vectorizer = joblib.load(VECTORIZER_PATH)
    print("Models loaded successfully!")
except FileNotFoundError:
    print(f"Error: Could not find the model files at {MODEL_PATH}")
    print("Please check the paths and try again.")
    sys.exit(1) # This stops the script here so you don't get the NameError

def analyze_message(message_text: str, contains_url: bool = False, contains_email: bool = False, contains_phone: bool = False) -> dict:
    # Transform the text
    text_vectorized = vectorizer.transform([message_text])
    
    # Format the extra indicators
    indicators = [[int(contains_url), int(contains_email), int(contains_phone)]]
    
    # Combine features
    features_final = sp.hstack([text_vectorized, indicators])
    
    # Predict
    prediction = model.predict(features_final)[0]
    probability = model.predict_proba(features_final)[0][1]
    
    return {
        "is_scam": bool(prediction == 1),
        "spam_confidence": float(probability),
        "model_version": "1.0_logistic_regression"
    }

# Quick test if someone runs this file directly
if __name__ == "__main__":
    test_result = analyze_message("URGENT: Your account is locked. Click here: bit.ly/123", contains_url=True)
    print("\nTest Result:", test_result)