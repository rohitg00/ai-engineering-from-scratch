use std::f64::consts::PI;

struct XorShift64 {
    state: u64,
}

impl XorShift64 {
    fn new(seed: u64) -> Self {
        XorShift64 {
            state: if seed == 0 { 1 } else { seed },
        }
    }

    fn next_u64(&mut self) -> u64 {
        let mut x = self.state;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.state = x;
        x
    }

    fn next_f64(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 / (1u64 << 53) as f64
    }

    fn gauss(&mut self, mu: f64, sigma: f64) -> f64 {
        let u1 = self.next_f64().max(1e-300);
        let u2 = self.next_f64();
        let z = (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos();
        mu + sigma * z
    }

    fn shuffle<T>(&mut self, items: &mut [T]) {
        let n = items.len();
        if n < 2 {
            return;
        }
        for i in (1..n).rev() {
            let j = (self.next_f64() * ((i + 1) as f64)) as usize;
            items.swap(i, j);
        }
    }
}

fn sigmoid(z: f64) -> f64 {
    let z = z.max(-500.0).min(500.0);
    1.0 / (1.0 + (-z).exp())
}

struct LogisticRegression {
    weights: Vec<f64>,
    bias: f64,
    lr: f64,
    loss_history: Vec<f64>,
}

impl LogisticRegression {
    fn new(n_features: usize, learning_rate: f64) -> Self {
        LogisticRegression {
            weights: vec![0.0; n_features],
            bias: 0.0,
            lr: learning_rate,
            loss_history: Vec::new(),
        }
    }

    fn predict_proba(&self, x: &[f64]) -> f64 {
        let z: f64 = self.weights.iter().zip(x).map(|(w, xi)| w * xi).sum::<f64>() + self.bias;
        sigmoid(z)
    }

    fn predict(&self, x: &[f64], threshold: f64) -> u32 {
        if self.predict_proba(x) >= threshold { 1 } else { 0 }
    }

    fn compute_loss(&self, x: &[Vec<f64>], y: &[u32]) -> f64 {
        let n = y.len();
        let mut total = 0.0;
        for i in 0..n {
            let mut p = self.predict_proba(&x[i]);
            p = p.max(1e-15).min(1.0 - 1e-15);
            let yi = y[i] as f64;
            total += yi * p.ln() + (1.0 - yi) * (1.0 - p).ln();
        }
        -total / n as f64
    }

    fn fit(&mut self, x: &[Vec<f64>], y: &[u32], epochs: usize, print_every: usize) {
        let n = y.len();
        let n_features = x[0].len();
        for epoch in 0..epochs {
            let mut dw = vec![0.0; n_features];
            let mut db = 0.0;
            for i in 0..n {
                let p = self.predict_proba(&x[i]);
                let error = p - y[i] as f64;
                for j in 0..n_features {
                    dw[j] += error * x[i][j];
                }
                db += error;
            }
            for j in 0..n_features {
                self.weights[j] -= self.lr * (dw[j] / n as f64);
            }
            self.bias -= self.lr * (db / n as f64);
            let loss = self.compute_loss(x, y);
            self.loss_history.push(loss);
            if epoch % print_every == 0 {
                println!(
                    "  Epoch {:>4} | Loss: {:.4} | w: [{:.3}, {:.3}] | b: {:.3}",
                    epoch, loss, self.weights[0], self.weights[1], self.bias
                );
            }
        }
    }

    fn accuracy(&self, x: &[Vec<f64>], y: &[u32]) -> f64 {
        let correct = (0..y.len())
            .filter(|&i| self.predict(&x[i], 0.5) == y[i])
            .count();
        correct as f64 / y.len() as f64
    }
}

struct ClassificationMetrics {
    tp: u32,
    tn: u32,
    fp: u32,
    fn_: u32,
}

impl ClassificationMetrics {
    fn new(y_true: &[u32], y_pred: &[u32]) -> Self {
        let mut tp = 0;
        let mut tn = 0;
        let mut fp = 0;
        let mut fn_ = 0;
        for (t, p) in y_true.iter().zip(y_pred) {
            match (*t, *p) {
                (1, 1) => tp += 1,
                (0, 0) => tn += 1,
                (0, 1) => fp += 1,
                (1, 0) => fn_ += 1,
                _ => {}
            }
        }
        ClassificationMetrics { tp, tn, fp, fn_ }
    }

