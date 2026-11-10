# Competências de agente: contrato portátil e limite de tempo de execução

> Uma habilidade não é um pedido longo com um nome de arquivo melhor. É um pacote descoberto de instruções, recursos e auxiliares executáveis que entra no contexto de um agente através de um contrato de tempo de execução.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 13 · 01 (The Tool Interface), Phase 13 · 05 (Tool Schema Design)
**Time:** ~90 minutes

## Objetivos de aprendizagem

- Defina uma habilidade de agente sem confundir com um prompt, instruções de repositório, uma ferramenta, um gancho, um subagente ou um plugin.
- Leia o portátil .`SKILL.md`Contratação e separação das extensões específicas do tempo de execução.
- Explicar a descoberta, a seleção, a ativação, a carga de recursos, o uso de ferramentas e a verificação como etapas distintas do ciclo de vida.
- Valida um pacote de habilidades antes de um runtime colocá-lo no catálogo de um agente.
- Escolha entre uma habilidade, ferramenta MCP, gancho, subagente ou código comum para uma tarefa concreta.

## Dez minutos de sucesso

Faça isto antes da longa explicação.
O revisor completo se mistura em um agente real, invoca-o, verifica a
Isto prova o ciclo de vida com um resultado observável.

### Prevoio para o laboratório de hospedeiros reais

O ponto de verificação do host real requer Node.js, `npx`Python 3, um selecionado
um anfitrião com habilidades, e escrever acesso ao projeto ou ao escopo de usuário que escolher
Verifique primeiro os comandos locais:

```bash
node --version
npx --version
python3 --version
```

Decida qual host e alcance utilizar antes da instalação.
O requisito não está disponível, leia esta lição no site ou continue com
O exercício manual de embalagem abaixo.
Não comprova a descoberta do host, a invocação, a execução de scripts em conjunto, ou
Desinstalar comportamentos. Mantém as observações marcadas pendentes.

### 1. Comece em um diretório de trabalho vazio

Execute estes comandos a partir de qualquer diretório de pais onde você continua a aprender a trabalhar:

```bash
mkdir -p agent-skills-first-run
cd agent-skills-first-run
TARGET_ROOT="$(pwd -P)"
printf 'TARGET_ROOT=%s\n' "$TARGET_ROOT"
ls -A
```

O comando final não deve imprimir nada.
O diretório está vazio, para que a revisão tenha um limite claro.

Crie um diretório para a sua primeira habilidade:

```bash
mkdir -p my-first-skill
```

Criar`my-first-skill/SKILL.md`com o seguinte conteúdo:

```markdown
---
name: my-first-skill
description: Turn rough meeting notes into a compact decision record when the user asks to capture a technical decision.
---

# Decision record

Extract the decision, context, alternatives, owner, and next review date.
If the notes do not contain a decision, ask one clarifying question instead
of inventing one.
```

Verifique se você criou o arquivo no diretório pretendido:

```bash
test -f my-first-skill/SKILL.md
```

Não há código de saída e saída 0 significa que o arquivo existe.

### 2. Instalar o pacote completo de revisores

Fica lá dentro .`agent-skills-first-run`e executar:

```bash
npx skills add rohitg00/ai-engineering-from-scratch --skill skill-contract-reviewer --full-depth
```

Escolha o host do agente e o escopo que você está usando.
`skill-contract-reviewer`e o destino que escreveu.`--full-depth`é
necessária porque a habilidade desta lição é um conjunto de referências, um
O guião e um ato.

Set `SKILL_ROOT`O fabricante deve enviar o seu relatório ao diretório absoluto comunicado pelo instalador.
ser o diretório que contém os instalados `SKILL.md`Não é a fonte da lição.
Directório e não o espaço de trabalho atual:

```bash
# Replace the placeholder with the destination printed by the installer.
SKILL_ROOT="$(cd "/absolute/path/to/skill-contract-reviewer" && pwd -P)"
test -f "$SKILL_ROOT/SKILL.md"
printf 'SKILL_ROOT=%s\n' "$SKILL_ROOT"
```

Se a sessão do agente já estava aberta, iniciar uma nova sessão ou usar o host
Não suponha que cada hospedeiro recarregue o catálogo.

### 3. Invocar-o explicitamente

No agente instalado, com `agent-skills-first-run`como o trabalho
diretório, usar a sintaxe suportada por esse host:

