---
id: tool-call-security-rules
title: Design the executor behind an agent's tool calls
card: prompting-structured-output
kind: design
level: 3
roles: [agentic-ai-engineer, applied-ai-engineer, forward-deployed-ai-engineer]
rounds: [system-design, design-review]
tags: [function-calling, security, allowlist, sandbox, argument-validation]
minutes: 15
lessons: [phases/11-llm-engineering/09-function-calling]
manuals: []
practice: [tool-call-parser]
cheatsheet: [tool-calling]
related: [prompting-structured-output/tool-description-is-a-prompt, prompting-structured-output/structured-output-vs-function-call]
updated: 2026-11-03
---

Design the execution layer for an agent that can query a database, run small code snippets and read files on behalf of a user. The model decides which tool to call. What rules does the executor enforce, and what does it never do?

## Short answer

The executor never passes model-generated SQL or shell text straight to a system. It exposes an allowlist of named functions with typed parameters, validates every argument against the schema before execution, sanitizes tool results before they return to the model, and caps the number of calls per conversation at 10 to 20. For code, an in-process filter is a teaching aid and not a boundary; untrusted code runs in a separate process or container.

## Full answer

### The five rules

1. **Never pass generated SQL to the database.** The model can and will produce destructive statements and injections. The lesson's exercise shapes the tool to accept a table name and filter conditions, with the tables on an allowlist and the operators restricted to a small set; your code builds the query.
2. **Allowlist the functions.** The model calls only what you define. If fifty internal functions exist, expose the five the user needs. Never build a generic call-by-name tool.
3. **Validate the arguments.** Check required fields, unknown fields, types and enum membership against the schema before execution; a city name can carry an injection string.
4. **Sanitize the results.** A tool result goes back into the prompt verbatim, so strip keys, personal data and internal errors, and treat instructions inside a result as tool poisoning.
5. **Cap the calls.** A loop can call a tool hundreds of times; 10 to 20 calls per conversation is the lesson's range, with a bounded retry count per failing call.

### The file tool

Reject any path with a parent reference or a leading slash, and return a structured error with the list of files that exist. The error shape matters: a message, a code and suggestions let the model correct its arguments; an empty response or a generic failure does not.

### The code tool

A substring blocklist reads the code as text and misses anything it does not literally spell. Parsing the code into a syntax tree lets the guard reject imports, dunder attribute access and unsafe names by structure. Even then, the guard shares the interpreter with the code it runs, and a determined caller finds reachable objects. Production runs untrusted code in a separate process with dropped privileges, in a sandbox or in a hosted runner, so an escape lands in a throwaway box.

### What the model never does

It never executes anything. It emits a name and arguments. Everything after that is your code, and every rule above lives there.

## Follow-ups

- **Level 3:** Why is a substring blocklist not enough for the code tool? Expected: it matches spelling, not structure; a parsed syntax tree rejects imports, dunder access and unsafe names by shape, and even that shares the interpreter with the code.
- **Level 3:** How do you shape the database tool so the model never writes SQL? Expected: accept a table name and filter conditions, allowlist the tables, restrict the operators, and build the query in your code.
- **Level 4:** What is tool poisoning and where is the control? Expected: results that carry instructions to the model; sanitize every result before it returns, and strip sensitive data such as keys and internal errors.
- **Level 4:** The agent loops on a failing tool. What stops it? Expected: a maximum number of calls per conversation, 10 to 20 in the lesson, structured errors that let the model fix its arguments, and a retry cap of about 3 per call.

## Wrong answers

- "The model behaves, parameterize later." The model can and will generate destructive queries or injections; the rule is never to pass its SQL through.
- "A generic run-any-function tool is simpler." The allowlist is the rule: expose the five functions the user needs, not all fifty.
- "The code filter blocks imports, so it is safe." It shares the interpreter with the code it runs; production uses a separate process or container.

## Taught in

The lesson [function calling](../../../phases/11-llm-engineering/09-function-calling/) states the five security rules, builds the argument validator and the file and code guards, and sets the call budget.
