// Lesson: Data Pipelines for Pre-Training (phase 10 / lesson 03)
// Rust port of code/main.py. Standard library only.
// Source: phases/10-llms-from-scratch/03-data-pipelines/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

use std::collections::{BTreeSet, HashMap, HashSet};
use std::time::Instant;

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

    fn below(&mut self, n: usize) -> usize {
        (self.next_u64() % n as u64) as usize
    }

    fn shuffle<T>(&mut self, items: &mut [T]) {
        for i in (1..items.len()).rev() {
            let j = self.below(i + 1);
            items.swap(i, j);
        }
    }
}

const SHA256_K: [u32; 64] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

fn sha256(data: &[u8]) -> [u8; 32] {
    let mut h: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];
    let mut msg = data.to_vec();
    let bit_len = (data.len() as u64).wrapping_mul(8);
    msg.push(0x80);
    while msg.len() % 64 != 56 {
        msg.push(0);
    }
    msg.extend_from_slice(&bit_len.to_be_bytes());
    for chunk in msg.chunks(64) {
        let mut w = [0u32; 64];
        for i in 0..16 {
            w[i] = u32::from_be_bytes([chunk[4 * i], chunk[4 * i + 1], chunk[4 * i + 2], chunk[4 * i + 3]]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16].wrapping_add(s0).wrapping_add(w[i - 7]).wrapping_add(s1);
        }
        let mut v = h;
        for i in 0..64 {
            let s1 = v[4].rotate_right(6) ^ v[4].rotate_right(11) ^ v[4].rotate_right(25);
            let ch = (v[4] & v[5]) ^ (!v[4] & v[6]);
            let t1 = v[7].wrapping_add(s1).wrapping_add(ch).wrapping_add(SHA256_K[i]).wrapping_add(w[i]);
            let s0 = v[0].rotate_right(2) ^ v[0].rotate_right(13) ^ v[0].rotate_right(22);
            let maj = (v[0] & v[1]) ^ (v[0] & v[2]) ^ (v[1] & v[2]);
            let t2 = s0.wrapping_add(maj);
            v[7] = v[6];
            v[6] = v[5];
            v[5] = v[4];
            v[4] = v[3].wrapping_add(t1);
            v[3] = v[2];
            v[2] = v[1];
            v[1] = v[0];
            v[0] = t1.wrapping_add(t2);
        }
        for i in 0..8 {
            h[i] = h[i].wrapping_add(v[i]);
        }
    }
    let mut out = [0u8; 32];
    for (i, word) in h.iter().enumerate() {
        out[4 * i..4 * i + 4].copy_from_slice(&word.to_be_bytes());
    }
    out
}

const MD5_S: [u32; 64] = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15,
    21,
];

fn md5_hex(data: &[u8]) -> String {
    let k: Vec<u32> = (0..64).map(|i| ((i as f64 + 1.0).sin().abs() * 4294967296.0) as u32).collect();
    let mut a0: u32 = 0x67452301;
    let mut b0: u32 = 0xefcdab89;
    let mut c0: u32 = 0x98badcfe;
    let mut d0: u32 = 0x10325476;
    let mut msg = data.to_vec();
    let bit_len = (data.len() as u64).wrapping_mul(8);
    msg.push(0x80);
    while msg.len() % 64 != 56 {
        msg.push(0);
    }
    msg.extend_from_slice(&bit_len.to_le_bytes());
    for chunk in msg.chunks(64) {
        let m: Vec<u32> = (0..16)
            .map(|i| u32::from_le_bytes([chunk[4 * i], chunk[4 * i + 1], chunk[4 * i + 2], chunk[4 * i + 3]]))
            .collect();
        let (mut a, mut b, mut c, mut d) = (a0, b0, c0, d0);
        for i in 0..64 {
            let (f, g) = match i / 16 {
                0 => ((b & c) | (!b & d), i),
                1 => ((d & b) | (!d & c), (5 * i + 1) % 16),
                2 => (b ^ c ^ d, (3 * i + 5) % 16),
                _ => (c ^ (b | !d), (7 * i) % 16),
            };
            let f2 = f.wrapping_add(a).wrapping_add(k[i]).wrapping_add(m[g]);
            a = d;
            d = c;
            c = b;
            b = b.wrapping_add(f2.rotate_left(MD5_S[i]));
        }
        a0 = a0.wrapping_add(a);
        b0 = b0.wrapping_add(b);
        c0 = c0.wrapping_add(c);
        d0 = d0.wrapping_add(d);
    }
    [a0, b0, c0, d0].iter().flat_map(|x| x.to_le_bytes()).map(|byte| format!("{:02x}", byte)).collect()
}

