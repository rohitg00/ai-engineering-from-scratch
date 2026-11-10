# Descobrir habilidades e revelar progressivamente

> Uma habilidade torna-se útil antes de seu corpo ser carregado. Seu nome e descrição ganham um lugar no catálogo; seus arquivos mais profundos ganham contexto somente quando a tarefa os alcança.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 13 · 22 (Agent Skills: Portable Contract and Runtime Boundary)
**Time:** ~105 minutes

## Objetivos de aprendizagem

- Construir um pipeline de descoberta de sistemas de arquivos que separe o escopo, validação, política de colisão e publicação de catálogos.
- Explique os três níveis de divulgação: metadados do catálogo, instruções ativas e recursos específicos de tarefas.
- Referências de design para que um agente possa chegar diretamente aos detalhes necessários sem carregar todo o pacote.
- Espaço de catálogo orçamental independentemente do contexto das competências ativas.
- Rejeitar a travessação do caminho e escapar do link quando uma habilidade lê os seus próprios recursos.

## O problema

O seu agente tem 200 habilidades instaladas.`SKILL.md`, arquivo de referência, script e modelo no início da sessão enterraria a tarefa atual em procedimento não relacionado. Carregar nada forçaria o usuário a lembrar os caminhos exatos do sistema de arquivos.

O compromisso habitual é um catálogo: mostrar ao modelo uma identidade compacta e uma descrição de roteamento para cada habilidade elegível, e depois carregar o corpo inteiro apenas após a selecção.

Primeiro, a descoberta não é apenas uma pesquisa de arquivos recorrente. As habilidades podem existir em projetos, usuários, administradores, plugins ou escopes integrados. Dois pacotes podem compartilhar um nome. Um link simétrico pode apontar para fora da raiz confiável. Um pacote mal formado pode consumir espaço de catálogo ou tornar-se impossível de invocar.

Segundo, a divulgação progressiva pode tornar-se progressiva confusão.`SKILL.md`O modelo deve adivinhar se cada guia aponta para mais três arquivos, o carregamento se torna um gráfico sem limites.

Um bom tempo de execução torna a descoberta determinista e a divulgação intencional.

## O conceito

### O Discovery é um pipeline de compiladores

Trate o sistema de arquivos como entrada de fonte. Não publique caminhos brutos diretamente para o modelo.

```figure
skill-discovery-pipeline
```

Cada fase deve produzir dados estruturados e falhas estruturadas.

- Que raízes foram pesquisadas?
- Que candidatos foram encontrados?
- Quais candidatos foram rejeitados e por quê?
- Qual pacote ganhou uma colisão?
- Quais catálogos foram reduzidos ou omitidos por causa do orçamento?

Sem essa evidência, "o modelo não usou a minha habilidade" é quase impossível diagnosticar.

### O âmbito é a política de tempo de execução

A especificação portátil define um pacote de habilidades, não um caminho de instalação universal ou ordem de prioridade.

Um runtime genérico pode usar estes escopo:

| Scope | Example root | Intended ownership |
|---|---|---|
| Workspace | `<repo>/.agents/skills/` | Project maintainers |
| User | `<user-data>/skills/` | One developer |
| Administrator | `<system>/skills/` | Machine or organization policy |
| Plugin | A signed plugin bundle | Plugin publisher and installer |
| Built-in | Runtime package | Runtime vendor |

