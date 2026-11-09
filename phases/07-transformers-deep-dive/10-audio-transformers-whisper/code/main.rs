// Lesson: Audio Transformers: Whisper Architecture (phase 07 / lesson 10)
// Rust port of code/main.py. Standard library only.
// Source: phases/07-transformers-deep-dive/10-audio-transformers-whisper/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

use std::f64::consts::PI;

const SAMPLE_RATE: usize = 16000;
const FRAME_SIZE: usize = 400;
const HOP: usize = 160;
const MAX_SECONDS: usize = 30;
const TARGET_FRAMES: usize = 3000;

fn sine_wave(freq: f64, duration_s: f64, sr: usize) -> Vec<f64> {
    let n = (duration_s * sr as f64) as usize;
    (0..n).map(|i| (2.0 * PI * freq * i as f64 / sr as f64).sin()).collect()
}

fn frame_signal(x: &[f64], frame_size: usize, hop: usize) -> Vec<Vec<f64>> {
    let mut frames = Vec::new();
    if x.len() < frame_size {
        return frames;
    }
    let mut start = 0;
    while start < x.len() - frame_size + 1 {
        frames.push(x[start..start + frame_size].to_vec());
        start += hop;
    }
    frames
}

fn frame_energy(frame: &[f64]) -> f64 {
    let e: f64 = frame.iter().map(|v| v * v).sum();
    (e + 1e-9).ln()
}

fn pad_or_clip(frames: &[Vec<f64>], target: usize) -> Vec<Vec<f64>> {
    if frames.len() >= target {
        return frames[..target].to_vec();
    }
    let pad_len = if frames.is_empty() { FRAME_SIZE } else { frames[0].len() };
    let pad_frame = vec![0.0; pad_len];
    let mut out = frames.to_vec();
    out.resize(target, pad_frame);
    out
}

fn whisper_prompt(lang: &str, task: &str, timestamps: bool) -> Vec<String> {
    let mut tokens = vec![
        "<|startoftranscript|>".to_string(),
        format!("<|{}|>", lang),
        format!("<|{}|>", task),
    ];
    if !timestamps {
        tokens.push("<|notimestamps|>".to_string());
    }
    tokens
}

fn main() {
    println!("=== Whisper preprocessing pipeline ===");
    println!("target: {}s audio at {} Hz", MAX_SECONDS, SAMPLE_RATE);
    println!(
        "frame:  {} samples ({:.0} ms)",
        FRAME_SIZE,
        FRAME_SIZE as f64 / SAMPLE_RATE as f64 * 1000.0
    );
    println!("hop:    {} samples ({:.0} ms)", HOP, HOP as f64 / SAMPLE_RATE as f64 * 1000.0);
    println!();

    let x = sine_wave(440.0, 1.0, SAMPLE_RATE);
    let frames = frame_signal(&x, FRAME_SIZE, HOP);
    println!("1s signal → {} samples → {} frames", x.len(), frames.len());

    let x5 = sine_wave(440.0, 5.0, SAMPLE_RATE);
    let frames5 = frame_signal(&x5, FRAME_SIZE, HOP);
    println!("5s signal → {} samples → {} frames", x5.len(), frames5.len());

    let padded = pad_or_clip(&frames5, TARGET_FRAMES);
    println!(
        "after pad to {}s: {} frames  (target {})",
        MAX_SECONDS,
        padded.len(),
        TARGET_FRAMES
    );

    let energies: Vec<f64> = frames5.iter().map(|f| frame_energy(f)).collect();
    let first: Vec<String> = energies.iter().take(5).map(|e| format!("{:+.3}", e)).collect();
    println!("first 5 frame log-energies: {}", first.join(", "));
    println!();

    println!("=== task prompts: what flips Whisper's behavior ===");
    let examples = [
        ("English transcription with timestamps", whisper_prompt("en", "transcribe", true)),
        ("French translation to English, no timestamps", whisper_prompt("fr", "translate", false)),
        ("Japanese transcription with timestamps", whisper_prompt("ja", "transcribe", true)),
    ];
    for (name, toks) in &examples {
        println!("  {}:", name);
        println!("    {}", toks.join("  "));
    }
    println!();

    println!("=== Whisper size table (large-v3 geometry) ===");
    let configs: [(&str, u32, u32, u32, u32); 6] = [
        ("tiny", 39, 4, 384, 6),
        ("base", 74, 6, 512, 8),
        ("small", 244, 12, 768, 12),
        ("medium", 769, 24, 1024, 16),
        ("large-v3", 1550, 32, 1280, 20),
        ("turbo", 809, 32, 1280, 20),
    ];
    println!("  {:<10}  {:>10}  {:>7}  {:>8}  {:>6}", "name", "params(M)", "layers", "d_model", "heads");
    for (name, p, l, d, h) in configs {
        println!("  {:<10}  {:>10}  {:>7}  {:>8}  {:>6}", name, p, l, d, h);
    }
    println!();
    println!("turbo = large-v3 encoder + 4-layer decoder. 8x faster decoding.");
}
