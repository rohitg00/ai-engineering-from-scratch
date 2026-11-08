// Lesson: Backpropagation from Scratch (phase 03 / lesson 03)
// Rust port of code/main.py. Standard library only.
// Source: phases/03-deep-learning-core/03-backpropagation/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

use std::cell::RefCell;
use std::collections::HashSet;
use std::fmt;
use std::ops::{Add, Mul, Neg, Sub};
use std::rc::Rc;

struct Rng {
    state: u32,
}

impl Rng {
    fn new(seed: u32) -> Self {
        Rng { state: seed }
    }

    fn next_f64(&mut self) -> f64 {
        self.state = self.state.wrapping_add(0x6D2B79F5);
        let mut t = self.state;
        t = (t ^ (t >> 15)).wrapping_mul(t | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        t ^= t >> 14;
        t as f64 / 4294967296.0
    }

    fn uniform(&mut self, low: f64, high: f64) -> f64 {
        low + (high - low) * self.next_f64()
    }

    fn shuffle<T>(&mut self, items: &mut [T]) {
        for i in (1..items.len()).rev() {
            let j = (self.next_f64() * (i + 1) as f64) as usize;
            items.swap(i, j);
        }
    }
}

#[derive(Clone, Copy)]
enum Op {
    Leaf,
    Add,
    Mul,
    Sigmoid,
}

struct Node {
    data: f64,
    grad: f64,
    children: Vec<Value>,
    op: Op,
}

#[derive(Clone)]
struct Value(Rc<RefCell<Node>>);

impl Value {
    fn new(data: f64) -> Self {
        Value::from_op(data, Vec::new(), Op::Leaf)
    }

    fn from_op(data: f64, children: Vec<Value>, op: Op) -> Self {
        Value(Rc::new(RefCell::new(Node {
            data,
            grad: 0.0,
            children,
            op,
        })))
    }

    fn data(&self) -> f64 {
        self.0.borrow().data
    }

    fn grad(&self) -> f64 {
        self.0.borrow().grad
    }

    fn set_data(&self, data: f64) {
        self.0.borrow_mut().data = data;
    }

    fn set_grad(&self, grad: f64) {
        self.0.borrow_mut().grad = grad;
    }

    fn add_grad(&self, amount: f64) {
        self.0.borrow_mut().grad += amount;
    }

    fn id(&self) -> usize {
        Rc::as_ptr(&self.0) as usize
    }

    fn sigmoid(&self) -> Value {
        let x = self.data().clamp(-500.0, 500.0);
        let s = 1.0 / (1.0 + (-x).exp());
        Value::from_op(s, vec![self.clone()], Op::Sigmoid)
    }

    fn backward_step(&self) {
        let (op, out_grad, out_data, children) = {
            let node = self.0.borrow();
            (node.op, node.grad, node.data, node.children.clone())
        };
        match op {
            Op::Leaf => {}
            Op::Add => {
                children[0].add_grad(out_grad);
                children[1].add_grad(out_grad);
            }
            Op::Mul => {
                let left_data = children[0].data();
                let right_data = children[1].data();
                children[0].add_grad(right_data * out_grad);
                children[1].add_grad(left_data * out_grad);
            }
            Op::Sigmoid => {
                let s = out_data;
                children[0].add_grad((s * (1.0 - s)) * out_grad);
            }
        }
    }

    fn backward(&self) {
        let mut topo = Vec::new();
        let mut visited = HashSet::new();
        build_topo(self, &mut visited, &mut topo);
        self.set_grad(1.0);
        for v in topo.iter().rev() {
            v.backward_step();
        }
    }
}

fn build_topo(v: &Value, visited: &mut HashSet<usize>, topo: &mut Vec<Value>) {
    if visited.insert(v.id()) {
        let children = v.0.borrow().children.clone();
        for child in &children {
            build_topo(child, visited, topo);
        }
        topo.push(v.clone());
    }
}

impl fmt::Display for Value {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "Value(data={:.4}, grad={:.4})", self.data(), self.grad())
    }
}

