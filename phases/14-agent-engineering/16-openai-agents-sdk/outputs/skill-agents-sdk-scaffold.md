---
name: agents-sdk-scaffold
description: triage agent、handoffs、input/output/tool guardrails、session store、trace processorを持つOpenAI Agents SDK appをscaffoldする。
version: 1.0.0
phase: 14
lesson: 16
tags: [openai, agents-sdk, handoffs, guardrails, tracing, session]
---

product domainとspecialist agentsのlistを受け取り、OpenAI Agents SDK appをscaffoldする。

生成するもの:

1. specialistごとの`Agent`と、handoffだけを持つ`triage` agent (domain toolsなし)。
2. domain toolごとの`FunctionTool`。typed input schema、clear description (modelに使用タイミングを伝える)、execution sandboxを持つ。
3. triageから各specialistへの`Handoff`。tool nameが`transfer_to_<agent>` conventionに従うことを確認する。
4. PII、policy、scope用の`InputGuardrail`。guardrail LLMがmain modelに比べて大きい場合を除きdefaultはparallel mode。その場合はblockingを使う。
5. length、PII、policy用の`OutputGuardrail`。safety-critical outputのprodでは必ずblocking。
6. networkまたはfilesystemに触れるfunction tool上のper-tool guardrails。
7. `Session` store (defaultはSQLite、prodはRedis)。
8. OpenAIのtrace UIに加え、自分のbackendへspanを送る`add_trace_processor` wiring。

Hard rejects:

- domain toolsを持つtriage agent。triageはhandoffのみ。混ぜるとrouterの判断が薄まります。
- input/outputをmutateするguardrail。guardrailはapproveまたはrejectするだけで、rewriteしません。
- silent handoff loop。hop counterを必須にする (default max 3)。

Refusal rules:

- userが「guardrailsなしで、とにかく速く」と求めた場合、paying usersまたはPIIに触れるproductでは拒否する。
- productにspecialistが2つだけなら、triage+handoffsではなく`Agents`によるdirect classifier (Lesson 12) routingを提案する。token costが少ない。
- prodでtracingをdisabledにしているならshipを拒否する。multi-step failureはtraceなしではdebugできません。

Output: `agents.py`, `tools.py`, `guardrails.py`, `app.py`, `README.md`。triage-agent rationale、guardrail modes、trace processor、session backendを説明する。最後に"what to read next"としてLesson 23 (OTel GenAI)、Lesson 24 (observability backends)、Claude Agent SDKへのtranslationにはLesson 17を示す。
