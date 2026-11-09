# Leis de Escalada

> O artigo de 2020 Kaplan disse: modelo maior, menor perda. O artigo de 2022 Hoffmann disse: você estava sob treinamento.

**Type:** Learn
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## O problema

Quando temos C FLOPs de computação de treinamento e queremos o melhor modelo, enfrentamos dois botões:

1. **How many parameters (N)?**Um modelo maior, maior capacidade.
2. **How many training tokens (D)?**Mais dados, melhor utilização da capacidade.

As FLOPs são de uma escala aproximada de `6 × N × D`Pode empurrar N para cima e D para baixo, ou D para cima e N para baixo.

Antes de 2022, a resposta era "empurrar N duro". GPT-3 (2020) era 175B parâmetros treinados em tokens ~ 300B. Uma proporção de cerca de 1,7 tokens por parâmetro. As leis de escalagem de Kaplan apoiaram isso.

Hoffmann et al. (2022), que treinavam uma pequena família de modelos chamada Chinchilla, encontraram algo diferente: a relação ideal está mais próxima de **20 tokens per parameter**O Chinchilla (70B params, 1,4T tokens) venceu o GPT-3 (175B, 300B tokens) em cada referência a 2,5x menos custo de inferência.

2026 é o mundo de Chinchilla  com uma reviravolta importante. Llama 3 8B foi treinado em 15 trilhões de tokens, uma proporção de 1.875 tokens por parâmetro. Noventa e quatro vezes acima de Chinchilla-ótimo.

## O conceito

![Chinchilla curves: loss vs compute at various N/D ratios](../assets/scaling-laws.svg)

### A lei Hoffmann

Do jornal Chinchilla, a perda é a seguinte:

```math
L(N, D) = \frac{A}{N^\alpha} + \frac{B}{D^\beta} + E
```

- $N$= parâmetros (não incorporados).
- $D$= tokens de formação.
- $\alpha \approx 0.34$- Não .$\beta \approx 0.28$(aproximadamente simétrica).
- $E \approx 1.69$O limite de perda irredutível.
- $A \approx 406$- Não .$B \approx 411$- Não .

