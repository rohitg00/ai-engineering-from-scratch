// Multi-head attention + grouped-query attention, stdlib only.
// Topic: head split, per-head scaled dot-product attention, concat, output projection.
// References (cited in spirit, not as deps):
//   - Vaswani 2017:                  https://arxiv.org/abs/1706.03762
//   - GQA paper (Ainslie 2023):      https://arxiv.org/abs/2305.13245
//   - candle multi-head impl:        https://github.com/huggingface/candle/blob/main/candle-transformers/src/models/llama.rs
//   - llm.c attention forward:       https://github.com/karpathy/llm.c/blob/master/train_gpt2.c
//
// Compile + run:  rustc --edition 2021 main.rs -o /tmp/mha && /tmp/mha

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

    fn transpose(&self) -> Mat {
        let mut t = Mat::zeros(self.cols, self.rows);
        for i in 0..self.rows {
            for j in 0..self.cols { t.set(j, i, self.at(i, j)); }
        }
        t
    }

    fn scale_in_place(&mut self, s: f32) {
        for v in self.data.iter_mut() { *v *= s; }
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
        (-2.0 * u1.ln()).sqrt() * (2.0 * std::f32::consts::PI * u2).cos()
    }
}

fn randn(rows: usize, cols: usize, rng: &mut Rng) -> Mat {
    let scale = (2.0 / (rows + cols) as f32).sqrt();
    let mut m = Mat::zeros(rows, cols);
    for v in m.data.iter_mut() { *v = rng.gauss() * scale; }
    m
}

fn randn_unit(rows: usize, cols: usize, rng: &mut Rng) -> Mat {
    let mut m = Mat::zeros(rows, cols);
    for v in m.data.iter_mut() { *v = rng.gauss(); }
    m
}

fn softmax_rows(m: &Mat) -> Mat {
    let mut out = Mat::zeros(m.rows, m.cols);
    for i in 0..m.rows {
        let mut row_max = f32::NEG_INFINITY;
        for j in 0..m.cols { if m.at(i, j) > row_max { row_max = m.at(i, j); } }
        let mut sum = 0.0f32;
        for j in 0..m.cols {
            let e = (m.at(i, j) - row_max).exp();
            out.set(i, j, e);
            sum += e;
        }
        let inv = 1.0 / sum;
        for j in 0..m.cols { let v = out.at(i, j) * inv; out.set(i, j, v); }
    }
    out
}

fn scaled_dot_product_attention(q: &Mat, k: &Mat, v: &Mat) -> (Mat, Mat) {
    let dk = q.cols as f32;
    let kt = k.transpose();
    let mut scores = q.matmul(&kt);
    scores.scale_in_place(1.0 / dk.sqrt());
    let weights = softmax_rows(&scores);
    let out = weights.matmul(v);
    (out, weights)
}

// Split [n, d_model] into n_heads chunks of [n, d_head] along the last axis.
fn split_heads(x: &Mat, n_heads: usize) -> Vec<Mat> {
    assert_eq!(x.cols % n_heads, 0, "d_model {} not divisible by n_heads {}", x.cols, n_heads);
    let d_head = x.cols / n_heads;
    let mut heads = Vec::with_capacity(n_heads);
    for h in 0..n_heads {
        let mut hm = Mat::zeros(x.rows, d_head);
        for i in 0..x.rows {
            for j in 0..d_head {
                hm.set(i, j, x.at(i, h * d_head + j));
            }
        }
        heads.push(hm);
    }
    heads
}

// Concat n_heads chunks of [n, d_head] back to [n, n_heads * d_head].
fn combine_heads(heads: &[Mat]) -> Mat {
    let n = heads[0].rows;
    let d_head = heads[0].cols;
    let n_heads = heads.len();
    let mut out = Mat::zeros(n, d_head * n_heads);
    for (h, head) in heads.iter().enumerate() {
        for i in 0..n {
            for j in 0..d_head {
                out.set(i, h * d_head + j, head.at(i, j));
            }
        }
    }
    out
}

fn multi_head_attention(
    x: &Mat,
    wq: &Mat, wk: &Mat, wv: &Mat, wo: &Mat,
    n_heads: usize,
) -> (Mat, Vec<Mat>) {
    let q = x.matmul(wq);
    let k = x.matmul(wk);
    let v = x.matmul(wv);
    let qh = split_heads(&q, n_heads);
    let kh = split_heads(&k, n_heads);
    let vh = split_heads(&v, n_heads);

    let mut head_outs: Vec<Mat> = Vec::with_capacity(n_heads);
    let mut per_head_weights: Vec<Mat> = Vec::with_capacity(n_heads);
    for h in 0..n_heads {
        let (o, w) = scaled_dot_product_attention(&qh[h], &kh[h], &vh[h]);
        head_outs.push(o);
        per_head_weights.push(w);
    }
    let concat = combine_heads(&head_outs);
    (concat.matmul(wo), per_head_weights)
}

