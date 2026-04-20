import numpy as np


def make_imbalanced_data(n_majority=950, n_minority=50, seed=42):
    rng = np.random.RandomState(seed)
    X_maj = rng.randn(n_majority, 2) * 1.0 + np.array([0.0, 0.0])
    X_min = rng.randn(n_minority, 2) * 0.8 + np.array([2.5, 2.5])
    X = np.vstack([X_maj, X_min])
    y = np.concatenate([np.zeros(n_majority), np.ones(n_minority)])
    shuffle_idx = rng.permutation(len(y))
    return X[shuffle_idx], y[shuffle_idx]


def euclidean_distance(a, b):
    return np.sqrt(np.sum((a - b) ** 2))


def find_k_neighbors(X, idx, k):
    distances = []
    for i in range(len(X)):
        if i == idx:
            continue
        d = euclidean_distance(X[idx], X[i])
        distances.append((i, d))
    distances.sort(key=lambda x: x[1])
    return [d[0] for d in distances[:k]]


def smote(X_minority, k=5, n_synthetic=100, seed=42):
    rng = np.random.RandomState(seed)
    n_samples = len(X_minority)
    k = min(k, n_samples - 1)
    if k < 1:
        raise ValueError("SMOTE requires at least 2 minority samples")
    synthetic = []

    for _ in range(n_synthetic):
        idx = rng.randint(0, n_samples)
        neighbors = find_k_neighbors(X_minority, idx, k)
        neighbor_idx = neighbors[rng.randint(0, len(neighbors))]
        t = rng.random()
        new_point = X_minority[idx] + t * (X_minority[neighbor_idx] - X_minority[idx])
        synthetic.append(new_point)

    return np.array(synthetic)


def random_oversample(X, y, seed=42):
    rng = np.random.RandomState(seed)
    classes, counts = np.unique(y, return_counts=True)
    max_count = counts.max()

    X_resampled = list(X)
    y_resampled = list(y)

    for cls, count in zip(classes, counts):
        if count < max_count:
            cls_indices = np.where(y == cls)[0]
            n_needed = max_count - count
            chosen = rng.choice(cls_indices, size=n_needed, replace=True)
            X_resampled.extend(X[chosen])
            y_resampled.extend(y[chosen])

    X_out = np.array(X_resampled)
    y_out = np.array(y_resampled)
    shuffle = rng.permutation(len(y_out))
    return X_out[shuffle], y_out[shuffle]


def random_undersample(X, y, seed=42):
    rng = np.random.RandomState(seed)
    classes, counts = np.unique(y, return_counts=True)
    min_count = counts.min()

    X_resampled = []
    y_resampled = []

    for cls in classes:
        cls_indices = np.where(y == cls)[0]
        chosen = rng.choice(cls_indices, size=min_count, replace=False)
        X_resampled.extend(X[chosen])
        y_resampled.extend(y[chosen])

    X_out = np.array(X_resampled)
    y_out = np.array(y_resampled)
    shuffle = rng.permutation(len(y_out))
    return X_out[shuffle], y_out[shuffle]


def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-np.clip(z, -500, 500)))


def logistic_regression_weighted(X, y, weights, lr=0.01, epochs=200):
    n_samples, n_features = X.shape
    w = np.zeros(n_features)
    b = 0.0

    for _ in range(epochs):
        z = X @ w + b
        pred = sigmoid(z)
        error = pred - y
        weighted_error = error * weights

        gradient_w = (X.T @ weighted_error) / n_samples
        gradient_b = np.mean(weighted_error)

        w -= lr * gradient_w
        b -= lr * gradient_b

    return w, b


def compute_class_weights(y):
    classes, counts = np.unique(y, return_counts=True)
    n_samples = len(y)
    n_classes = len(classes)
    weight_map = {}
    for cls, count in zip(classes, counts):
        weight_map[cls] = n_samples / (n_classes * count)
    return np.array([weight_map[yi] for yi in y])


def class_weighted_loss(y_true, y_pred_probs, weights):
    eps = 1e-15
    y_pred_probs = np.clip(y_pred_probs, eps, 1 - eps)
    loss = -(y_true * np.log(y_pred_probs) + (1 - y_true) * np.log(1 - y_pred_probs))
    return np.mean(loss * weights)


def confusion_matrix_values(y_true, y_pred):
    tp = int(np.sum((y_pred == 1) & (y_true == 1)))
    tn = int(np.sum((y_pred == 0) & (y_true == 0)))
    fp = int(np.sum((y_pred == 1) & (y_true == 0)))
    fn = int(np.sum((y_pred == 0) & (y_true == 1)))
    return tp, tn, fp, fn


def compute_metrics(y_true, y_pred):
    tp, tn, fp, fn = confusion_matrix_values(y_true, y_pred)
    accuracy = (tp + tn) / (tp + tn + fp + fn)
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

    denom = np.sqrt(float((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn)))
    mcc = (tp * tn - fp * fn) / denom if denom > 0 else 0.0

    return {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "mcc": mcc,
    }


