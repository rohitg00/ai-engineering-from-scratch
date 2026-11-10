# Invocação de habilidades e roteamento

> A invocação é uma decisão da autoridade seguida de uma decisão de relevância.Uma boa descrição ajuda o modelo a escolher; uma boa política decide se essa escolha é permitida.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 13 · 24 (Skill Discovery and Progressive Disclosure)
**Time:** ~105 minutes

## Objetivos de aprendizagem

- Distinguir entre invocação explícita do usuário, invocação implícita do modelo, invocação de aplicação e invocação de habilidade para habilidade.
- Modela a visibilidade humana e a elegibilidade como dimensões políticas independentes.
- Escreva descrições de roteamento com gatilhos positivos e limites de quase falta.
- Eligibilidade, seleção, ativação, vinculação de argumentos e execução em traços e testes separados.
- Adaptar campos de invocação específicos do tempo de execução sem apresentá-los como material frontal portátil.

## O problema

Instala um `database-migration`A habilidade é uma ferramenta de análise de dados que permite ao usuário executar o modelo por nome, mas o modelo também vê a sua descrição e seleciona-o quando alguém faz uma pergunta geral de banco de dados.

Você adiciona`user-invocable: false`Em outro tempo de execução, esse campo é ignorado.`disable-model-invocation: true`No tempo de execução que o compreende, o usuário ainda pode invocá-lo explicitamente.

Não há nada de errado com os nomes de campos. O modelo é errado. "O usuário pode vê-lo", "o modelo pode selecioná-lo", "a aplicação pode pré-carregá-lo", e "ferramentas dentro dele podem executar" são fatos separados.`invocable`Não pode expressá-las.

O roteamento tem um segundo modo de falha. Se as descrições são vagas, várias habilidades se tornam plausíveis. Se as descrições são preenchidas com palavras-chave, tarefas não relacionadas as desencadeiam. O catálogo é uma interface probabilística: compacta o suficiente para caber, específica o suficiente para rotear.

## O conceito

### Cinco canais podem iniciar o ciclo de vida

| Actor | Invocation shape | Typical use | Main risk |
|---|---|---|---|
| Human user | Names a skill in the UI or prompt | Deliberate workflow selection | User expects availability or authority the host does not grant |
| Model or autonomous agent | Selects a catalog entry from task context | Automatic expert procedure | False-positive routing |
| Application | Activates or preloads a skill through runtime code | Fixed product workflow | Hidden coupling to one host |
| Another skill or subagent | Requests an exact skill as a workflow dependency | Composition | Cycles, missing dependency, or context bleed |
| Evaluation harness | Activates an exact skill under a fixed scenario | Repeatable measurement | Tests the skill while accidentally bypassing the production policy under study |

A especificação portátil de habilidades do agente define o pacote. Não padroniza uma interface de comando de slash universal, bandeira de roteamento implícito, API de aplicativos ou ciclo de vida subagente.

### As cinco fases de invocação

```figure
skill-invocation-stages
```

Use estas palavras com precisão:

- **Eligible**significa que a política permite que este ator solicite a habilidade.
- **Selected**significa que o utilizador o nomeou ou que um roteador considerou relevante.
- **Activated**significa que as instruções foram inseridas no contexto de trabalho.
- **Executing**significa que o agente iniciou o trabalho de modelo ou de ferramenta sob essas instruções.
- **Completed**significa que a saída cumpriu uma verificação independente de sucesso.

Um rastro que só registra .`skill_used=true`Esconde o limite onde aconteceu um fracasso.

### Invocação humana e modelo formam uma matriz 2x2

| Human can invoke | Model can invoke | Mode | Suitable examples |
|:---:|:---:|---|---|
| Yes | Yes | Shared | Code explanation, test planning, documentation review |
| Yes | No | Human-only | Publish preparation, billing export, destructive cleanup plan |
| No | Yes | Model-only | Internal style guide, domain reference, automatic support procedure |
| No | No | Disabled or application-only | Staged rollout, deprecated package, programmatic preload |

