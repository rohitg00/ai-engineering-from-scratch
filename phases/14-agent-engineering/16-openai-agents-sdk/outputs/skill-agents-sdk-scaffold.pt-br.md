---
name: agents-sdk-scaffold
description: Crie um aplicativo OpenAI Agents SDK com um agente de triagem, transferências, proteções de entrada/saída/ferramentas, armazenamento de sessão e um processador de rastreamento.
version: 1.0.0
phase: 14
lesson: 16
tags: [openai, agents-sdk, handoffs, guardrails, tracing, session]
---

Dado um domínio de produto e uma lista de agentes especializados, crie um aplicativo OpenAI Agents SDK.

Produzir:

1. `Agent` por especialista mais um agente `triage` que possui apenas handoffs (sem ferramentas de domínio).
2. `FunctionTool` por ferramenta de domínio com esquema de entrada digitado, descrição clara (informa ao modelo quando usá-la) e sandbox de execução.
3. `Handoff` da triagem para cada especialista. Verifique se os nomes das ferramentas seguem a convenção `transfer_to_<agent>`.
4. `InputGuardrail` para PII, política, escopo. O padrão é o modo paralelo, a menos que o guardrail LLM seja grande em relação ao modelo principal — então use o bloqueio.
5. `OutputGuardrail` para comprimento, PII, política. Sempre bloqueando a produção para saídas críticas de segurança.
6. Proteção por ferramenta em ferramentas de função que afetam a rede ou o sistema de arquivos.
7. Armazenamento `Session` (padrão SQLite; Redis para prod).
8. A fiação `add_trace_processor` se estende até seu back-end junto com a IU de rastreamento do OpenAI.

Rejeições difíceis:

- Agentes de triagem com ferramentas de domínio. Somente transferências de triagem; a mistura dilui a decisão do roteador.
- Guarda-corpos que alteram a entrada/saída. Os Guardrails aprovam ou rejeitam – eles não reescrevem.
- Loops de transferência silenciosos. Requer um contador de saltos (padrão no máximo 3).

Regras de recusa:

- Se o usuário quiser “sem barreiras de proteção, apenas aja rápido”, recuse qualquer produto que atinja usuários pagantes ou PII.
- Se o produto tiver apenas 2 especialistas, sugira roteamento via `Agents` com classificador direto (Lição 12) em vez de triagem+transferência — menos custo de token.
- Se o rastreamento estiver desativado no produto, recuse o envio. Falhas em várias etapas não podem ser depuradas sem deixar rastros.

Saída: `agents.py`, `tools.py`, `guardrails.py`, `app.py`, `README.md` com a lógica do agente de triagem, modos de proteção, processador de rastreamento e backend de sessão. Termine com "o que ler a seguir" apontando para a Lição 23 (OTel GenAI), Lição 24 (backends de observabilidade) ou Lição 17 para tradução do SDK do Agente Claude.