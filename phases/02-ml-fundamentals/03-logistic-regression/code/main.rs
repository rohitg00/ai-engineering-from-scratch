// Lesson: Logistic Regression (phase 02 / lesson 03)
// Rust port of code/logistic_regression.py. Standard library only.
// Source: phases/02-ml-fundamentals/03-logistic-regression/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

struct Rng {
    state: u32,
}

impl Rng {
    fn new(seed: u32) -> Self {
        Rng { state: seed }
    }

    fn next_u32(&mut self) -> u32 {
        self.state = self.state.wrapping_add(0x6D2B79F5);
        let mut t = self.state;
        t = (t ^ (t >> 15)).wrapping_mul(t | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        t ^ (t >> 14)
    }

    fn random(&mut self) -> f64 {
        self.next_u32() as f64 / 4294967296.0
    }

    fn below(&mut self, limit: usize) -> usize {
        (self.random() * limit as f64) as usize
    }

    fn gauss(&mut self, mean: f64, std_dev: f64) -> f64 {
        let u1 = 1.0 - self.random();
        let u2 = self.random();
        let radius = (-2.0 * u1.ln()).sqrt();
        let angle = 2.0 * std::f64::consts::PI * u2;
        mean + std_dev * radius * angle.cos()
    }

    fn shuffle<T>(&mut self, items: &mut [T]) {
        for i in (1..items.len()).rev() {
            let j = self.below(i + 1);
            items.swap(i, j);
        }
    }
}

fn py_float(value: f64) -> String {
    if value.fract() == 0.0 {
        format!("{:.1}", value)
    } else {
        format!("{}", value)
    }
}

fn sigmoid(z: f64) -> f64 {
    let z = z.clamp(-500.0, 500.0);
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
        let mut z = 0.0;
        for j in 0..self.weights.len() {
            z += self.weights[j] * x[j];
        }
        sigmoid(z + self.bias)
    }

    fn predict(&self, x: &[f64], threshold: f64) -> usize {
        if self.predict_proba(x) >= threshold {
            1
        } else {
            0
        }
    }

    fn compute_loss(&self, x: &[Vec<f64>], y: &[usize]) -> f64 {
        let n = y.len();
        let mut total = 0.0;
        for i in 0..n {
            let p = self.predict_proba(&x[i]).clamp(1e-15, 1.0 - 1e-15);
            let label = y[i] as f64;
            total += label * p.ln() + (1.0 - label) * (1.0 - p).ln();
        }
        -total / n as f64
    }

    fn fit(&mut self, x: &[Vec<f64>], y: &[usize], epochs: usize, print_every: usize) {
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
                    "  Epoch {:4} | Loss: {:.4} | w: [{:.3}, {:.3}] | b: {:.3}",
                    epoch, loss, self.weights[0], self.weights[1], self.bias
                );
            }
        }
    }

    fn accuracy(&self, x: &[Vec<f64>], y: &[usize]) -> f64 {
        let mut correct = 0;
        for i in 0..y.len() {
            if self.predict(&x[i], 0.5) == y[i] {
                correct += 1;
            }
        }
        correct as f64 / y.len() as f64
    }
}

struct ClassificationMetrics {
    tp: usize,
    tn: usize,
    fp: usize,
    fn_count: usize,
}

impl ClassificationMetrics {
    fn new(y_true: &[usize], y_pred: &[usize]) -> Self {
        let mut metrics = ClassificationMetrics {
            tp: 0,
            tn: 0,
            fp: 0,
            fn_count: 0,
        };
        for i in 0..y_true.len() {
            match (y_true[i], y_pred[i]) {
                (1, 1) => metrics.tp += 1,
                (0, 0) => metrics.tn += 1,
                (0, 1) => metrics.fp += 1,
                (1, 0) => metrics.fn_count += 1,
                _ => {}
            }
        }
        metrics
    }

    fn accuracy(&self) -> f64 {
        let total = self.tp + self.tn + self.fp + self.fn_count;
        if total > 0 {
            (self.tp + self.tn) as f64 / total as f64
        } else {
            0.0
        }
    }

