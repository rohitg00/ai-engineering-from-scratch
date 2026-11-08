// Lesson: Linear Regression (phase 02 / lesson 02)
// Rust port of code/linear_regression.py. Standard library only.
// Source: phases/02-ml-fundamentals/02-linear-regression/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

const TRUE_W: f64 = 3.0;
const TRUE_B: f64 = 7.0;
const N_SAMPLES: usize = 100;

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

    fn uniform(&mut self, low: f64, high: f64) -> f64 {
        low + (high - low) * self.random()
    }

    fn randint(&mut self, low: i64, high: i64) -> i64 {
        let span = (high - low + 1) as f64;
        low + (self.random() * span) as i64
    }

    fn gauss(&mut self, mean: f64, std_dev: f64) -> f64 {
        let u1 = 1.0 - self.random();
        let u2 = self.random();
        let radius = (-2.0 * u1.ln()).sqrt();
        let angle = 2.0 * std::f64::consts::PI * u2;
        mean + std_dev * radius * angle.cos()
    }
}

fn py_round(value: f64, digits: usize) -> f64 {
    format!("{:.*}", digits, value).parse().unwrap()
}

fn py_float(value: f64) -> String {
    if value.fract() == 0.0 {
        format!("{:.1}", value)
    } else {
        format!("{}", value)
    }
}

fn py_list(values: &[f64], digits: usize) -> String {
    let parts: Vec<String> = values
        .iter()
        .map(|v| py_float(py_round(*v, digits)))
        .collect();
    format!("[{}]", parts.join(", "))
}

fn mean(values: &[f64]) -> f64 {
    values.iter().sum::<f64>() / values.len() as f64
}

fn r_squared_from(predictions: &[f64], y: &[f64]) -> f64 {
    let y_mean = mean(y);
    let mut ss_res = 0.0;
    let mut ss_tot = 0.0;
    for i in 0..y.len() {
        ss_res += (y[i] - predictions[i]).powi(2);
        ss_tot += (y[i] - y_mean).powi(2);
    }
    1.0 - ss_res / ss_tot
}

struct LinearRegression {
    w: f64,
    b: f64,
    lr: f64,
    cost_history: Vec<f64>,
}

impl LinearRegression {
    fn new(learning_rate: f64) -> Self {
        LinearRegression {
            w: 0.0,
            b: 0.0,
            lr: learning_rate,
            cost_history: Vec::new(),
        }
    }

    fn predict(&self, x: &[f64]) -> Vec<f64> {
        x.iter().map(|xi| self.w * xi + self.b).collect()
    }

    fn compute_cost(&self, x: &[f64], y: &[f64]) -> f64 {
        let predictions = self.predict(x);
        let n = y.len() as f64;
        let mut total = 0.0;
        for i in 0..y.len() {
            total += (predictions[i] - y[i]).powi(2);
        }
        total / n
    }

    fn compute_gradients(&self, x: &[f64], y: &[f64]) -> (f64, f64) {
        let predictions = self.predict(x);
        let n = y.len() as f64;
        let mut sum_w = 0.0;
        let mut sum_b = 0.0;
        for i in 0..y.len() {
            let error = predictions[i] - y[i];
            sum_w += error * x[i];
            sum_b += error;
        }
        ((2.0 / n) * sum_w, (2.0 / n) * sum_b)
    }

    fn fit(&mut self, x: &[f64], y: &[f64], epochs: usize, print_every: usize) {
        for epoch in 0..epochs {
            let (dw, db) = self.compute_gradients(x, y);
            self.w -= self.lr * dw;
            self.b -= self.lr * db;
            let cost = self.compute_cost(x, y);
            self.cost_history.push(cost);
            if epoch % print_every == 0 {
                println!(
                    "  Epoch {:4} | Cost: {:.4} | w: {:.4} | b: {:.4}",
                    epoch, cost, self.w, self.b
                );
            }
        }
    }

    fn r_squared(&self, x: &[f64], y: &[f64]) -> f64 {
        r_squared_from(&self.predict(x), y)
    }
}

struct LinearRegressionNormal {
    w: f64,
    b: f64,
}

impl LinearRegressionNormal {
    fn new() -> Self {
        LinearRegressionNormal { w: 0.0, b: 0.0 }
    }

    fn fit(&mut self, x: &[f64], y: &[f64]) {
        let x_mean = mean(x);
        let y_mean = mean(y);
        let mut numerator = 0.0;
        let mut denominator = 0.0;
        for i in 0..x.len() {
            numerator += (x[i] - x_mean) * (y[i] - y_mean);
            denominator += (x[i] - x_mean).powi(2);
        }
        self.w = numerator / denominator;
        self.b = y_mean - self.w * x_mean;
    }

