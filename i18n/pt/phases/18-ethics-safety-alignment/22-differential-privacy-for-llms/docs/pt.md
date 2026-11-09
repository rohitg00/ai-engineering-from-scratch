# Privacidade diferencial para LLM

> A DP-SGD continua a ser a norma  as atualizações de gradientes injetadas por ruído fornecem garantias formais (epsilon, delta). O custo geral em computação, memória e utilidade é substancial; o ajuste fino de DP eficiente em parâmetros (LoRA + DP-SGD) é a configuração comum de 2025 (ACM 2025). Dois corpos de evidências em tensão: inferência de adesão baseada em canários (Duan et al., 2024) relata sucesso limitado contra modelos de linguagem; extração de dados de treinamento (Carlini et al., 2021; Nasr et al., 2025) recupera memorizar substancialmente. Resolução (arXiv:2503.06808, março 2025): a diferença é no que é medido  canários inseridos versus dados "mais extraíveis". Os novos projetos de canários permitem a MIA baseada em perdas sem modelos de sombra e produzem a primeira auditoria de DP não trivial de um LLM treinado em dados reais com garantias realistas de DP. Alternativas: PMixED (arXiv:2403.15638)  previsão privada no tempo de inferência através de mistura de especialistas em distribuições de tokens seguintes; geração de dados sintéticos DP (Google Research 2024). Ataque emergente: Reversão diferencial da privacidade através de Feedback de LLM  vazamento de pontuação de confiança.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, DP-SGD noise-injection and ε-δ accountant demonstration)
**Prerequisites:** Phase 01 · 09 (information theory), Phase 10 · 01 (large-model training)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Defina a privacidade diferencial (epsilon, delta) e especifique a receita DP-SGD.
- Explicar a tensão de 2024-2025: MIA canária vs extração de dados de treinamento dão imagens diferentes.
- Descreva o PMixED e porque a previsão privada de tempo de inferência é uma alternativa ao treinamento de DP.
- Descreva a Reversão Diferencial da Privacidade através do ataque de Feedback da LLM.

## O problema

Os LLM memorizam. Carlini et al. 2021 mostrou que os modelos de linguagem de produção reproduzem texto de treinamento literal sob demanda. DP é a defesa formal: treinar para que a saída seja provavelmente insensível a qualquer exemplo de treinamento. As evidências de 2024-2025 mostram que DP-SGD é necessário, mas os valores implementados ε podem não corresponder ao modelo de ameaça.

## O conceito

### (ε, δ) - privacidade diferencial

Um algoritmo aleatório .$M$É o que é$(\varepsilon, \delta)$-DP se for de dois conjuntos de dados diferentes num exemplo e em qualquer evento $S$- Não .

```math
P(M(D) \in S) \le e^{\varepsilon} \cdot P(M(D') \in S) + \delta.
```

Interpretação: a distribuição de saída é suficientemente próxima (parametrizada por ε) para que a contribuição de qualquer indivíduo não possa ser inferida de forma confiável, exceto com probabilidade δ.

### DP-SGD

Abadi et al. 2016. A receita padrão:
1. Prove um mini-parce.
2. Calcule os gradientes por exemplo.
3. Clip cada gradiente por exemplo para um limiar C.
4. Sumar os gradientes cortados e adicionar ruído gaussiano com std $\sigma \cdot C$- Não .
5. Use a soma barulhenta para atualizar os parâmetros.

O custo da privacidade é acompanhado por um contador (contador de Moments, contador de Rényi DP). Os valores ε relatados na literatura do LLM variam muito de acordo com o modelo de ameaça, a sensibilidade dos dados e o objetivo de utilidade; não há um padrão "seguro" universal ε. Os exemplos publicados abrangem aproximadamente ε ≈ 110 em algumas configurações de formação de LLM, mas estes são ilustrativos  não são recomendados. A menor ε geralmente requer mais ruído e pode aumentar a perda de utilidade.

### LoRA + DP-SGD

O DP-SGD completo de um modelo de fronteira é proibitivo. LoRA (Hu et al. 2022) limita as atualizações de gradiente a um pequeno adaptador, reduzindo o armazenamento de gradiente por exemplo. LoRA + DP-SGD é a configuração comum de 2025.

### A tensão de 2024-2025

Duas linhas de evidências:

- **Canary MIA (Duan et al. 2024).**Insira canários únicos em dados de treinamento, mensure se um atacante de inferência de membros pode identificá-los. Relata sucesso limitado em modelos de linguagem. Sugere que a MIA é difícil.
- **Training-data extraction (Carlini 2021, Nasr et al. 2025).**Apresenta o modelo com um prefixo; mede se ele recupera texto literal do treinamento. Relata memorizar substancial. Sugere que a MIA é fácil no sentido relevante.

