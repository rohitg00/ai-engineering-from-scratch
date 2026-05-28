# OpenAI Preparedness Framework and DeepMind Frontier Safety Framework

> OpenAI Preparedness Framework v2（2025 年 4 月）は Research Categories を導入しました。これは Tracked Categories とは別で、Long-range Autonomy、Sandbagging、Autonomous Replication and Adaptation、Undermining Safeguards を含みます。Tracked Categories は Capabilities Reports と Safeguards Reports を発火させ、それらは Safety Advisory Group によってレビューされます。DeepMind の FSF v3（2025 年 9 月、Tracked Capability Levels は 2026 年 4 月 17 日に追加）は、autonomy を ML R&D と Cyber domains に組み込みます（ML R&D autonomy level 1 = human + AI tools と比較して競争力のあるコストで AI R&D pipeline を完全自動化すること）。FSF v3 は、instrumental-reasoning misuse に対する automated monitoring を通じて deceptive alignment を明示的に扱っています。正直に言えば、PF v2 の Research Categories（Long-range Autonomy を含む）は自動的には mitigations を発火させません。policy language は "potential" です。DeepMind 自身も、instrumental reasoning が強くなれば automated monitoring は「長期的には十分であり続けない」と述べています。

**種別:** 学習
**言語:** Python (stdlib, three-framework decision-table diff tool)
**前提条件:** Phase 15 · 19 (Anthropic RSP)
**所要時間:** 約45分

## 問題

Lesson 19 では Anthropic の scaling policy を精読しました。このレッスンでは OpenAI と DeepMind の文書を読み、全体像を完成させます。3つの文書は同じ問いに取り組む近縁の artifact です。その問いとは、frontier lab はどの時点で model を pause または gate すべきか、というものです。3者は少数のカテゴリへ収束しつつ、重要な具体点では分岐しています。

収束している点: 3者すべてが long-range autonomy を追跡すべき capability class として扱っています。3者すべてが deceptive behavior（alignment faking、sandbagging）を固有の risk class として認めています。3者すべてに internal review body があります。分岐している点: OpenAI はカテゴリを "Tracked"（mandatory mitigation）と "Research"（automatic trigger なし）に分けます。DeepMind は autonomy を独立して名指しするのではなく、2つの domain に組み込みます。lab は Tracked vs Research、Critical vs Moderate、Tier-1 vs Tier-2 といった名前を付けますが、capability がどの bucket に置かれるかによる operational consequence は lab ごとに異なります。

一緒に読むことが有用な演習です。同じ capability が、Anthropic では "mandatory mitigation"、OpenAI では "monitored but not triggering"、DeepMind では "tracked in a specific domain" になることがあります。policy posture が重要です。

## コンセプト

### OpenAI Preparedness Framework v2（2025 年 4 月）

構造:

- **Tracked Categories**: Capabilities Reports（model が何をできるか）と Safeguards Reports（どの mitigations が整っているか）を発火させます。deployment 前に Safety Advisory Group がレビューします。
- **Research Categories**: lab が追跡しているが、まだ具体的な mitigations にはコミットしていない model capabilities。Long-range Autonomy、Sandbagging、Autonomous Replication and Adaptation、Undermining Safeguards を含みます。

v2 の key framing: Research Categories は自動的には mitigations を発火させません。policy language は "potential" mitigations です。ここが注視すべき具体的な差分です。カテゴリが Tracked にあるか Research にあるかは、"gated" と "observed" の分岐点です。

### DeepMind Frontier Safety Framework v3（2025 年 9 月、Tracked Capability Levels は 2026 年 4 月 17 日追加）

構造:

- **Critical Capability Levels (CCLs)**: 5つの domain（Cyber、Bio、ML R&D、CBRN、Autonomy。ただし autonomy は ML R&D と Cyber に組み込まれる）にまたがる capability thresholds。
- **Tracked Capability Levels**: 2026 年 4 月に追加されたさらなる粒度。具体例: ML R&D autonomy level 1 = human + AI tools と比較して競争力のあるコストで AI R&D pipeline を完全自動化する。
- **Deceptive alignment monitoring**: instrumental-reasoning misuse に対する automated monitoring への明示的コミットメント。

Autonomy の framing は OpenAI と異なります。DeepMind は "Autonomy" を top-level domain として維持せず、autonomy が害を引き起こす domain（ML R&D と Cyber）に組み込みます。その主張は、domain のない autonomy は risk のない capability だ、というものです。反論は、domain 横断の autonomy は framework が名指しすべき meta-risk だ、というものです。

### 3者が収束している点

- Internal Safety Advisory Group（Anthropic SAG、OpenAI SAG、DeepMind internal committee として名指しされる）。high-capability model では deployment 前にレビューする。
- deceptive alignment / alignment faking を risk class として明示的に言及する。
- 宣言された cadence を持つ standing artifacts（Anthropic: Frontier Safety Roadmap、Risk Report。OpenAI: Capabilities and Safeguards Reports。DeepMind: FSF update cycle）。
- monitoring-only defenses には上限があることを認める。DeepMind は明示的に「automated monitoring will not remain sufficient long-term」と述べています。

