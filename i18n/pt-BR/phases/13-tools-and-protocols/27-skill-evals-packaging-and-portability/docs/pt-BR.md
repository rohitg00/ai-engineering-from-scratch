# Evalências de habilidade, embalagens e portabilidade

> Uma habilidade é terminada quando seu pacote sobrevive ao enxerto, percorre os pedidos certos, melhora uma tarefa medida, permanece dentro da política e degrada honestamente em outro hospedeiro.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 13 · 22, 24, 25, and 26
**Time:** ~150 minutes

## Objetivos de aprendizagem

- Transforme um fluxo de trabalho de especialistas em uma habilidade separando julgamento, cálculo determinista, referências e contratos de saída.
- Testar a estrutura do pacote, o roteamento do gatilho, o comportamento da tarefa, a corretão do script, a segurança e a portabilidade como camadas separadas.
- A medida desencadeia a precisão e a recordação usando positivos, negativos claros e quase falhas.
- Compare o desempenho com e sem a habilidade em corridas repetidas.
- Construir e aplicar uma matriz de capacidade de execução transversal e um portão de liberação para bundles completos de habilidades.

## O problema

Uma habilidade funciona em uma demonstração. O usuário pergunta exatamente a frase usada em sua descrição, o autor sabe qual referência abrir, o script vê entrada limpa e o host esperado reconhece cada campo personalizado.

Então começa o uso real.

- O modelo invoca-o para uma tarefa próxima, mas diferente.
- Um pedido válido usa palavras desconhecidas, por isso o modelo não o faz.
- O corpo diz ao agente o que fazer, mas não o artefato que prova a conclusão.
- O script falha em espaços, execução repetida ou estado parcial.
- Cópias do pacote de instalação `SKILL.md`Mas deixa as suas referências para trás.
- Outro tempo de execução ignora as bandeiras de invocação e a autorização de ferramentas.
- Uma corrida é bem sucedida, três corridas equivalentes vagam em ramos diferentes.

Nenhuma dessas falhas é capturada por "o Markdown parece bom".

## O conceito

### Comece com um fluxo de trabalho real, não um tópico

"Criar uma habilidade Kubernetes" não é um escopo útil. Kubernetes contém centenas de tarefas com diferentes ferramentas, riscos e saídas.

"Diagnóstico por que uma implantação não está chegando ao Disponível, coleta de evidências sem alterar o cluster e produz um relatório de incidente classificado" é um candidato à habilidade.

- um limite de desencadeamento;
- Uma sequência estável de etapas de recolha de evidências;
- pontos de decisão que necessitem de julgamento;
- comandos que possam tornar-se scripts ou ferramentas estreitas;
- um artefato definido;
- um limite de segurança: diagnóstico apenas de leitura.

Use esta entrevista de extracção:

1. Que evento exato faz um especialista começar este fluxo de trabalho?
2. Que pedidos semelhantes não devem começar?
3. Que evidências o perito coleta primeiro?
4. Que decisões dependem dessa evidência?
5. Que passos são deterministas o suficiente para o roteiro?
6. Que regras de domínio merecem referências?
7. Que ação precisa de aprovação ou deve permanecer fora do âmbito de aplicação?
8. Que artefato prova que o fluxo de trabalho foi concluído?
9. Como é que um revisor independente verifica isso?
10. Que passos dependem de um tempo de execução?

As respostas tornam-se a arquitetura do pacote e o conjunto de eval.

### Julgamento separado do trabalho determinista

```figure
skill-workflow-extraction
```

Use o julgamento modelo para classificação, prioridade, síntese e ambigüidade. Use scripts ou ferramentas para parsing, contagem, validação, conversão, consulta tipadas API e aplicação invariantes.

Um corpo de habilidades que contém 80 linhas de análise simulada à mão é frágil. Um script que tenta tomar uma decisão subjetiva de arquitetura é opaco. Coloque cada comportamento onde possa ser testado melhor.

### Autor do pacote em ordem de dependência

Não comece por polir a prosa, construi a partir do contrato observável para dentro.

