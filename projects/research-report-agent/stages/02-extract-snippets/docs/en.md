# Extract snippets you can cite

> A citation that points at a whole document proves nothing. Point at the exact sentence.

**Type:** Build
**Languages:** Python
**Stage:** 2 of 7 (starter)
**Time:** ~2 hours

## What you build

`report_agent/snippets.py`:

- `split_sentences(text)` returns `(start, end)` spans for each sentence.
- `score_sentence(sentence, query_tokens, idf)` scores one sentence against a query.
- `extract_snippets(query, index, ...)` returns the best `Snippet` objects across the top documents.

A `Snippet` holds `id`, `doc_id`, `start`, `end`, `text` and `score`, and always satisfies:

```python
document.text[snippet.start:snippet.end] == snippet.text
```

## Why it matters

A citation has two separate properties: its marker resolves to a source, and that source supports the claim. A valid link can still point to a sentence that says something else. Exact evidence spans make this distinction testable.

You cannot check a claim against a whole web page cheaply, and a reader will not either. Offsets make every citation checkable in one lookup: open the document, slice `[start:end]`, read the sentence. The critic in stage 5 and the footnotes in stage 6 both depend on this.

## Sentence spans

Split at `.`, `!` or `?` when the next character after whitespace starts a new sentence, or at the end of the text. Two details matter in this corpus:

```text
The socket is at /var/run/container.sock. Any process can write.
                            ^ not a boundary      ^ boundary
It is slower. user-space kernel is still useful.
             ^ boundary, even though user-space kernel starts lowercase
```

Keep spans free of surrounding whitespace so `text[start:end]` is clean.

## Scoring sentences

Reuse the IDF table from stage 1:

```python
score = sum(idf[t] for t in set(query_tokens) if t in tokenize(sentence))
```

Then apply two rules that make snippets readable on their own:

| Rule | Why |
|---|---|
| Sentences under `min_words` (6) words score 0 | "The tradeoff is overhead." says nothing out of context |
| Halve the score if the sentence starts with It, This, These, They and similar | "It uses a limited set of calls" does not say what "it" is |

Real systems solve the second problem with decontextualization: rewriting a sentence so it stands alone. The penalty is the cheap version.

```figure
pj-rra-snippet-offsets
```

## Follow the mechanism

Offsets are positions in the stripped document body, not the full markdown file. Never call `.strip()` on a chosen sentence without adjusting its start and end. If the source changes, an old offset may still resolve to text but no longer resolve to the same claim; stage 6 checks that equality again.

## Your task

```python
def split_sentences(text: str) -> list[tuple[int, int]]: ...
def score_sentence(sentence, query_tokens, idf, min_words=6) -> float: ...
def extract_snippets(query, index, k_docs=4, per_doc=3, start_id=1,
                     min_score=0.0, doc_ids=None) -> list[Snippet]: ...
```

`extract_snippets` searches the top `k_docs` documents (or only `doc_ids` when given), keeps up to `per_doc` sentences per document, sorts all candidates by score, and numbers them `S{start_id}`, `S{start_id + 1}` and so on.

## Run the tests

```bash
python3 scripts/project_test.py research-report-agent --stage 2 --path my-report-agent
```

Stages run cumulatively, so stage 1 must still pass.

## What you should see

Stage 2 passes 11 Python tests, and all preceding stages still pass. Every returned snippet reproduces its source slice exactly, including text after a dotted socket path. The tests also cover lowercase sentence starts, sequential ids and per-document limits.

## Check yourself

1. Why store offsets instead of just the sentence text?
2. Which sentence in `04-user-space-kernel.md` loses half its score, and would a reader miss anything if it were dropped?
3. What breaks if your splitter treats `container.sock.` as two sentences?

## Going further

- Return a window of the neighbouring sentence as context, while still citing the exact span.
- Replace the pronoun penalty with a small model that rewrites the sentence to stand alone, and store both versions.

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Retrieval augmented generation](../../../../../phases/11-llm-engineering/06-rag/docs/en.md). Complete [stage 1](../../01-search-the-corpus/docs/en.md) first.

The Orchard policy sentence is evidence only if its stored span reproduces the exact document text. Offsets belong to the normalized document body, not to the file header or rendered HTML.

```text
source: "Old rule. New rule."
second span=[10,19)
source[10:19]="New rule."
```

## Build and inspect

Find boundaries on the original string and trim by moving offsets. Never rewrite a snippet after computing its span.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py research-report-agent --stage 2 --path learning-artifacts/research-report-agent
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

What happens to an old snippet when the source text is edited before its start offset?