    fn precision(&self) -> f64 {
        let denom = self.tp + self.fp;
        if denom > 0 {
            self.tp as f64 / denom as f64
        } else {
            0.0
        }
    }

    fn recall(&self) -> f64 {
        let denom = self.tp + self.fn_count;
        if denom > 0 {
            self.tp as f64 / denom as f64
        } else {
            0.0
        }
    }

    fn f1(&self) -> f64 {
        let p = self.precision();
        let r = self.recall();
        if p + r > 0.0 {
            2.0 * p * r / (p + r)
        } else {
            0.0
        }
    }

    fn print_confusion_matrix(&self) {
        println!("\n  Confusion Matrix:");
        println!("                  Predicted");
        println!("                  Pos   Neg");
        println!("  Actual Pos     {:4}  {:4}", self.tp, self.fn_count);
        println!("  Actual Neg     {:4}  {:4}", self.fp, self.tn);
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
        let mut scores = Vec::new();
        for k in 0..self.n_classes {
            let mut score = 0.0;
            for j in 0..self.n_features {
                score += self.weights[k][j] * x[j];
            }
            scores.push(score + self.biases[k]);
        }
        self.softmax(&scores)
    }

    fn predict(&self, x: &[f64]) -> usize {
        let probs = self.predict_proba(x);
        let mut best = 0;
        for k in 1..probs.len() {
            if probs[k] > probs[best] {
                best = k;
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
                println!("  Epoch {:4} | Loss: {:.4}", epoch, total_loss / n as f64);
            }
        }
    }

    fn accuracy(&self, x: &[Vec<f64>], y: &[usize]) -> f64 {
        let mut correct = 0;
        for i in 0..y.len() {
            if self.predict(&x[i]) == y[i] {
                correct += 1;
            }
        }
        correct as f64 / y.len() as f64
    }
}