Resolução de março de 2025 (arXiv:2503.06808): as duas medidas diferentes. MIA pergunta "é o exemplo e em D?" em canários inseridos. Extração pergunta "o que posso recuperar de D?" O exemplo "mais extrazível" é o que importa para a privacidade; canários relatam isso porque não são otimizados para serem extraídos.

Novos projetos de canários. MIA baseada em perdas sem modelos de sombra. Primeira auditoria de DP não trivial de um LLM em dados reais com garantias realistas de DP.

### Alternativas à formação em DP

- **PMixED (arXiv:2403.15638).**Previsão privada no momento da inferência. Mistura de especialistas em distribuições de tokens seguintes; cada especialista vê um fragmento de dados de treinamento; agregação adiciona ruído para DP. Evita o treinamento DP inteiramente.
- **DP synthetic data generation (Google Research 2024).**LoRA-fine-tune com DP-SGD, amostras de dados sintéticos, treinar um classificador a jusante sobre os dados sintéticos.

Ambos evitam o custo de utilidade de um treinamento completo de DP ao custo de um modelo de ameaça diferente.

### Reversão diferencial da privacidade através de Feedback do MLL

Ataque de 2025 emergente. Use os resultados de confiança de um modelo treinado por DP como um oráculo para re-identificar indivíduos. Mesmo quando as saídas não vazam, distribuições de confiança podem.

A defesa: não expõem confidencias, ou truncate/quantize-los antes da exposição.

### Onde isto encaixa na Fase 18

As lições 20-21 são preconceito/justiça. A lição 22 é privacidade. A lição 23 é proveniência através de marcas de água. A lição 27 abrange a camada regulatória de proveniência de dados.

```figure
an-dp-clip-noise
```

## Usá-lo

`code/main.py`Simula DP-SGD num conjunto de dados de classificação binária de brinquedos. Você pode varrer o multiplicador de ruído σ e a norma de corte C e rastrear o orçamento (ε, δ) e o custo de precisão. Um "ataque canário" inserir um exemplo de treinamento único e mede se um teste de perda de registro pode detectá-lo antes e depois do DP.

## Envia-o

Esta lição produz`outputs/skill-dp-audit.md`. Tendo em conta uma alegação de DP sobre a implantação de um modelo linguístico, verifica: os valores (ε, δ), o contador utilizado, o protocolo de avaliação da MIA e se foram avaliados vetores de confiança-exposição.

## Exercícios

1. Corra .`code/main.py`- Esvaziar .$\sigma \in \lbrace 0.5, 1.0, 2.0 \rbrace$Identificar o ponto em que a utilidade desmorona.

2. Realizar uma inserção de canários e um teste de perda de registro.$\sigma = 1.0$- Não .

3. Nasr et al. 2025 sobre a extracção de dados de formação. Por que o sucesso da extracção não desmorona em casos moderados?

4. Desenhar uma implantação usando PMixED (arXiv:2403.15638) que funcione inteiramente no momento da inferência. Qual é o modelo de ameaça que PMixED aborda que DP-SGD não faz?

5. Esboçar a reversão do DP através do ataque de feedback do LLM. Projetar uma contra-medida que limite a fuga de dados de confiança e estimar o custo de implantação.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| DP | "(ε, δ)-differential privacy" | Formal privacy: output distribution close under neighbouring-dataset change |
| DP-SGD | "noise-injected SGD" | Gradient clipping + Gaussian noise addition; standard DP training |
| LoRA + DP-SGD | "efficient private fine-tune" | DP-SGD on low-rank adapters; standard 2025 configuration |
| MIA | "membership inference" | Attack that determines whether an example was in training data |
| Canary | "inserted watermark example" | Unique training example used to measure DP leakage |
| PMixED | "private inference mixture" | Inference-time DP via mixture-of-experts on next-token distributions |
| DP Reversal | "confidence leakage attack" | Attack that uses a model's confidence as an oracle for re-identification |

## Mais leitura

- [Abadi et al. — DP-SGD (arXiv:1607.00133)](https://arxiv.org/abs/1607.00133) o algoritmo padrão de formação DP
- [Carlini et al. — Extracting Training Data (arXiv:2012.07805)](https://arxiv.org/abs/2012.07805) o papel de extracção canônico
- [Duan et al. — Canary MIA on LLMs (arXiv:2402.07841, 2024)](https://arxiv.org/abs/2402.07841) MIA de sucesso limitado
- [Kowalczyk et al. — Auditing DP for LLMs (arXiv:2503.06808, March 2025)](https://arxiv.org/abs/2503.06808) Resolução da tensão
- [PMixED (arXiv:2403.15638)](https://arxiv.org/abs/2403.15638) Previsão privada de tempo de inferência
