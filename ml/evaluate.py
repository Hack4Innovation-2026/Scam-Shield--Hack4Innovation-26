"""
Evaluate the TF-IDF + Random Forest scam classifier and compare it with linear baselines.

Dataset: UCI SMS Spam Collection (5,574 SMS, ham/spam), used because the original training CSV
is not available. Spam is treated as the positive ("scam") class.

Leakage control: every model is a single sklearn Pipeline (TfidfVectorizer -> classifier), so the
TF-IDF vocabulary and IDF weights are fit only on training data - on the training folds inside
cross-validation, and on the training split for the held-out test. The test split is touched once.

Usage:
    python ml/evaluate.py --download          # fetch the dataset into ml/data/ first time
    python ml/evaluate.py [--seed 42] [--folds 5] [--test-size 0.2]
"""
import argparse
import io
import json
import sys
import urllib.request
import zipfile
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (average_precision_score, confusion_matrix, f1_score,
                             precision_recall_curve, precision_score, recall_score)
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC

ML_DIR = Path(__file__).resolve().parent
DATA_PATH = ML_DIR / "data" / "SMSSpamCollection"
RESULTS_DIR = ML_DIR / "results"
SHIPPED_MODEL_DIR = ML_DIR.parent / "backend" / "models"
DATASET_URL = "https://archive.ics.uci.edu/static/public/228/sms+spam+collection.zip"

# Categorical palette (validated for CVD separation); line styles add a second encoding.
COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"]
LINESTYLES = ["-", "--", "-.", ":", (0, (5, 1, 1, 1))]


def download_dataset():
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {DATASET_URL}")
    with urllib.request.urlopen(DATASET_URL, timeout=60) as resp:
        archive = zipfile.ZipFile(io.BytesIO(resp.read()))
    DATA_PATH.write_bytes(archive.read("SMSSpamCollection"))
    print(f"Saved {DATA_PATH}")


def load_dataset():
    if not DATA_PATH.exists():
        sys.exit(f"Dataset not found at {DATA_PATH}. Run with --download first.")
    df = pd.read_csv(DATA_PATH, sep="\t", header=None, names=["label", "text"], quoting=3, encoding="utf-8")
    df = df.dropna()
    return df["text"].astype(str), (df["label"] == "spam").astype(int)


def tfidf():
    # Same vectorizer settings as the production SMS model (ml/train_sms.py).
    return TfidfVectorizer(max_features=5000, ngram_range=(1, 2), sublinear_tf=False)


def build_models(seed: int) -> dict:
    return {
        "Random Forest (production config)": Pipeline([
            ("tfidf", tfidf()),
            ("clf", RandomForestClassifier(n_estimators=50, max_depth=20, class_weight="balanced",
                                           n_jobs=-1, random_state=seed)),
        ]),
        "Logistic Regression": Pipeline([
            ("tfidf", tfidf()),
            ("clf", LogisticRegression(max_iter=2000, class_weight="balanced", C=10, random_state=seed)),
        ]),
        "Multinomial Naive Bayes": Pipeline([
            ("tfidf", tfidf()),
            ("clf", MultinomialNB(alpha=0.1)),
        ]),
        "Linear SVM": Pipeline([
            ("tfidf", tfidf()),
            ("clf", LinearSVC(class_weight="balanced", C=1.0, random_state=seed)),
        ]),
    }


def scores_for(model, X) -> np.ndarray:
    """Continuous score for PR-AUC: P(spam) where available, otherwise the SVM margin."""
    if hasattr(model, "predict_proba"):
        return model.predict_proba(X)[:, 1]
    return model.decision_function(X)


def holdout_metrics(y_true, y_pred, y_score) -> dict:
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    return {
        "precision": precision_score(y_true, y_pred, zero_division=0),
        "recall": recall_score(y_true, y_pred, zero_division=0),
        "f1": f1_score(y_true, y_pred, zero_division=0),
        "pr_auc": average_precision_score(y_true, y_score),
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    }


def evaluate_shipped_model(X_test, y_test):
    """The pickled production model, scored on the same held-out split.

    It was trained on a different (unavailable) dataset with classes digital_arrest/general_spam/safe,
    so this is a cross-dataset check. If that dataset included UCI messages, this number is optimistic.
    """
    model_path, vec_path = SHIPPED_MODEL_DIR / "sms_model.pkl", SHIPPED_MODEL_DIR / "sms_vectorizer.pkl"
    if not (model_path.exists() and vec_path.exists()):
        return None
    model, vec = joblib.load(model_path), joblib.load(vec_path)
    probs = model.predict_proba(vec.transform(X_test))
    p_scam = 1.0 - probs[:, list(model.classes_).index("safe")]
    return holdout_metrics(y_test, (p_scam >= 0.5).astype(int), p_scam), p_scam


def plot_pr_curves(curves: dict, y_test, out_path: Path):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(7, 5), dpi=150)
    for i, (name, y_score) in enumerate(curves.items()):
        precision, recall, _ = precision_recall_curve(y_test, y_score)
        ap = average_precision_score(y_test, y_score)
        ax.plot(recall, precision, color=COLORS[i % len(COLORS)], linestyle=LINESTYLES[i % len(LINESTYLES)],
                linewidth=2, label=f"{name}  (PR-AUC {ap:.3f})")
    base_rate = float(np.mean(y_test))
    ax.axhline(base_rate, color="#8a8a85", linewidth=1, linestyle=":")
    ax.text(0.99, base_rate + 0.015, f"chance = {base_rate:.2f}", ha="right", color="#5f5e5a", fontsize=8)
    ax.set_xlabel("Recall")
    ax.set_ylabel("Precision")
    ax.set_xlim(0, 1.0)
    ax.set_ylim(0, 1.02)
    ax.set_title("Precision-recall on held-out test set (UCI SMS Spam)", fontsize=11, loc="left")
    ax.grid(color="#e6e5e0", linewidth=0.6)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    ax.legend(loc="lower left", bbox_to_anchor=(0.0, 0.2), fontsize=8, frameon=False)
    fig.tight_layout()
    fig.savefig(out_path)
    plt.close(fig)


