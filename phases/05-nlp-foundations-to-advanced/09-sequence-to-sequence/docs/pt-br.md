# Modelos Sequence-to-Sequence

> Duas RNNs fingindo ser um tradutor. O gargalo que encontram é a razão de attention existir.

**Tipo:** Construção
**Linguagens:** Python
**Pré-requisitos:** Fase 5 · 08 (CNNs + RNNs pra Texto), Fase 3 · 11 (Introdução ao PyTorch)
**Tempo:** ~75 minutos

## O Problema

Classificação mapeia uma sequência de tamanho variável pra um único label. Tradução mapeia uma sequência de tamanho variável pra outra sequência de tamanho variável. Entrada e saída vivem em vocabulários diferentes, possivelmente idiomas diferentes, sem garantia de paridade de comprimento.

A arquitetura seq2seq (Sutskever, Vinyals, Le, 2014) resolveu isso com uma receita deliberadamente simples. Duas RNNs. Uma lê a frase fonte e produz um vetor de contexto de tamanho fixo. A outra lê esse vetor e gera a frase alvo token por token. Mesmo código que você escreveu pra lição 08, colado de forma diferente.

Vale estudar por duas razões. Primeiro, o gargalo do vetor de contexto é a falha mais pedagogicamente útil em NLP. Motiva tudo que attention e transformers fazem de bom. Segundo, a receita de treino (teacher forcing, scheduled sampling, beam search em inferência) ainda se aplica a todo sistema moderno de geração incluindo LLMs.

## O Conceito

**Encoder.** Uma RNN que lê a frase fonte. Seu último estado oculto é o **vetor de contexto** — um resumo de tamanho fixo de toda a entrada. Não perde nada da fonte, em tese.

**Decoder.** Outra RNN inicializada a partir do vetor de contexto. A cada passo, usa o token anteriormente gerado como entrada e produz uma distribuição sobre o vocabulário alvo. Amostra ou argmax pra escolher o próximo token. Alimenta de volta. Repete até um token `<EOS>` ser produzido ou comprimento máximo atingido.

**Treino:** Perda de entropia cruzada a cada passo do decoder, somada sobre a sequência. Backprop padrão no tempo através de ambas as redes.

**Teacher forcing.** Durante treino, a entrada do decoder no passo `t` é o token *ground-truth* na posição `t-1`, não a própria previsão anterior do decoder. Isso estabiliza treino; sem isso, erros iniciais cascateam e o modelo nunca aprende. Em inferência, você tem que usar as previsões do próprio modelo, então sempre há uma lacuna de distribuição treino/inferência. Essa lacuna se chama **exposure bias**.

**O gargalo.** Tudo que o encoder aprendeu sobre a fonte tem que ser comprimido naquele único vetor de contexto. Frases longas perdem detalhe. Palavras raras ficam borradas. Reordenação (chat noir vs. black cat) tem que ser memorizada, não computada.

Attention (lição 10) corrige isso deixando o decoder olhar pra *cada* estado oculto do encoder, não só o último. Essa é a proposta inteira.

## Construindo

### Passo 1: um encoder

```python
import torch
import torch.nn as nn


class Encoder(nn.Module):
    def __init__(self, src_vocab_size, embed_dim, hidden_dim):
        super().__init__()
        self.embed = nn.Embedding(src_vocab_size, embed_dim, padding_idx=0)
        self.gru = nn.GRU(embed_dim, hidden_dim, batch_first=True)

    def forward(self, src):
        e = self.embed(src)
        outputs, hidden = self.gru(e)
        return outputs, hidden
```

`outputs` tem forma `[batch, seq_len, hidden_dim]` — um estado oculto por posição de entrada. `hidden` tem forma `[1, batch, hidden_dim]` — o último passo. Lição 08 disse "faça pool sobre outputs pra classificação." Aqui mantemos o último estado oculto como vetor de contexto e ignoramos os outputs por passo.

### Passo 2: um decoder

