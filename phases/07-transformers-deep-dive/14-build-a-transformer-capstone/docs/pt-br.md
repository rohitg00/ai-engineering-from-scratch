# Construa um Transformer do Zero — O Capstone

> Treze aulas. Um modelo. Sem atalhos.

**Tipo:** Construir
**Linguagens:** Python
**Pré-requisitos:** Fase 7 · 01 até 13. Não pule.
**Tempo:** ~120 minutos

## O Problema

Você leu todo paper. Implementou attention, separação multi-head, codificações posicionais, blocos encoder e decoder, perdas BERT e GPT, MoE, KV cache. Agora faça tudo funcionar junto numa tarefa real.

O capstone: treine um pequeno transformer decoder-only de ponta a ponta numa tarefa de modelagem de linguagem em nível de caractere. Ele lê Shakespeare. Gera novo Shakespeare. É pequeno o suficiente pra treinar num laptop em menos de 10 minutos. É correto o suficiente que trocar por um dataset maior e treinamento mais longo te dá um LM real.

Esse é o "nanoGPT" do curso. Não é original — o tutorial nanoGPT do Karpathy de 2023 é a implementação de referência que todo estudante escreve pelo menos uma vez. Pegamos a forma e adaptamos em torno do que cobrimos.

## O Conceito

![Diagrama do bloco transformer do zero](../assets/capstone.svg)

A arquitetura, anotada:

```
input tokens (B, N)
   │
   ▼
token embedding + positional embedding  ◀── Lesson 04 (RoPE option)
   │
   ▼
┌──── block × L ────────────────────┐
│  RMSNorm                          │  ◀── Lesson 05
│  MultiHeadAttention (causal)      │  ◀── Lesson 03 + 07 (causal mask)
│  residual                         │
│  RMSNorm                          │
│  SwiGLU FFN                       │  ◀── Lesson 05
│  residual                         │
└────────────────────────────────── ┘
   │
   ▼
final RMSNorm
   │
   ▼
lm_head (tied to token embedding)
   │
   ▼
logits (B, N, V)
   │
   ▼
shift-by-one cross-entropy            ◀── Lesson 07
```

### O que entregamos

- `GPTConfig` — um lugar pra configurar todos os hiperparâmetros.
- `MultiHeadAttention` — causal, em batch, com caminho opcional estilo Flash (`scaled_dot_product_attention` do PyTorch).
- `SwiGLUFFN` — FFN moderno.
- `Block` — pre-norm, attention + FFN envolvidos em residual.
- `GPT` — embeddings, blocos empilhados, head LM, generate().
- Loop de treinamento com AdamW, LR coseno, clipping de gradiente.
- Tokenizer em nível de caractere no texto Shakespeare.

### O que NÃO entregamos

- RoPE — implementado conceitualmente na Aula 04. Aqui usamos embeddings posicionais aprendidos por simplicidade. Os exercícios pedem pra trocar por RoPE.
- KV cache durante geração — cada passo de geração recomputa attention sobre o prefixo inteiro. Mais lento mas mais simples. Os exercícios pedem pra adicionar KV cache.
- Flash Attention — PyTorch 2.0+ despacha automaticamente se as entradas combinarem; usamos `F.scaled_dot_product_attention`.
- MoE — uma FFN por bloco. Você viu MoE na Aula 11.

### Métricas alvo

Num Mac M2 laptop, um GPT de 4 camadas, 4 heads, d_model=128 treinado por 2.000 passos em `tinyshakespeare.txt`:

- Perda de treinamento converge de ~4,2 (aleatório) pra ~1,5 em cerca de 6 minutos.
- Saída amostrada parece shakespeare: palavras arcaicas, quebras de linha, nomes próprios como "ROMEO:" surgem.
- Perda de validação (últimos 10% do texto separados) acompanha perda de treinamento de perto; sem overajuste nessa escala/orçamento.

## Construindo

Esta aula usa PyTorch. Instale `torch` (build CPU serve). Veja `code/main.py`. O script lida com:

- Download de `tinyshakespeare.txt` se ausente (ou leitura de cópia local).
- Tokenizer em nível de caractere (byte-level).
- Split treino/validação em 90/10.
- Loop de treinamento com bf16 autocast em hardware suportado.
- Amostragem depois do treinamento completar.

### Passo 1: dados

```python
text = open("tinyshakespeare.txt").read()
chars = sorted(set(text))
stoi = {c: i for i, c in enumerate(chars)}
itos = {i: c for c, i in stoi.items()}
encode = lambda s: [stoi[c] for c in s]
decode = lambda xs: "".join(itos[x] for x in xs)
```