fn big_to_decimal(value: &[u8; 32]) -> String {
    let mut digits = Vec::new();
    let mut num = value.to_vec();
    while num.iter().any(|&b| b != 0) {
        let mut rem: u32 = 0;
        for byte in num.iter_mut() {
            let cur = (rem << 8) | *byte as u32;
            *byte = (cur / 10) as u8;
            rem = cur % 10;
        }
        digits.push((b'0' + rem as u8) as char);
    }
    if digits.is_empty() {
        return "0".to_string();
    }
    digits.iter().rev().collect()
}

fn clean_text(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut no_tags = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '<' && i + 1 < chars.len() && chars[i + 1] != '>' {
            if let Some(off) = chars[i + 1..].iter().position(|&c| c == '>') {
                i += off + 2;
                continue;
            }
        }
        no_tags.push(chars[i]);
        i += 1;
    }

    let mut no_urls = Vec::new();
    let mut i = 0;
    while i < no_tags.len() {
        let starts_http = no_tags[i..].starts_with(&['h', 't', 't', 'p']);
        if starts_http && i + 4 < no_tags.len() && !no_tags[i + 4].is_whitespace() {
            i += 4;
            while i < no_tags.len() && !no_tags[i].is_whitespace() {
                i += 1;
            }
            continue;
        }
        no_urls.push(no_tags[i]);
        i += 1;
    }

    let printable: Vec<char> = no_urls.into_iter().filter(|&c| (' '..='~').contains(&c) || c == '\n').collect();

    let mut collapsed = String::new();
    let mut i = 0;
    while i < printable.len() {
        let c = printable[i];
        if c == '\n' || c == ' ' {
            let mut j = i;
            while j < printable.len() && printable[j] == c {
                j += 1;
            }
            let run = j - i;
            if c == '\n' && run >= 3 {
                collapsed.push_str("\n\n");
            } else if c == ' ' && run >= 2 {
                collapsed.push(' ');
            } else {
                for _ in 0..run {
                    collapsed.push(c);
                }
            }
            i = j;
            continue;
        }
        collapsed.push(c);
        i += 1;
    }
    collapsed.trim().to_string()
}

fn is_upper_word(w: &str) -> bool {
    let has_upper = w.chars().any(|c| c.is_uppercase());
    let has_lower = w.chars().any(|c| c.is_lowercase());
    has_upper && !has_lower
}

fn quality_filter(text: &str, min_words: usize, max_ratio_caps: f64, max_ratio_special: f64) -> bool {
    let words: Vec<&str> = text.split_whitespace().collect();
    if words.len() < min_words {
        return false;
    }
    let caps_ratio = words.iter().filter(|w| is_upper_word(w)).count() as f64 / words.len() as f64;
    if caps_ratio > max_ratio_caps {
        return false;
    }
    let special_chars = text.chars().filter(|c| !c.is_alphanumeric() && !c.is_whitespace()).count();
    if special_chars as f64 / text.chars().count().max(1) as f64 > max_ratio_special {
        return false;
    }
    true
}

fn get_shingles(text: &str, k: usize) -> HashSet<String> {
    let lower = text.to_lowercase();
    let words: Vec<&str> = lower.split_whitespace().collect();
    if words.len() < k {
        return HashSet::new();
    }
    (0..words.len() - k + 1).map(|i| words[i..i + k].join(" ")).collect()
}

fn minhash_signature(shingles: &HashSet<String>, num_hashes: usize) -> Vec<[u8; 32]> {
    let mut signature = Vec::new();
    for i in 0..num_hashes {
        let mut min_hash: Option<[u8; 32]> = None;
        for shingle in shingles {
            let h = sha256(format!("{}:{}", i, shingle).as_bytes());
            min_hash = Some(match min_hash {
                Some(m) if m <= h => m,
                _ => h,
            });
        }
        signature.push(min_hash.unwrap_or([0u8; 32]));
    }
    signature
}

