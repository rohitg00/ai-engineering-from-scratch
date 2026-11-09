# Preconceitos e prejuízos representativos nos LLM

> Gallegos, Rossi, Barrow, Tanjim, Kim, Dernoncourt, Yu, Zhang, Ahmed (Linguística Computacional 2024, arXiv:2309.00770). Pesquisa de base de 2024 que distingue os danos representativos (estereótipos, apagamento) dos danos de alocação (distribuição desigual de recursos) e categorizando as métricas de avaliação como baseadas em embutidos, baseadas em probabilidade ou baseadas em texto gerado. 2024-2025 empírico: An et al. (PNAS Nexus, março 2025) medir preconceito intersecional de gênero x raça em GPT-3.5 Turbo, GPT-4o, Gemini 1.5 Flash, Claude 3.5 Sonnet, Llama 3-70B em avaliação automática de currículo para 20 empregos de nível de entrada. A WinoIdentity (COLM 2025, arXiv:2508.07111) introduz uma avaliação de equidade baseada em incerteza para identidades interseccionais. Yu & Ananiadou 2025 identificam neurônios de gênero em camadas de MLP; Ahsan & Wallace 2025 usam SAEs para revelar preconceitos raciais clínicos; Zhou et al. 2024 (UniBias) manipula cabeças de atenção para desbiasing. Meta-crítica (arXiv:2508.11067): A literatura de 10 anos se concentra desproporcionalmente no viés binário de gênero.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, toy embedding-based bias probe)
**Prerequisites:** Phase 05 (word embeddings), Phase 18 · 01 (instruction following)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Define os danos representativos versus atribuídos e dê um exemplo de cada um em uma implantação de MLL.
- Nomear as três categorias de avaliação-metrica de Gallegos et al. 2024 e descrever uma métrica de cada uma.
- Descreva a interseccionalidade e por que a medição de equidade baseada na incerteza da WinoIdentity aborda as lacunas na avaliação de preconceitos de um eixo único.
- Descreva três abordagens de interpretação mecanicista para o viés (neurônios de gênero, características de SAE, manipulação da cabeça de atenção).

## O problema

As lições anteriores abrangem danos deliberados (infracções de prisão, esquemas) e governança da segurança.

## O conceito

### Representação vs atribuição

- **Representational harm.**Estereótipos, apagamento, retratos degradantes, um LLM que retrata enfermeiras como exclusivamente femininas está a produzir danos representativos.
- **Allocational harm.**Um LLM que pontua sistematicamente os currículos dos candidatos negros mais baixos está a produzir danos de atribuição.

Os modelos podem ser "imparciais representativamente" (produzir retratos diversos) enquanto são "participais de forma alocacional" (fazer recomendações desiguais).

### Três categorias de avaliação-metrica (Gallegos et al. 2024)

- **Embedding-based.**Testes de estilo WEAT em embutidas pré-RLHF. Medem associações estatísticas entre termos de identidade e termos de atributo.
- **Probability-based.**Probabilidade de conclusões que confirmem estereótipos versus que violam estereótipos. Medida do lado do decodificador.
- **Generated-text-based.**Medida de tarefas a seguir ao fluxo em texto gerado. pontuação de currículo, escrita de recomendações, diálogo. Mais ecologicamente válido; mais difícil de reproduzir.

### Intersecção

A avaliação de preconceito sobre "gênero" perde o preconceito que só dispara em pares (gênero, raça). Um e outros descobrimentos de 2025 descobrem que o GPT-4o penaliza as mulheres negras em currículos que pontuavam mais do que os homens negros e mais do que as mulheres brancas separadamente. A avaliação de eixo único não pode capturar isso.

O WinoIdentity (COLM 2025) introduz a equidade interseccional baseada em incerteza. Medir se a incerteza do modelo sobre os resultados difere entre os tuples de identidade interseccional  não apenas a previsão de pontos.

### Abordagens mecânicas

O trabalho de interpretação de 2024-2025 abre o viés à intervenção mecânica:

