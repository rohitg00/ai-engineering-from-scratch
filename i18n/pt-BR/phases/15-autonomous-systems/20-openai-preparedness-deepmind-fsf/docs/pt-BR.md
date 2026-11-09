# O quadro de preparação para a OpenAI e o quadro de segurança de fronteiras de DeepMind

> OpenAI Preparedness Framework v2 (abril de 2025) introduz categorias de pesquisa  Autonomia de longo alcance, Sandbagging, Replicação e Adaptação Autônoma, Minar salvaguardas  distintas das categorias rastreadas. As categorias rastreadas desencadeiam os relatórios de capacidades e os relatórios de salvaguardas revisados pelo grupo consultivo de segurança. O FSF v3 da DeepMind (septembro de 2025, com Níveis de Capacidade de rastreamento adicionados em 17 de abril de 2026) dobra a autonomia em domínios de P&D e Ciber (ML R&D autonomia nível 1 = automatizar completamente o pipeline de P&D da IA a custo competitivo versus ferramentas humanas + AI). O FSF v3 aborda explicitamente o alinhamento enganoso através de monitorização automatizada de uso indevido de raciocínio instrumental. A nota honesta: As categorias de pesquisa no PF v2 (incluindo Autonomia de longo alcance) não desencadeiam automaticamente mitigações; a linguagem de política é "potencial". A própria DeepMind diz que o monitoramento automatizado "não permanecerá suficiente a longo prazo" se o raciocínio instrumental forçar.

**Type:** Learn
**Languages:** Python (stdlib, three-framework decision-table diff tool), TypeScript
**Prerequisites:** Phase 15 · 19 (Anthropic RSP)
**Time:** ~45 minutes

## O problema

A lição 19 leu a política de escala da Anthropic de perto. Esta lição completa a imagem lendo OpenAI e DeepMind. Os três documentos são artefatos primos que abordam a mesma pergunta  quando um laboratório de fronteira deve pausar ou abrir um modelo  e convergem em um pequeno conjunto de categorias e divergem em lugares específicos que importam.

A convergência: as três etiquetas autonomia de longo alcance como uma classe de capacidade que vale a pena rastrear. Todos os três reconhecem o comportamento enganoso (falsificação de alinhamento, sandbagging) como uma classe específica de risco. Todos os três têm um órgão interno de revisão. A divergência: a OpenAI divide as categorias em "Tracked" (mitigação obrigatória) e "Research" (sem desencadeamento automático). A DeepMind dobra a autonomia em dois domínios em vez de nomeá-la separadamente. Os nomes do laboratório são Tracked vs Research, ou Critical vs Moderate, ou Tier-1 vs Tier-2; a consequência operacional de qual balde uma capacidade vive é diferente entre os laboratórios.

A mesma capacidade pode ser "mitigação obrigatória" na Anthropic, "monitorada mas não desencadeada" na OpenAI e " rastreada em um domínio específico" na DeepMind.

## O conceito

### O quadro de preparação da OpenAI v2 (abril de 2025)

Estrutura:

- **Tracked Categories**O relatório de medidas de salvaguarda (qualquer medidas de mitigação já em vigor) foi revisto pelo Grupo Consultivo de Segurança antes da implantação.
- **Research Categories**A Comissão propõe que a Comissão adopte medidas de controlo de dados para a aplicação de medidas de controlo de dados e de controlo de dados, incluindo medidas de controlo de dados e de controlo de dados.

A definição chave no v2: Categorias de pesquisa não desencadeiam automaticamente mitigações. A linguagem de política é mitigações "potenciais". Este é o delta específico para assistir: a localização de uma categoria em Tracked vs Research é a bisagra entre "permeado" e "observado".

### DeepMind Frontier Safety Framework v3 (september 2025; Tracked Capability Levels adicionados em 17 de abril de 2026)

Estrutura:

- **Critical Capability Levels (CCLs)**A autonomia não é o seu próprio domínio; é dobrada em R&D e Cyber.
- **Tracked Capability Levels**Exemplo concreto: ML R&D autonomia nível 1 = automatizar completamente o pipeline de R&D da IA a um custo competitivo versus ferramentas humanas + IA.
- **Deceptive alignment monitoring**: compromisso explícito com o controlo automatizado de abusos de raciocínio instrumental.

A estruturação da autonomia difere da OpenAI. DeepMind não mantém "Autonomia" como um domínio de nível superior; é dobrada para os domínios onde a autonomia causaria danos (ML R&D e Cyber). O argumento é que a autonomia sem um domínio é capacidade sem risco; o contra-argumento é que a autonomia entre domínios é um meta-riesgo que o framework deve nomear.

### O que os três convergem

- Grupo Consultivo de Segurança Interna (nomeado Anthropic SAG, OpenAI SAG, DeepMind comitê interno).
- Menção explícita de alinhamento enganoso / alinhamento fingido como uma classe de risco.
- Artifactos permanentes em uma cadência declarada (Antropic: Roadmap de segurança fronteiriça, Relatório de riscos; OpenAI: Relatórios de Capacidades e Garantias; DeepMind: Ciclo de atualização do FSF).
- Reconhecimento de que as defesas exclusivamente de monitorização têm um limite.

