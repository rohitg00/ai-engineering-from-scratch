from abc import ABC, abstractmethod
from dataclasses import dataclass, asdict
from typing import List
import json
import numpy as np


@dataclass
class ConceptDetection:
    concept: str
    instance_id: int
    box: tuple
    score: float
    mask_rle: str


def split_concepts(sentence):
    for sep in [",", ";", "and ", " or ", "&"]:
        if sep in sentence:
            cleaned = sentence.replace(" and ", ",").replace(" or ", ",").replace("&", ",").replace(";", ",")
            parts = [p.strip() for p in cleaned.split(",")]
            return [p for p in parts if p]
    return [sentence.strip()]


def rle_encode(binary_mask):
    flat = binary_mask.flatten().astype("uint8")
    if flat.size == 0:
        return ""
    runs = []
    prev = int(flat[0])
    count = 0
    for v in flat:
        iv = int(v)
        if iv == prev:
            count += 1
        else:
            runs.append((prev, count))
            prev, count = iv, 1
    runs.append((prev, count))
    return ";".join(f"{v}x{c}" for v, c in runs)


def rle_decode(rle_str, shape):
    flat = np.zeros(int(np.prod(shape)), dtype=np.uint8)
    idx = 0
    for part in rle_str.split(";"):
        v, c = part.split("x")
        v = int(v)
        c = int(c)
        flat[idx:idx + c] = v
        idx += c
    return flat.reshape(shape)


class OpenVocabSeg(ABC):
    @abstractmethod
    def detect(self, image: np.ndarray, concept: str) -> List[ConceptDetection]:
        ...


class StubOpenVocabSeg(OpenVocabSeg):
    """Pipeline-testable stand-in for SAM 3 / Grounded SAM 2."""

    def detect(self, image, concept):
        h, w = image.shape[:2]
        mask_a = np.zeros((h, w), dtype=np.uint8)
        mask_a[int(h * 0.3):int(h * 0.8), int(w * 0.2):int(w * 0.5)] = 1
        mask_b = np.zeros((h, w), dtype=np.uint8)
        mask_b[int(h * 0.25):int(h * 0.75), int(w * 0.55):int(w * 0.85)] = 1
        return [
            ConceptDetection(
                concept=concept,
                instance_id=0,
                box=(w * 0.2, h * 0.3, w * 0.5, h * 0.8),
                score=0.89,
                mask_rle=rle_encode(mask_a),
            ),
            ConceptDetection(
                concept=concept,
                instance_id=1,
                box=(w * 0.55, h * 0.25, w * 0.85, h * 0.75),
                score=0.74,
                mask_rle=rle_encode(mask_b),
            ),
        ]


def run_multi_concept(model: OpenVocabSeg, image: np.ndarray, user_utterance: str):
    concepts = split_concepts(user_utterance)
    out = []
    for c in concepts:
        out.extend(model.detect(image, c))
    return out


def main():
    print("[split_concepts]")
    for s in [
        "cats, dogs and balloons",
        "yellow school bus",
        "striped red umbrella; green hat",
        "one large boat or small boat",
    ]:
        print(f"  {s!r:45s} -> {split_concepts(s)}")

    print("\n[rle encode/decode roundtrip]")
    mask = (np.random.default_rng(0).random((16, 16)) > 0.5).astype(np.uint8)
    rle = rle_encode(mask)
    restored = rle_decode(rle, mask.shape)
    diff = int(np.abs(mask.astype(int) - restored.astype(int)).sum())
    print(f"  mask shape {mask.shape}  rle length {len(rle)}  roundtrip diff {diff}")

    print("\n[multi-concept detection on stub]")
    image = np.zeros((240, 320, 3), dtype=np.uint8)
    stub = StubOpenVocabSeg()
    detections = run_multi_concept(stub, image, "oranges, apples")
    print(f"  {len(detections)} detections")
    for d in detections:
        summary = {
            "concept": d.concept,
            "id": d.instance_id,
            "box": tuple(round(x, 1) for x in d.box),
            "score": round(d.score, 2),
            "mask_len": len(d.mask_rle.split(";")),
        }
        print(f"    {json.dumps(summary)}")


if __name__ == "__main__":
    main()
