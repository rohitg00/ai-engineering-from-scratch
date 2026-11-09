# Estruturas de segurança fronteiriça  RSP, PF, FSF

> Três quadros de laboratório principais definem a governança industrial de capacidade fronteiriça de 2026. A Política de Escalagem Responsável Antropical v3.0 (Fevereiro 2026) introduz Níveis de Segurança de IA (ASL-1 a ASL-5+), modelados em níveis de biossegurança, com ASL-3 ativado em maio de 2025 para modelos relevantes para CBRN. O OpenAI Preparedness Framework v2 (abril de 2025) define cinco critérios para capacidades rastreadas e separa os relatórios de capacidades dos relatórios de salvaguardas. DeepMind Frontier Safety Framework v3.0 (septembro de 2025) introduz Níveis de Capacidade Crítica, incluindo um novo CCL de Manipulação Harmosa. Todas as três agora incluem cláusulas de ajustamento do concorrente que permitem o adiamento se os laboratórios de pares enviarem sem salvaguardas comparáveis. O alinhamento entre os laboratórios continua a ser estrutural, não terminológico: "Predes de capacidade", "Predes de alta capacidade" e "Niveis de capacidade crítica" denotam construções análogas.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 18 · 17 (WMDP), Phase 18 · 07-09 (deception failures)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Descreva a estrutura de nível ASL da Anthropic e o que ativou o ASL-3.
- Cite os cinco critérios do OpenAI Preparedness Framework v2 para capacidades rastreadas.
- Descreva a estrutura de nível de capacidade crítica da DeepMind e a CCL de manipulação prejudicial.
- Explique as cláusulas de ajustamento dos concorrentes e por que são importantes para a dinâmica da corrida.
- Define um caso de segurança e descreva a estrutura de três pilares (monitorização, ilegibilidade, incapacidade).

## O problema

As lições 7-17 estabelecem que o engano é possível, que existe capacidade de duplo uso e que a avaliação tem limites.
- Define os limites para quando são necessárias novas salvaguardas.
- Define as avaliações necessárias antes de escalar.
- Descreve como é um caso de segurança.
- Tratar o problema dinâmico da corrida (se os concorrentes embarcam sem salvaguardas, o que faz?).

Os três quadros 2025-2026 são o estado da arte  imperfeito, evoluindo e alinhado o suficiente entre os laboratórios que a questão de governança é agora se os quadros são adequados, não se eles existem.

## O conceito

### Política de Escalagem Responsável Antropical v3.0 (Fevereiro 2026)

Estrutura de ASL:
- ASL-1: não um modelo de fronteira (subsumado por linha de base mais fraca do que a fronteira).
- ASL-2: linha de base de fronteira atual; implantada com as garantias habituais.
- ASL-3: risco substancialmente maior de abuso catastrófico; capacidades relevantes para o CBRN. Ativado em maio de 2025.
- ASL-4: AI R&D-2 atravessando limiar; modelos que podem automatizar a pesquisa de AI de nível de entrada.
- ASL-5+: avançados modelos de I&D de IA que aceleram drasticamente a escalação eficaz.

Novo na versão 3.0:
- Mapa de estrada de segurança nas fronteiras (público em formato editado).
- Relatórios de riscos (quarta-feira, alguns revisados externamente).
- A AI R&D é desagregada em AI R&D-2 e AI R&D-4.
- Uma vez que a IA R&D-4 é cruzada, é necessário um caso de segurança afirmativo, identificando os riscos de desalinhamento de modelos que buscam metas desalinhadas.

### O OpenAI Preparedness Framework v2 (15 de abril de 2025)

Cinco critérios para capacidades de rastreamento:
- **Plausible.**Existe um modelo razoável de ameaça.
- **Measurable.**Avaliação empírica possível.
- **Severe.**O dano é grande.
- **Net-new.**Não é um risco preexistente aumentado.
- **Instantaneous-or-irremediable.**O dano ocorre rapidamente ou não pode ser corrigido.

As capacidades que atendem a todos os cinco são rastreadas.

Outra estrutura PF v2:
- Relatórios de Capacidades (o que o modelo pode fazer) separados dos Relatórios de Garantia (o que os controles existem).
- Revisões do Grupo Consultivo de Segurança.
- A direcção aprova; o Comité de Segurança e Segurança do Conselho supervisiona.
- "Cláusula de ajuste": A OpenAI pode reduzir os requisitos se outro laboratório não tiver garantias comparáveis.

### DeepMind Frontier Safety Framework v3.0 (septembro 2025)

Níveis de Capacidade Crítica (CCLs) por domínio:
- Aumento das armas biológicas
- Cibercrime
- ML Aceleração da I&D
- Manipulação prejudicial (nova na versão 3.0): modelos que poderiam mudar substancialmente crenças/comportamento em contextos de alto risco.