### 分岐している点

- **Anthropic**: v3.0 で pause commitment が削除された。AI R&D-4 threshold が名指しされた次の gate。
- **OpenAI**: Tracked と Research の分割。Research Categories（Long-range Autonomy を含む）は自動的には gate しない。
- **DeepMind**: autonomy を他の domain に組み込む。Tracked Capability Levels が 2026 年 4 月に粒度を追加した。

### Sandbagging: 3者すべてを複雑にする具体的 capability

Sandbagging（model が評価で戦略的に低い performance を示すこと）は OpenAI の Research Categories に入っています。Anthropic の RSP v3.0 は evaluation-context gap（Lesson 1）を通じてこれを扱います。DeepMind は FSF v3 の deceptive alignment monitoring を通じて扱います。

model が評価で sandbag する場合、あらゆる framework の capability thresholds は過小評価されます。framework が機能するのは measurement が機能する場合だけです。だからこそ、lab self-assessment に加えて external measurement（Lesson 21、METR）と adversarial evaluation が必要です。

### policy を読む skill

- Locate: 気にする capability はすべて policy 内で見つけられるべきです。見つからないなら、その policy はそれをカバーしていません。
- Classify: それは Tracked（mitigation を発火）ですか、それとも Research（追跡するが発火しない）ですか。OpenAI はこれを名指しします。Anthropic と DeepMind にもそれぞれの対応物があります。
- Cadence: policy は宣言された schedule で更新されますか、それとも特定イベント後だけですか。宣言された cadence の方が強いです。
- Independence: external review は必須ですか、それとも optional ですか。Anthropic は Apollo と US AI Safety Institute と提携しています。OpenAI は METR と提携しています。DeepMind は主に internal SAG です。

## 使ってみる

`code/main.py` は小さな decision-table diff tool を実装しています。capability（autonomy、deceptive alignment、R&D automation、cyber uplift など）を与えると、3つの policy がそれぞれその capability をどう分類し、どの mitigations を発火させるかを出力します。これは reading aid であり、policy tool ではありません。

## 出荷する

`outputs/skill-cross-policy-diff.md` は、3つの framework を参照として使い、特定 capability の cross-policy comparison を作成します。

## 演習

1. `code/main.py` を実行してください。少なくとも2つの capability について、diff tool の出力が source documents で確認できる policy と一致することを確かめてください。

2. OpenAI Preparedness Framework v2 全文を読んでください。各 Research Category を特定します。それぞれについて、なぜ Tracked ではなく Research に入っているのかを1文で書いてください。

3. DeepMind FSF v3 全文と、2026 年 4 月の Tracked Capability Levels update を読んでください。ML R&D autonomy level 1 の具体的 evaluation criteria を特定します。外部からどのように測定しますか。

4. Sandbagging は OpenAI の Research Categories に入っています。sandbagging model に実際の capability を明らかにさせる evaluation を設計してください。Lesson 1 の eval-context-gaming の議論を参照してください。

5. 特定の capability（自分で選んでください）について3つの policy を比較してください。どの policy の分類が最も厳密だと思うか、どれが最も弱いと思うかを名指ししてください。source text に基づいて正当化してください。

## 重要用語

| Term | よく言われること | 実際の意味 |
|---|---|---|
| Preparedness Framework | 「OpenAI の scaling policy」 | PF v2（2025 年 4 月）。Tracked と Research categories |
| Tracked Category | 「Mandatory mitigation」 | Capabilities + Safeguards Reports と SAG review を発火させる |
| Research Category | 「Monitored only」 | 追跡されるが automatic mitigation はない。Long-range Autonomy を含む |
| Frontier Safety Framework | 「DeepMind の scaling policy」 | FSF v3（2025 年 9 月）+ Tracked Capability Levels（2026 年 4 月） |
| CCL | 「Critical Capability Level」 | DeepMind の domain ごとの threshold（Cyber、Bio、ML R&D、CBRN） |
| ML R&D autonomy level 1 | 「R&D automation」 | AI R&D pipeline を競争力のあるコストで完全自動化すること |
| Sandbagging | 「Strategic underperformance」 | model が evals で低い performance を示すこと。OpenAI Research Categories に入る |
| Instrumental reasoning | 「Means-ends reasoning」 | 目標達成の方法についての reasoning。DeepMind monitoring の対象 |

## 参考資料

- [OpenAI — Updating our Preparedness Framework](https://openai.com/index/updating-our-preparedness-framework/) — v2 announcement。
- [OpenAI — Preparedness Framework v2 PDF](https://cdn.openai.com/pdf/18a02b5d-6b67-4cec-ab64-68cdfbddebcd/preparedness-framework-v2.pdf) — full document。
- [DeepMind — Strengthening our Frontier Safety Framework](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) — FSF v3 announcement。
- [DeepMind — Updating the Frontier Safety Framework (April 2026)](https://deepmind.google/blog/updating-the-frontier-safety-framework/) — Tracked Capability Levels addition。
- [Gemini 3 Pro FSF Report](https://storage.googleapis.com/deepmind-media/gemini/gemini_3_pro_fsf_report.pdf) — FSF format の Risk Report の例。
