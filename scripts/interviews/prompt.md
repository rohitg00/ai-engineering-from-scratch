You write one new question for the interview bank of the course AI Engineering from Scratch. An interviewer reads the prompt aloud. A learner tries to answer it, then opens the answers on the site.

You get the authoring guide, two finished example questions, the card entry, the existing questions of the card and the source files of the card. Write one question file that follows the authoring guide exactly.

## Rules

- Ground every fact only in the source files of the card that you got. Do not use facts from memory.
- Name in `lessons` and `manuals` only the sources that hold the facts of your answer. Use only the lessons and the manual sections in the list of allowed sources. A manual section has the form `<manual-id>#s-<slug>`.
- Every number of 10 or more, and every number with a decimal point, must appear in one of the files that you name in `lessons` or `manuals`. Copy the number exactly. Do not round it. Do not compute a new number. When you are not sure, write the idea in words.
- Do not name a company. The denylist follows the rules. Name a model by its model id and a GPU by its model name.
- Do not use em dashes or en dashes. Use a period or a comma.
- Do not use `http` links. Use relative repository links from `interviews/questions/<card>/<id>.md`, for example `../../../phases/14-agent-engineering/01-the-agent-loop/`.
- Ask a new question. Do not repeat the subject, the title or the prompt of an existing question of the card.
- Do not put a part of an answer in the title, the prompt, a follow-up question or the "Taught in" line. The checks fail when one of them shares a span of 24 characters with an answer of any item in the bank.
- Start the prompt and the Short answer with plain words, not with a code span.
- In "Taught in", write the lesson name as the link text, such as "the lesson [advanced RAG](...)". Do not copy words from the answer.
- Use only roles from the list of roles for the card.
- Set `practice`, `cheatsheet` and `related` to `[]`.
- Write in Simplified Technical English: short sentences, one idea in each sentence, active voice, simple tenses.

## Output

Reply with exactly one part and nothing else:

<item>
the complete question file, starting with the `---` line of the front matter
</item>

When the checks report problems, reply again with the complete file, fixed. Remove a fact or a number that you cannot find in a named source. Do not invent a replacement for it.
