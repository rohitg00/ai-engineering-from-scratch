# GPT  Modelagem de Língua Causal

> O BERT vê ambos os lados. O GPT vê apenas o passado. A máscara triangular é a linha única mais consequente de código na IA moderna.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 05 (Full Transformer), Phase 7 · 06 (BERT)
**Time:** ~75 minutes

## O problema

Um modelo de linguagem responde a uma pergunta: dada a primeira `t-1`Tokens, qual é a distribuição de probabilidade sobre token `t`Treinar nesse sinal  previsão de tokens próximos  e você obtém um modelo que pode gerar texto arbitrário um token por vez.

Para treiná-lo de ponta a ponta em uma sequência inteira em paralelo, você precisa que a previsão de cada posição dependa apenas de posições anteriores.

A máscara causal faz isto. É uma única matriz triangular superior de`-inf`Os valores adicionados às pontuações de atenção antes do softmax. Depois do softmax, essas posições se tornam 0. Cada posição pode atender apenas a si mesma e posições anteriores.

GPT-1 (2018), GPT-2 (2019), GPT-3 (2020), GPT-4 (2023), GPT-5 (2025), Claude, Llama, Qwen, Mistral, DeepSeek, Kimi  são todos transformadores causais apenas de decodificação com o mesmo ciclo central. O que os separa são a qualidade de dados, escala e refinamentos arquitetônicos, e pós-treinamento (SFT, RLHF, DPO e seus sucessores).

## O conceito

![Causal mask creates a triangular attention matrix](../assets/causal-attention.svg)

### A máscara .

Dada uma sequência de comprimento $N$, construir um$N \times N$Matriz:

```math
M_{ij} = \begin{cases} 0 & \text{if } j \le i \\ -\infty & \text{if } j > i \end{cases}
```

Adicionar`M`para os resultados de atenção antes do softmax. $\exp(-\infty) = 0$Cada linha da matriz de atenção é uma distribuição de probabilidade sobre posições anteriores apenas.

Custos de execução: 1 `torch.tril()`Tempo de cálculo: nanossegundos. Impacto no campo: tudo.

### De onde vem o triângulo

A máscara é geralmente apresentada como um parche embulado na atenção. Execute a derivação na outra direção e ela deixa de ser misteriosa: a atenção é o terceiro refinamento de uma média de prefixo, e o triângulo é os limites de ciclo dessa média, escrito como uma matriz.

**Stage 1 — prefix average.**O resumo causal mais estúpido de uma sequência: posição .$i$torna-se o meio das posições $0 \ldots i$Como um ciclo, isto é.`out[i] = X[:i+1].mean(0)`O mesmo cálculo é uma matriz multiplicar. Tome uma matriz triangular inferior de um, divide cada linha pelo seu conteúdo, multiplicar:

```python
import numpy as np

A = np.tril(np.ones((n, n)))
A = A / A.sum(axis=1, keepdims=True)
out = A @ X
```

- Em linha .$i$de$A$É o que é$[1/(i+1), \ldots, 1/(i+1), 0, \ldots, 0]$Os zeros acima da diagonal são a causalidade. Nada sobre o futuro foi mascarado; o futuro nunca foi na soma.

**Stage 2 — learned weights.**Uma média uniforme trata cada token passado como igualmente relevante.`S`. Agora as linhas não mais somam a uma por construção, então normalizar cada linha com softmax em vez de dividir pelo conteúdo. Softmax nunca sai um zero exato, o que quebra a causalidade  a menos que as pontuações futuras entrem como `-inf`, porque`exp(-inf) = 0`- Não .

```python
def softmax(x, axis):
    e = np.exp(x - np.max(x, axis=axis, keepdims=True))
    return e / e.sum(axis=axis, keepdims=True)

S = S + np.triu(np.full((n, n), -np.inf), k=1)
A = softmax(S, axis=1)
out = A @ X
```

