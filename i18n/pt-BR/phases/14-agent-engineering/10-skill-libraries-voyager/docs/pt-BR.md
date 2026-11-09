# Biblioteca de competências e aprendizagem ao longo da vida (Voyager)

> Voyager (Wang et al., TMLR 2024) trata o código executável como uma habilidade. Habilidades são nomeadas, recuperáveis, compostas e refinadas por feedback ambiental. Esta é a arquitetura de referência para habilidades SDK do Claude Agent, skillkit e o padrão de biblioteca de habilidades de 2026.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 07 (MemGPT), Phase 14 · 08 (Letta Blocks)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Nomear os três componentes da Voyager  currículo automático, biblioteca de habilidades, incitação iterativa  e o papel de cada um.
- Explica porque a Voyager faz o código do espaço de ação, não os comandos primitivos.
- Implementar uma biblioteca de habilidades stdlib com registro, recuperação, composição e refinamento de falhas.
- Mapa do padrão da Voyager para as habilidades do SDK do Agente Claude 2026 e o ecossistema do skillkit.

## O problema

Os agentes que reconstruem todas as capacidades de zero em cada sessão fazem três coisas erradas:

1. **Waste tokens.**Cada tarefa re-excita o mesmo raciocínio.
2. **Lose progress.**Uma correcção aprendida na sessão A não se transfere para a sessão B.
3. **Fail on long-horizon composition.**As tarefas complexas precisam de hierarquias de capacidade; as instruções de um tiro não podem expressá-las.

A resposta da Voyager: tratar cada capacidade reutiliável como um pedaço de código nomeado armazenado numa biblioteca, recuperável por semelhança, composta com outras habilidades, e refinada por feedback de execução.

## O conceito

### Três componentes

A Voyager (arXiv:2305.16291) estrutura um agente em torno de:

1. **Automatic curriculum.**Um proponente motivado pela curiosidade escolhe a próxima tarefa com base no conjunto de habilidades atual do agente e no estado do ambiente.
2. **Skill library.**Cada habilidade é um código executável. Novas habilidades são adicionadas quando uma tarefa é bem sucedida. Habilidades são recuperadas por semelhança entre consulta e descrição.
3. **Iterative prompting mechanism.**Em caso de falha, o agente recebe erros de execução, feedback do ambiente e saída de auto-verificação, e depois aperfeiçoar a habilidade.

A avaliação do Minecraft (Wang et al., 2024): 3.3x mais itens únicos, 8.5x mais ferramentas de pedra, 6.4x mais ferramentas de ferro, 2.3x mais longo cruzamento do mapa versus linhas de base. Os números são específicos do Minecraft, mas o padrão transfere.

### Espaço de ação = código

A maioria dos agentes emitem comandos primitivos, a Voyager emite funções JavaScript.

```
async function craftIronPickaxe(bot) {
  await mineIron(bot, 3);
  await mineStick(bot, 2);
  await placeCraftingTable(bot);
  await craft(bot, 'iron_pickaxe');
}
```

Composto por sub-habilidades, armazenado com teclas na descrição e embutida, recuperado como um programa, não como um prompt.

Esta é a habilidade do SDK do Agente Claude 2026: um pedaço de código chamado e recuperável, mais instruções que o agente carrega à demanda.

### Recuperação de competências

A nova tarefa é fazer um picáxe de diamante.

1. Incorporar a descrição da tarefa.
2. Pergunto à biblioteca de habilidades para habilidades semelhantes.
3. Retira-se`craftIronPickaxe`- Não .`mineDiamond`- Não .`placeCraftingTable`etc.
4. Compõe a nova habilidade a partir de primitivas recuperadas + nova lógica.

Este é o padrão de implementação dos recursos MCP (Fase 13) e das competências SDK do agente: recuperação sobre uma superfície de conhecimento/código, focada na tarefa atual.

### Refinamento iterativo

O circuito de feedback da Voyager:

1. O agente escreve uma habilidade.
2. A habilidade corre contra o ambiente.
3. Um dos três sinais retorna:`success`- Não .`error`(com rastreamento de pilhas), `self-verification failure`- Não .
4. O agente reescreve a habilidade usando o sinal como contexto.
5. A seguir até o sucesso ou o máximo de rodadas.

