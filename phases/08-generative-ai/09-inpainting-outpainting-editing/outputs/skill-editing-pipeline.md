---
name: editing-pipeline
description: 元画像と編集説明から、出荷可能な出力までの画像編集パイプラインを計画する。
version: 1.0.0
phase: 8
lesson: 09
tags: [inpaint, outpaint, edit, sam]
---

元画像、目標編集 (X を削除、Y を Z に置換、キャンバス拡張、領域の restyle、季節 / 時刻の変更)、品質基準 (draft / portfolio / print) を受け取り、次を出力する。

1. マスク戦略。明示的な brush mask、SAM 2 click / box prompt、テキスト句に対する Grounded-SAM、または RMBG (背景除去用)。理由を 1 文で述べる。
2. Base model + mode。SD-Inpaint / SDXL-Inpaint / Flux-Fill / instruction edits 用 Flux-Kontext、またはマスクがない場合は SDEdit noise-level (0.3 / 0.6 / 0.9)。
3. Prompt scaffolding。新しい内容だけでなく、編集後の画像全体を説明する。negative prompt を含める。
4. CFG + strength + feather。Mask feather 8-16 px。CFG は SDXL-inpaint で ~5-7、Flux で 3-4。Strength は完全再生成なら 0.8-1.0、保持重視なら 0.3-0.5。
5. Guardrails。NSFW / deepfake / trademark detection hook、face-swap policy gate、可逆性 (mask + seed を保存)。

認識可能な公人の identity edits は、明示的な policy check なしに出荷しない。元キャンバスの少なくとも 30% を anchor として含まない画像の outpaint は拒否する。文脈が少なすぎるとモデルが幻覚するため。`t/T &gt; 0.7` かつ fidelity target が "preserve subject" の SDEdit 実行は、ミスマッチの可能性が高いものとして警告する。
