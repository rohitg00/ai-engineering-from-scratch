# Negotiation and Bargaining

> agent は resources、prices、task allocations、terms を negotiate する。2026 年の benchmark set は明確だ。NegotiationArena (arXiv:2402.05863) は、LLM が persona manipulation ("desperation") で payoff を約20%改善できることを示す。"Measuring Bargaining Abilities" (arXiv:2402.15813) は buyer が seller より難しく、scale は助けにならないことを示す。彼らの **OG-Narrator** (deterministic offer generator + LLM narrator) は deal rate を 26.67% から 88.88% に押し上げた。Large-Scale Autonomous Negotiation Competition (arXiv:2503.06416) は約18万件の negotiation を実行し、**chain-of-thought-concealing** agents が counterpart に reasoning を隠すことで勝つことを見つけた。Harvard Negotiation Project metrics に基づく Bhattacharya et al. 2025 は、Llama-3 を most-effective、Claude-3 を aggressive、GPT-4 を fairest と ranking した。この lesson は Contract Net Protocol (FIPA の祖先、Lesson 02) を実装し、LLM-style buyer/seller を配線し、OG-Narrator-style decomposition を実行し、各 structural choice で deal rate がどう変わるかを測る。

**種別:** 学習 + 構築
**言語:** Python (stdlib)
**前提条件:** Phase 16 · 02 (FIPA-ACL Heritage), Phase 16 · 09 (Parallel Swarm Networks)
**所要時間:** 約75分

## 問題

2つの agent が price に合意する必要がある。pure language prompt だけで任せると、2024-2026 年の LLM は tightly-parameterized bargain で驚くほど低い rate (~27%、arXiv:2402.15813) でしか deal を close しない。scale は解決にならない。GPT-4 は bargaining に構造的に GPT-3.5 より優れているわけではない。bargaining の *language* が上手いだけである。

根本原因は、LLM が2つの仕事、offer の決定と offer の narration を混同することだ。OG-Narrator はこれを分離した。deterministic offer generator が numeric move を計算し、LLM は narration だけを行う。deal rate は約89%に跳ね上がる。

これは古典的 multi-agent finding と一致する。mechanism を communication layer から decouple すると勝つ。Contract Net Protocol (FIPA, 1996; Smith, 1980) は task-market mechanism の参照である。LLM を narration slot に差し込めば、modern LLM-powered task market になる。

## コンセプト

### Contract Net, in one paragraph

Smith の 1980 Contract Net Protocol: **manager** が **call for proposals (cfp)** を broadcast する。**bidders** は offer を含む **propose** message で応答する。manager は winner を選び、winner へ **accept-proposal**、loser へ **reject-proposal** を送る。winner は work を実行する。optional message: **refuse** (bidder が proposal を辞退する)。FIPA はこれを `fipa-contract-net` interaction protocol として codify した。

### Why OG-Narrator wins

"Measuring Bargaining Abilities of Language Models" (arXiv:2402.15813) は次を観察した:

- LLM はしばしば bargaining rule を破る (nonsensical price で offer する、相手側の ZOPA を無視する)。
- anchoring が下手 (悪い first offer を受け入れる、strategic amount ではなく symbolic amount で counter-offer する)。
- scale だけでは直らない。large model はより plausible な language を作るが、strategic error は似たままだ。

OG-Narrator decomposition:

```
           ┌──────────────────┐        ┌──────────────────┐
  state  → │ offer generator  │ price → │  LLM narrator    │ → message
           │  (deterministic) │        │  (writes the     │
           │                  │        │   human-style    │
           └──────────────────┘        │   accompaniment) │
                                       └──────────────────┘
```

offer generator は古典的 negotiation strategy である。Rubinstein bargaining model、Zeuthen strategy、あるいは price 上の simple tit-for-tat。LLM は narrate する。message には deterministic price と natural-language framing が含まれる。

deal rate が上がる理由:
- price が bargaining zone に留まる。
- anchor が emotional ではなく strategic になる。
- LLM は得意なこと、writing を行う。

### NegotiationArena findings