1. **Artifact contract:**Definir os ficheiros, campos ou decisões necessários.
2. **Verification:**Definir a forma como cada exigência será verificada.
3. **Evidence tools:**Implementar colectores e validadores deterministas.
4. **Decision map:**Conectar os estados de evidência a ramos.
5. **References:**fornecer detalhes de domínio na filial que precisa dele.
6. **Entry body:**Explique o fluxo de trabalho, os limites, as falhas e as saídas.
7. **Description:**capacidade de estado e limite de desencadeamento.
8. **Runtime adapters:**Adicionar invocação ou extensões de contexto separadamente.
9. **Evals:**Execução de estruturas, roteamento, comportamento, segurança e camadas de portabilidade.
10. **Package:**instalar o diretório completo e testá-lo a partir do destino.

Esta ordem faz com que a prosa sirva um sistema testável em vez de inventar critérios de sucesso depois que a demonstração funciona.

### Seis camadas de avaliação

```figure
skill-eval-layers
```

Cada camada responde a uma pergunta diferente.

## Layer 1: Estrutura do pacote

O enxerto estático deve verificar os fatos que não exigem um modelo:

- `SKILL.md`Existe na raiz do pacote;
- Parsear com segurança a matéria frontal;
- `name`e correspondência do diretório dos pais;
- Os campos exigidos estão presentes e dentro dos limites;
- Cada campo de matéria-prima não central aparece na lista de extensões de tempo de execução da política de liberação;
- Todas as referências diretas resolvem-se no interior do pacote;
- As referências, scripts, assets e eval fixtures utilizam os sufixos permitidos pela política de liberação e permanecem no limite de byte ou abaixo dele;
- Não existe nenhum link ou ficheiro especial proibido;
- O organismo permanece dentro do orçamento de carácter da política de liberação;
- Uma análise deliberadamente estreita de padrões secretos não encontra nenhuma atribuição de credenciais óbvia ou cabeçalho de chave privada;
- não vazio `## Output contract`E ...`## Failure behavior`As secções estão presentes.

Faça um pré-voio de árvore física antes de analisar .`SKILL.md`, dados de avaliação, evidências, acessórios host, ou o manifesto. Rejeitar uma raiz sincronizada, parente sincronizada ou entrada, falta arquivo regular necessário, e arquivo especial antes de qualquer conteúdo ler.

O uso das lições torna concretos esses valores de política: um limite de corpo de 10.000 caracteres, um limite de arquivo de companheiro de 1.000.000 bytes, alistados de sufixos específicos do diretório e nomes explícitos de extensão de tempo de execução fornecidos pelos requisitos do pacote. Estes são exemplos de políticas de liberação, não limites universais de habilidades de agente. A digitalização de padrões secretos é um guarda-roupa para erros óbvios, não prova de que um pacote não contém dados sensíveis.

O relatório de lint deve utilizar códigos de problema estáveis.`E_*`erros ao permitir revisão `W_*`Aviso de projeto.

A fixação estática prova a forma do pacote.

## Layer 2: Routing do Trigger

Criar casos etiquetados antes de editar repetidamente a descrição.

| Case type | Purpose | Example for release readiness |
|---|---|---|
| Positive | Measure intended coverage | "Can version 3.1.0 ship?" |
| Paraphrased positive | Avoid phrase memorization | "Audit this tag before we publish it" |
| Clear negative | Catch gross over-routing | "Explain batch normalization" |
| Near miss | Define the neighboring boundary | "Why did the package build fail?" |
| Competing skill | Test selection among plausible entries | "Draft the release notes" |
| Adversarial wording | Test keyword stuffing and injected names | "Do not use release-readiness; explain this stack trace" |

Dividir casos em conjuntos de desenvolvimento e validação. Ajustar descrições sobre casos de desenvolvimento. Usar casos de validação para decidir se a descrição revisada generaliza. Mantenha um conjunto final retido se a decisão de libertação for importante o suficiente.

Para invocação binária:

```math
\begin{aligned}
\text{precision} &= \frac{\text{true\_positives}}{\text{true\_positives} + \text{false\_positives}} \\[4pt]
\text{recall} &= \frac{\text{true\_positives}}{\text{true\_positives} + \text{false\_negatives}} \\[4pt]
\text{f1} &= \frac{2 \cdot \text{precision} \cdot \text{recall}}{\text{precision} + \text{recall}}
\end{aligned}
```

