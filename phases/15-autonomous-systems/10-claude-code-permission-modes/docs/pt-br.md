# Claude Code como Agent Autônomo: Modos de Permissão e Auto Mode

> Claude Code expõe sete modos de permissão. "plan" pergunta antes de cada ação, "default" pergunta apenas para as arriscadas, "acceptEdits" auto-aprova escritas de arquivo mas ainda confirma execução de shell, e "bypassPermissions" aprova tudo. Auto Mode (24 de março de 2026) substitui aprovação por ação com um classificador de segurança paralelo de dois estágios: uma verificação rápida de um token roda em cada ação; ações sinalizadas iniciam uma revisão profunda de cadeia de raciocínio. Orçamentos de ação são aplicados via `max_turns` e `max_budget_usd`. Auto Mode foi lançado como preview de pesquisa — a Anthropic afirmou explicitamente que o classificador sozinho não é suficiente.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, simulador de classificador de dois estágios)
**Pré-requisitos:** Fase 15 · 01 (Agents de longo prazo), Fase 15 · 09 (Panorama de agents de codificação)
**Tempo:** ~45 minutos

## O Problema

Um agent de codificação autônomo na sua máquina é uma categoria de segurança distinta. A superfície de ataque é tudo que o agent pode alcançar — sistema de arquivos, rede, credenciais, clipboard, qualquer aba do navegador, qualquer terminal aberto. Bruce Schneier e outros sinalizaram isso publicamente: agents de uso de computador não são uma "atualização de feature" de chatbots, são um novo tipo de ferramenta com um novo tipo de perfil de risco.

O sistema de permissões do Claude Code é a resposta da Anthropic. Em vez de um único interruptor "autônomo / não autônomo", existem sete modos que cobrem uma escala de capacidade: plan → default → acceptEdits → … → bypassPermissions. Cada modo é um tradeoff diferente entre velocidade e revisão-por-ação. Auto Mode (março de 2026) adiciona um classificador de dois estágios que tira a aprovação do caminho crítico do usuário para ações que o classificador julga seguras, preservando uma camada de revisão para ações que o classificador sinaliza.

A questão de engenhara: o que este sistema pega, o que ele perde, e qual modo uma tarefa específica realmente merece?

## O Conceito

### Os sete modos de permissão

| Modo | Comportamento | Quando usar |
|---|---|---|
| `plan` | Agent propõe um plano; usuário aprova o plano inteiro; cada ação é revisada antes da execução | Tarefa desconhecida; código próximo a produção; primeira vez usando o agent em um repo |
| `default` | Agent roda ações; pergunta ao usuário para qualquer ação "arriscada" (execução de shell, operações destrutivas, chamadas de rede) | Sessões interativas de codificação na maioria |
| `acceptEdits` | Escritas de arquivo são auto-aprovadas; execução de shell e chamadas de rede ainda pedem | Passagem de refatoração em muitos arquivos |
| `acceptExec` | Comandos de shell são auto-aprovados dentro de uma allowlist curada; escritas auto-aprovam | Loops internos apertados onde cada comando é `npm test` ou similar |
| `autoMode` | Classificador de segurança de dois estágios; ações sinalizadas sobem para revisão | Execuções de longo prazo não assistidas em workspace restrito |
| `yolo` | Pula a maioria dos prompts; ainda roda allowlist/denylist de ferramentas | Sandboxes efêmeros, jobs de CI, scripts de pesquisa |
| `bypassPermissions` | Aprova tudo | Documentado como "somente dentro de containers efêmeros que você está disposto a descartar" |

(Nomes acima combinam com docs públicas do Claude Code; "yolo" é a abreviação informal para o meio-termo permissivo.)

### Auto Mode em uma página

Auto Mode (lançado em 24 de março de 2026) é o primeiro modo de permissão a delegar aprovação por ação a um modelo. Estrutura:

1. **Estágio 1 — classificador de um token.** Roda em cada ação proposta. Barato. Retorna "seguro" ou "sinalizado". Projetado para rodar em paralelo com o loop principal do agent para que ações aprovadas não fiquem em fila.
2. **Estágio 2 — revisão secundária de política/segurança.** Roda apenas em ações sinalizadas. Faz uma avaliação focada de política e segurança sobre a estado atual da sessão e a tarefa declarada. Escala para HITL humano se a confiança for baixa.

Controles de orçamento ficam ao lado do classificador:

- `max_turns` — iterações totais em uma sessão.
- `max_budget_usd` — limite em dólares que aborta a sessão.
- limites de contagem de ação por ferramenta (no máximo N chamadas de `WebFetch`, etc.).

### O que o sistema pega

- Injeção direta de prompt em entradas de ferramenta onde a instrução injetada mapeia para uma forma de ação arriscada conhecida.
- Loops repetitivos de ferramenta — o classificador pode ver que a ação N+1 é quase idêntica à ação N, cinco vezes seguidas.
- Comandos de shell claramente fora do escopo em uma sessão de edição de arquivo.