arXiv:2402.05863 は canonical benchmark を提供する。headline findings:

- LLM は persona ("I am desperate to sell this by Friday") を採用することで payoff を約20%改善できる。persona manipulation は実在する tactic である。
- fair/cooperative agents は adversarial agents に exploit される。defense には explicit counter-posturing が必要。
- symmetric pair-up は benchmark scenario の約40%で inequitable outcome に収束する。

これは「LLM は negotiator として悪い」ではない。「LLM は exploitable な部分を含め、人間のように negotiation しすぎる」ということだ。

### Chain-of-thought concealment

Large-Scale Autonomous Negotiation Competition (arXiv:2503.06416) は多くの LLM strategy で約18万件の negotiation を実行した。winner は counterpart から reasoning を隠していた:

- agent が publicly visible scratchpad に "I will only go to $75; my reservation price is $70" と出力すると、opponent がそれを読む。
- winner は strategy を private に計算する。output channel は offer と必要最小限の narration だけを含む。

これは classical game theory (Aumann 1976 on rationality and information) の 2026 年版の反響だ。private valuation を明かすと payoff を失う。LLM はこれを直感せず、counterpart から見える reasoning trace に reservation を喜んで書いてしまう。

engineering takeaway: private-scratchpad context と public-message context を分離する。optional ではない。

### Bhattacharya et al. 2025 — model rankings

Harvard Negotiation Project metrics (principled negotiation、BATNA respect、interest reciprocity) では:

- **Llama-3** は bargain を成立させる点で most-effective (deal rate + payoff)。
- **Claude-3** は most-aggressive negotiator (高い anchor、遅い concession)。
- **GPT-4** は fairest (pairing 間 payoff variance が最小)。

これは 2025 年の snapshot だ。point は 2026 年 4 月にどの model が勝つかではない。異なる base model が persistent negotiation style を持つということだ。heterogeneous ensemble (Lesson 15) はこれを diversity source として含む。

### Task allocation via Contract Net + LLM

LLM multi-agent における Contract Net の modern re-use:

1. Manager agent が task を unit に分解する。
2. task description 付き `cfp` を worker agents に broadcast する。
3. 各 worker が offer を返す: `(price, eta, confidence)`。price は token、compute units、dollars のいずれでもよい。
4. manager が winner (task に応じて single または multiple) を選び award する。
5. rejected worker は他 task に bid できる。

coordination が synchronous chat ではなく broadcast-and-respond なので、100 workers を大きく超えて scale する。production では Microsoft Agent Framework の orchestration patterns や一部の LangGraph implementation で使われる。

### LLM-Stakeholders Interactive Negotiation

NeurIPS 2024 (https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf) は、**secret scores** と **minimum-acceptance thresholds** を持つ multi-party scorable games を導入した。各 stakeholder は private utilities を持ち、LLM は message からそれを infer しなければならない。これは two-party bargaining を N-party coalition formation に generalize したものだ。heterogeneous worker capabilities を持つ production task market に関連する。

### The narration-vs-mechanism rule

2024-2026 年の negotiation benchmark 全体で一貫する engineering rule は:

> Let the LLM narrate. Do not let the LLM compute the offer.

offer が number (price、ETA、quantity) である必要があるなら、negotiation state から deterministic に生成し、LLM には framing を生成させる。offer が proposal structure (task decomposition、role assignment) である必要があるなら、LLM に draft させてもよいが、送信前に schema と constraint-check で validate する。

## 実装

`code/main.py` は次を実装する:

- `ContractNetManager`, `ContractNetTask`, `Bid` — manager + bidders、cfp の broadcast、proposal の collection、award。
- `og_narrator_bargain(state, rng)` — OG-Narrator buyer: midpoint に向けた deterministic Zeuthen-style concession。
- `seller_response(state, rng)` — deterministic seller counter-offer policy (両 style に対する structural ground truth)。
- `naive_llm_bargain(state, rng)` — all-LLM bargainer の simulation。高 variance で、しばしば ZOPA 外の price を選ぶ。
- Measurement: trial ごとに fresh reservation prices を sample し、1000 trials の deal rate を測る。

