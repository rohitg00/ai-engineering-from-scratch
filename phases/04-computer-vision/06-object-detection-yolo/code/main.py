import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F


def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-x))


def box_iou(boxes_a, boxes_b):
    ax1, ay1, ax2, ay2 = boxes_a[:, 0], boxes_a[:, 1], boxes_a[:, 2], boxes_a[:, 3]
    bx1, by1, bx2, by2 = boxes_b[:, 0], boxes_b[:, 1], boxes_b[:, 2], boxes_b[:, 3]

    inter_x1 = np.maximum(ax1[:, None], bx1[None, :])
    inter_y1 = np.maximum(ay1[:, None], by1[None, :])
    inter_x2 = np.minimum(ax2[:, None], bx2[None, :])
    inter_y2 = np.minimum(ay2[:, None], by2[None, :])

    inter_w = np.clip(inter_x2 - inter_x1, 0, None)
    inter_h = np.clip(inter_y2 - inter_y1, 0, None)
    inter = inter_w * inter_h

    area_a = (ax2 - ax1) * (ay2 - ay1)
    area_b = (bx2 - bx1) * (by2 - by1)
    union = area_a[:, None] + area_b[None, :] - inter
    return inter / np.clip(union, 1e-8, None)


def nms(boxes, scores, iou_threshold=0.45):
    order = np.argsort(-scores)
    keep = []
    while len(order) > 0:
        i = order[0]
        keep.append(int(i))
        if len(order) == 1:
            break
        rest = order[1:]
        ious = box_iou(boxes[[i]], boxes[rest])[0]
        order = rest[ious <= iou_threshold]
    return np.array(keep, dtype=np.int64)


def encode(box_xyxy, cell_x, cell_y, stride, anchor_wh):
    x1, y1, x2, y2 = box_xyxy
    cx = 0.5 * (x1 + x2)
    cy = 0.5 * (y1 + y2)
    w = x2 - x1
    h = y2 - y1
    # Offset within the cell in [0, 1], converted to logit so decode(sigmoid(tx)) round-trips.
    off_x = np.clip(cx / stride - cell_x, 1e-6, 1 - 1e-6)
    off_y = np.clip(cy / stride - cell_y, 1e-6, 1 - 1e-6)
    tx = float(np.log(off_x / (1 - off_x)))
    ty = float(np.log(off_y / (1 - off_y)))
    tw = np.log(w / anchor_wh[0] + 1e-8)
    th = np.log(h / anchor_wh[1] + 1e-8)
    return np.array([tx, ty, tw, th])


def decode(tx_ty_tw_th, cell_x, cell_y, stride, anchor_wh):
    tx, ty, tw, th = tx_ty_tw_th
    cx = (sigmoid(tx) + cell_x) * stride
    cy = (sigmoid(ty) + cell_y) * stride
    w = anchor_wh[0] * np.exp(np.clip(tw, -10.0, 10.0))
    h = anchor_wh[1] * np.exp(np.clip(th, -10.0, 10.0))
    return np.array([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2])


class YOLOHead(nn.Module):
    def __init__(self, in_c, num_anchors, num_classes):
        super().__init__()
        self.num_anchors = num_anchors
        self.num_classes = num_classes
        self.conv = nn.Conv2d(in_c, num_anchors * (5 + num_classes), kernel_size=1)

    def forward(self, x):
        n, _, h, w = x.shape
        y = self.conv(x)
        y = y.view(n, self.num_anchors, 5 + self.num_classes, h, w)
        y = y.permute(0, 3, 4, 1, 2).contiguous()
        return y