| Host | Explicit invocation |
|---|---|
| Codex | `skill-contract-reviewer`, or choose it from `/skills`, then provide the review request |
| Claude Code | `/skill-contract-reviewer` followed by the review request |
| Portable fallback | `Use skill-contract-reviewer to review the target package.` |

Use os valores absolutos impressos para `SKILL_ROOT`E ...`TARGET_ROOT`No
Exigir que o host os expandir antes da execução e mostrar o exato
comando resolvido, não um comando que dependa do diretório de trabalho de processo:

```text
Use skill-contract-reviewer to review <TARGET_ROOT>/my-first-skill. The installed bundle root is <SKILL_ROOT>. Run python3 <SKILL_ROOT>/scripts/check_skill.py <TARGET_ROOT>/my-first-skill. Before running it, show the fully resolved argv. Return the validation report, selected primitives, and one sentence for each selection. Include the resolved script path, resolved target path, cwd, argv, and exit code as execution evidence.
```

O comando resolvido deve ter a seguinte forma, sem restantes detentores de lugar:

```bash
python3 "/absolute/install/path/skill-contract-reviewer/scripts/check_skill.py" \
  "/absolute/workspace/path/agent-skills-first-run/my-first-skill"
```

Um resultado bem sucedido tem as três propriedades:

1. O anfitrião encontra .`skill-contract-reviewer`pelo nome.
2. O revisor lê o contrato de pacote e executa o seu validador em conjunto.
3. A resposta contém um relatório de validação sem erro estrutural para o
   Uma amostra, mais uma selecção primitiva justificada.

A prova da execução deve também indicar o caminho do roteiro, o caminho do alvo, o cwd, exatamente
Um relatório fluente sem esses campos não
Prova que o script de companhia instalado funcionou.

Se o host relatar que a habilidade não está disponível, verifique a instalação
O destino, rescan ou reiniciar uma vez, e tentar novamente o pedido explícito.
Reescrever a descrição da habilidade para ocultar uma falha de instalação.

### 4. Seleção implícita da sonda

Comece uma nova turnagem de agente e entre na mesma tarefa sem nomear a habilidade:

```text
Review <TARGET_ROOT>/my-first-skill as a reusable agent package and tell me whether its package contract is valid.
```

Se o anfitrião expõe habilidades selecionadas, anote se ele escolheu
`skill-contract-reviewer`Se o anfitrião não revelar o roteamento, marque implícito
A invocação explícita é a fallback portátil.

### 5. Limpe-a.

Remover apenas o pacote de revisor instalado:

```bash
npx skills remove skill-contract-reviewer
```

Selecione o mesmo host e alcance utilizados durante a instalação.
sessão, um pedido explícito para `skill-contract-reviewer`deve informar que
Não está disponível.`my-first-skill`para as aulas posteriores, ou remover o
O diretório do laboratório depois de terminar a pista.

## O problema

Suponha que sua equipe tenha um fluxo de trabalho de lançamento confiável. Ele encontra alterações combinadas, verifica notas de migração, atualiza o registro de mudanças, executa um comando de embalagem e produz uma lista de verificação de revisão.

Colocar esse fluxo de trabalho em um prompt torna fácil colar e difícil de operar. O prompt não tem identidade estável, nenhuma regra de descoberta, nenhum limite de recursos, nenhuma forma de pacote testável e nenhuma resposta a perguntas básicas: quem pode invocá-lo? Quando o modelo deve selecioná-lo? Que scripts ele pode executar? Que arquivos são confiáveis? O que sobrevive quando o contexto é compactado?

O erro oposto é tratar cada instrução reutilizável como uma habilidade. Convenções de repositório, automação determinista, ferramentas externas, ganchos de evento e agentes delegados resolvem diferentes problemas.`SKILL.md`produz um diretório que parece portátil enquanto depende do comportamento não documentado de um hospedeiro.

A primeira tarefa de engenharia é a classificação, decidir o que é o artefato antes de decidir como embalar.

## O conceito

### Competências de codificação de conhecimentos processuais

Uma habilidade de agente é um diretório cujo ponto de entrada é `SKILL.md`O arquivo de entrada contém a matéria frontal do YAML seguida de instruções de Markdown.

```figure
skill-package-anatomy
```

O diretório, não só o arquivo Markdown, é a unidade implementável.`SKILL.md`com referências faltantes é um pacote quebrado mesmo que a sua matéria frontal seja analisada.

### As abstrações vizinhas

