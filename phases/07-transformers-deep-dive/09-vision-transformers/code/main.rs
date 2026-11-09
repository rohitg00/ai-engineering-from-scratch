// Lesson: Vision Transformers (ViT) (phase 07 / lesson 09)
// Rust port of code/main.py. Standard library only.
// Source: phases/07-transformers-deep-dive/09-vision-transformers/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

struct Rng {
    state: u64,
    spare: Option<f64>,
}

impl Rng {
    fn new(seed: u64) -> Self {
        let mut rng = Rng { state: seed, spare: None };
        rng.state = rng.next_u64();
        rng
    }

    fn next_u64(&mut self) -> u64 {
        self.state = self.state.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.state;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }

    fn random(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 / (1u64 << 53) as f64
    }

    fn randint(&mut self, lo: i64, hi: i64) -> i64 {
        lo + (self.random() * (hi - lo + 1) as f64) as i64
    }

    fn gauss(&mut self, mu: f64, sigma: f64) -> f64 {
        if let Some(z) = self.spare.take() {
            return mu + sigma * z;
        }
        let mut u1 = self.random();
        while u1 <= f64::MIN_POSITIVE {
            u1 = self.random();
        }
        let u2 = self.random();
        let r = (-2.0 * u1.ln()).sqrt();
        let theta = 2.0 * std::f64::consts::PI * u2;
        self.spare = Some(r * theta.sin());
        mu + sigma * r * theta.cos()
    }
}

type Image = Vec<Vec<Vec<f64>>>;

fn make_image(h: usize, w: usize, c: usize, seed: u64) -> Image {
    let mut rng = Rng::new(seed);
    (0..h)
        .map(|_| (0..w).map(|_| (0..c).map(|_| rng.randint(0, 255) as f64 / 255.0).collect()).collect())
        .collect()
}

fn patchify(image: &Image, patch_size: usize) -> (Vec<Vec<f64>>, (usize, usize)) {
    let h = image.len();
    let w = image[0].len();
    assert!(h % patch_size == 0 && w % patch_size == 0);
    let mut patches = Vec::new();
    let mut grid: Vec<Vec<(usize, usize)>> = Vec::new();
    for (row_idx, i) in (0..h).step_by(patch_size).enumerate() {
        let mut grid_row = Vec::new();
        for (col_idx, j) in (0..w).step_by(patch_size).enumerate() {
            let mut patch = Vec::new();
            for di in 0..patch_size {
                for dj in 0..patch_size {
                    patch.extend_from_slice(&image[i + di][j + dj]);
                }
            }
            patches.push(patch);
            grid_row.push((row_idx, col_idx));
        }
        grid.push(grid_row);
    }
    (patches, (h / patch_size, w / patch_size))
}

fn linear_project(patches: &[Vec<f64>], d_model: usize, rng: &mut Rng) -> (Vec<Vec<f64>>, Vec<Vec<f64>>) {
    let in_dim = patches[0].len();
    let scale = (2.0 / (in_dim + d_model) as f64).sqrt();
    let w: Vec<Vec<f64>> = (0..in_dim).map(|_| (0..d_model).map(|_| rng.gauss(0.0, scale)).collect()).collect();
    let mut out = Vec::new();
    for patch in patches {
        let mut row = vec![0.0; d_model];
        for (i, &x) in patch.iter().enumerate() {
            if x == 0.0 {
                continue;
            }
            for j in 0..d_model {
                row[j] += x * w[i][j];
            }
        }
        out.push(row);
    }
    (out, w)
}

fn cls_and_pos(tokens: &[Vec<f64>], grid_h: usize, grid_w: usize, rng: &mut Rng) -> Vec<Vec<f64>> {
    let d_model = tokens[0].len();
    let cls: Vec<f64> = (0..d_model).map(|_| rng.gauss(0.0, 0.02)).collect();
    let pe = pos_2d(grid_h, grid_w, d_model);
    let mut out = vec![cls];
    let mut idx = 0;
    for i in 0..grid_h {
        for j in 0..grid_w {
            let t: Vec<f64> = (0..d_model).map(|k| tokens[idx][k] + pe[i][j][k]).collect();
            out.push(t);
            idx += 1;
        }
    }
    out
}