fn lsh_buckets(signature: &[[u8; 32]], bands: usize) -> Vec<(usize, String)> {
    let rows_per_band = signature.len() / bands;
    let mut buckets = Vec::new();
    for b in 0..bands {
        let start = b * rows_per_band;
        let parts: Vec<String> = signature[start..start + rows_per_band].iter().map(big_to_decimal).collect();
        let band_str = if parts.len() == 1 {
            format!("({},)", parts[0])
        } else {
            format!("({})", parts.join(", "))
        };
        buckets.push((b, md5_hex(band_str.as_bytes())));
    }
    buckets
}

fn deduplicate(documents: &[String], threshold: f64, num_hashes: usize, bands: usize) -> (Vec<String>, usize) {
    let mut signatures = Vec::new();
    let mut shingle_sets = Vec::new();
    for doc in documents {
        let shingles = get_shingles(doc, 5);
        signatures.push(minhash_signature(&shingles, num_hashes));
        shingle_sets.push(shingles);
    }

    let mut bucket_map: HashMap<(usize, String), Vec<usize>> = HashMap::new();
    for (doc_idx, sig) in signatures.iter().enumerate() {
        for key in lsh_buckets(sig, bands) {
            bucket_map.entry(key).or_default().push(doc_idx);
        }
    }

    let mut duplicate_pairs: BTreeSet<(usize, usize)> = BTreeSet::new();
    for bucket_docs in bucket_map.values() {
        if bucket_docs.len() < 2 {
            continue;
        }
        for i in 0..bucket_docs.len() {
            for j in i + 1..bucket_docs.len() {
                duplicate_pairs.insert((bucket_docs[i], bucket_docs[j]));
            }
        }
    }

    let mut removed: HashSet<usize> = HashSet::new();
    for &(i, j) in &duplicate_pairs {
        if removed.contains(&i) || removed.contains(&j) {
            continue;
        }
        let (s1, s2) = (&shingle_sets[i], &shingle_sets[j]);
        if s1.is_empty() || s2.is_empty() {
            continue;
        }
        let inter = s1.intersection(s2).count();
        let union = s1.union(s2).count();
        let jaccard = inter as f64 / union as f64;
        if jaccard >= threshold {
            removed.insert(j);
        }
    }

    let kept = documents
        .iter()
        .enumerate()
        .filter(|(idx, _)| !removed.contains(idx))
        .map(|(_, d)| d.clone())
        .collect();
    (kept, removed.len())
}

#[allow(dead_code)]
struct SimpleTokenizer {
    vocab: HashMap<u32, Vec<u8>>,
    merges: Vec<((u32, u32), u32)>,
    next_id: u32,
    eos_id: u32,
    pad_id: u32,
}

fn merge_pair(tokens: &[u32], pair: (u32, u32), new_id: u32) -> Vec<u32> {
    let mut merged = Vec::with_capacity(tokens.len());
    let mut j = 0;
    while j < tokens.len() {
        if j < tokens.len() - 1 && tokens[j] == pair.0 && tokens[j + 1] == pair.1 {
            merged.push(new_id);
            j += 2;
        } else {
            merged.push(tokens[j]);
            j += 1;
        }
    }
    merged
}

impl SimpleTokenizer {
    fn new() -> Self {
        SimpleTokenizer {
            vocab: (0..256u32).map(|i| (i, vec![i as u8])).collect(),
            merges: Vec::new(),
            next_id: 256,
            eos_id: 0,
            pad_id: 0,
        }
    }

    fn train_bpe(&mut self, text: &str, num_merges: usize) {
        let mut tokens: Vec<u32> = text.bytes().map(|b| b as u32).collect();
        for _ in 0..num_merges {
            let mut order: Vec<((u32, u32), usize)> = Vec::new();
            let mut index: HashMap<(u32, u32), usize> = HashMap::new();
            for j in 0..tokens.len().saturating_sub(1) {
                let pair = (tokens[j], tokens[j + 1]);
                match index.get(&pair) {
                    Some(&at) => order[at].1 += 1,
                    None => {
                        index.insert(pair, order.len());
                        order.push((pair, 1));
                    }
                }
            }
            if order.is_empty() {
                break;
            }
            let mut best = order[0];
            for &entry in &order[1..] {
                if entry.1 > best.1 {
                    best = entry;
                }
            }
            let best = best.0;
            let new_id = self.next_id;
            self.next_id += 1;
            self.merges.push((best, new_id));
            let mut joined = self.vocab[&best.0].clone();
            joined.extend_from_slice(&self.vocab[&best.1]);
            self.vocab.insert(new_id, joined);
            tokens = merge_pair(&tokens, best, new_id);
        }

        self.eos_id = self.next_id;
        self.vocab.insert(self.eos_id, b"<EOS>".to_vec());
        self.next_id += 1;
    }

