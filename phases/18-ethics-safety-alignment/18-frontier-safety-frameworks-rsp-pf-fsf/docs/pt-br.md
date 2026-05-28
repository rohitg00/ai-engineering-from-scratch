# Frameworks de Segurança Fronteira — RSP, PF, FSF

> Três frameworks de grandes laboratórios definem a governança da indústria em 2026 de capacidade fronteira. Anthropic Responsible Scaling Policy v3.0 (fevereiro de 2026) introduz AI Safety Levels escalonados (ASL-1 até ASL-5+), modelados em níveis de biossegurança, com ASL-3 ativado em maio de 2025 para modelos relevantes para CBRN. OpenAI Preparedness Framework v2 (abril de 2025) define cinco critérios para capacidades rastreadas e separa Relatórios de Capacidades de Relatórios de Salvaguardas. DeepMind Frontier Safety Framework v3.0 (setembro de 2025) introduz Critical Capability Levels incluindo um novo CCL de Manipulação Prejudicial. Todos três agora incluem cláusulas de ajuste competitivo que permitem adiar se laboratórios rivais lançam sem salvaguardas comparáveis. Alinhamento entre laboratórios permanece estrutural, não terminológico: "Capability Thresholds," "High Capability thresholds" e "Critical Capability Levels" denotam constructos análogos.

**Tipo:** Aprender
**Linguagens:** nenhuma
**Pré-requisitos:** Fase 18 · 17 (WMDP), Fase 18 · 07-09 (falhas de engano)
**Tempo:** ~75 minutos

## Objetivos de Aprendizagem

- Descrever a estrutura de tiers do ASL da Anthropic e o que ativou ASL-3.
- Nomear os cinco critérios do OpenAI Preparedness Framework v2 para capacidades rastreadas.
- Descrever a estrutura de Critical Capability Levels do DeepMind e o CCL de Manipulação Prejudicial.
- Explicar as cláusulas de ajuste competitivo e por que importam para dinâmicas de corrida.
- Definir um safety case e descrever a estrutura de três pilares (monitoramento, ilegibilidade, incapacidade).

## O Problemo

Lições 7-17 estabelecem que engano é possível, capacidade de uso duplo existe, e avaliação tem limites. Um laboratório com um modelo de capacidade fronteira precisa de uma estrutura de governança interna que:
- Defina limiares para quando novas salvaguardas são necessárias.
- Defina avaliações obrigatórias antes de escalar.
- Descreva como é um safety case.
- Lide com o problema da dinâmica de corrida (se rivais lançam sem salvaguardas, o que você faz?).

Os três frameworks de 2025-2026 são o estado da arte — imperfeitos, evoluindo, e alinhados o suficiente entre laboratórios que a questão de governança agora é se os frameworks são adequados, não se existem.

## O Conceito

### Anthropic Responsible Scaling Policy v3.0 (fevereiro de 2026)

Estrutura ASL:
- ASL-1: não é modelo fronteira (subsumido por baseline mais fraco que fronteira).
- ASL-2: baseline fronteira atual; deployado com salvaguardas habituais.
- ASL-3: risco substancialmente maior de uso indevido catastrófico; capacidades relevantes para CBRN. Ativado em maio de 2025.
- ASL-4: cruzamento de AI R&D-2; modelos que podem automatizar pesquisa de IA de nível introdutório.
- ASL-5+: AI R&D avançado; modelos que aceleram dramaticamente escala efetiva.

Novidades na v3.0:
- Frontiers Safety Roadmaps (públicas em forma editada).
- Relatórios de Risco (trimestrais, alguns revisados externamente).
- AI R&D é desagregado em AI R&D-2 e AI R&D-4.
- Uma vez cruzado AI R&D-4, um safety case afirmativo é obrigatório, identificando riscos de alinhamento de modelos perseguindo objetivos desalinhados.

### OpenAI Preparedness Framework v2 (15 de abril de 2025)

Cinco critérios para capacidades rastreadas:
- **Plausível.** Modelo de ameaça razoável existe.
- **Mensurável.** Avaliação empírica possível.
- **Grave.** Dano é grande.
- **Novo.** Não é um risco pré-existente escalado.
- **Instantâneo-ou-irremediável.** Dano ocorre rápido ou não pode ser desfeito.

Capacidades que atendem todos cinco são rastreadas. As outras não.

Outra estrutura do PF v2:
- Separa Relatórios de Capacidades (o que o modelo consegue fazer) de Relatórios de Salvaguardas (quais controles existem).
- Revisões do Safety Advisory Group.
- Aprovação da liderança; Comitê de Segurança & Segurança do Conselho supervisiona.
- "Cláusula de ajuste": OpenAI pode reduzir requisitos se outro laboratório lançar sem salvaguardas comparáveis.

### DeepMind Frontier Safety Framework v3.0 (setembro de 2025)

Critical Capability Levels (CCLs) por domínio:
- Uplift de Armas Biológicas
- Uplift Cibernético
- Aceleração de ML R&D
- Manipulação Prejudicial (novo na v3.0): modelos que poderiam mudar substancialmente crenças/comportamento em contextos de alto risco.

v2.0 (fevereiro de 2025) adicionou uma seção de Deceptive Alignment e níveis de segurança mais altos para CCLs de ML R&D.

