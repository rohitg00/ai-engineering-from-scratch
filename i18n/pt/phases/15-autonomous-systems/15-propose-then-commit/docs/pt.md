# Homem no Circuito: Propõe-se e depois compromete-se

> O consenso de 2026 sobre o HITL é específico. Não é "o agente pede, o usuário clica em Aprova". É proposta-então-compromissado: a ação proposta é persistida para uma loja duradoura com uma chave de idempotencia; apareceu para um revisor com intenção, linhagem de dados, permissões tocadas, raio de explosão e um plano de retrocesso; cometido apenas após reconhecimento positivo; verificado após execução para confirmar que o efeito colateral realmente aconteceu. O LangGraph's `interrupt()`Além do checkpointing PostgreSQL, o Microsoft Agent Framework `RequestInfoEvent`, e do Cloudflare.`waitForApproval()`O modo de falha canônico é a aprovação de selo de borracha: "Aplicar?" é clicado sem revisão. A mitigação documentada é o desafio e resposta com uma lista de verificação explícita.

**Type:** Learn
**Languages:** Python (stdlib, propose-then-commit state machine with idempotency), TypeScript
**Prerequisites:** Phase 15 · 12 (Durable execution), Phase 15 · 14 (Tripwires)
**Time:** ~60 minutes

## O problema

O agente toma uma ação. O usuário tem que decidir: aprovar ou não. Se a decisão é instantânea, provavelmente não é uma revisão. Se a decisão é estruturada, é lenta, mas confiável. A questão de engenharia é como fazer uma revisão estruturada o caminho da menor resistência.

O padrão HITL da era 2023 foi um pedido sincrônico: "O agente quer enviar e-mail para X com o corpo Y  aprovar?" O usuário clica em Aproveitar. Todo mundo sente que o sistema é seguro. Na prática, esta superfície é fortemente marcada por borracha: os usuários aprovam rapidamente, as aprovações prevêem pouco, e quando o agente falha, a trilha de auditoria mostra um longo histórico de aprovações que o usuário não pode lembrar.

O padrão 2026  propor-depois-comprometer  move HITL para um sustrato durável, anexa metadados estruturados e requer compromisso positivo.`interrupt()`, Microsoft Agent Framework `RequestInfoEvent`, Cloudflare `waitForApproval()`Os nomes das API diferem, a forma não.

## O conceito

### A máquina do Estado de proposição e depois de compromisso

1. **Propose.**O agente produz uma ação proposta. Persistindo para um armazém durável (PostgreSQL, Redis, Objeto Durável). Inclui:
   - Intenção (por que o agente está fazendo isso)
   - Linhagem de dados (que fonte levou à presente proposta)
   - Permissões tocadas (que escopo / arquivos / pontos finais)
   - raio de explosão (o que é o pior caso)
   - plano de reestruturação (se for cometido, como o desfechar)
   - Cláusula de independência (única por proposta; a representação apresenta o mesmo registro)
2. **Surface.**O revisor vê a proposta com todos os metadados.
3. **Commit.**Reconhecimento positivo, a ação é executada.
4. **Verify.**Após a execução, o efeito colateral é lido de volta e confirmado. Se a etapa de verificação falhar, o sistema está em um estado de mau conhecido e o alerta se activa.

### A chave da impotência

Sem uma chave de idempotency, uma nova tentativa após uma falha transitória pode executar duas vezes uma ação aprovada. Exemplo concreto: o usuário aprova "transferir $100 de A para B. " Blip de rede. Fluxo de trabalho retrata. O usuário aprovou uma vez, mas a transferência é executada duas vezes. A chave de idempotency liga a aprovação a um único efeito colateral único; a segunda execução é um no-op.

Este é o mesmo padrão de idempotencia que Stripe e AWS API usam. Reutilizar para aprovações de agentes é explícito nos documentos do Microsoft Agent Framework.

### Durabilidade: por que as aprovações ultrapassam os processos

A sala de espera de aprovação é um estado que o agente não possui. O fluxo de trabalho é pausa (Lessão 12). Quando a aprovação chega, o fluxo de trabalho retoma exatamente a partir desse ponto.`interrupt()`com checkpointing PostgreSQL e não apenas estado de memória  uma aprovação dois dias depois ainda encontra o fluxo de trabalho intacto.

### Aplicação de um sistema de regulação de dados

A interface padrão para HITL ("Aplicar" / "Rejeitar" botões) produz aprovações rápidas sem revisão genuína. mitigação documentada: uma lista de verificação de desafios e respostas que requer respostas positivas a perguntas específicas antes de o botão Aprovar ser ativado.

