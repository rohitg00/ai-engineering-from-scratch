"""Batch と同期実行のコストシミュレーター — stdlib Python.

50k-document pipeline を4つの構成で model 化する:
  SYNC              : discount なし、cache なし
  SYNC + CACHE      : system prompt は初回 call 後に cache
  BATCH             : 50% discount、cache なし
  BATCH + CACHE     : 重ね掛け（SYNC bill の約10%）
"""

from __future__ import annotations


BASE_INPUT = 3.00
BASE_OUTPUT = 15.00
CACHED_INPUT = 0.30
CACHE_WRITE_5MIN = 1.25 * BASE_INPUT
BATCH_DISCOUNT = 0.50


def cost_sync(docs: int, prefix_tokens: int, per_doc_tokens: int, out_tokens: int) -> float:
    cost = 0.0
    for _ in range(docs):
        cost += (prefix_tokens / 1e6) * BASE_INPUT
        cost += (per_doc_tokens / 1e6) * BASE_INPUT
        cost += (out_tokens / 1e6) * BASE_OUTPUT
    return cost


def cost_sync_cache(docs: int, prefix_tokens: int, per_doc_tokens: int, out_tokens: int) -> float:
    cost = (prefix_tokens / 1e6) * CACHE_WRITE_5MIN
    for i in range(docs):
        if i > 0:
            cost += (prefix_tokens / 1e6) * CACHED_INPUT
        cost += (per_doc_tokens / 1e6) * BASE_INPUT
        cost += (out_tokens / 1e6) * BASE_OUTPUT
    return cost


def cost_batch(docs: int, prefix_tokens: int, per_doc_tokens: int, out_tokens: int) -> float:
    return cost_sync(docs, prefix_tokens, per_doc_tokens, out_tokens) * BATCH_DISCOUNT


def cost_batch_cache(docs: int, prefix_tokens: int, per_doc_tokens: int, out_tokens: int) -> float:
    return cost_sync_cache(docs, prefix_tokens, per_doc_tokens, out_tokens) * BATCH_DISCOUNT


def run(label: str, docs: int, prefix: int, per_doc: int, output: int) -> None:
    sc = cost_sync(docs, prefix, per_doc, output)
    scc = cost_sync_cache(docs, prefix, per_doc, output)
    bc = cost_batch(docs, prefix, per_doc, output)
    bcc = cost_batch_cache(docs, prefix, per_doc, output)
    print(f"\n{label}")
    print(f"  docs={docs}, prefix={prefix}, per_doc={per_doc}, output={output}")
    print(f"  SYNC            : ${sc:10.2f}  (baseline)")
    print(f"  SYNC + CACHE    : ${scc:10.2f}  (baseline の {scc/sc*100:5.1f}%)")
    print(f"  BATCH           : ${bc:10.2f}  (baseline の {bc/sc*100:5.1f}%)")
    print(f"  BATCH + CACHE   : ${bcc:10.2f}  (baseline の {bcc/sc*100:5.1f}%)")


def main() -> None:
    print("=" * 80)
    print("BATCH API ECONOMICS — batch と prompt caching を重ねて sync bill の約10%へ")
    print("=" * 80)
    run("夜間の文書要約 (50k docs)",
        docs=50_000, prefix=4000, per_doc=2000, output=200)
    run("コンテンツ分類 (200k items, short per item)",
        docs=200_000, prefix=1500, per_doc=300, output=50)
    run("大きなレポート草案 (small N, heavy per item)",
        docs=1_000, prefix=6000, per_doc=15_000, output=2000)


if __name__ == "__main__":
    main()
