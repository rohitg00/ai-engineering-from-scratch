// Lesson: Quantization — INT8 / GPTQ / AWQ / GGUF (phase 10 / lesson 11)
// Topic: symmetric INT8 quantization of an FP32 weight vector. Computes scale
// from abs-max, rounds + clips to [-127, 127], dequantizes, reports MSE,
// max abs error, SNR, cosine similarity, and a bit-width sweep (8 / 4 / 2 bit).
// Refs:
//   https://pytorch.org/docs/stable/quantization.html
//   https://leimao.github.io/article/Neural-Networks-Quantization/
//   https://arxiv.org/abs/2210.17323  (GPTQ)
//   https://arxiv.org/abs/2306.00978  (AWQ)
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson_quant && /tmp/lesson_quant

use std::f64;

fn lcg(seed: &mut u64) -> f64 {
    *seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
    let bits = (*seed >> 11) as u64;
    let unit = bits as f64 / (1u64 << 53) as f64;
    unit * 2.0 - 1.0
}

// Box-Muller via the LCG, so we generate normal-ish floats without external crates.
fn randn(seed: &mut u64) -> f64 {
    let u1 = (lcg(seed) + 1.0) / 2.0;
    let u2 = (lcg(seed) + 1.0) / 2.0;
    let u1 = u1.max(1e-12);
    let r = (-2.0 * u1.ln()).sqrt();
    r * (2.0 * std::f64::consts::PI * u2).cos()
}

struct QuantResult {
    qmin: i32,
    qmax: i32,
    scale: f64,
    quantized: Vec<i32>,
    reconstructed: Vec<f64>,
}

fn quantize_symmetric(weights: &[f64], num_bits: u32) -> QuantResult {
    let qmax = (1i32 << (num_bits - 1)) - 1;
    let qmin = -qmax;

    let abs_max = weights.iter().fold(0.0f64, |acc, &x| acc.max(x.abs()));
    let scale = if abs_max == 0.0 { 1.0 } else { abs_max / qmax as f64 };

    let mut quantized = Vec::with_capacity(weights.len());
    let mut reconstructed = Vec::with_capacity(weights.len());
    for &w in weights {
        let q = (w / scale).round() as i32;
        let q = q.max(qmin).min(qmax);
        quantized.push(q);
        reconstructed.push(q as f64 * scale);
    }

    QuantResult { qmin, qmax, scale, quantized, reconstructed }
}

struct ErrorReport {
    mse: f64,
    rmse: f64,
    max_abs_error: f64,
    snr_db: f64,
    cosine: f64,
}

fn error_report(original: &[f64], reconstructed: &[f64]) -> ErrorReport {
    let n = original.len() as f64;
    let mut sum_sq_err = 0.0f64;
    let mut max_abs = 0.0f64;
    let mut signal_power = 0.0f64;
    let mut dot = 0.0f64;
    let mut norm_a = 0.0f64;
    let mut norm_b = 0.0f64;

    for (a, b) in original.iter().zip(reconstructed.iter()) {
        let diff = a - b;
        sum_sq_err += diff * diff;
        max_abs = max_abs.max(diff.abs());
        signal_power += a * a;
        dot += a * b;
        norm_a += a * a;
        norm_b += b * b;
    }

    let mse = sum_sq_err / n;
    let rmse = mse.sqrt();
    let snr_db = if mse > 0.0 {
        10.0 * (signal_power / n / mse).log10()
    } else {
        f64::INFINITY
    };
    let cosine = if norm_a > 0.0 && norm_b > 0.0 {
        dot / (norm_a.sqrt() * norm_b.sqrt())
    } else {
        0.0
    };

    ErrorReport { mse, rmse, max_abs_error: max_abs, snr_db, cosine }
}

