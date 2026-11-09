// Lesson: BERT: Masked Language Modeling (phase 07 / lesson 06)
// Rust port of code/main.py. Standard library only.
// Source: phases/07-transformers-deep-dive/06-bert-masked-language-modeling/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

struct Rng {
    state: u64,
}

impl Rng {
    fn new(seed: u64) -> Self {
        Rng { state: seed }
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

    fn randrange(&mut self, n: usize) -> usize {
        (self.random() * n as f64) as usize
    }
}

const MASK_ID: i64 = 0;
const CLS_ID: i64 = 1;
const SEP_ID: i64 = 2;
const IGNORE_INDEX: i64 = -100;

fn is_special(t: i64) -> bool {
    t == MASK_ID || t == CLS_ID || t == SEP_ID
}

fn create_mlm_batch(tokens: &[i64], vocab_size: usize, mask_prob: f64, rng: &mut Rng) -> (Vec<i64>, Vec<i64>) {
    let mut input_ids = tokens.to_vec();
    let mut labels = vec![IGNORE_INDEX; tokens.len()];
    for (i, &t) in tokens.iter().enumerate() {
        if is_special(t) {
            continue;
        }
        if rng.random() >= mask_prob {
            continue;
        }
        labels[i] = t;
        let r = rng.random();
        if r < 0.8 {
            input_ids[i] = MASK_ID;
        } else if r < 0.9 {
            let mut rand_id = t;
            while is_special(rand_id) || rand_id == t {
                rand_id = rng.randrange(vocab_size) as i64;
            }
            input_ids[i] = rand_id;
        }
    }
    (input_ids, labels)
}

fn whole_word_mlm(
    tokens: &[i64],
    word_spans: &[(usize, usize)],
    vocab_size: usize,
    mask_prob: f64,
    rng: &mut Rng,
) -> (Vec<i64>, Vec<i64>) {
    let mut input_ids = tokens.to_vec();
    let mut labels = vec![IGNORE_INDEX; tokens.len()];
    for &(start, end) in word_spans {
        if (start..end).any(|i| is_special(tokens[i])) {
            continue;
        }
        if rng.random() >= mask_prob {
            continue;
        }
        let r = rng.random();
        if r < 0.8 {
            for i in start..end {
                labels[i] = tokens[i];
                input_ids[i] = MASK_ID;
            }
        } else if r < 0.9 {
            for i in start..end {
                labels[i] = tokens[i];
                let mut rand_id = tokens[i];
                while is_special(rand_id) || rand_id == tokens[i] {
                    rand_id = rng.randrange(vocab_size) as i64;
                }
                input_ids[i] = rand_id;
            }
        } else {
            for i in start..end {
                labels[i] = tokens[i];
            }
        }
    }
    (input_ids, labels)
}

struct Stats {
    selected_pct: f64,
    masked_of_selected_pct: f64,
    random_of_selected_pct: f64,
    unchanged_of_selected_pct: f64,
}

fn distribution_check(n_tokens: usize, vocab_size: usize, mask_prob: f64, seed: u64) -> Stats {
    let mut rng = Rng::new(seed);
    let tokens: Vec<i64> = (0..n_tokens).map(|_| 3 + rng.randrange(vocab_size - 3) as i64).collect();
    let (input_ids, labels) = create_mlm_batch(&tokens, vocab_size, mask_prob, &mut rng);

    let pairs: Vec<(i64, i64)> = input_ids.iter().copied().zip(labels.iter().copied()).collect();
    let selected = labels.iter().filter(|&&l| l != IGNORE_INDEX).count();
    let masked = pairs.iter().filter(|&&(t, l)| l != IGNORE_INDEX && t == MASK_ID).count();
    let randomized = pairs.iter().filter(|&&(t, l)| l != IGNORE_INDEX && t != MASK_ID && t != l).count();
    let unchanged = pairs.iter().filter(|&&(t, l)| l != IGNORE_INDEX && t == l).count();

    let pct = |x: usize| if selected > 0 { 100.0 * x as f64 / selected as f64 } else { 0.0 };
    Stats {
        selected_pct: 100.0 * selected as f64 / n_tokens as f64,
        masked_of_selected_pct: pct(masked),
        random_of_selected_pct: pct(randomized),
        unchanged_of_selected_pct: pct(unchanged),
    }
}

fn toy_predict(masked_inputs: &[i64], vocab: &[&str]) -> Vec<Vec<f64>> {
    let v = vocab.len();
    masked_inputs.iter().map(|_| vec![1.0 / v as f64; v]).collect()
}

fn main() {
    let vocab_words = [
        "[MASK]", "[CLS]", "[SEP]", "the", "quick", "brown", "fox", "jumps", "over", "lazy", "dog", "a", "stitch", "in",
        "time", "saves", "nine", "sat", "on", "mat",
    ];
    let vocab_size = vocab_words.len();
    let id_of = |w: &str| vocab_words.iter().position(|&x| x == w).unwrap() as i64;

    let sentence = ["[CLS]", "the", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog", "[SEP]"];
    let tokens: Vec<i64> = sentence.iter().map(|w| id_of(w)).collect();
    let mut rng = Rng::new(42);
    let (inp, labels) = create_mlm_batch(&tokens, vocab_size, 0.5, &mut rng);

    println!("=== MLM masking demo (prob=0.5 so you can see it) ===");
    println!("{:>4}  {:>9}  {:>9}  {:>11}  {:>6}", "idx", "word", "input_id", "input_word", "label");
    for i in 0..tokens.len() {
        let (t_in, t_orig, lab) = (inp[i], tokens[i], labels[i]);
        println!(
            "{:>4}  {:>9}  {:>9}  {:>11}  {:>6}",
            i, vocab_words[t_orig as usize], t_in, vocab_words[t_in as usize], lab
        );
    }

    println!();
    println!("=== 80/10/10 distribution over 100k random tokens ===");
    let stats = distribution_check(100_000, vocab_size, 0.15, 42);
    println!("selected:                   {:.2}%   (target 15.0%)", stats.selected_pct);
    println!("  -> replaced with [MASK]:  {:.2}%   (target 80.0%)", stats.masked_of_selected_pct);
    println!("  -> replaced with random:  {:.2}%   (target 10.0%)", stats.random_of_selected_pct);
    println!("  -> left unchanged:        {:.2}%   (target 10.0%)", stats.unchanged_of_selected_pct);

    println!();
    println!("=== whole-word masking demo ===");
    let tokens2: Vec<i64> = sentence.iter().map(|w| id_of(w)).collect();
    let spans = [(0, 1), (1, 2), (2, 4), (4, 5), (5, 6), (6, 7), (7, 8), (8, 10), (10, 11)];
    let mut rng2 = Rng::new(7);
    let (inp2, labels2) = whole_word_mlm(&tokens2, &spans, vocab_size, 0.5, &mut rng2);
    let span_str: Vec<String> = spans.iter().map(|(s, e)| format!("[{}:{}]", s, e)).collect();
    println!("spans:        {}", span_str.join(" "));
    let words: Vec<&str> = inp2.iter().map(|&t| vocab_words[t as usize]).collect();
    println!("input words:  {}", words.join(" "));
    let marks: Vec<&str> = labels2.iter().map(|&l| if l != IGNORE_INDEX { "P" } else { "." }).collect();
    println!("label mask:   {}", marks.join(" "));
    println!("P = position has a label, . = ignored");

    let _ = toy_predict(&inp, &vocab_words);
}