| Artifact | Primary job | Loaded or run when | What it should not impersonate |
|---|---|---|---|
| Prompt | Shape one model interaction | Included by an application or user | A versioned package with resources |
| Repository instructions | Explain one codebase's standing rules | A coding runtime enters that scope | A reusable task workflow |
| Agent skill | Supply reusable procedural knowledge | Explicit or implicit activation | A hard authorization boundary |
| MCP tool | Expose a typed remote capability | The model or application calls it | A detailed operating procedure |
| Hook | Run deterministic logic on an event | The declared event occurs | Probabilistic model routing |
| Subagent | Delegate work with separate context and state | An orchestrator creates or calls it | A static instruction bundle |
| Plugin | Distribute a larger runtime extension | The host installs or enables it | The portable skill contract itself |
| Learned skill library | Store behavior discovered through experience | A policy retrieves a prior program or trajectory | A standards-based `SKILL.md` package |

Uma habilidade de liberação pode dizer ao agente como inspecionar uma liberação. Um servidor MCP pode expor o registro de liberação. Um gancho pode proibir empurrões diretas. Um subagente pode auditar o candidato de forma independente. Essas peças compõem porque mantêm diferentes responsabilidades.

### A palavra "habilidade" designa duas idéias diferentes

Os sistemas de pesquisa às vezes chamam de habilidade um programa aprendido, uma trajetória bem sucedida ou um fragmento de política específico do ambiente. Um agente pode criar esses artefatos durante a exploração, recuperá-los por semelhança de tarefa, executá-los e revisar a biblioteca a partir de feedback.

Um Agente habilidade nesta mini-track é diferente. É um pacote de autor com um contrato declarado do sistema de arquivos, catálogo de metadados, divulgação progressiva, invocação mediada por tempo de execução, e ferramentas controladas pelo host. Ele pode ser gerado ou melhorado por um agente, mas a aprendizagem não é necessária para o formato.

| Dimension | Agent Skill package | Learned skill library |
|---|---|---|
| Primary unit | `SKILL.md` directory | Program, policy, trajectory, or memory record |
| Creation | Authored, generated, or curated | Usually discovered from environment experience |
| Selection | Catalog description plus runtime policy | Retrieval or policy over task state |
| Execution | Model follows instructions and calls host tools | Environment runs a stored behavior or code artifact |
| Portability | Package contract can cross compatible hosts | Often tied to one environment and action space |
| Evaluation | Routing, artifact, safety, and host compatibility | Reward, success rate, transfer, and library growth |

As duas ideias incluem competências reutilizáveis, que não devem partilhar as reivindicações de execução apenas porque compartilham um nome.

### O núcleo portátil

A especificação de habilidades do agente requer dois campos de matéria-prima:

```yaml
---
name: release-readiness
description: Inspect a release candidate when the user asks whether a version is ready to publish.
---
```

`name`O identificador estável deve satisfazer as regras de nomeação da especificação e corresponder ao diretório-mãe. `description`O que é que a habilidade faz e quando é aplicada.

Os campos portáteis opcionais são:

| Field | Purpose | Portability note |
|---|---|---|
| `license` | State the terms for the package | Core specification |
| `compatibility` | State environmental requirements | Core specification |
| `metadata` | Carry string-valued extension data | Core specification |
| `allowed-tools` | Suggest pre-approved tools | Experimental; host support varies |

O corpo Markdown detém as instruções operacionais. Deve definir o fluxo de trabalho, pontos de decisão, comportamento de falha e caminhos diretos para os recursos de suporte.

```markdown
# Release readiness

Use this workflow for a release candidate, not for ordinary development builds.

1. Read `references/release-policy.md`.
2. Run `python3 scripts/inspect_release.py --format json`.
3. Stop if the report contains a blocking failure.
4. Produce the checklist from `assets/release-checklist.md`.
5. Ask for approval before any publish or tag action.
```

### As extensões de tempo de execução são uma segunda camada

Alguns hosts aceitam configuração frontmatter ou companheira extra. Esses campos podem ser úteis, mas não são portáteis automaticamente.

| Behavior | Example host extension | Portable core? |
|---|---|:---:|
| Hide a skill from model routing while keeping direct user invocation | `disable-model-invocation` | No |
| Hide a skill from the user's command menu while allowing model routing | `user-invocable` | No |
| Show argument help in a command menu | `argument-hint` | No |
| Run the skill in delegated context | `context`, `agent` | No |
| Pin model or reasoning settings | `model`, `effort` | No |
| Register lifecycle automation | `hooks` | No |
| Disable implicit invocation in Codex | `agents/openai.yaml` policy | No |

