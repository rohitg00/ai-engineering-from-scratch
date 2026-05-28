# A2A — Protocolo Agent-to-Agent

> MCP é agent-to-tool. A2A (Agent2Agent) é agent-to-agent — um protocolo aberto pra deixar agentes opacos construídos em frameworks diferentes colaborarem. Lançado pelo Google em abril de 2025, doado pra Linux Foundation em junho de 2025, atingindo v1.0 em abril de 2026 com 150+ apoiadores incluindo AWS, Cisco, Microsoft, Salesforce, SAP e ServiceNow. Absorveu o ACP da IBM e adicionou a extensão AP2 de pagamentos. Essa lição percorre o Agent Card, o ciclo de vida de Task e as duas binding de transporte.

**Tipo:** Construir
**Linguagens:** Python (stdlib, Agent Card + harness de Task)
**Pré-requisitos:** Fase 13 · 06 (Fundamentos MCP), Fase 13 · 08 (Cliente MCP)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Distinguir casos de uso agent-to-tool (MCP) de agent-to-agent (A2A).
- Publique um Agent Card em `/.well-known/agent.json` com skills e metadados de endpoint.
- Percorra o ciclo de vida de Task (submitted → working → input-required → completed / failed / canceled / rejected).
- Use Messages com Parts (text, file, data) e Artifacts como saídas.

## O Problema

Um agente de atendimento ao cliente precisa delegar escrita de relatórios a um agente escritor eespecificaçãoializado. Opções pré-A2A:

- API REST customizada. Funciona mas cada pareamento é um caso único.
- Codebase compartilhada. Requer que os dois agentes rodem o mesmo framework.
- MCP. Não se encaixa: MCP é pra chamar ferramentas, não pra dois agentes colaborarem preservando o raciocínio interno opaco de cada um.

A2A preenche a lacuna. Modela a interação como um agente enviando uma Task pra outro, com ciclo de vida, mensagens e artifacts. O estado interno do agente chamado fica opaco — o chamador vê só transições de estado da task e outputs finais.

A2A é o protocolo "deixe agentes de frameworks diferentes conversarem entre si." Ele não substitui MCP; os dois são complementares.

## O Conceito

### Agent Card

Todo agente compatível com A2A publica um card em `/.well-known/agent.json`:

```json
{
  "schemaVersion": "1.0",
  "name": "research-agent",
  "description": "Summarizes academic papers and drafts citations.",
  "url": "https://research.example.com/a2a",
  "version": "1.2.0",
  "skills": [
    {
      "id": "summarize_paper",
      "name": "Summarize a paper",
      "description": "Read a paper PDF and produce a 3-paragraph summary.",
      "inputModes": ["text", "file"],
      "outputModes": ["text", "artifact"]
    }
  ],
  "capabilities": {"streaming": true, "pushNotifications": true}
}
```

Descoberta é baseada em URL: busque o card, descubra a URL do endpoint A2A, enumere skills.

### Agent Cards Assinados (AP2)

A extensão AP2 (setembro 2025) adiciona assinaturas criptográficas aos Agent Cards. Um publicador assina seu próprio card com JWT; consumidores verificam. Previne personificação.

### Ciclo de vida de Task

```
submitted -> working -> completed | failed | canceled | rejected
             -> input_required -> working (loop via message)
```

Clientes iniciam com `tasks/send`. O agente chamado transita pelos estados; clientes se inscrevem em atualizações de estado via SSE ou polling.

### Mensagens e Parts

Uma mensagem carrega uma ou mais Parts:

- `text` — conteúdo simples.
- `file` — blob base64 com mimeType.
- `data` — payload JSON tipado (entrada estruturada pro agente chamado).

Exemplo:

```json
{
  "role": "user",
  "parts": [
    {"type": "text", "text": "Summarize this paper."},
    {"type": "file", "file": {"name": "paper.pdf", "mimeType": "application/pdf", "bytes": "..."}},
    {"type": "data", "data": {"targetLength": "3 paragraphs"}}
  ]
}
```

### Artifacts

Saídas são Artifacts, não strings brutas. Um Artifact é uma saída nomeada e tipada:

```json
{
  "name": "summary",
  "parts": [{"type": "text", "text": "..."}],
  "mimeType": "text/markdown"
}
```

Artifacts podem ser transmitidos como chunks. O chamador acumula.

### Duas binding de transporte

1. **JSON-RPC sobre HTTP.** Endpoint `/a2a`, POST pra requisições, SSE opcional pra streaming. Binding padrão.
2. **gRPC.** Pra ambientes enterprise onde gRPC é nativo.

Ambas as binding carregam a mesma forma lógica de mensagem.

### Preservação de opacidade

Um princípio de projeto chave: o estado interno do agente chamado é opaco. O chamador vê estado da task e artifacts. A cadeia de raciocínio do agente chamado, suas chamadas de ferramenta, sua delegação de sub-agentes — tudo invisível. Isso é diferente de MCP, onde chamadas de ferramenta são transparentes.