    fn encode(&self, text: &str) -> Vec<u32> {
        let mut tokens: Vec<u32> = text.bytes().map(|b| b as u32).collect();
        for &(pair, new_id) in &self.merges {
            tokens = merge_pair(&tokens, pair, new_id);
        }
        tokens
    }

    #[allow(dead_code)]
    fn decode(&self, ids: &[u32]) -> String {
        let mut bytes = Vec::new();
        for id in ids {
            if let Some(part) = self.vocab.get(id) {
                if *id != self.eos_id {
                    bytes.extend_from_slice(part);
                }
            }
        }
        String::from_utf8_lossy(&bytes).into_owned()
    }

    fn vocab_size(&self) -> usize {
        self.vocab.len()
    }
}

fn tokenize_corpus(documents: &[String], tokenizer: &SimpleTokenizer) -> Vec<u32> {
    let mut all_tokens = Vec::new();
    for doc in documents {
        all_tokens.extend(tokenizer.encode(doc));
        all_tokens.push(tokenizer.eos_id);
    }
    all_tokens
}

fn pack_sequences(token_ids: &[u32], seq_length: usize, pad_id: u32) -> (Vec<Vec<u32>>, Vec<Vec<u32>>) {
    let mut sequences = Vec::new();
    let mut attention_masks = Vec::new();
    for chunk in token_ids.chunks(seq_length) {
        let mut seq = chunk.to_vec();
        let mut mask = vec![1u32; seq.len()];
        if seq.len() < seq_length {
            let pad_count = seq_length - seq.len();
            seq.extend(std::iter::repeat(pad_id).take(pad_count));
            mask.extend(std::iter::repeat(0).take(pad_count));
        }
        sequences.push(seq);
        attention_masks.push(mask);
    }
    (sequences, attention_masks)
}

struct PreTrainingDataLoader<'a> {
    sequences: &'a [Vec<u32>],
    attention_masks: &'a [Vec<u32>],
    batch_size: usize,
    shuffle: bool,
}

type Batch = (Vec<Vec<u32>>, Vec<Vec<u32>>);

impl<'a> PreTrainingDataLoader<'a> {
    fn len(&self) -> usize {
        self.sequences.len().div_ceil(self.batch_size)
    }

    fn batches(&self, rng: &mut Rng) -> Vec<Batch> {
        let mut indices: Vec<usize> = (0..self.sequences.len()).collect();
        if self.shuffle {
            rng.shuffle(&mut indices);
        }
        indices
            .chunks(self.batch_size)
            .map(|batch_idx| {
                let seqs = batch_idx.iter().map(|&i| self.sequences[i].clone()).collect();
                let masks = batch_idx.iter().map(|&i| self.attention_masks[i].clone()).collect();
                (seqs, masks)
            })
            .collect()
    }
}

#[allow(dead_code)]
struct Stats {
    total_documents: usize,
    total_characters: usize,
    total_tokens: usize,
    unique_tokens: usize,
    vocab_utilization: f64,
    compression_ratio: f64,
    avg_doc_length_words: f64,
    max_doc_length_words: usize,
    min_doc_length_words: usize,
    num_sequences: usize,
    sequence_utilization: f64,
    top_10_tokens: Vec<(u32, usize)>,
}

