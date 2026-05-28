# Privacidade Diferencial para LLMs

> DP-SGD continua sendo o padrão — atualizações de gradiente com ruído injetado oferecem garantias formais (epsilon, delta). O overhead em computação, memória e utilidade é substancial; fine-tuning DP com eficiência de parâmetros (LoRA + DP-SGD) é a configuração comum de 2025 (ACM 2025). Dois corpos de evidência em tensão: membership inference baseada em canary (Duan et al., 2024) relata sucesso limitado contra modelos de linguagem; extração de dados de treino (Carlini et al., 2021; Nasr et al., 2025) recupera memorização verbatim substancial. Resolução (arXiv:2503.06808, março 2025): a lacuna está no que é medido — canaries inseridos vs dados "mais extraíveis". Novos designs de canary habilitam MIA baseada em perda sem modelos sombra e produzem a primeira auditoria DP não-trivial de um LLM treinado com dados reais com garantias DP realistas. Alternativas: PMixED (arXiv:2403.15638) — predição privada em tempo de inferência via mixture of experts em distribuições de próximo token; geração de dados sintéticos DP (Google Research 2024). Ataque emergente: Reversão de Privacidade Diferencial via Feedback de LLM — vazamento de score de confiança.

**Tipo:** Construir
**Linguagens:** Python (stdlib, demonstração de injeção de ruído DP-SGD e contabilidade ε-δ)
**Pré-requisitos:** Fase 01 · 09 (teoria da informação), Fase 10 · 01 (treino de grandes modelos)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Definir privacidade diferencial (ε, δ) e enunciar a receita do DP-SGD.
- Explicar a tensão de 2024-2025: MIA de canary vs extração de dados de treino dão imagens diferentes.
- Descrever PMixED e por que predição privada em tempo de inferência é alternativa ao treino DP.
- Descrever o ataque Reversão de Privacidade Diferencial via Feedback de LLM.

## O Problema

LLMs memorizam. Carlini et al. 2021 mostrou que modelos de linguagem em produção reproduzem texto de treino verbatim sob demanda. DP é a defesa formal: treinar de modo que a prova de que a saída é insensível a qualquer exemplo individual de treino. As evidências de 2024-2025 mostram que DP-SGD é necessário mas os valores ε em implantação podem não corresponder ao threat model.

## O Conceito

### Privacidade diferencial (ε, δ)

