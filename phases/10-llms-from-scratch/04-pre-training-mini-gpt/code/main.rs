// Mini-GPT forward pass, stdlib only.
// Topic: embedding + pos embedding, N transformer blocks (LayerNorm, MHA, FFN), LM head.
// References (cited in spirit, not as deps):
//   - Karpathy nanoGPT / llm.c:    https://github.com/karpathy/llm.c/blob/master/train_gpt2.c
//   - candle gpt-2:                https://github.com/huggingface/candle/blob/main/candle-transformers/src/models/gpt2.rs
//   - GPT-2 paper:                 https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf
//
// Compile + run:  rustc --edition 2021 main.rs -o /tmp/mini && /tmp/mini

use std::f32::consts::PI;

// Tensor3 = [n, d_model]. We keep batch=1 implicit, matching the lesson script.
struct Mat {
    rows: usize,
    cols: usize,
    data: Vec<f32>,
}

impl Mat {
    fn zeros(rows: usize, cols: usize) -> Self {
        Mat { rows, cols, data: vec![0.0; rows * cols] }
    }
    #[inline] fn at(&self, i: usize, j: usize) -> f32 { self.data[i * self.cols + j] }
    #[inline] fn set(&mut self, i: usize, j: usize, v: f32) { self.data[i * self.cols + j] = v; }

    fn matmul(&self, b: &Mat) -> Mat {
        assert_eq!(self.cols, b.rows);
        let mut out = Mat::zeros(self.rows, b.cols);
        for i in 0..self.rows {
            for k in 0..self.cols {
                let aik = self.at(i, k);
                if aik == 0.0 { continue; }
                let row_base = i * out.cols;
                let bk_base = k * b.cols;
                for j in 0..b.cols {
                    out.data[row_base + j] += aik * b.data[bk_base + j];
                }
            }
        }
        out
    }

    fn add_(&mut self, b: &Mat) {
        assert_eq!(self.rows, b.rows);
        assert_eq!(self.cols, b.cols);
        for i in 0..self.data.len() { self.data[i] += b.data[i]; }
    }

    fn add_rowwise_(&mut self, bias: &[f32]) {
        assert_eq!(self.cols, bias.len());
        for i in 0..self.rows {
            let base = i * self.cols;
            for j in 0..self.cols { self.data[base + j] += bias[j]; }
        }
    }
}

struct Rng { state: u64 }
impl Rng {
    fn new(seed: u64) -> Self { Rng { state: seed.wrapping_mul(0x9E37_79B9_7F4A_7C15) | 1 } }
    fn next_u32(&mut self) -> u32 {
        self.state = self.state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        (self.state >> 33) as u32
    }
    fn uniform(&mut self) -> f32 { (self.next_u32() as f32 + 1.0) / (u32::MAX as f32 + 2.0) }
    fn gauss(&mut self) -> f32 {
        let u1 = self.uniform();
        let u2 = self.uniform();
        (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos()
    }
    // sample categorical from probability vector (must sum to 1)
    fn choice(&mut self, probs: &[f32]) -> usize {
        let r = self.uniform();
        let mut acc = 0.0;
        for (i, p) in probs.iter().enumerate() {
            acc += *p;
            if r <= acc { return i; }
        }
        probs.len() - 1
    }
}

fn randn_mat(rows: usize, cols: usize, scale: f32, rng: &mut Rng) -> Mat {
    let mut m = Mat::zeros(rows, cols);
    for v in m.data.iter_mut() { *v = rng.gauss() * scale; }
    m
}

struct Embedding {
    token_embed: Mat, // [vocab, d]
    pos_embed: Mat,   // [max_seq, d]
}

impl Embedding {
    fn new(vocab: usize, d: usize, max_seq: usize, rng: &mut Rng) -> Self {
        Embedding {
            token_embed: randn_mat(vocab, d, 0.02, rng),
            pos_embed: randn_mat(max_seq, d, 0.02, rng),
        }
    }
    fn forward(&self, ids: &[usize]) -> Mat {
        let n = ids.len();
        let d = self.token_embed.cols;
        let mut out = Mat::zeros(n, d);
        for (i, &t) in ids.iter().enumerate() {
            for j in 0..d {
                out.set(i, j, self.token_embed.at(t, j) + self.pos_embed.at(i, j));
            }
        }
        out
    }
}

struct LayerNorm {
    gamma: Vec<f32>,
    beta: Vec<f32>,
    eps: f32,
}

impl LayerNorm {
    fn new(d: usize) -> Self {
        LayerNorm { gamma: vec![1.0; d], beta: vec![0.0; d], eps: 1e-5 }
    }
    fn forward(&self, x: &Mat) -> Mat {
        let mut out = Mat::zeros(x.rows, x.cols);
        let d = x.cols as f32;
        for i in 0..x.rows {
            let base = i * x.cols;
            let mut mean = 0.0f32;
            for j in 0..x.cols { mean += x.data[base + j]; }
            mean /= d;
            let mut var = 0.0f32;
            for j in 0..x.cols {
                let dx = x.data[base + j] - mean;
                var += dx * dx;
            }
            var /= d;
            let inv = 1.0 / (var + self.eps).sqrt();
            for j in 0..x.cols {
                let n = (x.data[base + j] - mean) * inv;
                out.data[base + j] = self.gamma[j] * n + self.beta[j];
            }
        }
        out
    }
}

struct MultiHeadAttention {
    n_heads: usize,
    head_dim: usize,
    wq: Mat,
    wk: Mat,
    wv: Mat,
    wo: Mat,
}

impl MultiHeadAttention {
    fn new(d: usize, n_heads: usize, rng: &mut Rng) -> Self {
        assert_eq!(d % n_heads, 0);
        MultiHeadAttention {
            n_heads,
            head_dim: d / n_heads,
            wq: randn_mat(d, d, 0.02, rng),
            wk: randn_mat(d, d, 0.02, rng),
            wv: randn_mat(d, d, 0.02, rng),
            wo: randn_mat(d, d, 0.02, rng),
        }
    }