def find_optimal_threshold(y_true, y_probs, metric="f1"):
    best_threshold = 0.5
    best_score = -1.0

    for threshold in np.arange(0.05, 0.96, 0.01):
        y_pred = (y_probs >= threshold).astype(int)
        tp = np.sum((y_pred == 1) & (y_true == 1))
        fp = np.sum((y_pred == 1) & (y_true == 0))
        fn = np.sum((y_pred == 0) & (y_true == 1))

        if metric == "f1":
            prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
            rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
            score = 2 * prec * rec / (prec + rec) if (prec + rec) > 0 else 0.0
        elif metric == "recall":
            score = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        elif metric == "precision":
            score = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        else:
            score = 0.0

        if score > best_score:
            best_score = score
            best_threshold = threshold

    return best_threshold, best_score


def print_confusion_matrix(y_true, y_pred, label=""):
    tp, tn, fp, fn = confusion_matrix_values(y_true, y_pred)
    print(f"  {label}")
    print(f"                  Predicted +  Predicted -")
    print(f"    Actual +       {tp:>5}        {fn:>5}")
    print(f"    Actual -       {fp:>5}        {tn:>5}")


def print_metrics(metrics, label=""):
    print(f"  {label}")
    print(f"    Accuracy:  {metrics['accuracy']:.4f}")
    print(f"    Precision: {metrics['precision']:.4f}")
    print(f"    Recall:    {metrics['recall']:.4f}")
    print(f"    F1:        {metrics['f1']:.4f}")
    print(f"    MCC:       {metrics['mcc']:.4f}")


