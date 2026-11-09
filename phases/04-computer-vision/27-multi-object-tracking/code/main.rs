// Lesson: Multi-Object Tracking (phase 04 / lesson 27)
// Rust port of code/main.py. Standard library only.
// Source: phases/04-computer-vision/27-multi-object-tracking/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

use std::collections::{HashMap, HashSet};

type BBox = [f32; 4];

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

    fn uniform(&mut self, low: f64, high: f64) -> f64 {
        low + (high - low) * self.random()
    }
}

fn bbox_iou(a: &[BBox], b: &[BBox]) -> Vec<Vec<f32>> {
    a.iter()
        .map(|x| {
            b.iter()
                .map(|y| {
                    let iw = (x[2].min(y[2]) - x[0].max(y[0])).max(0.0);
                    let ih = (x[3].min(y[3]) - x[1].max(y[1])).max(0.0);
                    let inter = iw * ih;
                    let area_a = (x[2] - x[0]) * (x[3] - x[1]);
                    let area_b = (y[2] - y[0]) * (y[3] - y[1]);
                    let union = area_a + area_b - inter;
                    inter / union.max(1e-8)
                })
                .collect()
        })
        .collect()
}

fn hungarian_square_or_wide(cost: &[Vec<f64>]) -> Vec<(usize, usize)> {
    let n = cost.len();
    let m = cost[0].len();
    let inf = f64::INFINITY;
    let mut u = vec![0.0; n + 1];
    let mut v = vec![0.0; m + 1];
    let mut p = vec![0usize; m + 1];
    let mut way = vec![0usize; m + 1];
    for i in 1..=n {
        p[0] = i;
        let mut j0 = 0usize;
        let mut minv = vec![inf; m + 1];
        let mut used = vec![false; m + 1];
        loop {
            used[j0] = true;
            let i0 = p[j0];
            let mut delta = inf;
            let mut j1 = 0usize;
            for j in 1..=m {
                if !used[j] {
                    let cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
                    if cur < minv[j] {
                        minv[j] = cur;
                        way[j] = j0;
                    }
                    if minv[j] < delta {
                        delta = minv[j];
                        j1 = j;
                    }
                }
            }
            for j in 0..=m {
                if used[j] {
                    u[p[j]] += delta;
                    v[j] -= delta;
                } else {
                    minv[j] -= delta;
                }
            }
            j0 = j1;
            if p[j0] == 0 {
                break;
            }
        }
        loop {
            let j1 = way[j0];
            p[j0] = p[j1];
            j0 = j1;
            if j0 == 0 {
                break;
            }
        }
    }
    let mut pairs: Vec<(usize, usize)> = (1..=m).filter(|&j| p[j] != 0).map(|j| (p[j] - 1, j - 1)).collect();
    pairs.sort();
    pairs
}

fn linear_sum_assignment(cost: &[Vec<f64>]) -> Vec<(usize, usize)> {
    let rows = cost.len();
    let cols = cost.first().map_or(0, |r| r.len());
    if rows == 0 || cols == 0 {
        return Vec::new();
    }
    if rows <= cols {
        return hungarian_square_or_wide(cost);
    }
    let transposed: Vec<Vec<f64>> = (0..cols).map(|c| (0..rows).map(|r| cost[r][c]).collect()).collect();
    let mut pairs: Vec<(usize, usize)> = hungarian_square_or_wide(&transposed).into_iter().map(|(c, r)| (r, c)).collect();
    pairs.sort();
    pairs
}

#[allow(dead_code)]
struct Track {
    id: usize,
    bbox: BBox,
    last_frame: usize,
    hits: usize,
}

impl Track {
    fn new(id: usize, bbox: BBox, frame: usize) -> Self {
        Track { id, bbox, last_frame: frame, hits: 1 }
    }

    fn update(&mut self, bbox: BBox, frame: usize) {
        self.bbox = bbox;
        self.last_frame = frame;
        self.hits += 1;
    }
}

struct SimpleTracker {
    tracks: Vec<Track>,
    next_id: usize,
    iou_threshold: f32,
    max_age: usize,
}

impl SimpleTracker {
    fn new(iou_threshold: f32, max_age: usize) -> Self {
        SimpleTracker { tracks: Vec::new(), next_id: 1, iou_threshold, max_age }
    }

    fn snapshot(&self) -> Vec<(usize, BBox)> {
        self.tracks.iter().map(|t| (t.id, t.bbox)).collect()
    }