A matriz é um modelo de política, não o YAML padrão.

Um host atual usa `disable-model-invocation: true`para a linha de apenas humanos e `user-invocable: false`O padrão é ambos. Outro host usa `agents/openai.yaml`com`allow_implicit_invocation: false`Para manter a invocação explícita, desativando a seleção implícita.

O detalhe confuso importa:`user-invocable: false`Não significa "o modelo não pode usar isso". Elimina a invocação direta do usuário no host que o define. `disable-model-invocation: true`Não significa "a habilidade está desativada". Elimina a selecção iniciada pelo modelo, mantendo o acesso explícito do usuário.

### A invocação explícita é a identidade em primeiro lugar .

Uma invocação explícita fornece a identidade diretamente:

```text
/release-readiness v2.4.0
```

ou

```text
release-readiness check v2.4.0 without publishing
```

Documentos de interfaces do Codex atuais `/skills`Para a selecção e a designação das habilidades simples em pedidos de invocação explícita.`/skill-name`A sintaxe exata, a visibilidade do menu, as regras de citação e a expansão variável pertencem ao host.

Uma solicitação explícita ainda passa a política. Nomear uma habilidade não deve contornar permissões faltantes, restrições de espaço de trabalho, portas de aprovação ou isolamento de tempo de execução.

### A invocação implícita é a primeira descrição

Para roteamento implícito, o modelo inicialmente vê metadados do catálogo em vez do corpo completo.

- Debilitado .

```yaml
description: Helps with releases.
```

- Excesso de largura:

```yaml
description: Use for release, version, package, build, deploy, publish, tag, changelog, GitHub, CI, or software tasks.
```

Limitado:

```yaml
description: Inspect an already prepared release candidate and produce a readiness report. Use when the user asks whether a version, tag, package, or image is ready to publish; do not use for ordinary build failures or feature development.
```

A versão limitada contém:

1. **Capability:**Inspeccionar um candidato preparado.
2. **Output:**Relatório de prontidão.
3. **Positive boundary:**Pergunta se um artefato de liberação está pronto.
4. **Negative boundary:**As construções e os desenvolvimentos comuns estão fora do alcance.

Os limites negativos são úteis quando duas habilidades próximas compartilham vocabulário.

### Routing é classificação com opção de abstenção

Para uma habilidade .`s`e pedido `x`, imagine um marcador do roteador:

```text
score(s, x) = capability_match + trigger_match + context_match - exclusion_match - ambiguity_penalty
```

A pontuação exata pode ser uma decisão de LLM em vez de aritmética. O princípio da engenharia ainda vale: a seleção deve superar um limiar e uma habilidade concorrente. Quando a evidência é fraca, abster-se.

```figure
skill-routing-abstention
```

Para habilidades de alto impacto, o roteamento implícito pode ser inapropriado mesmo com uma descrição forte.

### A elegibilidade deve preceder a classificação

Não marque todas as habilidades descobertas, escolha a melhor combinação e verifique a política de uma habilidade depois.

Use esta ordem para roteamento implícito:

1. O filtro descobriu habilidades do ator solicitante e do adaptador host ativo.
2. Pontuar apenas os candidatos elegíveis.
3. Selecionar a correspondência mais forte elegível se for efetuada a norma do limiar e da ambigüidade.
4. Abster-se quando nenhum candidato é elegível ou quando nenhuma pontuação elegível é suficientemente forte.

Suponha que`incident-triage`pontuações `0.80`Mas a extensão host desativa a invocação do modelo. `incident-review`pontuações `0.55`O roteador deve avaliar`incident-review`Não deve escolher.`incident-triage`Negá-lo e parar.

Esta ordem também impede que as mudanças de política alterem o significado de uma pontuação de relevância.

### Avaliações de roteamento precisam de quase falhas

Casos positivos provam a recall:

```json
{"prompt":"Is version 2.4.0 ready to publish?","expected":"release-readiness"}
```

Negativos claros provam precisão básica:

```json
{"prompt":"Explain rotary position embeddings.","expected":null}
```