def assign_targets(boxes_xyxy, classes, anchors, stride, grid_size, num_classes):
    num_anchors = len(anchors)
    target = np.zeros((grid_size, grid_size, num_anchors, 5 + num_classes), dtype=np.float32)
    has_obj = np.zeros((grid_size, grid_size, num_anchors), dtype=bool)

    for box, cls in zip(boxes_xyxy, classes):
        x1, y1, x2, y2 = box
        cx, cy = 0.5 * (x1 + x2), 0.5 * (y1 + y2)
        gx_raw, gy_raw = int(cx / stride), int(cy / stride)
        if not (0 <= gx_raw < grid_size and 0 <= gy_raw < grid_size):
            continue
        gx = min(gx_raw, grid_size - 1)
        gy = min(gy_raw, grid_size - 1)
        bw, bh = x2 - x1, y2 - y1

        ious = []
        for aw, ah in anchors:
            inter = min(bw, aw) * min(bh, ah)
            union = bw * bh + aw * ah - inter
            ious.append(inter / max(union, 1e-8))
        best = int(np.argmax(ious))
        aw, ah = anchors[best]

        # Store logit(offset) so the network's raw output matches post-sigmoid
        # decode. Keeps target space aligned with decode()/postprocess().
        off_x = np.clip(cx / stride - gx, 1e-6, 1 - 1e-6)
        off_y = np.clip(cy / stride - gy, 1e-6, 1 - 1e-6)
        target[gy, gx, best, 0] = np.log(off_x / (1 - off_x))
        target[gy, gx, best, 1] = np.log(off_y / (1 - off_y))
        target[gy, gx, best, 2] = np.log(bw / aw + 1e-8)
        target[gy, gx, best, 3] = np.log(bh / ah + 1e-8)
        target[gy, gx, best, 4] = 1.0
        target[gy, gx, best, 5 + cls] = 1.0
        has_obj[gy, gx, best] = True
    return target, has_obj


def yolo_loss(pred, target, has_obj,
              lambda_coord=5.0, lambda_obj=1.0, lambda_noobj=0.5, lambda_cls=1.0):
    has_obj_t = torch.from_numpy(has_obj).bool().to(pred.device)
    target_t = torch.from_numpy(target).float().to(pred.device)
    if pred.dim() == 5 and pred.shape[0] == 1:
        pred = pred[0]

    box_pred = pred[..., :4][has_obj_t]
    box_true = target_t[..., :4][has_obj_t]
    loss_box = F.mse_loss(box_pred, box_true, reduction="sum") if box_pred.numel() else torch.tensor(0.0)

    obj_pred = pred[..., 4]
    obj_true = target_t[..., 4]
    loss_obj_pos = F.binary_cross_entropy_with_logits(
        obj_pred[has_obj_t], obj_true[has_obj_t], reduction="sum"
    ) if has_obj_t.any() else torch.tensor(0.0)
    loss_obj_neg = F.binary_cross_entropy_with_logits(
        obj_pred[~has_obj_t], obj_true[~has_obj_t], reduction="sum"
    ) if (~has_obj_t).any() else torch.tensor(0.0)

    cls_pred = pred[..., 5:][has_obj_t]
    cls_true = target_t[..., 5:][has_obj_t]
    loss_cls = F.binary_cross_entropy_with_logits(
        cls_pred, cls_true, reduction="sum"
    ) if cls_pred.numel() else torch.tensor(0.0)

    total = (lambda_coord * loss_box
             + lambda_obj * loss_obj_pos
             + lambda_noobj * loss_obj_neg
             + lambda_cls * loss_cls)
    return total, {"box": float(loss_box), "obj_pos": float(loss_obj_pos),
                   "obj_neg": float(loss_obj_neg), "cls": float(loss_cls)}