fn pos_2d(h: usize, w: usize, d_model: usize) -> Image {
    assert!(d_model % 4 == 0, "d_model must be divisible by 4 for 2D sinusoidal");
    let half = d_model / 2;
    let mut pe = vec![vec![vec![0.0; d_model]; w]; h];
    for i in 0..h {
        for j in 0..w {
            for k in 0..half / 2 {
                let theta_row = i as f64 / 10000f64.powf((2 * k) as f64 / half as f64);
                pe[i][j][2 * k] = theta_row.sin();
                pe[i][j][2 * k + 1] = theta_row.cos();
            }
            for k in 0..half / 2 {
                let theta_col = j as f64 / 10000f64.powf((2 * k) as f64 / half as f64);
                pe[i][j][half + 2 * k] = theta_col.sin();
                pe[i][j][half + 2 * k + 1] = theta_col.cos();
            }
        }
    }
    pe
}

fn param_count_vit(
    d_model: u64,
    n_layers: u64,
    _n_heads: u64,
    ffn_expansion: u64,
    num_patches: u64,
    num_classes: u64,
) -> u64 {
    let per_layer = 4 * d_model * d_model + 2 * d_model * (ffn_expansion * d_model) + 4 * d_model;
    let pos_emb = (num_patches + 1) * d_model;
    let head = d_model * num_classes;
    per_layer * n_layers + pos_emb + d_model + head + 2 * d_model
}

fn main() {
    let (h, w, c) = (24, 24, 3);
    let patch_size = 6;
    let d_model = 48;

    let image = make_image(h, w, c, 0);
    let (patches, grid) = patchify(&image, patch_size);
    let (tokens, _w_proj) = linear_project(&patches, d_model, &mut Rng::new(42));
    let tokens_with_pos = cls_and_pos(&tokens, grid.0, grid.1, &mut Rng::new(7));

    println!("=== ViT front-end sanity ===");
    println!("image:               ({}, {}, {})", h, w, c);
    println!("patch size:          {}x{}", patch_size, patch_size);
    println!("grid:                {} x {} = {} patches", grid.0, grid.1, grid.0 * grid.1);
    println!("flat patch size:     {}", patch_size * patch_size * c);
    println!("d_model:             {}", d_model);
    println!("sequence length:     {}  (patches + CLS)", tokens_with_pos.len());
    println!("cell [0,0] of CLS:   {:.4}", tokens_with_pos[0][0]);
    println!("cell [0,0] of p1:    {:.4}", tokens_with_pos[1][0]);
    println!();

    println!("=== parameter counts (approximate) ===");
    let configs: [(&str, u64, u64, u64, u64, u64); 5] = [
        ("ViT-Tiny/16", 192, 12, 3, 4, 16),
        ("ViT-Small/16", 384, 12, 6, 4, 16),
        ("ViT-Base/16", 768, 12, 12, 4, 16),
        ("ViT-Large/16", 1024, 24, 16, 4, 16),
        ("ViT-Huge/14", 1280, 32, 16, 4, 14),
    ];
    for (name, d, l, h_heads, exp, patch) in configs {
        let grid_n = (224 / patch) * (224 / patch);
        let mut params = param_count_vit(d, l, h_heads, exp, grid_n, 1000);
        params += patch * patch * 3 * d;
        println!(
            "  {:<14}  d={:<5}  L={:<3}  heads={:<3}  patches={:<4}  ~{:.1}M params",
            name,
            d,
            l,
            h_heads,
            grid_n,
            params as f64 / 1e6
        );
    }

    println!();
    println!("takeaway: vit reuses the bert encoder verbatim; all the vision smarts live");
    println!("in patchify + positional scheme + [cls] pooling.");
}
