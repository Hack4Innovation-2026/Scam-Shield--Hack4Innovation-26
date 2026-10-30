import pandas as pd
import string
import pickle
import os

ML_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(ML_DIR, 'data')
MODELS_DIR = os.path.join(os.path.dirname(ML_DIR), 'backend', 'models')
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split

print("--- Starting AI Retraining Process ---")

with open(os.path.join(MODELS_DIR, 'email_preprocess_tools.pkl'), 'rb') as f:
    tools = pickle.load(f)
    stemmer = tools['stemmer']
    stopwords_set = tools['stopwords']

def clean_text(text):
    text = str(text).replace('\r\n', '').lower()
    text = text.translate(str.maketrans('', '', string.punctuation)).split()
    text = [stemmer.stem(word) for word in text if word not in stopwords_set]
    return ' '.join(text)

print("Loading original and new datasets...")
old_data =  pd.read_csv(os.path.join(DATA_DIR, 'processed_data.csv'))

new_data_path = os.path.join(DATA_DIR, 'new_approved_scams.csv')


if not os.path.exists(new_data_path):
    print(f"New data file not found. Creating a dummy file at: {new_data_path}")
    dummy_data = {
        'text': [
            "URGENT: Your Binance crypto wallet is locked. Click here to verify.",
            "Hey man, are we still playing golf tomorrow?",
            "Zelle Alert: $500 was drafted. Call 1-800-FAKE to cancel."
        ],
        'label_num': [1, 0, 1]
    }
    df_dummy = pd.DataFrame(dummy_data)
    df_dummy.to_csv(new_data_path, index=False)


new_data =  pd.read_csv(new_data_path)

print("Cleaning new user reports...")
new_data['clean_text'] = new_data['text'].apply(clean_text)

combined_data = pd.concat([
    old_data[['clean_text', 'label_num']], 
    new_data[['clean_text', 'label_num']]
], ignore_index=True)

combined_data.dropna(subset=['clean_text'], inplace=True)
combined_data.to_csv(os.path.join(DATA_DIR, 'processed_data.csv'), index=False)
print(f"Total dataset size is now: {len(combined_data)} messages.")

print("Re-building vocabulary to learn new scam words...")
vectorizer = CountVectorizer()
X = vectorizer.fit_transform(combined_data['clean_text'])
y = combined_data['label_num']

print("Training the updated AI model...")
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

clf = RandomForestClassifier(n_jobs=-1, n_estimators=100)
clf.fit(X_train, y_train)

accuracy = clf.score(X_test, y_test)
print(f"New Model Accuracy: {accuracy:.2%}")

if accuracy > 0.90:
    print("Saving updated 'Brain' files for the backend...")
    
    with open(os.path.join(MODELS_DIR, 'email_vectorizer.pkl'), 'wb') as f:
        pickle.dump(vectorizer, f)
        
    with open(os.path.join(MODELS_DIR, 'email_model.pkl'), 'wb') as f:
        pickle.dump(clf, f)
        
    print("--- Retraining Complete! Backend will now detect the new scams. ---")
else:
    print("WARNING: New model accuracy is too low. Files were NOT overwritten.")