if __name__ == "__main__":
    print("=" * 60)
    print("IMBALANCED DATA HANDLING")
    print("=" * 60)

    X, y = make_imbalanced_data(950, 50, seed=42)
    n_pos = int(np.sum(y == 1))
    n_neg = int(np.sum(y == 0))
    print(f"\nDataset: {len(y)} samples, {n_pos} positive ({n_pos/len(y)*100:.1f}%), {n_neg} negative ({n_neg/len(y)*100:.1f}%)")

    split = int(0.8 * len(y))
    X_train, X_test = X[:split], X[split:]
    y_train, y_test = y[:split], y[split:]
    print(f"Train: {len(y_train)} samples, Test: {len(y_test)} samples")
    print(f"Train positives: {int(np.sum(y_train == 1))}, Test positives: {int(np.sum(y_test == 1))}")

    print("\n" + "-" * 60)
    print("1. ALWAYS PREDICT MAJORITY (BASELINE)")
    print("-" * 60)
    preds_majority = np.zeros_like(y_test)
    metrics_majority = compute_metrics(y_test, preds_majority)
    print_confusion_matrix(y_test, preds_majority, "Always predict negative:")
    print_metrics(metrics_majority, "Metrics:")

    print("\n" + "-" * 60)
    print("2. NO TREATMENT (PLAIN LOGISTIC REGRESSION)")
    print("-" * 60)
    w_base, b_base = logistic_regression_weighted(
        X_train, y_train, np.ones(len(y_train)), lr=0.1, epochs=300
    )
    probs_base = sigmoid(X_test @ w_base + b_base)
    preds_base = (probs_base >= 0.5).astype(int)
    metrics_base = compute_metrics(y_test, preds_base)
    print_confusion_matrix(y_test, preds_base, "Default threshold (0.5):")
    print_metrics(metrics_base, "Metrics:")

    print("\n" + "-" * 60)
    print("3. RANDOM OVERSAMPLING")
    print("-" * 60)
    X_over, y_over = random_oversample(X_train, y_train)
    print(f"  After oversampling: {len(y_over)} samples (was {len(y_train)})")
    print(f"  Positive: {int(np.sum(y_over == 1))}, Negative: {int(np.sum(y_over == 0))}")
    w_over, b_over = logistic_regression_weighted(
        X_over, y_over, np.ones(len(y_over)), lr=0.1, epochs=300
    )
    preds_over = (sigmoid(X_test @ w_over + b_over) >= 0.5).astype(int)
    metrics_over = compute_metrics(y_test, preds_over)
    print_confusion_matrix(y_test, preds_over, "Oversampled model:")
    print_metrics(metrics_over, "Metrics:")

    print("\n" + "-" * 60)
    print("4. RANDOM UNDERSAMPLING")
    print("-" * 60)
    X_under, y_under = random_undersample(X_train, y_train)
    print(f"  After undersampling: {len(y_under)} samples (was {len(y_train)})")
    print(f"  Positive: {int(np.sum(y_under == 1))}, Negative: {int(np.sum(y_under == 0))}")
    w_under, b_under = logistic_regression_weighted(
        X_under, y_under, np.ones(len(y_under)), lr=0.1, epochs=300
    )
    preds_under = (sigmoid(X_test @ w_under + b_under) >= 0.5).astype(int)
    metrics_under = compute_metrics(y_test, preds_under)
    print_confusion_matrix(y_test, preds_under, "Undersampled model:")
    print_metrics(metrics_under, "Metrics:")

    print("\n" + "-" * 60)
    print("5. SMOTE")
    print("-" * 60)
    minority_mask = y_train == 1
    X_minority = X_train[minority_mask]
    n_majority_train = int(np.sum(y_train == 0))
    n_minority_train = int(np.sum(y_train == 1))
    n_synthetic_needed = n_majority_train - n_minority_train
    synthetic = smote(X_minority, k=5, n_synthetic=n_synthetic_needed, seed=42)
    X_smote = np.vstack([X_train, synthetic])
    y_smote = np.concatenate([y_train, np.ones(len(synthetic))])
    print(f"  Generated {len(synthetic)} synthetic minority samples")
    print(f"  After SMOTE: {len(y_smote)} samples, Positive: {int(np.sum(y_smote == 1))}, Negative: {int(np.sum(y_smote == 0))}")
    w_sm, b_sm = logistic_regression_weighted(
        X_smote, y_smote, np.ones(len(y_smote)), lr=0.1, epochs=300
    )
    preds_smote = (sigmoid(X_test @ w_sm + b_sm) >= 0.5).astype(int)
    metrics_smote = compute_metrics(y_test, preds_smote)
    print_confusion_matrix(y_test, preds_smote, "SMOTE model:")
    print_metrics(metrics_smote, "Metrics:")

    print("\n" + "-" * 60)
    print("6. CLASS WEIGHTS")
    print("-" * 60)
    sample_weights = compute_class_weights(y_train)
    unique_weights = np.unique(sample_weights)
    print(f"  Weight for negative class: {unique_weights[0]:.4f}")
    print(f"  Weight for positive class: {unique_weights[-1]:.4f}")
    w_cw, b_cw = logistic_regression_weighted(
        X_train, y_train, sample_weights, lr=0.1, epochs=300
    )
    probs_cw = sigmoid(X_test @ w_cw + b_cw)
    preds_cw = (probs_cw >= 0.5).astype(int)
    metrics_cw = compute_metrics(y_test, preds_cw)
    print_confusion_matrix(y_test, preds_cw, "Class-weighted model:")
    print_metrics(metrics_cw, "Metrics:")

    print("\n" + "-" * 60)
    print("7. THRESHOLD TUNING (on class-weighted model)")
    print("-" * 60)
    val_split = int(0.75 * len(y_train))
    X_tr, X_val = X_train[:val_split], X_train[val_split:]
    y_tr, y_val = y_train[:val_split], y_train[val_split:]
    val_weights = compute_class_weights(y_tr)
    w_val, b_val = logistic_regression_weighted(X_tr, y_tr, val_weights, lr=0.1, epochs=300)
    probs_val = sigmoid(X_val @ w_val + b_val)
    best_thresh, best_f1 = find_optimal_threshold(y_val, probs_val, metric="f1")
    print(f"  Optimal threshold: {best_thresh:.2f} (F1 on val: {best_f1:.4f})")
    preds_thresh = (probs_cw >= best_thresh).astype(int)
    metrics_thresh = compute_metrics(y_test, preds_thresh)
    print_confusion_matrix(y_test, preds_thresh, f"Threshold = {best_thresh:.2f}:")
    print_metrics(metrics_thresh, "Metrics:")

    print("\n" + "-" * 60)
    print("8. WEIGHTED CROSS-ENTROPY LOSS COMPARISON")
    print("-" * 60)
    probs_train_base = sigmoid(X_train @ w_base + b_base)
    probs_train_cw = sigmoid(X_train @ w_cw + b_cw)
    uniform_weights = np.ones(len(y_train))
    loss_base_uniform = class_weighted_loss(y_train, probs_train_base, uniform_weights)
    loss_base_weighted = class_weighted_loss(y_train, probs_train_base, sample_weights)
    loss_cw_uniform = class_weighted_loss(y_train, probs_train_cw, uniform_weights)
    loss_cw_weighted = class_weighted_loss(y_train, probs_train_cw, sample_weights)
    print(f"  Base model, uniform loss:   {loss_base_uniform:.4f}")
    print(f"  Base model, weighted loss:  {loss_base_weighted:.4f}")
    print(f"  CW model, uniform loss:     {loss_cw_uniform:.4f}")
    print(f"  CW model, weighted loss:    {loss_cw_weighted:.4f}")

    print("\n" + "=" * 60)
    print("SUMMARY COMPARISON")
    print("=" * 60)
    approaches = [
        ("Always majority", metrics_majority),
        ("No treatment", metrics_base),
        ("Oversampling", metrics_over),
        ("Undersampling", metrics_under),
        ("SMOTE", metrics_smote),
        ("Class weights", metrics_cw),
        ("CW + threshold", metrics_thresh),
    ]
    print(f"\n  {'Approach':<18} {'Acc':>6} {'Prec':>6} {'Rec':>6} {'F1':>6} {'MCC':>6}")
    print(f"  {'-'*18} {'-'*6} {'-'*6} {'-'*6} {'-'*6} {'-'*6}")
    for name, m in approaches:
        print(f"  {name:<18} {m['accuracy']:>6.3f} {m['precision']:>6.3f} {m['recall']:>6.3f} {m['f1']:>6.3f} {m['mcc']:>6.3f}")

    print("\nDone.")
