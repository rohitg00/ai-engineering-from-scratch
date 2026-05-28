# Bibliotecas de Skills e Aprendizado Contínuo (Voyager)

> Voyager (Wang et al., TMLR 2024) trata código executável como uma skill. Skills são nomeadas, recuperáveis, composáveis e refinadas por feedback do ambiente. Essa é a arquitetura de referência pra skills do Claude Agent SDK, skillkit e o padrão de skill-library de 2026.

**Tipo:** Construção
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 14 · 07 (MemGPT), Fase 14 · 08 (Letta Blocks)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Nomear os três componentes do Voyager — currículo automático, biblioteca de skills, prompting iterativo — e o papel de cada um.
- Explicar por que Voyager faz o espaço de ação ser código, não comandos primitivos.
- Implementar uma biblioteca de skills com stdlib com registro, recuperação, composição e refinamento orientado por falha.
- Mapear o padrão do Voyager pras skills do Claude Agent SDK de 2026 e o ecossistema skillkit.

## O Problema

Agents que reconstruem toda capacidade do zero em cada sessão fazem três coisas erradas:

1. **Desperdiçam tokens.** Cada tarefa re-elucida o mesmo raciocínio.
2. **Perdem progresso.** Uma correção aprendida na sessão A não transfere pra sessão B.
3. **Falham na composição de longo horizonte.** Tarefas complexas precisam de hierarquias de capacidade; prompts one-shot não conseguem expressá-las.

A resposta do Voyager: tratar cada capacidade reutilizável como um trecho de código nomeado armazenado numa biblioteca, recuperável por similaridade, composável com outras skills e refinada por feedback de execução.

## O Conceito

### Três componentes

Voyager (arXiv:2305.16291) estrutura um agent ao redor de:

1. **Currículo automático.** Um propositor guiado por curiosidade escolhe a próxima tarefa baseado no conjunto de skills atual do agent e no estado do ambiente. Exploração é bottom-up.
2. **Biblioteca de skills.** Cada skill é código executável. Novas skills são adicionadas quando uma tarefa dá certo. Skills são recuperadas por similaridade query-to-descrição.
3. **Mecanismo de prompting iterativo.** Em falha, o agent recebe erros de execução, feedback do ambiente e saída de auto-verificação, depois refina a skill.

A avaliação em Minecraft (Wang et al., 2024): 3.3x mais itens únicos, 8.5x mais rápido em ferramentas de pedra, 6.4x mais rápido em ferramentas de ferro, 2.3x mais percorrido no mapa versus baselines. Os números são específicos de Minecraft mas o padrão transfere.

### Espaço de ação = código

A maioria dos agents emite comandos primitivos. Voyager emite funções JavaScript. Uma skill é:

```
async function craftIronPickaxe(bot) {
  await mineIron(bot, 3);
  await mineStick(bot, 2);
  await placeCraftingTable(bot);
  await craft(bot, 'iron_pickaxe');
}
```

Composta de sub-skills. Armazenada com chave em descrição e embedding. Recuperada como programa, não como prompt.

Essa é a skill do Claude Agent SDK de 2026: um trecho de código nomeado e recuperável mais instruções que o agent carrega sob demanda.

### Recuperação de skills

Nova tarefa "fazer uma picareta de diamante." Agent:

1. Embute a descrição da tarefa.
2. Consulta a biblioteca de skills pelas top-k skills similares.
3. Recupera `craftIronPickaxe`, `mineDiamond`, `placeCraftingTable` etc.
4. Compõe a nova skill de primitivas recuperadas + nova lógica.

Esse é o padrão que recursos MCP (Fase 13) e skills do Agent SDK implementam: recuperação sobre uma superfície de conhecimento/código, escopada pra tarefa atual.

### Refinamento iterativo

Loop de feedback do Voyager:

1. Agent escreve uma skill.
2. Skill roda contra o ambiente.
3. Um de três sinais retorna: `success`, `error` (com stack trace), `self-verification failure`.
4. Agent reescreve a skill usando o sinal como contexto.
5. Loop até sucesso ou rodadas máximas.

Isso é Self-Refine (Aula 05) aplicado a geração de código com verificação ancorada no ambiente. CRITIC (Aula 05) é o mesmo padrão com ferramentas externas como verificador.

### Currículo e exploração

