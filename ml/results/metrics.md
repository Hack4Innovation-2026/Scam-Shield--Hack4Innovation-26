# Model evaluation

Dataset: UCI SMS Spam Collection - 5574 messages, 747 spam (13.4%). Stratified 80%/20% split, seed 42. TF-IDF is fit inside each pipeline on training data only.

## 5-fold stratified cross-validation (training set, mean ± std)

| Model | Precision | Recall | F1 | PR-AUC |
|---|---|---|---|---|
| Random Forest (production config) | 0.996 ± 0.005 | 0.843 ± 0.029 | 0.913 ± 0.018 | 0.970 ± 0.010 |
| Logistic Regression | 0.961 ± 0.018 | 0.938 ± 0.011 | 0.949 ± 0.011 | 0.979 ± 0.008 |
| Multinomial Naive Bayes | 0.995 ± 0.007 | 0.910 ± 0.010 | 0.950 ± 0.007 | 0.977 ± 0.005 |
| Linear SVM | 0.977 ± 0.019 | 0.930 ± 0.014 | 0.953 ± 0.013 | 0.980 ± 0.007 |

## Held-out test set (1115 messages, threshold 0.5 / SVM margin 0)

| Model | Precision | Recall | F1 | PR-AUC | TN | FP | FN | TP |
|---|---|---|---|---|---|---|---|---|
| Random Forest (production config) | 1.000 | 0.852 | 0.920 | 0.976 | 966 | 0 | 22 | 127 |
| Logistic Regression | 0.972 | 0.933 | 0.952 | 0.978 | 962 | 4 | 10 | 139 |
| Multinomial Naive Bayes | 0.978 | 0.906 | 0.941 | 0.971 | 963 | 3 | 14 | 135 |
| Linear SVM | 0.972 | 0.940 | 0.956 | 0.977 | 962 | 4 | 9 | 140 |
| Shipped pickle, cross-dataset (*shipped*) | 0.518 | 0.886 | 0.653 | 0.817 | 843 | 123 | 17 | 132 |

Rows marked *shipped* are the pickled production model scored as P(scam) = 1 - P(safe); it was trained on a different, unavailable dataset, so treat it as a cross-dataset check.