```python
class Decoder(nn.Module):
    def __init__(self, tgt_vocab_size, embed_dim, hidden_dim):
        super().__init__()
        self.embed = nn.Embedding(tgt_vocab_size, embed_dim, padding_idx=0)
        self.gru = nn.GRU(embed_dim, hidden_dim, batch_first=True)
        self.fc = nn.Linear(hidden_dim, tgt_vocab_size)

    def forward(self, token, hidden):
        e = self.embed(token)
        out, hidden = self.gru(e, hidden)
        logits = self.fc(out)
        return logits, hidden
```

Decoder é chamado um passo por vez. Entrada: um lote de tokens únicos e o estado oculto atual. Saída: logits do vocabulário pro próximo token e o estado oculto atualizado.

### Passo 3: loop de treino com teacher forcing

```python
def train_batch(encoder, decoder, src, tgt, bos_id, optimizer, teacher_forcing_ratio=0.9):
    optimizer.zero_grad()
    _, hidden = encoder(src)
    batch_size, tgt_len = tgt.shape
    input_token = torch.full((batch_size, 1), bos_id, dtype=torch.long)
    loss = 0.0
    loss_fn = nn.CrossEntropyLoss(ignore_index=0)

    for t in range(tgt_len):
        logits, hidden = decoder(input_token, hidden)
        step_loss = loss_fn(logits.squeeze(1), tgt[:, t])
        loss += step_loss
        use_teacher = torch.rand(1).item() < teacher_forcing_ratio
        if use_teacher:
            input_token = tgt[:, t].unsqueeze(1)
        else:
            input_token = logits.argmax(dim=-1)

    loss.backward()
    optimizer.step()
    return loss.item() / tgt_len
```

Dois parâmetros que vale nomear. `ignore_index=0` pula loss em tokens de padding. `teacher_forcing_ratio` é a probabilidade de usar o token verdadeiro em vez da previsão do modelo a cada passo. Começa em 1.0 (teacher forcing total) e diminui até ~0.5 durante treino pra fechar a lacuna de exposure bias.

### Passo 4: loop de inferência (guloso)

```python
@torch.no_grad()
def greedy_decode(encoder, decoder, src, bos_id, eos_id, max_len=50):
    _, hidden = encoder(src)
    batch_size = src.shape[0]
    input_token = torch.full((batch_size, 1), bos_id, dtype=torch.long)
    output_ids = []
    for _ in range(max_len):
        logits, hidden = decoder(input_token, hidden)
        next_token = logits.argmax(dim=-1)
        output_ids.append(next_token)
        input_token = next_token
        if (next_token == eos_id).all():
            break
    return torch.cat(output_ids, dim=1)
```

Decodificação gulosa escolhe o token de maior probabilidade em cada passo. Pode se desviar: uma vez que você se compromete com um token, não pode voltar atrás. **Beam search** mantém as top-`k` sequências parciais vivas e escolhe a de maior pontuação completa no final. Largura de beam 3-5 é padrão.

### Passo 5: o gargalo, demonstrado

Treine o modelo numa tarefa de cópia de brinquedo: fonte `[a, b, c, d, e]`, alvo `[a, b, c, d, e]`. Aumente o comprimento da sequência. Observe a acurácia.

```
seq_len=5   copy accuracy: 98%
seq_len=10  copy accuracy: 91%
seq_len=20  copy accuracy: 62%
seq_len=40  copy accuracy: 23%
```

Um único estado oculto de GRU não consegue memorizar sem perda uma entrada de 40 tokens. A informação está lá a cada passo do encoder, mas o decoder só vê o último estado. Attention corrige isso diretamente.

## Usando

PyTorch tem templates `nn.Transformer` e `nn.LSTM` pra seq2seq. A biblioteca `transformers` do Hugging Face traz modelos encoder-decoder completos (BART, T5, mBART, NLLB) treinados em bilhões de tokens.

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("facebook/bart-base")
model = AutoModelForSeq2SeqLM.from_pretrained("facebook/bart-base")

