"""scripts/ ツールで共有するヘルパー。

現在提供するもの:
- parse_frontmatter: Markdown の `--- ... ---` ブロック用の最小YAMLサブセットパーサー。

外部依存なし。Python 3.10+（型ヒントでPEP 604 unionを使用）。
"""

from __future__ import annotations


def parse_frontmatter(text: str) -> dict[str, object] | None:
    """Markdown文字列先頭のYAMLサブセットfrontmatterブロックを解析する。

    frontmatterが存在しない、または終了側の `---` が欠けている場合は None を返す。

    対応形式:
    - bare string: `key: value`
    - single-quoted: `key: 'value'`
    - double-quoted: `key: "value"`
    - list: `key: [a, b, "c"]`
    - `#` で始まるインラインコメント行
    """
    if not text.startswith("---\n"):
        return None
    # 終了デリミタ: ファイル途中の "\n---\n"、またはEOF直前の "\n---"。
    end = text.find("\n---\n", 4)
    if end == -1 and text.endswith("\n---"):
        end = len(text) - 4
    if end == -1:
        return None
    block = text[4:end].strip("\n")
    result: dict[str, object] = {}
    for raw in block.splitlines():
        # 0列目だけを見る。コメントとインデント行はスキップする。
        if not raw or raw.startswith("#") or raw[0] in (" ", "\t"):
            continue
        if ":" not in raw:
            continue
        key, _, value = raw.partition(":")
        key = key.strip()
        if not key:
            continue
        value = value.strip()
        if value.startswith("[") and value.endswith("]"):
            inner = value[1:-1].strip()
            result[key] = (
                [item.strip().strip("'\"") for item in inner.split(",") if item.strip()]
                if inner
                else []
            )
        elif (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        ):
            result[key] = value[1:-1]
        else:
            result[key] = value
    return result