    fn predict(&self, x: &[f64]) -> Vec<f64> {
        x.iter().map(|xi| self.w * xi + self.b).collect()
    }

    fn r_squared(&self, x: &[f64], y: &[f64]) -> f64 {
        r_squared_from(&self.predict(x), y)
    }
}

struct MultipleLinearRegression {
    weights: Vec<f64>,
    bias: f64,
    lr: f64,
    cost_history: Vec<f64>,
}

impl MultipleLinearRegression {
    fn new(n_features: usize, learning_rate: f64) -> Self {
        MultipleLinearRegression {
            weights: vec![0.0; n_features],
            bias: 0.0,
            lr: learning_rate,
            cost_history: Vec::new(),
        }
    }

    fn predict_single(&self, x: &[f64]) -> f64 {
        let mut total = 0.0;
        for j in 0..self.weights.len() {
            total += self.weights[j] * x[j];
        }
        total + self.bias
    }

    fn predict(&self, x: &[Vec<f64>]) -> Vec<f64> {
        x.iter().map(|row| self.predict_single(row)).collect()
    }

    fn compute_cost(&self, x: &[Vec<f64>], y: &[f64]) -> f64 {
        let predictions = self.predict(x);
        let mut total = 0.0;
        for i in 0..y.len() {
            total += (predictions[i] - y[i]).powi(2);
        }
        total / y.len() as f64
    }

    fn fit(&mut self, x: &[Vec<f64>], y: &[f64], epochs: usize, print_every: usize) {
        let n = y.len();
        let n_features = x[0].len();
        for epoch in 0..epochs {
            let predictions = self.predict(x);
            let errors: Vec<f64> = (0..n).map(|i| predictions[i] - y[i]).collect();
            for j in 0..n_features {
                let mut total = 0.0;
                for i in 0..n {
                    total += errors[i] * x[i][j];
                }
                let grad = (2.0 / n as f64) * total;
                self.weights[j] -= self.lr * grad;
            }
            let grad_b = (2.0 / n as f64) * errors.iter().sum::<f64>();
            self.bias -= self.lr * grad_b;
            let cost = self.compute_cost(x, y);
            self.cost_history.push(cost);
            if epoch % print_every == 0 {
                println!("  Epoch {:4} | Cost: {:.4}", epoch, cost);
            }
        }
    }

    fn r_squared(&self, x: &[Vec<f64>], y: &[f64]) -> f64 {
        r_squared_from(&self.predict(x), y)
    }
}

fn standardize(x: &[Vec<f64>]) -> (Vec<Vec<f64>>, Vec<f64>, Vec<f64>) {
    let n_features = x[0].len();
    let n_samples = x.len();
    let mut means = Vec::new();
    for j in 0..n_features {
        let column: Vec<f64> = (0..n_samples).map(|i| x[i][j]).collect();
        means.push(mean(&column));
    }
    let mut stds = Vec::new();
    for j in 0..n_features {
        let mut variance = 0.0;
        for row in x {
            variance += (row[j] - means[j]).powi(2);
        }
        variance /= n_samples as f64;
        stds.push(variance.sqrt());
    }
    let mut x_scaled = Vec::new();
    for row in x {
        let mut scaled_row = Vec::new();
        for j in 0..n_features {
            if stds[j] > 0.0 {
                scaled_row.push((row[j] - means[j]) / stds[j]);
            } else {
                scaled_row.push(0.0);
            }
        }
        x_scaled.push(scaled_row);
    }
    (x_scaled, means, stds)
}

struct PolynomialRegression {
    degree: usize,
    weights: Vec<f64>,
    bias: f64,
    lr: f64,
}

impl PolynomialRegression {
    fn new(degree: usize, learning_rate: f64) -> Self {
        PolynomialRegression {
            degree,
            weights: vec![0.0; degree],
            bias: 0.0,
            lr: learning_rate,
        }
    }

    fn make_features(&self, x: &[f64]) -> Vec<Vec<f64>> {
        x.iter()
            .map(|xi| (0..self.degree).map(|d| xi.powi(d as i32 + 1)).collect())
            .collect()
    }

    fn predict_row(&self, row: &[f64]) -> f64 {
        let mut total = 0.0;
        for j in 0..self.degree {
            total += self.weights[j] * row[j];
        }
        total + self.bias
    }

    fn predict(&self, x: &[f64]) -> Vec<f64> {
        let features = self.make_features(x);
        features.iter().map(|row| self.predict_row(row)).collect()
    }