fn print_quant_summary(label: &str, weights: &[f64], r: &QuantResult, err: &ErrorReport) {
    println!("[{}]", label);
    println!("  range [qmin, qmax]    {} .. {}", r.qmin, r.qmax);
    println!("  scale (FP32 step)     {:.8}", r.scale);
    println!("  sample weights (10)   {:?}", &weights[..10.min(weights.len())]
        .iter().map(|w| format!("{:+.4}", w)).collect::<Vec<_>>());
    println!("  quantized codes (10)  {:?}", &r.quantized[..10.min(r.quantized.len())]);
    println!("  dequantized (10)      {:?}", &r.reconstructed[..10.min(r.reconstructed.len())]
        .iter().map(|w| format!("{:+.4}", w)).collect::<Vec<_>>());
    println!();
    println!("  mse                   {:.10}", err.mse);
    println!("  rmse                  {:.10}", err.rmse);
    println!("  max |error|           {:.10}", err.max_abs_error);
    println!("  snr                   {:.2} dB", err.snr_db);
    println!("  cosine similarity     {:.10}", err.cosine);
    println!();
}

fn fmt_bytes(b: u64) -> String {
    let kb = b as f64 / 1024.0;
    if kb < 1024.0 { format!("{:.2} KB", kb) } else { format!("{:.2} MB", kb / 1024.0) }
}

fn main() {
    let mut seed: u64 = 42;

    let n = 8192;
    let mut weights: Vec<f64> = (0..n).map(|_| randn(&mut seed) * 0.02).collect();

    weights[0] *= 25.0;
    weights[123] *= 15.0;
    weights[2048] *= 10.0;

    let stats = {
        let abs_vals: Vec<f64> = weights.iter().map(|x| x.abs()).collect();
        let max = abs_vals.iter().fold(0.0f64, |a, &b| a.max(b));
        let mean: f64 = abs_vals.iter().sum::<f64>() / abs_vals.len() as f64;
        let var: f64 = abs_vals.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / abs_vals.len() as f64;
        (max, mean, var.sqrt())
    };

    println!();
    println!("=== INT8 quantization (Rust, stdlib only) ===");
    println!();
    println!("Tensor       : 1D weight vector, n = {}", n);
    println!("Distribution : Normal(0, 0.02) with 3 outlier weights");
    println!("  max |w|      {:.6}", stats.0);
    println!("  mean |w|     {:.6}", stats.1);
    println!("  std |w|      {:.6}", stats.2);
    println!();

    let r8 = quantize_symmetric(&weights, 8);
    let err8 = error_report(&weights, &r8.reconstructed);
    print_quant_summary("INT8 symmetric per-tensor", &weights, &r8, &err8);

    println!("--- Bit-width sweep (symmetric per-tensor) ---");
    println!("  {:>5}  {:>10}  {:>14}  {:>10}  {:>12}  {:>10}",
             "bits", "levels", "mse", "snr_db", "max |err|", "ratio_vs_fp32");
    for bits in [16u32, 8, 4, 2] {
        let r = quantize_symmetric(&weights, bits);
        let er = error_report(&weights, &r.reconstructed);
        let ratio = 32.0 / bits as f64;
        let levels = (r.qmax - r.qmin + 1) as u64;
        println!("  {:>5}  {:>10}  {:>14.10}  {:>10.2}  {:>12.6}  {:>9.1}x",
                 bits, levels, er.mse, er.snr_db, er.max_abs_error, ratio);
    }
    println!();

    let fp32_bytes = (n * 4) as u64;
    let int8_bytes = (n * 1) as u64 + 8;
    let int4_bytes = ((n + 1) / 2) as u64 + 8;
    println!("--- Memory footprint ---");
    println!("  FP32 weights     {}", fmt_bytes(fp32_bytes));
    println!("  INT8 + scale     {}   ({:.1}x smaller)", fmt_bytes(int8_bytes), fp32_bytes as f64 / int8_bytes as f64);
    println!("  INT4 + scale     {}   ({:.1}x smaller)", fmt_bytes(int4_bytes), fp32_bytes as f64 / int4_bytes as f64);
    println!();

    println!("Takeaway:");
    println!("  - INT8 keeps SNR well above 30 dB for normal weight distributions.");
    println!("  - Outliers dominate scale: 3 outliers in {} weights inflate scale and ", n);
    println!("    waste precision on the rest. Per-channel (or GPTQ/AWQ) helps.");
    println!();
}
