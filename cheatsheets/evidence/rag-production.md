# Evidence: cheatsheets/rag-production.md

Abbreviations: L02 = phases/19-capstone-projects/02-rag-over-codebase, L08 = phases/19-capstone-projects/08-production-rag-chatbot, DQ = projects/doc-qa-with-citations, RF = projects/rag-freshness-pipeline, SN = projects/semantic-notes-search, RE = projects/retrieval-evaluation-lab. c = code/main.py, d = docs/en.md, s = solution.

## One regulated chat turn (architecture, 8 nodes)
- Query with role and jurisdiction: L08/c:179-180, L08/d:39
- Input guard with BLOCKED_PATTERNS: L08/c:154-165, 181-183
- Access filter, role or public, jurisdiction or any: L08/c:82-85
- Hybrid retrieve, dense + BM25, RRF 60: L08/c:88-95
- top 3 into context: L08/c:185-186
- PromptLayout system, policy, context: L08/c:108-123, 188-193
- PromptCache, cache_key sha256 prefix: L08/c:125-127, 130-143, 194
- Synthesize, cite or unsure: L08/c:197-202, 103-104
- PII scrub of email and ssn: L08/c:168-172, 204

## Run, grade and inspect (command-table, 8)
- --init learning-artifacts, fresh starter fails: DQ/README.md:9, 12
- --stage 1 --path: SN/README.md:15, RF/README.md:15
- --all --solution --strict: DQ/README.md:31, RF/README.md:42
- cli.py samples/docs "When does cache expire?" --output answer.json --html answer.html: DQ/README.md:21, 33
- cli.py query orchard-index.json tokens --now 210 --max-age 60: RF/README.md:32
- notes cli with "release replicas" --aliases --out matches.json: SN/README.md:30
- baseline candidate judgments --out retrieval-diff.json: RE/README.md:30
- python main.py: L02/c:10

## Cache-aware chat turn (annotated-code, 9 lines)
- llama_guard_input: L08/c:181
- retrieve(..., k=3): L08/c:185
- context anchors: L08/c:186
- PromptLayout fields and policy string: L08/c:188-193, stability notes L08/c:114-118
- cache.check(layout.cache_key()), sha256 hexdigest()[:16]: L08/c:194, 127
- presidio_scrub [email] [ssn]: L08/c:170-171, 204
- hit_rate hits / total: L08/c:145-147

## Codebase hybrid retrieval (annotated-code, 8 lines)
- field weights symbol x4, summary x2, body x1: L02/c:114-117
- dense.search k=10, bm25.search k=10: L02/c:184-185
- rrf, k_rrf: int = 60: L02/c:149-150, 186
- rerank top_k=5, 0.3 symbol, 0.1 summary: L02/c:167-174, 187
- citations anchor repo/path:start-end: L02/c:35-36, 188

## Project functions (task-table, 8)
- load_documents(root), sha256: DQ/API.md:23, DQ/s/documents.py:12-29
- chunk_document(doc, size=200, overlap=30): DQ/API.md:24
- answer(question, chunks, model): DQ/API.md:17
- diff(previous, incoming): RF/s/changes.py:11
- commit(path, documents, expected_version): RF/s/snapshot.py:27
- retrieve(documents, query, now, max_age=3600, k=3): RF/s/retrieve.py:11
- build_index(documents, aliases=None): SN/s/main.py:20
- compare_systems(systems, judgments, k): RE/s/main.py:49

## Freshness ingest and query (flow, 7)
1. NFC, CRLF to LF, strip, sha256: RF/s/fingerprint.py:17, 24
2. new id to insert: RF/s/changes.py:28-31
3. changed hash update, new updated refresh: RF/s/changes.py:32-35, RF/README.md:5
4. missing id to delete: RF/s/changes.py:22, complete corpus RF/README.md:39
5. flock, version compare, mkstemp, fsync, os.replace: RF/s/snapshot.py:31-43
6. age < 0 or age > max_age skipped: RF/s/retrieve.py:17-19
7. score len(found)/len(terms), sort by score, age, id: RF/s/retrieve.py:25, 30

## Project inputs, outputs and checks (comparison, 6 rows)
- Builds: DQ/README.md:3, RF/README.md:3, SN/README.md:37, RE/README.md:3
- Input: DQ/s/documents.py:17 (.txt), RF/README.md:39, SN/s/cli.py:13 (.md), RE/s/cli.py:34
- Output: DQ/s/cli.py:76-77, RF/s/cli.py:14-19, SN/README.md:30, RE/README.md:30
- Key fields: DQ/s/answer.py:36-38 with DQ/s/cli.py:62, RF/s/retrieve.py:23-27 with RF/s/cli.py:17, SN/s/main.py:59-63, RE/s/cli.py:15
- States: DQ/s/answer.py:13, 41, RF/s/changes.py:19-23, SN/s/main.py:65, RE/s/cli.py:27
- Guard: DQ/s/cli.py:58-59, RF/s/snapshot.py:34, SN/s/main.py:41-42, RE/README.md:37

## Defaults and numbers (defaults, 8)
- size 200, overlap 30: DQ/API.md:24
- --max-age 3600: RF/s/cli.py:46
- --k 3: RF/s/cli.py:47, SN/s/cli.py:33, RE/s/cli.py:36
- 100 KB: SN/s/cli.py:16-17
- grades 0..3: RE/s/main.py:13-17
- top-20 to reranker, top-5 to synth: L08/d:81
- 60-80% cache hit rate: L08/d:83
- 5% drift alert: L08/d:91

## Troubleshooting (troubleshooting, 8)
- unsupported model answer: DQ/s/answer.py:28-30
- needs_review, no meaningful query term, human judgment: DQ/s/cli.py:56-59
- abstained with no chunks, zebras abstains: DQ/s/answer.py:12-13, DQ/README.md:38
- stale index version: RF/s/snapshot.py:33-34, RF/s/cli.py:13
- duplicate document id: RF/s/changes.py:15-16
- index lags source: L08/d:15, complete corpus RF/README.md:39
- symlink notes are not supported: SN/s/cli.py:14-15
- generated flag and down-weight: L02/d:121

## Ranking metrics in code (concepts, 7)
- precision hits / k: RE/s/main.py:24-25
- recall over grades above 0: RE/s/main.py:23, 25
- rr 1/(i+1) of first relevant, else 0.0: RE/s/main.py:30-33
- dcg gain 2 ** grade - 1 over ideal: RE/s/main.py:34-46
- unjudged count, zero gain: RE/s/main.py:58, RE/README.md:37
- notes idf formula: SN/s/main.py:28
- doc QA score (1 + math.log(bag[t])): DQ/s/retrieval.py:21-25

## Questions (qa, 5)
- access policy first: L08/c:82, L08/d:81
- stable prefix, uncached suffix: L08/d:23, 83
- re-embed only changed text, edges on import change: L02/d:23, 85
- valid citation can be irrelevant or outdated: DQ/README.md:46
- refresh not a rewrite: RF/README.md:5

## Tips (tips, 4)
- 100 cross-repo questions with gold file:line: L02/d:87
- 200 Q/A golden set, 50 adversarial prompts: L08/d:86, 89
- reject claims without (repo/path:start-end): L02/d:83
- 50-file push under 60 seconds: L02/d:85
