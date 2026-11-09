// Lesson: Voice Activity Detection & Turn-Taking (phase 06 / lesson 14)
// Rust port of code/main.py. Standard library only.
// Source: phases/06-speech-and-audio/14-voice-activity-detection-turn-taking/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

struct Rng {
    state: u64,
}

impl Rng {
    fn new(seed: u64) -> Rng {
        Rng { state: seed }
    }

    fn next_u64(&mut self) -> u64 {
        self.state = self.state.wrapping_add(0x9E3779B97F4A7C15);
        let mut z = self.state;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
        z ^ (z >> 31)
    }

    fn random(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 / (1u64 << 53) as f64
    }

    fn gauss(&mut self, mu: f64, sigma: f64) -> f64 {
        let u1 = 1.0 - self.random();
        let u2 = self.random();
        mu + sigma * (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos()
    }
}

fn synth_chunk(kind: &str, rng: &mut Rng, sr: usize, chunk_ms: usize) -> Vec<f64> {
    let n = sr * chunk_ms / 1000;
    match kind {
        "speech" => (0..n).map(|_| 0.2 * rng.gauss(0.0, 1.0)).collect(),
        "cough" => (0..n)
            .map(|i| if i < n / 5 { 0.8 * rng.gauss(0.0, 1.0) } else { 0.001 * rng.gauss(0.0, 1.0) })
            .collect(),
        _ => (0..n).map(|_| 0.002 * rng.gauss(0.0, 1.0)).collect(),
    }
}

fn rms(chunk: &[f64]) -> f64 {
    (chunk.iter().map(|x| x * x).sum::<f64>() / chunk.len() as f64).sqrt()
}

fn energy_vad(chunk: &[f64], threshold_dbfs: f64) -> bool {
    20.0 * rms(chunk).max(1e-10).log10() > threshold_dbfs
}

fn fake_silero_vad(chunk: &[f64]) -> f64 {
    let r = rms(chunk);
    let duration = chunk.len() as f64 / 16000.0;
    let hi = chunk.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    let lo = chunk.iter().copied().fold(f64::INFINITY, f64::min);
    let transient = hi - lo > 0.6 && duration < 0.03;
    if r > 0.08 && !transient {
        return 0.92;
    }
    if r > 0.05 {
        return 0.55;
    }
    0.02
}

#[derive(PartialEq)]
enum State {
    Idle,
    Speaking,
}

struct TurnDetector {
    state: State,
    speech_ms: usize,
    silence_ms: usize,
    silence_hangover_ms: usize,
    min_speech_ms: usize,
}

impl TurnDetector {
    fn new(silence_hangover_ms: usize, min_speech_ms: usize) -> TurnDetector {
        TurnDetector { state: State::Idle, speech_ms: 0, silence_ms: 0, silence_hangover_ms, min_speech_ms }
    }

    fn update(&mut self, is_speech: bool, chunk_ms: usize) -> Option<&'static str> {
        if is_speech {
            self.speech_ms += chunk_ms;
            self.silence_ms = 0;
            if self.state == State::Idle && self.speech_ms >= self.min_speech_ms {
                self.state = State::Speaking;
                return Some("START");
            }
        } else if self.state == State::Speaking {
            self.silence_ms += chunk_ms;
            if self.silence_ms >= self.silence_hangover_ms {
                self.state = State::Idle;
                self.speech_ms = 0;
                self.silence_ms = 0;
                return Some("END");
            }
        }
        None
    }
}

fn main() {
    let mut rng = Rng::new(42);

    let sequence = [
        ("silence", 10),
        ("speech", 40),
        ("silence", 30),
        ("cough", 1),
        ("silence", 10),
        ("speech", 25),
        ("silence", 35),
    ];

    let mut chunks: Vec<(&str, Vec<f64>)> = Vec::new();
    for (kind, count) in sequence {
        for _ in 0..count {
            chunks.push((kind, synth_chunk(kind, &mut rng, 16000, 20)));
        }
    }

    println!("=== stream: {} chunks of 20 ms = {} ms total ===", chunks.len(), chunks.len() * 20);
    println!();

    let mut td_silero = TurnDetector::new(500, 250);
    let mut td_energy = TurnDetector::new(500, 250);
    let mut events_silero = Vec::new();
    let mut events_energy = Vec::new();

    for (i, (truth, chunk)) in chunks.iter().enumerate() {
        let e_active = energy_vad(chunk, -40.0);
        let s_active = fake_silero_vad(chunk) >= 0.5;

        if let Some(ev) = td_energy.update(e_active, 20) {
            events_energy.push((i * 20, ev, *truth));
        }
        if let Some(ev) = td_silero.update(s_active, 20) {
            events_silero.push((i * 20, ev, *truth));
        }
    }

    println!("=== energy-only VAD turn events (many false positives on cough) ===");
    for (ms, ev, truth) in &events_energy {
        println!("  t={:>4} ms  {:<5}  (at {})", ms, ev, truth);
    }

    println!();
    println!("=== Silero-style VAD turn events (rejects cough) ===");
    for (ms, ev, truth) in &events_silero {
        println!("  t={:>4} ms  {:<5}  (at {})", ms, ev, truth);
    }

    println!();
    println!("=== 2026 VAD cheatsheet ===");
    let rows = [
        ("WebRTC VAD (Google, 2013)", "50.0% TPR @ 5% FPR", "BSD"),
        ("Silero VAD (2020-2026)", "87.7% TPR @ 5% FPR", "MIT, default open"),
        ("Cobra VAD (Picovoice)", "98.9% TPR @ 5% FPR", "commercial"),
        ("pyannote segmentation", "~95% TPR @ 5% FPR", "MIT-ish, diarization-grade"),
    ];
    println!("  | VAD                       | accuracy            | license               |");
    for (name, acc, lic) in rows {
        println!("  | {:<25} | {:<19} | {:<21} |", name, acc, lic);
    }

    println!();
    println!("takeaways:");
    println!("  - energy-only VAD fires on every transient; not for production");
    println!("  - Silero VAD handles the cough without firing a turn start");
    println!("  - 500 ms silence hangover = conversational sweet spot");
    println!("  - add the flush trick for sub-200 ms end-to-end voice agents");
}