    fn step(&mut self, dets: &[BBox], frame: usize) -> Vec<(usize, BBox)> {
        if self.tracks.is_empty() {
            for d in dets {
                self.tracks.push(Track::new(self.next_id, *d, frame));
                self.next_id += 1;
            }
            return self.snapshot();
        }

        let track_boxes: Vec<BBox> = self.tracks.iter().map(|t| t.bbox).collect();
        let iou = bbox_iou(&track_boxes, dets);
        let cost: Vec<Vec<f64>> = iou
            .iter()
            .map(|row| row.iter().map(|&x| if x < self.iou_threshold { 1e6 } else { 1.0 - x as f64 }).collect())
            .collect();

        let mut matched_det: HashSet<usize> = HashSet::new();
        if !dets.is_empty() {
            for (r, c) in linear_sum_assignment(&cost) {
                if cost[r][c] < 1.0 {
                    self.tracks[r].update(dets[c], frame);
                    matched_det.insert(c);
                }
            }
        }

        for (i, d) in dets.iter().enumerate() {
            if !matched_det.contains(&i) {
                self.tracks.push(Track::new(self.next_id, *d, frame));
                self.next_id += 1;
            }
        }

        let max_age = self.max_age;
        self.tracks.retain(|t| frame - t.last_frame <= max_age);
        self.snapshot()
    }
}

type Frames = Vec<Vec<BBox>>;
type GroundTruth = Vec<Vec<(usize, BBox)>>;

fn synthetic_frames(num_frames: usize, num_objects: usize, seed: u64, drop_prob: f64) -> (Frames, GroundTruth) {
    let (h, w) = (240.0f64, 320.0f64);
    let mut rng = Rng::new(seed);
    let starts: Vec<[f64; 2]> = (0..num_objects).map(|_| [rng.uniform(20.0, 200.0), rng.uniform(20.0, 200.0)]).collect();
    let velocities: Vec<[f64; 2]> = (0..num_objects).map(|_| [rng.uniform(-4.0, 4.0), rng.uniform(-4.0, 4.0)]).collect();
    let mut gt = Vec::new();
    let mut frames = Vec::new();
    for f in 0..num_frames {
        let mut g = Vec::new();
        let mut dets = Vec::new();
        for i in 0..num_objects {
            let cx = starts[i][0] + f as f64 * velocities[i][0];
            let cy = starts[i][1] + f as f64 * velocities[i][1];
            let bbox = [
                (cx - 10.0).max(0.0) as f32,
                (cy - 10.0).max(0.0) as f32,
                (cx + 10.0).min(w - 1.0) as f32,
                (cy + 10.0).min(h - 1.0) as f32,
            ];
            g.push((i, bbox));
            if rng.random() >= drop_prob {
                dets.push(bbox);
            }
        }
        gt.push(g);
        frames.push(dets);
    }
    (frames, gt)
}

fn count_id_switches(tracks_per_frame: &[Vec<(usize, BBox)>], gt_per_frame: &GroundTruth) -> usize {
    let mut prev_assignment: HashMap<usize, usize> = HashMap::new();
    let mut switches = 0;
    for (tracks, gts) in tracks_per_frame.iter().zip(gt_per_frame) {
        if tracks.is_empty() || gts.is_empty() {
            continue;
        }
        let t_boxes: Vec<BBox> = tracks.iter().map(|(_, b)| *b).collect();
        let g_boxes: Vec<BBox> = gts.iter().map(|(_, b)| *b).collect();
        let iou = bbox_iou(&g_boxes, &t_boxes);
        for (g_idx, (gt_id, _)) in gts.iter().enumerate() {
            let row = &iou[g_idx];
            let mut j = 0;
            for k in 1..row.len() {
                if row[k] > row[j] {
                    j = k;
                }
            }
            if row[j] > 0.5 {
                let t_id = tracks[j].0;
                if let Some(&prev) = prev_assignment.get(gt_id) {
                    if prev != t_id {
                        switches += 1;
                    }
                }
                prev_assignment.insert(*gt_id, t_id);
            }
        }
    }
    switches
}

fn run(tracker: &mut SimpleTracker, frames: &Frames) -> Vec<Vec<(usize, BBox)>> {
    frames.iter().enumerate().map(|(f, dets)| tracker.step(dets, f)).collect()
}

fn main() {
    for n_obj in [3usize, 10, 30] {
        let mut tracker = SimpleTracker::new(0.3, 5);
        let (frames, gt) = synthetic_frames(25, n_obj, 0, 0.0);
        let tracks_per_frame = run(&mut tracker, &frames);
        let switches = count_id_switches(&tracks_per_frame, &gt);
        println!("{:>3} objects:  active tracks={:3}  ID switches={}", n_obj, tracker.tracks.len(), switches);
    }

    println!("\nWith frame dropouts (drop_prob=0.2):");
    let mut tracker = SimpleTracker::new(0.3, 3);
    let (frames, gt) = synthetic_frames(25, 5, 0, 0.2);
    let tracks_per_frame = run(&mut tracker, &frames);
    let switches = count_id_switches(&tracks_per_frame, &gt);
    println!("  5 objects + 20% dropouts:  ID switches={}", switches);
}
