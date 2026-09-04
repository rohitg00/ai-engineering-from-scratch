"""Janus-Pro decoupled-encoder routing — stdlib.

Two mock encoders (semantic SigLIP-like, reconstruction VQ-like), one shared
transformer body, a router that picks based on task tag. Traces three example
prompts through the pipeline.
"""

from __future__ import annotations

import random
from dataclasses import dataclass

random.seed(3)


@dataclass
class SiglipStub:
    dim: int = 32

    def encode(self, image_seed: int) -> list[float]:
        random.seed(image_seed)
        return [random.gauss(0, 0.5) for _ in range(self.dim)]


@dataclass
class VQStub:
    vocab: int = 256
    n_tokens: int = 16

    def encode(self, image_seed: int) -> list[int]:
        random.seed(image_seed * 7 + 1)
        return [random.randint(0, self.vocab - 1) for _ in range(self.n_tokens)]

    def decode(self, tokens: list[int]) -> str:
        return f"VQ-decoded image from tokens {tokens[:4]}..."


@dataclass
class SharedBody:
    name: str = "DeepSeek-7B-init"

    def process(self, input_stream: list, kind: str) -> list:
        if kind == "text_out":
            return [f"word_{i}" for i in range(4)]
        if kind == "image_out":
            return [random.randint(0, 255) for _ in range(16)]
        return []


def route(prompt: str) -> str:
    """Classify task as `understand` or `generate`."""
    u_keywords = ["describe", "what", "why", "caption", "explain", "how many"]
    g_keywords = ["draw", "generate", "sketch", "render", "create", "paint"]
    p = prompt.lower()
    u_score = sum(1 for k in u_keywords if k in p)
    g_score = sum(1 for k in g_keywords if k in p)
    if g_score > u_score:
        return "generate"
    if u_score > g_score:
        return "understand"
    return "ambiguous"


def run_pipeline(prompt: str, image_seed: int = 42) -> dict:
    siglip = SiglipStub()
    vq = VQStub()
    body = SharedBody()

    task = route(prompt)
    trace = {"prompt": prompt, "task": task}

    if task == "understand":
        feats = siglip.encode(image_seed)
        trace["route"] = "SigLIP -> shared body -> text"
        trace["input_len"] = len(feats)
        out = body.process(feats, kind="text_out")
        trace["output"] = out
    elif task == "generate":
        tokens = vq.encode(image_seed) if image_seed else []
        trace["route"] = "(optional VQ) -> shared body -> image VQ -> decoder"
        out_tokens = body.process(tokens, kind="image_out")
        trace["output"] = vq.decode(out_tokens)
    else:
        trace["route"] = "ambiguous: run both and merge"
        feats = siglip.encode(image_seed)
        tokens = vq.encode(image_seed)
        trace["input_len"] = f"SigLIP:{len(feats)} + VQ:{len(tokens)}"
        trace["output"] = (body.process(feats, "text_out"),
                           vq.decode(body.process(tokens, "image_out")))

    return trace


def demo_routing() -> None:
    prompts = [
        "Describe what's in this image",
        "Generate a picture of a sunset over the ocean",
        "Sketch a cat and then describe its breed",
        "What is the pose of the person in the image?",
        "Render a cyberpunk cityscape at night",
    ]
    for p in prompts:
        trace = run_pipeline(p, image_seed=hash(p) % 1000)
        print(f"\n  prompt  : {p}")
        print(f"  task    : {trace['task']}")
        print(f"  route   : {trace['route']}")
        print(f"  output  : {trace['output']}")


def data_scale_table() -> None:
    print("\nDATA SCALING: Janus vs Janus-Pro")
    print("-" * 60)
    rows = [
        ("stage 1 (alignment)",   "72M pairs",  "90M pairs",  "+25%"),
        ("stage 2 (unified)",     "26M pairs",  "72M pairs",  "+176%"),
        ("stage 3 (instruction)", "1.2M inst",  "1.4M inst",  "+17%"),
        ("model params",          "1.3B",       "7B",         "5.4x"),
        ("MMMU",                  "30.5",       "60.3",       "+29.8"),
        ("GenEval",               "0.61",       "0.80",       "+0.19"),
    ]
    print(f"  {'axis':<20}{'Janus':<14}{'Janus-Pro':<14}{'delta'}")
    for r in rows:
        print(f"  {r[0]:<20}{r[1]:<14}{r[2]:<14}{r[3]}")


def main() -> None:
    print("=" * 60)
    print("JANUS-PRO DECOUPLED ENCODERS (Phase 12, Lesson 15)")
    print("=" * 60)

    print("\nROUTING TRACE: 5 prompts through the dual-encoder pipeline")
    print("-" * 60)
    demo_routing()

    data_scale_table()

    print("\nARCHITECTURE ONE-LINER")
    print("-" * 60)
    print("  input tower A (SigLIP)  -> ")
    print("  input tower B (VQ)       -> shared transformer body ->")
    print("  output head 1 (text NTP) or output head 2 (VQ tokens)")
    print("  3 stages: alignment -> unified -> instruction tune")


if __name__ == "__main__":
    main()
