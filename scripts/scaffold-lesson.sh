#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  cat <<'USAGE' >&2
使い方: scripts/scaffold-lesson.sh <phase-dir> <lesson-slug> [title]

例:
  scripts/scaffold-lesson.sh 05-nlp-foundations-to-advanced 03-tokenizers
  scripts/scaffold-lesson.sh 05-nlp-foundations-to-advanced 03-tokenizers "Tokenizers from Scratch"

phases/<phase-dir>/<lesson-slug>/ に code/, notebook/, docs/, outputs/ を作り、
LESSON_TEMPLATE.md をもとにした docs/en.md の雛形を入れます。
USAGE
  exit 2
fi

PHASE="$1"
LESSON="$2"
TITLE="${3:-}"

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [[ -z "$REPO_ROOT" ]]; then
  echo "エラー: ai-engineering-from-scratch のgit repo内で実行してください" >&2
  exit 1
fi

PHASE_DIR="$REPO_ROOT/phases/$PHASE"
LESSON_DIR="$PHASE_DIR/$LESSON"

if [[ ! -d "$PHASE_DIR" ]]; then
  echo "エラー: phase dirが見つかりません: phases/$PHASE" >&2
  echo "       有効なphaseを見るには実行: ls phases/" >&2
  exit 1
fi

if [[ -e "$LESSON_DIR" ]]; then
  echo "エラー: lessonは既に存在します: phases/$PHASE/$LESSON" >&2
  exit 1
fi

if [[ ! "$LESSON" =~ ^[0-9]{2}-[a-z0-9-]+$ ]]; then
  echo "エラー: lesson slugは NN-kebab-case に一致する必要があります（例: 03-tokenizers）" >&2
  exit 1
fi

mkdir -p "$LESSON_DIR/code" "$LESSON_DIR/notebook" "$LESSON_DIR/docs" "$LESSON_DIR/outputs"

PRETTY_TITLE="$TITLE"
if [[ -z "$PRETTY_TITLE" ]]; then
  PRETTY_TITLE="$(echo "${LESSON#[0-9][0-9]-}" | tr '-' ' ' | awk '{for (i=1; i<=NF; i++) $i=toupper(substr($i,1,1)) substr($i,2);}1')"
fi

PHASE_NUM="${PHASE%%-*}"
LESSON_NUM="${LESSON%%-*}"

cat >"$LESSON_DIR/docs/en.md" <<EOF
# $PRETTY_TITLE

> [一文のモットー。記憶に残る中核アイデア。]

**タイプ:** 構築
**言語:** Python
**前提条件:** [前提となるレッスン]
**時間:** 約75分

## 課題

[2-3段落。この内容がないと学習者は何ができないのか。具体化する。]

## 考え方

[直感から始める。図、表、メンタルモデル。まだコードは出さない。]

## 作ってみる

### ステップ1: [名前]

[説明]

\`\`\`python
# ここにコード
\`\`\`

### ステップ2: [名前]

[説明]

\`\`\`python
# ここにコード
\`\`\`

## 使ってみる

[実際のフレームワークが同じ問題をどう解くか。自分の実装と比較する。]

## 形にしてみる

[このレッスンが生み出す再利用可能なartifact。outputs/ に保存する。]

## 演習

1. [易 — 中核概念を定着させる]
2. [中 — 別の問題に適用する]
3. [難 — 拡張する、または以前のレッスンと組み合わせる]

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|----------------|----------------------|
|      |                |                      |

## さらに読む

- []() — []
EOF

cat >"$LESSON_DIR/code/main.py" <<'EOF'
def main():
    raise NotImplementedError("レッスンを実装してください")


if __name__ == "__main__":
    main()
EOF

touch "$LESSON_DIR/notebook/.gitkeep"
touch "$LESSON_DIR/outputs/.gitkeep"

echo "created phases/$PHASE/$LESSON/"
echo ""
echo "次:"
echo "  1. phases/$PHASE/$LESSON/docs/en.md を編集"
echo "  2. phases/$PHASE/$LESSON/code/main.py を書く"
echo "  3. ROADMAP.md の Phase $PHASE_NUM にmarkdown link行を追加:"
echo "     | $LESSON_NUM | [$PRETTY_TITLE](phases/$PHASE/$LESSON) | ✅ | ~75 min |"
echo "  4. atomic commit: git add phases/$PHASE/$LESSON ROADMAP.md && git commit -m \"feat(phase-$PHASE_NUM/$LESSON_NUM): $PRETTY_TITLE\""