fn main() {
    let mut rng = Rng::new(42);
    let n = 200;
    let mut combined: Vec<(Vec<f64>, usize)> = Vec::new();

    for _ in 0..n / 2 {
        combined.push((vec![rng.gauss(2.0, 1.0), rng.gauss(2.0, 1.0)], 0));
    }

    for _ in 0..n / 2 {
        combined.push((vec![rng.gauss(5.0, 1.0), rng.gauss(5.0, 1.0)], 1));
    }

    rng.shuffle(&mut combined);
    let x: Vec<Vec<f64>> = combined.iter().map(|pair| pair.0.clone()).collect();
    let y: Vec<usize> = combined.iter().map(|pair| pair.1).collect();

    println!("Generated {} samples (2 classes, 2 features)", n);
    println!("Class 0 center: (2, 2), Class 1 center: (5, 5)");
    println!("First 5 samples:");
    for i in 0..5 {
        println!("  Features: [{:.2}, {:.2}], Label: {}", x[i][0], x[i][1], y[i]);
    }

    let split = (0.8 * n as f64) as usize;
    let (x_train, x_test) = x.split_at(split);
    let (y_train, y_test) = y.split_at(split);

    println!("\n=== Training Logistic Regression ===");
    let mut model = LogisticRegression::new(2, 0.1);
    model.fit(x_train, y_train, 1000, 200);

    println!("\nTrain accuracy: {:.4}", model.accuracy(x_train, y_train));
    println!("Test accuracy:  {:.4}", model.accuracy(x_test, y_test));
    println!("Weights: [{:.4}, {:.4}]", model.weights[0], model.weights[1]);
    println!("Bias: {:.4}", model.bias);

    let y_pred_test: Vec<usize> = x_test.iter().map(|point| model.predict(point, 0.5)).collect();
    println!("\n=== Classification Report (Test Set) ===");
    let metrics = ClassificationMetrics::new(y_test, &y_pred_test);
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
    let test_points = [
        [3.0, 3.0],
        [3.5, 3.5],
        [4.0, 4.0],
        [2.5, 2.5],
        [5.0, 5.0],
    ];
    for point in test_points.iter() {
        let prob = model.predict_proba(point);
        let pred = model.predict(point, 0.5);
        println!(
            "  [{}, {}] -> prob={:.4}, class={}",
            py_float(point[0]),
            py_float(point[1]),
            prob,
            pred
        );
    }

    let mut rng = Rng::new(42);
    let mut combined_3: Vec<(Vec<f64>, usize)> = Vec::new();

    let centers = [(1.0, 1.0), (5.0, 1.0), (3.0, 5.0)];
    for (label, (cx, cy)) in centers.iter().enumerate() {
        for _ in 0..50 {
            combined_3.push((vec![rng.gauss(*cx, 0.8), rng.gauss(*cy, 0.8)], label));
        }
    }

    rng.shuffle(&mut combined_3);
    let x_3class: Vec<Vec<f64>> = combined_3.iter().map(|pair| pair.0.clone()).collect();
    let y_3class: Vec<usize> = combined_3.iter().map(|pair| pair.1).collect();

    let split_3 = (0.8 * x_3class.len() as f64) as usize;
    let (x_train_3, x_test_3) = x_3class.split_at(split_3);
    let (y_train_3, y_test_3) = y_3class.split_at(split_3);

    println!("\n=== Multi-class Softmax Regression (3 classes) ===");
    let mut softmax_model = SoftmaxRegression::new(2, 3, 0.1);
    softmax_model.fit(x_train_3, y_train_3, 1000, 200);
    println!("\nTrain accuracy: {:.4}", softmax_model.accuracy(x_train_3, y_train_3));
    println!("Test accuracy:  {:.4}", softmax_model.accuracy(x_test_3, y_test_3));

    println!("\nSample predictions:");
    for i in 0..5 {
        let probs = softmax_model.predict_proba(&x_test_3[i]);
        let pred = softmax_model.predict(&x_test_3[i]);
        let prob_text: Vec<String> = probs.iter().map(|p| format!("{:.3}", p)).collect();
        println!(
            "  True: {}, Predicted: {}, Probs: [{}]",
            y_test_3[i],
            pred,
            prob_text.join(", ")
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

    for t in thresholds.iter() {
        let y_pred_t: Vec<usize> = x_test.iter().map(|point| model.predict(point, *t)).collect();
        let m = ClassificationMetrics::new(y_test, &y_pred_t);
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
    let x_hours: Vec<f64> = (1..=10).map(|h| h as f64).collect();
    let y_pass: Vec<f64> = vec![0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];

    let count = x_hours.len() as f64;
    let x_mean = x_hours.iter().sum::<f64>() / count;
    let y_mean = y_pass.iter().sum::<f64>() / count;
    let mut numerator = 0.0;
    let mut denominator = 0.0;
    for i in 0..x_hours.len() {
        numerator += (x_hours[i] - x_mean) * (y_pass[i] - y_mean);
        denominator += (x_hours[i] - x_mean).powi(2);
    }
    let w_lin = numerator / denominator;
    let b_lin = y_mean - w_lin * x_mean;

    println!("\nLinear fit: y = {:.4}*x + {:.4}", w_lin, b_lin);
    println!("{:>6} {:>8} {:>8} {:>8}", "Hours", "Actual", "Linear", "Sigmoid");
    for i in 0..x_hours.len() {
        let h = x_hours[i];
        let lin_pred = w_lin * h + b_lin;
        let sig_pred = sigmoid(3.0 * (h - 4.5));
        println!(
            "{:>6} {:>8} {:>8.3} {:>8.3}",
            h as i64, y_pass[i] as i64, lin_pred, sig_pred
        );
    }

    println!("\nLinear regression gives values outside [0, 1].");
    println!("Logistic regression keeps everything in [0, 1] as probabilities.");

    println!("\n=== Scikit-learn Comparison ===");
    println!("scikit-learn is a Python library. Run logistic_regression.py to see this comparison.");
    println!("The from-scratch implementations above work without any dependencies.");
}
