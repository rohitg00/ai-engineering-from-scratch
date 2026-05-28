# T5, BART — Modelos Encoder-Decoder

> Encoders entendem. Decoders geram. Coloca de volta junto e você consegue um modelo feito pra tarefas de entrada → saída: traduzir, resumir, reescrever, transcrever.

**Tipo:** Aprender
**Linguagens:** Python
**Pré-requisitos:** Fase 7 · 05 (Transformer Completo), Fase 7 · 06 (BERT), Fase 7 · 07 (GPT)
**Tempo:** ~45 minutos

## O Problema

Decoder-only GPT e encoder-only BERT cada um reduz a arquitetura de 2017 pra um objetivo diferente. Mas muitas tarefas são naturalmente entrada-saída:

- Tradução: inglês → francês.
- Resumo: artigo de 5.000 tokens → resumo de 200 tokens.
- Reconhecimento de fala: tokens de áudio → tokens de texto.
- Extração estruturada: texto corrido → JSON.

Pra essas, encoder-decoder se encaixa mais limpo. O encoder produz uma representação densa da fonte. O decoder gera a saída, atendendo a essa representação em cada passo. Treinamento é shift-by-one no lado da saída. Mesma perda do GPT, só condicionada na saída do encoder.

Dois papers definiram o playbook moderno:

1. **T5** (Raffel et al. 2019). "Text-to-Text Transfer Transformer." Toda tarefa de NLP reformulada como texto-entrada, texto-saída. Arquitetura única, vocabulário único, perda única. Pré-treinado em predição de spans mascarados (corrompa spans na entrada, decodifique na saída).
2. **BART** (Lewis et al. 2019). "Bidirectional and Auto-Regressive Transformer." Autoencoder de denoising: corrompa a entrada de múltiplas formas (embaralhar, mascarar, deletar, rotacionar), peça ao decoder pra reconstruir o original.

Em 2026 o formato encoder-decoder sobrevive onde estrutura de entrada importa:

- Whisper (fala → texto).
- Stack de tradução do Google.
- Alguns modelos de completar/reparar código com estruturas distintas de contexto-e-edição.
- Flan-T5 e variantes pra tarefas de raciocínio estruturado.

Decoder-only ganhou holofote, mas encoder-decoder nunca sumiu.

## O Conceito

![Encoder-decoder com cross-attention](../assets/encoder-decoder.svg)

### O loop forward

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

Crucialmente, o encoder roda uma vez por entrada. O decoder roda autoregressivamente mas atende à *mesma* saída do encoder em cada passo. Cachear a saída do encoder é uma aceleração grátis pra entradas longas.

### Pré-treinamento T5 — span corruption

Escolha spans aleatórios da entrada (comprimento médio 3 tokens, 15% do total). Substitua cada span por um sentinel único: `<extra_id_0>`, `<extra_id_1>`, etc. O decoder gera só os spans corrompidos com seu prefixo sentinel:

```
source: The quick <extra_id_0> fox jumps <extra_id_1> dog
target: <extra_id_0> brown <extra_id_1> over the lazy
```

Sinal mais barato que prever a sequência inteira. Competitivo com MLM (BERT) e prefix-LM (UniLM) na ablação do paper T5.

### Pré-treinamento BART — denoising multi-noise

BART tenta cinco funções de ruído:

1. Mascaramento de tokens.
2. Deleção de tokens.
3. Preenchimento de texto (mascare um span, o decoder insere o comprimento correto).
4. Permutação de frases.
5. Rotação de documento.

Combinar preenchimento de texto + permutação de frases produziu os melhores resultados downstream. O decoder sempre reconstrói o original. Saída do BART é a sequência completa, não só os spans corrompidos — então compute de pré-treinamento é maior que T5.

### Inferência

Mesma geração autoregressiva do GPT. Guloso / beam / top-p se aplicam. Beam search (largura 4–5) é padrão pra tradução e resumo porque a distribuição de saída é mais estreita que chat.

### Quando escolher cada variante em 2026

| Tarefa | Encoder-decoder? | Por quê |
|--------|------------------|---------|
| Tradução | Sim, geralmente | Sequência fonte clara; distribuição de saída fixa; beam search funciona |
| Fala pra texto | Sim (Whisper) | Modalidade de entrada difere da saída; encoder molda features de áudio |
| Chat / raciocínio | Não, decoder-only | Sem "entrada" persistente — a conversa é a sequência |
| Completar código | Geralmente não | Decoder-only com contexto longo vence; modelos de código como Qwen 2.5 Coder são decoder-only |
| Resumo | Funciona qualquer um | BART, PEGASUS venceram baselines decoder-only anteriores; LLMs decoder-only modernos igualam |
| Extração estruturada | Qualquer um | T5 é limpo porque "texto → texto" absorve qualquer formato de saída |

