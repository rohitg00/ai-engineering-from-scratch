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

    fn uniform(&mut self, low: f64, high: f64) -> f64 {
        low + self.next_f64() * (high - low)
    }

    fn randint(&mut self, low: i64, high: i64) -> i64 {
        low + (self.next_f64() * ((high - low + 1) as f64)) as i64
    }

    fn gauss(&mut self, mu: f64, sigma: f64) -> f64 {
        let u1 = self.next_f64().max(1e-300);
        let u2 = self.next_f64();
        let z = (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos();
        mu + sigma * z
    }
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
        x.iter().map(|&xi| self.w * xi + self.b).collect()
    }

    fn compute_cost(&self, x: &[f64], y: &[f64]) -> f64 {
        let predictions = self.predict(x);
        let n = y.len() as f64;
        predictions
            .iter()
            .zip(y.iter())
            .map(|(p, a)| (p - a).powi(2))
            .sum::<f64>()
            / n
    }

    fn compute_gradients(&self, x: &[f64], y: &[f64]) -> (f64, f64) {
        let predictions = self.predict(x);
        let n = y.len() as f64;
        let dw: f64 = predictions
            .iter()
            .zip(y.iter())
            .zip(x.iter())
            .map(|((p, a), xi)| (p - a) * xi)
            .sum();
        let db: f64 = predictions
            .iter()
            .zip(y.iter())
            .map(|(p, a)| p - a)
            .sum();
        (2.0 / n * dw, 2.0 / n * db)
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
        let predictions = self.predict(x);
        let y_mean: f64 = y.iter().sum::<f64>() / y.len() as f64;
        let ss_res: f64 = y
            .iter()
            .zip(predictions.iter())
            .map(|(a, p)| (a - p).powi(2))
            .sum();
        let ss_tot: f64 = y.iter().map(|a| (a - y_mean).powi(2)).sum();
        1.0 - ss_res / ss_tot
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
        let n = x.len() as f64;
        let x_mean = x.iter().sum::<f64>() / n;
        let y_mean = y.iter().sum::<f64>() / n;
        let numerator: f64 = x
            .iter()
            .zip(y.iter())
            .map(|(xi, yi)| (xi - x_mean) * (yi - y_mean))
            .sum();
        let denominator: f64 = x.iter().map(|xi| (xi - x_mean).powi(2)).sum();
        self.w = numerator / denominator;
        self.b = y_mean - self.w * x_mean;
    }

    fn predict(&self, x: &[f64]) -> Vec<f64> {
        x.iter().map(|&xi| self.w * xi + self.b).collect()
    }

    fn r_squared(&self, x: &[f64], y: &[f64]) -> f64 {
        let predictions = self.predict(x);
        let y_mean: f64 = y.iter().sum::<f64>() / y.len() as f64;
        let ss_res: f64 = y
            .iter()
            .zip(predictions.iter())
            .map(|(a, p)| (a - p).powi(2))
            .sum();
        let ss_tot: f64 = y.iter().map(|a| (a - y_mean).powi(2)).sum();
        1.0 - ss_res / ss_tot
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
        self.weights
            .iter()
            .zip(x.iter())
            .map(|(w, xi)| w * xi)
            .sum::<f64>()
            + self.bias
    }

    fn predict(&self, x: &[Vec<f64>]) -> Vec<f64> {
        x.iter().map(|row| self.predict_single(row)).collect()
    }

    fn compute_cost(&self, x: &[Vec<f64>], y: &[f64]) -> f64 {
        let predictions = self.predict(x);
        let n = y.len() as f64;
        predictions
            .iter()
            .zip(y.iter())
            .map(|(p, a)| (p - a).powi(2))
            .sum::<f64>()
            / n
    }

    fn fit(&mut self, x: &[Vec<f64>], y: &[f64], epochs: usize, print_every: usize) {
        let n = y.len() as f64;
        let n_features = x[0].len();
        for epoch in 0..epochs {
            let predictions = self.predict(x);
            let errors: Vec<f64> = predictions
                .iter()
                .zip(y.iter())
                .map(|(p, a)| p - a)
                .collect();
            for j in 0..n_features {
                let grad: f64 = errors
                    .iter()
                    .enumerate()
                    .map(|(i, e)| e * x[i][j])
                    .sum();
                self.weights[j] -= self.lr * (2.0 / n) * grad;
            }
            let grad_b: f64 = errors.iter().sum();
            self.bias -= self.lr * (2.0 / n) * grad_b;
            let cost = self.compute_cost(x, y);
            self.cost_history.push(cost);
            if epoch % print_every == 0 {
                println!("  Epoch {:4} | Cost: {:.4}", epoch, cost);
            }
        }
    }

    fn r_squared(&self, x: &[Vec<f64>], y: &[f64]) -> f64 {
        let predictions = self.predict(x);
        let y_mean: f64 = y.iter().sum::<f64>() / y.len() as f64;
        let ss_res: f64 = y
            .iter()
            .zip(predictions.iter())
            .map(|(a, p)| (a - p).powi(2))
            .sum();
        let ss_tot: f64 = y.iter().map(|a| (a - y_mean).powi(2)).sum();
        1.0 - ss_res / ss_tot
    }
}