É o Auto-Refine (Lessão 05) aplicado à geração de código com verificação baseada no ambiente.

### Currículo e exploração

O módulo de currículo da Voyager propõe tarefas como "construir um abrigo perto do lago" com base no que o agente tem e o que ainda não fez.

Para os agentes de produção, isso se traduz em um operador de "o que falta": dada a biblioteca de habilidades atual e um domínio, quais habilidades ainda não cobrimos?

### Onde este padrão vai mal

- **Skill library rot.**A mesma habilidade adicionada 10 vezes com descrições ligeiramente diferentes. Adicionar deduplicação na escrita; recuperação retorna apenas uma.
- **Composed-skill drift.**A habilidade dos pais depende de uma criança que foi refinada.
- **Retrieval quality.**A recuperação de vetores sobre descrições de habilidades degrada-se à medida que a biblioteca cresce para além de algumas centenas.`category=tooling`").

```figure
voyager-skills
```

## Construí-lo

`code/main.py`Implementa uma biblioteca de habilidades stdlib:

- `Skill` nome, descrição, código (como cadeia), versão, tags, dependências.
- `SkillLibrary` registar, procurar (superposição de tokens), compor (tipologia topológica de deps) e refinar (bomba de versão na atualização).
- Um agente com roteiro que registra três habilidades primitivas, compõe uma quarta, atinge um fracasso e aperfeiçoia.

- É o que é ?

```
python3 code/main.py
npx tsx code/main.ts
```

O rastro mostra escritos da biblioteca, recuperação, composição, uma execução falhada e um refinamento v2 do ciclo de Voyager de ponta a ponta.

## Usá-lo

- **Claude Agent SDK skills**(Antropico)  a referência de 2026: cada habilidade tem uma descrição, código e instruções; carregado a pedido durante uma sessão de agente.
- **skillkit**(npm: skillkit)  Gestão de competências entre agentes para 32+ agentes de codificação de IA.
- **Custom skill libraries** Específico de domínio (habilidades SQL para agentes de dados, habilidades Terraform para infra-agentes).
- **OpenAI Agents SDK `tools`** no final inferior; cada ferramenta é uma habilidade leve.

## Envia-o

`outputs/skill-skill-library.md`gera uma biblioteca de habilidades em forma de Voyager com registro, recuperação, versão e refinamento conectado para qualquer tempo de execução de alvo.

## Exercícios

1. Adicionar um detector de ciclo de dependência para `compose()`O que acontece quando a habilidade A depende de B que depende de A?
2. Implementar a versão por habilidade de pinagem.`crafting@1`, um refinamento para `crafting@2`Não deve silenciosamente atualizar o pai.
3. Substitua a recuperação de token-overlap com transformadores de frases embutidos (ou um impl stdlib BM25).
4. Adicionar um agente de "curriculum": dada a biblioteca atual e uma descrição de domínio, propor 5 habilidades faltantes.
5. Leia os documentos de habilidades do SDK do Claude Agent da Anthropic, e transporte a biblioteca de brinquedos para o esquema de habilidades do SDK.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Skill | "Reusable capability" | Named chunk of code + description, retrievable by similarity |
| Skill library | "Agent memory of how-to" | Persistent store of skills, searchable and composable |
| Curriculum | "Task proposer" | Bottom-up goal generator driven by current capability gap |
| Composition | "Skill DAG" | Skills invoking skills; topologically sorted on execution |
| Iterative refinement | "Self-correcting loop" | Env feedback + errors + self-verification fold back into the next version |
| Action-space-as-code | "Programmatic actions" | Emit functions, not primitive commands, for temporally extended behavior |
| Dedup on write | "Skill collapse" | Near-duplicate descriptions collapse to one canonical skill |

## Mais leitura

- [Wang et al., Voyager (arXiv:2305.16291)](https://arxiv.org/abs/2305.16291) o papel original da biblioteca de habilidades
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) competências como a produtividade de 2026
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) competências e subagens na prática
- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) o ciclo de refinamento debaixo do Voyager