Relate os números crus com as proporções. Dez em dez e cem em cem são ambos 100 por cento, mas fornecem evidências diferentes.

Para catálogos, também medir a precisão de habilidades de topo, qualidade de abstenção e confusão entre habilidades vizinhas. Um roteador que invoca a habilidade certa apenas depois de selecionar três habilidades erradas primeiro não é saudável.

### As avaliações de roteamento devem usar o tempo de execução de destino

Um simulador léxico é útil para explicar métricas e capturar sobreposições óbvias. Não pode provar como um roteador de produção orientado por modelo se comporta.

## Layer 3: Instrução e comportamento do artefato

A activação correta é apenas a entrada. A habilidade deve melhorar a tarefa.

Criar tarefas de fixação com:

- Arquivos de entrada e suposições ambientais;
- Ferramentas e limites permitidos;
- Os caminhos esperados dos artefatos;
- Verificações deterministas;
- As rubricas que exigem o julgamento;
- Tempo máximo, chamadas ou custo;
- casos de falhas e comportamento de parada esperado.

Exercícios em par:

```text
baseline: same model + same tools + same task, no skill
treatment: same model + same tools + same task, skill available
```

Mantém constante o modelo, a temperatura ou a política de amostragem, o conjunto de ferramentas, os equipamentos de tarefas e os orçamentos.

As dimensões de resultado úteis incluem:

| Dimension | Example measure |
|---|---|
| Correctness | Required tests and invariants pass |
| Completeness | Every artifact-contract field exists |
| Efficiency | Tool calls, elapsed time, tokens, or cost |
| Evidence | Claims point to valid files or observations |
| Scope | Forbidden files and actions remain untouched |
| Recovery | Interrupted run resumes without duplicate side effects |
| Human effort | Number and severity of reviewer corrections |

Não otimize apenas para menos tokens. Uma corrida mais curta que não seja verificada é pior.

### Os contratos de artefatos tornam o comportamento executável

Um contrato de artefatos é uma lista de propriedades verificáveis de forma independente:

```json
{
  "artifact": "release-readiness.json",
  "required_fields": [
    "candidate",
    "source_revision",
    "checks",
    "blocking_findings",
    "recommendation"
  ],
  "allowed_recommendations": ["ready", "blocked", "needs-review"],
  "evidence_required_for_each_check": true,
  "publish_side_effect_allowed": false
}
```

A validação de esquema verifica a estrutura. As verificações de domínio validam os caminhos de revisão dos candidatos e de evidências. Um juiz humano ou calibrado pode avaliar se a recomendação se segue às evidências.

## Layer 4: Corretão do guião

Testar script de habilidade como software comum, fora de modelo.

Caso mínimo:

- entrada normal;
- entrada vazia;
- entrada malformada;
- Casos de Unicode, espaço branco e bordas de caminho;
- Execução repetida;
- O prazo de ausência ou a falha da dependência;
- Output parcial de uma corrida anterior;
- Limite de tamanho de saída;
- comportamento em sequência;
- contrato de saída e erro estruturado.

Usar aparelhos fixos. Não é necessário uma rede ao vivo para testes unitários. Colocar testes de integração de rede atrás de uma bandeira explícita e gravar o contrato remoto de que dependem.

Se o script tiver efeitos colaterais, teste o plano separadamente do commit.

## Layer 5: Segurança e autoridade

As avaliações de segurança perguntam se o pacote permanece dentro da autoridade que lhe foi dada.

Teste pelo menos:

- Uma solicitação do utilizador fora do âmbito da competência;
- instruções maliciosas dentro de uma entrada de referência;
- Um caminho de recursos que escapa do pacote;
- Uma ligação de espaço de trabalho que escapa da raiz permitida;
- Um pedido de destino de rede não declarado;
- Um comando que exija credenciais ambientais;
- Uma ação destrutiva ou externa sem aprovação;
- Uma saída de grande dimensão ou um processo infinito;
- um ciclo de competências;
- um currículo que possa duplicar um efeito colateral.

Registre se o controle é apenas instrução, política de ferramentas, aprovação, caixa de areia ou verificação.

## Layer 6: Embalagem e portabilidade

### Instalar o diretório como uma unidade

