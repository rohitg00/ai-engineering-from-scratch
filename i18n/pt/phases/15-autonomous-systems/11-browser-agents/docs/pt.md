# Agentes de navegador e tarefas da Web de longo prazo

> O agente ChatGPT (julho de 2025) combinou o Operador e a pesquisa profunda em um único agente do navegador/terminal e estabeleceu o BrowseComp SOTA em 68,9%. A OpenAI fechou a Operator em 31 de agosto de 2025  consolidação na camada de produto. A aquisição da Vercept da Anthropic levou Claude Sonnet no OSWorld de menos de 15% para 72,5%. WebArena-Verified (ServiceNow, ICLR 2026) fixou a taxa de falsos negativos de ~11.3% na WebArena original e enviou o subconjunto Hard de 258 tarefas. Os números são reais. Assim como a superfície do ataque: o chefe de preparação da OpenAI declarou publicamente que a injeção direta direta de um agente de navegador "não é um bug que possa ser totalmente corrigido". Ataques documentados 20252026: Memórias contaminadas (Atlas CSRF), HashJack (Cato Networks), e sequestros de um clique no Perplexity Comet.

**Type:** Learn
**Languages:** Python (stdlib, indirect prompt-injection attack surface model), TypeScript
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 01 (Long-horizon agents)
**Time:** ~45 minutes

## O problema

Um agente de navegador é um agente de longo horizonte que lê conteúdo não confiável e toma ações consequentes. Cada página que o agente visita é uma entrada que o usuário não escreveu. Cada formulário em cada página é um potencial canal de comando. O corpus de ataque 20252026 mostra que isso não é hipotético: Memórias contaminadas permite que um atacante enlace instruções maliciosas à memória do agente através de uma página criada; HashJack esconde comandos em fragmentos de URL que o agente visita; Perplexity Comet hijacks tomam um único clique.

O quadro defensivo é desconfortável. O chefe de preparação da OpenAI disse que a parte silenciosa é alta: a injeção direta direta "não é um bug que possa ser totalmente corrigido". Isso ocorre porque o ataque vive na fronteira leitura-versus-ação do agente, que é arquitetonicamente confusa.

Esta lição nomeia a superfície de ataque, nomeia a paisagem de referência (BrowseComp, OSWorld, WebArena-Verified), e modela um cenário mínimo de injeção indireta-imprenta para que você possa raciocinar sobre defesas reais nas lições 14 e 18.

## O conceito

### A paisagem de 2026, num parágrafo por sistema

**ChatGPT agent (OpenAI).**Lançado em julho de 2025. Unifica Operador (navegamento) e Pesquisa Profunda (pesquisa de várias horas). Fechou o Operador independente em 31 de agosto de 2025. SOTA em BrowseComp em 68,9%; números fortes em OSWorld e WebArena-Verified.

**Claude Sonnet + Vercept (Anthropic).**A aquisição da Vercept da Anthropic focou nas capacidades de uso de computadores. Moveu Claude Sonnet no OSWorld de <15% para 72,5%.

**Gemini 3 Pro with Browser Use (DeepMind).**O navegador Usa integração navega controles de uso de computador; FSF v3 (abril de 2026, lição 20) rastreia autonomia no domínio de P&D do ML especificamente.

**WebArena-Verified (ServiceNow, ICLR 2026).**Corrige um problema bem documentado: o WebArena original tinha ~ 11,3% taxa de falsos negativos (tarefas marcadas falharam que foram realmente resolvidas). A versão Verified re-classifica com critérios de sucesso curados pelo homem e adiciona um subconjunto Hard de 258 tarefas (papel ICLR 2026, openreview.net/forum?id=94tlGxmqkN).

### BrowseComp vs OSWorld vs WebArena

| Benchmark | What it measures | Horizon |
|---|---|---|
| BrowseComp | Finding specific facts on the open web under time pressure | minutes |
| OSWorld | Agent operating a full desktop (mouse, keyboard, shell) | tens of minutes |
| WebArena-Verified | Transactional web tasks in simulated sites | minutes |
| Hard subset | WebArena-Verified tasks with multi-page state transitions | tens of minutes |

Os resultados da WebArena-Verified são mais próximos de "pode terminar um fluxo". Qualquer decisão de produção precisa de um índice de referência que corresponda à distribuição de tarefas.

### A superfície de ataque, chamada

1. **Indirect prompt injection.**O conteúdo da página não confiável contém instruções. O agente as lê. O agente as executa. Exemplos públicos: 2024 Kai Greshake et al., 2025 Tainted Memories paper, 2026 HashJack (Cato Networks).
2. **URL fragment / query injection.**O `#fragment`ou uma cadeia de consulta de uma URL rastreada contém comandos. Nunca renderado visível; ainda dentro do contexto do agente.
3. **Memory-binding attacks.**A página instrui o agente a escrever uma memória persistente (a lição 12 abrange o estado duradouro).
4. **CSRF-shaped attacks on authenticated sessions.**Classe Memórias contaminadas: o agente está conectado em algum lugar; a página do atacante emite pedidos de mudança de estado que o agente executa com os cookies do usuário.
5. **One-click hijack.**Um botão visualmente inofensivo transporta uma carga útil que o agente segue.
6. **Content-Security-Policy holes in the agent's host surface.**As camadas de renderização e ferramentas podem ser vetores de ataque; a pilha de agente de navegador em um navegador é ampla.

