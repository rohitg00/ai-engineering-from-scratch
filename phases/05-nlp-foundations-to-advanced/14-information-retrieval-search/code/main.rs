// Lesson: Information Retrieval and Search (phase 05 / lesson 14)
// Rust port of code/main.py. Standard library only.
// Source: phases/05-nlp-foundations-to-advanced/14-information-retrieval-search/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

use std::collections::{HashMap, HashSet};

fn tokenize(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut current = String::new();
    for c in text.to_lowercase().chars() {
        if c.is_ascii_lowercase() || c.is_ascii_digit() {
            current.push(c);
        } else if !current.is_empty() {
            out.push(std::mem::take(&mut current));
        }
    }
    if !current.is_empty() {
        out.push(current);
    }
    out
}

struct Bm25 {
    corpus: Vec<Vec<String>>,
    k1: f64,
    b: f64,
    n_docs: usize,
    avg_dl: f64,
    df: HashMap<String, usize>,
}

impl Bm25 {
    fn new(corpus: &[&str], k1: f64, b: f64) -> Bm25 {
        if corpus.is_empty() {
            panic!("BM25 corpus must not be empty");
        }
        let corpus: Vec<Vec<String>> = corpus.iter().map(|d| tokenize(d)).collect();
        let n_docs = corpus.len();
        let avg_dl = corpus.iter().map(|d| d.len()).sum::<usize>() as f64 / n_docs as f64;
        let mut df = HashMap::new();
        for doc in &corpus {
            let unique: HashSet<&String> = doc.iter().collect();
            for term in unique {
                *df.entry(term.clone()).or_insert(0) += 1;
            }
        }
        Bm25 { corpus, k1, b, n_docs, avg_dl, df }
    }

    fn idf(&self, term: &str) -> f64 {
        let n = *self.df.get(term).unwrap_or(&0) as f64;
        (1.0 + (self.n_docs as f64 - n + 0.5) / (n + 0.5)).ln()
    }

    fn score(&self, query: &str, doc_idx: usize) -> f64 {
        let doc = &self.corpus[doc_idx];
        let dl = doc.len() as f64;
        let mut freq: HashMap<&str, usize> = HashMap::new();
        for t in doc {
            *freq.entry(t.as_str()).or_insert(0) += 1;
        }
        let mut total = 0.0;
        for term in tokenize(query) {
            let f = *freq.get(term.as_str()).unwrap_or(&0) as f64;
            if f == 0.0 {
                continue;
            }
            let num = f * (self.k1 + 1.0);
            let den = f + self.k1 * (1.0 - self.b + self.b * dl / self.avg_dl);
            total += self.idf(&term) * num / den;
        }
        total
    }

    fn rank(&self, query: &str, top_k: usize) -> Vec<(f64, usize)> {
        let mut scored: Vec<(f64, usize)> = (0..self.n_docs).map(|i| (self.score(query, i), i)).collect();
        sort_desc(&mut scored);
        scored.truncate(top_k);
        scored
    }
}

fn sort_desc(v: &mut [(f64, usize)]) {
    v.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap().then(b.1.cmp(&a.1)));
}

fn reciprocal_rank_fusion(rankings: &[Vec<(f64, usize)>], k: f64) -> Vec<(f64, usize)> {
    let mut order: Vec<usize> = Vec::new();
    let mut scores: HashMap<usize, f64> = HashMap::new();
    for ranking in rankings {
        for (rank, &(_, doc_idx)) in ranking.iter().enumerate() {
            if !scores.contains_key(&doc_idx) {
                order.push(doc_idx);
            }
            *scores.entry(doc_idx).or_insert(0.0) += 1.0 / (k + rank as f64 + 1.0);
        }
    }
    let mut fused: Vec<(f64, usize)> = order.iter().map(|&d| (scores[&d], d)).collect();
    fused.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap());
    fused
}

fn fake_dense_rank(query: &str, corpus: &[&str], top_k: usize) -> Vec<(f64, usize)> {
    let q_tokens: HashSet<String> = tokenize(query).into_iter().collect();
    let mut scored = Vec::new();
    for (i, d) in corpus.iter().enumerate() {
        let d_tokens: HashSet<String> = tokenize(d).into_iter().collect();
        if d_tokens.is_empty() || q_tokens.is_empty() {
            scored.push((0.0, i));
            continue;
        }
        let inter = q_tokens.intersection(&d_tokens).count() as f64;
        let union = q_tokens.union(&d_tokens).count() as f64;
        let jaccard = inter / union;
        let mut expansion = 0.0;
        for qt in &q_tokens {
            for dt in &d_tokens {
                if qt != dt && qt.len().min(dt.len()) >= 4 && (dt.contains(qt.as_str()) || qt.contains(dt.as_str())) {
                    expansion += 0.15;
                }
            }
        }
        scored.push((jaccard + expansion, i));
    }
    sort_desc(&mut scored);
    scored.truncate(top_k);
    scored
}

fn main() {
    let corpus = [
        "Apple Inc. released the first iPhone on June 29, 2007.",
        "Macworld 2007 featured the iPhone announcement by Steve Jobs.",
        "Android launched in 2008 as Google's mobile smartphone operating system.",
        "The first iPod was released by Apple in 2001.",
        "Section 420 of the Indian Penal Code covers cheating and dishonest inducement.",
        "Fraud refers to wrongful or criminal deception intended to result in financial gain.",
        "Cheating someone to obtain money is a criminal offence in most jurisdictions.",
    ];

    let bm25 = Bm25::new(&corpus, 1.5, 0.75);

    let query = "what happens if someone lies to get money";
    println!("query: {}\n", query);

    let sparse = bm25.rank(query, 5);
    println!("BM25 (sparse):");
    for (score, idx) in &sparse {
        println!("  {:.3}  {}", score, corpus[*idx]);
    }
    println!();

    let dense = fake_dense_rank(query, &corpus, 5);
    println!("fake-dense (shape demonstration):");
    for (score, idx) in &dense {
        println!("  {:.3}  {}", score, corpus[*idx]);
    }
    println!();

    let mut fused = reciprocal_rank_fusion(&[sparse, dense], 60.0);
    fused.truncate(5);
    println!("RRF fused:");
    for (score, idx) in &fused {
        println!("  {:.4}  {}", score, corpus[*idx]);
    }

    println!();
    println!("note: this code uses a toy 'fake-dense' ranker for teaching.");
    println!("real dense retrieval needs a sentence-transformer encoder; see docs/en.md.");
}
