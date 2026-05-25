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
}

struct Perceptron {
    weights: Vec<f64>,
    bias: f64,
    lr: f64,
}

impl Perceptron {
    fn new(n_inputs: usize) -> Self {
        Perceptron {
            weights: vec![0.0; n_inputs],
            bias: 0.0,
            lr: 0.1,
        }
    }

    fn predict(&self, inputs: &[i32]) -> i32 {
        let total: f64 = self
            .weights
            .iter()
            .zip(inputs)
            .map(|(w, x)| w * *x as f64)
            .sum::<f64>()
            + self.bias;
        if total >= 0.0 { 1 } else { 0 }
    }

    fn train(&mut self, training_data: &[(Vec<i32>, i32)], epochs: usize) {
        for epoch in 0..epochs {
            let mut errors = 0;
            for (inputs, target) in training_data {
                let prediction = self.predict(inputs);
                let error = target - prediction;
                if error != 0 {
                    errors += 1;
                    for i in 0..self.weights.len() {
                        self.weights[i] += self.lr * error as f64 * inputs[i] as f64;
                    }
                    self.bias += self.lr * error as f64;
                }
            }
            if errors == 0 {
                println!("Converged at epoch {}", epoch + 1);
                return;
            }
        }
        println!("Did not converge after {} epochs", epochs);
    }
}

fn test_gate(name: &str, n_inputs: usize, data: &[(Vec<i32>, i32)]) {
    println!("=== {} ===", name);
    let mut p = Perceptron::new(n_inputs);
    p.train(data, 100);
    println!("  Weights: {:?}, Bias: {:?}", p.weights, p.bias);
    for (inputs, expected) in data {
        let result = p.predict(inputs);
        let status = if result == *expected { "OK" } else { "WRONG" };
        println!(
            "  {:?} -> {} (expected {}) {}",
            inputs, result, expected, status
        );
    }
    println!();
}

fn xor_network(x1: i32, x2: i32) -> i32 {
    let mut or_neuron = Perceptron::new(2);
    or_neuron.weights = vec![1.0, 1.0];
    or_neuron.bias = -0.5;

    let mut nand_neuron = Perceptron::new(2);
    nand_neuron.weights = vec![-1.0, -1.0];
    nand_neuron.bias = 1.5;

    let mut and_neuron = Perceptron::new(2);
    and_neuron.weights = vec![1.0, 1.0];
    and_neuron.bias = -1.5;

    let hidden1 = or_neuron.predict(&[x1, x2]);
    let hidden2 = nand_neuron.predict(&[x1, x2]);
    and_neuron.predict(&[hidden1, hidden2])
}

struct TwoLayerNetwork {
    w_hidden: Vec<Vec<f64>>,
    b_hidden: Vec<f64>,
    w_output: Vec<f64>,
    b_output: f64,
    lr: f64,
    inputs: Vec<f64>,
    hidden_outputs: Vec<f64>,
    output: f64,
}

impl TwoLayerNetwork {
    fn new(learning_rate: f64) -> Self {
        let mut rng = XorShift64::new(1);
        let w_hidden: Vec<Vec<f64>> = (0..2)
            .map(|_| vec![rng.uniform(-1.0, 1.0), rng.uniform(-1.0, 1.0)])
            .collect();
        let b_hidden: Vec<f64> = vec![rng.uniform(-1.0, 1.0), rng.uniform(-1.0, 1.0)];
        let w_output: Vec<f64> = vec![rng.uniform(-1.0, 1.0), rng.uniform(-1.0, 1.0)];
        let b_output: f64 = rng.uniform(-1.0, 1.0);
        TwoLayerNetwork {
            w_hidden,
            b_hidden,
            w_output,
            b_output,
            lr: learning_rate,
            inputs: Vec::new(),
            hidden_outputs: Vec::new(),
            output: 0.0,
        }
    }

    fn sigmoid(&self, x: f64) -> f64 {
        let x = x.max(-500.0).min(500.0);
        1.0 / (1.0 + (-x).exp())
    }

