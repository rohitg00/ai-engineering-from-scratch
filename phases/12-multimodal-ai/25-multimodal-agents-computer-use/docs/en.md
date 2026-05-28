# Multimodal Agents and Computer-Use (Capstone)

> 2026年の frontier product は、screenshots を読み、buttons を click し、web UI を navigate し、forms を埋め、workflow を end-to-end で完了する multimodal agent である。SeeClick と CogAgent (2024) は GUI-grounding primitive を実証した。Ferret-UI は mobile を追加した。ChartAgent は chart 向け visual tool-use を導入した。VisualWebArena と AgentVista (2026) は frontier が追う benchmark であり、Gemini 3 Pro や Claude Opus 4.7 でさえ AgentVista の hard tasks では約30%にとどまる。この capstone は Phase 12 の全要素、perception (high-res VLM)、reasoning (tool use 付き LLM)、grounding (coordinate output)、long-horizon memory、evaluation を統合する。

**種別:** Capstone
**言語:** Python (stdlib、action schema + agent loop skeleton)
**前提条件:** Phase 12 · 05 (LLaVA)、Phase 12 · 09 (Qwen-VL JSON)、Phase 14 (Agent Engineering)
**所要時間:** 約240分

## 学習目標

- multimodal agent loop、すなわち perceive → reason → act → observe → repeat を設計する。
- VLM が JSON として出力できる GUI grounding output schema (click coordinates、type text、scroll、drag) を作る。
- screenshot-only agents、accessibility-tree agents、hybrid agents を比較する。
- 小さな VisualWebArena slice で multimodal agent benchmark evaluation を組む。

## 問題

booking-site workflow: 「4月15日の東京行き flight を、通路側 seat、$800 未満で探して予約して」。

multimodal agent が必要とする処理:

1. browser の screenshot を取る。
2. screenshot + URL + goal を plan に parse する。
3. structured action を出力する: click (x,y)、type "Tokyo" (element E)、scroll down、select (radio button)。
4. action を browser に適用する。
5. new state (next screenshot) を observe する。
6. task が完了するまで繰り返す。

各 step は multimodal VLM call である。VLM output は parse 可能な JSON でなければならない。error は step をまたいで累積するため、recovery が重要である。

## コンセプト

### GUI grounding — primitive

GUI grounding とは、screenshot と自然言語 instruction が与えられたとき、click すべき (x, y) coordinate (または他の action) を出力することである。

SeeClick (arXiv:2401.10935) は scale した最初の open result だった。synthetic + real GUI data で VLM を fine-tune し、coordinates を plain text tokens として出力する。機能する。

CogAgent (arXiv:2312.08914) は dense UI 向けに 1120x1120 high-resolution encoding を追加した。web navigation で約84%を記録した。

Ferret-UI (arXiv:2404.05719) は mobile UI に集中し、iOS accessibility data と統合する。

出力 format は通常 JSON である。

```json
{"action": "click", "x": 384, "y": 220, "element_desc": "Search button"}
```

`element_desc` は recovery を助ける。screenshots 間で coordinates がずれても、semantic hint により system は re-ground できる。

### Action schemas

典型的な action schema は 6-10 種類の action type を持つ。

- `click`: (x, y)
- `type`: (text, x?, y?)
- `scroll`: (direction, amount)
- `drag`: (x0, y0, x1, y1)
- `select`: (option_index)
- `hover`: (x, y)
- `navigate`: (url)
- `wait`: (ms)
- `done`: (success, explanation)

agent は step ごとに1つの action を出力する。browser wrapper が実行し、新しい state を返す。

### Screenshot-only vs accessibility-tree

入力 mode は2つある。

- Screenshot-only: full image だけで structural info はない。最も general で、任意の app で動く。
- Accessibility tree: structured DOM / iOS accessibility info。grounding の信頼性が大きく上がる。tree が利用できる環境で使える。
- Hybrid: 両方を使う。tree は atomic action の reliable grounder として、screenshot は semantic context として使う。

production agents は可能な限り hybrid を使う。Browser automation (Selenium + accessibility) では常に tree がある。desktop apps では場合による。

### Long-horizon memory

20-step workflow は 20 screenshots を生成する。VLM context はすぐ埋まる。compression strategy は3つ。

- Summary-chain: 5 steps ごとに起きたことを summarize し、古い screenshots を落とす。
- Skip-frame: 最初、最後、3枚ごとの screenshot を保持する。
- Tool-recorded log: action を実行し、何をしたかの text log を保持する。古い screenshots を見返さない。

Claude の computer-use API は log pattern を使う。より単純で、より信頼できる。

### Visual tool use

