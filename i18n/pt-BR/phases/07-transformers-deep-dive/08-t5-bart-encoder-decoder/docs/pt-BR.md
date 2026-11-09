# T5, BART  Modelos de codificação e decodificação

> Os codificadores entendem. Os decodificadores geram. Coloquem-nos de novo juntos e você obtém um modelo construído para tarefas de entrada → saída: traduzir, resumir, reescrever, transcriver.

**Type:** Learn
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 06 (BERT), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## O problema

GPT-só decodificador e BERT-só encodificador cada tira abaixo da arquitetura de 2017 para um objetivo diferente.

- Tradução: Inglês → Francês.
- Resumo: 5.000 tokens artigo → 200 tokens resumo.
- Reconhecimento de fala: tokens de áudio → tokens de texto.
- Extração estruturada: prosa → JSON.

Para estes, o encoder-decoder faz o ajuste mais limpo. O encoder produz uma representação densa da fonte. O decodador gera a saída, atendendo a essa representação em cada passo. O treinamento é de deslocamento por um no lado da saída. A mesma perda que o GPT, apenas condicionada à saída do encoder.

Dois artigos definiram o livro de jogos moderno:

1. **T5**(Raffel et al. 2019). "Transformador de Transferência de Texto para Texto". Cada tarefa de NLP reformulada como texto-in, texto-out. Arquitetura única, vocabulário único, perda única. Pretrainado em previsão de tempo mascarado (espaços corruptos na entrada, decodificá-los na saída).
2. **BART**(Lewis et al. 2019). "Transformador bidirecional e auto-regressivo. " Denoising autoencoder: corrupto input de várias maneiras (misture, mascarar, excluir, girar), peça ao decodificador para reconstruir o original.

Em 2026, o formato de codificador-decodificador continua a existir onde a estrutura de entrada importa:

- Suspirar (discurso → texto).
- A pilha de traduções do Google.
- Alguns modelos de complementação / reparação de código que têm estruturas de contexto e edição distintas.
- Flan-T5 e variantes para tarefas de raciocínio estruturado.

Só o decodificador ganhou o destaque, mas o decodificador nunca desapareceu.

## O conceito

![Encoder-decoder with cross-attention](../assets/encoder-decoder.svg)

### O loop para a frente

```
source tokens ─▶ encoder ─▶ (N_src, d_model)  ──┐
                                                 │
target tokens ─▶ decoder block                   │
                 ├─▶ masked self-attention       │
                 ├─▶ cross-attention ◀───────────┘
                 └─▶ FFN
                ↓
              next-token logits
```

O encoder é executado de forma autoregressiva, mas atende a cada passo a *a mesma* saída do encoder.

### T5 Pre-treino  Corrupção de tempo

Escolha intervalos aleatórios da entrada (longoia média de 3 tokens, 15% total).`<extra_id_0>`- Não .`<extra_id_1>`, etc. O decodificador só sai os espaços corruptos com o seu prefixo sentinela:

```
source: The quick <extra_id_0> fox jumps <extra_id_1> dog
target: <extra_id_0> brown <extra_id_1> over the lazy
```

O sinal é mais barato do que prever toda a sequência.

### BART pré-treino  denotação de ruído múltipla

O BART experimenta cinco funções sonoras:

1. Mascaragem de tokens.
2. - A eliminação de tokens.
3. Infiltramento de texto (mascarar um espaço, inserir o decodificador o comprimento certo).
4. Permutação de frases.
5. - A rotação de documentos.

Combinando o enchimento de texto + permutação de frase produziram os melhores números a jusante. O decodificador sempre reconstitui o original. A saída do BART é a sequência completa, não apenas os intervalos corrompidos , portanto, o cálculo pré-treinamento é maior que T5.

### Inferência

A mesma geração autoregressiva que a GPT. Aplica-se amostragem gananciosa / feixe / top-p. Buscar feixe (largura 45) é padrão para tradução e resumo porque a distribuição de saída é mais estreita do que o chat.

### Quando escolher cada variante em 2026

| Task | Encoder-decoder? | Why |
|------|------------------|-----|
| Translation | Yes, usually | Clear source sequence; fixed output distribution; beam search works |
| Speech-to-text | Yes (Whisper) | Input modality differs from output; encoder shapes audio features |
| Chat / reasoning | No, decoder-only | No persistent "input" — the conversation is the sequence |
| Code completion | Usually no | Decoder-only with long context wins; code models like Qwen 2.5 Coder are decoder-only |
| Summarization | Either works | BART, PEGASUS beat earlier decoder-only baselines; modern decoder-only LLMs match them |
| Structured extraction | Either | T5 is clean because "text → text" absorbs any output format |

