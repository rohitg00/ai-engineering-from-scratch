# Prose rules

A manual uses limits from Simplified Technical English. The audit checks each limit on every prose span: paragraphs, list items, table cells, takeaways, figure claims, figure captions, and listing notes. Quotes, inline code, fenced code, and citations are exempt.

## Voice

- Write to one reader, in the second person, about the mechanism.
- Start each section from a situation the reader has been in.
- Define a term once, use it the same way everywhere, and add it to the glossary.
- Keep one topic per paragraph.

## Limits

| Span | Limit |
|---|---|
| sentence | at most 25 words |
| thesis | one sentence, at most 30 words |
| figure claim | one sentence, at most 28 words, ends with a period |
| takeaway | an instruction, at most 20 words |
| paragraph | at most 6 sentences |

A word is a run of letters, digits, or the characters `$ % . ' / -`. Inline code counts as one word. Citations count as zero words.

## Banned forms

- No semicolons. Split the sentence.
- No em dashes and no en dashes. Use a colon, a comma, or a period.
- No contractions, such as `don't`, `it's`, or `you're`.
- No `may` at all. Use "can", or state the condition.
- No filler intensifiers: `crucially`, `importantly`, `notably`, `ultimately`, `essentially`, `fundamentally`.
- No inflation: `game-changing`, `paradigm`, `pivotal`, `groundbreaking`, `revolutionary`, `unprecedented`, `cutting-edge`.
- No phrases that avoid "is" or "has": `serves as`, `stands as`, `acts as a testament`, `underscores`, `highlights the`.
- No staged run-ups, such as `here's why` or `here's the thing`.
- No sentence shaped as `not X but Y`. State what is true.

## Banned words

Each row lists the words and what to write instead.

| Words | Write instead |
|---|---|
| `wire`, `wires`, `wired`, `wiring` | the real thing: the request, the response, the stream, the network |
| `stick`, `sticky`, `stuck` | stay, remain, or keep |
| `glue`, `plumbing`, `knob`, `gotcha`, `footgun` | the code, the setting, or the defect |
| `under the hood`, `escape hatch`, `sharp edge`, `first-class`, `out of the box`, `heavy lifting`, `moving parts`, `sweet spot`, `deep dive` | plain words |
| `boil down`, `spin up`, `kick off`, `bake in`, `fall back`, `fallback` | one plain verb |
| `gate`, `surface`, `front` (as verbs), `land`, `ship`, `fan out`, `catch` | a plain verb. Do not use a noun or a metaphor as a verb. |
| `in flight`, `out of band`, `bare`, `hand off`, `hand over`, `hand to`, `handoff` | concrete words: outside the protocol, plain, send, give |
| `delve`, `robust`, `seamless`, `crucial`, `comprehensive`, `landscape`, `tapestry`, `testament` | a plain word |
| `furthermore`, `moreover`, `leverage`, `additionally`, `actually`, `foster`, `garner`, `intricate` | a plain word |
| `meticulous`, `quietly`, `showcase`, `underscore`, `vibrant`, `enhance`, `interplay`, `align with` | a plain word |
| `enduring`, `bolster`, `highlight`, `valuable`, `journey`, `unlock`, `supercharge` | a plain word |

The checks match each word with all its endings, so `gated`, `ships`, and `landing` fail too. Name the real action, such as `the operator approves the deploy outside the protocol`.

## Rewrite patterns

| Instead of | Write |
|---|---|
| `The server may close the stream.` | `The server can close the stream.` or `The server closes the stream when the job ends.` |
| `The client sends a cancel; the server ignores it.` | `The client sends a cancel. The server ignores it.` |
| `Errors surface in the response.` | `The response holds the errors.` |
| `This ships in 1.0.` | `Version 1.0 adds this.` |
