import numpy as np
from scipy.optimize import linear_sum_assignment


def bbox_iou(a, b):
    ax1, ay1, ax2, ay2 = a[:, 0], a[:, 1], a[:, 2], a[:, 3]
    bx1, by1, bx2, by2 = b[:, 0], b[:, 1], b[:, 2], b[:, 3]
    inter_x1 = np.maximum(ax1[:, None], bx1[None, :])
    inter_y1 = np.maximum(ay1[:, None], by1[None, :])
    inter_x2 = np.minimum(ax2[:, None], bx2[None, :])
    inter_y2 = np.minimum(ay2[:, None], by2[None, :])
    inter = np.clip(inter_x2 - inter_x1, 0, None) * np.clip(inter_y2 - inter_y1, 0, None)
    area_a = (ax2 - ax1) * (ay2 - ay1)
    area_b = (bx2 - bx1) * (by2 - by1)
    union = area_a[:, None] + area_b[None, :] - inter
    return inter / np.clip(union, 1e-8, None)


class Track:
    def __init__(self, tid, bbox, frame):
        self.id = tid
        self.bbox = bbox
        self.last_frame = frame
        self.hits = 1

    def update(self, bbox, frame):
        self.bbox = bbox
        self.last_frame = frame
        self.hits += 1


class SimpleTracker:
    def __init__(self, iou_threshold=0.3, max_age=5):
        self.tracks = []
        self.next_id = 1
        self.iou_threshold = iou_threshold
        self.max_age = max_age

    def step(self, detections, frame):
        dets = np.array(detections, dtype=np.float32) if len(detections) else np.empty((0, 4), dtype=np.float32)
        if not self.tracks:
            for d in dets:
                self.tracks.append(Track(self.next_id, d, frame))
                self.next_id += 1
            return [(t.id, t.bbox.tolist()) for t in self.tracks]

        track_boxes = np.array([t.bbox for t in self.tracks])
        iou = bbox_iou(track_boxes, dets) if len(dets) else np.zeros((len(track_boxes), 0))
        cost = 1 - iou
        cost[iou < self.iou_threshold] = 1e6

        matched_track, matched_det = set(), set()
        if cost.size > 0:
            row, col = linear_sum_assignment(cost)
            for r, c in zip(row, col):
                if cost[r, c] < 1.0:
                    self.tracks[r].update(dets[c], frame)
                    matched_track.add(r)
                    matched_det.add(c)

        for i, d in enumerate(dets):
            if i not in matched_det:
                self.tracks.append(Track(self.next_id, d, frame))
                self.next_id += 1

        self.tracks = [t for t in self.tracks if frame - t.last_frame <= self.max_age]
        return [(t.id, t.bbox.tolist()) for t in self.tracks]


def synthetic_frames(num_frames=25, num_objects=3, H=240, W=320, seed=0, drop_prob=0.0):
    rng = np.random.default_rng(seed)
    starts = rng.uniform(20, 200, size=(num_objects, 2))
    velocities = rng.uniform(-4, 4, size=(num_objects, 2))
    gt = []
    frames = []
    for f in range(num_frames):
        g = []
        dets = []
        for i in range(num_objects):
            cx, cy = starts[i] + f * velocities[i]
            x1 = max(0.0, cx - 10)
            y1 = max(0.0, cy - 10)
            x2 = min(float(W - 1), cx + 10)
            y2 = min(float(H - 1), cy + 10)
            box = [x1, y1, x2, y2]
            g.append((i, box))
            if rng.random() >= drop_prob:
                dets.append(box)
        gt.append(g)
        frames.append(dets)
    return frames, gt


def count_id_switches(tracks_per_frame, gt_per_frame):
    prev_assignment = {}
    switches = 0
    for tracks, gts in zip(tracks_per_frame, gt_per_frame):
        if not tracks or not gts:
            continue
        t_boxes = np.array([b for _, b in tracks])
        g_boxes = np.array([b for _, b in gts])
        iou = bbox_iou(g_boxes, t_boxes)
        for g_idx, (gt_id, _) in enumerate(gts):
            j = int(iou[g_idx].argmax())
            if iou[g_idx, j] > 0.5:
                t_id = tracks[j][0]
                if gt_id in prev_assignment and prev_assignment[gt_id] != t_id:
                    switches += 1
                prev_assignment[gt_id] = t_id
    return switches


def main():
    for n_obj in [3, 10, 30]:
        tracker = SimpleTracker()
        frames, gt = synthetic_frames(num_frames=25, num_objects=n_obj, seed=0)
        tracks_per_frame = []
        for f, dets in enumerate(frames):
            tracks = tracker.step(dets, f)
            tracks_per_frame.append(tracks)
        switches = count_id_switches(tracks_per_frame, gt)
        print(f"{n_obj:>3d} objects:  active tracks={len(tracker.tracks):3d}  ID switches={switches}")

    print("\nWith frame dropouts (drop_prob=0.2):")
    tracker = SimpleTracker(max_age=3)
    frames, gt = synthetic_frames(num_frames=25, num_objects=5, drop_prob=0.2)
    tracks_per_frame = []
    for f, dets in enumerate(frames):
        tracks = tracker.step(dets, f)
        tracks_per_frame.append(tracks)
    switches = count_id_switches(tracks_per_frame, gt)
    print(f"  5 objects + 20% dropouts:  ID switches={switches}")


if __name__ == "__main__":
    main()
