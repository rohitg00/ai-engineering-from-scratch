# Qwen-VLファミリーとDynamic-FPS動画

> Qwen-VLファミリー、つまりQwen-VL (2023)、Qwen2-VL (2024)、Qwen2.5-VL (2025)、Qwen3-VL (2025)は、2026年時点で最も影響力のあるopen vision-language modelの系譜です。各世代は、open ecosystem全体が12か月以内に追随した、明確なarchitecture上の賭けを1つずつ置きました。M-RoPEによるnative dynamic resolution、absolute time alignment付きdynamic-FPS sampling、ViT内のwindow attention、structured agent output formatです。Qwen3-VLまでにrecipeは安定しました。native-aspect-ratio入力を受ける2D-RoPE-ViT encoder、大規模Qwen3 language baseへ接続するMLP projector、そしてOCR、grounding、agent behaviorを第一級のtargetとして扱うtraining stagesです。このレッスンではQwen-VL系譜を時系列に読み、各ノブがなぜそこにあるのかを理解します。

**種別:** 学習
**言語:** Python (stdlib, M-RoPE encoder + dynamic-FPS sampler)
**前提条件:** Phase 12 · 06 (patch-n'-pack)
**所要時間:** ~120分

## 学習目標

- M-RoPEの3軸rotation（temporal, height, width）を計算し、なぜ3つすべてが必要かを説明できる。
- 動画向けのdynamic-FPS sampling戦略を選び、tokens-per-secondとevent-detection accuracyのtrade-offを説明できる。
- Qwen-VLの4世代のupgradeを順に挙げ、それぞれが何を可能にしたかを説明できる。
- Qwen2.5-VL風のJSON agent output formatを組み、VLM responseからstructured tool callをparseできる。

## 問題

Qwen-VLは2023年8月に、LLaVA-1.5とBLIP-2への直接的な応答として登場しました。Qwenチームが狙ったgapは、resolution、video、structured outputの3つでした。

Resolution: LLaVA-1.5は336x336で動いていました。写真には十分でも、中国語の請求書や密なspreadsheet screenshotには役に立ちません。Qwen-VLの最初のinnovationは448x448とgrounded bounding-box outputで、modelが対象を指し示せるようにしたことでした。

Video: Video-LLaMAはframeごとのencoderを積み、その出力をLLMへ渡しました。短いclipでは動きますが、temporal axis自体がsignalになる数分のvideoには向きません。Qwenチームは、timeを理解するsingle encoderを求めました。

Structured output: LLaVAはfree-form textを出していました。agentにはJSONが必要です。Qwen-VLはbounding-box coordinatesをtextとして含む、明示的なJSON output formatでtrainingされました。

Qwen-VLの各世代は、この3軸のどれかを伸ばしています。

## 概念

### Qwen-VL (2023年8月)

第1世代です。encoderはOpenCLIP ViT-bigG/14（2.5B params）、LLama互換Q-Former（256 queriesの1-step）、baseはQwen-7Bでした。主なcontribution:

- 448x448 resolution（当時のopen VLMとしてはSOTA）。
- Grounding: 明示的なcoordinate-token outputを含むimage-text pairsでtraining。例: "The cat is at <box>(112, 204), (280, 344)</box>"。
- 最初から中国語 + 英語のmultilingual training。

当時のbenchmarkでは、英語でGPT-4Vと競争的、中国語では優勢でした。本当のheadlineはgrounding supervisionでした。

### Qwen2-VL (2024年9月) — M-RoPEとnative resolution

Qwen2-VLは、fixed-resolution + Q-Former stackを、native dynamic-resolution ViT encoderに置き換えました。主な変更:

- Native dynamic resolution。ViTは28で割り切れる任意のHxWを受けます（patch 14、2x spatial merge）。1120x672の画像（40x24 merged patches）は960 visual tokensを生成します。resizeなし、tilingなし、thumbnailなしです。
- M-RoPE (Multimodal RoPE)。各tokenは1Dではなく3D position (t, h, w)を持ちます。画像ではt=0、videoではt = frame_indexです。RoPEはaxisごとのfrequencyでquery/key vectorをrotateします。positional embedding tableはありません。
- MLP projector。Q-Formerを捨て、merged patch tokensに2-layer MLPを使います。
- Dynamic FPS付きvideo。videoはdefaultで1-2 FPS samplingですが、modelは任意のframe数を受けられます。

結果として、Qwen2-VL-7Bは複数のmultimodal benchmarkでGPT-4oに並び、DocVQAでは上回りました（94.5 vs 88.4）。architecture変更が決定打でした。

### Qwen2.5-VL (2025年2月) — dynamic FPS + absolute time

Qwen2.5-VLの大きな変化はvideoです。Dynamic FPSは単に「必要ならframeを増やす」ではありません。paperは次を定式化しました。

- Absolute time tokens。position index（frame 0, 1, 2...）ではなく実timestampを使います。例: "At 0:04, the cat jumps." modelはframe tokensにinterleaveされた`<time>0.04</time>` tokensを見ます。
- Dynamic FPS。遅い映像では1 FPS、actionでは4+ FPSでsampleします。userまたはtrainerが選び、M-RoPEが適応します。
- ViTのwindow attention。throughputのためspatial attentionはwindow化（block内local）し、数layerごとにglobal attentionを入れます。
- 明示的なJSON output format。tool-call dataでtrainingされます: "{\"tool\": \"click\", \"coords\": [380, 220]}"。そのままagent-readyです。
- MRoPE-v2 scaling。max input sizeに応じてpositionをscaleするため、10分videoでもfrequency rangeを使い切りません。

Benchmark: Qwen2.5-VL-72Bは多くのvideo benchmarkでGPT-4oを上回り、documentではGemini 2.0に並び、GUI groundingではopen-model SOTAを出しました（ScreenSpot: 84% accuracy vs GPT-4oの38%）。

### Qwen3-VL (2025年11月)

Qwen3-VLは再発明ではなく統合型のincremental upgradeです。より大きなLLM backbone（Qwen3-72B）、拡張されたtraining data、改善されたOCR、Qwen3の"thinking mode"によるより強いreasoningが中心です。ViTとM-RoPEは維持されます。paperはarchitectureよりもdataとtraining改善に焦点を当てています。

系譜からのtakeaway: 2025年までにQwen-VL architectureは安定しました。追加世代がscaleするのはcomputeとdataであり、primitiveではありません。

### M-RoPEを数式で見る

古典的なRoPEは、dimension `d` のquery `q` をposition `m` に応じてpaired coordinatesでrotateします。

```
q_rot[2i]   = q[2i]   * cos(m * theta_i) - q[2i+1] * sin(m * theta_i)
q_rot[2i+1] = q[2i]   * sin(m * theta_i) + q[2i+1] * cos(m * theta_i)
theta_i     = 10000^(-2i/d)
```

M-RoPEはhidden dimを3つのbandに分けます。例えば`d = 96`なら、temporalに32 dims、heightに32 dims、widthに32 dimsを割り当てます。各bandは自分のaxis positionでrotateします。(t=5, h=10, w=20)のpatchには、3つのbandに`R_t(5)`、`R_h(10)`、`R_w(20)`が適用されます。

Text tokensは互換性を保つために`t = text_index, h = 0, w = 0`（または正規化された選択）を使います。Video framesは`t = frame_time, h = row, w = col`を使います。単一画像では`t = 0`です。

利点は、branching codeや別々のposition tableなしに、1つのposition encodingでtext、image、videoを扱えることです。

### Dynamic-FPS sampling logic

duration `T` secondsのvideoとtarget-tokens budget `B`があるとします。

1. 扱える最大FPSを計算する: `fps_max = B / (T * tokens_per_frame)`。
2. `{1, 2, 4, 8}`から、`fps <= fps_max`を満たすtarget FPSを選ぶ。
3. motionが高い（optical-flow heuristicまたは明示的なuser request）なら高いFPSを選ぶ。motionが低いなら低くする。
4. 選んだFPSでuniform sampleし、frame間に`<time>t</time>` tokensを挿入する。

Qwen2.5-VLはこのlogicを暗黙にtrainingします。inferenceではuserが`fps` parameterで制御します。60秒のaction sequenceを4 FPS、frameあたり81 tokensで扱うと19440 tokensで、32k contextに収まります。

### Structured agent output

Qwen2.5-VLのagent trainingは、structured tool callsを明示的なtargetにしています。

```
{
  "tool": "mouse_click",
  "coords": [1024, 512],
  "button": "left",
  "modifier": null
}
```

Parsingはdeterministicです。model outputにJSON.parseをかければよいだけです。regexと曖昧性処理が必要なfree-formの"click at (1024, 512)"と比べてください。このshiftが、Qwen2.5-VLのScreenSpot scoreをQwen2-VLの55%から84%へ押し上げた理由です。

## 使ってみる

`code/main.py`は次を実装します。

- text、image patches、video framesを混ぜたpacked sequence向けのM-RoPE position computation。
- Dynamic-FPS sampler: (duration, budget, motion_level)からFPSを選び、frame timestampを出す。
- coordinate fields付きtool-call responsesを扱うtoy Qwen2.5-VL JSON-output parser。

実行してから、5分videoでfixed-FPSをdynamic-FPSに変えたときの違いを確認してください。

## 仕上げ

このレッスンは`outputs/skill-qwen-vl-pipeline-designer.md`を作ります。video task（monitoring、agent、action recognition、accessibility）を受け取り、Qwen2.5-VL configuration（frame budget、FPS strategy、window-attention flag、agent-output mode）とlatency estimateを出します。video productでQwen-VL-family modelをdeployするときに使ってください。

## 演習

1. hidden 48（bandあたり16、base theta 10000）で、(t=3, h=5, w=7)のpatchに対するM-RoPE rotationsを計算してください。各bandの最初の3 pairのrotation angleを示してください。

2. 10分のsecurity-camera recordingを1 FPSにすると何frameになりますか。384 resolutionで3x poolを使うとtotal tokensはいくつですか。Qwen2.5-VLのdefault 32k contextで扱えますか。

3. 30秒のtennis rally、30秒のrecipe demo、30秒のUI-agent recordingそれぞれにFPSを選んでください。dynamic-FPS logicで正当化してください。

4. Qwen2.5-VLはQ-Formerを完全に捨てています。2023年ではなく2025年にsimple MLPが機能するのはなぜですか。（Hint: data scaleとencoder quality）

5. 3つのQwen2.5-VL JSON tool-call outputsをPython dictにparseしてください。malformed JSONでは何が失敗し、Qwen cookbookはどんなrecovery strategyを推奨していますか。

## 重要語句

| Term | よく言われること | 実際の意味 |
|------|-----------------|------------------------|
| M-RoPE | "Multimodal RoPE" | hidden dim内にtemporal、height、width bandsを持つ3D rotary position embedding |
| Dynamic FPS | "Smart sampling" | motion、duration、token budgetに基づいてvideoごとに選ぶframe sampling rate |
| Absolute time token | "Timestamp token" | modelがframe indexではなく実秒数を見るよう、sequence内にinterleaveされる`<time>t</time>` |
| Window attention | "Local attention" | speedのため小windowに制限したspatial self-attention。periodicallyにglobal attentionを加える |
| Structured agent output | "JSON mode" | coordsとtool namesを含むparse可能なJSONをVLMに出させるtraining data supervision |
| min_pixels / max_pixels | "Resolution bounds" | total pixel count、したがってtoken countを制限するQwen2.5-VLのrequest単位control |
| Grounding | "Point-at-it" | bounding-box coordinatesをtext tokensとして出力すること。Qwen-VL v1から使われる |

## 参考文献

- [Bai et al. — Qwen-VL (arXiv:2308.12966)](https://arxiv.org/abs/2308.12966)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
- [Qwen Team — Qwen2.5-VL Technical Report (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
- [Qwen Team — Qwen3-VL (arXiv:2511.21631)](https://arxiv.org/abs/2511.21631)
- [Zhu et al. — InternVL3 (arXiv:2504.10479)](https://arxiv.org/abs/2504.10479)