### Onde divergem

- **Anthropic**: compromisso de pausa removido na v3.0; AI R&D-4 limiar é o nomeado próximo portal.
- **OpenAI**: Segurança versus pesquisa dividida; Categorias de pesquisa (incluindo autonomia de longo alcance) não se abrem automaticamente.
- **DeepMind**A autonomia foi redobrada para outros domínios; os níveis de capacidade rastreados adicionam granularidade em abril de 2026.

### Sandbagging: uma capacidade específica que complica os três

Sandbagging (um modelo estrategicamente com um desempenho inferior nas avaliações) está nas categorias de pesquisa da OpenAI. A RSP v3.0 da Anthropic aborda isso através da lacuna de avaliação-contexto (Lessão 1).

Se um modelo não se baseia em avaliações, os limites de capacidade de cada quadro são subestimados. O quadro só funciona se a medição funciona. É por isso que a medição externa (Lessão 21, METR) e a avaliação adversária são necessárias, além da autoavaliação de laboratório.

### A habilidade de leitura de políticas

- Localiza: todas as capacidades que lhe interessam devem ser encontradas na apólice.
- Classificar: é rastreado (acciona mitigação) ou pesquisa ( rastreado, mas não desencadeando)?
- Cadência: a política é atualizada em um calendário declarado ou apenas após eventos específicos?
- Independência: a revisão externa é obrigatória ou opcional? Parceiros antropóficos com a Apollo e o Instituto de Segurança de IA dos EUA; OpenAI com a METR; DeepMind com a SAG interna principalmente.

```figure
a5-tracked-vs-research
```

## Usá-lo

`code/main.py`A tecnologia de informação é uma ferramenta de análise de dados que permite a análise de dados e de dados, que permite a análise de dados e de dados, e que permite a análise de dados e de dados.

## Envia-o

`outputs/skill-cross-policy-diff.md`produz uma comparação entre políticas para uma capacidade específica, utilizando os três quadros como referência.

## Exercícios

1. Corra .`code/main.py`. Confirmar que a saída da ferramenta de diferença corresponde às políticas para pelo menos duas capacidades que você pode verificar com os documentos de origem.

2. Leia o OpenAI Preparedness Framework v2 em sua totalidade. Identifique cada categoria de pesquisa. Para cada uma, escreva uma frase sobre por que está em Pesquisa em vez de Tracked.

3. Leia o DeepMind FSF v3 completo, além da atualização de Níveis de Capacidade de Aprilo de 2026. Identifique os critérios de avaliação específicos do nível 1 da autonomia de P&D do ML. Como você o mediria externamente?

4. Sandbagging está na OpenAI's Research Categories. Desenhar uma avaliação que forçaria um modelo de sandbagging a revelar sua capacidade real.

5. Compare as três políticas em uma capacidade específica (a sua escolha). Nomear qual das políticas de classificação que você acha mais rigorosa e qual menos. Justificar com o texto fonte.

## Termos-chave

| Term | What people say | What it actually means |
|---|---|---|
| Preparedness Framework | "OpenAI's scaling policy" | PF v2 (April 2025); Tracked vs Research categories |
| Tracked Category | "Mandatory mitigation" | Triggers Capabilities + Safeguards Reports; SAG review |
| Research Category | "Monitored only" | Tracked but no automatic mitigation; includes Long-range Autonomy |
| Frontier Safety Framework | "DeepMind's scaling policy" | FSF v3 (Sept 2025) + Tracked Capability Levels (Apr 2026) |
| CCL | "Critical Capability Level" | DeepMind threshold per domain (CBRN, Cyber, Harmful Manipulation, ML R&D) |
| ML R&D autonomy level 1 | "R&D automation" | Fully automate AI R&D pipeline at competitive cost |
| Sandbagging | "Strategic underperformance" | Model underperforms on evals; in OpenAI Research Categories |
| Instrumental reasoning | "Means-ends reasoning" | Reasoning about how to achieve goals; target of DeepMind monitoring |

## Mais leitura

- [OpenAI — Updating our Preparedness Framework](https://openai.com/index/updating-our-preparedness-framework/)Anúncio v2.
- [OpenAI — Preparedness Framework v2 PDF](https://cdn.openai.com/pdf/18a02b5d-6b67-4cec-ab64-68cdfbddebcd/preparedness-framework-v2.pdf) Documento completo.
- [DeepMind — Strengthening our Frontier Safety Framework](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) Anúncio da FSF v3.
- [DeepMind — Updating the Frontier Safety Framework (April 2026)](https://deepmind.google/blog/updating-the-frontier-safety-framework/) Adição de Níveis de Capacidade de rastreamento.
- [Gemini 3 Pro FSF Report](https://storage.googleapis.com/deepmind-media/gemini/gemini_3_pro_fsf_report.pdf) exemplo de relatório de risco em formato FSF.