### O que o sistema pode perder

- **Injeção sutil de prompt** que modula comportamento sem produzir uma única ação sinalizada. Injeção indireta de prompt não é uma vulnerabilidade totalmente corrigível (head de preparação da OpenAI, 2025, sobre agents de navegador — veja Aula 11).
- **Mau comportamento em nível semântico.** Cada ação individual pode parecer segura enquanto a trajetória composta é prejudicial. O classificador julga a ação; não re-deriva a intenção do usuário.
- **Exfiltração através de canais legítimos.** Escrever dados em um arquivo que você possui, depois fazer `git push` para um repo público, é uma sequência de ações permitidas cuja composição é o problema.

### Enquadramento de preview de pesquisa

A Anthropic lançou Auto Mode como preview de pesquisa. A documentação é explícita de que o classificador é uma camada, não uma solução: espera-se que usuários combinem Auto Mode com orçamentos, allowlists, workspaces isolados e auditorias de trajetória (Aulas 12–16). O enquadramento de preview também reflete a lacuna documentada de eval-vs-deploy (Aula 1) — um classificador que passa evals offline pode se comportar diferente em uma sessão real onde o contexto do usuário é ambíguo.

### Onde esta escala vive no seu fluxo

- Tarefa desconhecida: comece em `plan`. Ler o plano é mais barato que reverter uma execução ruim.
- Refatoração conhecida: `acceptEdits` economiza muitos cliques de confirmação.
- Execução de fundo não assistida: `autoMode` somente dentro de um workspace cujo raio de explosão você mediu (sem credenciais, sem mounts de produção, sem egress que você não optou).
- Containers efêmeros: `yolo` / `bypassPermissions` é aceitável se, e somente se, o container e suas credenciais forem descartáveis.

## Use

`code/main.py` simula o classificador de dois estágios. Estágio 1 é uma regra de palavras-chave barata sobre ações propostas; Estágio 2 é um revisor multi-regra mais lento. O driver alimenta uma curta trajetória sintética (ações seguras, tentativa de injeção de prompt, loop repetitivo) e mostra onde o classificador pega e onde perde.

## Entregue

`outputs/skill-permission-mode-picker.md` combina uma descrição de tarefa com o modo de permissão certo, limites de orçamento e isolamento necessário.

## Exercícios

1. Rode `code/main.py`. Qual tipo de ação sintética nunca é sinalizada pelo Estágio 1 mas sempre pega pelo Estágio 2? Qual não é pega por nenhum?

2. Estenda o conjunto de regras do Estágio 1 para pegar uma forma específica conhecida-mau (ex: `curl $ATTACKER/exfil`). Meça a taxa de falso positivo na amostra de ações benignas.

3. Leia a doc "How the agent loop works" da Anthropic. Liste cada estado externo que o agent toca por padrão no modo `default`. Qual você precisaria controlar separadamente antes de rodar `autoMode` sem assistência?

4. Projete um orçamento para execução de 24 horas sem assistência: `max_turns`, `max_budget_usd`, limites por ferramenta, allowlists. Justifique cada número.

5. Descreva uma trajetória onde cada ação individual é aprovada pelo Estágio 1 e Estágio 2, mas o comportamento composto é desalinhado. (Aula 14 cobre como interruptores de emergência e tokens canary lidam com isso.)

## Termos-Chave

| Termo | O que dizem | O que significa de verdade |
|---|---|---|
| Modo de permissão | "Quanto o agent pode fazer" | Uma das sete políticas nomeadas que controlam aprovação por ação |
| Modo plan | "Perguntar antes de qualquer coisa" | Agent escreve um plano; usuário aprova antes da execução |
| acceptEdits | "Deixar escrever arquivos" | Escritas de arquivo auto-aprovam; execução de shell ainda pede |
| autoMode | "Aprovações automáticas" | Classificador de segurança de dois estágios; ações sinalizadas sobem |
| bypassPermissions | "YOLO completo" | Aprova tudo; destinado a containers efêmeros |
| Classificador estágio 1 | "Verificação rápida por token" | Regla de um token sobre ação proposta; roda em paralelo |
| Classificador estágio 2 | "Revisão profunda" | Raciocínio de cadeia de raciocínio sobre ações sinalizadas |
| Preview de pesquisa | "Não é GA" | Enquadramento da Anthropic para features cujo modo de falha ainda está sendo mapeado |

## Leituras Adicionais

- [Anthropic — How the agent loop works](https://code.claude.com/docs/en/agent-sdk/agent-loop) — modos de permissão, orçamentos, formato de ação.
- [Anthropic — Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) — modelo de execução de serviço gerenciado.
- [Anthropic — Claude Code product page](https://www.anthropic.com/product/claude-code) — superfície de features e anúncio do Auto Mode.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) — a camada baseada em raciocínio que molda os julgamentos do classificador.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — perspectiva interna sobre design de permissão de longo prazo.