65 caracteres únicos. Vocabulário minúsculo. Cabe em vocab_size de 4 bytes. Sem BPE, sem drama de tokenizer.

### Passo 2: modelo

Veja `code/main.py`. O bloco é texto didático da Aula 05 — pre-norm, RMSNorm, SwiGLU, MHA causal. Contagem de parâmetros pra 4/4/128: ~800K.

### Passo 3: loop de treinamento

Pegue um batch aleatório de janelas de 256 tokens. Forward. Shift-by-one cross-entropy. Backward. Passo AdamW. Log. Repita.

```python
for step in range(max_steps):
    x, y = get_batch("train")
    logits = model(x)
    loss = F.cross_entropy(logits.view(-1, vocab_size), y.view(-1))
    loss.backward()
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
    opt.step()
    opt.zero_grad()
```

### Passo 4: amostrar

Dado um prompt, repita forward, amostra de logits top-p, anexe e continue. Pare após 500 tokens.

### Passo 5: leia a saída

Depois de 2.000 passos:

```
ROMEO:
Away and mild will not thy friend, that thou shalt wit:
The chief that well shame and hath been his friends,
...
```

Não é Shakespeare. Mas é "shakespeare-shaped". Uma vitória clara pra ~800K parâmetros e 6 minutos num laptop.

## Usando

Este capstone é uma arquitetura de referência. Três extensões pra levá-lo a algo real:

1. **Troque o tokenizer.** Use BPE (ex: `tiktoken.get_encoding("cl100k_base")`). Vocabulário pula de 65 pra ~50.000. Capacidade do modelo precisa escalar pra compensar.
2. **Treine num corpus maior.** Use `OpenWebText` ou `fineweb-edu` (HuggingFace). 10B tokens numa A100 única levam ~24 horas pra um GPT de 125M params.
3. **Adicione RoPE + KV cache + Flash Attention.** Os exercícios abaixo caminham por cada um.

Isso resulta num GPT de 125M parâmetros que gera inglês fluente. Não é um modelo de fronteira. Mas o mesmo caminho de código — só maior — é o que Karpathy, EleutherAI e o Allen Institute usam pra treinar checkpoints de pesquisa em 2026.

## Entregando

Veja `outputs/skill-transformer-review.md`. A skill revisa uma implementação do zero pra correção em todas as 13 aulas anteriores.

## Exercícios

1. **Fácil.** Rode `code/main.py`. Verifique que a perda de validação do último passo do modelo treinado está abaixo de 2,0. Mude `max_steps` de 2.000 pra 5.000 — val loss continua melhorando?
2. **Médio.** Substitua embeddings posicionais aprendidos por RoPE. Aplique a rotação em Q e K dentro de `MultiHeadAttention`. Treine e verifique que val loss é pelo menos tão baixa.
3. **Médio.** Implemente um KV cache no loop de amostragem. Gere 500 tokens com e sem cache. Tempo real deve melhorar 5–20× num laptop.
4. **Difícil.** Adicione uma segunda head ao modelo que prevê o token dois à frente (MTP — Multi-Token Prediction do DeepSeek-V3). Treine conjuntamente. Ajuda?
5. **Difícil.** Substitua a FFN única por bloco por um MoE de 4 experts. Router + top-2. Veja como val loss muda em parâmetros ativos equivalentes.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|--------------------------|
| nanoGPT | "O tutorial repo do Karpathy" | Código mínimo de treinamento de transformer decoder-only, ~300 LOC; referência canônica. |
| tinyshakespeare | "O corpus brinquedo padrão" | ~1,1 MB de texto; todo tutorial de LM em caractere desde 2015 usa. |
| Embeddings compartilhados | "Compartilhar matriz entrada/saída" | Peso da head LM = transposta da matriz de embedding de token; economiza parâmetros, melhora qualidade. |
| bf16 autocast | "Truque de precisão de treinamento" | Rode forward/back em bf16, mantenha estado do otimizador em fp32; padrão desde 2021. |
| Clipping de gradiente | "Para picos" | Limite gradiente global norm em 1,0; previne explosões de treinamento. |
| Agenda LR coseno | "O padrão pós-2020" | LR sobe linearmente (warmup) depois decai em forma de cosseno pra 10% do pico. |
| MFU | "Utilização de FLOP do Modelo" | FLOPs realizados / pico teórico; 40% dense, 30% MoE é forte em 2026. |
| Val loss | "Perda em validação" | Entropia cruzada em dados que o modelo nunca viu; detector de overajuste. |

## Leituras Complementares

- [The Annotated Transformer (Harvard NLP)](https://nlp.seas.harvard.edu/annotated-transformer/) — a implementação anotada clássica.
