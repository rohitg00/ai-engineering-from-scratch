# O Transformer Completo — Encoder + Decoder

> Attention é a estrela. Todo o resto — residuais, normalização, feed-forward, cross-attention — é a estrutura que permite empilhar fundo.

**Tipo:** Construir
**Linguagens:** Python
**Pré-requisitos:** Fase 7 · 02 (Self-Attention), Fase 7 · 03 (Multi-Head Attention), Fase 7 · 04 (Codificação Posicional)
**Tempo:** ~75 minutos

## O Problema

Uma única camada de attention é um extrator de características, não um modelo. Uma matmul por camada não tem capacidade suficiente pra linguagem. Você precisa de profundidade — e profundidade quebra sem a encanação certa.

O paper Vaswani de 2017 embalou seis decisões de design que transformaram uma camada de attention num bloco empilhável. Todo transformer desde então — encoder-only (BERT), decoder-only (GPT), encoder-decoder (T5) — herda o mesmo esqueleto. Em 2026 os blocos foram refinados (RMSNorm, SwiGLU, pre-norm, RoPE) mas o esqueleto é idêntico.

Esta aula é o esqueleto. Próximas aulas o eespecificaçãoializam — 06 pra encoders, 07 pra decoders, 08 pra encoder-decoder.

## O Conceito

![Internos do bloco encoder e decoder, conectados](../assets/full-transformer.svg)

### As seis peças

1. **Embedding + sinal posicional.** Tokens → vetores. Posição injetada via RoPE (moderno) ou sinusoidal (clássico).
2. **Self-attention.** Cada posição atende a todas as outras. Com máscara em decoders.
3. **Rede feed-forward (FFN).** MLP por posição: `W_2 · activation(W_1 · x)`. Razão de expansão 4× por padrão.
4. **Conexão residual.** `x + sublayer(x)`. Sem isso, gradientes desaparecem depois de ~6 camadas.
5. **Normalização de camada.** `LayerNorm` ou `RMSNorm` (moderno). Estabiliza o fluxo residual.
6. **Cross-attention (só decoder).** Queries vêm do decoder, keys e values da saída do encoder.

### Bloco do encoder (usado por BERT, encoder do T5)

```
x → LN → MHA(self) → + → LN → FFN → + → out
                     ^              ^
                     |              |
                     └── residual ──┘
```

Encoder é bidirecional. Sem máscara. Todas as posições veem todas as posições.

### Bloco do decoder (usado por GPT, decoder do T5)

```
x → LN → MHA(masked self) → + → LN → MHA(cross to encoder) → + → LN → FFN → + → out
```

Decoder tem três subcamadas por bloco. A do meio — cross-attention — é o único lugar onde informação flui do encoder pra decoder. Em uma arquitetura pura decoder-only (GPT), cross-attention é omitido e você tem só self-attention mascarada + FFN.

### Pre-norm vs post-norm

Paper original: `x + sublayer(LN(x))` vs `LN(x + sublayer(x))`. Post-norm perdeu popularidade por volta de 2019 — é mais difícil treinar fundo sem warmup cuidadoso. Pre-norm (`LN` *antes* do sublayer) é o padrão de 2026: Llama, Qwen, GPT-3+, Mistral todos usam.

### O bloco modernizado de 2026

Vaswani 2017 usou LayerNorm + ReLU. Stacks modernos substituíram ambos. O que blocos de produção realmente são:

| Componente | 2017 | 2026 |
|-----------|------|------|
| Normalização | LayerNorm | RMSNorm |
| Ativação FFN | ReLU | SwiGLU |
| Expansão FFN | 4× | 2,6× (SwiGLU usa três matrizes, parâmetros totais combinam) |
| Posição | Sinusoidal absoluta | RoPE |
| Attention | MHA completa | GQA (ou MLA) |
| Termos de viés | Sim | Não |

RMSNorm remove a centralização pela média do LayerNorm (uma subtração a menos), economiza compute e é empiricamente pelo menos tão estável. SwiGLU (`Swish(W1 x) ⊙ W3 x`) consistentemente supera FFN com ReLU/GELU por ~0,5 ponto de ppl nos papers de Llama, PaLM e Qwen.

### Contagem de parâmetros

Pra um bloco com `d_model = d` e expansão FFN `r`:

- MHA: `4 · d²` (projeções Q, K, V, O)
- FFN (SwiGLU): `3 · d · (r · d)` ≈ `3rd²`
- Normas: desprezível

Em `d = 4096, r = 2,6, layers = 32` (aproximadamente Llama 3 8B): `32 · (4·4096² + 3·2,6·4096²) ≈ 32 · (16 + 32) M = ~1,5B parâmetros por camada × 32 ≈ 7B` (mais embeddings e head). Combina com contagens publicadas.

## Construindo

### Passo 1: os blocos básicos

Usando a classe `Matrix` da Aula 03 (copiada pra este arquivo por independência):

- `layer_norm(x, eps=1e-5)` — subtrai média, divide pelo desvio padrão.
- `rms_norm(x, eps=1e-6)` — divide pelo RMS. Sem subtração de média.
- `gelu(x)` e `silu(x) * W3 x` (SwiGLU).
- `ffn_swiglu(x, W1, W2, W3)`.
- `encoder_block(x, params)` e `decoder_block(x, enc_out, params)`.

Veja `code/main.py` pra conexão completa.

### Passo 2: conectar um encoder de 2 camadas e um decoder de 2 camadas