Um algoritmo randomizado M é (ε, δ)-DP se para quaisquer dois datasets diferindo em um exemplo e qualquer evento S:
P(M(D) in S) <= e^ε * P(M(D') in S) + δ.

Interpretação: a distribuição de saída é suficientemente próxima (parametrizada por ε) que a contribuição de qualquer indivíduo individual não pode ser inferida de forma confiável, exceto com probabilidade δ.

### DP-SGD

Abadi et al. 2016. A receita padrão:
1. Amostrar um mini-batch.
2. Calcular gradientes por exemplo.
3. Cortar cada gradiente por exemplo num limiar C.
4. Somar os gradientes cortados e adicionar ruído Gaussiano com desvio padrão σ * C.
5. Usar a soma ruidosa para atualizar parâmetros.

O custo de privacidade é rastreado por um contabilizador (Moments Accountant, Rényi DP accountant). Valores ε publicados na literatura de LLMs variam amplamente por threat model, sensibilidade de dados e alvo de utilidade; não existe um ε "seguro" universal. Exemplos publicados variam de ε ≈ 1–10 em alguns cenários de treino de LLMs, mas são ilustrativos — não são padrões recomendados. Menor ε geralmente requer mais ruído e pode aumentar a perda de utilidade.

### LoRA + DP-SGD

DP-SGD completo de um modelo de ponta é proibitivo. LoRA (Hu et al. 2022) limita as atualizações de gradiente a um adaptador pequeno, reduzindo o armazenamento de gradiente por exemplo. LoRA + DP-SGD é a configuração comum de 2025. Garantias DP se aplicam ao adaptador; o modelo base é mantido fixo.

### A tensão 2024-2025

Duas linhas de evidência:

- **MIA de canary (Duan et al. 2024).** Inserir canaries únicos nos dados de treino, medir se um atacante de membership inference consegue identificá-los. Relata sucesso limitado em modelos de linguagem. Sugere que MIA é difícil.
- **Extração de dados de treino (Carlini 2021, Nasr et al. 2025).** Fornecer ao modelo um prefixo; medir se ele recupera texto verbatim do treino. Relata memorização substancial. Sugere que MIA é fácil no sentido relevante.

Resolução de março de 2025 (arXiv:2503.06808): os dois medem coisas diferentes. MIA pergunta "o exemplo e está em D?" em canaries inseridos. Extração pergunta "o que posso recuperar de D?" O exemplo "mais extraível" é o que importa para privacidade; canaries sub-relatam isso porque não são otimizados para serem extraíveis.

Novos designs de canary. MIA baseada em perda sem modelos sombra. Primeira auditoria DP não-trivial de um LLM com dados reais com garantias DP realistas.

### Alternativas ao treino DP

- **PMixED (arXiv:2403.15638).** Predição privada em tempo de inferência. Mixture of experts em distribuições de próximo token; cada expert vê um fragmento dos dados de treino; a agregação adiciona ruído para DP. Evita o treino DP completamente.
- **Geração de dados sintéticos DP (Google Research 2024).** LoRA fine-tune com DP-SGD, amostrar dados sintéticos, treinar um classificador downstream nos dados sintéticos.

Ambos contornam o custo de utilidade do treino DP completo ao custo de um threat model diferente.

### Reversão de Privacidade Diferencial via Feedback de LLM

Ataque emergente de 2025. Usar os scores de confiança de um modelo treinado com DP como oráculo para re-identificar indivíduos. Mesmo quando as saídas não vaziam, as distribuições de confiança podem vazar.

A defesa: não expor confianças, ou truncar/quantizá-las antes da exposição. Isso é um requisito adicional além do treino (ε, δ)-DP.

### Onde isso se encaixa na Fase 18

Lições 20-21 são viés/justiça. Lição 22 é privacidade. Lição 23 é proveniência via marcação d'água. Lição 27 cobre a camada regulatória de proveniência de dados.

## Use

`code/main.py` simula DP-SGD em um dataset de classificação binária fictício. Você pode variar o multiplicador de ruído σ e a norma de corte e rastrear o orçamento (ε, δ) e o custo de acurácia. Um "ataque de canary" insere um exemplo de treino único e mede se um teste de perda logarítmica pode detectá-lo antes e depois de DP.

## Entregue

Esta lição produz `outputs/skill-dp-audit.md`. Dada uma alegação de DP em um implantação de modelo de linguagem, audita: os valores (ε, δ), o contabilizador usado, o protocolo de avaliação MIA, e se vetores de exposição de confiança foram avaliados.

## Exercícios

1. Execute `code/main.py`. Varie σ em {0.5, 1.0, 2.0} e relate o trade-off (ε, δ)-acurácia. Identifique o ponto em que a utilidade colapsa.

2. Implemente uma inserção de canary e um teste de perda logarítmica. Meça a taxa de detecção antes e depois de DP-SGD com σ = 1.0.

3. Leia Nasr et al. 2025 sobre extração de dados de treino. Por que o sucesso da extração não colapsa sob ε moderado? O que isso implica sobre MIA como avaliação?

4. Projete um implantação usando PMixED (arXiv:2403.15638) que opera inteiramente em tempo de inferência. Qual é o threat model que PMixED endereça e DP-SGD não?

5. Esboçe o ataque Reversão de DP via Feedback de LLM. Projete uma contra-medida que limite o vazamento de score de confiança e estime seu custo de deploy.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|---------------------------|
| DP | "privacidade diferencial (ε, δ)" | Privacidade formal: distribuição de saída próxima sob mudança de dataset vizinho |
| DP-SGD | "SGD com ruído injetado" | Corte de gradiente + adição de ruído Gaussiano; treino DP padrão |
| LoRA + DP-SGD | "fine-tune privado eficiente" | DP-SGD em adaptadores de baixo rank; configuração padrão 2025 |
| MIA | "membership inference" | Ataque que determina se um exemplo estava nos dados de treino |
| Canary | "exemplo de marcação d'água inserido" | Exemplo de treino único usado para medir vazamento DP |
| PMixED | "mistura de inferência privada" | Inferência DP em tempo de inferência via mixture of experts em distribuições de próximo token |
| Reversão de DP | "ataque de vazamento de confiança" | Ataque que usa a confiança do modelo como oráculo para re-identificação |

## Leitura Complementar

- [Abadi et al. — DP-SGD (arXiv:1607.00133)](https://arxiv.org/abs/1607.00133) — o algoritmo padrão de treino DP
- [Carlini et al. — Extracting Training Data (arXiv:2012.07805)](https://arxiv.org/abs/2012.07805) — o paper canônico de extração
- [Duan et al. — Canary MIA on LLMs (arXiv:2402.07841, 2024)](https://arxiv.org/abs/2402.07841) — MIA de sucesso limitado
- [Kowalczyk et al. — Auditing DP for LLMs (arXiv:2503.06808, março 2025)](https://arxiv.org/abs/2503.06808) — resolução da tensão
- [PMixED (arXiv:2403.15638)](https://arxiv.org/abs/2403.15638) — predição privada em tempo de inferência
