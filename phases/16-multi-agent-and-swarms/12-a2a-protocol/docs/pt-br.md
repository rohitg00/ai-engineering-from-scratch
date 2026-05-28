# A2A — O Protocolo Agent-to-Agent

> O Google anunciou o A2A em abril de 2025; até abril de 2026 a spec está em https://a2a-protocol.org/latest/specification/ e 150+ organizações apoiam. A2A é o complemento horizontal do MCP (Lição 13): enquanto MCP é vertical (agent ↔ tools), A2A é peer-to-peer (agent ↔ agent). Define Agent Cards (descoberta), tasks com artifacts (texto, dados estruturados, vídeo), ciclos de vida opacos de task, e auth. Sistemas em produção cada vez mais combinam MCP com A2A. O Google Cloud incorporou suporte a A2A no Vertex AI Agent Builder durante 2025-2026.

**Tipo:** Aprender + Construir
**Linguagens:** Python (stdlib, `http.server`, `json`)
**Pré-requisitos:** Fase 16 · 04 (Primitive Model)
**Tempo:** ~75 minutos

## Problema

Seu agent precisa chamar outro agent em outro sistema. Como? Você pode expor um endpoint HTTP, definir um schema JSON bespoke, e torcer pro outro lado falar a mesma língua. Cada par de agent vira uma integração custom.

A2A é o protocolo universal de rede pra essa chamada. Descoberta padrão, modelo de task padrão, transport padrão, artifacts padrão. Como HTTP+REST mas com agents como cidadãos de primeira classe.

## Conceito

### Os quatro elementos

**Agent Card.** Um documento JSON em `/.well-known/agent.json` descrevendo o agent: nome, habilidades, endpoints, modalidades suportadas, requisitos de auth. A descoberta acontece lendo o card.

```
GET https://agent.example.com/.well-known/agent.json
→ {
    "name": "code-review-agent",
    "skills": ["review-python", "review-typescript"],
    "endpoints": {
      "tasks": "https://agent.example.com/tasks"
    },
    "auth": {"type": "bearer"},
    "modalities": ["text", "structured"]
  }
```

**Task.** A unidade de trabalho. Um objeto assíncrono e stateful com um ciclo de vida: `submitted → working → completed / failed / canceled`. Um client envia uma task, faz polling ou se inscreve para atualizações.

**Artifact.** O tipo de resultado produzido por uma task. Texto, JSON estruturado, imagem, vídeo, áudio. Artifacts são tipados pra que diferentes modalidades sejam de primeira classe.

**Ciclo de vida opaco.** A2A não prescreve *como* o agent remoto resolve a task. O client vê transições de estado e artifacts; a implementação é livre pra usar qualquer framework.

### A divisão MCP/A2A

- **MCP** (Lição 13): agent ↔ tool. O agent lê/escreve via JSON-RPC pra um server de tools. Stateless por padrão.
- **A2A**: agent ↔ agent. Protocolo peer; ambos os lados são agents com seu próprio raciocínio.

Sistemas multi-agent em produção usam os dois. Um peer A2A chama tools MCP do seu lado. A divisão mantém as duas preocupações limpas.

### Fluxo de descoberta

```
Client                     Agent server
  ├──GET /.well-known/agent.json──>
  <──Agent Card JSON─────────────
  ├──POST /tasks {skill, input}──>
  <──201 task_id, state=submitted
  ├──GET /tasks/{id}──────────────>
  <──state=working, 42% done──────
  ├──GET /tasks/{id}──────────────>
  <──state=completed, artifacts──
```

Ou com streaming: inscrição SSE em `/tasks/{id}/events` para atualizações push.

### Auth

A2A suporta três padrões comuns:

- **Bearer token** — OAuth2 ou opaco.
- **mTLS** — TLS mútuo; organizações provam identidade entre si.
- **Requests assinados** — HMAC sobre o payload.

Auth é declarado no Agent Card; clients descobrem e se conformam.

### 150+ organizações até abril de 2026

A adoção empresarial impulsionou a escala do A2A. O destaque: A2A virou o jeito de sistemas agent empresariais cruzarem limites de confiança. O Google Cloud lançou suporte a A2A no Vertex AI Agent Builder; o Microsoft Agent Framework suporta; a maioria dos frameworks grandes (LangGraph, CrewAI, AutoGen) fornece adaptadores A2A.

### Onde o A2A vence

- **Chamadas inter-organização.** Agent na empresa A chama agent na empresa B. Sem A2A, cada par é um contrato bespoke.
- **Frameworks heterogêneos.** Agent LangGraph chama agent CrewAI chama agent Python custom. A2A normaliza.
- **Artifacts tipados.** Resultado em vídeo, JSON estruturado, áudio — tudo de primeira classe.
- **Tasks de longa duração.** Ciclo de vida opaco + polling torna tasks de horas simples.

