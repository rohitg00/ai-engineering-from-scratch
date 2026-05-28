# Human-in-the-Loop: Proposta-Então-Commit

> O consenso de 2026 sobre HITL é eespecificaçãoífico. Não é "o agente pergunta, o usuário clica Aprovar." É proposta-então-commit: a ação proposta é persistida em um armazenamento durable com uma chave de idempotência; apresentada a um revisor com intenção, linhagem de dados, permissões tocadas, raio de explosão e um plano de rollback; comprometida somente após reconhecimento positivo; verificada após a execução para confirmar que o efeito colateral realmente aconteceu. `interrupt()` do LangGraph mais checkpointing em PostgreSQL, `RequestInfoEvent` do Microsoft Agent Framework e `waitForApproval()` do Cloudflare implementam todos a mesma forma. O modo de falha canônico é a aprovação de carimbo de borracha: "Aprovar?" é clicado sem revisão. A mitigação documentada é pergunta-e-resposta com uma checklist explícita.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, máquina de estados proposta-então-commit com idempotência)
**Pré-requisitos:** Fase 15 · 12 (Execução durable), Fase 15 · 14 (Tripwires)
**Tempo:** ~60 minutos

## O Problema

Um agente toma uma ação. O usuário tem que decidir: aprovar ou não. Se a decisão é instantânea, provavelmente não é uma revisão. Se a decisão é estruturada, é lenta mas confiável. A questão de engenhara é como tornar uma revisão estruturada o caminho de menor resistência.

O padrão HITL da era de 2023 era um prompt síncrono: "Agent quer enviar email para X com corpo Y — aprovar?" O usuário clica Aprovar. Todo mundo sente que o sistema é seguro. Na prática esta superfície é fortemente carimbada de borracha: usuários aprovam rápido, aprovações predizem pouco, e quando o agente dá errado, a trilha de auditoria mostra um longo histórico de aprovações que o usuário não consegue lembrar.

O padrão de 2026 — proposta-então-commit — coloca HITL sobre um substrato durável, anexa metadados estruturados e exige commit positivo. Todo SDK de agente gerenciado entrega uma versão: `interrupt()` do LangGraph, `RequestInfoEvent` do Microsoft Agent Framework, `waitForApproval()` do Cloudflare. Os nomes da API diferem; a forma não.

## O Conceito

### A máquina de estados proposta-então-commit

1. **Propor.** Agent produz uma ação proposta. Persistida em armazenamento durable (PostgreSQL, Redis, Durable Object). Inclui:
   - intenção (por que o agente está fazendo isso)
   - linhagem de dados (qual fonte levou a esta proposta)
   - permissões tocadas (quais escopos / arquivos / endpoints)
   - raio de explosão (qual o pior caso)
   - plano de rollback (se comprometido, como desfazer)
   - chave de idempotência (única por proposta; re-submissão retorna o mesmo registro)
2. **Apresentar.** Revisor vê a proposta com todos os metadados. O revisor é uma pessoa (não o agente revisando a si mesmo).
3. **Comprometer.** Reconhecimento positivo. A ação executa.
4. **Verificar.** Após a execução, o efeito colateral é relido e confirmado. Se o passo de verificação falhar, o sistema está em um estado conhecido como ruim e alertas são acionados.

### A chave de idempotência

Sem uma chave de idempotência, um retry após uma falha transitória pode duplamente-executar uma ação aprovada. Exemplo concreto: usuário aprova "transferir $100 de A para B." Rede oscila. Workflow tenta novamente. O usuário aprovou uma vez mas a transferência executa duas vezes. A chave de idempotência vincula a aprovação a um único efeito colateral único; a segunda execução é um no-op.

Esse é o mesmo padrão de idempotência que Stripe e AWS APIs usam. Reutilizá-lo para aprovações de agente é explícito na documentação do Microsoft Agent Framework.

### Durabilidade: por que aprovações sobrevivem a processos

A sala de espera de aprovação é uma peça de estado que o agente não possui. O workflow está pausado (Aula 12). Quando a aprovação chega, o workflow resume exatamente naquele ponto. É por isso que LangGraph combina `interrupt()` com checkpointing em PostgreSQL e não apenas estado em memória — uma aprovação dois dias depois ainda encontra o workflow intacto.

### Aprovações de carimbo de borracha e a mitigação de pergunta-e-resposta

A UI padrão para HITL ("Aprovar" / "Rejeitar" botões) produz aprovações rápidas sem revisão genuína. Mitigação documentada: uma checklist de pergunta-e-resposta que exige respostas positivas a perguntas eespecificaçãoíficas antes que o botão Aprovar seja habilitado. Forma concreta:

- "Você entende em que recurso isso toca? [ ]"
- "Você verificou que o raio de explosão é aceitável? [ ]"
- "Você tem um plano de rollback se isso falhar? [ ]"