Dois termos negociam uns contra os outros à medida que escalam.$N$com cálculo fixo ($C = 6ND$O que é que é o problema?$\alpha$E ...$\beta$acima, os exponentes saem em cerca de 0,45 para $N$e 0,55 para $D$, de modo que a relação ideal exacta varia lentamente com o orçamento; `code/main.py`As duas primeiras abordagens de fixação do papel, que medem o óptimo diretamente, colocam ambos os exponentes em cerca de 0,5. Isso dá a regra empírica de uma relação fixa.$D = 20N$em $C = 6ND$E a regra do polegar diz:

```math
\begin{aligned}
N_{\text{opt}} &\approx 0.22 \times (C/6)^{0.5} \\
D_{\text{opt}} &\approx 4.5 \times (C/6)^{0.5} \\
D_{\text{opt}} / N_{\text{opt}} &\approx 20
\end{aligned}
```

Computação-ótima: 20 tokens por parâmetro.

### Por que se exercitar demais ?

O Chinchilla-Optimo minimiza a perda de treino por treino FLOP. Mas você paga o custo de treino uma vez;

Para um chatbot que serve um trilhão de tokens por mês, a inferência domina o custo total. A abordagem de Llama: treinar menor, mais tempo.

- Fica na GPU do consumidor.
- A latência é uma fração de 70B Chinchilla-ótimo.
- A qualidade é suficientemente próxima para a maioria das tarefas.

O artigo de DeepMind de 2024 ("Over-training is the new optimal") formalizou isso. Para cargas de trabalho dominadas pela inferência, a relação certa é mais próxima de 100500 tokens por parâmetro dependendo do volume de serviço.

### Emergência vs suavidade

Alegamento: certas habilidades (arítmética, raciocínio em vários passos, seguimento de cadeia de pensamento) "emergem" de repente em alguma escala.

Schaeffer et al. (2023) argumentou que este é um artefato de medição: métricas emergentes usam pontuação descontínua (paralelas exatas, precisão no limiar) que escondem uma melhora suave nas logitas subjacentes.

Em 2026, o consenso é: as previsões por perda contínua são confiáveis. Os saltos de referência são muitas vezes artefatos de pontuação.

### A imagem de 2026

As leis de escala ainda funcionam, mas:

| Factor | Changed how |
|--------|-------------|
| Data quality | Curating "good" tokens (Phi-style) shifts curves by >2× effective compute |
| MoE | Total params decouple from active FLOPs; scaling laws per-active-FLOP |
| Post-training | Some capabilities (instruction following, code) shift with SFT+RLHF more than pretraining |
| Multimodality | Image + text tokens scale together; separate curves per modality |
| Synthetic data | Models generate training data; effective compute can compound |

O optimizador Muon (Kimi Moonlight, 2024) mostrou um ganho de computação efetiva de ~2x sobre AdamW em dados correspondentes. Algumas corridas de treinamento de 2026 usam Muon por padrão. Mudança a constante absoluta na lei de escala, não sua forma.

```figure
scaling-laws
```

## Construí-lo

Veja .`code/main.py`Implementamos a equação de perda Chinchilla e resolvemos para o computador-óptimo .$(N, D)$Em cada um dos vários orçamentos de computação.

### Passo 1: Perda de chinchilla

```python
def chinchilla_loss(N, D, A=406.4, B=410.7, alpha=0.34, beta=0.28, E=1.69):
    return A / N ** alpha + B / D ** beta + E
```

Plot $L$Como um contorno sobre $(N, D)$em fixa $C = 6ND$- Encontre o mínimo.

### Passo 2: Fronteira óptima de computação

Para os orçamentos de computação de `1e17`- Não .`1e25`FLOPs, encontrar $(N, D)$que minimizem as perdas sujeitas a $6ND = C$Verificar a relação $D/N \approx 20$- Não .

### Passo 3: custo de formação excessiva

Calcule a perda extra que você paga para treinar um modelo 10x menor (1/10 do N ideal, 10x o D ideal).

### Passo 4: comparação com modelos reais

Chega conhecido .`(N, D)`par para GPT-3, Chinchilla, Llama 3 8B, DeepSeek- V3 (param activos), e comparar a perda prevista versus relatada.

## Usá-lo

É improvável que treines um modelo de fronteira, mas as leis de escalagem dizem:

1. **Whether your fine-tune has enough data.**Se os dados específicos da tarefa forem abaixo de 20 tokens por parâmetro do modelo base, espere saturação em algum nível de perda.
2. **Whether to pick a bigger base model.**Se gastas todo o teu orçamento em inferências, prefires um modelo menor e mais treinado.
3. **Where the returns diminish.**Além de 1000x Chinchilla-óptima, as mudanças de perda de registro tornam-se ruído.

**The research trajectory in 2026:**

- **Data-constrained regime.**A web tem um número finito de tokens de alta qualidade (~ 510 trilhões de inglês após a filtragem). O pré-treino de fronteira está se aproximando deste teto. Dados sintéticos, multilíngues, multimodal e afinamento em escala RLHF são as próximas alavancas.
- **Compute-multiplier tricks.**Otimizador de muons, MoE, melhor curatividade de dados  cada um muda as constantes absolutas, não o asintoto.
- **Scaling laws for RL.**A primeira evidência sugere a lei do poder em amostras de RL, mas com exponentes muito diferentes do que o pré-treino.

## Envia-o

Veja .`outputs/skill-training-budget-estimator.md`A habilidade escolhe .`(N, D, hours, GPU)`Para uma nova fase de formação, dado o orçamento de cálculo, as restrições de implantação e a perda de objetivos.

## Exercícios

1. **Easy.**Corra .`code/main.py`Imprimir Chinchilla-optimo .$(N, D)$para orçamentos de computação `1e20`- Não .`1e22`- Não .`1e24`Comparar com a mesa de modelos reais.
2. **Medium.**Implementar a curva de perda de Hoffmann como função de computador.`log10(C)`Identificar quando a lei prevê que precisamos de um sistema de controle de dados.$>10^{28}$FLOPs para a próxima redução de 0,1 na entropia cruzada.
3. **Hard.**Aplique a sua própria lei de escala em 5 modelos minúsculos (100K a 10M parâmetros) treinados no mesmo conjunto de dados.$\alpha$E ...$E$Quão bem os seus exponentes correspondem aos publicados?

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Parameters (N) | "Model size" | Non-embedding weight count; determines capacity. |
| Tokens (D) | "Training data" | Number of training tokens seen; determines how well the parameters get used. |
| Compute (C) | "FLOPs spent" | Approximately `6 × N × D` for a standard transformer. |
| Chinchilla-optimal | "D/N ≈ 20" | Ratio that minimizes loss per FLOP of pretraining. |
| Over-training | "Past Chinchilla" | Spend extra training FLOPs to save inference FLOPs; D/N >> 20. |
| Irreducible loss | "The floor" | The $E$ term in the scaling law; the entropy of the data itself. |
| Emergent capability | "Sudden jumps at scale" | Often a scorer artifact; continuous loss is smooth. |
| Effective compute | "Training-efficiency multiplier" | Better data / optimizer / architecture multiplies how far a FLOP goes. |

## Mais leitura

- [Kaplan et al. (2020). Scaling Laws for Neural Language Models](https://arxiv.org/abs/2001.08361) o primeiro artigo sobre a legislação em escala;
- [Hoffmann et al. (2022). Training Compute-Optimal Large Language Models](https://arxiv.org/abs/2203.15556)- Chinchilla.
- [Schaeffer et al. (2023). Are Emergent Abilities of Large Language Models a Mirage?](https://arxiv.org/abs/2304.15004) surgimento como artefacto de medição.
- [Sardana, Frankle (2024). Beyond Chinchilla-Optimal: Accounting for Inference in Language Model Scaling Laws](https://arxiv.org/abs/2401.00448)Por que o treinamento excessivo de Llama é adequado para a sua carga de trabalho.
- [Jordan et al. (2024). Muon: An optimizer for hidden layers in neural networks](https://kellerjordan.github.io/posts/muon/)Multiplicador de cálculo 2x.