A tendência desde ~2022: apenas o decodificador assume as tarefas que o encodificador-decodificador costumava possuir porque (a) os LLM apenas com decodificador sintonizados por instrução se generalizam para qualquer coisa através de solicitações, (b) uma arquitetura escala mais fácil do que duas, (c) a RLHF assume um decodificador.

```figure
encoder-decoder
```

## Construí-lo

Veja .`code/main.py`Implementamos a corrupção de tempo de estilo T5 para um corpus de brinquedos. A peça mais útil desta lição porque aparece em todas as receitas de pré-treino de codificadores-decodificadores desde então.

### Passo 1: Corrupção de expansão

```python
def corrupt_spans(tokens, mask_rate=0.15, mean_span=3.0, rng=None):
    """Pick spans summing to ~mask_rate of tokens. Return (corrupted_input, target)."""
    n = len(tokens)
    n_mask = max(1, int(n * mask_rate))
    n_spans = max(1, int(round(n_mask / mean_span)))
    ...
```

O formato-alvo é a convenção T5: `<sent0> span0 <sent1> span1 ...`A entrada corrompida interliga tokens inalterados com os tokens sentinela em locais de intervalo.

### Passo 2: Verificação de ida e volta

Considerando a entrada e o alvo corruptos, reconstruir a frase original. Se a sua corrupção é reversível, o pass forward é bem definido. Esta é uma verificação de sanidade  treinamento real nunca faz isso, mas o teste é barato e pega bugs de um por um em sua contabilidade de tempo.

### Passo 3: Barulho BART

Cinco funções: `token_mask`- Não .`token_delete`- Não .`text_infill`- Não .`sentence_permute`- Não .`document_rotate`Compõem dois deles e mostrem o resultado.

## Usá-lo

Referência em "CoggingFace":

```python
from transformers import T5ForConditionalGeneration, T5Tokenizer
tok = T5Tokenizer.from_pretrained("google/flan-t5-base")
model = T5ForConditionalGeneration.from_pretrained("google/flan-t5-base")

inputs = tok("translate English to French: Attention is all you need.", return_tensors="pt")
out = model.generate(**inputs, max_new_tokens=32)
print(tok.decode(out[0], skip_special_tokens=True))
```

O truque T5: o nome da tarefa entra no texto de entrada. O mesmo modelo lida com dezenas de tarefas porque cada tarefa é de texto-in, texto-out. Em 2026 este padrão foi generalizado por modelos de decodificador-só com sintonia de instruções, mas T5 codificou-o primeiro.

## Envia-o

Veja .`outputs/skill-seq2seq-picker.md`. A habilidade escolhe entre codificador-decodificador e decodificador apenas para uma nova tarefa dada estrutura de entrada-saída, latência e metas de qualidade.

## Exercícios

1. **Easy.**Corra .`code/main.py`, aplicar a corrupção de intervalos para uma frase de 30 tokens, verificar que a concatenagem dos tokens fonte não sentinel com os intervalos de destino decodificados reproduza o original.
2. **Medium.**Implementar o BART `text_infill`ruído: substituir os intervalos aleatórios por um único `<mask>`O decodificador deve inferir o comprimento de tempo correto mais conteúdo. Mostre um exemplo.
3. **Hard.**- A música é perfeita .`flan-t5-small`Em um pequeno corpus inglês → porco-latino (200 pares).`Llama-3.2-1B`sobre os mesmos dados com o mesmo cálculo.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Encoder-decoder | "Seq2seq transformer" | Two stacks: bidirectional encoder for input, causal decoder with cross-attention for output. |
| Cross-attention | "Where source talks to target" | Decoder's Q × encoder's K/V. The only place encoder information enters the decoder. |
| Span corruption | "T5's pretraining trick" | Replace random spans with sentinel tokens; decoder outputs the spans. |
| Denoising objective | "BART's game" | Apply a noise function to the input, train the decoder to reconstruct the clean sequence. |
| Sentinel token | "The `<extra_id_N>` placeholder" | Special tokens that tag corrupted spans in the source and re-tag them in the target. |
| Flan | "Instruction-tuned T5" | T5 fine-tuned on >1,800 tasks; made encoder-decoder competitive at instruction-following. |
| Beam search | "Decoding strategy" | Keep top-k partial sequences at each step; standard for translation/summarization. |
| Teacher forcing | "Training-time input" | During training, feed the true previous output token to the decoder, not the sampled one. |

## Mais leitura

- [Raffel et al. (2019). Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer](https://arxiv.org/abs/1910.10683)- T5.
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training for Natural Language Generation, Translation, and Comprehension](https://arxiv.org/abs/1910.13461)- BART.
- [Chung et al. (2022). Scaling Instruction-Finetuned Language Models](https://arxiv.org/abs/2210.11416)- Flan-T5.
- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) Whisper, o codificador-decodificador canônico de 2026.
- [HuggingFace `modeling_t5.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/t5/modeling_t5.py) execução de referência.