O mesmo triângulo, a mesma matriz de fila-estocástica, o mesmo matmul.`-inf`Mas masque não é uma nova máquina. é zero entradas de estágio 1, traduzido para o domínio de entrada de softmax.

**Stage 3 — content-dependent weights.**Na fase 2, `S`O resultado é fixado após o treino: a posição 7 pesa sempre a mesma posição 3, independentemente do que os tokens digam.`S = Q @ K.T / sqrt(d_k)`Mascara, softmax, matmul  são idênticos.

Três estágios, uma invariante: uma matriz de fila-estocástica triangular inferior vezes a sequência. média uniforme, pesos estáticos aprendidos, pesos dependentes do conteúdo. A máscara nunca foi adicionada à atenção.

```figure
mask-derivation
```

### Formação paralela, inferência em série

Formação: avançar o conjunto `(N, d_model)`Sequência uma vez, calcular N perdas de entropia cruzada (um por posição), soma, backprop. Paralelas ao longo da sequência. É por isso que as escalas de treinamento GPT  você processar 1M tokens em um lote em uma passagem de GPU.

Inferência: você gera token por token.`[t1, t2, t3]`- Não .`t4`- Alimentação .`[t1, t2, t3, t4]`- Não .`t5`- Alimentação .`[t1, t2, t3, t4, t5]`- Não .`t6`O cache KV (Lessão 12) salva os estados ocultos de `t1…tn`Então, você não os recompõe a cada passo. Mas profundidade serial na inferência = comprimento de saída. Isso é o imposto autoregressivo e por que a decodificação é o gargalo de latência de cada LLM.

### A perda  mudança por uma

Dados tokens `[t1, t2, t3, t4]`- Não .

- - Introdução:`[t1, t2, t3]`
- Objetivos: `[t2, t3, t4]`

Para cada posição .`i`, computação `-log P(target_i | inputs[:i+1])`Esta é a entropia cruzada para toda a sequência.

Todos os transformadores LM que já ouviram falar de trens nesta perda.

### Estratégias de decodificação

Após o treino, as escolhas de amostragem são mais importantes do que as pessoas pensam.

| Method | What it does | When to use |
|--------|--------------|-------------|
| Greedy | Argmax every step | Deterministic tasks, code completion |
| Temperature | Divide logits by T, sample | Creative tasks, higher T = more diversity |
| Top-k | Sample from top-k tokens only | Kills low-probability tails |
| Top-p (nucleus) | Sample from smallest set with cumulative prob ≥ p | 2020+ default; adapts to distribution shape |
| Min-p | Keep tokens with `p > min_p * max_p` | 2024+; better at rejecting long tails than top-p |
| Speculative decoding | Draft model proposes N tokens, big model verifies | 2–3× latency reduction at same quality |

Em 2026, min-p + temperatura 0,7 é um padrão razoável para modelos de pesos abertos.

### O que fez com que a "receita GPT" funcionasse

1. **Decoder-only.**Sem codificador, uma passagem de atenção + FFN por camada.
2. **Scaling.**124M → 1.5B → 175B → trilhões. As leis da escala Chinchilla (Lessão 13) dizem-lhe como gastar computação.
3. **In-context learning.**Surgiu em torno de 6B13B. O modelo pode seguir alguns exemplos de tiros sem ajuste fino.
4. **RLHF.**O pós-treinamento sobre preferências humanas transformou texto bruto pré-treinado em assistentes de chat.
5. **Pre-norm + RoPE + SwiGLU.**Treinamento estável em escala.

A arquitetura do núcleo não mudou muito desde o GPT-2. Tudo o interessante aconteceu em dados, escala e pós-treino.

```figure
causal-mask
```

## Construí-lo

### Passo 1: a máscara causal

Veja .`code/main.py`Um único liner:

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

Adicione-o aos resultados de atenção antes do Softmax.

### Passo 2: modelo de GPT de duas camadas