    fn forward(&mut self, inputs: &[i32]) -> f64 {
        self.inputs = inputs.iter().map(|&v| v as f64).collect();
        self.hidden_outputs = Vec::with_capacity(2);
        for i in 0..2 {
            let z: f64 = self.w_hidden[i]
                .iter()
                .zip(&self.inputs)
                .map(|(w, x)| w * x)
                .sum::<f64>()
                + self.b_hidden[i];
            self.hidden_outputs.push(self.sigmoid(z));
        }
        let z_out: f64 = self
            .w_output
            .iter()
            .zip(&self.hidden_outputs)
            .map(|(w, h)| w * h)
            .sum::<f64>()
            + self.b_output;
        self.output = self.sigmoid(z_out);
        self.output
    }

    fn train(&mut self, training_data: &[(Vec<i32>, i32)], epochs: usize) {
        for epoch in 0..epochs {
            let mut total_error = 0.0;
            for (inputs, target) in training_data {
                let output = self.forward(inputs);
                let error = *target as f64 - output;
                total_error += error * error;

                let d_output = error * output * (1.0 - output);

                let saved_w_output = self.w_output.clone();
                let mut hidden_deltas = Vec::with_capacity(2);
                for i in 0..2 {
                    let h = self.hidden_outputs[i];
                    let hd = d_output * saved_w_output[i] * h * (1.0 - h);
                    hidden_deltas.push(hd);
                }

                for i in 0..2 {
                    self.w_output[i] += self.lr * d_output * self.hidden_outputs[i];
                }
                self.b_output += self.lr * d_output;

                for i in 0..2 {
                    for j in 0..inputs.len() {
                        self.w_hidden[i][j] += self.lr * hidden_deltas[i] * inputs[j] as f64;
                    }
                    self.b_hidden[i] += self.lr * hidden_deltas[i];
                }
            }
            if epoch % 2000 == 0 {
                println!("  Epoch {}, error: {:.4}", epoch, total_error);
            }
        }
    }
}

fn main() {
    let and_data: Vec<(Vec<i32>, i32)> = vec![
        (vec![0, 0], 0),
        (vec![0, 1], 0),
        (vec![1, 0], 0),
        (vec![1, 1], 1),
    ];
    let or_data: Vec<(Vec<i32>, i32)> = vec![
        (vec![0, 0], 0),
        (vec![0, 1], 1),
        (vec![1, 0], 1),
        (vec![1, 1], 1),
    ];
    let not_data: Vec<(Vec<i32>, i32)> = vec![(vec![0], 1), (vec![1], 0)];
    let xor_data: Vec<(Vec<i32>, i32)> = vec![
        (vec![0, 0], 0),
        (vec![0, 1], 1),
        (vec![1, 0], 1),
        (vec![1, 1], 0),
    ];

    test_gate("AND Gate", 2, &and_data);
    test_gate("OR Gate", 2, &or_data);
    test_gate("NOT Gate", 1, &not_data);

    println!("=== XOR Gate (single perceptron - will fail) ===");
    let mut p_xor = Perceptron::new(2);
    p_xor.train(&xor_data, 1000);
    for (inputs, expected) in &xor_data {
        let result = p_xor.predict(inputs);
        let status = if result == *expected { "OK" } else { "WRONG" };
        println!(
            "  {:?} -> {} (expected {}) {}",
            inputs, result, expected, status
        );
    }
    println!();

    println!("=== XOR Gate (multi-layer network - works) ===");
    for (inputs, expected) in &xor_data {
        let result = xor_network(inputs[0], inputs[1]);
        let status = if result == *expected { "OK" } else { "WRONG" };
        println!(
            "  {:?} -> {} (expected {}) {}",
            inputs, result, expected, status
        );
    }
    println!();

    println!("=== XOR Gate (trained 2-layer network with backpropagation) ===");
    let mut net = TwoLayerNetwork::new(2.0);
    net.train(&xor_data, 10000);
    println!();
    for (inputs, expected) in &xor_data {
        let result = net.forward(inputs);
        let predicted = if result >= 0.5 { 1 } else { 0 };
        println!(
            "  {:?} -> {:.4} (rounded: {}, expected {})",
            inputs, result, predicted, expected
        );
    }
}