    // Causal MHA forward. mask = upper triangle of -1e9 baked into the inner loop.
    fn forward(&self, x: &Mat) -> Mat {
        let n = x.rows;
        let d = x.cols;
        let q = x.matmul(&self.wq);
        let k = x.matmul(&self.wk);
        let v = x.matmul(&self.wv);

        let mut attn_concat = Mat::zeros(n, d);
        let inv_sqrt = 1.0 / (self.head_dim as f32).sqrt();

        for h in 0..self.n_heads {
            let hoff = h * self.head_dim;
            // Per-head scores [n, n]
            let mut scores = vec![0.0f32; n * n];
            for i in 0..n {
                for j in 0..n {
                    let mut s = 0.0f32;
                    for kk in 0..self.head_dim {
                        s += q.at(i, hoff + kk) * k.at(j, hoff + kk);
                    }
                    scores[i * n + j] = s * inv_sqrt;
                    if j > i { scores[i * n + j] = -1e9; }
                }
            }
            // softmax row-wise
            for i in 0..n {
                let row = &mut scores[i * n..(i + 1) * n];
                let mut m = f32::NEG_INFINITY;
                for &v in row.iter() { if v > m { m = v; } }
                let mut s = 0.0f32;
                for v in row.iter_mut() { *v = (*v - m).exp(); s += *v; }
                let inv = 1.0 / s;
                for v in row.iter_mut() { *v *= inv; }
            }
            // weights @ V for this head, write into concat columns [hoff .. hoff + head_dim]
            for i in 0..n {
                for kk in 0..self.head_dim {
                    let mut s = 0.0f32;
                    for j in 0..n {
                        s += scores[i * n + j] * v.at(j, hoff + kk);
                    }
                    attn_concat.set(i, hoff + kk, s);
                }
            }
        }

        attn_concat.matmul(&self.wo)
    }
}

struct FeedForward {
    w1: Mat,
    b1: Vec<f32>,
    w2: Mat,
    b2: Vec<f32>,
}

impl FeedForward {
    fn new(d: usize, ff: usize, rng: &mut Rng) -> Self {
        FeedForward {
            w1: randn_mat(d, ff, 0.02, rng),
            b1: vec![0.0; ff],
            w2: randn_mat(ff, d, 0.02, rng),
            b2: vec![0.0; d],
        }
    }
    fn forward(&self, x: &Mat) -> Mat {
        let mut h = x.matmul(&self.w1);
        h.add_rowwise_(&self.b1);
        for v in h.data.iter_mut() { if *v < 0.0 { *v = 0.0; } } // ReLU
        let mut y = h.matmul(&self.w2);
        y.add_rowwise_(&self.b2);
        y
    }
}

struct Block {
    ln1: LayerNorm,
    attn: MultiHeadAttention,
    ln2: LayerNorm,
    ffn: FeedForward,
}

impl Block {
    fn new(d: usize, n_heads: usize, ff: usize, rng: &mut Rng) -> Self {
        Block {
            ln1: LayerNorm::new(d),
            attn: MultiHeadAttention::new(d, n_heads, rng),
            ln2: LayerNorm::new(d),
            ffn: FeedForward::new(d, ff, rng),
        }
    }
    fn forward(&self, x: &Mat) -> Mat {
        // pre-LN, residual
        let mut y = self.attn.forward(&self.ln1.forward(x));
        y.add_(x);
        let mut z = self.ffn.forward(&self.ln2.forward(&y));
        z.add_(&y);
        z
    }
}

struct MiniGPT {
    embedding: Embedding,
    blocks: Vec<Block>,
    ln_f: LayerNorm,
    vocab: usize,
    d_model: usize,
    max_seq: usize,
}

impl MiniGPT {
    fn new(vocab: usize, d: usize, n_heads: usize, n_layers: usize, max_seq: usize, ff: usize, rng: &mut Rng) -> Self {
        let embedding = Embedding::new(vocab, d, max_seq, rng);
        let blocks = (0..n_layers).map(|_| Block::new(d, n_heads, ff, rng)).collect();
        let ln_f = LayerNorm::new(d);
        MiniGPT { embedding, blocks, ln_f, vocab, d_model: d, max_seq }
    }