Justificativa: A2A permite que concorrentes colaborem sem revelar internos. A2A pode ser "chame este agente de atendimento" sem que o chamador saiba como aquele agente implementa o serviço.

### Timeline

- **2025-04-09.** Google anuncia A2A.
- **2025-06-23.** Doado pra Linux Foundation.
- **2025-08.** Absorve o ACP da IBM.
- **2025-09.** Extensão AP2 (Agent Payments) lançada.
- **2026-04.** v1.0 lançada com 150+ organizações apoiadoras.

### Relação com MCP

| Dimensão | MCP | A2A |
|-----------|-----|-----|
| Caso de uso | Agent-to-tool | Agent-to-agent |
| Opacidade | Chamadas de ferramenta transparentes | Raciocínio interno opaco |
| Chamador típico | Runtime do agente | Outro agente |
| Estado | Resultado de chamada de ferramenta | Task com ciclo de vida |
| Autorização | OAuth 2.1 (Fase 13 · 16) | Agent Cards assinados com JWT (AP2) |
| Transporte | Stdio / Streamable HTTP | JSON-RPC sobre HTTP / gRPC |

Use MCP quando quiser invocar uma ferramenta eespecificaçãoífica. Use A2A quando quiser delegar uma task inteira pra outro agente. Muitos sistemas de produção usam os dois: um agente usa MCP pra sua camada de ferramentas e A2A pra sua camada de colaboração.

## Usar

`code/main.py` implementa um harness A2A mínimo: um agente de pesquisa publica seu card, um agente escritor recebe uma `tasks/send` com parts incluindo PDF e instrução de texto, transita por working → input_required → working → completed, e retorna um artifact de texto. Tudo stdlib; usa transporte em memória pra focar na forma das mensagens.

O que observar:

- Forma do JSON do Agent Card.
- Atribuição de ID da task e transições de estado.
- Mensagens com parts de tipo misto.
- Ramificação de input_required no meio da task.
- Retorno de artifact no completion.

## Entregar

Essa lição produz `outputs/skill-a2a-agent-especificação.md`. Dado um novo agente que deve ser chamável por outros agentes, a skill produz o JSON do Agent Card, schema de skills e blueprint do endpoint.

## Exercícios

1. Rode `code/main.py`. Rastreie o ciclo de vida completo da Task, incluindo a pausa de input_required onde o agente chamado pede uma clarificação.

2. Adicione um Agent Card assinado. Assine com HMAC sobre o JSON canônico do card. Escreva um verificador e confirme que ele falha num card mutado.

3. Implemente streaming de task: o agente escritor emite três chunks incrementais de artifact via SSE e o chamador os acumula.

4. Projete um agente A2A que encapsula um servidor MCP. Mapeie cada ferramenta MCP pra uma skill A2A. Observe os tradeoffs — qual opacidade se perde?

5. Leia o anúncio do A2A v1.0 e identifique uma funcionalidade que ainda não foi implementada por nenhum framework até abril de 2026. (Dica: relaciona-se com delegação de task multi-hop.)

## Termos Chave

| Termo | O que as pessoas dizem | O que significa de verdade |
|------|----------------|------------------------|
| A2A | "Protocolo Agent-to-Agent" | Protocolo aberto pra colaboração de agentes opacos |
| Agent Card | "`well-known/agent.json`" | Metadados publicados descrevendo skills e endpoint de um agente |
| Skill | "Uma unidade chamável" | Uma operação nomeada que o agente suporta (análogo a ferramenta MCP) |
| Task | "Unidade de delegação" | Um item de trabalho com ciclo de vida e artifact final |
| Message | "Entrada da task" | Carrega Parts (text, file, data) |
| Part | "Chunk tipado" | Elemento `text` / `file` / `data` de uma mensagem |
| Artifact | "Saída da task" | Saída nomeada e tipada retornada no completion |
| AP2 | "Protocolo de Pagamentos de Agente" | Extensão de Agent Cards assinados pra confiança e pagamentos |
| Opacidade | "Colaboração caixa-preta" | Internos do agente chamado ficam ocultos do chamador |
| Input-required | "Pausa da task" | Estado do ciclo de vida quando o agente precisa de mais informação |

## Leitura Complementar

- [a2a-protocol.org](https://a2a-protocol.org/latest/) — eespecificaçãoificação canônica do A2A
- [a2aproject/A2A — GitHub](https://github.com/a2aproject/A2A) — implementações de referência e SDKs
- [Linux Foundation — A2A launch press release](https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents) — transferência de governança jun/2025
- [Google Cloud — A2A protocol upgrade](https://cloud.google.com/blog/products/ai-machine-learning/agent2agent-protocol-is-getting-an-upgrade) — roadmap e momentum de parceiros
- [Google Dev — A2A 1.0 milestone](https://discuss.google.dev/t/the-a2a-1-0-milestone-ensuring-and-testing-backward-compatibility/352258) — notas de release v1.0 e guia de compatibilidade retroativa