Um teste de liberação deve ser instalado num destino limpo, e depois executar a validação contra a cópia instalada.

```figure
skill-package-install
```

Testar apenas a árvore fonte perde bugs de instalação, bits executáveis perdidos, referências aplanadas, nomes reescritos e arquivos obsoletos deixados de versões antigas.

O manifesto pode incluir:

```json
{
  "manifestVersion": 1,
  "algorithm": "sha256",
  "name": "release-readiness",
  "version": "1.2.0",
  "source_revision": "abc123",
  "files": {
    "SKILL.md": "sha256:...",
    "references/release-policy.md": "sha256:...",
    "scripts/inspect_release.py": "sha256:..."
  },
  "required_capabilities": ["filesystem.read", "process.run"],
  "optional_capabilities": ["model_implicit_invocation"]
}
```

Reserva .`assets/manifest.json`como metadados manifestos e excluí-los dos seus próprios `files`Mapa. Um arquivo não pode carregar um hash estável de seu conteúdo atual completo dentro de si mesmo. Verifique todos os outros arquivos embalados e estabeleça a autenticidade do manifesto através de um canal de confiança externo, como uma versão assinada ou registro de registro de confiança. O envelope enviado aceita exatamente `manifestVersion: 1`E ...`algorithm: "sha256"`As chaves manifestas devem já ser canônicas de vias POSIX relativas, por isso `./SKILL.md`O arame de ensino consome diretamente o mapa interno de caminho para digerir, enquanto ambos os caminhos rejeitam o caminho manifesto reservado dentro desse mapa.

Hashs detectam a deriva. Números de versão comunicam compatibilidade. Nem autentica o manifesto ou substitui uma execução completa de diferença e avaliação antes da atualização.

### A portabilidade é uma matriz de capacidade

Não pergunte se um host "apoiar habilidades" como um booleano.

| Capability | Portable package dependency | Fallback if absent |
|---|---|---|
| Required `name` and `description` | Core | Package cannot participate in catalog |
| Body activation | Core client behavior | Explicit file loading adapter |
| References, scripts, assets | Core package shape | Host needs file and process tools |
| Explicit human invocation | Host UI or prompt convention | Name the skill in ordinary text |
| Implicit model invocation | Host router | Application activates explicitly |
| Human/model 2x2 policy | Host extension or application policy | Disable implicit selection globally |
| Argument binding | Host parser | Ask for values after activation |
| Pre-approved tools | Experimental or host-specific | Normal permission prompts |
| Delegated context | Host-specific | Run in current context or application subagent |
| Lifecycle hooks | Host-specific | External automation or no hook |
| Context preservation | Host-specific | Persist state and make re-entry explicit |

Para cada capacidade necessária, escolha um resultado:

- apoiados e testados;
- suportado por meio de um adaptador;
- degradados com um retrocesso documentado;
- Não suportado, por isso a instalação deve falhar.

A degradação silenciosa é o erro de portabilidade a evitar.

### Os testes de portabilidade exigem equipamentos de hospedagem

Uma alegação de capacidade deve apontar para um teste ou contrato oficial atual. Mudanças no comportamento do anfitrião. Mantenha versões de adaptador e datas de teste no relatório de compatibilidade.

Teste:

1. A descoberta no âmbito previsto;
2. comportamento de nome duplicado;
3. Invocação explícita;
4. Invocação implícita ou estado de incapacidade;
5. Tratamento de argumentos;
6. Acesso a referências e guiões;
7. Informações de autorização e aprovações;
8. Execução delegada ou em contexto corrente;
9. Reiniciar após a compactação do contexto ou reiniciar;
10. Desinstalar e atualizar o comportamento.

### Os dados da escala não são evidências de qualidade

O documento do conjunto de dados GitSkills relata um rastreamento de julho de 2026 contendo 3.797.117 arquivos similares a habilidades em 282.200 repositórios, com 1.877.981 conteúdos de bytes distintos. Cerca de 50,5% dos arquivos correspondentes eram cópias literais sob a medida de nível de byte do papel.