    fn forward(&self, ids: &[usize]) -> Mat {
        assert!(ids.len() <= self.max_seq);
        let mut x = self.embedding.forward(ids);
        for b in &self.blocks { x = b.forward(&x); }
        x = self.ln_f.forward(&x);
        // LM head shares token embedding matrix: logits = x @ token_embed^T
        // Compute directly into [n, vocab]. token_embed is [vocab, d_model].
        let n = x.rows;
        let mut logits = Mat::zeros(n, self.vocab);
        for i in 0..n {
            for t in 0..self.vocab {
                let mut s = 0.0f32;
                for j in 0..self.d_model {
                    s += x.at(i, j) * self.embedding.token_embed.at(t, j);
                }
                logits.set(i, t, s);
            }
        }
        logits
    }

    fn count_parameters(&self) -> usize {
        let mut total = self.embedding.token_embed.data.len() + self.embedding.pos_embed.data.len();
        for b in &self.blocks {
            total += b.attn.wq.data.len() + b.attn.wk.data.len() + b.attn.wv.data.len() + b.attn.wo.data.len();
            total += b.ffn.w1.data.len() + b.ffn.b1.len() + b.ffn.w2.data.len() + b.ffn.b2.len();
            total += b.ln1.gamma.len() + b.ln1.beta.len() + b.ln2.gamma.len() + b.ln2.beta.len();
        }
        total += self.ln_f.gamma.len() + self.ln_f.beta.len();
        total
    }
}

fn cross_entropy_loss(logits: &Mat, targets: &[usize]) -> f32 {
    let n = logits.rows;
    let v = logits.cols;
    assert_eq!(targets.len(), n, "targets length must equal logits rows");
    let mut total = 0.0f32;
    for i in 0..n {
        let row = &logits.data[i * v..(i + 1) * v];
        let t = targets[i];
        assert!(t < v, "target index out of range for logits cols");
        let mut m = f32::NEG_INFINITY;
        for &x in row { if x > m { m = x; } }
        let mut s = 0.0f32;
        for &x in row { s += (x - m).exp(); }
        let log_sum = s.ln();
        let log_softmax_t = row[t] - m - log_sum;
        total += -log_softmax_t;
    }
    total / n as f32
}

fn generate(model: &MiniGPT, prompt: &[usize], max_new: usize, temperature: f32, rng: &mut Rng) -> Vec<usize> {
    assert!(!prompt.is_empty(), "prompt must be non-empty");
    assert!(temperature > 0.0, "temperature must be > 0");
    let mut tokens: Vec<usize> = prompt.to_vec();
    let max_seq = model.max_seq;
    for _ in 0..max_new {
        let start = if tokens.len() > max_seq { tokens.len() - max_seq } else { 0 };
        let ctx = &tokens[start..];
        let logits = model.forward(ctx);
        let last_row = &logits.data[(ctx.len() - 1) * logits.cols..ctx.len() * logits.cols];
        let scaled: Vec<f32> = last_row.iter().map(|x| x / temperature).collect();
        let mut m = f32::NEG_INFINITY;
        for &x in &scaled { if x > m { m = x; } }
        let exps: Vec<f32> = scaled.iter().map(|x| (x - m).exp()).collect();
        let s: f32 = exps.iter().sum();
        let probs: Vec<f32> = exps.into_iter().map(|x| x / s).collect();
        let next = rng.choice(&probs);
        tokens.push(next);
    }
    tokens
}

fn parameter_breakdown() {
    println!("GPT-2 family parameter counts (analytical)");
    println!("{}", "=".repeat(65));
    println!("{:<16} {:>6} {:>6} {:>6} {:>14}", "Model", "Layers", "Heads", "Dims", "Params");
    println!("{}", "-".repeat(65));
    let configs: [(&str, usize, usize, usize, usize, usize, usize); 4] = [
        ("GPT-2 Small",  50257, 768,  12, 12, 1024, 3072),
        ("GPT-2 Medium", 50257, 1024, 16, 24, 1024, 4096),
        ("GPT-2 Large",  50257, 1280, 20, 36, 1024, 5120),
        ("GPT-2 XL",     50257, 1600, 25, 48, 1024, 6400),
    ];
    for (name, vocab, dim, heads, layers, seq_len, ff) in configs {
        let token_emb = vocab * dim;
        let pos_emb = seq_len * dim;
        let per_block_attn = 4 * dim * dim;
        let per_block_ff = 2 * dim * ff + dim + ff;
        let per_block_ln = 4 * dim;
        let per_block = per_block_attn + per_block_ff + per_block_ln;
        let final_ln = 2 * dim;
        let total = token_emb + pos_emb + layers * per_block + final_ln;
        println!("{:<16} {:>6} {:>6} {:>6} {:>14}", name, layers, heads, dim, total);
    }
    println!();
}

fn memory_estimate() {
    println!("Inference memory (FP16)");
    println!("{}", "=".repeat(65));
    println!("{:<24} {:>10} {:>12} {:>10}", "Model", "Weights", "KV Cache", "Total");
    println!("{}", "-".repeat(65));
    let models: [(&str, f64, usize, usize, usize, usize); 4] = [
        ("GPT-2 Small (124M)", 124e6,  12,  12,  64, 1024),
        ("Llama 3 8B",          8e9,  32,  32, 128, 8192),
        ("Llama 3 70B",        70e9,  80,  64, 128, 8192),
        ("Llama 3 405B",      405e9, 126, 128, 128, 131072),
    ];
    let fmt = |b: f64| -> String {
        if b >= 1e9 { format!("{:.1} GB", b / 1e9) } else { format!("{:.0} MB", b / 1e6) }
    };
    for (name, params, layers, heads, head_dim, max_seq) in models {
        let weight_bytes = params * 2.0;
        let kv_per_tok = 2.0 * layers as f64 * heads as f64 * head_dim as f64 * 2.0;
        let kv_full = kv_per_tok * max_seq as f64;
        let total = weight_bytes + kv_full;
        println!("{:<24} {:>10} {:>12} {:>10}", name, fmt(weight_bytes), fmt(kv_full), fmt(total));
    }
    println!();
}

fn main() {
    parameter_breakdown();
    memory_estimate();

    // Tiny demo on byte-level vocab.
    let corpus: &str = "The transformer architecture has revolutionized natural language processing. \
Attention mechanisms allow the model to focus on relevant parts of the input. \
Self-attention computes relationships between all pairs of positions in a sequence.";

    let tokens: Vec<usize> = corpus.bytes().map(|b| b as usize).collect();

    println!("=== Mini-GPT forward pass demo ===");
    let vocab = 256usize;
    let d_model = 32usize;
    let n_heads = 4usize;
    let n_layers = 2usize;
    let max_seq = 32usize;
    let ff = d_model * 4;

    let mut rng = Rng::new(42);
    let model = MiniGPT::new(vocab, d_model, n_heads, n_layers, max_seq, ff, &mut rng);
    println!("config: vocab={}, d={}, heads={}, layers={}, seq={}", vocab, d_model, n_heads, n_layers, max_seq);
    println!("parameters: {}", model.count_parameters());

    let input = &tokens[..max_seq.min(tokens.len() - 1)];
    let target: Vec<usize> = tokens[1..1 + input.len()].to_vec();

    let start = std::time::Instant::now();
    let logits = model.forward(input);
    let elapsed = start.elapsed();

    println!("forward pass: {} tokens -> logits shape ({}, {})",
        input.len(), logits.rows, logits.cols);
    println!("forward latency: {:.2}ms", elapsed.as_secs_f64() * 1000.0);

    let loss = cross_entropy_loss(&logits, &target);
    println!("cross-entropy loss vs next-token target: {:.4}", loss);
    println!("(random init loss ~ ln(vocab) = {:.4})", (vocab as f32).ln());

    // Generation demo with a random model is gibberish, but exercises the autoregressive loop.
    let prompt: Vec<usize> = "The ".bytes().map(|b| b as usize).collect();
    let mut gen_rng = Rng::new(123);
    let out = generate(&model, &prompt, 24, 1.0, &mut gen_rng);
    let bytes: Vec<u8> = out.iter().map(|&t| t as u8).collect();
    let s = String::from_utf8_lossy(&bytes);
    println!("\ngenerated (random weights, expect gibberish):");
    println!("  {:?}", s);

    println!("\n=== microbench: 50 forwards (n=32, d=32, 2 layers) ===");
    let start = std::time::Instant::now();
    let mut sink = 0.0f32;
    for _ in 0..50 {
        let l = model.forward(input);
        sink += l.at(0, 0);
    }
    let elapsed = start.elapsed();
    println!("50 forwards in {:.2}ms ({:.1}/sec)  sink={:.4}",
        elapsed.as_secs_f64() * 1000.0,
        50.0 / elapsed.as_secs_f64(),
        sink,
    );
}