Os erros próximos expõem a qualidade de fronteira:

```json
{"prompt":"Why did today's package build fail?","expected":"build-diagnostics"}
```

As ações de quase miss `package`E ...`build`O que é mais importante é que, em termos de qualidade, o sistema de roteamento seja composto apenas de positivos óbvios e negativos não relacionados.

### Os argumentos têm três representações

Um argumento de invocação atravessa vários limites:

```figure
skill-argument-boundaries
```

Em cada limite, preserve a intenção sem tratar o texto como código.

- O analisador host decide a sintaxe e a citação de comandos.
- A habilidade recebe texto ou variáveis vinculadas de acordo com as regras do anfitrião.
- As instruções validam os valores exigidos e os padrões.
- Uma chamada de ferramenta converte valores em um esquema digitado e os revalida.

Não interpolar argumentos brutos em comandos shell. Prefira um script invocado com um vetor de argumento ou uma ferramenta MCP digitalizada.

### A invocação de um pedido é uma orquestração explícita .

Um produto pode ativar uma habilidade porque o seu fluxo de trabalho já conhece o tipo de tarefa.`pull-request-risk-review`Após o utilizador pressionar Review.

Isso elimina a incerteza de roteamento, mas cria uma dependência da API de tempo de execução.

```figure
skill-host-adapter
```

A habilidade deve permanecer inteligível quando aberta por um cliente diferente.

### A invocação de habilidades é uma vantagem semelhante a ferramentas

Suponha que`release-readiness`Pede por `security-change-review`Quando os ficheiros de dependência mudaram.

O requerente deve fornecer:

- Identidade das competências-alvo;
- um caminho de tarefa e artefato limitado;
- O contrato de resposta esperado;
- O motivo da invocação;
- uma queda, se não estiver disponível;
- Uma regra de profundidade máxima ou ciclo.

```json
{
  "target_skill": "security-change-review",
  "task": "Review dependency changes in the candidate diff",
  "inputs": ["artifacts/release.diff"],
  "expected": "risk-report.json",
  "max_depth": 2
}
```

A segunda habilidade não é colada cegamente na primeira. O anfitrião decide como ativá-la e se compartilha contexto, corre em uma garfã ou retorna através de um resultado de ferramenta.

### O ciclo de vida do contexto é específico para o hospedeiro

Após a ativação, o corpo de habilidades pode permanecer na conversa, ser resumido durante a compactação ou executado em um contexto delegado.

Não escreva uma habilidade que depende de uma suposição de vida invisível. Coloque saídas duradouras em arquivos ou estado de digitação, torne a reentrada segura e diga o que deve ser recarregado após a interrupção.

```markdown
On resume, read `artifacts/release-readiness.json` if it exists.
Revalidate the candidate commit before continuing.
Do not repeat an external write whose idempotency key is already recorded.
```

## Construí-lo

`code/main.py`Implementa a política e o roteamento como adaptadores separados.

O modelo inclui:

- `Actor`Para os chamadores humanos, modelos, agentes autônomos, aplicações, habilidades e sistemas de uso;
- `SkillMetadata`para identidade de roteamento;
- `InvocationPolicy`para a matriz humano/modelo;
- `InvocationRequest`E ...`InvocationDecision`Para entradas e resultados rastreáveis;
- `CorePolicyAdapter`Para comportamento portátil sem extensões host;
- `ExtensionPolicyAdapter`para campos de tempo de execução reconhecidos;
- `build_invocation_matrix(policy)`para a visão 2x2;
- `route_request(skills, request, adapter)`para o filtro de elegibilidade antes do ranking de relevância, seleção e negação.

- É o que é ?

