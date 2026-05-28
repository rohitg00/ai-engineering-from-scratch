# 図版インデックス

`site/assets/figures/` 配下で提供されるすべての図版を下に列挙します。FIG 番号はグローバルで、単調増加し、再利用しません。

ビジュアル方針は `blueprint-diagram` Claude Code skill に記録されています。この skill は、このプロジェクトの「vendor/tooling artifact を repo に入れない」ルールに従い、この repo とは別に配布されます。インストール後の skill source は `~/.claude/skills/blueprint-diagram/` にあります。インストール場所は maintainer に確認するか、skill を使わない手作業の流れとして下の [追加方法](#追加方法) に従ってください。

| FIG | slug | phase | lesson | added | notes |
|---|---|---|---|---|---|
| 000 | (curriculum stack — embedded in the README banner) | — | — | 2026-05-09 | hero。`assets/banner.svg` にあり、この dir にはありません |
| 001 | exploded-view-floppy | — | — | 2026-05-09 | skill 用の reference example。`~/.claude/skills/blueprint-diagram/references/examples/` 配下にあります |
| 001.A | prompts | — | — | 2026-05-13 | README の「すべてのレッスンが何かを出荷する」card。prompt artifact icon |
| 001.B | skills | — | — | 2026-05-13 | README card。SKILL.md drop-in icon |
| 001.C | agents | — | — | 2026-05-13 | README card。ReAct-style agent loop icon |
| 001.D | mcp-servers | — | — | 2026-05-13 | README card。tools/resources/prompts 付き MCP server rack icon |
| 002 | kernel-surface-gaussian | — | — | 2026-05-09 | skill 用の reference example |
| 003 | pixel-vector-bezier | — | — | 2026-05-09 | skill 用の reference example |
| 004 | gaussian-kernel-blur | 1 | 8 | 2026-05-09 | "Optimization: Gradient Descent Family" lesson 用の gaussian blur visualization |
| 005 | transformer-attention-heads | 7 | 1 | 2026-05-09 | multi-head attention block の exploded view |

## 採番

- `001`-`099`: カリキュラム前半の図版用に予約 (Phases 0-7)。
- `100`+: 作成順に割り当てます。
- サブ図版は `004.A`, `004.B` のような letter suffix を使います。親の row を共有します。

## 追加方法

`blueprint-diagram` skill がインストール済みの場合:

1. コンセプトの説明を指定して skill を実行します。
2. skill は SVG を `site/assets/figures/NNN-slug.svg` に書き込み、次の空き番号でこの表へ row を追加し、必要なら `![FIG_NNN](path)` で該当レッスン markdown に接続します。

skill がない場合は手作業で行います:

1. cream + blueprint aesthetic の SVG を作ります (cream `#fafaf5` paper、`#3553ff` blueprint blue strokes、leader line 付き JetBrains Mono uppercase labels、他の色アクセントなし)。
2. 上の表から次の空き FIG 番号を使い、`site/assets/figures/<NNN>-<slug>.svg` として保存します。
3. FIG 番号、slug、対象 phase + lesson、今日の日付、1 行 note をこの表に追加します。
4. レッスン markdown から `![FIG_NNN](../../site/assets/figures/<NNN>-<slug>.svg)` として参照します。
5. 480 / 720 / 1200 px の viewport 幅で確認します。label は geometry と重なってはならず、leader line は対象に届いている必要があります。

## ライセンス

図版は repo の MIT license の下で公開されます。MIT license は source SVG を配布するとき copyright notice の保持を求めます。rendered image の視覚的再利用 (例: blog post や slide deck への埋め込み) は追加 attribution なしで問題ありません。
