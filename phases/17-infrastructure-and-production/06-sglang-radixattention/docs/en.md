# Prefix-Heavy Workloads 向け SGLang と RadixAttention

> SGLang は KV cache を radix tree に保存される first-class で再利用可能な resource として扱います。vLLM が FCFS (first-come, first-served) で request を schedule するのに対し、SGLang の cache-aware scheduler は shared prefix が長い request を優先します。実質的には depth-first radix traversal で、hot branch を HBM に resident に保ちます。ShareGPT-like 1K prompts の Llama 3.1 8B では、SGLang は約 16,200 tok/s、vLLM は約 12,500 tok/s で約 29% 優位です。prefix-heavy RAG workload では 6.4x に達します。voice-cloning 形の workload では cache hit rate が 86% を超えました。2026 年には xAI、LinkedIn、Cursor、Oracle、GCP、Azure、AWS にまたがり 400,000+ GPUs で deploy されています。gotcha は、prefix ordering が一貫しないと 6.4x の数字が消えることです。ordering が engineer の lever です。

**種別:** 学習
**言語:** Python (stdlib, toy radix-tree cache + cache-aware scheduler)
**前提条件:** Phase 17 · 04 (vLLM Serving Internals), Phase 14 (Agentic RAG)
**所要時間:** 約75分

## Learning Objectives

- RadixAttention を diagram する: prefix が radix tree にどう保存され、同じ branch に root を持つ sequences が KV blocks をどう共有するか。
- cache-aware scheduling と、prefix-heavy traffic で FCFS がなぜ間違いかを説明する。
- prefix-cache hit rate と prompt length distribution から expected speedup を計算する。
- 6.4x を現実にする prompt-ordering discipline と、失われる upside の違いを naming する。

## 問題

classic serving は各 request の prompt を opaque に扱います。5,000 件の RAG requests がすべて同じ 2,000-token system prompt と同じ retrieval preamble で始まっていても、vLLM はその 2,000-token prefix を 5,000 回 prefill します。GPU は同じ作業を何度も繰り返します。

観察: agentic workload と RAG workload の prompt はほぼ常に long prefix を共有します。system prompt、tool schemas、few-shot examples、retrieval headers、conversation history は request 間で反復されます。その prefix の KV cache を 1 回保存して reuse できれば、再度 prefill する必要はありません。

RadixAttention はこれを実行します。tokens は radix tree に index されます。各 node は root から自分までの token sequence に対応する KV blocks を所有します。new request は tree を walk し、token が match する node の KV blocks を reuse します。prefill cost は full prompt ではなく「new」suffix に比例します。

challenge は scheduling です。2 requests が 2,000-token prefix を共有し、3 番目が同じ prefix の 200 tokens だけを共有する場合、2 つの long-shared requests を一緒に serve して、long prefix を HBM に残すべきです。FCFS は逆をします。先に到着したものを serve するため、次の long-prefix request が来る前に hot branch を evict する可能性があります。

## The Concept

### KV index としての radix tree

radix tree (compact trie) は token sequence を保存します。各 node は token range と、その range のために計算済みの KV blocks を所有します。children は sequence を 1 tokens 以上伸ばします。

```
root
 |- "You are a helpful assistant..."  (2,000 tokens, 124 KV blocks)
      |- "Context: <doc A>..."        (500 tokens, 31 blocks)
           |- "Question: Alice..."    (80 tokens, 5 blocks)
           |- "Question: Bob..."      (95 tokens, 6 blocks)
      |- "Context: <doc B>..."        (520 tokens, 33 blocks)
```

new request が system prompt + "Context: <doc A>" + "Question: Carol" で来るとします。scheduler は system prefix を match し (124 blocks reused)、doc-A branch を match し (31 blocks reused)、"Question: Carol" だけに fresh blocks を allocate します (4 blocks)。prefill cost は new tokens 4 blocks です。tree がなければ 160 blocks。prefill は約 40x savings です。

### Cache-aware scheduling

radix-tree-backed reuse は cache が churn すると意味がありません。重要な policy は 2 つです。

1. **Depth-first dispatch**。queue から次の request を選ぶとき、current running set と同じ branch に root を持つ request を優先します。これで hot branch を pin できます。
2. **block level ではなく branch level LRU**。individual blocks ではなく whole branches (shortest-used leaves から) を evict し、cache shape を radix shape に合わせます。

FCFS は両方に反します。2,000 tokens を共有する request が、50 tokens だけ共有する request の後ろに並び、2,000-token branch は 50-token request を入れるために evict されます。

### 覚えるべき benchmark numbers

- Llama 3.1 8B、H100、ShareGPT 1K prompts: SGLang 約 16,200 tok/s vs vLLM 約 12,500 (約 29% edge)。
- Prefix-heavy RAG (same system + same doc, varying question): SGLang で最大 6.4x。
- Voice cloning workloads: 86.4% prefix-cache hit rate。
- SGLang customer の production hit rate: prompt discipline により 50-99%。
- 2026 年に 400,000+ GPUs で deploy。