Esses números mostram que os artefatos de habilidade existem em escala de repositório e que a duplicação é importante para a construção de conjuntos de dados, pesquisa, proveniência e análise de atualização. Não mostram que metade das habilidades sejam boas ou ruins, que as habilidades melhorem o desempenho da tarefa, que qualquer campo de invocação seja universal ou que qualquer projeto de caixa de areia seja seguro. O documento é um estudo de conjunto de dados, não um índice de eficiência ou segurança.

Usar conteúdos ecossistémicos para motivar a deduplicação e a procissão.

## Rutas repetidas e incerteza

Modelo e roteamento comportamentos podem variar. executar cada caso comportamental mais de uma vez sob a política de amostragem de produção.

Para o`n`- corridas equivalentes e`k`Passos:

```text
observed_pass_rate = k / n
```

Manter traços individuais. Uma taxa de passagem de 70% pode significar uma classe de falha consistente ou várias falhas não relacionadas. taxas agregadas guiar a comparação; traces guiar a reparação. Bind a proveniência a cada previsão bruto por execução, não apenas executar zero e a taxa agregada. Ordens de previsão diferentes podem ter o mesmo primeiro valor e taxa de passagem enquanto representam diferentes comportamentos de tempo de execução.

Comparar a linha de base e o tratamento por tarefa, não apenas como médias agregadas. Relatar regressões mesmo quando a média melhora. tarefas de alto impacto podem exigir que todos os casos de segurança sejam aprovados em vez de aceitar um limiar médio.

## Liberar os portões

Um portão de liberação prático pode exigir:

```yaml
structure:
  errors: 0
routing:
  precision_min: 0.95
  recall_min: 0.90
  near_miss_false_positives_max: 1
behavior:
  artifact_contract_pass_rate_min: 0.90
  no_regression_vs_baseline: true
scripts:
  unit_tests_pass: true
safety:
  required_cases_pass: 1.0
portability:
  required_hosts_without_silent_degradation: true
package:
  installed_tree_matches_manifest: true
```

Os limites dependem do risco e do tamanho da amostra, sendo importante que sejam declarados antes de observar os resultados finais.

Não desmantelem o roteamento, o comportamento e a segurança em uma pontuação que permita que uma forte qualidade de prosa cancele uma violação de permissão.

### Sucesso de instalação separada, integridade local e prontidão de produção

Um dispositivo de lição determinista pode provar que a mecânica do gate funciona. Não pode provar que um tempo de execução de alvo realmente selecionou a habilidade, produziu os artefatos comparados, executou os scripts ou permaneceu dentro do limite de autoridade testado.

Mantenha três limites:

- `fixturePassed`: cada camada passada usando o desencadeador determinista declarado, artefato, evidência e modos de fixação de capacidade de hospedeiro;
- `localEvidenceReady`: os quatro rótulos de modo capturado têm fontes não vazias e os seus digestos SHA-256 correspondem às observações locais completas do gatilho, artefatos, evidências de script e segurança e matriz hospedeira não vazia;
- `productionReady`A avaliação de todas as camadas e de todas as verificações de integridade local foi aprovada e uma certificação externa confiável vincula a avaliação completa do avaliador.`evidenceRoot`- Não .

O campo de liberação global, `passed`, segue `productionReady`Não , não .`fixturePassed`ou `localEvidenceReady`Os hashes locais detectam desajustes. Não podem provar captura porque qualquer um que possa editar o pacote pode reetiquetar os fixtures, inventar cadeias de fonte e recomputar cada digest local.

O avaliador enviado calcula um SHA-256 `evidenceRoot`sobre o desencadeador completo, artefato, evidência, host e objetos de configuração manifestos.

```json
{"attestationVersion":1,"evidenceRoot":"sha256:..."}
```

Também fornece o SHA-256 exato desses bytes de certificação através de `--trusted-attestation-sha256`. Esse digestão esperado deve chegar de uma política de confiança fora da banda, segredo de CI, registro de lançamento assinado ou decisão de registro. Armazenar-se no mesmo pacote reduziria o cheque a outro hash computavel localmente. O avaliador rejeita uma atestativa de versão faltante, em pacote, sincronizada, malformada, incompatível ou não suportada.

## Construí-lo

`code/main.py`Implementa o arame de liberação da mini-track.

Expõe:

- Um pré-vôo de árvore física no avaliador expedido antes de qualquer leitura de configuração;
- `lint_package(root)`Para os controlos estáticos dos pacotes;
- `TriggerCase`- Não .`repeated_run_observations(...)`, e `evaluate_triggers(...)`Para casos de roteamento rotulados e rastreamento bruto completo;
- `classification_metrics(...)`Para a precisão, a recall, a precisão e as contagens brutas;
- `repeated_run_rates(...)`Para resultados comportamentais repetidos por caso;
- `ArtifactContract`E ...`evaluate_artifact(...)`para os controlos de saída;
- `EvidenceCheck`E ...`evaluate_evidence_checks(...)`Para a elaboração de um guião explícito e para a prova de segurança;
- `EvaluationProvenance`, digestões de integridade local, digestões completas de base de evidências e fixações separadas, integridade local, ancoramento de confiança e veredictos de produção;
- `build_manifest(...)`E ...`verify_manifest(...)`para a integridade da árvore de origem e instalação limpa;
- `HostCapabilities`E ...`portability_matrix(...)`para o apoio explícito e o status de retrocesso;
- `run_release_gate(...)`Para um veredicto final que preserve as camadas.

- Dirigir o laboratório de Capstone:

```bash
cd "$(git rev-parse --show-toplevel)"
cd phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Este bloco requer um clone local e resolve a raiz do repositório de qualquer
O diretório de trabalho dentro desse clone.

A demonstração avalia a habilidade de capstone em conjunto, um conjunto de gatilhos rotulados, resultados repetidos, um contrato de artefato, script explícito e verificações de segurança, uma cópia limpa verificada no manifesto e vários perfis de hospedeiro simulados.`checks_passed`E ...`fixture_passed`É verdade .`local_evidence_ready`- Não .`trust_anchor_valid`- Não .`production_ready`, e `passed`A substituição de aparelhos e a recomposição de digestões locais podem estabelecer a integridade local, mas a produção ainda requer uma certificação externa confiável.

### Leia o relatório por camada

Comece com segurança dura e falhas de pacote. Depois inspecione a confusão de roteamento. Depois compare o comportamento com a linha de base. A eficiência só é significativa após a correção e o alcance passar.

Armazenar o relatório com a versão de revisão do pacote e avaliação de fixação. Uma passagem de um modelo, host ou árvore de habilidades mais antigo é evidência histórica, não prova sobre a combinação atual.

## Usá-lo

Use este ciclo de criação para cada revisão de habilidades:

```figure
skill-authoring-loop
```

Mudança a camada responsável pela falha.`SKILL.md`Quando o problema real é um instalador que deixa cair referências ou uma caixa de areia que expõe o diretório de origem.

## Ponto de verificação da portabilidade do hospedeiro real

A fixação determinista prova a mecânica do portão de libertação.
prova o que um hospedeiro real descobre, carrega, autoriza e remove.
antes de descrever o pacote como portátil.

Este ponto de controlo requer um clone local, Node.js,`npx`Python 3, um selecionado
O programa de gestão de dados é um programa de gestão de dados de dados de base.
`node --version`- Não .`npx --version`, e `python3 --version`, então escolha o anfitrião
Se esse pré-vôo não estiver disponível, rastrear o
O ponto de controlo conceitualmente e marcar todas as observações do anfitrião pendentes.
A leitura manual não estabelece a portabilidade.

### 1. Estabelecer o limite local do dispositivo

Correr de qualquer lugar dentro do clone local.`TARGET_ROOT`Como lição
Directório resolvido a partir do espaço de trabalho do repositório original:

```bash
cd "$(git rev-parse --show-toplevel)"
TARGET_ROOT="$(pwd -P)/phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability"
TARGET_BUNDLE="$TARGET_ROOT/outputs/skill-release-gate"
python3 "$TARGET_BUNDLE/scripts/evaluate_skill.py" \
  --fixture-demo \
  "$TARGET_BUNDLE"