Em agosto de 2026, o Codex documenta o projeto de descoberta de `$CWD/.agents/skills`através de diretórios ancestrais até a raiz do repositório, além de usuário, administrador e localizações embutidas. Suporta diretórios de habilidades sinligados. Os nomes duplicados podem aparecer em vez de serem fundidos.`SKILL.md`Verificar a corrente [Codex skill documentation](https://learn.chatgpt.com/docs/build-skills)Quando escrevo um adaptador.

Nunca invente a prioridade dos nomes dos diretórios, declare-o como política e teste-o.`Scope`Então o mesmo conjunto de candidatos sempre resolve da mesma forma.

### As colisões precisam de uma identidade além .`name`

Dois pacotes denominados `release-readiness`Uma das entradas de catálogo pode ser uma sobreposição do espaço de trabalho e uma de usuário padrão.

```json
{
  "name": "release-readiness",
  "description": "Inspect a release candidate for this repository.",
  "scope": "workspace",
  "source": "/repo/.agents/skills/release-readiness",
  "selected": true
}
```

As políticas comuns de colisão incluem:

| Policy | Benefit | Risk |
|---|---|---|
| Keep every candidate | Nothing is hidden | The model sees ambiguous names |
| Highest-precedence scope wins | Simple invocation | A local package can shadow a trusted one |
| Reject duplicates | No silent shadowing | Legitimate overrides stop working |
| Qualify names by source | Explicit identity | User-facing names become longer |

Escolha uma política para o anfitrião. Preserva os candidatos rejeitados ou sombreados no diagnóstico, mesmo quando eles estão ausentes do catálogo de modelos.

### Três níveis de divulgação

A especificação de habilidades do agente descreve a carga em fases.

```figure
skill-disclosure-levels
```

#### Nível 1: Metadados de catálogo

O modelo precisa de informações suficientes para distinguir a habilidade dos vizinhos. A especificação estima cerca de 100 tokens por entrada de catálogo, mas a serialização e tokenization reais pertencem ao anfitrião.

Uma descrição útil tem duas cláusulas:

```yaml
description: Validate a release candidate and produce a readiness report. Use when the user asks whether a version, tag, or package is ready to publish.
```

A primeira cláusula indica a capacidade, a segunda indica o limite de desencadeamento, e a lição 25 avalia esse limite com indicações positivas e quase-missas.

#### Nível 2: instruções ativas

Após a activação, o organismo deve funcionar como um mapa e um procedimento.`SKILL.md`Isso é um sinal de design, não um alvo a preencher.

O corpo deve conter:

- O limite de tarefa;
- O fluxo de trabalho padrão;
- condições de sucursal;
- Referências directas a ficheiros mais profundos;
- Contratos de ferramentas e guiões;
- A falha e o comportamento de parada;
- A produção esperada e a sua verificação.

Não transforme o fluxo de trabalho central para uma referência apenas para reduzir o arquivo de entrada.

#### Nível 3: recursos de apoio

As referências fornecem prosa ou dados. Os scripts fornecem cálculo determinista. Os ativos são copiados, preenchidos ou transformados em resultados em vez de serem tratados como instruções.

| Directory | Model reads it? | Model executes it? | Typical content |
|---|:---:|:---:|---|
| `references/` | Yes, when needed | No | schemas, policies, domain guides |
| `scripts/` | May inspect it | Through a permitted tool | validators, converters, collectors |
| `assets/` | Only if useful | No | templates, fixtures, images, starter files |

Estes nomes são convenções, não capacidades mágicas.

### Referências específicas de setores ultrapassam as descargas de tópicos

Escreva o ficheiro de entrada como um mapa de decisão:

```markdown
## Choose the path

- For a Python package, read `references/python-release.md`.
- For a container image, read `references/container-release.md`.
- For a documentation-only release, read `references/docs-release.md`.
- If the release combines artifact types, read only the guides for those artifacts.
```

Isto dá a cada referência uma condição de carga observável.`references/`Não é por mais.

A orientação oficial recomenda links diretos de `SKILL.md`Um salto torna a acessibilidade testável e reduz a possibilidade de uma restrição necessária nunca entrar no contexto.

```figure
skill-reference-map
```

### O orçamento do catálogo e o contexto ativo são orçamentos diferentes

Deixe-me .`c_i`ser o custo do catálogo serializado de habilidade `i`- Não .`B_c`O orçamento do catálogo, `b_j`O custo do organismo ativo e `r_k`Os recursos realmente carregados.

```text
catalog_cost = sum(c_i for every published skill)
active_cost = sum(b_j for every activated skill) + sum(r_k for every disclosed resource)
```

A redução de um orçamento não reduz automaticamente o outro. Descrições curtas podem economizar espaço no catálogo enquanto um corpo de 900 linhas ainda se torna um grande problema.

O Codex atualmente orçam a lista inicial de habilidades em 2% do contexto
O valor de 8.000 caracteres é um valor de 8.000 caracteres.
A queda só ocorre quando esse tamanho não é conhecido; não é um segundo limite combinado com
Quando o catálogo exceder o orçamento aplicável,
As descrições podem ser abreviadas ou omitidas.
Política do Codex, não é uma propriedade do padrão de Habilidades de Agente.

### Os caminhos de recursos são um limite de confiança

Uma habilidade deve ler apenas os arquivos dentro de seu pacote.

```text
references/../../../../.ssh/config
references/external-link -> /private/company-secrets
```

Resolva a raiz do pacote e o candidato com semântica do sistema de arquivos, rejeite entradas absolutas e verifique se o candidato resolvido permanece sob a raiz resolvida. Decida se os sinalínquos são permitidos antes da descoberta. Se permitido, verifique o alvo resolvido sempre.

```figure
skill-resource-containment
```

A contenção de caminhos não estabelece confiança no conteúdo. Uma referência válida dentro do pacote ainda pode conter instruções maliciosas.

### A carga deve ser observável

Registrar eventos de divulgação sem registar segredos:

```json
{
  "event": "skill.resource.loaded",
  "skill": "release-readiness",
  "resource": "references/python-release.md",
  "reason": "candidate contains pyproject.toml",
  "bytes": 2840
}
```

A razão transforma uma escolha de contexto em evidências revisaveis. Também ajuda a identificar instruções que fazem com que o agente carregue cada arquivo "apenas no caso".

## Construí-lo

`code/main.py`construi um motor determinista de descoberta e divulgação.

A superfície de descoberta inclui:

- `Scope`Para os metadados de origem e de prioridade;
- `SkillCandidate`para um candidato a um sistema de ficheiros não validado;
- `discover_scope(scope)`Enumerar directórios de competências imediatas;
- `resolve_collisions(candidates, precedence)`aplicar uma política declarada;
- `CatalogEntry`E ...`build_catalog(...)`Publicar metadados limitados;
- `CatalogBudget`Para explicar as entradas serializadas sem fingir que os caracteres são tokens universais.

A superfície de divulgação inclui:

- `load_skill_body(entry, ...)`para a ativação de nível 2;
- `validate_reference(skill_dir, reference)`para contenção de caminhos;
- `load_reference(...)`para leituras de nível 3 limitadas.

- Dirigir o laboratório:

```bash
cd "$(git rev-parse --show-toplevel)"
cd phases/13-tools-and-protocols/24-skill-discovery-and-progressive-disclosure
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Este bloco requer um clone local e resolve a raiz do repositório de qualquer
O diretório de trabalho dentro desse clone.

A demonstração cria espaços temporários de projeto e usuário, inserir uma colisão, construir um catálogo sob um orçamento deliberadamente pequeno, ativar uma habilidade e tentar uma leitura de referência válida e uma fuga de travessia.

### Por que a descoberta é superficial

`discover_scope`verifica os directórios de crianças imediatas para `SKILL.md`Não trata recorrentemente todos os aninados .`SKILL.md`O sistema de informação é utilizado para a comunicação de dados e de dados, e é utilizado para a comunicação de dados e de dados.

### Por que o laboratório não analisa YAML arbitrário

O laboratório suporta a matéria frontal escalar necessária para seu catálogo. Um tempo de execução de produção deve usar um parser YAML seguro com um esquema explícito, limites de tamanho e desabilitado construção de objetos personalizados. "Stdlib-only" é uma restrição de ensino, não permissão para inventar um dialeto parcial de YAML em silêncio.

## Usá-lo

Aplicar esta lista de verificação a qualquer adaptador de descoberta:

1. Lista todas as raízes configuradas e quem pode escrever para ele.
2. Indicar se são permitidas embalagens sincronizadas.
3. Validar o nome do pacote, o nome do diretório, os metadados necessários e o tamanho do corpo de entrada.
4. Preservar a fonte e o escopo na identidade interna.
5. Declarar e testar o comportamento de duplicado de nome.
6. Meter o catálogo serializado exato enviado ao modelo.
7. Registrar o motivo pelo qual um corpo ou recurso foi carregado.
8. Mantenha as leituras de recursos dentro da raiz do pacote resolvido.
9. Falha claramente quando um arquivo de referência está faltando.
10. Reconstruir o catálogo quando as instalações ou as políticas mudarem.

## Envia-o

Esta lição produz os`skill-catalog-builder`O sistema de dados de base de dados de base de dados é um sistema de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de base de dados de dados de base de dados de dados de base de dados de dados de base de dados de dados de base de dados de dados de base de dados de dados de base de dados de dados de dados de base de dados de dados de dados de dados de base de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de

Seu relatório JSON contém entradas selecionadas, candidatos sombreados, entradas omitidas, erros de validação, prioridade e uso de orçamento.

## Exercícios

1. Adicione um escopo de plug-in e coloque-o entre o usuário e a prioridade incorporada.
2. Mudança da política de colisão da mais alta prioridade para nomes qualificados.
3. Adicionar um limite de tamanho de byte para `load_reference`Teste um arquivo exatamente no limite e um byte acima dele.
4. Crie duas descrições que soem quase idênticas e reescreva-as para que os limites do gatilho não se sobreponham.
5. Adicione um manifesto contendo hashes para cada referência e script. Detecte um recurso modificado antes de carregá-lo.
6. Instrumentar a demonstração para relatar os números de byte de Nível 1, Nível 2 e Nível 3 separadamente.

## Termos-chave

| Term | What people say | What it actually means |
|---|---|---|
| Skill discovery | "Find every SKILL.md" | Search configured scopes, validate packages, attach provenance, and apply policy |
| Skill catalog | "The list of installed skills" | Compact model-visible routing metadata for eligible packages |
| Collision policy | "Which duplicate wins" | A declared rule for same-name candidates from different sources |
| Progressive disclosure | "Lazy loading" | Staged context admission from catalog to body to branch-specific resources |
| Reference graph | "Files linked by the skill" | The reachable resource structure and its load conditions |
| Path containment | "Stay in the folder" | Verify resolved resource targets remain inside the resolved package root |

## Mais leitura

- [Agent Skills specification](https://agentskills.io/specification)para a forma da embalagem e os níveis de divulgação progressivos.
- [Optimizing skill descriptions](https://agentskills.io/skill-creation/optimizing-descriptions)para metadados de roteamento de catálogos.
- [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices)Para referências directas e tamanho do ficheiro de entrada.
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills)para os atuais escopo de descoberta do Codex e limites do catálogo.