### ordering gotcha

6.4x は consistent prompt-template ordering に依存します。client がある request では `[system, tools, context, history, question]`、別の request では `[system, context, tools, history, question]` を作ると、tree は shared prefix を見つけられません。human には shared prefix に見えても、radix tree には 2 つの distinct sequences です。

engineer の lever: prompt template は cache key です。order を固定してください。immutable なもの (system, tools, schemas) を先に置きます。retrieval context を次に置きます。user question は最後です。dynamic content を prefix に interleave してはいけません。

research の real case では、dynamic content を cacheable prefix から外しただけで、ある deployment の cache hit rate は 7% から 74% へ上がりました。

### RadixAttention が勝つ場所と負ける場所

勝つ:
- RAG (same retrieval preamble, varying question)。
- Agents (same tool schemas, varying query)。
- long system prompt を持つ chat。
- repeated preambles を持つ voice / vision workloads。

負ける (vLLM-level throughput に戻る):
- unique prompts の single-shot generation (code completion、system prompt なしの open-ended chat)。
- dynamic prompts で、毎 request が unique content を prefix に interleave する場合。

### kernel だけでなく scheduler 問題である理由

KV reuse は kernel trick として実装できます。SGLang の insight は、scheduler が hot branch を resident に保つときにだけ reuse が効くという点です。naive な "reuse if available" policy は mixed load で cache を churn させます。radix-tree-indexed scheduler が、kernel trick を 29% production edge に変えます。

### vLLM との関係

2 つの system は strict competitor ではありません。2026 年に vLLM は prefix caching (`--enable-prefix-caching`) と cache-aware router (Rust の vLLM Router) を追加しました。gap は縮まりましたが完全には消えていません。SGLang は stack 全体が radix-first で、vLLM は後付けです。prefix reuse が支配する workload では SGLang が default です。強い prefix pattern がない general-purpose serving では vLLM が同等または better です。

## Use It

`code/main.py` は toy radix-tree KV cache と 2 つの policy (FCFS と cache-aware) を持つ scheduler を実装します。同じ workload を両方で走らせ、prefix-cache hit rate と throughput delta を報告します。その後 "scrambled ordering" workload を走らせ、6.4x が collapse する様子を示します。

## Ship It

この lesson は `outputs/skill-radix-scheduler-advisor.md` を生成します。workload description (prompt-template shape、retrieval pattern、concurrent tenants 数) が与えられると、prompt-ordering prescription と SGLang adoption の go/no-go を出します。

## Exercises

1. `code/main.py` を実行してください。同じ workload で FCFS と cache-aware を比較してください。delta は prefill savings、decode savings、queue delay のどこから来ますか。
2. prompts が `[system, tools, context]` を random に permute するよう workload を変更してください。再実行すると hit rate はどうなりますか。なぜですか。
3. Llama 3.1 8B で 2,000-token system prompt を 1 つの radix branch として resident に保つ HBM cost を計算してください。prefix reuse なしの 16-sequence batch の cost と比べてください。
4. SGLang RadixAttention paper を読んでください。prefix-heavy load で tree-shaped LRU eviction が block-shaped LRU に勝つ理由を 3 文で説明してください。
5. customer が cache hit rate 8% だけを報告しています。likely causes を 3 つ挙げ、それぞれに対して実行する diagnostic を naming してください。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| RadixAttention | 「SGLang のあれ」 | KV cache を radix tree として index し、shared prefix が blocks を reuse する仕組み |
| Radix tree | 「compact trie」 | 各 node が token range と KV blocks を所有する tree |
| Cache-aware scheduler | 「hot-branch-first」 | resident branch を共有する request を優先する scheduler |
| Prefix-cache hit rate | 「prompt のどれだけが free だったか」 | reused KV blocks から serve された prompt tokens の割合 |
| FCFS | 「first-come first-served」 | prefix locality を壊す default scheduling |
| Branch-level LRU | 「leaf を evict」 | radix shape に合った eviction policy |
| Prompt template ordering | 「cache key」 | prompt component の順序が tree の共有可能性を決める |
| System prompt pinning | 「resident prefix」 | immutable system 部分を pin し eviction thrash を避ける |

## 参考文献

- [SGLang GitHub](https://github.com/sgl-project/sglang) — source and docs。
- [SGLang documentation](https://sgl-project.github.io/) — RadixAttention と scheduling details。
- [SGLang paper — Efficiently Programming Large Language Models (arXiv:2312.07104)](https://arxiv.org/abs/2312.07104) — design reference。
- [LMSYS blog — SGLang with RadixAttention](https://www.lmsys.org/blog/2024-01-17-sglang/) — benchmark numbers と scheduler rationale。
- [vLLM — Prefix Caching](https://docs.vllm.ai/en/latest/features/prefix_caching.html) — comparison 用の vLLM 実装。