def postprocess(pred_tensor, anchors, stride, conf_threshold=0.25, iou_threshold=0.45):
    pred = pred_tensor.detach().cpu().numpy()
    _, grid_h, grid_w, num_anchors, _ = pred.shape

    boxes, scores, classes = [], [], []
    for gy in range(grid_h):
        for gx in range(grid_w):
            for a in range(num_anchors):
                row = pred[0, gy, gx, a]
                tx, ty, tw, th, obj = row[:5]
                cls_logits = row[5:]
                cls_probs = sigmoid(cls_logits)
                score = float(sigmoid(obj) * cls_probs.max())
                if score < conf_threshold:
                    continue
                cls_idx = int(np.argmax(cls_probs))
                cx = (sigmoid(tx) + gx) * stride
                cy = (sigmoid(ty) + gy) * stride
                # Clamp tw/th to keep exp() finite on wild predictions.
                w = anchors[a][0] * np.exp(np.clip(tw, -10.0, 10.0))
                h = anchors[a][1] * np.exp(np.clip(th, -10.0, 10.0))
                boxes.append([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2])
                scores.append(score)
                classes.append(cls_idx)

    if not boxes:
        return np.zeros((0, 4)), np.zeros((0,)), np.zeros((0,), dtype=int)
    boxes = np.array(boxes)
    scores = np.array(scores)
    classes = np.array(classes)
    keep = nms(boxes, scores, iou_threshold)
    return boxes[keep], scores[keep], classes[keep]


def main():
    rng = np.random.default_rng(0)

    print("[iou] identical boxes should have iou=1")
    a = np.array([[10, 10, 50, 50]])
    b = np.array([[10, 10, 50, 50]])
    print(f"  iou={box_iou(a, b)[0, 0]:.3f}")

    print("\n[iou] half-overlap boxes")
    a = np.array([[0, 0, 10, 10]])
    b = np.array([[5, 0, 15, 10]])
    print(f"  iou={box_iou(a, b)[0, 0]:.3f}  (expected 1/3 = 0.333)")

    print("\n[nms] 5 overlapping boxes -> NMS keeps highest-score non-overlapping set")
    boxes = np.array([
        [0, 0, 10, 10],
        [1, 1, 11, 11],
        [2, 2, 12, 12],
        [20, 20, 30, 30],
        [21, 21, 31, 31],
    ], dtype=float)
    scores = np.array([0.9, 0.8, 0.7, 0.85, 0.6])
    keep = nms(boxes, scores, iou_threshold=0.4)
    print(f"  kept indices: {keep.tolist()}  (expected [0, 3])")

    print("\n[encode/decode] round-trip error")
    anchors = [(30, 60), (75, 170), (200, 380)]
    stride = 32
    grid_size = 13
    num_classes = 5
    gt_box = (120, 80, 240, 220)
    anchor = anchors[1]
    cell_x = int((gt_box[0] + gt_box[2]) / 2 / stride)
    cell_y = int((gt_box[1] + gt_box[3]) / 2 / stride)
    enc = encode(gt_box, cell_x, cell_y, stride, anchor)
    dec = decode(np.array([*enc[:2], enc[2], enc[3]]), cell_x, cell_y, stride, anchor)
    err = np.max(np.abs(np.array(gt_box) - dec))
    print(f"  enc  ={enc.round(3)}")
    print(f"  decoded={dec.round(2)}  (original {gt_box})")
    print(f"  max|diff|={err:.3f}  (should round-trip to ~0 once encode applies logit)")

    print("\n[assign + loss] one synthetic image")
    gt_boxes = [(100, 80, 200, 220)]
    gt_classes = [2]
    target, has_obj = assign_targets(gt_boxes, gt_classes, anchors, stride, grid_size, num_classes)

    torch.manual_seed(0)
    head = YOLOHead(in_c=128, num_anchors=3, num_classes=num_classes)
    feat = torch.randn(1, 128, grid_size, grid_size)
    pred = head(feat)
    print(f"  pred shape: {tuple(pred.shape)}   target shape: {target.shape}")
    loss, parts = yolo_loss(pred, target, has_obj)
    print(f"  loss={float(loss):.3f}  parts={parts}")

    print("\n[postprocess] decode + NMS")
    boxes, scores, classes = postprocess(pred, anchors, stride, conf_threshold=0.1)
    print(f"  predictions after NMS: {len(boxes)}  scores range "
          f"[{scores.min():.3f}, {scores.max():.3f}]" if len(boxes) else "  no predictions")


if __name__ == "__main__":
    main()