Módulo de currículo do Voyager propõe tarefas como "construir um abrigo perto do lago" baseado no que o agent tem e no que ele ainda não fez. O propositor usa o estado do ambiente + inventário de skills pra escolher uma tarefa logo acima da capacidade atual — o ponto doce da exploração.

Pra agents de produção isso se traduz num operador "o que tá faltando": dada a biblioteca atual de skills e um domínio, quais skills nós ainda não cobrimos? Times tipicamente implementam isso manualmente como revisão de currículo.

### Onde esse padrão dá errado

- **Decomposição da biblioteca de skills.** Mesma skill adicionada 10 vezes com descrições levemente diferentes. Adicione deduplicação na escrita; recuperação retorna só uma.
- **Deriva de skills compostas.** Skill pai depende de um filho que foi refinado. Versione skills; um pai fixado em v1 não puxa magicamente v3.
- **Qualidade de recuperação.** Recuperação vector sobre descrições de skills degrada conforme a biblioteca cresce pra além de algumas centenas. Complemente com filtros de tag e restrições rígidas ("só skills com `category=tooling`").

## Construa

`code/main.py` implementa uma biblioteca de skills com stdlib:

- `Skill` — nome, descrição, código (como string), versão, tags, dependências.
- `SkillLibrary` — registrar, buscar (sobreposição de token), compor (ordenação topológica de deps) e refinar (incremento de versão na atualização).
- Um agent programado que registra três skills primitivas, compõe uma quarta, encontra uma falha e refina.

Rode:

```
python3 code/main.py
```

O trace mostra escritas na biblioteca, recuperação, composição, uma execução falhada e uma refinação v2 — o loop do Voyager ponta a ponta.

## Use

- **Skills do Claude Agent SDK** (Anthropic) — referência de 2026: cada skill tem descrição, código e instruções; carregadas sob demanda durante sessão de agent.
- **skillkit** (npm: skillkit) — gerenciamento de skills cross-agent pra 32+ agents de código AI.
- **Bibliotecas de skills customizadas** — específicas de domínio (skills SQL pra agents de dados, skills Terraform pra agents de infra). O padrão Voyager escala pra baixo.
- **`tools` do OpenAI Agents SDK** — no extremo baixo; cada ferramenta é uma skill leve.

## Entregue

`outputs/skill-skill-library.md` gera uma biblioteca de skills formato Voyager com registro, recuperação, versionamento e refinamento conectados pra qualquer runtime alvo.

## Exercícios

1. Adicione um detector de ciclo de dependência em `compose()`. O que acontece quando skill A depende de B que depende de A? Erro vs aviso?
2. Implemente fixação de versão por skill. Quando uma skill pai compõe filho `crafting@1`, uma refinação pra `crafting@2` não deve atualizar silenciosamente o pai.
3. Substitua recuperação por sobreposição de tokens por embeddings de sentence-transformers (ou implementação stdlib de BM25). Meça retrieval@5 numa biblioteca de exemplo de 50 skills.
4. Adicione um agent de "currículo": dada a biblioteca atual e uma descrição de domínio, proponha 5 skills faltantes. Rode semanalmente.
5. Leia a documentação de skills do Claude Agent SDK da Anthropic. Porte a biblioteca de exemplo pro schema de skills do SDK. O que muda na descoberta?

## Termos-Chave

| Termo | O que a galera fala | O que realmente significa |
|-------|---------------------|---------------------------|
| Skill | "Capacidade reutilizável" | Trecho de código nomeado + descrição, recuperável por similaridade |
| Skill library | "Memória de como-fazer" | Armazenamento persistente de skills, pesquisável e composável |
| Curriculum | "Propositor de tarefas" | Gerador de objetivos bottom-up guiado por gap atual de capacidade |
| Composition | "DAG de skills" | Skills invocando skills; ordenadas topologicamente na execução |
| Iterative refinement | "Loop de auto-correção" | Feedback de ambiente + erros + auto-verificação volta pra próxima versão |
| Action-space-as-code | "Ações programáticas" | Emitir funções, não comandos primitivos, pra comportamento temporalmente estendido |
| Dedup on write | "Colapso de skills" | Descrições quase-duplicadas colapsam pra uma skill canônica |

## Leitura Complementar

- [Wang et al., Voyager (arXiv:2305.16291)](https://arxiv.org/abs/2305.16291) — o paper original de skill-library
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) — skills como a produto de 2026
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) — skills e subagents na prática
- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) — o loop de refinamento por baixo do Voyager