fn compute_statistics(documents: &[String], token_ids: &[u32], sequences: &[Vec<u32>], tokenizer_vocab_size: usize) -> Stats {
    let total_chars: usize = documents.iter().map(|d| d.chars().count()).sum();
    let total_tokens = token_ids.len();
    let unique_tokens = token_ids.iter().collect::<HashSet<_>>().len();
    let compression_ratio = total_chars as f64 / total_tokens.max(1) as f64;

    let doc_lengths: Vec<usize> = documents.iter().map(|d| d.split_whitespace().count()).collect();
    let avg_doc_length = doc_lengths.iter().sum::<usize>() as f64 / doc_lengths.len().max(1) as f64;
    let max_doc_length = doc_lengths.iter().copied().max().unwrap_or(0);
    let min_doc_length = doc_lengths.iter().copied().min().unwrap_or(0);

    let mut counts: Vec<(u32, usize)> = Vec::new();
    let mut index: HashMap<u32, usize> = HashMap::new();
    for &t in token_ids {
        match index.get(&t) {
            Some(&at) => counts[at].1 += 1,
            None => {
                index.insert(t, counts.len());
                counts.push((t, 1));
            }
        }
    }
    counts.sort_by(|a, b| b.1.cmp(&a.1));
    let top_tokens: Vec<(u32, usize)> = counts.into_iter().take(10).collect();

    let non_pad_tokens: usize = sequences.iter().map(|seq| seq.iter().filter(|&&t| t != 0).count()).sum();
    let total_positions: usize = sequences.iter().map(|seq| seq.len()).sum();
    let utilization = non_pad_tokens as f64 / total_positions.max(1) as f64;

    Stats {
        total_documents: documents.len(),
        total_characters: total_chars,
        total_tokens,
        unique_tokens,
        vocab_utilization: unique_tokens as f64 / tokenizer_vocab_size.max(1) as f64,
        compression_ratio,
        avg_doc_length_words: avg_doc_length,
        max_doc_length_words: max_doc_length,
        min_doc_length_words: min_doc_length,
        num_sequences: sequences.len(),
        sequence_utilization: utilization,
        top_10_tokens: top_tokens,
    }
}