def to_markdown(results: dict, meta: dict) -> str:
    lines = [
        "# Model evaluation",
        "",
        f"Dataset: UCI SMS Spam Collection - {meta['n_samples']} messages, "
        f"{meta['n_positive']} spam ({meta['positive_rate']:.1%}). "
        f"Stratified {1 - meta['test_size']:.0%}/{meta['test_size']:.0%} split, seed {meta['seed']}. "
        f"TF-IDF is fit inside each pipeline on training data only.",
        "",
        f"## {meta['folds']}-fold stratified cross-validation (training set, mean ± std)",
        "",
        "| Model | Precision | Recall | F1 | PR-AUC |",
        "|---|---|---|---|---|",
    ]
    for name, r in results.items():
        cv = r.get("cv")
        if not cv:
            continue
        cells = " | ".join(f"{cv[m]['mean']:.3f} ± {cv[m]['std']:.3f}" for m in ("precision", "recall", "f1", "pr_auc"))
        lines.append(f"| {name} | {cells} |")
    lines += [
        "",
        f"## Held-out test set ({meta['n_test']} messages, threshold 0.5 / SVM margin 0)",
        "",
        "| Model | Precision | Recall | F1 | PR-AUC | TN | FP | FN | TP |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for name, r in results.items():
        h, cm = r["holdout"], r["holdout"]["confusion_matrix"]
        lines.append(f"| {name} | {h['precision']:.3f} | {h['recall']:.3f} | {h['f1']:.3f} | {h['pr_auc']:.3f} "
                     f"| {cm['tn']} | {cm['fp']} | {cm['fn']} | {cm['tp']} |")
    lines += ["", "Rows marked *shipped* are the pickled production model scored as P(scam) = 1 - P(safe); "
              "it was trained on a different, unavailable dataset, so treat it as a cross-dataset check.", ""]
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--download", action="store_true", help="download the UCI dataset into ml/data/")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--folds", type=int, default=5)
    parser.add_argument("--test-size", type=float, default=0.2)
    args = parser.parse_args()

    if args.download or not DATA_PATH.exists():
        download_dataset()

    X, y = load_dataset()
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=args.test_size, stratify=y, random_state=args.seed)
    meta = {"n_samples": len(X), "n_positive": int(y.sum()), "positive_rate": float(y.mean()),
            "n_test": len(X_test), "test_size": args.test_size, "seed": args.seed, "folds": args.folds}
    print(f"{len(X)} messages, {y.mean():.1%} spam | train {len(X_train)} / test {len(X_test)} (stratified)\n")

    cv = StratifiedKFold(n_splits=args.folds, shuffle=True, random_state=args.seed)
    scoring = {"precision": "precision", "recall": "recall", "f1": "f1", "pr_auc": "average_precision"}

    results, curves = {}, {}
    for name, model in build_models(args.seed).items():
        cv_res = cross_validate(model, X_train, y_train, cv=cv, scoring=scoring, n_jobs=1)
        cv_summary = {m: {"mean": float(cv_res[f"test_{m}"].mean()), "std": float(cv_res[f"test_{m}"].std())}
                      for m in scoring}

        model.fit(X_train, y_train)          # TF-IDF fit on X_train only
        y_score = scores_for(model, X_test)
        holdout = holdout_metrics(y_test, model.predict(X_test), y_score)
        results[name] = {"cv": cv_summary, "holdout": holdout}
        curves[name] = y_score

        cm = holdout["confusion_matrix"]
        print(f"== {name}")
        print("   CV      " + "  ".join(f"{m}={v['mean']:.3f}+/-{v['std']:.3f}" for m, v in cv_summary.items()))
        print(f"   holdout precision={holdout['precision']:.3f} recall={holdout['recall']:.3f} "
              f"f1={holdout['f1']:.3f} pr_auc={holdout['pr_auc']:.3f}")
        print(f"   confusion matrix [[TN={cm['tn']} FP={cm['fp']}] [FN={cm['fn']} TP={cm['tp']}]]\n")

    shipped = evaluate_shipped_model(X_test, y_test)
    if shipped:
        holdout, p_scam = shipped
        name = "Shipped pickle, cross-dataset (*shipped*)"
        results[name] = {"cv": None, "holdout": holdout}
        curves[name] = p_scam
        cm = holdout["confusion_matrix"]
        print(f"== {name}  (cross-dataset, see docstring)")
        print(f"   holdout precision={holdout['precision']:.3f} recall={holdout['recall']:.3f} "
              f"f1={holdout['f1']:.3f} pr_auc={holdout['pr_auc']:.3f}")
        print(f"   confusion matrix [[TN={cm['tn']} FP={cm['fp']}] [FN={cm['fn']} TP={cm['tp']}]]\n")

    RESULTS_DIR.mkdir(exist_ok=True)
    (RESULTS_DIR / "metrics.json").write_text(json.dumps({"meta": meta, "results": results}, indent=2))
    (RESULTS_DIR / "metrics.md").write_text(to_markdown(results, meta), encoding="utf-8")
    plot_pr_curves(curves, y_test, RESULTS_DIR / "pr_curves.png")
    print(f"Wrote {RESULTS_DIR / 'metrics.json'}, metrics.md and pr_curves.png")


if __name__ == "__main__":
    main()
