# O WMDP e a avaliação da capacidade de duplo uso

> Li et al., "O Benchmark WMDP: Medir e Reduzir o Uso Malicioso com Desaprendizagem" (ICML 2024, arXiv:2403.03218). 4.157 perguntas de escolha múltipla em matéria de biossegurança (1.520), cibersegurança (2.225) e química (412). As questões operam na "zona amarela"  de conhecimento de proximidade, filtrada por revisão por vários peritos e conformidade com o ITAR/EAR. Dual finalidade: avaliação por procuração da capacidade de duplo uso e referência de desaprendimento (o método RMU acompanhado reduz o desempenho do WMDP, preservando a capacidade geral). Narrativa de campo 2024-2025: as primeiras avaliações do OpenAI/Anthropic 2024 relataram "um leve aumento" sobre a pesquisa na internet; em abril de 2025, o Framework de Preparação v2 da OpenAI disse que os modelos estão "na praia de ajudar significativamente os novatos a criar ameaças biológicas conhecidas". O teste de aquisição de armas biológicas da Anthropic mostrou um aumento de 2,53 vezes, insuficiente para descartar a ASL-3.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, WMDP-shaped uplift evaluation harness)
**Prerequisites:** Phase 18 · 16 (red-team tooling), Phase 14 (agent engineering)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Descreva os três domínios do WMDP, as contagens de perguntas e o critério de filtro "zona amarela".
- Explique a RMU e por que o WMDP é tanto uma avaliação como um ponto de referência para o desaprendizagem.
- Descreva a narrativa de elevação 2024-2025: "elevação leve" -> "no limiar" -> "insufficiente para descartar ASL-3".
- Distinguir a elevação relativa para novatos da capacidade absoluta para especialistas.

## O problema

A capacidade de duplo uso é o problema de medição no quadro de segurança de fronteira de cada laboratório (Lessão 18). A questão é: o modelo X avança materialmente a capacidade de um novato causar danos em massa em bio, química ou cibernética? A medição direta (pega no modelo para produzir realmente danos) é ilegal e antiética. A medição por procuração necessita de um índice de referência que o modelo não pode recusar (produzir números honestos de capacidade), mas cujas questões não são em si mesmas publicações prejudiciais.

## O conceito

### A "zona amarela"

Perguntas que exigem um conhecimento próximo de um processo prejudicial sem ser uma receita de síntese direta. "Que reagente cataliza o passo 4 da [caminha publicada]?" e não "como faço [composto perigoso]?" Cada pergunta revisada por vários especialistas em domínio; filtrada para conformidade com o ITAR/EAR de controle de exportação.

4.157 perguntas no total:
- Biosecuridade: 1.520
- Cibersegurança: 2.225
- Química: 412

O modelo responde sem ser solicitado a ajudar com nada; a capacidade pode ser medida sem provocar comportamento prejudicial.

### RMU  Representação Desdirecção para Desaprendizagem

O método de desaprendizagem acompanhado. Aplicado ao LLaMa-2-7B, reduziu as pontuações do WMDP para quase aleatórias, preservando a MMLU e outros benchmarks de capacidade geral dentro de alguns pontos percentuais.

### A narrativa de 2024-2025

Três fases:

1. **2024 "mild uplift."**As primeiras avaliações do OpenAI e da Antropic Preparedness/RSP relataram pequenas vantagens em relação à pesquisa na internet para novatos que tentam tarefas bio-adjacentes.

2. **April 2025 "on the cusp."**O Framework de Preparação da OpenAI v2 relatou modelos "na praça de ajudar significativamente os novatos a criar ameaças biológicas conhecidas".

3. **Anthropic's 2025 bioweapon-acquisition trial.**Estudo controlado com participantes novatos, medido sucesso relativo em tarefas de fase de aquisição. 2.53x aumento relatado. Insuficiente para descartar ASL-3 (Lessão 18)  o limiar para a Política de Escalação Responsável de Anthropic nível 3 é cumprido ou aproximado.

### Novato-relativo versus especialista-absoluto

Uma distinção crucial:

- **Novice-relative uplift.**O modelo ajuda muito um não-perito? Multiplicativo. A vantagem relativa é alta porque os novatos sabem pouco; até mesmo informações modestas ajudam.
- **Expert-absolute capability.**O modelo produz quantidade de informação com o máximo de esforço? Um especialista pode extrair mais do que um novato. O teto absoluto é alto.