fn generate_sample_corpus() -> Vec<String> {
    let base_docs = [
        concat!(
            "Machine learning is a subset of artificial intelligence that provides systems the ability ",
            "to automatically learn and improve from experience without being explicitly programmed. ",
            "Machine learning focuses on the development of computer programs that can access data and ",
            "use it to learn for themselves. The process of learning begins with observations or data, ",
            "such as examples, direct experience, or instruction, in order to look for patterns in data ",
            "and make better decisions in the future based on the examples that we provide."
        ),
        concat!(
            "Deep learning is part of a broader family of machine learning methods based on artificial ",
            "neural networks with representation learning. Learning can be supervised, semi-supervised ",
            "or unsupervised. Deep learning architectures such as deep neural networks, recurrent neural ",
            "networks, convolutional neural networks and transformers have been applied to fields ",
            "including natural language processing, speech recognition, computer vision, and many other tasks."
        ),
        concat!(
            "Natural language processing is a subfield of linguistics, computer science, and artificial ",
            "intelligence concerned with the interactions between computers and human language, in ",
            "particular how to program computers to process and analyze large amounts of natural language ",
            "data. The result is a computer capable of understanding the contents of documents, including ",
            "the contextual nuances of the language within them."
        ),
        concat!(
            "Transformers are a type of neural network architecture that has become the dominant approach ",
            "for natural language processing tasks. The key innovation is the self-attention mechanism, ",
            "which allows the model to weigh the importance of different parts of the input when producing ",
            "each part of the output. This enables transformers to capture long-range dependencies in text ",
            "much more effectively than previous recurrent approaches."
        ),
        concat!(
            "The attention mechanism in neural networks allows the model to focus on relevant parts of ",
            "the input sequence when generating each element of the output. In the transformer architecture, ",
            "multi-head attention computes attention in parallel across multiple representation subspaces, ",
            "enabling the model to jointly attend to information from different representation subspaces ",
            "at different positions in the sequence."
        ),
        concat!(
            "Reinforcement learning is an area of machine learning concerned with how intelligent agents ",
            "ought to take actions in an environment in order to maximize the notion of cumulative reward. ",
            "Reinforcement learning is one of three basic machine learning paradigms, alongside supervised ",
            "learning and unsupervised learning. It differs from supervised learning in that correct input ",
            "and output pairs need not be presented."
        ),
        concat!(
            "Computer vision is an interdisciplinary scientific field that deals with how computers can ",
            "gain high-level understanding from digital images or videos. From the perspective of ",
            "engineering, it seeks to understand and automate tasks that the human visual system can do. ",
            "Computer vision tasks include methods for acquiring, processing, analyzing and understanding ",
            "digital images, and extraction of high-dimensional data from the real world."
        ),
        concat!(
            "Convolutional neural networks are a class of deep learning architecture commonly applied to ",
            "analyze visual imagery. They use a variation of multilayer perceptrons designed to require ",
            "minimal preprocessing. They are also known as shift invariant or space invariant artificial ",
            "neural networks based on their shared-weights architecture and translation invariance ",
            "characteristics. Convolutional networks were inspired by biological processes."
        ),
        concat!(
            "Generative adversarial networks consist of two neural networks that contest with each other ",
            "in the form of a zero-sum game, where one agent gain is another agent loss. Given a training ",
            "set, this technique learns to generate new data with the same statistics as the training set. ",
            "For example, a generative adversarial network trained on photographs can generate new ",
            "photographs that look authentic to human observers."
        ),
        concat!(
            "Transfer learning is a machine learning method where a model developed for a task is reused ",
            "as the starting point for a model on a second task. It is a popular approach in deep learning ",
            "where pre-trained models are used as the starting point on computer vision and natural language ",
            "processing tasks given the vast compute and time resources required to develop neural network ",
            "models on these problems and the large improvements they provide."
        ),
    ];

    let near_dup_1 = concat!(
        "Machine learning is a subset of artificial intelligence that provides systems the ability ",
        "to automatically learn and improve from experience. Machine learning focuses on developing ",
        "computer programs that can access data and use it to learn for themselves. The learning ",
        "process begins with observations or data, such as examples or direct experience, in order ",
        "to look for patterns and make better decisions based on the examples provided."
    );

    let near_dup_2 = concat!(
        "Deep learning is part of a broader family of machine learning methods based on artificial ",
        "neural networks with representation learning. Learning can be supervised, semi-supervised ",
        "or unsupervised. Deep learning architectures such as deep neural networks, recurrent neural ",
        "networks, convolutional neural networks and transformers have been applied to fields ",
        "including natural language processing, speech recognition, computer vision, and many other tasks."
    );

    let short_doc = "This is too short to be useful.";

    let html_doc = concat!(
        "<html><body><h1>Title</h1><p>Machine learning is transforming how we build software. ",
        "Deep neural networks can learn complex patterns from data. The transformer architecture ",
        "has become the dominant approach for language tasks. Self-attention allows models to capture ",
        "long-range dependencies. Pre-training on large corpora produces strong foundation models. ",
        "Fine-tuning adapts these models to specific tasks with minimal additional data.</p></body></html>"
    );

    let spam_doc = "BUY NOW CLICK HERE FREE MONEY GUARANTEED RESULTS ".repeat(20);

    let mut docs: Vec<String> = base_docs.iter().map(|s| s.to_string()).collect();
    docs.push(near_dup_1.to_string());
    docs.push(near_dup_2.to_string());
    docs.push(short_doc.to_string());
    docs.push(html_doc.to_string());
    docs.push(spam_doc);
    docs
}