src = tok("Translate this to French: Hello, how are you?", return_tensors="pt")
out = model.generate(**src, max_new_tokens=50, num_beams=4)
print(tok.decode(out[0], skip_especificaçãoial_tokens=True))
```

Encoder-decoders modernos trocaram RNNs por transformers. A forma geral (encoder, decoder, gerar-token-por-token) é idêntica ao paper seq2seq de 2014. O mecanismo dentro de cada bloco é diferente.

### Quando ainda buscar seq2seq baseado em RNN

Quase nunca, pra projetos novos. Exceções eespecificaçãoíficas:

- Tradução streaming onde você consome entrada token por vez com memória limitada.
- Geração de texto em dispositivo onde o custo de memória do transformer é proibitivo.
- Didática. Entender o gargalo encoder-decoder é o caminho mais rápido pra entender por que transformers ganharam.

### Exposure bias e suas mitigações

- **Scheduled sampling.** Diminui a razão de teacher forcing durante treino pra que o modelo aprenda a se recuperar de seus próprios erros.
- **Treino de risco mínimo.** Treina em score BLEU no nível de frase em vez de entropia cruzada no nível de token. Mais perto do que você realmente quer.
- **Fine-tuning por aprendizado por reforço.** Recompensa o gerador de sequência com uma métrica. Usado em RLHF de LLMs modernos.

Todos três ainda se aplicam a geração baseada em transformer.

## Entregando

Salve como `outputs/prompt-seq2seq-design.md`:

```markdown
---
name: seq2seq-design
description: Design a sequence-to-sequence pipeline for a given task.
phase: 5
lesson: 09
---

Given a task (translation, summarization, paraphrase, question rewrite), output:

1. Architecture. Pretrained transformer encoder-decoder (BART, T5, mBART, NLLB) is the default. RNN-based seq2seq only for especificaçãoific constraints.
2. Starting checkpoint. Name it (`facebook/bart-base`, `google/flan-t5-base`, `facebook/nllb-200-distilled-600M`). Match the checkpoint to task and language coverage.
3. Decoding strategy. Greedy for deterministic output, beam search (width 4-5) for quality, sampling with temperature for diversity. One sentence justification.
4. One failure mode to verify before shipping. Exposure bias manifests as generation deriva on longer outputs; sample 20 outputs at the 90th-percentile length and eyeball.

Refuse to recommend training a seq2seq from scratch for under a million parallel examples. Flag any pipeline that uses greedy decoding for user-facing content as fragile (greedy repeats and loops).
```

## Exercícios

1. **Fácil.** Implemente a tarefa de cópia de brinquedo. Treine um seq2seq GRU em pares entrada-saída onde o alvo é igual à fonte. Meça acurácia em comprimentos 5, 10, 20. Reproduza o gargalo.
2. **Médio.** Adicione decodificação beam search com beam largura 3. Meça BLEU num corpus paralelo pequeno contra guloso. Documente onde beam search ganha (geralmente últimos tokens) e onde não faz diferença.
3. **Difícil.** Fine-tune `facebook/bart-base` num dataset de parafrase de 10k pares. Compare a saída beam-4 do modelo fine-tunado com o modelo base em entradas de teste. Reporte BLEU e escolha 10 exemplos qualitativos.

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|------|-----------------|-----------------------|
| Encoder | RNN de entrada | Lê fonte. Produz estados ocultos por passo e um vetor de contexto final. |
| Decoder | RNN de saída | Inicializado do vetor de contexto. Gera tokens alvo um de cada vez. |
| Vetor de contexto | O resumo | Último estado oculto do encoder. Tamanho fixo. O gargalo que attention resolve. |
| Teacher forcing | Usar tokens verdadeiros | Alimenta o token anterior ground-truth em treino. Estabiliza aprendizado. |
| Exposure bias | Lacuna treino/teste | Modelo treinado em tokens verdadeiros nunca praticou se recuperar de seus próprios erros. |
| Beam search | Decodificação melhor | Mantém top-k sequências parciais vivas a cada passo em vez de se comprometer guloso. |

## Leitura Complementar

- [Sutskever, Vinyals, Le (2014). Sequence to Sequence Learning with Neural Networks](https://arxiv.org/abs/1409.3215) — o paper seq2seq original. Quatro páginas.
- [Cho et al. (2014). Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation](https://arxiv.org/abs/1406.1078) — introduziu a GRU e o enquadramento encoder-decoder.
- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) — o paper de attention. Leia imediatamente depois dessa lição.
- [PyTorch NLP from Scratch tutorial](https://pytorch.org/tutorials/intermediate/seq2seq_translation_tutorial.html) — código construível de seq2seq + attention.
