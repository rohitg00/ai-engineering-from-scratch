---
id: rag-production
title: Production RAG Chatbots and Freshness
code: PC
subtitle: Filter, fuse, cache, guard and cite. Keep the index fresh and grade every ranking change.
hue: 160
sources: phases/19-capstone-projects/02-rag-over-codebase, phases/19-capstone-projects/08-production-rag-chatbot, projects/doc-qa-with-citations, projects/rag-freshness-pipeline, projects/semantic-notes-search, projects/retrieval-evaluation-lab
source_hash: ce31382d60cbd54a
---

## One regulated chat turn
type: architecture
from: phases/19-capstone-projects/08-production-rag-chatbot/code/main.py, phases/19-capstone-projects/08-production-rag-chatbot/docs/en.md

```arch
node | q | 1,1 | Query | role + jurisdiction | client
node | guard | 2,1 | Input guard | BLOCKED_PATTERNS | process
node | filter | 3,1 | Access filter | role or public, tag or any | process
node | fuse | 4,1 | Hybrid retrieve | dense + BM25, RRF 60 | store
node | layout | 4,2 | PromptLayout | system, policy, context | process
node | cache | 3,2 | PromptCache | cache_key hit or miss | store
node | synth | 2,2 | Synthesize | cite or say unsure | model
node | scrub | 1,2 | PII scrub | email and ssn redacted | process
edge | q | guard |
edge | guard | filter | ok
edge | filter | fuse | eligible
edge | fuse | layout | top 3
edge | layout | cache | sha256 prefix
edge | cache | synth |
edge | synth | scrub | answer
```

## Run, grade and inspect
type: command-table
span: 2
from: projects/doc-qa-with-citations/README.md, projects/rag-freshness-pipeline/README.md, projects/semantic-notes-search/README.md, projects/retrieval-evaluation-lab/README.md, phases/19-capstone-projects/02-rag-over-codebase/code/main.py, phases/19-capstone-projects/02-rag-over-codebase/code/ts/README.md

| Command | What it does |
|---|---|
| `python3 scripts/project_test.py <project> --init learning-artifacts/<project>` | Makes your workspace. A fresh starter fails |
| `python3 scripts/project_test.py <project> --stage 1 --path learning-artifacts/<project>` | Grades one stage of your code |
| `python3 scripts/project_test.py <project> --all --solution --strict` | Checks the reference solution |
| `python3 cli.py samples/docs "When does cache expire?" --output answer.json --html answer.html` | Writes a citation receipt as JSON and HTML |
| `cli.py query orchard-index.json tokens --now 210 --max-age 60` | Queries the freshness snapshot |
| `cli.py <notes> "release replicas" --aliases <aliases.json> --out matches.json` | Searches a markdown folder |
| `cli.py <baseline> <candidate> <judgments> --out retrieval-diff.json` | Diffs two ranking runs per query |
| `python main.py` | Runs a capstone scaffold offline |

## Cache-aware chat turn
type: annotated-code
lang: python
from: phases/19-capstone-projects/08-production-rag-chatbot/code/main.py

```python
ok, reason = llama_guard_input(query)          # regex block list first
hits = retrieve(query, role, jurisdiction, corpus, k=3)
context = [f"[{c.anchor()}] {c.text}" for c, _ in hits]
layout = PromptLayout(system=SYSTEM_PROMPT,   # very stable
    policy=f"role={role} jurisdiction={jurisdiction}",
    context=context, question=query)          # question is not cached
cache_hit = cache.check(layout.cache_key())   # sha256 of prefix, 16 hex
answer = presidio_scrub(answer)               # redacts [email] and [ssn]
cache.hit_rate()                              # hits / (hits + misses)
```

## Codebase hybrid retrieval
type: annotated-code
lang: python
from: phases/19-capstone-projects/02-rag-over-codebase/code/main.py

```python
tokens = (tokenize(chunk.symbol) * 4 +        # symbol weight 4
          tokenize(chunk.summary) * 2 +       # summary weight 2
          tokenize(chunk.body))               # body weight 1
dense_hits = dense.search(query, k=10)
sparse_hits = bm25.search(query, k=10)
fused = rrf(dense_hits, sparse_hits)          # k_rrf: int = 60
top = rerank(query, fused, top_k=5)           # 0.3 symbol, 0.1 summary
citations = [c.anchor() for c, _ in top]      # repo/path:start-end
```

## Project functions
type: task-table
from: projects/doc-qa-with-citations/API.md, projects/doc-qa-with-citations/solution, projects/rag-freshness-pipeline/solution, projects/semantic-notes-search/solution/main.py, projects/retrieval-evaluation-lab/solution/main.py

| Task | Code |
|---|---|
| Load text files with SHA-256 | `load_documents(root)` |
| Chunk with offsets | `chunk_document(doc, size=200, overlap=30)` |
| Gate a model quote | `answer(question, chunks, model)` |
| Plan index changes | `diff(previous, incoming)` |
| Commit a snapshot | `commit(path, documents, expected_version)` |
| Drop expired evidence | `retrieve(documents, query, now, max_age=3600, k=3)` |
| Build a TF-IDF index | `build_index(documents, aliases=None)` |
| Score two systems | `compare_systems(systems, judgments, k)` |

## Freshness ingest and query
type: flow
from: projects/rag-freshness-pipeline/solution, projects/rag-freshness-pipeline/README.md