Run:

```
python3 code/main.py
```

期待される出力: naive-LLM deal rate は約 65-75%。OG-Narrator deal rate は約 85-95%。15-25 point gap は、offer-generation と narration を分解する structural advantage である。さらに、3 bidder と1 task の Contract Net task-market allocation 例が出る。

## Use It

`outputs/skill-bargainer-designer.md` は bargaining protocol を設計する。誰が offer を生成するか (deterministic または LLM)、誰が narrate するか、private scratchpad を public message からどう分離するか、deal rate をどう monitor するかを含む。

## Ship It

Production bargaining checklist:

- **Separate scratchpad。** private state は counterpart の context に届かない。これは non-negotiable。
- **Deterministic offer generation。** price、quantity、ETA は prompt ではなく compute する。
- **Validate all incoming offers** against a schema。ZOPA 外の offer は protocol boundary で reject する。
- **Bound rounds。** 最大 3-5 rounds。deadlock では mediator に escalate する。
- **Measure deal rate and payoff variance** continuously。deal rate の低下は symptom であり、prompt drift または counterpart-side attack が原因のことが多い。
- **Log all rejected proposals** with the deterministic rationale。Contract Net manager では、losing bidder が理由を理解できる必要がある。

## Exercises

1. `code/main.py` を実行する。OG-Narrator が deal rate で naive-LLM に勝つことを確認する。どれくらい差があるか。
2. **persona-based payoff improvement** (arXiv:2402.05863) を実装する。buyer は narration だけで "desperate to buy this week" persona を採用し、offer generator は変えない。deal rate または payoff は変わるか。
3. chain-of-thought **concealment** を実装する。counterpart に渡さない private scratchpad string を維持する。誤って leak するとどうなるか (channel を入れ替えて simulation する)。
4. Contract Net を reserve price 付き N-bidder auction に拡張する。bid がすべて reserve を超えるとき、manager は lowest-price と highest-quality のどちらで決めるか。どの award rule を選び、なぜか。
5. Harvard Negotiation Project metrics に関する Bhattacharya et al. 2025 を読む。異なる style (aggressive vs fair) の bargainer を2つ実装する。symmetric と asymmetric pairing で payoff variance を測る。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Contract Net | "Task market" | Smith 1980、FIPA 1996。cfp + propose + accept/reject。canonical task-market。 |
| ZOPA | "Zone of possible agreement" | buyer の max と seller の min の重なり。外側の offer は close できない。 |
| BATNA | "Best alternative to a negotiated agreement" | deal が失敗した場合の fallback。reservation price を決める。 |
| OG-Narrator | "Offer generator + narrator" | deterministic offer と LLM narration への decomposition。 |
| Zeuthen strategy | "Risk-minimizing concession" | risk limit に基づいて concession する classical offer-generator。 |
| Rubinstein bargaining | "Alternating-offer equilibrium" | discounting を持つ infinite-horizon bargaining の game-theoretic model。 |
| CoT concealment | "Hide your reasoning" | arXiv:2503.06416 の winner は private scratchpad を保ち、public channel には offer だけを出した。 |
| Persona manipulation | "Emotional posturing" | arXiv:2402.05863: desperation/urgency persona による約20% payoff gain。 |

## 参考文献

- [NegotiationArena](https://arxiv.org/abs/2402.05863) — benchmark。persona manipulation と exploitation findings
- [Measuring Bargaining Abilities of Language Models](https://arxiv.org/abs/2402.15813) — OG-Narrator と buyer-harder-than-seller result
- [Large-Scale Autonomous Negotiation Competition](https://arxiv.org/abs/2503.06416) — 約18万件の negotiation。chain-of-thought concealment が勝つ
- [LLM-Stakeholders Interactive Negotiation (NeurIPS 2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf) — secret utilities を持つ multi-party scorable games
- [Smith 1980 — The Contract Net Protocol](https://ieeexplore.ieee.org/document/1675516) — classical mechanism、IEEE Transactions on Computers