Tratar cada extensão como um adaptador. Mantenha o fluxo de trabalho central válido sem ele, documente o fallback e teste o host que o consome. Um runtime pode ignorar um campo desconhecido, rejeitá-lo ou preservá-lo sem implementar o comportamento.

### A matéria frontal é metadados executáveis

Os metadados alteram o comportamento do sistema antes de o corpo de habilidades ser lido.

- Um malformado .`name`Pode fazer a descoberta falhar.
- Um pouco vago .`description`Pode encaminhar os pedidos errados.
- Uma bandeira que só é humana pode remover a habilidade do catálogo do modelo.
- Uma autorização de ferramentas pode alterar se um anfitrião pede permissão.
- Uma configuração contextual pode mover a execução para uma sessão de agente separada.

Revisar a matéria frontal como código de configuração. Validar, versão, e incluir o seu comportamento em evals.

### O ciclo de vida das habilidades

```figure
skill-runtime-lifecycle
```

Cada flecha é um limite com seus próprios modos de falha.

1. **Discovery**encontra possíveis pacotes em locais configurados.
2. **Validation**Rejeita embalagens mal formadas ou inseguras antes da publicação do catálogo.
3. **Cataloging**expõe um compacto `name`E ...`description`Não o pacote completo.
4. **Selection**Decide se a competência é relevante.
5. **Activation**Carrega o corpo num contexto visível ao modelo.
6. **Disclosure**Só lê referências ou ativos quando uma sucursal os requer.
7. **Execution**utiliza ferramentas host sob as regras de permissão e isolamento do host.
8. **Verification**verifica o artefato produzido independentemente da alegação do modelo.

A queda desses estágios causa maus modelos mentais. Uma habilidade descoberta não é ativa. Uma habilidade ativa não está autorizada a fazer tudo o que descreve. Uma chamada de ferramenta permitida não é prova de que o resultado é correto.

### Habilidades e ferramentas são ortogonais

O MCP responde: "Que capacidades pode esta aplicação chamar, e quais são os seus esquemas?" Uma habilidade responde: "Como um agente deve abordar esta classe de tarefa?"

```figure
skill-tool-orthogonality
```

A habilidade pode nomear uma ferramenta, mas o host possui o registro de capacidades real. Se a ferramenta estiver ausente, a habilidade deve declarar um retrocesso ou falhar claramente.

### As competências e as instruções do repositório são diferentes

As instruções de repositório descrevem o ambiente em que você já está: comandos, convenções, arquivos gerados e limites.

Quando ambos se aplicam, a solicitação ativa do usuário e as regras do repositório restringem a habilidade.

### As habilidades não se importam umas às outras

Uma habilidade pode direcionar o agente a invocar outra, mas esta não é uma importância de nível de linguagem. A segunda habilidade ainda passa pela descoberta de tempo de execução, elegibilidade, ativação, permissões e manejo de contexto.

Escrever dependências entre competências como bordas de fluxo de trabalho observáveis:

```markdown
After producing the candidate changelog, invoke the `release-risk-review` skill.
Pass the candidate path and require a blocking or non-blocking verdict.
If that skill is unavailable, stop and report the missing dependency.
```

Isto torna a dependência testável e dá ao hospedeiro a oportunidade de impor a política.

## Construí-lo

`code/main.py`A solução de verificação de dados é a de um sistema de verificação de dados que permite a verificação de dados e a de um selector de artefatos.

O validador expõe:

- `parse_frontmatter(text)`para separar os metadados do corpo.
- `validate_skill_text(text, directory_name, allowed_runtime_extensions=())`Para verificar os campos necessários, nomeação, extensões desconhecidas, presença do corpo e limites portáteis.
- `ValidationIssue`E ...`SkillReport`para retornar evidências estruturadas em vez de um booleano opaco.
- `FrontmatterSyntaxError`para informações que não possam ser interpretadas com segurança.

O escolhedor expõe .`TaskShape`E ...`select_primitives(task)`. Mapeia as necessidades de uma tarefa para código comum, instruções de repositório, uma habilidade, um gancho, um subagente ou uma ferramenta MCP.

- Dirigir o laboratório:

```bash
cd "$(git rev-parse --show-toplevel)"
cd phases/13-tools-and-protocols/22-skills-and-agent-sdks
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Este bloco de comando requer um clone local e deve começar de qualquer lugar dentro
O clone é assim .`git rev-parse --show-toplevel`Pode resolver a raiz do repositório.

A demonstração imprime JSON para uma habilidade portátil válida, uma habilidade estendida para hospedeiros, um pacote inválido e várias decisões de forma de tarefa.

### Questões relativas à ordem de validação

Validar os fatos estruturais baratos antes de regras de conteúdo mais profundas:

```figure
skill-validation-order
```

Esta ordem impede que erros secundários obscureçam o primeiro invariante quebrado.

## Usá-lo

Antes de escrever uma habilidade, preencha este cartão de decisão:

| Question | If yes | Likely primitive |
|---|---|---|
| Does this need reusable model judgment across several steps? | The procedure is stable but decisions vary | Skill |
| Must this happen every time an event fires? | Missing one execution is unacceptable | Hook or application code |
| Does the model need an external capability with typed inputs? | The operation lives outside model context | Tool or MCP server |
| Does the work need isolated context, state, or ownership? | A separate worker returns a bounded result | Subagent |
| Is this guidance specific to one repository? | It describes local commands and constraints | Repository instructions |
| Is one interaction enough? | No package lifecycle is needed | Prompt |

Muitos fluxos de trabalho de produção usam mais de uma linha.

## Envia-o

Esta lição produz os`skill-contract-reviewer`- em conjunto`outputs/`Contém:

- um portátil`SKILL.md`que revise um pacote de competências proposto;
- Lista de verificação de referência para o contrato portátil e a seleção primitiva;
- um script de validação determinista;
- Instalações de forma de tarefa que cobrem instruções, habilidades, ferramentas, ganchos, código ordinário e subagentes.

Instalar o pacote completo, não apenas o seu ficheiro de entrada:

```bash
cd "$(git rev-parse --show-toplevel)"
python3 scripts/install_skills.py /tmp/aiefs-skills --phase 13 --type skill
```

O instalador do curso relata cada habilidade da Fase 13 copiada e escreve
`/tmp/aiefs-skills/manifest.json`Este destino limpo verifica a forma do pacote;
O primeiro ciclo de sucesso acima verifica a descoberta e a invocação num host real.

As lições a seguir aprofundam cada etapa do ciclo de vida. A lição 24 constrói a descoberta e a divulgação progressiva. A lição 25 constrói a política de invocação e roteamento. A lição 26 separa permissões do sandboxing. A lição 27 transforma todo o pacote em um artefato de liberação avaliado.

## Exercícios

1. Classificar cinco fluxos de trabalho da sua própria equipe usando `TaskShape`Defende cada caso em que escolha mais de um primitivo.
2. Adicionar testes de limites que provem que um 500 caracteres `compatibility`O valor passa e um valor de 501 caracteres falha como um erro de especificação.
3. Adicione uma extensão de tempo de execução à lista de permisos. Escreva um teste que comprova que o mesmo arquivo ainda é distinto de uma habilidade apenas portátil.
4. Divide uma resposta de 400 linhas em `SKILL.md`, um referencial, um contrato de script e um modelo de saída.
5. Desenhar uma resposta de falha para uma habilidade que faça referência a uma ferramenta MCP indisponível. Não substituir silenciosamente uma ferramenta por permissões mais amplas.
6. Revise uma habilidade existente e marque cada frase como roteamento, procedimento, política, ponteiro de referência ou contrato de saída.

## Termos-chave

| Term | What people say | What it actually means |
|---|---|---|
| Agent skill | "A saved prompt" | A discoverable directory of procedural instructions and optional resources |
| Portable core | "Fields every runtime shares" | The contract defined by the Agent Skills specification |
| Runtime extension | "Extra frontmatter" | Host-specific configuration whose behavior requires a compatible adapter |
| Activation | "The skill ran" | The skill body entered model-visible context; execution may come later |
| Skill dependency | "Import another skill" | A runtime-mediated invocation edge with availability and policy checks |
| Tool contract | "A function schema" | Inputs, outputs, permissions, side effects, errors, and evidence for a capability |

## Mais leitura

- [Agent Skills specification](https://agentskills.io/specification)para o diretório portátil e o contrato de material frontal.
- [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices)para o âmbito, instruções e organização dos recursos.
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills)para o comportamento atual de descoberta e invocação do Codex.
- [Claude Code skills](https://code.claude.com/docs/en/skills)para invocação, argumento, ferramenta e extensões de contexto delegado de um tempo de execução.