Aponta dois blocos de decodificador (auto-atenção mascarada + FFN, sem atenção cruzada). Adicione um embedding token, uma codificação posicional e um unembedding (ligado à matriz de embedding token  um truque padrão desde GPT-2).

### Passo 3: previsão do próximo token, de ponta a ponta

Em um vocabulário de brinquedo de 20 tokens, produzir logits em cada posição. Calcule a perda de entropia cruzada contra o alvo de deslocamento por um.

### Passo 4: amostragem

Implementar ganância, temperatura, top-k, top-p, min-p. Execute cada um em um prompt fixo e compare as saídas. Uma função de amostragem é de 10 linhas.

## Usá-lo

PyTorch, 2026 Idioma:

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.2-3B-Instruct")
tok = AutoTokenizer.from_pretrained("meta-llama/Llama-3.2-3B-Instruct")

prompt = "Attention is all you need because"
inputs = tok(prompt, return_tensors="pt")
out = model.generate(
    **inputs,
    max_new_tokens=64,
    temperature=0.7,
    top_p=0.9,
    do_sample=True,
)
print(tok.decode(out[0]))
```

Sob o capô,`generate()`executa o passado para a frente, puxa os logits da posição final, amostra o token seguinte, anexa-o e repete. Cada stack de inferência LLM de produção (vLLM, TensorRT-LLM, llama.cpp, Ollama, MLX) implementa o mesmo loop com otimização pesada  preenchimento em lote, batch contínuo, pagamento em cache KV, decodificação especulativa.

**GPT vs BERT, one line each:**Previsões do GPT $P(x_t \mid x_{<t})$- O BERT prevê .$P(x_{\text{masked}} \mid x_{\text{unmasked}})$A perda determina se o modelo pode gerar.

## Envia-o

Veja .`outputs/skill-sampling-tuner.md`A habilidade seleciona parâmetros de amostragem para uma tarefa de nova geração e indica quando é necessária a decodificação determinista.

## Exercícios

1. **Easy.**Corra .`code/main.py`Verificar que a matriz de atenção causal é triangular inferior após softmax.
2. **Medium.**Compare perplexidade de beam-4 vs avarice em 10 instruções curtas.
3. **Hard.**Implementar decodificação especulativa: usar um modelo de 2 camadas minúsculas como rascunho e um modelo de 6 camadas como verificador.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Causal mask | "The triangle" | Upper-triangular `-inf` matrix added to attention scores so position `i` only sees positions `≤ i`. |
| Next-token prediction | "The loss" | Cross-entropy of the model's distribution against the true next token at every position. |
| Autoregressive | "Generate one at a time" | Feed output back as input; parallelism only during training, not during generation. |
| Logits | "Pre-softmax scores" | Raw output of the LM head before softmax; sampling happens on these. |
| Temperature | "Creativity knob" | Divide logits by $T$; $T \to 0$ = greedy, $T \to \infty$ = uniform. |
| Top-p | "Nucleus sampling" | Truncate distribution to smallest set summing to $\ge p$; sample from what remains. |
| Min-p | "Better than top-p" | Keep tokens where `p ≥ min_p × max_p`; adapts cutoff to sharpness of distribution. |
| Speculative decoding | "Draft + verify" | Cheap model proposes N tokens; big model verifies in parallel. |
| Teacher forcing | "Training trick" | During training, feed the true previous token, not the model's prediction. Standard for every seq2seq LM. |

## Mais leitura

- [Radford et al. (2018). Improving Language Understanding by Generative Pre-Training](https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf)GPT-1.
- [Radford et al. (2019). Language Models are Unsupervised Multitask Learners](https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf)GPT-2.
- [Brown et al. (2020). Language Models are Few-Shot Learners](https://arxiv.org/abs/2005.14165) GPT-3 e aprendizagem no contexto.
- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192)Papel de descodificação de especificações.
- [HuggingFace `modeling_llama.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/llama/modeling_llama.py) código de referência canônico causal-LM.
