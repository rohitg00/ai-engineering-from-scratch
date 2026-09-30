# Extract text before comparing pages

> Scan HTML into normalized readable blocks and exclude known noise regions.

**Type:** Build  
**Language:** Go  
**Stage:** 1 of 4  
**Time:** About 2 hours

## What you are building

A raw HTML diff is dominated by timestamps, navigation and markup. Extract a sequence of readable text blocks first. This project scans tag boundaries while respecting quoted attributes, drops comments, and ignores head, script, style, nav, footer and noscript regions. Paragraphs, headings, list items and structural containers form block boundaries.

```figure
pj-web-change-brief-1
```

## Work through an example

For <nav>Visits 12</nav><p>Bring a mug &amp; a spoon.</p>, return one block: Bring a mug & a spoon. Changing the visit count should not change the result. An inline strong tag inside a paragraph should preserve adjacent text without creating another block.

Before coding, write down the returned fields for that example and one input that should fail. Keep the expected result beside your implementation so you can distinguish a contract change from a bug.

## Implement the contract

- `ExtractBlocks(input string, ignorePhrases []string) ([]string, error)`

Normalize entities and whitespace. Omit empty blocks. Optional nonempty phrases remove a whole matching block case-insensitively. Reject input beyond 2,000,000 bytes, unclosed tags/comments/ignored regions and more than 10,000 blocks. Keep this scanner's supported subset visible: it is not a full browser parser and cannot infer visual visibility.

Keep earlier stages working. Implement these functions in your learner workspace, leaving the reference solution closed while you work through the example.

## Hints and failure cases

Track whether a quote is open while finding a tag's closing angle bracket. Flush accumulated text only at block boundaries. Skip ignored regions before appending text. An empty tag must produce an error or safe no-op, never an index panic.

## Run your stage

Initialize once from the repository root, then run the cumulative tests:

```bash
python3 scripts/project_test.py web-change-brief --init my-web-change-brief
python3 scripts/project_test.py web-change-brief --stage 1 --path my-web-change-brief
```

The starter deliberately raises an implementation error. Later initialization preserves your source rather than replacing it. A passing result requires every selected test to run; a skipped test is not completion evidence.

## Check your reasoning

What useful text could a page author place in a footer? Why does removing a whole phrase-matching block need an explicit policy?

## Connect it to the finished artifact

A standalone change report, changes.json and a reusable baseline.json snapshot. The extractor is a deliberately limited readable-block scanner, not an HTML5 DOM or browser. It does not execute JavaScript, evaluate CSS visibility or fetch linked resources. Block order is ignored; repeated text counts are retained. Filtering phrases can hide useful changes, so use the same explicit filter policy for both snapshots.

After completing the project, try your own inputs:

```bash
cd my-web-change-brief
go run . --before fixtures/before.html --after fixtures/after.html --url https://example.invalid/makerspace --out ./web-change-output
```

Add a documented per-site extraction rule and a fixture for the real HTML you want to monitor. Keep a parser failure visible rather than returning an empty successful snapshot.

## Primary reference

[Official API documentation](https://pkg.go.dev/net/http). The implementation, examples and fixtures are original. The reference explains the underlying API; the project-specific policies are stated above.
