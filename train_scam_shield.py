import pandas as pd
import joblib
import os
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report

def train_model():
    # 1. INDUSTRY STANDARD BACKEND PATH RESOLUTION
    try:
        # This finds the exact folder this script is sitting in (Best for standard Backend Devs)
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    except NameError:
        # Fallback just in case someone runs this in Jupyter Notebook or IDLE
        BASE_DIR = os.getcwd()
        
    # Dynamically build the paths to the files
    csv_path = os.path.join(BASE_DIR, 'sms_scam_detection_dataset_merged_with_lang.csv')
    model_path = os.path.join(BASE_DIR, 'scam_shield_rf_model.pkl')
    vec_path = os.path.join(BASE_DIR, 'scam_shield_vectorizer.pkl')
    
    print("--- SCAM SHIELD V2 TRAINING STARTED ---")
    print(f"Looking for dataset at: {csv_path}")
    
    try:
        df = pd.read_csv(csv_path)
        print(f"   Success! Loaded {len(df)} messages.")
    except FileNotFoundError:
        print("\nERROR: Could not find the CSV file!")
        print("Please make sure the .csv file is in the EXACT same folder as this Python script.")
        return

# 2. Clean the Data
    print("\n2. Cleaning data and preparing labels...")
    df = df.dropna(subset=['text', 'label'])
    df['label'] = df['label'].astype(str).str.lower().str.strip()
    df['label'] = df['label'].replace({'ham': 'safe', 'spam': 'general_spam', 'general_scam': 'general_spam'})

    # ADD THIS LINE TO VERIFY YOUR DATA:
    print("\n--- LABEL COUNTS ---")
    print(df['label'].value_counts())
    print("--------------------")
    
    # Standardize the labels to lowercase just to be safe
    df['label'] = df['label'].astype(str).str.lower().str.strip()
    
    # Just in case there are any leftover 'ham' or 'spam' labels, we map them to the new ones
    df['label'] = df['label'].replace({
        'ham': 'safe', 
        'spam': 'general_spam',
        'general_scam': 'general_spam' # Catching any mix-ups
    })

    X = df['text']
    y = df['label']
    
    print(f"   Categories confirmed for training: {list(y.unique())}")

    # 3. Split Data
    print("\n3. Splitting into training (80%) and testing (20%) sets...")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # 4. Vectorize Text
    print("\n4. Vectorizing text (Extracting keywords like 'CBI', 'Aadhar', 'OTP')...")
    # ngram_range=(1,2) helps catch phrases like "digital arrest" and "mumbai police"
    vectorizer = TfidfVectorizer(max_features=10000, ngram_range=(1, 2)) 
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec = vectorizer.transform(X_test)

# 5. Train Model
    print("\n5. Training Random Forest Classifier...")
    # MAGIC FIX: 'class_weight="balanced"' forces the AI to pay extreme attention to the 65 Digital Arrest rows!
    model = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1, class_weight='balanced')
    model.fit(X_train_vec, y_train)

    # 6. Evaluate Model
    print("\n--- Model Evaluation Results ---")
    y_pred = model.predict(X_test_vec)
    print(classification_report(y_test, y_pred))

    # 7. Save Models
    print("\n6. Saving trained models for the backend...")
    
    joblib.dump(model, model_path)
    joblib.dump(vectorizer, vec_path)
    
    print(f"   SUCCESS! Model saved as: scam_shield_rf_model.pkl")
    print(f"   SUCCESS! Vectorizer saved as: scam_shield_vectorizer.pkl")
    print(f"   Saved to: {BASE_DIR}")
    print("\n--- TRAINING COMPLETE. YOU ARE READY FOR THE HACKATHON! ---")

if __name__ == "__main__":
    train_model()