### Por que "não é totalmente corrigível"

O ataque é isomorfo à capacidade do agente. O agente deve ler conteúdo não confiável para fazer o seu trabalho. Qualquer conteúdo que o agente leia pode conter instruções. Qualquer instrução que o agente siga pode ser desalinhada com a solicitação real do usuário. As defesas (limite de confiança, classificadores, alistadores de ferramentas, HITL sobre ações consequentes) aumentam o custo do ataque e reduzem o seu raio de explosão. Não fecham a aula.

Este é o mesmo padrão de raciocínio que o teorema de Lob (Lessão 8): o agente não pode provar que o próximo token é seguro; ele só pode configurar um sistema onde os tokens inseguros são mais detectáveis.

### Posição de defesa que realmente navega

- **Read / write boundary.**A leitura nunca é consequente. A escrita (submissão de um formulário, publicação de conteúdo, chamada de uma ferramenta com efeitos colaterais) requer a aprovação humana se o conteúdo iniciante vier de fora dos limites da confiança.
- **Tool allowlist per task.**O agente pode navegar; não pode iniciar uma transferência bancária a menos que essa ferramenta tenha sido explicitamente habilitada para a tarefa.
- **Session isolation.**As sessões de agente do navegador são executadas apenas com credenciais de alcance.
- **Content sanitizer.**O HTML extraído é despojado de padrões conhecidos antes de ser concatenado no contexto do modelo. (Reduz os ataques fáceis; não interrompe cargas úteis sofisticadas.)
- **HITL on consequential actions.**Padrão de proposta e de compromisso (Lessão 15).
- **Canary tokens on memory.**Se uma entrada de memória for acesa, o usuário vê-la (Lessão 14).

```figure
injection-boundary
```

## Usá-lo

`code/main.py`O script mostra (a) o que um agente ingênuo faria, (b) o que uma fronteira de leitura / escrita pega, (c) o que um desinfetador pega, (d) o que nenhum deles pega.

## Envia-o

`outputs/skill-browser-agent-trust-boundary.md`O programa de segurança de um navegador é um programa de segurança de base que permite a utilização de um navegador de base.

## Exercícios

1. Corra .`code/main.py`. Identificar quais são os ataques que o desinfectante capta, mas não o limite de leitura/escritura, e quais são os ataques que só captam o limite de leitura/escritura.

2. Estender o desinfectante para detectar uma classe de injecção de fragmentos de URL no estilo HashJack.

3. Escolha um fluxo de trabalho de um agente de navegador que você conheça (por exemplo, "reservar um voo"). Enumere cada leitura e cada escrita.

4. Leia o documento ICLR 2026 verificado pela WebArena. Identifique uma categoria de tarefa em que a pontuação original da WebArena não era confiável e explique como o subconjunto verificado resolve isso.

5. Desenhe um canário de memória para uma configuração de agente do navegador.

## Termos-chave

| Term | What people say | What it actually means |
|---|---|---|
| Indirect prompt injection | "Bad page text" | Untrusted content in a page the agent reads contains instructions the agent executes |
| Tainted Memories | "Memory attack" | Agent writes an attacker-supplied instruction to durable memory; triggered next session |
| HashJack | "URL fragment attack" | Payload hidden in URL fragment / query string is in the agent's context but not visibly rendered |
| One-click hijack | "Bad button" | Visible affordance rides a follow-on payload the agent executes |
| BrowseComp | "Web search benchmark" | Finding specific facts on the open web; minute-scale horizon |
| OSWorld | "Desktop benchmark" | Full OS control; multi-step GUI tasks |
| WebArena-Verified | "Fixed web-task benchmark" | ServiceNow's regraded WebArena with Hard subset |
| Read/write boundary | "Side-effect gate" | Reading never consequential; writing requires fresh approval if content is out-of-trust |

## Mais leitura

- [OpenAI — Introducing ChatGPT agent](https://openai.com/index/introducing-chatgpt-agent/) fusão de Operação e investigação profunda; BrowseComp SOTA.
- [OpenAI — Computer-Using Agent](https://openai.com/index/computer-using-agent/) a linhagem do Operador e a arquitetura que se tornou agente do ChatGPT.
- [Zhou et al. — WebArena](https://webarena.dev/) o índice de referência original.
- [WebArena-Verified (OpenReview)](https://openreview.net/forum?id=94tlGxmqkN) Papel ICLR 2026 de subconjunto fixo.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) inclui discussão sobre a superfície de ataque para agentes de uso de computadores.
