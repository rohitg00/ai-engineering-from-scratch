# Skill Libraries and Lifelong Learning (Voyager)

> Voyager (Wang et al., TMLR 2024) は executable code を skill として扱います。Skills は named、retrievable、composable で、environment feedback によって refine されます。これは Claude Agent SDK skills、skillkit、2026 年の skill-library pattern の reference architecture です。

**種別:** 構築
**言語:** Python (stdlib)
**前提条件:** Phase 14 · 07 (MemGPT), Phase 14 · 08 (Letta Blocks)
**所要時間:** 約75分

## Learning Objectives

- Voyager の 3 components — automatic curriculum、skill library、iterative prompting — とそれぞれの role を説明する。
- Voyager が action space を primitive commands ではなく code にする理由を説明する。
- Registration、retrieval、composition、failure-driven refinement を持つ stdlib skill library を実装する。
- Voyager pattern を 2026 年の Claude Agent SDK skills と skillkit ecosystem へ mapping する。

## 問題

毎 session であらゆる capability をゼロから組み立て直す agent は、3 つのことを間違えます。

1. **Waste tokens.** すべての task が同じ reasoning を再度引き出します。
2. **Lose progress.** Session A で学んだ correction が session B へ transfer されません。
3. **Fail on long-horizon composition.** 複雑な task には capability hierarchies が必要です。One-shot prompts では表現できません。

Voyager の答えは、reusable capability を library に保存された named chunk of code として扱うことです。Similarity で retrieve でき、他の skills と compose でき、execution feedback で refine できます。

## The Concept

### Three components

Voyager (arXiv:2305.16291) は agent を次の 3 つで構成します。

1. **Automatic curriculum.** Curiosity-driven proposer が、agent の current skill set と environment state に基づいて次の task を選びます。Exploration は bottom-up です。
2. **Skill library.** 各 skill は executable code です。Task が成功すると new skills が追加されます。Skills は query-to-description similarity で retrieve されます。
3. **Iterative prompting mechanism.** Failure 時、agent は execution errors、environment feedback、self-verification output を受け取り、skill を refine します。

Minecraft evaluation (Wang et al., 2024): baseline に対して unique items は 3.3x、stone tools は 8.5x faster、iron tools は 6.4x faster、map traversal は 2.3x longer。数字は Minecraft-specific ですが、pattern は transfer します。

### Action space = code

多くの agent は primitive commands を emit します。Voyager は JavaScript functions を emit します。Skill は次のようなものです。

```
async function craftIronPickaxe(bot) {
  await mineIron(bot, 3);
  await mineStick(bot, 2);
  await placeCraftingTable(bot);
  await craft(bot, 'iron_pickaxe');
}
```

Sub-skills から compose されます。Description と embedding で key されて保存されます。Prompt ではなく program として retrieve されます。

これは 2026 年の Claude Agent SDK skill です。Agent が on demand で load する、named, retrievable な code + instructions です。

### Skill retrieval

New task「diamond pickaxe を作る」。Agent は次を行います。

1. Task description を embed する。
2. Skill library に top-k similar skills を query する。
3. `craftIronPickaxe`, `mineDiamond`, `placeCraftingTable` などを retrieve する。
4. Retrieved primitives + new logic から new skill を compose する。

これは MCP resources (Phase 13) と Agent SDK skills が実装する pattern です。Current task に scoped された knowledge/code surface に対する retrieval です。

### Iterative refinement

Voyager の feedback loop:

1. Agent が skill を書く。
2. Skill が environment に対して実行される。
3. 3 つの signal のいずれかが返る: `success`, `error` (stack trace 付き), `self-verification failure`。
4. Agent は signal を context として skill を rewrite する。
5. Success または max rounds まで loop する。

これは code generation に environment-grounded verification を組み合わせた Self-Refine (Lesson 05) です。CRITIC (Lesson 05) は verifier として external tools を使う同じ pattern です。

### Curriculum and exploration

