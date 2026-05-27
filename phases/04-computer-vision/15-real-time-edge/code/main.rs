// Lesson: Real-Time Vision Edge Deployment (phase 04 / lesson 15)
// Topic: edge inference loop in Rust. Builds a tiny depthwise-separable conv block
// (the MobileNet primitive), runs it over a 160x160x3 input tensor, and reports
// p50/p95/p99 latency the way an on-device profiler would. Stdlib only.
// Refs:
//   https://doc.rust-lang.org/std/time/struct.Instant.html
//   https://arxiv.org/abs/1704.04861  (MobileNetV1: depthwise separable convolutions)
//   https://pytorch.org/docs/stable/quantization.html  (edge measurement discipline)
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson_edge && /tmp/lesson_edge

use std::time::Instant;

const H: usize = 160;
const W: usize = 160;
const C_IN: usize = 3;
const C_OUT: usize = 16;
const K: usize = 3;
const WARMUP: usize = 3;
const ITERS: usize = 20;

#[derive(Clone)]
struct Tensor {
    data: Vec<f32>,
    h: usize,
    w: usize,
    c: usize,
}

impl Tensor {
    fn zeros(h: usize, w: usize, c: usize) -> Self {
        Self { data: vec![0.0; h * w * c], h, w, c }
    }

    fn idx(&self, y: usize, x: usize, c: usize) -> usize {
        (y * self.w + x) * self.c + c
    }
}

// Cheap deterministic PRNG. Avoids pulling in rand for a stdlib-only lesson.
fn lcg(seed: &mut u64) -> f32 {
    *seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
    let bits = (*seed >> 33) as u32;
    (bits as f32 / u32::MAX as f32) * 2.0 - 1.0
}

fn fill_random(t: &mut Tensor, seed: &mut u64) {
    for v in t.data.iter_mut() {
        *v = lcg(seed) * 0.5;
    }
}

// Depthwise conv: one 3x3 kernel per input channel, no cross-channel mixing.
// This is the part MobileNet uses to cut FLOPs by ~9x vs a dense conv.
fn depthwise_conv(input: &Tensor, weights: &[f32]) -> Tensor {
    let mut out = Tensor::zeros(input.h, input.w, input.c);
    let pad = K / 2;
    for y in 0..input.h {
        for x in 0..input.w {
            for c in 0..input.c {
                let mut acc = 0.0;
                for ky in 0..K {
                    for kx in 0..K {
                        let iy = y as isize + ky as isize - pad as isize;
                        let ix = x as isize + kx as isize - pad as isize;
                        if iy < 0 || ix < 0 || iy >= input.h as isize || ix >= input.w as isize {
                            continue;
                        }
                        let pixel = input.data[input.idx(iy as usize, ix as usize, c)];
                        let w_idx = c * K * K + ky * K + kx;
                        acc += pixel * weights[w_idx];
                    }
                }
                let oi = out.idx(y, x, c);
                out.data[oi] = acc.max(0.0);
            }
        }
    }
    out
}

// Pointwise 1x1 conv: mixes channels. Together with the depthwise above this is
// one MobileNet block: ~8-9x cheaper than a full HxWxC_in x C_out 3x3 dense conv.
fn pointwise_conv(input: &Tensor, weights: &[f32], c_out: usize) -> Tensor {
    let mut out = Tensor::zeros(input.h, input.w, c_out);
    for y in 0..input.h {
        for x in 0..input.w {
            for co in 0..c_out {
                let mut acc = 0.0;
                for ci in 0..input.c {
                    let pixel = input.data[input.idx(y, x, ci)];
                    let w_idx = co * input.c + ci;
                    acc += pixel * weights[w_idx];
                }
                let oi = out.idx(y, x, co);
                out.data[oi] = acc.max(0.0);
            }
        }
    }
    out
}

fn forward(input: &Tensor, dw_w: &[f32], pw_w: &[f32]) -> Tensor {
    let dw = depthwise_conv(input, dw_w);
    pointwise_conv(&dw, pw_w, C_OUT)
}

fn flops_per_pass() -> u64 {
    let dw = (H * W * C_IN * K * K * 2) as u64;
    let pw = (H * W * C_IN * C_OUT * 2) as u64;
    dw + pw
}

fn percentile(sorted_ms: &[f64], pct: f64) -> f64 {
    if sorted_ms.is_empty() {
        return 0.0;
    }
    let idx = ((sorted_ms.len() as f64 - 1.0) * pct).round() as usize;
    sorted_ms[idx]
}

fn main() {
    let mut seed: u64 = 0xa1b2_c3d4_e5f6_0708;

    let mut input = Tensor::zeros(H, W, C_IN);
    fill_random(&mut input, &mut seed);

    let mut dw_weights = vec![0.0f32; C_IN * K * K];
    let mut pw_weights = vec![0.0f32; C_OUT * C_IN];
    for w in dw_weights.iter_mut() { *w = lcg(&mut seed) * 0.1; }
    for w in pw_weights.iter_mut() { *w = lcg(&mut seed) * 0.1; }

    println!();
    println!("=== Edge inference benchmark (Rust, single thread) ===");
    println!();
    println!("Model      : depthwise 3x3 + pointwise 1x1 (one MobileNet block)");
    println!("Input shape: {}x{}x{}", H, W, C_IN);
    println!("Output ch  : {}", C_OUT);
    let flops = flops_per_pass();
    println!("FLOPs/pass : {:.2} M", flops as f64 / 1e6);
    println!();

    println!("Warming up ({} iters, ignored)...", WARMUP);
    for _ in 0..WARMUP {
        let _ = forward(&input, &dw_weights, &pw_weights);
    }

    println!("Measuring ({} iters)...", ITERS);
    let mut times_ms = Vec::with_capacity(ITERS);
    for _ in 0..ITERS {
        let t0 = Instant::now();
        let out = forward(&input, &dw_weights, &pw_weights);
        let dt = t0.elapsed().as_secs_f64() * 1000.0;
        times_ms.push(dt);
        std::hint::black_box(out);
    }

    let mut sorted = times_ms.clone();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let p50 = percentile(&sorted, 0.50);
    let p95 = percentile(&sorted, 0.95);
    let p99 = percentile(&sorted, 0.99);
    let mean: f64 = times_ms.iter().sum::<f64>() / times_ms.len() as f64;
    let min = sorted[0];
    let max = *sorted.last().unwrap();

    println!();
    println!("Latency (ms):");
    println!("  p50   {:>8.2}", p50);
    println!("  p95   {:>8.2}", p95);
    println!("  p99   {:>8.2}", p99);
    println!("  mean  {:>8.2}", mean);
    println!("  min   {:>8.2}", min);
    println!("  max   {:>8.2}", max);

    let throughput_fps = 1000.0 / p50;
    let gflops_s = (flops as f64) / (p50 / 1000.0) / 1e9;
    println!();
    println!("Throughput (from p50):");
    println!("  {:>5.1} fps   {:>5.2} GFLOPs/s", throughput_fps, gflops_s);

    println!();
    println!("Edge measurement discipline (also enforced here):");
    println!("  - {} warmup passes ignored to avoid cold-cache bias", WARMUP);
    println!("  - fixed input resolution (production resolution must match)");
    println!("  - p50 reported alongside p99 so tail latency is visible");
    println!();
}