A tendência desde ~2022: decoder-only toma tarefas que encoder-decoder costumava dominar porque (a) LLMs decoder-only sintonizados por instrução generalizam pra qualquer coisa via prompting, (b) uma arquitetura escala mais fácil que duas, (c) RLHF assume decoder. Encoder-decoder se mantém onde modalidade de entrada difere (fala, imagens) ou onde qualidade de beam search importa.

## Construindo

Veja `code/main.py`. Implementamos span corruption estilo T5 pra um corpus brinquedo — a peça mais útil desta aula porque aparece em toda receita de pré-treinamento encoder-decoder desde então.

### Passo 1: span corruption

```python
def corrupt_spans(tokens, mask_rate=0.15, mean_span=3.0, rng=None):
    """Pick spans summing to ~mask_rate of tokens. Return (corrupted_input, target)."""
    n = len(tokens)
    n_mask = max(1, int(n * mask_rate))
    n_spans = max(1, int(round(n_mask / mean_span)))
    ...
```

O formato de alvo é a convenção T5: `<sent0> span0 <sent1> span1 ...`. A entrada corrompida alterna tokens inalterados com tokens sentinel nos locais dos spans.

### Passo 2: verificar round-trip

Dada a entrada corrompida e o alvo, reconstrua a frase original. Se sua corrompção é reversível, o forward pass está bem definido. É uma verificação — treinamento real nunca faz isso, mas o teste é barato e pega bugs de off-by-one no controle de spans.

### Passo 3: ruído BART

Cinco funções: `token_mask`, `token_delete`, `text_infill`, `sentence_permute`, `document_rotate`. Componha duas e mostre o resultado.

## Usando

Referência HuggingFace:

```python
from transformers import T5ForConditionalGeneration, T5Tokenizer
tok = T5Tokenizer.from_pretrained("google/flan-t5-base")
model = T5ForConditionalGeneration.from_pretrained("google/flan-t5-base")

inputs = tok("translate English to French: Attention is all you need.", return_tensors="pt")
out = model.generate(**inputs, max_new_tokens=32)
print(tok.decode(out[0], skip_especificaçãoial_tokens=True))
```

O truque T5: o nome da tarefa vai no texto de entrada. O mesmo modelo lida com dezenas de tarefas porque cada tarefa é texto-entrada, texto-saída. Em 2026 esse padrão foi generalizado por modelos decoder-only sintonizados por instrução, mas T5 codificou primeiro.

## Entregando

Veja `outputs/skill-seq2seq-picker.md`. A skill escolhe entre encoder-decoder e decoder-only pra uma nova tarefa dada a estrutura entrada-saída, latência e alvos de qualidade.

## Exercícios

1. **Fácil.** Rode `code/main.py`, aplique span corruption numa frase de 30 tokens, verifique que concatenar os tokens fonte não-sentinel com os spans decodificados do alvo reproduz o original.
2. **Médio.** Implemente o ruído `text_infill` do BART: substitua spans aleatórios por um único token `<mask>` e o decoder deve inferir o comprimento correto do span mais o conteúdo. Mostre um exemplo.
3. **Difícil.** Faça fine-tuning de `flan-t5-small` num corpus minúsculo inglês → pig-Latin (200 pares). Meça BLEU num conjunto de validação de 50 pares. Compare com fine-tuning de `Llama-3.2-1B` nos mesmos dados com o mesmo compute.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|--------------------------|
| Encoder-decoder | "Transformer seq2seq" | Duas pilhas: encoder bidirecional pra entrada, decoder causal com cross-attention pra saída. |
| Cross-attention | "Onde fonte conversa com alvo" | Q do decoder × K/V do encoder. Único lugar onde informação do encoder entra no decoder. |
| Span corruption | "O truque de pré-treinamento do T5" | Substitui spans aleatórios por tokens sentinel; decoder gera os spans. |
| Objetivo de denoising | "O jogo do BART" | Aplica função de ruído na entrada, treina o decoder pra reconstruir a sequência limpa. |
| Token sentinel | "O placeholder `<extra_id_N>`" | Tokens eespecificaçãoiais que marcam spans corrompidos na fonte e remarcam no alvo. |
| Flan | "T5 sintonizado por instrução" | T5 fine-tuned em >1.800 tarefas; tornou encoder-decoder competitivo em seguir instruções. |
| Beam search | "Estratégia de decodificação" | Mantém top-k sequências parciais a cada passo; padrão pra tradução/resumo. |
| Teacher forcing | "Input durante treinamento" | Durante treinamento, alimenta o token de saída anterior verdadeiro ao decoder, não o amostrado. |

## Leituras Complementares

- [Raffel et al. (2019). Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer](https://arxiv.org/abs/1910.10683) — T5.
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training for Natural Language Generation, Translation, and Comprehension](https://arxiv.org/abs/1910.13461) — BART.
- [Chung et al. (2022). Scaling Instruction-Finetuned Language Models](https://arxiv.org/abs/2210.11416) — Flan-T5.
- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) — Whisper, o encoder-decoder canônico de 2026.
- [HuggingFace `modeling_t5.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/t5/modeling_t5.py) — implementação de referência.
