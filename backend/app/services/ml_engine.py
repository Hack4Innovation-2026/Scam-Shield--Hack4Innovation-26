"""Text classifiers. Returns the model's own probability; rule-based signals live in other engines."""
import logging
import pickle
import string

import joblib

from app import config

logger = logging.getLogger(__name__)

MODEL_SOURCES = ("sms", "email")

# Label the SMS model uses for legitimate messages; every other class is a scam category.
SAFE_LABEL = "safe"

_cache = {}


def load_models():
    """Load every model/vectorizer pair; raise with a clear message if any file is missing."""
    missing = []
    for source in MODEL_SOURCES:
        for kind in ("model", "vectorizer"):
            path = config.MODELS_DIR / f"{source}_{kind}.pkl"
            if not path.exists():
                missing.append(str(path))
                continue
            _cache[f"{source}_{kind}"] = joblib.load(path)

    tools_path = config.MODELS_DIR / "email_preprocess_tools.pkl"
    if tools_path.exists():
        with open(tools_path, "rb") as f:
            _cache["email_tools"] = pickle.load(f)
    else:
        missing.append(str(tools_path))

    if missing:
        raise RuntimeError("Missing model files: " + ", ".join(missing))
    logger.info("Loaded models from %s", config.MODELS_DIR)


def models_loaded() -> bool:
    return all(f"{s}_model" in _cache for s in MODEL_SOURCES)


def model_source_for(source: str) -> str:
    """Map an input channel ('SMS', 'WhatsApp', 'notifications', 'image', ...) to a model."""
    return "email" if source.strip().lower() == "email" else "sms"


def clean_email_text(text: str) -> str:
    """Same preprocessing the email model was trained with (see ml/scamemail.ipynb)."""
    tools = _cache["email_tools"]
    stemmer, stopwords = tools["stemmer"], tools["stopwords"]
    words = str(text).replace("\r\n", "").lower().translate(str.maketrans("", "", string.punctuation)).split()
    return " ".join(stemmer.stem(w) for w in words if w not in stopwords)


def get_ml_prediction(text: str, source: str) -> dict:
    model_source = model_source_for(source)
    model = _cache.get(f"{model_source}_model")
    vectorizer = _cache.get(f"{model_source}_vectorizer")
    if model is None or vectorizer is None:
        return {"ml_prediction": "unknown", "ml_category": None, "ml_risk_score": None}

    features_text = clean_email_text(text) if model_source == "email" else text
    X = vectorizer.transform([features_text])
    probs = dict(zip(model.classes_, model.predict_proba(X)[0]))

    if model_source == "email":
        # Binary model: classes are [0, 1] with 1 = spam/scam.
        scam_prob = float(probs.get(1, 0.0))
        category = "spam" if scam_prob >= 0.5 else SAFE_LABEL
    else:
        # Multi-class model: [digital_arrest, general_spam, safe]. P(scam) is everything but safe.
        scam_prob = 1.0 - float(probs.get(SAFE_LABEL, 0.0))
        category = str(max(probs, key=probs.get))

    return {
        "ml_prediction": "scam" if scam_prob >= 0.5 else "safe",
        "ml_category": category,
        "ml_risk_score": round(scam_prob * 100, 2),
    }