fn standardize(x: &[Vec<f64>]) -> (Vec<Vec<f64>>, Vec<f64>, Vec<f64>) {
    let n_samples = x.len();
    let n_features = x[0].len();
    let means: Vec<f64> = (0..n_features)
        .map(|j| (0..n_samples).map(|i| x[i][j]).sum::<f64>() / n_samples as f64)
        .collect();
    let stds: Vec<f64> = (0..n_features)
        .map(|j| {
            let var = (0..n_samples)
                .map(|i| (x[i][j] - means[j]).powi(2))
                .sum::<f64>()
                / n_samples as f64;
            var.sqrt()
        })
        .collect();
    let scaled: Vec<Vec<f64>> = (0..n_samples)
        .map(|i| {
            (0..n_features)
                .map(|j| {
                    if stds[j] > 0.0 {
                        (x[i][j] - means[j]) / stds[j]
                    } else {
                        0.0
                    }
                })
                .collect()
        })
        .collect();
    (scaled, means, stds)
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
            .map(|&xi| (0..self.degree).map(|d| xi.powi((d + 1) as i32)).collect())
            .collect()
    }

    fn predict_from_features(&self, features: &[Vec<f64>]) -> Vec<f64> {
        features
            .iter()
            .map(|row| {
                row.iter()
                    .zip(self.weights.iter())
                    .map(|(f, w)| w * f)
                    .sum::<f64>()
                    + self.bias
            })
            .collect()
    }

    fn predict(&self, x: &[f64]) -> Vec<f64> {
        let features = self.make_features(x);
        self.predict_from_features(&features)
    }

    fn fit(&mut self, x: &[f64], y: &[f64], epochs: usize, print_every: usize) {
        let features = self.make_features(x);
        let n = y.len() as f64;
        for epoch in 0..epochs {
            let predictions = self.predict_from_features(&features);
            let errors: Vec<f64> = predictions
                .iter()
                .zip(y.iter())
                .map(|(p, a)| p - a)
                .collect();
            for j in 0..self.degree {
                let grad: f64 = errors
                    .iter()
                    .enumerate()
                    .map(|(i, e)| e * features[i][j])
                    .sum();
                self.weights[j] -= self.lr * (2.0 / n) * grad;
            }
            let grad_b: f64 = errors.iter().sum();
            self.bias -= self.lr * (2.0 / n) * grad_b;
            if epoch % print_every == 0 {
                let cost: f64 = errors.iter().map(|e| e.powi(2)).sum::<f64>() / n;
                println!("  Epoch {:4} | Cost: {:.6}", epoch, cost);
            }
        }
    }

    fn r_squared(&self, x: &[f64], y: &[f64]) -> f64 {
        let predictions = self.predict(x);
        let y_mean: f64 = y.iter().sum::<f64>() / y.len() as f64;
        let ss_res: f64 = y
            .iter()
            .zip(predictions.iter())
            .map(|(a, p)| (a - p).powi(2))
            .sum();
        let ss_tot: f64 = y.iter().map(|a| (a - y_mean).powi(2)).sum();
        1.0 - ss_res / ss_tot
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
        self.weights
            .iter()
            .zip(x.iter())
            .map(|(w, xi)| w * xi)
            .sum::<f64>()
            + self.bias
    }

    fn predict(&self, x: &[Vec<f64>]) -> Vec<f64> {
        x.iter().map(|row| self.predict_single(row)).collect()
    }

    fn fit(&mut self, x: &[Vec<f64>], y: &[f64], epochs: usize, print_every: usize) {
        let n = y.len() as f64;
        let n_features = x[0].len();
        for epoch in 0..epochs {
            let predictions = self.predict(x);
            let errors: Vec<f64> = predictions
                .iter()
                .zip(y.iter())
                .map(|(p, a)| p - a)
                .collect();
            let mse: f64 = errors.iter().map(|e| e.powi(2)).sum::<f64>() / n;
            let reg_term: f64 = self.alpha * self.weights.iter().map(|w| w * w).sum::<f64>();
            let cost = mse + reg_term;
            for j in 0..n_features {
                let mut grad: f64 = (2.0 / n)
                    * errors
                        .iter()
                        .enumerate()
                        .map(|(i, e)| e * x[i][j])
                        .sum::<f64>();
                grad += 2.0 * self.alpha * self.weights[j];
                self.weights[j] -= self.lr * grad;
            }
            let grad_b: f64 = (2.0 / n) * errors.iter().sum::<f64>();
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

fn fmt_round_vec(v: &[f64], precision: usize) -> String {
    let items: Vec<String> = v
        .iter()
        .map(|x| format!("{:.*}", precision, x))
        .collect();
    format!("[{}]", items.join(", "))
}

fn main() {
    const TRUE_W: f64 = 3.0;
    const TRUE_B: f64 = 7.0;
    const N_SAMPLES: usize = 100;

    let mut rng = XorShift64::new(42);
    let x: Vec<f64> = (0..N_SAMPLES).map(|_| rng.uniform(0.0, 10.0)).collect();
    let y: Vec<f64> = x
        .iter()
        .map(|xi| TRUE_W * xi + TRUE_B + rng.gauss(0.0, 2.0))
        .collect();

    println!("Generated {} samples", N_SAMPLES);
    println!("True relationship: y = {}x + {} (+ noise)", TRUE_W, TRUE_B);
    let preview: Vec<String> = (0..5)
        .map(|i| format!("({:.2}, {:.2})", x[i], y[i]))
        .collect();
    println!("First 5 points: [{}]", preview.join(", "));

    println!("\n=== Training Linear Regression (Gradient Descent) ===");
    let mut model = LinearRegression::new(0.005);
    model.fit(&x, &y, 1000, 200);
    println!("\nLearned: y = {:.4}x + {:.4}", model.w, model.b);
    println!("True:    y = {}x + {}", TRUE_W, TRUE_B);
    println!("R-squared: {:.4}", model.r_squared(&x, &y));

    println!("\n=== Normal Equation (Closed-Form) ===");
    let mut model_normal = LinearRegressionNormal::new();
    model_normal.fit(&x, &y);
    println!(
        "Learned: y = {:.4}x + {:.4}",
        model_normal.w, model_normal.b
    );
    println!("R-squared: {:.4}", model_normal.r_squared(&x, &y));

    let mut rng2 = XorShift64::new(42);
    const N_HOUSES: usize = 100;
    let mut x_multi: Vec<Vec<f64>> = Vec::with_capacity(N_HOUSES);
    let mut y_multi: Vec<f64> = Vec::with_capacity(N_HOUSES);
    for _ in 0..N_HOUSES {
        let size = rng2.uniform(500.0, 3000.0);
        let bedrooms = rng2.randint(1, 5) as f64;
        let age = rng2.uniform(0.0, 50.0);
        let price = 50.0 * size + 10000.0 * bedrooms - 1000.0 * age + 50000.0
            + rng2.gauss(0.0, 20000.0);
        x_multi.push(vec![size, bedrooms, age]);
        y_multi.push(price);
    }

    let y_mean_val = y_multi.iter().sum::<f64>() / y_multi.len() as f64;
    let y_std_val = (y_multi
        .iter()
        .map(|yi| (yi - y_mean_val).powi(2))
        .sum::<f64>()
        / y_multi.len() as f64)
        .sqrt();
    let y_scaled: Vec<f64> = y_multi
        .iter()
        .map(|yi| (yi - y_mean_val) / y_std_val)
        .collect();

    let (x_scaled, _x_means, _x_stds) = standardize(&x_multi);

    println!("\n=== Multiple Linear Regression (3 features) ===");
    println!("Features: house size, bedrooms, age");
    let mut multi_model = MultipleLinearRegression::new(3, 0.01);
    multi_model.fit(&x_scaled, &y_scaled, 1000, 200);
    println!(
        "\nWeights (standardized): {}",
        fmt_round_vec(&multi_model.weights, 4)
    );
    println!("Bias (standardized): {:.4}", multi_model.bias);
    println!(
        "R-squared: {:.4}",
        multi_model.r_squared(&x_scaled, &y_scaled)
    );

    let mut rng3 = XorShift64::new(42);
    let x_poly: Vec<f64> = (0..50).map(|i| i as f64 / 10.0).collect();
    let y_poly: Vec<f64> = x_poly
        .iter()
        .map(|xi| 0.5 * xi.powi(2) - 2.0 * xi + 3.0 + rng3.gauss(0.0, 1.0))
        .collect();

    let x_max = x_poly.iter().map(|x| x.abs()).fold(0.0_f64, f64::max);
    let x_poly_norm: Vec<f64> = x_poly.iter().map(|x| x / x_max).collect();
    let y_poly_mean = y_poly.iter().sum::<f64>() / y_poly.len() as f64;
    let y_poly_std = (y_poly
        .iter()
        .map(|yi| (yi - y_poly_mean).powi(2))
        .sum::<f64>()
        / y_poly.len() as f64)
        .sqrt();
    let y_poly_norm: Vec<f64> = y_poly
        .iter()
        .map(|yi| (yi - y_poly_mean) / y_poly_std)
        .collect();

    println!("\n=== Polynomial Regression ===");
    println!("True relationship: y = 0.5x^2 - 2x + 3");

    println!("\nDegree 2:");
    let mut poly2 = PolynomialRegression::new(2, 0.1);
    poly2.fit(&x_poly_norm, &y_poly_norm, 2000, 500);
    println!(
        "  R-squared: {:.4}",
        poly2.r_squared(&x_poly_norm, &y_poly_norm)
    );

    println!("\nDegree 5:");
    let mut poly5 = PolynomialRegression::new(5, 0.1);
    poly5.fit(&x_poly_norm, &y_poly_norm, 2000, 500);
    println!(
        "  R-squared: {:.4}",
        poly5.r_squared(&x_poly_norm, &y_poly_norm)
    );

    println!("\n=== Ridge Regression (L2 Regularization) ===");
    println!("Same data as multiple regression, alpha=0.1");
    let mut ridge = RidgeRegression::new(3, 0.01, 0.1);
    ridge.fit(&x_scaled, &y_scaled, 1000, 200);
    println!("\nRidge weights: {}", fmt_round_vec(&ridge.weights, 4));
    println!("Plain weights: {}", fmt_round_vec(&multi_model.weights, 4));
    println!("Ridge weights are smaller due to the L2 penalty.");

    println!("\n=== Train/Test Split Comparison ===");
    let split_idx = (0.8 * x.len() as f64) as usize;
    let x_train = &x[..split_idx];
    let x_test = &x[split_idx..];
    let y_train = &y[..split_idx];
    let y_test = &y[split_idx..];

    let mut model_split = LinearRegression::new(0.005);
    model_split.fit(x_train, y_train, 1000, 500);
    println!(
        "\nTrain R-squared: {:.4}",
        model_split.r_squared(x_train, y_train)
    );
    println!(
        "Test R-squared:  {:.4}",
        model_split.r_squared(x_test, y_test)
    );
    println!(
        "Learned: y = {:.4}x + {:.4}",
        model_split.w, model_split.b
    );
    println!("True:    y = {}x + {}", TRUE_W, TRUE_B);
}