Voyager の curriculum module は、agent が何を持っていて何をまだしていないかに基づき、「lake の近くに shelter を建てる」のような task を propose します。Proposer は environment state + skill inventory を使い、現在の capability より少し上の task、つまり exploration sweet spot を選びます。

Production agents では、これは「what's missing」operator に翻訳されます。Current skill library と domain が与えられたとき、まだ covered していない skills は何か。Team は通常、curriculum review として手動実装します。

### Where this pattern goes wrong

- **Skill library rot.** 同じ skill が少し違う descriptions で 10 回追加されます。Write 時に deduplication を追加し、retrieval は 1 つだけ返すようにします。
- **Composed-skill drift.** Parent skill が refine された child に依存します。Skills を version 化します。v1 に pin された parent は勝手に v3 を拾ってはいけません。
- **Retrieval quality.** Skill descriptions への vector retrieval は library が数百を超えると劣化します。Tag filters と hard constraints (「`category=tooling` の skills だけ」) を supplement します。

## 実装

`code/main.py` は stdlib skill library を実装します。

- `Skill` — name, description, code (as string), version, tags, dependencies。
- `SkillLibrary` — register、search (token overlap)、compose (deps の topological sort)、refine (update で version bump)。
- 3 つの primitive skills を登録し、4 つ目を compose し、failure に当たり、refine する scripted agent。

実行:

```
python3 code/main.py
```

Trace は library writes、retrieval、composition、failed execution、v2 refinement を示します。Voyager loop を end to end で確認できます。

## Use It

- **Claude Agent SDK skills** (Anthropic) — 2026 年の reference。各 skill は description、code、instructions を持ち、agent session 中に on demand で load されます。
- **skillkit** (npm: skillkit) — 32+ AI coding agents 向けの cross-agent skill management。
- **Custom skill libraries** — domain-specific (data agents の SQL skills、infra agents の Terraform skills)。Voyager pattern は小さくも使えます。
- **OpenAI Agents SDK `tools`** — low end では、各 tool は lightweight skill です。

## Ship It

`outputs/skill-skill-library.md` は、任意の target runtime 向けに registration、retrieval、versioning、refinement を配線した Voyager-shaped skill library を生成します。

## Exercises

1. `compose()` に dependency-cycle detector を追加する。Skill A が B に依存し、B が A に依存すると何が起きるか。Error か warning か。
2. Per-skill version pinning を実装する。Parent skill が child `crafting@1` を compose する場合、`crafting@2` への refinement が parent を silent upgrade してはならない。
3. Token-overlap retrieval を sentence-transformers embeddings (または BM25 stdlib impl) に置き換える。50-skill toy library で retrieval@5 を測定する。
4. "curriculum" agent を追加する。Current library と domain description が与えられたら、missing skills を 5 つ propose する。Weekly に呼ぶ。
5. Anthropic の Claude Agent SDK skill docs を読む。Toy library を SDK の skill schema へ port する。Discoverability はどう変わるか。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Skill | 「Reusable capability」 | Similarity で retrieve できる named code chunk + description |
| Skill library | 「Agent memory of how-to」 | Skills の persistent store。Searchable かつ composable |
| Curriculum | 「Task proposer」 | Current capability gap に駆動される bottom-up goal generator |
| Composition | 「Skill DAG」 | Skills が skills を呼ぶ構造。Execution 時は topologically sort する |
| Iterative refinement | 「Self-correcting loop」 | Env feedback + errors + self-verification を次 version に折り込む |
| Action-space-as-code | 「Programmatic actions」 | Temporally extended behavior のため primitive commands ではなく functions を emit する |
| Dedup on write | 「Skill collapse」 | Near-duplicate descriptions を 1 つの canonical skill に collapse する |

## 参考文献

- [Wang et al., Voyager (arXiv:2305.16291)](https://arxiv.org/abs/2305.16291) — original skill-library paper
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) — 2026 productization としての skills
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) — 実践での skills と subagents
- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) — Voyager の下にある refinement loop