1. **normalize**: NFC text, CRLF to LF, strip, then SHA-256 of the body.
2. **diff**: an id that is new goes to `insert`.
3. **diff**: a changed hash goes to `update`. Only a new `updated` time goes to `refresh`.
4. **diff**: an id that is not in the full corpus goes to `delete`.
5. **commit**: flock, compare `expected_version`, write a temp file, fsync, `os.replace`.
6. **retrieve**: skip a doc when age is below 0 or above `max_age`.
7. **retrieve**: score is matched terms over query terms. Sort by score, age, id.

## Project inputs, outputs and checks
type: comparison
from: projects/doc-qa-with-citations/README.md, projects/doc-qa-with-citations/solution/cli.py, projects/rag-freshness-pipeline/README.md, projects/rag-freshness-pipeline/solution/cli.py, projects/semantic-notes-search/README.md, projects/semantic-notes-search/solution/cli.py, projects/retrieval-evaluation-lab/README.md, projects/retrieval-evaluation-lab/solution/cli.py

| Factor | Doc QA | Freshness | Notes search | Eval lab |
|---|---|---|---|---|
| Builds | Citation receipt | Fresh index | Lexical TF-IDF search | Regression diff |
| Input | Folder of .txt | Full corpus JSON | Folder of .md | 3 JSON files |
| Output | answer.json, answer.html | Snapshot, changes | matches.json | retrieval-diff.json |
| Key fields | start, end, sha256 | version, age, hash | score, matched | delta_ndcg |
| States | answered, abstained | insert to delete | top k matches | regressions count |
| Guard | needs_review | stale version error | k must be positive | `--fail-on-regression` |

## Defaults and numbers
type: defaults
from: projects/doc-qa-with-citations/API.md, projects/rag-freshness-pipeline/solution/cli.py, projects/semantic-notes-search/solution/cli.py, projects/retrieval-evaluation-lab/solution/main.py, phases/19-capstone-projects/08-production-rag-chatbot/docs/en.md, phases/19-capstone-projects/02-rag-over-codebase/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Doc QA chunk `size` | 200 | `overlap` is 30 |
| `--max-age` | 3600 | Older evidence is skipped |
| `--k` | 3 | Freshness, notes and eval CLIs |
| Note size limit | 100 KB | Larger notes raise an error |
| Relevance grades | 0..3 | Integers only |
| Rerank pool | top-20 | Top-5 go to synth |
| Cache hit target | 60-80% | Stable prefixes first |
| Drift alert | 5% | Weekly retrieval quality drop |

## Troubleshooting
type: troubleshooting
from: projects/doc-qa-with-citations/solution, projects/doc-qa-with-citations/README.md, projects/rag-freshness-pipeline/solution, projects/rag-freshness-pipeline/README.md, projects/semantic-notes-search/solution/cli.py, phases/19-capstone-projects/08-production-rag-chatbot/docs/en.md, phases/19-capstone-projects/02-rag-over-codebase/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| "unsupported model answer" | Quote is not in the cited chunk | Return an exact span and its chunk id |
| `state` is needs_review | Quote has no query term | Judge relevance by hand |
| `state` is abstained | Retrieval found no chunks | Expected for an off-topic query |
| "stale index version" | Another writer committed first | Read the snapshot, pass its version |
| "duplicate document id" | Two incoming docs share an id | Make ids unique |
| Edited policy still cited | Index lags the source | Ingest the full corpus again |
| "symlink notes are not supported" | Note is a link | Use a regular file in the folder |
| Generated code poisons hits | Boilerplate in the corpus | Flag it "generated" and down-weight |

## Ranking metrics in code
type: concepts
from: projects/retrieval-evaluation-lab/solution/main.py, projects/semantic-notes-search/solution/main.py, projects/doc-qa-with-citations/solution/retrieval.py

- **Precision@k**: relevant hits in the top k, divided by k.
- **Recall@k**: relevant hits divided by all docs with a grade above 0.
- **RR**: 1 over the rank of the first relevant doc, else 0.
- **nDCG**: DCG with gain `2 ** grade - 1` over the ideal DCG.
- **Unjudged**: docs in the top k with no label. They get zero gain.
- **Notes IDF**: `math.log((1 + len(terms)) / (1 + count)) + 1`.
- **Doc QA score**: sum of `(1 + math.log(bag[t]))` times an IDF term.

## Questions
type: qa
from: phases/19-capstone-projects/08-production-rag-chatbot/docs/en.md, phases/19-capstone-projects/02-rag-over-codebase/docs/en.md, projects/doc-qa-with-citations/README.md, projects/rag-freshness-pipeline/README.md

- **Why filter by role first?** The access policy must hold before any score.
- **Why put the question last?** The system prompt and context form the cached prefix.
- **What does a re-index touch?** Only chunks whose text changed. Edges change when imports change.
- **Does a valid citation prove an answer?** No. It can still be irrelevant or outdated.
- **Is a refresh a rewrite?** No. Same content with a later time only updates the time.

## Tips
type: tips
from: phases/19-capstone-projects/08-production-rag-chatbot/docs/en.md, phases/19-capstone-projects/02-rag-over-codebase/docs/en.md

- Label 100 cross-repo questions with gold file:line answers.
- Keep a 200 Q/A golden set and 50 adversarial prompts.
- Reject any claim without a `(repo/path:start-end)` anchor.
- Re-index a 50-file push in under 60 seconds.