// GQA: Q has n_heads, K and V have n_kv_heads. Replicate each KV head across its group.
fn grouped_query_attention(
    x: &Mat,
    wq: &Mat, wk: &Mat, wv: &Mat, wo: &Mat,
    n_heads: usize, n_kv_heads: usize,
) -> Mat {
    assert_eq!(n_heads % n_kv_heads, 0, "n_heads must be a multiple of n_kv_heads");
    let q = x.matmul(wq);
    let k = x.matmul(wk);
    let v = x.matmul(wv);
    let qh = split_heads(&q, n_heads);
    let kh_small = split_heads(&k, n_kv_heads);
    let vh_small = split_heads(&v, n_kv_heads);
    let repeat = n_heads / n_kv_heads;

    let mut head_outs: Vec<Mat> = Vec::with_capacity(n_heads);
    for i in 0..n_heads {
        let kv_idx = i / repeat;
        let (o, _) = scaled_dot_product_attention(&qh[i], &kh_small[kv_idx], &vh_small[kv_idx]);
        head_outs.push(o);
    }
    let concat = combine_heads(&head_outs);
    concat.matmul(wo)
}

fn print_head_weights(weights: &Mat, tokens: &[&str]) {
    print!("      ");
    for t in tokens { print!("{:>7}", t); }
    println!();
    for i in 0..weights.rows {
        print!("{:>6}", tokens[i]);
        for j in 0..weights.cols { print!("{:>7.3}", weights.at(i, j)); }
        println!();
    }
}

fn main() {
    let tokens = ["the", "cat", "sat", "on", "the", "mat"];
    let n = tokens.len();
    let d_model: usize = 8;
    let n_heads: usize = 2;

    let mut rng = Rng::new(42);
    let x = randn_unit(n, d_model, &mut rng);
    let wq = randn(d_model, d_model, &mut rng);
    let wk = randn(d_model, d_model, &mut rng);
    let wv = randn(d_model, d_model, &mut rng);
    let wo = randn(d_model, d_model, &mut rng);

    let (out, weights) = multi_head_attention(&x, &wq, &wk, &wv, &wo, n_heads);

    println!("=== multi-head attention: {} heads, d_model={}, d_head={} ===",
        n_heads, d_model, d_model / n_heads);
    println!("input  shape: ({}, {})", x.rows, x.cols);
    println!("output shape: ({}, {})", out.rows, out.cols);
    println!();
    for (h, w) in weights.iter().enumerate() {
        println!("-- head {} attention weights --", h);
        print_head_weights(w, &tokens);
        println!();
    }

    // GQA demo: 4 Q heads, 2 KV heads.
    let d_model = 8usize;
    let n_heads = 4usize;
    let n_kv = 2usize;
    let d_head = d_model / n_heads;
    let kv_dim = d_head * n_kv;

    let mut rng = Rng::new(7);
    let x = randn_unit(n, d_model, &mut rng);
    let wq = randn(d_model, d_model, &mut rng);
    let wk = randn(d_model, kv_dim, &mut rng);
    let wv = randn(d_model, kv_dim, &mut rng);
    let wo = randn(d_model, d_model, &mut rng);

    let out_gqa = grouped_query_attention(&x, &wq, &wk, &wv, &wo, n_heads, n_kv);
    println!("=== GQA: {} Q heads, {} KV heads ===", n_heads, n_kv);
    println!("output shape: ({}, {})", out_gqa.rows, out_gqa.cols);

    let kv_full = n_heads * n * d_head * 2;
    let kv_gqa = n_kv * n * d_head * 2;
    println!("KV cache elements (MHA):  {}", kv_full);
    println!("KV cache elements (GQA):  {}  ({}x smaller)", kv_gqa, kv_full / kv_gqa);

    println!();
    println!("=== microbench: 5K MHA forwards (n=6, d=8, 2 heads) ===");
    let mut rng = Rng::new(13);
    let x_b = randn_unit(n, d_model, &mut rng);
    let wq_b = randn(d_model, d_model, &mut rng);
    let wk_b = randn(d_model, d_model, &mut rng);
    let wv_b = randn(d_model, d_model, &mut rng);
    let wo_b = randn(d_model, d_model, &mut rng);
    let start = std::time::Instant::now();
    let mut sink = 0.0f32;
    for _ in 0..5_000 {
        let (o, _) = multi_head_attention(&x_b, &wq_b, &wk_b, &wv_b, &wo_b, 2);
        sink += o.at(0, 0);
    }
    let elapsed = start.elapsed();
    println!("5K forwards in {:.2}ms ({:.0}/sec)  sink={:.4}",
        elapsed.as_secs_f64() * 1000.0,
        5_000.0 / elapsed.as_secs_f64(),
        sink,
    );
}