    fn accuracy(&self) -> f64 {
        let total = self.tp + self.tn + self.fp + self.fn_;
        if total > 0 {
            (self.tp + self.tn) as f64 / total as f64
        } else {
            0.0
        }
    }

    fn precision(&self) -> f64 {
        let denom = self.tp + self.fp;
        if denom > 0 { self.tp as f64 / denom as f64 } else { 0.0 }
    }

    fn recall(&self) -> f64 {
        let denom = self.tp + self.fn_;
        if denom > 0 { self.tp as f64 / denom as f64 } else { 0.0 }
    }

    fn f1(&self) -> f64 {
        let p = self.precision();
        let r = self.recall();
        if p + r > 0.0 { 2.0 * p * r / (p + r) } else { 0.0 }
    }

    fn print_confusion_matrix(&self) {
        println!("\n  Confusion Matrix:");
        println!("                  Predicted");
        println!("                  Pos   Neg");
        println!("  Actual Pos     {:>4}  {:>4}", self.tp, self.fn_);
        println!("  Actual Neg     {:>4}  {:>4}", self.fp, self.tn);
    }

    fn print_report(&self) {
        self.print_confusion_matrix();
        println!("\n  Accuracy:  {:.4}", self.accuracy());
        println!("  Precision: {:.4}", self.precision());
        println!("  Recall:    {:.4}", self.recall());
        println!("  F1 Score:  {:.4}", self.f1());
    }
}

struct SoftmaxRegression {
    n_features: usize,
    n_classes: usize,
    lr: f64,
    weights: Vec<Vec<f64>>,
    biases: Vec<f64>,
}

impl SoftmaxRegression {
    fn new(n_features: usize, n_classes: usize, learning_rate: f64) -> Self {
        SoftmaxRegression {
            n_features,
            n_classes,
            lr: learning_rate,
            weights: vec![vec![0.0; n_features]; n_classes],
            biases: vec![0.0; n_classes],
        }
    }

    fn softmax(&self, scores: &[f64]) -> Vec<f64> {
        let max_score = scores.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        let exp_scores: Vec<f64> = scores.iter().map(|s| (s - max_score).exp()).collect();
        let total: f64 = exp_scores.iter().sum();
        exp_scores.iter().map(|e| e / total).collect()
    }

    fn predict_proba(&self, x: &[f64]) -> Vec<f64> {
        let scores: Vec<f64> = (0..self.n_classes)
            .map(|k| {
                (0..self.n_features)
                    .map(|j| self.weights[k][j] * x[j])
                    .sum::<f64>()
                    + self.biases[k]
            })
            .collect();
        self.softmax(&scores)
    }

    fn predict(&self, x: &[f64]) -> usize {
        let probs = self.predict_proba(x);
        let mut best = 0;
        let mut best_p = probs[0];
        for (i, &p) in probs.iter().enumerate().skip(1) {
            if p > best_p {
                best_p = p;
                best = i;
            }
        }
        best
    }

    fn fit(&mut self, x: &[Vec<f64>], y: &[usize], epochs: usize, print_every: usize) {
        let n = y.len();
        for epoch in 0..epochs {
            let mut grad_w = vec![vec![0.0; self.n_features]; self.n_classes];
            let mut grad_b = vec![0.0; self.n_classes];
            let mut total_loss = 0.0;
            for i in 0..n {
                let probs = self.predict_proba(&x[i]);
                for k in 0..self.n_classes {
                    let target = if y[i] == k { 1.0 } else { 0.0 };
                    let error = probs[k] - target;
                    for j in 0..self.n_features {
                        grad_w[k][j] += error * x[i][j];
                    }
                    grad_b[k] += error;
                }
                let true_prob = probs[y[i]].max(1e-15);
                total_loss -= true_prob.ln();
            }
            for k in 0..self.n_classes {
                for j in 0..self.n_features {
                    self.weights[k][j] -= self.lr * (grad_w[k][j] / n as f64);
                }
                self.biases[k] -= self.lr * (grad_b[k] / n as f64);
            }
            if epoch % print_every == 0 {
                println!("  Epoch {:>4} | Loss: {:.4}", epoch, total_loss / n as f64);
            }
        }
    }

