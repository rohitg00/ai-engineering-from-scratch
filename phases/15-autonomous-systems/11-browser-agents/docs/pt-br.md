# Agents de Navegador e Tarefas Web de Longo Prazo

> ChatGPT agente (julho de 2025) uniu Operator e deep research em um único agente navegador/terminal e alcançou SOTA no BrowseComp com 68.9%. A OpenAI desligou o Operator em 31 de agosto de 2025 — consolidação na camada de produto. A aquisição da Vercept pela Anthropic moveu o Claude Sonnet no OSWorld de abaixo de 15% para 72.5%. WebArena-Verified (ServiceNow, ICLR 2026) corrigiu 11.3 pontos percentuais de taxa de falso-negativo no WebArena original e lançou o subconjunto Hard de 258 tarefas. Os números são reais. A superfície de ataque também: o head de preparação da OpenAI afirmou publicamente que injeção indireta de prompt em agentes de navegador "não é um bug que pode ser totalmente corrigido." Ataques documentados em 2025–2026: Tainted Memories (Atlas CSRF), HashJack (Cato Networks) e sequestros de um clique no Perplexity Comet.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, modelo de superfície de ataque de injeção indireta de prompt)
**Pré-requisitos:** Fase 15 · 10 (Modos de permissão), Fase 15 · 01 (Agents de longo prazo)
**Tempo:** ~45 minutos

## O Problema

Um agente de navegador é um agente de longo prazo que lê conteúdo não confiável e toma ações consequenciais. Cada página que o agente visita é uma entrada que o usuário não escreveu. Cada formulário em cada página é um potencial canal de comando. O corpus de ataques de 2025–2026 mostra que isso não é hipotético: Tainted Memories permite que um ator malicioso vincule instruções maliciosas à memória do agente através de uma página fabricada; HashJack esconde comandos em fragmentos de URL que o agente visita; sequestros no Perplexity Comet acontecem em um único clique.

O cenário defensivo é desconfortável. O head de preparação da OpenAI disse em voz alta o que ficava baixinho: injeção indireta de prompt "não é um bug que pode ser totalmente corrigido." Isso porque o ataque vive na fronteira de leitura-ação do agent, que é arquiteturalmente difusa — cada token que o modelo lê poderia, em princípio, ser lido como uma instrução.

Esta aula nomeia a superfície de ataque, nomeia o panorama de benchmarks (BrowseComp, OSWorld, WebArena-Verified) e modela um cenário mínimo de injeção indireta de prompt para que você possa raciocinar sobre defesas reais nas Aulas 14 e 18.

## O Conceito

### O panorama de 2026, um parágrafo por sistema

**ChatGPT agente (OpenAI).** Lançado em julho de 2025. Unifica Operator (navegação) e Deep Research (pesquisa de horas). Desligou o Operator standalone em 31 de agosto de 2025. SOTA no BrowseComp com 68.9%; números fortes no OSWorld e WebArena-Verified.

**Claude Sonnet + Vercept (Anthropic).** A aquisição da Vercept pela Anthropic focou em capacidades de uso de computador. Moveu o Claude Sonnet no OSWorld de <15% para 72.5. Claude Computer Use é disponibilizado como API de ferramenta.

**Gemini 3 Pro com Browser Use (DeepMind).** A integração Browser Use disponibiliza controles de uso de computador; FSF v3 (abril de 2026, Aula 20) rastreia autonomia eespecificaçãoificamente no domínio ML R&D.

**WebArena-Verified (ServiceNow, ICLR 2026).** Corrige um problema bem documentado: o WebArena original tinha ~13.5% de taxa de falso-negativo (tarefas marcadas como falha que na verdade foram resolvidas). O release Verified re-avalia com critérios de sucesso curados por humanos e adiciona um subconjunto Hard de 258 tarefas (paper ICLR 2026, openreview.net/forum?id=94tlGxmqkN).

### BrowseComp vs OSWorld vs WebArena

| Benchmark | O que mede | Horizonte |
|---|---|---|
| BrowseComp | Encontrar fatos eespecificaçãoíficos na web aberta sob pressão de tempo | minutos |
| OSWorld | Agent operando um desktop completo (mouse, teclado, shell) | dezenas de minutos |
| WebArena-Verified | Tarefas web transacionais em sites simulados | minutos |
| Subconjunto Hard | Tarefas WebArena-Verified com transições de estado multi-página | dezenas de minutos |

Eixos diferentes. Um score alto no BrowseComp diz que o agente encontra fatos; não diz que o agente consegue reservar um voo. O score do OSWorld é mais próximo de "funciona no meu desktop." WebArena-Verified é mais próximo de "consegue terminar um fluxo." Qualquer decisão de produção precisa do benchmark que combina com a distribuição de tarefas.

### A superfície de ataque, nomeada

1. **Injeção indireta de prompt.** Conteúdo não confiável de página contém instruções. O agente lê. O agente executa. Exemplos públicos: Kai Greshake et al. 2024, paper Tainted Memories 2025, HashJack (Cato Networks) 2026.
2. **Injeção de fragmento de URL / consulta.** O `#fragment` ou consulta string de uma URL crawlada contém comandos. Nunca renderizado visivelmente; ainda dentro do contexto do agent.
3. **Ataques de vínculo de memória.** Página instrui o agente a escrever uma memória persistente (Aula 12 cobre estado durável). Na próxima sessão, a memória dispara o payload sem gatilho visível.
4. **Ataques CSRF em sessões autenticadas.** Classe Tainted Memories: agente está logado em algum lugar; página do ator malicioso emite requisições que alteram estado que o agente executa com os cookies do usuário.
5. **Sequestro de um clique.** Botão visualmente inocente carrega um payload que o agente segue. Classe Comet.
6. **Falhas de Content-Security-Policy na superfície host do agent.** As camadas de renderização e ferramentas podem ser vetores de ataque; a stack navegador-em-agent-de-navegador é ampla.