    fn fit(&mut self, x: &[f64], y: &[f64], epochs: usize, print_every: usize) {
        let features = self.make_features(x);
        let n = y.len();
        for epoch in 0..epochs {
            let predictions: Vec<f64> = features.iter().map(|row| self.predict_row(row)).collect();
            let errors: Vec<f64> = (0..n).map(|i| predictions[i] - y[i]).collect();
            for j in 0..self.degree {
                let mut total = 0.0;
                for i in 0..n {
                    total += errors[i] * features[i][j];
                }
                let grad = (2.0 / n as f64) * total;
                self.weights[j] -= self.lr * grad;
            }
            let grad_b = (2.0 / n as f64) * errors.iter().sum::<f64>();
            self.bias -= self.lr * grad_b;
            if epoch % print_every == 0 {
                let cost = errors.iter().map(|e| e * e).sum::<f64>() / n as f64;
                println!("  Epoch {:4} | Cost: {:.6}", epoch, cost);
            }
        }
    }

    fn r_squared(&self, x: &[f64], y: &[f64]) -> f64 {
        r_squared_from(&self.predict(x), y)
    }
}

struct RidgeRegression {
    weights: Vec<f64>,
    bias: f64,
    lr: f64,
    alpha: f64,
}

impl RidgeRegression {
    fn new(n_features: usize, learning_rate: f64, alpha: f64) -> Self {
        RidgeRegression {
            weights: vec![0.0; n_features],
            bias: 0.0,
            lr: learning_rate,
            alpha,
        }
    }

    fn predict_single(&self, x: &[f64]) -> f64 {
        let mut total = 0.0;
        for j in 0..self.weights.len() {
            total += self.weights[j] * x[j];
        }
        total + self.bias
    }

    fn predict(&self, x: &[Vec<f64>]) -> Vec<f64> {
        x.iter().map(|row| self.predict_single(row)).collect()
    }

    fn fit(&mut self, x: &[Vec<f64>], y: &[f64], epochs: usize, print_every: usize) {
        let n = y.len();
        let n_features = x[0].len();
        for epoch in 0..epochs {
            let predictions = self.predict(x);
            let errors: Vec<f64> = (0..n).map(|i| predictions[i] - y[i]).collect();
            let mse = errors.iter().map(|e| e * e).sum::<f64>() / n as f64;
            let reg_term = self.alpha * self.weights.iter().map(|w| w * w).sum::<f64>();
            let cost = mse + reg_term;
            for j in 0..n_features {
                let mut total = 0.0;
                for i in 0..n {
                    total += errors[i] * x[i][j];
                }
                let mut grad = (2.0 / n as f64) * total;
                grad += 2.0 * self.alpha * self.weights[j];
                self.weights[j] -= self.lr * grad;
            }
            let grad_b = (2.0 / n as f64) * errors.iter().sum::<f64>();
            self.bias -= self.lr * grad_b;
            if epoch % print_every == 0 {
                println!(
                    "  Epoch {:4} | Cost: {:.4} | L2 penalty: {:.4}",
                    epoch, cost, reg_term
                );
            }
        }
    }
}