- "Entendes qual recurso é que isto toca?
- "Você verificou que o raio da explosão é aceitável?
- "Tem um plano de retrocesso se isto falhar?

O revisor que não pode marcar as caixas quer pede esclarecimento (escalação) ou recusa (default seguro). A pesquisa Anthropic agente-segurança cita explicitamente HITL de lista de verificação como uma mitigação para padrões de aprovação de selos de borracha.

### O que é consequente

Não todas as acções precisam de propostas e compromissos.

- **Consequential actions**(sempre HITL): registos irreversíveis, transacções financeiras, comunicação de saída, alterações na base de dados de produção, operações destrutivas do sistema de arquivos.
- **Reversible actions**(às vezes HITL): edições de arquivos locais, mudanças de env em fase, gravações reversíveis com retrocesso claro.
- **Reads and inspections**(never HITL): ler um arquivo, listar recursos, chamar uma API somente leitura.

### Verificação pós-ação

"A execução de commit" não é a mesma que "o efeito colateral aconteceu". Condições de partição de rede e corrida podem produzir um fluxo de trabalho que acha que foi bem sucedido enquanto o backend não persistiu. A etapa de verificação lê novamente o recurso alvo após o compromisso de confirmar. Este é o mesmo padrão que as transações de banco de dados com `RETURNING`cláusulas ou AWS `GetObject`Depois`PutObject`- Não .

### Lei da UE sobre IA Artigo 14

O artigo 14.o exige uma supervisão humana eficaz de sistemas de IA de alto risco na UE. "Efectivo" não é decorativo. A linguagem regulatória exclui especificamente padrões de selos de borracha. Proporcionar-depois-comprometer com desafio-e-resposta é a forma que sobrevive ao escrutínio do artigo 14.o nos documentos de conformidade do Kit de ferramentas de governança de agentes da Microsoft.

```figure
mx-propose-then-commit
```

## Usá-lo

`code/main.py`Implementa uma máquina de estado de proposta-depois-comitamento em stdlib Python. Armazenamento durável é um arquivo JSON. A chave de idempotency é um hash de (thread_id, action_signature). O driver simula três casos: um fluxo de aprovação limpo, uma retempta após falha transitória (que não deve ser executada duplamente) e um selo de borracha padrão versus um fluxo de desafio e resposta.

## Envia-o

`outputs/skill-hitl-design.md`Revisar um fluxo de trabalho HITL proposto para propor a forma e a forma de compromisso e sinalizar as camadas de metadados, de independência, de verificação ou de desafios e respostas que faltam.

## Exercícios

1. Corra .`code/main.py`- Confirmar que uma nova tentativa de uma proposta aprovada utiliza o registro duradouro e não re-executa.

2. Extender o registro das propostas com uma `rollback`Simula uma execução cuja etapa de verificação falha. Mostre o tiro de volta automático.

3. Leia o Microsoft Agent Framework `RequestInfoEvent`Identifique um campo de metadados que a API inclui que a máquina de brinquedo está faltando.

4. Desenhar uma lista de verificação de desafios e respostas para uma ação específica (por exemplo, "postar em uma conta pública no Twitter").

5. Escolha um caso em que uma pergunta sincrônica "Aplicar?" seria suficiente (não é necessária uma loja duradoura). Explique por que, e nome a classe de risco que você está aceitando.

## Termos-chave

| Term | What people say | What it actually means |
|---|---|---|
| Propose-then-commit | "Two-phase approval" | Persisted proposal + positive commit + verify |
| Idempotency key | "Retry-safe token" | Unique per proposal; second execution no-ops |
| Data lineage | "Where it came from" | The specific source content that led to the proposal |
| Blast radius | "Worst case" | Scope of effect if the action goes wrong |
| Rubber-stamp | "Fast approval" | "Approve" clicked without genuine review |
| Challenge-and-response | "Forcing checklist" | Reviewer must positively acknowledge specific questions |
| RequestInfoEvent | "MS Agent Framework primitive" | Durable HITL request with structured metadata |
| `interrupt()` / `waitForApproval()` | "Framework primitives" | LangGraph / Cloudflare equivalents of the same shape |

## Mais leitura

- [Microsoft Agent Framework — Human in the loop](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop)- Não .`RequestInfoEvent`, aprovações duradouras.
- [Cloudflare Agents — Human in the loop](https://developers.cloudflare.com/agents/concepts/human-in-the-loop/)- Não .`waitForApproval()`e objetos duráveis.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) HITL como mitigação do risco de longo prazo.
- [EU AI Act — Article 14: Human oversight](https://artificialintelligenceact.eu/article/14/) Linha de base regulatória para sistemas de alto risco.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) enquadramento constitucional em torno da supervisão.