Empilhe-os. Passe a saída do encoder em toda cross-attention do decoder. Adicione um LN final antes da projeção de saída.

```python
def encode(tokens, params):
    x = embed(tokens, params.emb) + sinusoidal(len(tokens), params.d)
    for block in params.encoder_blocks:
        x = encoder_block(x, block)
    return x

def decode(target_tokens, encoder_out, params):
    x = embed(target_tokens, params.emb) + sinusoidal(len(target_tokens), params.d)
    for block in params.decoder_blocks:
        x = decoder_block(x, encoder_out, block)
    return x
```

### Passo 3: rodar forward em um exemplo brinquedo

Passe uma fonte de 6 tokens e um alvo de 5 tokens. Verifique que a saída tem shape `(5, vocab)`. Sem treinamento — esta aula é sobre a arquitetura, não a perda.

### Passo 4: trocar pra RMSNorm + SwiGLU

Substitua LayerNorm e FFN com ReLU por RMSNorm e SwiGLU. Confirme que shapes ainda batem. Essa é a modernização de 2026 com uma substituição de função.

## Usando

As implementações de referência PyTorch/TF: `nn.TransformerEncoderLayer`, `nn.TransformerDecoderLayer`. Mas a maioria do código de produção em 2026 monta seu próprio bloco porque:

- Flash Attention é chamada dentro da attention, não via `nn.MultiheadAttention`.
- GQA / MLA não estão na stdlib de referência.
- RoPE, RMSNorm, SwiGLU não são os padrões do PyTorch.

HF `transformers` tem blocos de referência limpos que vale ler: `modeling_llama.py` é o bloco decoder-only canônico de 2026. São ~500 linhas e vale ler uma vez.

**Encoder vs decoder vs encoder-decoder — quando escolher:**

| Necessidade | Escolha | Exemplo |
|-------------|---------|---------|
| Classificação, embeddings, QA sobre texto | Encoder-only | BERT, DeBERTa, ModernBERT |
| Geração de texto, chat, código, raciocínio | Decoder-only | GPT, Llama, Claude, Qwen |
| Entrada estruturada → saída estruturada (tradução, resumo) | Encoder-decoder | T5, BART, Whisper |

Decoder-only venceu linguagem porque escala mais limpo e lida tanto com compreensão quanto geração. Encoder-decoder ainda é melhor quando a entrada tem uma identidade de "sequência fonte" clara (tradução, reconhecimento de fala, tarefas estruturadas).

## Entregando

Veja `outputs/skill-transformer-block-reviewer.md`. A skill revisa uma nova implementação de bloco transformer contra os padrões de 2026 e marca peças faltantes (pre-norm, RoPE, RMSNorm, GQA, razão de expansão FFN).

## Exercícios

1. **Fácil.** Conte os parâmetros do seu encoder_block com `d_model=512, n_heads=8, ffn_expansion=4, swiglu=True`. Valide implementando o bloco e usando `sum(p.numel() for p in block.parameters())`.
2. **Médio.** Mude de post-norm pra pre-norm. Inicialize ambos e meça a norma das ativações após 12 camadas empilhadas em entrada aleatória. Ativações do post-norm devem explodir; do pre-norm devem ficar limitadas.
3. **Difícil.** Implemente um encoder-decoder de 4 camadas numa tarefa de cópia (copiar `x` invertido). Treine 100 passos. Reporte perda. Troque pra RMSNorm + SwiGLU + RoPE — a perda cai?

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|--------------------------|
| Bloco | "Uma camada do transformer" | Pilha de norm + attention + norm + FFN, envolvido em conexões residuais. |
| Residual | "Conexão de pulo" | Saída `x + f(x)`; permite fluxo de gradiente através de pilhas profundas. |
| Pre-norm | "Normaliza antes, não depois" | Moderno: `x + sublayer(LN(x))`. Treina mais fundo sem malabarismos de warmup. |
| RMSNorm | "LayerNorm sem a média" | Divide pelo RMS; uma operação a menos, mesma estabilidade empírica. |
| SwiGLU | "A FFN que todo mundo trocou" | `Swish(W1 x) ⊙ W3 x → W2`. Vence ReLU/GELU em ppl de LM. |
| Cross-attention | "Como o decoder vê o encoder" | MHA com Q do decoder, K/V das saídas do encoder. |
| Expansão FFN | "O quão larga é a MLP intermediária" | Razão entre tamanho oculto e d_model, geralmente 4 (LayerNorm) ou 2,6 (SwiGLU). |
| Sem viés | "Remover os termos +b" | Stacks modernos omitem vieses em camadas lineares; leve melhoria de ppl, modelo menor. |

## Leituras Complementares

- [Vaswani et al. (2017). Attention Is All You Need](https://arxiv.org/abs/1706.03762) — eespecificaçãoificação original do bloco.
- [Xiong et al. (2020). On Layer Normalization in the Transformer Architecture](https://arxiv.org/abs/2002.04745) — por que pre-norm vence post-norm em profundidade.
- [Zhang, Sennrich (2019). Root Mean Square Layer Normalization](https://arxiv.org/abs/1910.07467) — RMSNorm.
- [Shazeer (2020). GLU Variants Improve Transformer](https://arxiv.org/abs/2002.05202) — paper do SwiGLU.
- [HuggingFace `modeling_llama.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/llama/modeling_llama.py) — bloco decoder-only canônico de 2026.