    fn accuracy(&self, x: &[Vec<f64>], y: &[usize]) -> f64 {
        let correct = (0..y.len()).filter(|&i| self.predict(&x[i]) == y[i]).count();
        correct as f64 / y.len() as f64
    }
}

fn main() {
    let mut rng = XorShift64::new(42);

    let n: usize = 200;
    let mut x: Vec<Vec<f64>> = Vec::with_capacity(n);
    let mut y: Vec<u32> = Vec::with_capacity(n);

    for _ in 0..(n / 2) {
        x.push(vec![rng.gauss(2.0, 1.0), rng.gauss(2.0, 1.0)]);
        y.push(0);
    }
    for _ in 0..(n / 2) {
        x.push(vec![rng.gauss(5.0, 1.0), rng.gauss(5.0, 1.0)]);
        y.push(1);
    }

    let mut combined: Vec<(Vec<f64>, u32)> = x.into_iter().zip(y.into_iter()).collect();
    rng.shuffle(&mut combined);
    let (x, y): (Vec<Vec<f64>>, Vec<u32>) = combined.into_iter().unzip();

    println!("Generated {} samples (2 classes, 2 features)", n);
    println!("Class 0 center: (2, 2), Class 1 center: (5, 5)");
    println!("First 5 samples:");
    for i in 0..5 {
        println!(
            "  Features: [{:.2}, {:.2}], Label: {}",
            x[i][0], x[i][1], y[i]
        );
    }

    let split = (0.8 * n as f64) as usize;
    let x_train: Vec<Vec<f64>> = x[..split].to_vec();
    let x_test: Vec<Vec<f64>> = x[split..].to_vec();
    let y_train: Vec<u32> = y[..split].to_vec();
    let y_test: Vec<u32> = y[split..].to_vec();

    println!("\n=== Training Logistic Regression ===");
    let mut model = LogisticRegression::new(2, 0.1);
    model.fit(&x_train, &y_train, 1000, 200);

    println!("\nTrain accuracy: {:.4}", model.accuracy(&x_train, &y_train));
    println!("Test accuracy:  {:.4}", model.accuracy(&x_test, &y_test));
    println!("Weights: [{:.4}, {:.4}]", model.weights[0], model.weights[1]);
    println!("Bias: {:.4}", model.bias);

    let y_pred_test: Vec<u32> = x_test.iter().map(|p| model.predict(p, 0.5)).collect();
    println!("\n=== Classification Report (Test Set) ===");
    let metrics = ClassificationMetrics::new(&y_test, &y_pred_test);
    metrics.print_report();

    println!("\n=== Decision Boundary ===");
    let w1 = model.weights[0];
    let w2 = model.weights[1];
    let b = model.bias;
    println!("Decision boundary: {:.4}*x1 + {:.4}*x2 + {:.4} = 0", w1, w2, b);
    if w2.abs() > 1e-10 {
        println!("Solved for x2:     x2 = {:.4}*x1 + {:.4}", -w1 / w2, -b / w2);
    }

    println!("\nSample predictions near the boundary:");
    let test_points: [[f64; 2]; 5] = [
        [3.0, 3.0],
        [3.5, 3.5],
        [4.0, 4.0],
        [2.5, 2.5],
        [5.0, 5.0],
    ];
    for point in &test_points {
        let prob = model.predict_proba(point);
        let pred = model.predict(point, 0.5);
        println!(
            "  [{:?}, {:?}] -> prob={:.4}, class={}",
            point[0], point[1], prob, pred
        );
    }

    let mut rng = XorShift64::new(42);
    let mut x_3class: Vec<Vec<f64>> = Vec::new();
    let mut y_3class: Vec<usize> = Vec::new();
    let centers: [(f64, f64); 3] = [(1.0, 1.0), (5.0, 1.0), (3.0, 5.0)];
    for (label, &(cx, cy)) in centers.iter().enumerate() {
        for _ in 0..50 {
            x_3class.push(vec![rng.gauss(cx, 0.8), rng.gauss(cy, 0.8)]);
            y_3class.push(label);
        }
    }

    let mut combined3: Vec<(Vec<f64>, usize)> =
        x_3class.into_iter().zip(y_3class.into_iter()).collect();
    rng.shuffle(&mut combined3);
    let (x_3class, y_3class): (Vec<Vec<f64>>, Vec<usize>) = combined3.into_iter().unzip();

    let split_3 = (0.8 * x_3class.len() as f64) as usize;
    let x_train_3: Vec<Vec<f64>> = x_3class[..split_3].to_vec();
    let y_train_3: Vec<usize> = y_3class[..split_3].to_vec();
    let x_test_3: Vec<Vec<f64>> = x_3class[split_3..].to_vec();
    let y_test_3: Vec<usize> = y_3class[split_3..].to_vec();

    println!("\n=== Multi-class Softmax Regression (3 classes) ===");
    let mut softmax_model = SoftmaxRegression::new(2, 3, 0.1);
    softmax_model.fit(&x_train_3, &y_train_3, 1000, 200);
    println!(
        "\nTrain accuracy: {:.4}",
        softmax_model.accuracy(&x_train_3, &y_train_3)
    );
    println!(
        "Test accuracy:  {:.4}",
        softmax_model.accuracy(&x_test_3, &y_test_3)
    );

    println!("\nSample predictions:");
    for i in 0..5 {
        let probs = softmax_model.predict_proba(&x_test_3[i]);
        let pred = softmax_model.predict(&x_test_3[i]);
        let probs_str: Vec<String> = probs.iter().map(|p| format!("{:.3}", p)).collect();
        println!(
            "  True: {}, Predicted: {}, Probs: [{}]",
            y_test_3[i],
            pred,
            probs_str.join(", ")
        );
    }

    println!("\n=== Threshold Tuning ===");
    println!("Default threshold: 0.5. Adjusting trades precision for recall.\n");

    let thresholds = [0.3, 0.4, 0.5, 0.6, 0.7];
    println!(
        "{:>10} {:>10} {:>10} {:>10} {:>10}",
        "Threshold", "Accuracy", "Precision", "Recall", "F1"
    );
    println!("{}", "-".repeat(52));
    for &t in &thresholds {
        let y_pred_t: Vec<u32> = x_test
            .iter()
            .map(|p| if model.predict_proba(p) >= t { 1 } else { 0 })
            .collect();
        let m = ClassificationMetrics::new(&y_test, &y_pred_t);
        println!(
            "{:>10.1} {:>10.4} {:>10.4} {:>10.4} {:>10.4}",
            t,
            m.accuracy(),
            m.precision(),
            m.recall(),
            m.f1()
        );
    }

    println!("\n=== Why Linear Regression Fails for Classification ===");
    println!("Fitting linear regression to binary labels:");
    let x_hours: Vec<f64> = (1..=10).map(|v| v as f64).collect();
    let y_pass: [f64; 10] = [0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];

    let nh = x_hours.len();
    let x_mean: f64 = x_hours.iter().sum::<f64>() / nh as f64;
    let y_mean: f64 = y_pass.iter().sum::<f64>() / nh as f64;
    let numerator: f64 = (0..nh)
        .map(|i| (x_hours[i] - x_mean) * (y_pass[i] - y_mean))
        .sum();
    let denominator: f64 = (0..nh).map(|i| (x_hours[i] - x_mean).powi(2)).sum();
    let w_lin = numerator / denominator;
    let b_lin = y_mean - w_lin * x_mean;

    println!("\nLinear fit: y = {:.4}*x + {:.4}", w_lin, b_lin);
    println!("{:>6} {:>8} {:>8} {:>8}", "Hours", "Actual", "Linear", "Sigmoid");
    for (h, actual) in x_hours.iter().zip(y_pass.iter()) {
        let lin_pred = w_lin * h + b_lin;
        let sig_pred = sigmoid(3.0 * (h - 4.5));
        println!(
            "{:>6} {:>8} {:>8.3} {:>8.3}",
            *h as i64, *actual as i64, lin_pred, sig_pred
        );
    }

    println!("\nLinear regression gives values outside [0, 1].");
    println!("Logistic regression keeps everything in [0, 1] as probabilities.");

    println!("\n=== Scikit-learn Comparison ===");
    println!("Python-only section (requires scikit-learn). See logistic_regression.py.");
}