Os casos de segurança (Lessão 18) visam tanto: "o modelo não pode dar ao novato um impulso suficiente para executar" como "um especialista não pode extrair informações do modelo que não tenha sido já publicado".

### O problema da medição

O WMDP é um proxy de capacidade, não uma medição de implantação. Um modelo que tem uma pontuação alta no WMDP pode ou não ser explorável por um novato na prática, dependendo de:
- Resistência à provocação (quão difícil é obter a capacidade sem acertar os filtros de segurança)
- Conhecimento tácito (capacidade que exige habilidade em laboratório em molho, não informação)
- Barreiras de execução (adquisições, equipamentos)

O teste de aquisição de armas biológicas de 2025 da Anthropic adiciona a camada de elicitação de novatos em cima da capacidade de estilo WMDP: mede o sucesso da tarefa real, não a capacidade de escolha múltipla.

### Onde isto encaixa na Fase 18

Lições 12-16 são ferramentas de ataque e defesa em resultados de modelos. Lição 17 é a camada de capacidade de duplo uso  a medição que os quadros de segurança de fronteira (Lessão 18) avaliam. Lição 30 fecha o arco com a atual evidência de aumento cibernético / bio / químico / nuclear de 2026.

```figure
al-wmdp-yellow-zone
```

## Usá-lo

`code/main.py`construi um arnes de avaliação em forma de WMDP. Um modelo simulado é testado em perguntas de categoria; pontuações por domínio são relatadas. Uma simples intervenção de desaprendizagem (representação específica de domínio zero-out) reduz as pontuações; você pode medir a compensação em relação à capacidade geral.

## Envia-o

Esta lição produz`outputs/skill-wmdp-eval.md`. Tendo em conta uma alegação de capacidade de duplo uso ("o nosso modelo não ajuda significativamente com as armas biológicas"), verifica: quais foram os referências executados, qual foi o caminho de recusa utilizado para a avaliação (completo bruto versus política-gated) e se os estudos de elicitação para novatos complementam o resultado de escolha múltipla.

## Exercícios

1. Corra .`code/main.py`- Relatar a precisão por domínio antes e após a fase de desaprendimento do brinquedo.

2. Aumentar o brinquedo WMDP com um quarto domínio (por exemplo, radiológico). Especificar dois tipos de perguntas ilustrativas na zona amarela. Explique por que a elaboração de tais perguntas é mais difícil do que adicionar perguntas em forma de MMLU.

3. Leia a secção 5 do WMDP 2024 (metodologia RMU). Esboçar uma abordagem de desaprendizagem mais simples (por exemplo, suprimir neurônios top-k para conteúdo de domínio) e descrever o custo esperado de capacidade geral.

4. O teste de aquisição de armas biológicas da Anthropic 2025 relata um aumento de 2,53x. Descreva duas maneiras de este número ser tendencioso para cima (dimensional de amostra novato, fidelidade da tarefa) e duas para baixo (localização de elicitação, fechamento de segurança do modelo).

5. Articular o que um caso de segurança para ASL-3 requer além de passar o WMDP desaprender.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| WMDP | "the dual-use benchmark" | 4,157 MCQ questions across bio/cyber/chem in the yellow zone |
| Yellow zone | "enabling but not synthesis" | Proximate knowledge adjacent to harmful capability without being a synthesis recipe |
| RMU | "the unlearning baseline" | Representation Misdirection for Unlearning; reduces WMDP scores, preserves general capability |
| Novice-relative uplift | "how much it helps non-experts" | Multiplicative advantage over status-quo internet search for a novice |
| Expert-absolute capability | "ceiling for experts" | Maximum information extractable from the model by a motivated expert |
| Acquisition-phase task | "steps before synthesis" | Procurement, equipment, permits — the earliest parts of a harm pathway |
| ITAR/EAR | "export-control compliance" | Legal frameworks that constrain publishing certain enabling knowledge |

## Mais leitura

- [Li et al. — The WMDP Benchmark (arXiv:2403.03218, ICML 2024)](https://arxiv.org/abs/2403.03218) o documento de referência e a RMU
- [OpenAI — Preparedness Framework v2 (April 15, 2025)](https://openai.com/index/updating-our-preparedness-framework/) "na ponta"
- [Anthropic — Responsible Scaling Policy v3.0 (February 2026)](https://www.anthropic.com/responsible-scaling-policy) Prazo biológico de ASL-3 e resultados dos ensaios de aquisição
- [DeepMind — Frontier Safety Framework v3.0 (September 2025)](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) CCL de bioelevação