impl Add for &Value {
    type Output = Value;

    fn add(self, other: &Value) -> Value {
        Value::from_op(
            self.data() + other.data(),
            vec![self.clone(), other.clone()],
            Op::Add,
        )
    }
}

impl Mul for &Value {
    type Output = Value;

    fn mul(self, other: &Value) -> Value {
        Value::from_op(
            self.data() * other.data(),
            vec![self.clone(), other.clone()],
            Op::Mul,
        )
    }
}

impl Neg for &Value {
    type Output = Value;

    fn neg(self) -> Value {
        self * &Value::new(-1.0)
    }
}

impl Sub for &Value {
    type Output = Value;

    fn sub(self, other: &Value) -> Value {
        self + &(-other)
    }
}

fn mse_loss(predicted: &Value, target: f64) -> Value {
    let diff = predicted + &Value::new(-target);
    &diff * &diff
}

struct Neuron {
    weights: Vec<Value>,
    bias: Value,
}

impl Neuron {
    fn new(n_inputs: usize, rng: &mut Rng) -> Self {
        let scale = (2.0 / n_inputs as f64).sqrt();
        let mut weights = Vec::new();
        for _ in 0..n_inputs {
            weights.push(Value::new(rng.uniform(-scale, scale)));
        }
        Neuron {
            weights,
            bias: Value::new(0.0),
        }
    }

    fn call(&self, x: &[Value]) -> Value {
        let mut act = self.bias.clone();
        for (wi, xi) in self.weights.iter().zip(x) {
            act = &act + &(wi * xi);
        }
        act.sigmoid()
    }

    fn parameters(&self) -> Vec<Value> {
        let mut params = self.weights.clone();
        params.push(self.bias.clone());
        params
    }
}

struct Layer {
    neurons: Vec<Neuron>,
}

impl Layer {
    fn new(n_inputs: usize, n_outputs: usize, rng: &mut Rng) -> Self {
        let mut neurons = Vec::new();
        for _ in 0..n_outputs {
            neurons.push(Neuron::new(n_inputs, rng));
        }
        Layer { neurons }
    }

    fn call(&self, x: &[Value]) -> Vec<Value> {
        let mut out = Vec::new();
        for n in &self.neurons {
            out.push(n.call(x));
        }
        out
    }

    fn parameters(&self) -> Vec<Value> {
        let mut params = Vec::new();
        for n in &self.neurons {
            params.extend(n.parameters());
        }
        params
    }
}

struct Network {
    layers: Vec<Layer>,
}

impl Network {
    fn new(sizes: &[usize], rng: &mut Rng) -> Self {
        let mut layers = Vec::new();
        for i in 0..sizes.len() - 1 {
            layers.push(Layer::new(sizes[i], sizes[i + 1], rng));
        }
        Network { layers }
    }

    fn call(&self, x: &[Value]) -> Value {
        let mut current = x.to_vec();
        for layer in &self.layers {
            current = layer.call(&current);
        }
        current[0].clone()
    }

    fn parameters(&self) -> Vec<Value> {
        let mut params = Vec::new();
        for layer in &self.layers {
            params.extend(layer.parameters());
        }
        params
    }

    fn zero_grad(&self) {
        for p in self.parameters() {
            p.set_grad(0.0);
        }
    }
}

fn to_values(inputs: &[f64]) -> Vec<Value> {
    inputs.iter().map(|&i| Value::new(i)).collect()
}