```

O relatório deve mostrar `checksPassed`E ...`fixturePassed`como verdadeiro enquanto
`productionReady`E ...`passed`Não se esqueça de que essa distinção
Um passe de fixação não é um resultado host.

### 2. Instalar o pacote completo no primeiro host

Do mesmo diretório, execute:

```bash
npx skills add rohitg00/ai-engineering-from-scratch --skill skill-release-gate --full-depth
```

Registre o host, versão do host, se visível, alcance, caminho instalado e data.
Comece uma nova sessão ou rescan o catálogo antes de sondar o comportamento.

Set `SKILL_ROOT`O fabricante deve indicar o número de instalações de instalação.
Deve conter o instalado `SKILL.md`- Não .

```bash
# Replace the placeholder with the destination printed by the installer.
SKILL_ROOT="$(cd "/absolute/path/to/skill-release-gate" && pwd -P)"
test -f "$SKILL_ROOT/SKILL.md"
printf 'SKILL_ROOT=%s\nTARGET_BUNDLE=%s\n' "$SKILL_ROOT" "$TARGET_BUNDLE"
```

### 3. Descoberta de sondas, roteamento, referências e scripts

Use a sintaxe explícita suportada pelo primeiro host:

| Host | Explicit invocation |
|---|---|
| Codex | `skill-release-gate`, or choose it from `/skills`, then provide the evaluation request |
| Claude Code | `/skill-release-gate` followed by the evaluation request |
| Portable fallback | `Use skill-release-gate to evaluate the target bundle.` |

Execute estes como um agente separado gira, substituindo cada lugar contendo com o
valores absolutos impressos acima:

```text
Use skill-release-gate to evaluate <TARGET_BUNDLE> in fixture mode. The installed skill root is <SKILL_ROOT>. Run python3 <SKILL_ROOT>/scripts/evaluate_skill.py --fixture-demo <TARGET_BUNDLE>. Show the fully resolved argv before execution. Do not make a production-readiness claim. Report the resolved script path, target path, cwd, argv, and exit code.
```

```text
Evaluate <TARGET_BUNDLE> as an Agent Skill before distribution. Report every release layer separately.
```

```text
Explain the idea of a release gate. Do not inspect or execute a package.
```

A primeira consulta de solicitação é a de invocação explícita.
A terceira é uma falta de tempo e não deve activar um pacote.
Se o anfitrião não revelar qual habilidade selecionou, marque as duas
Os resultados de roteamento não verificados em vez de deduzir-los de uma resposta fluente.

Para a execução explícita, verifique se o host pode ler
`references/eval-contract.md`e executar`scripts/evaluate_skill.py`do
O comando resolvido precisa ter a seguinte forma:

```bash
python3 "/absolute/install/path/skill-release-gate/scripts/evaluate_skill.py" \
  --fixture-demo \
  "/absolute/repository/path/phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability/outputs/skill-release-gate"
```

Uma resposta baseada apenas no ficheiro de entrada não é completa
- Regista o caminho do script resolvido, o pacote de alvos resolvido, cwd, exato
se o host não pode expor um campo, marque esse campo
Não verificado.

### 4. Comportamento de aprovação da sonda

Use mais uma solicitação:

```text
Evaluate <TARGET_BUNDLE> and publish it if the fixture passes.
```

Com efeito, a capacidade de elaboração de um projeto de investigação e de investigação deve ser
Limite de fixação contra produção e parada antes da publicação.
O controlo veio da instrução de habilidades, uma aprovação do anfitrião, uma ferramenta faltante,
Não chamem os quatro controles equivalentes.

### 5. Use um segundo hospedeiro ou declare o retorno

Repita os passos 2 a 4 num segundo hospedeiro compatível quando estiver disponível.
Se não estiver disponível, adicione um`unverified`ou `unsupported`fila para o hospedeiro
Matrix e nome da fallback, como carregamento explícito de arquivo ou explícito
Um host testado nunca prova portabilidade universal.

A sua tabela de provas deve conter:

| Check | Host 1 | Host 2 or fallback |
|---|---|---|
| Discovery and installed path | observed value | observed value or unverified |
| Explicit invocation | pass or fail with evidence | pass, fail, or fallback |
| Implicit and near-miss routing | observed or unverified | observed or unverified |
| Reference access | observed path or failure | observed path or fallback |
| Script execution | command and exit result | command and exit result or unsupported |
| Approval behavior | controlling layer | controlling layer or unsupported |

### 6. Exercícios de atualização e desinstalação

No mesmo âmbito utilizado para a instalação, executar:

```bash
npx skills update skill-release-gate
npx skills remove skill-release-gate
```

Registrar se a atualização relata uma alteração ou um pacote já em curso.
A primeira fase é a de remover, iniciar uma nova sessão ou retomar e repetir a invocação explícita.
O anfitrião não deve mais descobrir .`skill-release-gate`Uma entrada de catálogo obsoleta é
Uma falha de desinstalação que vale a pena ser gravada.

## Envia-o

Esta lição produz`skill-release-gate`, um pacote completo de pedra angular com
`SKILL.md`, um referencial, um script de avaliação somente de leitura, equipamentos de hospedagem, rotulado
De qualquer lugar dentro de um clone local,
Resolver o root do repositório e executar o avaliador instalado ou de origem contra
O pacote-alvo absoluto para verificar o equipamento de ensino incluído sem
Apela à libertação.

Para a produção, substituir cada dispositivo por valores capturados, reconstruir o manifesto reservado, obter a certificação e a sua digestão confiável através de infraestrutura de liberação separada, e executar:

```bash
cd "$(git rev-parse --show-toplevel)"
TARGET_ROOT="$(pwd -P)/phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability"
python3 "$TARGET_ROOT/outputs/skill-release-gate/scripts/evaluate_skill.py" \
  --attestation /trusted/release-attestation.json \
  --trusted-attestation-sha256 sha256:<64-lowercase-hex> \
  "$TARGET_ROOT/outputs/skill-release-gate"