### Onde o A2A tropeça

- **Micro-chamadas sensíveis a latência.** O ciclo de vida do A2A é assíncrono. Agent-a-agent sub-milissegundo não se encaixa; use RPC direto.
- **Agents tight-coupled no mesmo processo.** Se ambos os agents rodam no mesmo processo Python, a volta de HTTP do A2A é overkill.
- **Equipes pequenas.** O overhead da spec é real; agents internos podem não precisar da formalidade.

### A2A vs ACP, ANP, NLIP

Várias specs relacionadas surgiram em 2024-2026:

- **ACP** (IBM/Linux Foundation) — predecessor do A2A, escopo mais restrito.
- **ANP** (Agent Network Protocol) — focado em descoberta peer, first-class descentralizado.
- **NLIP** (Ecma Natural Language Interaction Protocol, padronizado dezembro de 2025) — tipo de conteúdo em linguagem natural.

A2A é o protocolo peer mais adotado até abril de 2026. Veja arXiv:2505.02279 (Liu et al., "A Survey of Agent Interoperability Protocols") para a comparação.

## Construa

`code/main.py` implementa um server e client A2A-minimal usando `http.server` e JSON. O server:

- expõe `/.well-known/agent.json`,
- aceita `POST /tasks`,
- gerencia estado de tasks,
- retorna artifacts em `GET /tasks/{id}`.

O client:

- busca o Agent Card,
- submete uma task,
- faz polling até completar,
- lê o artifact.

Execute:

```
python3 code/main.py
```

O script inicia o server numa thread de fundo e depois roda o client contra ele. Você vê o fluxo completo: descoberta, submissão, poll, artifact.

## Use

`outputs/skill-a2a-integrator.md` desenha uma integração A2A: conteúdo do Agent Card, schemas de tasks, escolha de auth, streaming vs polling.

## Deploy

Checklist:

- **Fixe a versão da spec.** A2A ainda está evoluindo; o Agent Card deve declarar a versão do protocolo.
- **Criação de task idempotente.** Submissões duplicadas (retry de rede) devem produzir uma task.
- **Schemas de artifacts.** Declare quais formatos o agent retorna; consumidores devem validar.
- **Rate limits + auth.** A2A é público; aplique segurança web padrão.
- **Dead-letter para tasks falhadas.** Inspecione padrões ao longo do tempo para tipos recorrentes de falha.

## Exercícios

1. Execute `code/main.py`. Confirme que o client descobre o server e recebe o artifact correto.
2. Adicione uma segunda habilidade ao server (por exemplo, "summarize"). Atualize o Agent Card. Escreva um client que escolhe a habilidade baseado no tipo de task.
3. Implemente um endpoint de streaming SSE: `/tasks/{id}/events` que emite mudanças de estado. O que o client precisa fazer de diferente?
4. Leia a spec do A2A (https://a2a-protocol.org/latest/specification/). Identifique três coisas que a spec obriga e que essa demo não implementa.
5. Compare A2A (descoberta via Agent Card) com MCP (listagem de capacidades no server via `listTools`). Qual é o trade-off entre agents auto-descritivos e probing de capacidades?

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|-------|-------------------|--------------------------|
| A2A | "Agent-to-agent" | Protocolo peer para agents chamarem outros agents entre sistemas. Google 2025. |
| Agent Card | "O cartão de visitas do agent" | JSON em `/.well-known/agent.json` descrevendo habilidades, endpoints, auth. |
| Task | "A unidade de trabalho" | Objeto assíncrono stateful com ciclo de vida; artifacts produzidos ao completar. |
| Artifact | "O resultado" | Saída tipada: texto, JSON estruturado, imagem, vídeo, áudio. Mídia de primeira classe. |
| Ciclo de vida opaco | "Como é resolvido é problema do agent" | Client vê transições de estado; server é livre pra escolher framework/tools. |
| Discovery | "Encontrar o agent" | `GET /.well-known/agent.json` retorna o card. |
| MCP vs A2A | "Tools vs peers" | MCP: vertical agent ↔ tool. A2A: horizontal agent ↔ agent. |
| ACP / ANP / NLIP | "Protocols irmãos" | Specs adjacentes; A2A é o mais adotado em 2026. |

## Leitura Complementar

- [Especificação A2A](https://a2a-protocol.org/latest/specification/) — a spec canônica
- [Google Developers Blog — anúncio A2A](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/) — post de lançamento de abril de 2025
- [Repo A2A no GitHub](https://github.com/a2aproject/A2A) — implementações de referência e SDKs
- [Liu et al. — A Survey of Agent Interoperability Protocols](https://arxiv.org/html/2505.02279v1) — comparação MCP, ACP, A2A, ANP
