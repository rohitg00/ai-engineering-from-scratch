import time
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from pydantic import BaseModel, Field
from typing import List, Optional, Tuple


class Detection(BaseModel):
    box: Tuple[float, float, float, float]
    score: float = Field(ge=0, le=1)
    class_id: int = Field(ge=0)
    mask_rle: Optional[str] = None


class Classification(BaseModel):
    detection_index: int
    class_id: int
    class_name: str
    score: float = Field(ge=0, le=1)


class PipelineResult(BaseModel):
    image_id: str
    detections: List[Detection]
    classifications: List[Classification]
    inference_ms: float


class StubDetector(nn.Module):
    """Minimal stand-in for Mask R-CNN that produces a fixed set of detections."""

    def __init__(self):
        super().__init__()
        self.dummy = nn.Parameter(torch.zeros(1))

    def forward(self, images):
        results = []
        for img in images:
            H, W = img.shape[-2:]
            boxes = torch.tensor(
                [
                    [W * 0.1, H * 0.1, W * 0.4, H * 0.6],
                    [W * 0.5, H * 0.3, W * 0.9, H * 0.9],
                    [W * 0.2, H * 0.6, W * 0.45, H * 0.85],
                ],
                device=img.device,
            )
            scores = torch.tensor([0.92, 0.85, 0.71], device=img.device)
            labels = torch.tensor([1, 2, 1], device=img.device)
            results.append({"boxes": boxes, "scores": scores, "labels": labels})
        return results


class StubClassifier(nn.Module):
    def __init__(self, num_classes=10):
        super().__init__()
        self.head = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Flatten(),
            nn.Linear(3, num_classes),
        )

    def forward(self, x):
        return self.head(x)


class VisionPipeline:
    def __init__(self, detector, classifier, class_names,
                 device="cpu", min_crop=16):
        self.detector = detector.to(device).eval()
        self.classifier = classifier.to(device).eval()
        self.class_names = class_names
        self.device = device
        self.min_crop = min_crop

    def preprocess(self, image):
        if isinstance(image, np.ndarray):
            if image.ndim != 3 or image.shape[-1] != 3:
                raise ValueError(f"expected HxWx3 RGB image, got shape {image.shape}")
            tensor = torch.from_numpy(image).permute(2, 0, 1).float() / 255.0
        elif isinstance(image, torch.Tensor):
            if image.ndim != 3 or image.shape[0] != 3:
                raise ValueError(f"expected (3, H, W) tensor, got shape {tuple(image.shape)}")
            tensor = image.float()
        else:
            raise TypeError(f"image must be numpy ndarray or torch Tensor, got {type(image)}")
        return tensor.to(self.device)

    @torch.no_grad()
    def detect(self, image_tensor):
        return self.detector([image_tensor])[0]

    @torch.no_grad()
    def classify(self, crops):
        if len(crops) == 0:
            return []
        batch = torch.stack(crops).to(self.device)
        logits = self.classifier(batch)
        probs = logits.softmax(-1)
        scores, cls = probs.max(-1)
        return list(zip(cls.tolist(), scores.tolist()))

    def run(self, image, image_id="anonymous"):
        t0 = time.perf_counter()
        tensor = self.preprocess(image)
        det = self.detect(tensor)

        crops = []
        valid_indices = []
        detections = []
        for i, (box, score, cls) in enumerate(
            zip(det["boxes"], det["scores"], det["labels"])
        ):
            x1, y1, x2, y2 = [max(0, int(b)) for b in box.tolist()]
            x2 = min(x2, tensor.shape[-1])
            y2 = min(y2, tensor.shape[-2])
            detections.append(Detection(
                box=(x1, y1, x2, y2),
                score=float(score),
                class_id=int(cls),
            ))
            if (x2 - x1) < self.min_crop or (y2 - y1) < self.min_crop:
                continue
            crop = tensor[:, y1:y2, x1:x2]
            crop = F.interpolate(
                crop.unsqueeze(0), size=(64, 64), mode="bilinear", align_corners=False
            )[0]
            crops.append(crop)
            valid_indices.append(i)

        class_preds = self.classify(crops)

        classifications = []
        for valid_idx, (cls_id, cls_score) in zip(valid_indices, class_preds):
            classifications.append(Classification(
                detection_index=valid_idx,
                class_id=int(cls_id),
                class_name=self.class_names[cls_id] if cls_id < len(self.class_names) else f"class_{cls_id}",
                score=float(cls_score),
            ))

        return PipelineResult(
            image_id=image_id,
            detections=detections,
            classifications=classifications,
            inference_ms=(time.perf_counter() - t0) * 1000,
        )


def benchmark(pipe, num_runs=10, image_size=(400, 600)):
    img = (np.random.rand(*image_size, 3) * 255).astype(np.uint8)
    pipe.run(img)
    stages = {"preprocess": [], "detect": [], "classify": [], "total": []}

    def sync():
        if pipe.device == "cuda" and torch.cuda.is_available():
            torch.cuda.synchronize()

    for _ in range(num_runs):
        sync()
        t0 = time.perf_counter()
        tensor = pipe.preprocess(img)
        sync()
        t1 = time.perf_counter()
        det = pipe.detect(tensor)
        sync()
        t2 = time.perf_counter()
        crops = []
        for box in det["boxes"]:
            x1, y1, x2, y2 = [max(0, int(b)) for b in box.tolist()]
            x2 = min(x2, tensor.shape[-1])
            y2 = min(y2, tensor.shape[-2])
            if (x2 - x1) >= pipe.min_crop and (y2 - y1) >= pipe.min_crop:
                crop = tensor[:, y1:y2, x1:x2]
                crop = F.interpolate(
                    crop.unsqueeze(0), size=(64, 64), mode="bilinear", align_corners=False
                )[0]
                crops.append(crop)
        pipe.classify(crops)
        sync()
        t3 = time.perf_counter()
        stages["preprocess"].append((t1 - t0) * 1000)
        stages["detect"].append((t2 - t1) * 1000)
        stages["classify"].append((t3 - t2) * 1000)
        stages["total"].append((t3 - t0) * 1000)
    for stage, times in stages.items():
        times.sort()
        print(f"  {stage:10s}  p50={times[len(times)//2]:7.2f}  p95={times[int(len(times)*0.95)]:7.2f}")


def main():
    detector = StubDetector()
    classifier = StubClassifier(num_classes=10)
    class_names = [f"class_{i}" for i in range(10)]
    pipe = VisionPipeline(detector, classifier, class_names)

    img = (np.random.rand(400, 600, 3) * 255).astype(np.uint8)
    result = pipe.run(img, image_id="demo")
    print("[result]")
    print(result.model_dump_json(indent=2)[:400])
    print("...")

    print("\n[benchmark]")
    benchmark(pipe, num_runs=10)


if __name__ == "__main__":
    main()
