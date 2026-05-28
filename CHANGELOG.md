# 変更履歴

カリキュラムの更新内容です。新しいものから順に並べています。

形式は [Keep a Changelog](https://keepachangelog.com/) にゆるく従っています。各項目にはフェーズ、レッスン、変更内容を記載しているため、学習者は差分へ直接移動できます。

## [Unreleased]

### 追加
- `scripts/scaffold-lesson.sh` — 完全なフォルダ構造と、`LESSON_TEMPLATE.md` から事前入力された `docs/en.md` スケルトンを持つ `phases/NN-phase/NN-lesson/` を作成するスキャフォルダー。
- `.github/PULL_REQUEST_TEMPLATE.md` — コントリビューター向けチェックリスト（コードが実行できること、コードコメントなし、built-from-scratch-first、レッスンごとの atomic commit、ROADMAP 行の markdown-link）。
- `.github/ISSUE_TEMPLATE/bug_report.md` と `new_lesson_proposal.md` — バグ報告とレッスン提案を構造化して受け付けるテンプレート。
- この `CHANGELOG.md`。

## 2026-04 — Phase 4: Computer Vision 完了

### 追加
- Phase 4 の全 28 レッスン。画像の基礎からマルチモーダルビジョン（VLMs、3D、video、self-supervised）までを扱います。
- `ROADMAP.md` の Phase 4 行をレッスンフォルダへの markdown リンクにし、Web サイトに表示されるようにしました。

### 修正
- Phase 4 の 15 レッスン以上にわたる精度調整:
  - `phase-4/02`: shape calculator で、adaptive pool、flatten、linear に対する RF/stride の扱いを明記。
  - `phase-4/03`: backbone selector の説明で対象ファミリーをすべて列挙。OCR、medical、industrial 向けの head ガイダンスを追加。
  - `phase-4/04`: classification diagnostics で failure mode ごとに定量しきい値を使用。未定義メトリクスには `n/a` を明記。3 クラス未満への guard を追加。
  - `phase-4/06`: detection metric reader で `mAP@0.5` ではなく `AP@0.5` を使用。per-class recall は任意と明記。anchor designer で stride truncation と single-anchor-per-level path を明確化。
  - `phase-4/10`: sampler picker で `unet_forward_ms` を入力として宣言。ControlNet guard を rule 0 に昇格。
  - `phase-4/14`: ViT inspector を refusal rule に合わせ、port attempts は推奨ではなく監査対象とした。
  - `phase-4/24`: open-vocab stack picker に明示的な rule precedence と license-filter semantics を追加。concept designer で step-5/rule-80 conflict を解消。
  - `phase-4/25`: VLM docs の `_merge` が placeholder mismatch 時に説明的な `ValueError` を送出。CMER は内部で normalise。
  - `phase-4/27`: `synthetic_frames` が GT boxes を frame H/W に clip。
  - `phase-4/28`: `rope_3d` が dim split を検証。DiT block example から未使用の `F` import を削除。

## 2026-Q1 以前

### 追加
- Phase 0（Setup & Tooling）: 全 12 レッスン。
- Phase 1（Math Foundations）: 全 22 レッスン。
- Phase 2（ML Fundamentals）: 全 18 レッスン。
- Phase 3（Deep Learning Core）: perceptron、backprop、optimizers までの中核レッスン。
- 組み込み Claude Code skills: `find-your-level`（placement quiz）と `check-understanding`（per-phase quiz）。
- `aiengineeringfromscratch.com` の Web サイト: catalog、レッスン別ページ、roadmap、277 語の glossary。
- 全 20 フェーズの初期スキャフォールド（`phases/00-*` から `phases/19-*`）。
- `LESSON_TEMPLATE.md`、`CONTRIBUTING.md`、`ROADMAP.md`、`README.md`。

[Unreleased]: https://github.com/rohitg00/ai-engineering-from-scratch/compare/HEAD...HEAD
