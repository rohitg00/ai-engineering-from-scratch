"""Document AI stack toy — LayoutLMv3-style inputs + Donut schema + token budgets.

Stdlib. Produces the three-stream LayoutLM input (text, bbox, patch-ids) for a
toy page, generates a Donut-style JSON schema, and compares total input token
counts across (OCR-pipeline, Donut, Nougat, VLM-native).
"""

from __future__ import annotations

import json
from dataclasses import dataclass


@dataclass
class Token:
    text: str
    bbox: tuple[int, int, int, int]


def mock_page() -> list[Token]:
    """A synthetic invoice page."""
    return [
        Token("INVOICE",      (100, 50,  300, 80)),
        Token("ACME Co.",     (100, 100, 250, 130)),
        Token("Item",         (100, 200, 200, 230)),
        Token("Widget A",     (100, 240, 250, 270)),
        Token("Price",        (400, 200, 500, 230)),
        Token("$120.00",      (400, 240, 500, 270)),
        Token("Total",        (400, 400, 500, 430)),
        Token("$1,245.00",    (400, 440, 550, 470)),
    ]


def layoutlm_input(tokens: list[Token], patch_grid: tuple[int, int] = (16, 16)) -> dict:
    """Produce the three-stream input: text, bbox, patch-ids."""
    text_ids = [hash(t.text) % 10000 for t in tokens]
    bbox_stream = [t.bbox for t in tokens]
    n_patches = patch_grid[0] * patch_grid[1]
    patch_ids = list(range(n_patches))
    return {"text_ids": text_ids, "bbox_stream": bbox_stream,
            "patch_ids": patch_ids}


def donut_schema(task: str = "invoice") -> dict:
    schemas = {
        "invoice": {
            "vendor": "<string>",
            "invoice_number": "<string>",
            "line_items": [
                {"description": "<string>", "quantity": "<int>", "price": "<float>"}
            ],
            "total": "<float>",
            "currency": "<string>",
        },
        "form": {
            "form_id": "<string>",
            "fields": [
                {"name": "<string>", "value": "<string>", "confidence": "<float>"}
            ],
        },
    }
    return schemas.get(task, {})


def token_budget() -> None:
    print("\nINPUT TOKEN BUDGET PER PAGE (A4 at 300 DPI, ~2500x3500 px)")
    print("-" * 60)
    rows = [
        ("OCR pipeline + LayoutLMv3", 512, "text + bbox + small image"),
        ("Donut (OCR-free)",          4096, "swin encoder, ~4k patches"),
        ("Nougat (paper pages)",      4096, "896x896, 4-tile AnyRes"),
        ("VLM AnyRes 4-tile (LLaVA)", 2916, "336 tiles + thumbnail"),
        ("VLM native 2048 (Qwen2.5-VL)", 8192, "native resolution"),
        ("VLM native 2576 (Claude 4.7)", 12000, "frontier, best accuracy"),
    ]
    print(f"  {'stack':<28}{'tokens':<10}  note")
    for name, toks, note in rows:
        print(f"  {name:<28}{toks:<10}  {note}")


def demo_pipeline_output() -> None:
    print("\nLAYOUTLMv3-STYLE INPUT (invoice page)")
    print("-" * 60)
    tokens = mock_page()
    data = layoutlm_input(tokens)
    print(f"  text_ids[0:4]    : {data['text_ids'][:4]}...")
    print(f"  bbox_stream[0:2] : {data['bbox_stream'][:2]}")
    print(f"  patch_ids count  : {len(data['patch_ids'])}")

    print("\nDONUT SCHEMA (invoice)")
    print("-" * 60)
    schema = donut_schema("invoice")
    print(json.dumps(schema, indent=2))


def eras_table() -> None:
    print("\nTHREE ERAS OF DOCUMENT AI")
    print("-" * 60)
    rows = [
        ("Era 1 OCR pipeline",    "Tesseract, TrOCR, LayoutLMv3", "deterministic"),
        ("Era 2 OCR-free",        "Donut, Nougat, DocLLM",         "generalist less"),
        ("Era 3 VLM-native",      "Qwen2.5-VL, PaliGemma 2, Claude 4.7", "frontier 2026"),
    ]
    for era, examples, trait in rows:
        print(f"  {era:<20}{examples:<36}{trait}")


def main() -> None:
    print("=" * 60)
    print("DOCUMENT AND DIAGRAM UNDERSTANDING (Phase 12, Lesson 22)")
    print("=" * 60)

    demo_pipeline_output()
    token_budget()
    eras_table()

    print("\nRECIPE PICKER")
    print("-" * 60)
    print("  10M invoices/day     : OCR pipeline + LayoutLMv3, cheap")
    print("  scientific papers    : Nougat for math, VLM for figures")
    print("  mixed + handwriting  : VLM-native (PaliGemma 2 or Qwen2.5-VL)")
    print("  regulated            : OCR + VLM cross-check, auditable")


if __name__ == "__main__":
    main()