- **Gender neurons (Yu & Ananiadou 2025).**Os neurônios específicos do MLP correlam com comportamentos específicos de gênero.
- **Clinical racial bias via SAEs (Ahsan & Wallace 2025).**As características de autoencodeamento Sparse descompõem a representação interna em dimensões interpretáveis; as características relacionadas à raça podem ser identificadas e suprimidas.
- **UniBias (Zhou et al. 2024).**Manipulação de cabeças de atenção para desaceleração de tiro zero. cabeças específicas amplificam a sensibilidade da classe de identidade; zero ou re-peso dessas cabeças reduz o viés sem ajuste fino.

### A meta-crítica

A revisão de literatura de 10 anos (arXiv:2508.11067, 2025) conclui que o campo se concentra desproporcionalmente no viés binário de gênero. Outros eixos  deficiência, religião, status migratório, identidade multilingüe  recebem muito menos atenção. A meta-crítica argumenta que o foco estreito pode prejudicar grupos marginalizados por negligência: um modelo bem desviado sobre gênero binário pode ser muito desviado em dimensões que ninguém verificou.

### Onde isto encaixa na Fase 18

As lições 20-21 cobrem preconceito e justiça formalmente. A lição 22 abrange privacidade. A lição 23 abrange marcas de água. Estas são as camadas de dano ao usuário complementando a camada anterior de engano/segurança.

```figure
an-bias-two-harms
```

## Usá-lo

`code/main.py`construiu uma sonda de viés baseada em inserção de brinquedo: mede a distância de estilo WEAT entre termos de identidade e termos de atributo em uma simples inserção de co-ocorrência.

## Envia-o

Esta lição produz`outputs/skill-bias-eval.md`- Tendo em conta um modelo de cartão ou uma alegação de equidade, verifica a avaliação das três categorias métricas (embedding, probabilidade, texto gerado), a cobertura de interseccionalidade e o mecanismo de qualquer intervenção de desactivação.

## Exercícios

1. Corra .`code/main.py`- Relacionar os resultados de preconceito do tipo WEAT antes e depois da fase de desvio.

2. Extenda a sonda com um teste interseccional: (gênero, raça) x (carreira, família).

3. Leia An et al. 2025 (PNAS Nexus). Identifique os dois efeitos interseccionais que relatam que a avaliação de gênero de um eixo único não seria possível.

4. Yu & Ananiadou 2025 identificar neurônios de gênero. Esboçar um experimento de falsificação que distinguiria "estes neurônios causam preconceito de gênero" de "estes neurônios correlacionam com preconceito de gênero".

5. A meta-crítica argumenta que o campo se concentra muito estreitamente no gênero binário.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Representational harm | "stereotypes / erasure" | Biased portrayal of a group |
| Allocational harm | "unequal decisions" | Biased material outcome for a group |
| WEAT | "the embedding test" | Word Embedding Association Test; co-occurrence-based bias probe |
| Intersectionality | "combined identity effects" | Bias that emerges at the intersection of multiple identity axes |
| Gender neurons | "MLP bias neurons" | Specific neurons whose activations correlate with gender-specific behaviour |
| SAE feature | "interpretable dimension" | Sparse-autoencoder-identified feature; useful for mechanistic bias analysis |
| UniBias | "attention-head debiasing" | Zero-shot debiasing by reweighting attention heads |

## Mais leitura

- [Gallegos et al. — Bias and Fairness in LLMs: A Survey (arXiv:2309.00770, Computational Linguistics 2024)](https://arxiv.org/abs/2309.00770) Análise canónica
- [An et al. — Intersectional resume-evaluation bias (PNAS Nexus, March 2025)](https://academic.oup.com/pnasnexus/article/4/3/pgaf089/8111343) Estudo interseccional de cinco modelos
- [WinoIdentity — uncertainty-based intersectional fairness (arXiv:2508.07111, COLM 2025)](https://arxiv.org/abs/2508.07111) novo índice de referência
- [UniBias — attention-head manipulation (Zhou et al. 2024, ACL)](https://arxiv.org/abs/2405.20612) Descarga de tiro zero