fn train_xor() {
    println!("{}", "=".repeat(50));
    println!("Training on XOR");
    println!("{}", "=".repeat(50));

    let mut rng = Rng::new(42);
    let net = Network::new(&[2, 4, 1], &mut rng);

    let xor_data = vec![
        (vec![0.0, 0.0], 0.0),
        (vec![0.0, 1.0], 1.0),
        (vec![1.0, 0.0], 1.0),
        (vec![1.0, 1.0], 0.0),
    ];

    let learning_rate = 1.0;

    for epoch in 0..1000 {
        let mut total_loss = Value::new(0.0);
        for (inputs, target) in &xor_data {
            let x = to_values(inputs);
            let pred = net.call(&x);
            let loss = mse_loss(&pred, *target);
            total_loss = &total_loss + &loss;
        }

        net.zero_grad();
        total_loss.backward();

        for p in net.parameters() {
            p.set_data(p.data() - learning_rate * p.grad());
        }

        if epoch % 100 == 0 {
            println!("Epoch {:4} | Loss: {:.6}", epoch, total_loss.data());
        }
    }

    println!("\nXOR Results:");
    for (inputs, target) in &xor_data {
        let x = to_values(inputs);
        let pred = net.call(&x);
        let predicted_class = if pred.data() > 0.5 { 1 } else { 0 };
        println!(
            "  {:?} -> {:.4} (rounded: {}, expected {})",
            inputs,
            pred.data(),
            predicted_class,
            *target as i32
        );
    }
}

fn generate_circle_data(n: usize, rng: &mut Rng) -> Vec<(Vec<f64>, f64)> {
    let mut data = Vec::new();
    for _ in 0..n {
        let x1 = rng.uniform(-1.5, 1.5);
        let x2 = rng.uniform(-1.5, 1.5);
        let label = if x1 * x1 + x2 * x2 < 1.0 { 1.0 } else { 0.0 };
        data.push((vec![x1, x2], label));
    }
    data
}

fn train_circle() {
    println!("\n{}", "=".repeat(50));
    println!("Training on Circle Classification");
    println!("{}", "=".repeat(50));

    let mut rng = Rng::new(7);
    let mut circle_data = generate_circle_data(80, &mut rng);

    let net = Network::new(&[2, 8, 1], &mut rng);
    let learning_rate = 0.5;

    for epoch in 0..2000 {
        rng.shuffle(&mut circle_data);
        let mut total_loss_val = 0.0;
        for (inputs, target) in &circle_data {
            let x = to_values(inputs);
            let pred = net.call(&x);
            let loss = mse_loss(&pred, *target);
            net.zero_grad();
            loss.backward();
            for p in net.parameters() {
                p.set_data(p.data() - learning_rate * p.grad());
            }
            total_loss_val += loss.data();
        }

        if epoch % 200 == 0 {
            let mut correct = 0;
            for (inputs, target) in &circle_data {
                let x = to_values(inputs);
                let pred = net.call(&x);
                let predicted_class = if pred.data() > 0.5 { 1.0 } else { 0.0 };
                if predicted_class == *target {
                    correct += 1;
                }
            }
            let accuracy = correct as f64 / circle_data.len() as f64 * 100.0;
            println!(
                "Epoch {:4} | Loss: {:.4} | Accuracy: {:.1}%",
                epoch, total_loss_val, accuracy
            );
        }
    }

    println!("\nSample Circle Results:");
    let test_points = vec![
        (vec![0.0, 0.0], "inside"),
        (vec![0.5, 0.5], "inside"),
        (vec![1.2, 1.2], "outside"),
        (vec![0.0, 1.2], "outside"),
        (vec![-0.3, 0.3], "inside"),
    ];
    for (point, expected_region) in &test_points {
        let x = to_values(point);
        let pred = net.call(&x);
        let predicted_class = if pred.data() > 0.5 { "inside" } else { "outside" };
        let status = if predicted_class == *expected_region { "OK" } else { "WRONG" };
        println!(
            "  {:?} -> {:.4} ({}, expected {}) {}",
            point,
            pred.data(),
            predicted_class,
            expected_region,
            status
        );
    }
}

fn main() {
    train_xor();
    train_circle();
}
