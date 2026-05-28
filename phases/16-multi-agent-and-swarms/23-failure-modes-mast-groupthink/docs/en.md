# Failure Modes — MAST、Groupthink、Monoculture、Cascading Errors

> 2026 年の reference taxonomy は **MAST**（Cemri et al., NeurIPS 2025, arXiv:2503.13657）である。7 つの state-of-the-art open-source MAS から得た 1642 execution traces に基づき、**41–86.7% failure rate** を示した。3 つの root categories: **Specification Problems**（41.77%）— role ambiguity、unclear task definitions; **Coordination Failures**（36.94%）— communication breakdowns、state desync; **Verification Gaps**（21.30%）— missing validation、absent quality checks。**Groupthink** family（arXiv:2508.05687）はさらに、monoculture collapse（同じ base model → correlated failures）、conformity bias（agents が互いの errors を強化する）、deficient theory of mind、mixed-motive dynamics、cascading reliability failures を加える。cascading の例: payment failure が order retries を誘発し、それが inventory retries を誘発し、inventory service を圧倒する retry storms（秒単位で 10x load、circuit breakers が必要）。Memory poisoning: 1 agent の hallucination が shared memory に入り、downstream agents がそれを fact として扱う。accuracy は徐々に decay するため root-cause diagnosis がつらい。**STRATUS**（NeurIPS 2025）は specialized detection / diagnosis / validation agents により mitigation-success が 1.5x 改善したと報告する。この lesson は failure modes を first-class engineering targets として扱う。

**種別:** 学習
**言語:** Python (stdlib)
**前提条件:** Phase 16 · 13 (Shared Memory), Phase 16 · 14 (Consensus and BFT), Phase 16 · 15 (Voting and Debate Topology)
**所要時間:** 約75分

## 問題

multi-agent systems は real tasks で 41-86.7% の確率で失敗する（Cemri et al. 2025 が 7 open-source MAS で測定）。これは「just add more agents」で debug できるものではない。failures には structural causes がある。MAST taxonomy はその categories を与える。この lesson は各 category を concrete detection、diagnosis、mitigation pattern に map し、数字が恣意的に見えないようにする。

2026 年の production practice は、failure modes を design inputs として扱うことだ。architecture は、各 MAST category に対して deploy した mitigation を名指しできるまで「good enough」ではない。

## コンセプト

### MAST categories

**Specification Problems（failures の 41.77%）。** agent の task が十分に tight に定義されていない。Examples:

- Role ambiguity: 2 agents がどちらも自分を reviewer だと思っている。
- Task underspecified: user が特定 angle を求めているのに「summarize this」とだけ言う。
- Success criteria implicit: agent が成功したか判定できない。

Mitigations:
- explicit role contracts を書く。各 agent の prompt に何をするか、*何をしないか* を書く。
- task ごとの acceptance tests。agent が始める前に「done looks like X」を定義する。
- pre-flight spec check: dispatch 前に separate agent が task definition を review する。

**Coordination Failures（36.94%）。** communication または state breakdowns。

Examples:
- 2 agents が synchronization なしに shared state を update する。
- agents 間の message lost（queue failure、timeout）。
- State drift: agent A は task が終わったと思っているが、agent B はまだ実行中。

Mitigations:
- optimistic concurrency を持つ versioned shared state。
- critical messages への explicit acknowledgment（acked されるまで retry）。
- periodic state-sync checkpoints。drift を早期に detect する。

**Verification Gaps（21.30%）。** outputs に independent check がない。

Examples:
- 1 agent が success を主張し、誰も verify しない。
- agent chain が prior output を次々に信頼する。
- emergent composed behavior に対する test coverage がない。

Mitigations:
- independent verifier agent（Lesson 13）。read-only、independent source access。
- explicit handoff contract: 「A の output は B が始める前に checker C を pass しなければならない」。
- post-hoc analysis のための outcome logging。

### Groupthink family（arXiv:2508.05687）