ChartAgent (arXiv:2510.04514) は chart understanding 向けに visual tool use を導入した。crop、zoom、OCR、external detection を呼ぶ。agent は「region (100, 200, 300, 400) に crop して OCR を呼ぶ」のような tool call を出力できる。tool は text を返し、VLM は reasoning を続ける。

この pattern は一般化できる。set-of-mark prompting、region annotation、external detection tools はすべて「tool call を出力し、structured response を受け取る」schema に収まる。

### 2026 benchmarks

- ScreenSpot-Pro。約1k web screenshots の GUI grounding。Open SOTA は Qwen2.5-VL-72B の約85%。frontier は約90%。
- VisualWebArena。end-to-end web tasks (shop、forum、classifieds)。Open SOTA は約20%。Gemini 3 Pro は約27%。
- AgentVista (arXiv:2602.23166)。2026年で最も難しい benchmark。12 domains の realistic workflows。frontier models は 27-40%、open models は 10-20%。
- WebArena / WebShop。古い benchmark。frontier では saturate しつつある。

### なぜまだ難しいのか

agent performance の bottleneck:

1. fine scale の visual grounding。「小さな X を click」が mobile resolution ではよく失敗する。
2. long-horizon planning。10 actions を超えると agent は goal から drift しやすい。
3. error recovery。click が失敗した (wrong button) ときに検出して回復する data はほとんど training されていない。
4. cross-page context。tabs や長い forms をまたぐと state を失う。

research directions: memory architectures、explicit replanning、multimodal verification (action success の screenshot match)。

### Capstone build-it

capstone task: 次の computer-use agent を作る。

1. booking-site mock page の HTML + screenshot を読む。
2. multi-step sequence を plan する: search → select → fill form → submit。
3. action schema に合う JSON actions を出力する。
4. fixed 10-task slice で評価する。

lesson は real browser へ拡張しやすい scaffold code を提供する。

## 使ってみる

`code/main.py` は capstone scaffold である。

- Action schema JSON definition (10 actions)。
- dict としての mock browser state。
- Agent loop skeleton: state を受け取り、action を出力し、適用し、loop する。
- end-to-end success rate を測る 10-task mini-benchmark (synthetic pages)。
- action が失敗したときの error-recovery hook。

## 仕上げ

この lesson は `outputs/skill-multimodal-agent-designer.md` を生成する。computer-use product (domain、action set、evaluation target) を受け取り、full agent loop、memory strategy、grounding mode、expected benchmark score を設計する。

## 演習

1. action schema に `screenshot_region` tool (crop + zoom) を追加せよ。どの task が恩恵を受けるか。

2. AgentVista (arXiv:2602.23166) を読め。最も難しい task category と、frontier models がまだ失敗する理由を説明せよ。

3. Long-horizon memory compression: live に保持する screenshot を4枚以下にし、log は任意数保持する summary-chain を設計せよ。

4. error-recovery hook を作れ。action failure (button not found) のとき、agent は次に何をするか。

5. screenshot-only Claude 4.7 と hybrid screenshot + accessibility-tree Qwen2.5-VL を10個の web tasks で比較せよ。どちらがどの task で勝つか。

## 重要語句

| Term | よく言われる表現 | 実際の意味 |
|------|-----------------|------------|
| GUI grounding | "Click coordinates" | screenshot 上で instruction の対象となる (x,y) を model が出力すること |
| Action schema | "Tool definitions" | valid actions (click、type、scroll、drag) を定義する JSON |
| Accessibility tree | "Structured DOM" | browser/iOS API から得られる machine-readable UI hierarchy |
| Hybrid agent | "Screenshot + tree" | image と structured info の両方を使う agent。どちらか単独より信頼性が高い |
| Visual tool use | "Zoom/crop/detect" | 計画途中で OCR や detection などの external vision tools を agent が呼ぶこと |
| Summary-chain | "Memory compression" | 長い screenshot history を periodic text summary で置き換える方式 |
| VisualWebArena | "E2E web bench" | end-to-end web tasks 向けの 2024 benchmark |
| AgentVista | "2026 hard bench" | 12-domain realistic workflows。Gemini 3 Pro でも約30% |

## 参考文献

- [Cheng et al. — SeeClick (arXiv:2401.10935)](https://arxiv.org/abs/2401.10935)
- [Hong et al. — CogAgent (arXiv:2312.08914)](https://arxiv.org/abs/2312.08914)
- [You et al. — Ferret-UI (arXiv:2404.05719)](https://arxiv.org/abs/2404.05719)
- [ChartAgent (arXiv:2510.04514)](https://arxiv.org/abs/2510.04514)
- [Koh et al. — VisualWebArena (arXiv:2401.13649)](https://arxiv.org/abs/2401.13649)
- [AgentVista (arXiv:2602.23166)](https://arxiv.org/abs/2602.23166)