### Alinhamento entre laboratórios

- "Capability Thresholds" da Anthropic.
- "Critical Capability Levels" do DeepMind.
- "High Capability thresholds" da OpenAI.

Sem terminologia padrão da indústria. Estruturalmente alinhados: três tiers de capacidade fronteira com critérios de avaliação publicados. Todos três incluem cláusulas de ajuste competitivo (a partir de 2025).

### Safety cases

Um safety case é um argumento escrito de que um deployment é aceitavelmente seguro sob premissas de pior caso. A estrutura padrão visa três pilares:

- **Monitoramento.** Conseguimos detectar comportamento ruim se ele ocorrer?
- **Ilegibilidade.** O modelo carece da capacidade de executar um plano coerente para causar dano?
- **Incapability.** O modelo carece da capacidade de causar o dano em questão?

Safety cases diferentes visam pilares diferentes. Para um caso CBRN de ASL-3, incapacidade (via unlearning) é o principal alvo. Para alinhamento enganoso, monitoramento e ilegibilidade são alvos. Para uplift cibernético, todos três são relevantes.

### O problema da dinâmica de corrida

Cláusulas de ajuste competitivo são controversas. Críticos argumentam que criam uma corrida ao fundo: se os três laboratórios reduzirão requisitos quando um rival quebrar o acordo, o equilíbrio se desloca para a traição. Defensores argumentam que a alternativa (salvaguardas unilaterais) produz piores resultados se o laboratório traidor é menos consciente de segurança.

UK AISI, US CAISI e EU AI Office (Lição 24) são as contrapartes de governança externa. Os frameworks de laboratório são voluntários; os frameworks regulatórios estão surgindo.

### Onde isso se encaixa na Fase 18

Lições 17-18 são a camada de medição e governança sobre as análises de engano e red-team. Lições 19-24 cobrem bem-estar, bias, privacidade, marcação d'água e estrutura regulatória. Lição 28 mapeia o ecossistema de pesquisa (MATS, Redwood, Apollo, METR) que operationaliza as avaliações.

## Use

Sem código para essa lição. Leia as três fontes primárias: RSP v3.0, PF v2, FSF v3.0. Mapeie a estrutura de tiers de cada laboratório para as outras e identifique um limiar que cada laboratório define que os outros não.

## Entregue

Essa lição gera `outputs/skill-framework-diff.md`. Dado um framework de segurança ou release note, compara as definições de limiar do framework, avaliações obrigatórias e estrutura de safety case contra RSP v3.0, PF v2, FSF v3.0 e sinaliza gaps entre laboratórios.

## Exercícios

1. Leia RSP v3.0, PF v2 e FSF v3.0. Compile uma tabela com o limiar CBRN de cada laboratório, o limiar de AI R&D de cada um, e a avaliação pré-deployment obrigatória de cada um.

2. A cláusula de ajuste competitivo está nos três frameworks (2025+). Escreva um parágrafo argumentando a favor; escreva um parágrafo argumentando contra. Identifique a assunção de que cada posição depende.

3. Projete um safety case para um modelo cruzando o limiar AI R&D-4 da Anthropic. Nomeie a evidência que cada um dos três pilares (monitoramento, ilegibilidade, incapacidade) requer.

4. O FSF v3.0 do DeepMind introduz um CCL de Manipulação Prejudicial. Proponha três medições empíricas que indicariam que um modelo cruzou esse limiar.

5. Leia "Common Elements of Frontier AI Safety Policies" (2025) do METR. Nomeie as três maiores convergências entre laboratórios e as duas maiores divergências.

## Termos-Chave

| Termo | O que dizem | O que realmente significa |
|-------|-------------|---------------------------|
| RSP | "framework da Anthropic" | Responsible Scaling Policy; tiers ASL; v3.0 fevereiro 2026 |
| PF | "framework da OpenAI" | Preparedness Framework; cinco critérios; v2 abril 2025 |
| FSF | "framework do DeepMind" | Frontier Safety Framework; CCLs; v3.0 setembro 2025 |
| ASL-3 | "análogo a nível 3 de biossegurança" | Tier da Anthropic para capacidades relevantes para CBRN; ativado maio 2025 |
| CCL | "critical capability level" | Constructo de limiar do DeepMind; por domínio |
| Safety case | "argumento formal" | Argumento escrito de que deployment é aceitavelmente seguro sob pior caso U |
| Cláusula de ajuste | "permissão para traição de rival" | Provisão do framework para reduzir requisitos se rivais lançarem sem salvaguardas comparáveis |

## Leitura Complementar

- [Anthropic — Responsible Scaling Policy v3.0 (fevereiro de 2026)](https://www.anthropic.com/responsible-scaling-policy) — tiers ASL, roadmaps, desagregação AI R&D
- [OpenAI — Updating the Preparedness Framework (15 de abril de 2025)](https://openai.com/index/updating-our-preparedness-framework/) — cinco critérios, cláusula de ajuste
- [DeepMind — Strengthening our Frontier Safety Framework (setembro de 2025)](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) — CCL v3.0, Manipulação Prejudicial
- [METR — Common Elements of Frontier AI Safety Policies (2025)](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) — comparação entre laboratórios