agents が homogenize または互いを mimic するときの 5 つの related failures:

**Monoculture collapse。** same base model または training data → correlated errors。3 agents が同じ LLM を共有していれば hallucinations も共有する。

**Conformity bias。** agents が、誤っていても最も loud または confident な peer に寄っていく。

**Deficient ToM。** agents が互いの beliefs を model できず、coordination が崩れる（Lesson 18）。

**Mixed-motive dynamics。** partially-aligned incentives を持つ agents が compromise-middle に drift し、誰も満足しない。

**Cascading reliability failures。** ある component の error pattern が dependent components の error patterns を誘発する。

### Cascading example — retry storm

2026 年の classic incident pattern:

```
payment service fails 10% of requests
   ↓
order agent retries payment (exponential backoff but naive)
   ↓
each retry is a new order-inventory check
   ↓
inventory service sees 2x normal load
   ↓
inventory service starts timing out
   ↓
every order retries inventory check
   ↓
inventory service sees 10x normal load
   ↓
cluster goes down
```

fix は classical である: **circuit breakers**。downstream error rate が threshold を超えたら、cached または default results で short-circuit する。さらに request ごとに retry budgets を cap する。

Circuit breakers は、multi-agent failure mitigations の中でも distributed systems から無修正で借りられる数少ない patterns の 1 つである。

### Memory poisoning（再訪）

Lesson 13 より: 1 agent の hallucination が shared-memory fact になり、downstream agents が poisoned fact に基づいて reasoning する。MAST terms では、これは shared-memory layer における verification gap である。

symptom は gradual accuracy decay。crash ではなく、root-cause が見つけにくい slow drift が起きる。

Mitigation: append-only log、provenance、unwritable verifier。Lesson 13 で扱った通り。

### STRATUS — failure detection のための specialized agents

STRATUS（NeurIPS 2025）は、次を deploy すると mitigation-success が 1.5x 改善すると報告する:

- **Detection agent。** symptom patterns（high disagreement、retry spikes、accuracy drift）を監視する。
- **Diagnosis agent。** symptoms から MAST taxonomy に基づく likely root cause を推論する。
- **Validation agent。** mitigation 適用後、symptoms が消えたか確認する。

これは agent systems に適用された SRE-style incident response である。3 roles は specialized prompts を持つ LLM agents で実装できる。

### failure-mode audit

2026 年の best practice は annual（または major release ごと）の failure-mode audit である:

1. **Trace sample。** 約 1000 real execution traces を集める。
2. **Categorize。** 各 trace の failures を MAST + Groupthink categories に map する。
3. **Compute failure-by-category rate。** system ではどの categories が dominant か。
4. **Rank mitigations。** どの fix が最も多くの failures を eliminate するか。
5. **Pick 2-3 mitigations。** 実装し、next quarter に re-audit する。

specific choices より discipline が重要である。audits なしでは failures は noise に混ざり、systematically に address されない。

### systems が silently に失敗するとき

最も危険な failure category は silent correctness failure である。loud に失敗する system（crash、exception、alert）は monitor できる。plausible-but-wrong outputs を出す system は exception logs では検出できない。これが、verification gaps が count では 21.30% にすぎなくても、per-failure cost では最も高い category である理由だ。

投資すべきもの:
- sample-based human review。
- golden-dataset regression tests。
- important outputs に対する cross-agent cross-checking。

### failure vs slow failure

failures には immediate なものと slow なものがある。Immediate failures（timeout、schema mismatch、auth error）は detection が安い。Slow failures（memory poisoning、monoculture drift、role ambiguity）は detection と prevention が高い。

2026 年の engineering move は、slow-failure proxies を instrument し、visible error になる前に drift を捕まえること。Agreement rate、retry rate、output-length distribution、consecutive agent versions 間の edit-distance はどれも有用な proxies である。

## 実装

`code/main.py` は次を実装する:

- `FailureTaxonomy` — simulated incidents を MAST + Groupthink categories に分類する。
- `CircuitBreaker` — classic pattern。error rate が threshold を超えると open する。
- `RetryStormSimulator` — cascading failure を示し、circuit breaker on / off を切り替える。
- `DetectionAgent` — scripted STRATUS-style symptom matcher。

Run:

```
python3 code/main.py
```

期待される出力:
- circuit breaker なしの retry storm: inventory errors が blow up する（simulated）。
- circuit breaker あり: threshold で cap し、degraded-mode responses を返す。
- detection agent が pattern を flag し、MAST category を名指しする。

## Use It

`outputs/skill-mast-auditor.md` は multi-agent system に対して MAST-style failure-mode audit を実行する。Traces → categorization → mitigation ranking。

## Ship It

production における failure-mode discipline:

- **MAST audit per quarter。** annual ではない。system が成長すると categories は変わる。
- **Circuit breakers everywhere。** dependent service への各 outbound call。default open threshold は 5-10% error rate。
- **Golden datasets。** small、high-quality、hand-audited。weekly に regression-test する。
- **STRATUS trio。** Detection + Diagnosis + Validation agents で production を monitor する。detection agent だけから始め、symptoms が noisy なら diagnosis を追加する。
- **Failure budget。** category ごとの failure rate に明示的な SLO を置く。budget 超過は stop-shipping conversation を trigger する。

## Exercises

1. `code/main.py` を実行する。circuit breaker が retry storm を cap することを確認する。failure threshold を変えて tradeoff を観察する。
2. **slow-failure proxy** を実装する: 3 parallel agents の agreement rate。急落したら alert を trigger する。agent outputs を徐々に correlate させて monoculture drift を simulate する。
3. Cemri et al.（arXiv:2503.13657）を読む。7 MAS systems のうち 1 つを選び、top 3 failure categories を map する。MAST の予測と比べてどうか。
4. Groupthink paper（arXiv:2508.05687）を読む。5 patterns のうち production で最も detect が難しいものはどれか。proxy metric を提案する。
5. 自分が知っている specific multi-agent system 向けに STRATUS-style detection-diagnosis-validation trio を設計する。detection はどの symptoms を監視するか。diagnosis はどの mitigations を推奨するか。validation はそれが機能したことをどう確認するか。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MAST | 「2026 taxonomy」 | Cemri 2025。3 root categories + 14 sub-types of failures。 |
| Specification Problem | 「role ambiguity」 | task または role が under-defined で、agents が何をすべきか分からない。 |
| Coordination Failure | 「state drift」 | agents 間の communication または sync breakdown。 |
| Verification Gap | 「誰も check していない」 | independent validation なしに outputs が accepted される。 |
| Groupthink family | 「homogeneity failures」 | monoculture、conformity、deficient ToM、mixed-motive、cascading。 |
| Monoculture collapse | 「same model, same hallucinations」 | shared base model または training data による correlated errors。 |
| Retry storm | 「cascading error amplification」 | 1 つの failure が retries を誘発し downstream load を増幅する。 |
| Circuit breaker | 「error rate で fail fast」 | error rate が threshold を超えると open し、default で short-circuit する。 |
| STRATUS | 「incident response trio」 | Detection + diagnosis + validation agents。mitigation success 1.5x。 |
| Memory poisoning | 「hallucinations propagate」 | shared-memory fact が汚染され、downstream agents が poison に基づいて reasoning する。 |

## 参考文献

- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) — MAST taxonomy, NeurIPS 2025
- [Groupthink failures in multi-agent LLMs](https://arxiv.org/abs/2508.05687) — monoculture、conformity、five-family taxonomy
- [STRATUS — specialized agents for MAS incident response](https://neurips.cc/) — NeurIPS 2025 proceedings entry（detection + diagnosis + validation）
- [Release It! — stability patterns (Nygard)](https://pragprog.com/titles/mnee2/release-it-second-edition/) — canonical circuit-breaker reference
- [Anthropic — Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — production failure-mode notes