fn main() {
    let mut rng = Rng::new(42);
    let x: Vec<f64> = (0..N_SAMPLES).map(|_| rng.uniform(0.0, 10.0)).collect();
    let y: Vec<f64> = x
        .iter()
        .map(|xi| TRUE_W * xi + TRUE_B + rng.gauss(0.0, 2.0))
        .collect();

    println!("Generated {} samples", N_SAMPLES);
    println!("True relationship: y = {:.1}x + {:.1} (+ noise)", TRUE_W, TRUE_B);
    let first_points: Vec<String> = (0..5)
        .map(|i| format!("({}, {})", py_float(py_round(x[i], 2)), py_float(py_round(y[i], 2))))
        .collect();
    println!("First 5 points: [{}]", first_points.join(", "));

    println!("\n=== Training Linear Regression (Gradient Descent) ===");
    let mut model = LinearRegression::new(0.005);
    model.fit(&x, &y, 1000, 200);
    println!("\nLearned: y = {:.4}x + {:.4}", model.w, model.b);
    println!("True:    y = {:.1}x + {:.1}", TRUE_W, TRUE_B);
    println!("R-squared: {:.4}", model.r_squared(&x, &y));

    println!("\n=== Normal Equation (Closed-Form) ===");
    let mut model_normal = LinearRegressionNormal::new();
    model_normal.fit(&x, &y);
    println!("Learned: y = {:.4}x + {:.4}", model_normal.w, model_normal.b);
    println!("R-squared: {:.4}", model_normal.r_squared(&x, &y));

    let mut rng = Rng::new(42);
    let n = 100;
    let mut x_multi: Vec<Vec<f64>> = Vec::new();
    let mut y_multi: Vec<f64> = Vec::new();
    for _ in 0..n {
        let size = rng.uniform(500.0, 3000.0);
        let bedrooms = rng.randint(1, 5) as f64;
        let age = rng.uniform(0.0, 50.0);
        let price = 50.0 * size + 10000.0 * bedrooms - 1000.0 * age + 50000.0 + rng.gauss(0.0, 20000.0);
        x_multi.push(vec![size, bedrooms, age]);
        y_multi.push(price);
    }

    let y_mean_val = mean(&y_multi);
    let y_std_val = (y_multi.iter().map(|yi| (yi - y_mean_val).powi(2)).sum::<f64>()
        / y_multi.len() as f64)
        .sqrt();
    let y_scaled: Vec<f64> = y_multi.iter().map(|yi| (yi - y_mean_val) / y_std_val).collect();

    let (x_scaled, _x_means, _x_stds) = standardize(&x_multi);

    println!("\n=== Multiple Linear Regression (3 features) ===");
    println!("Features: house size, bedrooms, age");
    let mut multi_model = MultipleLinearRegression::new(3, 0.01);
    multi_model.fit(&x_scaled, &y_scaled, 1000, 200);
    println!("\nWeights (standardized): {}", py_list(&multi_model.weights, 4));
    println!("Bias (standardized): {:.4}", multi_model.bias);
    println!("R-squared: {:.4}", multi_model.r_squared(&x_scaled, &y_scaled));

    let mut rng = Rng::new(42);
    let x_poly: Vec<f64> = (0..50).map(|i| i as f64 / 10.0).collect();
    let y_poly: Vec<f64> = x_poly
        .iter()
        .map(|xi| 0.5 * xi.powi(2) - 2.0 * xi + 3.0 + rng.gauss(0.0, 1.0))
        .collect();

    let x_max = x_poly.iter().fold(0.0_f64, |best, xi| best.max(xi.abs()));
    let x_poly_norm: Vec<f64> = x_poly.iter().map(|xi| xi / x_max).collect();
    let y_poly_mean = mean(&y_poly);
    let y_poly_std = (y_poly.iter().map(|yi| (yi - y_poly_mean).powi(2)).sum::<f64>()
        / y_poly.len() as f64)
        .sqrt();
    let y_poly_norm: Vec<f64> = y_poly.iter().map(|yi| (yi - y_poly_mean) / y_poly_std).collect();

    println!("\n=== Polynomial Regression ===");
    println!("True relationship: y = 0.5x^2 - 2x + 3");

    println!("\nDegree 2:");
    let mut poly2 = PolynomialRegression::new(2, 0.1);
    poly2.fit(&x_poly_norm, &y_poly_norm, 2000, 500);
    println!("  R-squared: {:.4}", poly2.r_squared(&x_poly_norm, &y_poly_norm));

    println!("\nDegree 5:");
    let mut poly5 = PolynomialRegression::new(5, 0.1);
    poly5.fit(&x_poly_norm, &y_poly_norm, 2000, 500);
    println!("  R-squared: {:.4}", poly5.r_squared(&x_poly_norm, &y_poly_norm));

    println!("\n=== Ridge Regression (L2 Regularization) ===");
    println!("Same data as multiple regression, alpha=0.1");
    let mut ridge = RidgeRegression::new(3, 0.01, 0.1);
    ridge.fit(&x_scaled, &y_scaled, 1000, 200);
    println!("\nRidge weights: {}", py_list(&ridge.weights, 4));
    println!("Plain weights: {}", py_list(&multi_model.weights, 4));
    println!("Ridge weights are smaller due to the L2 penalty.");

    println!("\n=== Train/Test Split Comparison ===");
    let split_idx = (0.8 * x.len() as f64) as usize;
    let (x_train, x_test) = x.split_at(split_idx);
    let (y_train, y_test) = y.split_at(split_idx);

    let mut model_split = LinearRegression::new(0.005);
    model_split.fit(x_train, y_train, 1000, 500);
    println!("\nTrain R-squared: {:.4}", model_split.r_squared(x_train, y_train));
    println!("Test R-squared:  {:.4}", model_split.r_squared(x_test, y_test));
    println!("Learned: y = {:.4}x + {:.4}", model_split.w, model_split.b);
    println!("True:    y = {:.1}x + {:.1}", TRUE_W, TRUE_B);

    println!("\n=== Scikit-learn Comparison ===");
    println!("scikit-learn is a Python library. Run linear_regression.py to see this comparison.");
    println!("The from-scratch implementations above work without any dependencies.");
}