Não é burocracia por si — é uma função forçadora. O revisor que não consegue marcar as caixas ou pede esclarecimento (escalação) ou recusa (padrão seguro). A pesquisa de segurança de agente da Anthropic cita explicitamente HITL baseado em checklist como mitigação para padrões de aprovação de carimbo de borracha.

### O que conta como consequencial

Nem toda ação precisa de proposta-então-commit. A orientação de 2026:

- **Ações consequenciais** (sempre HITL): escritas irreversíveis, transações financeiras, comunicação externa, alterações em banco de dados de produção, operações destrutivas no sistema de arquivos.
- **Ações reversíveis** (às vezes HITL): edições em arquivos locais, alterações em ambiente de staging, escritas reversíveis com rollback claro.
- **Leituras e inspeções** (nunca HITL): ler um arquivo, listar recursos, chamar API somente-leitura.

### Verificação pós-ação

"O commit rodou" não é a mesma coisa que "o efeito colateral aconteceu." Partição de rede e condições de corrida podem produzir um workflow que acha que teve sucesso enquanto o backend não persistiu. O passo de verificação relê o recurso alvo após o commit para confirmar. Esse é o mesmo padrão que transações de banco com cláusulas `RETURNING` ou AWS `GetObject` após `PutObject`.

### EU AI Act Artigo 14

Artigo 14 exige supervisão humana efetiva para sistemas de IA de alto risco na UE. "Efetivo" não é decorativo. Linguagem regulatória exclui eespecificaçãoificamente padrões de carimbo de borracha. Proposta-então-commit com pergunta-e-resposta é a forma que sobrevive ao escrutínio do Artigo 14 nos documentos de conformidade do Microsoft Agent Governance Toolkit.

## Use

`code/main.py` implementa uma máquina de estados proposta-então-commit em Python stdlib. Armazenamento durable é um arquivo JSON. Chave de idempotência é um hash de (thread_id, action_signature). O driver simula três casos: fluxo de aprovação limpo, retry após falha transitória (que não deve duplamente-executar), e aprovação padrão de carimbo de borracha versus fluxo de pergunta-e-resposta.

## Entregue

`outputs/skill-hitl-design.md` revisa um workflow HITL proposto para forma proposta-então-commit e sinaliza metadados ausentes, idempotência, verificação ou camadas de pergunta-e-resposta.

## Exercícios

1. Rode `code/main.py`. Confirme que um retry de uma proposta aprovada usa o registro durable e não re-executa. Agora mude a chave de idempotência para incluir um timestamp e mostre que o retry duplamente-executa.

2. Estenda o registro da proposta com um campo `rollback`. Simule uma execução cujo passo de verificação falha. Mostre o rollback disparando automaticamente.

3. Leia a documentação de `RequestInfoEvent` do Microsoft Agent Framework. Identifique um campo de metadados que a API inclui que a engine de brinquedo não tem. Adicione e explique contra o que protege.

4. Projete uma checklist de pergunta-e-resposta para uma ação eespecificaçãoífica (ex: "postar em uma conta pública do Twitter"). Quais três perguntas o revisor deve responder? Por quê essas três?

5. Escolha um caso onde um prompt síncrono "Aprovar?" seria suficiente (sem necessidade de armazenamento durable). Explique por quê, e nomeie a classe de risco que você está aceitando.

## Termos-Chave

| Termo | O que dizem | O que significa de verdade |
|---|---|---|
| Proposta-então-commit | "Aprovação em duas fases" | Proposta persistida + commit positivo + verificação |
| Chave de idempotência | "Token seguro contra retry" | Única por proposta; segunda execução é no-op |
| Linhagem de dados | "De onde veio" | O conteúdo-fonte eespecificaçãoífico que levou à proposta |
| Raio de explosão | "Pior caso" | Escopo do efeito se a ação der errado |
| Carimbo de borracha | "Aprovação rápida" | "Aprovar" clicado sem revisão genuína |
| Pergunta-e-resposta | "Checklist forçadora" | Revisor deve reconhecer positivamente perguntas eespecificaçãoíficas |
| RequestInfoEvent | "Primitiva MS Agent Framework" | Pedido HITL durável com metadados estruturados |
| `interrupt()` / `waitForApproval()` | "Primitivas de framework" | Equivalente LangGraph / Cloudflare da mesma forma |

## Leituras Adicionais

- [Microsoft Agent Framework — Human in the loop](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) — `RequestInfoEvent`, aprovações duráveis.
- [Cloudflare Agents — Human in the loop](https://developers.cloudflare.com/agents/concepts/human-in-the-loop/) — `waitForApproval()` e Durable Objects.
- [Anthropic — Measuring agente autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — HITL como mitigação para risco de longo prazo.
- [EU AI Act — Article 14: Human oversight](https://artificialintelligenceact.eu/article/14/) — base regulatória para sistemas de alto risco.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) — enquadramento constitucional sobre supervisão.