fn group_digits(s: &str) -> String {
    let (sign, rest) = if let Some(r) = s.strip_prefix('-') { ("-", r) } else { ("", s) };
    let end = rest.find(|c: char| !c.is_ascii_digit()).unwrap_or(rest.len());
    let (int_part, tail) = rest.split_at(end);
    let mut out = String::new();
    for (i, ch) in int_part.chars().enumerate() {
        if i > 0 && (int_part.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(ch);
    }
    format!("{}{}{}", sign, out, tail)
}

fn list_str(v: &[u32]) -> String {
    let parts: Vec<String> = v.iter().map(|x| x.to_string()).collect();
    format!("[{}]", parts.join(", "))
}

fn run_pipeline() {
    let mut rng = Rng::new(42);
    println!("{}", "=".repeat(60));
    println!("Data Pipeline for Pre-Training");
    println!("{}", "=".repeat(60));

    let raw_docs = generate_sample_corpus();
    println!("\nRaw documents: {}", raw_docs.len());

    println!("\n--- Stage 1: Cleaning ---");
    let cleaned_docs: Vec<String> = raw_docs.iter().map(|d| clean_text(d)).collect();
    println!("After HTML stripping: {} documents", cleaned_docs.len());

    println!("\n--- Stage 2: Quality Filtering ---");
    let filtered_docs: Vec<String> = cleaned_docs.iter().filter(|d| quality_filter(d, 50, 0.3, 0.1)).cloned().collect();
    let removed_quality = cleaned_docs.len() - filtered_docs.len();
    println!("Removed {} low-quality documents", removed_quality);
    println!("Remaining: {} documents", filtered_docs.len());

    println!("\n--- Stage 3: Deduplication (MinHash + LSH) ---");
    let start = Instant::now();
    let (deduped_docs, num_removed) = deduplicate(&filtered_docs, 0.8, 128, 16);
    let dedup_time = start.elapsed().as_secs_f64();
    println!("Removed {} near-duplicates in {:.2}s", num_removed, dedup_time);
    println!("Remaining: {} documents", deduped_docs.len());

    println!("\n--- Stage 4: Tokenization ---");
    let all_text = deduped_docs.join(" ");
    let mut tokenizer = SimpleTokenizer::new();
    let start = Instant::now();
    tokenizer.train_bpe(&all_text, 100);
    let train_time = start.elapsed().as_secs_f64();
    println!("Trained tokenizer with {} tokens in {:.2}s", tokenizer.vocab_size(), train_time);

    let start = Instant::now();
    let token_ids = tokenize_corpus(&deduped_docs, &tokenizer);
    let tok_time = start.elapsed().as_secs_f64();
    println!(
        "Tokenized {} tokens in {:.2}s ({} tokens/sec)",
        group_digits(&token_ids.len().to_string()),
        tok_time,
        group_digits(&format!("{:.0}", token_ids.len() as f64 / tok_time.max(0.001)))
    );

    println!("\n--- Stage 5: Sequence Packing ---");
    let seq_length = 128;
    let (sequences, masks) = pack_sequences(&token_ids, seq_length, 0);
    println!("Packed into {} sequences of length {}", sequences.len(), seq_length);

    println!("\n--- Stage 6: DataLoader ---");
    let batch_size = 4;
    let loader = PreTrainingDataLoader {
        sequences: &sequences,
        attention_masks: &masks,
        batch_size,
        shuffle: true,
    };
    println!("DataLoader: {} batches of size {}", loader.len(), batch_size);

    let mut batch_count = 0;
    let mut total_tokens_served: u32 = 0;
    for (batch_seqs, batch_masks) in loader.batches(&mut rng) {
        batch_count += 1;
        total_tokens_served += batch_masks.iter().map(|m| m.iter().sum::<u32>()).sum::<u32>();
        if batch_count <= 2 {
            println!("\n  Batch {}:", batch_count);
            println!("    Sequences: {}", batch_seqs.len());
            println!("    First seq (first 20 tokens): {}...", list_str(&batch_seqs[0][..20.min(batch_seqs[0].len())]));
            println!("    First mask (first 20): {}...", list_str(&batch_masks[0][..20.min(batch_masks[0].len())]));
        }
    }
    println!("\n  Total batches served: {}", batch_count);
    println!("  Total non-padding tokens served: {}", group_digits(&total_tokens_served.to_string()));

    println!("\n--- Dataset Statistics ---");
    let stats = compute_statistics(&deduped_docs, &token_ids, &sequences, tokenizer.vocab_size());
    println!("  Documents:          {}", stats.total_documents);
    println!("  Total characters:   {}", group_digits(&stats.total_characters.to_string()));
    println!("  Total tokens:       {}", group_digits(&stats.total_tokens.to_string()));
    println!("  Unique tokens:      {}", stats.unique_tokens);
    println!("  Vocab utilization:  {:.1}%", stats.vocab_utilization * 100.0);
    println!("  Compression ratio:  {:.2} chars/token", stats.compression_ratio);
    println!("  Avg doc length:     {:.0} words", stats.avg_doc_length_words);
    println!("  Num sequences:      {}", stats.num_sequences);
    println!("  Seq utilization:    {:.1}%", stats.sequence_utilization * 100.0);

    println!("\n--- Pipeline Summary ---");
    println!("  Raw documents:       {}", raw_docs.len());
    println!("  After cleaning:      {}", cleaned_docs.len());
    println!("  After quality filter: {} (-{})", filtered_docs.len(), removed_quality);
    println!("  After dedup:         {} (-{})", deduped_docs.len(), num_removed);
    println!("  Final tokens:        {}", group_digits(&token_ids.len().to_string()));
    println!("  Training sequences:  {}", sequences.len());
    println!("  Training batches:    {}", loader.len());
}

fn main() {
    run_pipeline();
}