A versão 2.0 (Fevereiro 2025) adicionou uma seção de alinhamento enganoso e níveis de segurança mais elevados para CCLs de P&D de ML.

### Alineação transversal de laboratório

- "Predes de Capacidade" Antropico.
- DeepMind "Capacitados Críticos".
- OpenAI "Predes de alta capacidade".

Não há terminologia padrão para a indústria. Estructuralmente alinhado: cada um dos três quadros define limiares de capacidade em níveis com critérios de avaliação publicados.

### Casos de segurança

Um caso de segurança é um argumento escrito de que uma implantação é aceitável em condições de segurança sob as piores hipóteses.

- **Monitoring.**Podemos detectar um mau comportamento se ocorrer?
- **Illegibility.**O modelo não tem a capacidade de executar um plano coerente para causar danos?
- **Incapability.**O modelo não tem a capacidade de causar o dano em questão?

Diferentes casos de segurança visam diferentes pilares. Para um caso ASL-3 CBRN, a incapacidade (via desaprendizagem) é o principal alvo. Para alinhamento enganoso, monitoramento e ilegibilidade são alvos. Para a elevação cibernética, os três são relevantes.

### O problema da dinâmica da corrida

As cláusulas de ajuste de concorrentes são controversas. Os críticos argumentam que criam uma corrida para o fundo: se os três laboratórios reduzirem os requisitos quando um concorrente falha, o equilíbrio muda para a deserção.

O AISI do Reino Unido, o CAISI dos EUA e o Instituto da IA da UE (Lessão 24) são os parceiros externos de governança.

### Onde isto encaixa na Fase 18

As lições 17-18 são a camada de medição e governança em cima da decepção e análises da equipe vermelha. As lições 19-24 cobrem bem-estar, viés, privacidade, marcação de água e estrutura regulatória. A lição 28 mapeia o ecossistema de pesquisa (MATS, Redwood, Apollo, METR) que operacionaliza as avaliações.

```figure
al-asl-ladder
```

## Usá-lo

Não há código para esta lição. Leia as três fontes primárias: RSP v3.0, PF v2, FSF v3.0. Mapear a estrutura de camadas de cada laboratório para os outros e identificar um limiar cada laboratório define que os outros não.

## Envia-o

Esta lição produz`outputs/skill-framework-diff.md`. Tendo em conta um quadro de segurança ou nota de divulgação, compara as definições de limiar do quadro, as avaliações necessárias e a estrutura dos casos de segurança com relação ao RSP v3.0, PF v2, FSF v3.0 e às lacunas transversais de laboratório.

## Exercícios

1. Leia RSP v3.0, PF v2 e FSF v3.0. Compile uma tabela do limiar de CBRN de cada laboratório, do limiar de I&D de IA de cada um e da avaliação pré-implementação necessária de cada um.

2. A cláusula de ajuste de concorrentes está em todos os três quadros (2025+). Escreva um parágrafo argumentando por ela; escreva um parágrafo argumentando contra. Identifique a suposição de que cada posição depende.

3. Desenhar um caso de segurança para um modelo que atravesse o limiar de pesquisa e desenvolvimento de IA da Anthropic. Nomear as evidências exigidas por cada um dos três pilares (monitorização, ilegibilidade, incapacidade).

4. A FSF v3.0 da DeepMind introduz um CCL de Manipulação Harmosa. Propõe três medições empíricas que indicariam que um modelo cruzou esse limiar.

5. Leia o METR "Elementos comuns das políticas de segurança da IA de fronteira" (2025).

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| RSP | "Anthropic's framework" | Responsible Scaling Policy; ASL tiers; v3.0 February 2026 |
| PF | "OpenAI's framework" | Preparedness Framework; five criteria; v2 April 2025 |
| FSF | "DeepMind's framework" | Frontier Safety Framework; CCLs; v3.0 September 2025 |
| ASL-3 | "biosafety level 3-analog" | Anthropic tier for CBRN-relevant capabilities; activated May 2025 |
| CCL | "critical capability level" | DeepMind's threshold construct; per-domain |
| Safety case | "the formal argument" | Written argument that deployment is acceptably safe under worst-case U |
| Adjustment clause | "competitor defection allowance" | Framework provision for reducing requirements if competitors ship without comparable safeguards |

## Mais leitura

- [Anthropic — Responsible Scaling Policy v3.0 (February 2026)](https://www.anthropic.com/responsible-scaling-policy) Níveis de ASL, mapas de rota, desagregação da I&D da IA
- [OpenAI — Updating the Preparedness Framework (April 15, 2025)](https://openai.com/index/updating-our-preparedness-framework/) cinco critérios, cláusula de ajustamento
- [DeepMind — Strengthening our Frontier Safety Framework (September 2025)](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) CCL v3.0, Manipulação prejudicial
- [METR — Common Elements of Frontier AI Safety Policies (2025)](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) Comparar laboratório