```bash
cd phases/13-tools-and-protocols/25-skill-invocation-and-routing
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

A demonstração imprime uma matriz e decisões para modelos explícitos humanos, implícitos, agentes autônomos, aplicações, composição de habilidades e canais de aproveitamento. Os resultados do adaptador de extensão mostram que um correspondência lexical superior bloqueada é removida antes de uma alternativa elegível ser classificada. Inclui também lista de nomes exactos. Não é necessário um modelo de API. O roteador determinista existe para tornar as fronteiras políticas inspecionáveis, não para afirmar que a correspondência léxica reproduza o roteamento do modelo de produção.

### Por que os adaptadores de núcleo e extensão são separados

Se um parser atribuir significado a cada campo de frontmatter observado, ele silenciosamente promove convenções de tempo de execução em um padrão falso.

O `CorePolicyAdapter`O programa de avaliação da qualidade de vida dos trabalhadores é um dos principais instrumentos de avaliação da qualidade de vida dos trabalhadores.`ExtensionPolicyAdapter`Reconhece um conjunto explícito de campos host e registos em que o campo alterou a decisão.

## Usá-lo

Escrever um contrato de invocação antes de publicar uma habilidade:

```yaml
actors:
  human: allow
  model: deny
  application: allow
  skill: deny
explicit_name: release-readiness
arguments:
  candidate: required
  publish: fixed_false
ambiguity: ask_user
missing_dependency: stop
context:
  durable_state: artifacts/release-readiness.json
  max_composition_depth: 2
```

Este contrato é uma documentação de projecto para adaptadores e testes.`SKILL.md`A primeira questão é a de que uma norma a adopte expressamente.

## Envia-o

Esta lição produz os`skill-invocation-router`O pacote inclui uma referência de modelo de invocação, uma política host de exemplo e um CLI não executador que avalia um humano, modelo, agente autônomo, aplicação, composição de habilidades ou pedido de aproveitamento e retorna uma decisão JSON com canal, adaptador, pontuação e razão.

O CLI de uma só solicitação é uma pesquisa de política, não uma avaliação de gatilho completa. Use o design positivo e quase-miss etiquetado na lição 27 para calcular contagens de confusão, precisão, recall e estabilidade de execução repetida.

## Exercícios

1. Crie todas as quatro linhas da matriz humano/modelo e escreva um caso de uso legítimo para cada uma.
2. Adicionar a ativação apenas para aplicação `CorePolicyAdapter`- Demonstrar que os chamadores humanos e modelos continuam a ser negados.
3. Escreva dez misses para uma habilidade de implantação. Cada prompt deve compartilhar vocabulário com a habilidade enquanto pertence a um fluxo de trabalho diferente.
4. Adicione uma margem de ambigüidade entre as duas pontuações de roteamento mais altas.`ask`Quando a margem é pequena demais.
5. Adicionar uma profundidade máxima da composição aos pedidos de habilidade para habilidade e detectar um ciclo de duas habilidades.
6. Execute o mesmo conjunto rotulado através de adaptadores de núcleo e extensão.

## Termos-chave

| Term | What people say | What it actually means |
|---|---|---|
| Explicit invocation | "Slash command" | An actor supplies skill identity directly, subject to policy |
| Implicit invocation | "The model chooses" | A router selects from eligible catalog metadata based on task context |
| User-invocable | "Humans can use it" | A host-specific menu or direct-invocation property, not a core field |
| Model-invocable | "The agent can use it" | Eligibility for implicit model selection under host policy |
| Invocation adapter | "Frontmatter parser" | Code that maps a host's fields and APIs into a declared policy model |
| Near miss | "Hard negative" | A non-triggering request that resembles a skill's intended inputs |
| Abstention | "No skill selected" | A deliberate routing result when evidence is absent or ambiguous |

## Mais leitura

- [Optimizing skill descriptions](https://agentskills.io/skill-creation/optimizing-descriptions)para os gatilhos positivos, especificidade e avaliação.
- [Evaluating skills](https://agentskills.io/skill-creation/evaluating-skills)para o desenho de avaliação de desencadeamento e de saída.
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills)para os controles de invocação explícitos e implícitos do Código em vigor.
- [Claude Code skills](https://code.claude.com/docs/en/skills)para um hospedeiro `user-invocable`- Não .`disable-model-invocation`, argumentos e contexto delegado.