### Por que "não totalmente corrigível"

O ataque é isomórfico à capacidade do agent. O agente precisa ler conteúdo não confiável para fazer seu trabalho. Qualquer conteúdo que o agente ler pode conter instruções. Qualquer instrução que o agente seguir pode estar em desalinhamento com a solicitação real do usuário. Defesas (limites de confiança, classificadores, allowlists de ferramentas, HITL em ações consequenciais) aumentam o custo do ataque e reduzem seu raio de explosão. Não fecham a classe.

Esse é o mesmo padrão de raciocínio que o teorema de Löb (Aula 8): o agente não consegue provar que o próximo token é seguro; só consegue montar um sistema onde tokens inseguros são mais detectáveis.

### Postura defensiva que realmente é implantada

- **Limite de leitura/escrita.** Ler nunca é consequencial. Escrever (submeter formulário, postar conteúdo, chamar ferramenta com efeitos colaterais) requer aprovação humana fresca se o conteúdo que iniciou veio de fora do limite de confiança.
- **Allowlist de ferramenta por tarefa.** O agente pode navegar; não pode iniciar uma transferência bancária a menos que essa ferramenta tenha sido habilitada explicitamente para a tarefa. Aula 13 cobre orçamentos.
- **Isolamento de sessão.** Sessões de agente de navegador rodam com credenciais com escopo apenas. Sem auth de produção, sem email pessoal. Logs de cada requisição HTTP retidos para auditoria.
- **Sanitizador de conteúdo.** HTML capturado é limpo de padrões conhecidos-mau antes de ser concatenado ao contexto do modelo. (Reduz ataques fáceis; não para payloads sofisticados.)
- **HITL em ações consequenciais.** Padrão proposta-então-commit (Aula 15).
- **Tokens canary na memória.** Se uma entrada de memória disparar, o usuário vê (Aula 14).

## Use

`code/main.py` modela uma mini execução de agente de navegador contra três páginas sintéticas. Uma é benigna, uma tem um blob de injeção direta de prompt em texto visível, uma tem injeção de fragmento de URL (não visível mas dentro do contexto do agent). O script mostra (a) o que um agente inocente faria, (b) o que o limite leitura/escrita pega, (c) o que o sanitizador pega, (d) o que nenhum pega.

## Entregue

`outputs/skill-browser-agent-trust-boundary.md` delimita o escopo de um implantação de agente de navegador proposto: quais zonas de confiança ele toca, o que está autorizado a escrever, e quais defesas devem estar no lugar antes da primeira execução.

## Exercícios

1. Rode `code/main.py`. Identifique qual ataque o sanitizador pega mas o limite leitura/escrita não pega, e qual ataque somente o limite leitura/escrita pega.

2. Estenda o sanitizador para detectar uma classe de injeção de fragmento de URL no estilo HashJack. Meça a taxa de falso positivo em URLs benignas com fragmentos legítimos.

3. Escolha um fluxo de trabalho real de agente de navegador que você conheça (ex: "reservar um voo"). Liste cada leitura e cada escrita. Marque quais escritas precisam de HITL e por quê.

4. Leia o paper WebArena-Verified do ICLR 2026. Identifique uma categoria de tarefa onde a pontuação do WebArena original era instável e explique como o subconjunto Verified resolve.

5. Projete um canary de memória para um cenário de agente de navegador. O que você armazenaria, onde, e o que dispara o alarme?

## Termos-Chave

| Termo | O que dizem | O que significa de verdade |
|---|---|---|
| Injeção indireta de prompt | "Texto ruim na página" | Conteúdo não confiável em uma página que o agente lê contém instruções que o agente executa |
| Tainted Memories | "Ataque de memória" | Agent escreve instrução fornecida pelo ator malicioso em memória persistente; dispara na próxima sessão |
| HashJack | "Ataque de fragmento de URL" | Payload escondido em fragmento de URL / consulta string está no contexto do agente mas não é renderizado visivelmente |
| Sequestro de um clique | "Botão ruim" | Elemento visual inocente carrega payload subsequente que o agente executa |
| BrowseComp | "Benchmark de busca web" | Encontrar fatos eespecificaçãoíficos na web aberta; horizonte de minutos |
| OSWorld | "Benchmark de desktop" | Controle completo de OS; tarefas GUI multi-passo |
| WebArena-Verified | "Benchmark de tarefas web corrigido" | WebArena re-avaliada pela ServiceNow com subconjunto Hard |
| Limite leitura/escrita | "Gate de efeito colateral" | Ler nunca é consequencial; escrever requer aprovação fresca se conteúdo é fora da confiança |

## Leituras Adicionais

- [OpenAI — Introducing ChatGPT agent](https://openai.com/index/introducing-chatgpt-agent/) — fusão de Operator e deep research; SOTA no BrowseComp.
- [OpenAI — Computer-Using Agent](https://openai.com/index/computer-using-agent/) — linhagem do Operator e arquitetura que se tornou ChatGPT agent.
- [Zhou et al. — WebArena](https://webarena.dev/) — o benchmark original.
- [WebArena-Verified (OpenReview)](https://openreview.net/forum?id=94tlGxmqkN) — paper ICLR 2026 do subconjunto corrigido.
- [Anthropic — Measuring agente autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — inclui discussão de superfície de ataque para agentes de uso de computador.