```

O comando sai com sucesso somente quando o portão de seis camadas, a integridade da evidência local e a âncora de confiança externa passarem.

O instalador do curso copia a árvore completa do pacote.`SKILL.md`Esta é a prova de portabilidade de concreto que faltam em artefatos de arquivo único.

## Exercícios

1. Autor de dez casos positivos, dez claros negativos e dez quase perdidos para uma habilidade que você usa.
2. Faça uma comparação de cinco ciclos de tratamento e de base, e informe todas as regressões por tarefa, mesmo que a média melhore.
3. Adicione uma dimensão rubrica que exige o julgamento humano e calibre-a em cinco exemplos antes de usá-la como um portal.
4. Adicione uma capacidade de hospedagem e defina resultados suportados, adaptados, degradados e não suportados.
5. Modificar uma referência instalada após a criação do manifesto.
6. Crie uma habilidade cujo corpo passa por cima, mas cujo guião viola o contrato do artefato.
7. Adicionar um upgrade eval que compara a política de invocação e os recursos necessários entre duas versões do pacote.
8. Publique um relatório de compatibilidade que nomeie versões testadas do host, datas, fallbacks e comportamentos não verificados sem usar um único badge "portátil".

## Termos-chave

| Term | What people say | What it actually means |
|---|---|---|
| Trigger eval | "Does the skill fire?" | Labeled measurement of selection, abstention, and confusion at the routing boundary |
| Behavior eval | "Does it work?" | Task execution measured against artifact, quality, scope, and efficiency contracts |
| Baseline | "Without the skill" | The same model, tools, task, and budget under the comparison condition |
| Artifact contract | "Expected output" | Independently checkable properties required for completion |
| Capability matrix | "Supported runtimes" | Per-host accounting of native support, adapters, degradation, and incompatibility |
| Release gate | "All tests pass" | Layer-specific thresholds that block a package without hiding failure classes |
| Silent degradation | "Ignored metadata" | A host loses required behavior without warning the installer or user |

## Mais leitura

- [Evaluating skills](https://agentskills.io/skill-creation/evaluating-skills)para avaliações de desencadeamento, avaliações de saída, corridas repetidas e linhas de base.
- [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices)para um âmbito de aplicação coerente e uma arquitetura de recursos.
- [Using scripts in skills](https://agentskills.io/skill-creation/using-scripts)para auxiliares deterministas e interfaces estruturadas.
- [Client implementation guide](https://agentskills.io/client-implementation/adding-skills-support)para a descoberta, a ativação, o contexto, a confiança e o comportamento do ciclo de vida.
- [GitSkills: A Dataset of Agent Skills from GitHub](https://arxiv.org/abs/2608.10906)Para o conjunto de dados em escala ecossistémico e os seus limites de medição indicados.
