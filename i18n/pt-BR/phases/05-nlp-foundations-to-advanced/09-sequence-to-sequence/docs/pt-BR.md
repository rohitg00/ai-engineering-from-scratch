# Modelos de sequência em sequência

> Dois RNNs fingindo ser tradutores, o gargalo de engarrafamento que atingiram é a razão pela qual existe atenção.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 08 (CNNs + RNNs for Text), Phase 3 · 11 (PyTorch Intro)
**Time:** ~75 minutes

## O problema

A classificação mapeia uma sequência de comprimento variável para um único rótulo. A tradução mapeia uma sequência de comprimento variável para outra sequência de comprimento variável. A entrada e saída vivem em diferentes vocabulários, possivelmente em idiomas diferentes, sem garantia de paridade de comprimento.

A arquitetura seq2seq (Sutskever, Vinyals, Le, 2014) rompeu isso com uma receita deliberadamente simples. Dois RNNs. Um lê a frase fonte e produz um vetor de contexto de tamanho fixo. O outro lê esse vetor e gera o token da frase alvo por token. O mesmo código que você escreveu para a lição 08, colados de forma diferente.

Este é um problema que vale a pena estudar por duas razões: primeiro, o gargalhão de engarrafamento do contexto-vector é o fracasso mais pedagógico útil na PNL. Ele motiva tudo o que a atenção e os transformadores são bons em.

## O conceito

**Encoder.**Um RNN que lê a frase fonte.**context vector** um resumo de tamanho fixo de toda a entrada.

**Decoder.**Outro RNN iniciado a partir do vetor de contexto. Em cada etapa, ele toma o token gerado anteriormente como entrada e produz uma distribuição sobre o vocabulário alvo.`<EOS>`O token é produzido ou o máximo de comprimento é atingido.

**Training:**Perda de entropia cruzada em cada passo do decodificador, somada sobre a sequência.

**Teacher forcing.**Durante o treino, a entrada do decodificador em passo `t`é o símbolo de verdade no ponto de partida`t-1`O modelo não é um sistema de cálculo, mas um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, que é um sistema de cálculo, e que é um sistema de cálculo, é um sistema de cálculo, e que é um sistema de cálculo, é um sistema de cálculo, é um sistema de cálculo, e um sistema de cálculo, é um sistema de cálculo, que é um sistema de cálculo, e um sistema de cálculo, e um sistema de cálculo, é um sistema de cálculo, é um sistema de cálculo, que é um sistema de cálculo, e um sistema de cálculo, e um sistema de cálculo, por exemplo, é um sistema de cálculo, é um sistema de cálculo, é um sistema de cálculo, é um sistema de cálculo, é um sistema de cálculo, e um sistema de cálculo, e um sistema de cálculo, é um sistema de cálculo, e um sistema de cálculo, de cálculo, de cálculo, e um sistema de cálculo, de cálculo, e é um sistema de cálculo, de cálculo, e é um sistema de cálculo, de cálculo, e é um sistema de cálculo, por exemplo, é, é um sistema de cálculo, é um sistema de cálculo, é um sistema de cálculo, é um sistema de cálculo, e é, é um**exposure bias**- Não .

**The bottleneck.**Tudo o que o codificador aprendeu sobre a fonte deve ser comprimido para esse vetor de contexto. Frases longas perdem detalhes. Palavras raras ficam borbulhadas. Reordem (chat noir vs. gato preto) deve ser memorizado, não calculado.

Atenção (leção 10) corrige isso deixando o decodificador olhar para * cada * estado oculto do codificador, não apenas o último.

```figure
lstm-gates
```

## Construí-lo

### Passo 1: um codificador

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

`outputs`tem forma`[batch, seq_len, hidden_dim]` um estado oculto por posição de entrada. `hidden`tem forma`[1, batch, hidden_dim]`A lição 08 diz "pool over outputs for classification". Aqui mantemos o último estado oculto como o vector de contexto, e ignoramos as saídas por passo.

### Passo 2: um decodificador

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

O decodificador é chamado um passo a tempo. Entrada: um lote de tokens individuais e o estado oculto atual. saída: logs de vocabulário para o próximo token e o estado oculto atualizado.

### Passo 3: ciclo de formação com o professor forçando

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

Duas botões que valham a pena nomear.`ignore_index=0`Salta perdas em tokens de enchimento. `teacher_forcing_ratio`é a probabilidade de usar o token verdadeiro versus a previsão do modelo em cada etapa. Comece em 1.0 (forçando o professor completo) e aneal para baixo para ~0.5 sobre o treinamento para fechar a lacuna de viés de exposição.

### Passo 4: Localização de inferências (avidas)

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

A codificação gananciosa escolhe o token de maior probabilidade em cada passo. Pode desviar-se: uma vez que você se compromete com um token, não pode desvincular-se. **Beam search**Mantém o topo...`k`Sequências parciais vivas e escolhe o mais alto escore completo no final.

### Passo 5: o gargalo de engarrafamento, demonstrado

Treinar o modelo em uma tarefa de cópia de brinquedo: fonte `[a, b, c, d, e]`, alvo`[a, b, c, d, e]`Aumentar o comprimento da sequência, observar a precisão.

```
seq_len=5   copy accuracy: 98%
seq_len=10  copy accuracy: 91%
seq_len=20  copy accuracy: 62%
seq_len=40  copy accuracy: 23%
```

Um único estado oculto GRU não pode memorizar sem perdas uma entrada de 40 tokens. A informação está lá em cada passo do codificador, mas o decodificador só vê o último estado.

## Usá-lo

PyTorch tem `nn.Transformer`E ...`nn.LSTM`- baseado em modelos de sequência.`transformers`Na biblioteca, os navios completos de modelos de codificadores-decodificadores (BART, T5, mBART, NLLB) são treinados em bilhões de tokens.

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("facebook/bart-base")
model = AutoModelForSeq2SeqLM.from_pretrained("facebook/bart-base")

src = tok("Translate this to French: Hello, how are you?", return_tensors="pt")
out = model.generate(**src, max_new_tokens=50, num_beams=4)
print(tok.decode(out[0], skip_special_tokens=True))
```

Os encodadores-decodadores modernos deixaram cair RNNs para transformadores. A forma de alto nível (encodador, decodador, gerar-token-by-token) é idêntica ao papel seq2seq de 2014. O mecanismo dentro de cada bloco é diferente.

### Quando ainda se pode procurar o seq2seq baseado em RNN

Quase nunca, para novos projectos.

- Tradução de streaming onde você consome entrada um token por vez com memória limitada.
- Geração de texto no dispositivo onde o custo da memória do transformador é proibitivo.
- Entender o gargalho de encodeador-decodeador é o caminho mais rápido para entender por que os transformadores ganharam.

### Preconceito de exposição e suas mitigações

- **Scheduled sampling.**Relação de força do professor durante o treinamento para que o modelo aprenda a recuperar dos seus próprios erros.
- **Minimum risk training.**Treinar em pontuação de nível de sentença BLEU em vez de nível de token entropia cruzada.
- **Reinforcement learning fine-tuning.**Recompense o gerador de sequências com uma métrica usada no moderno LLM RLHF.

Os três ainda se aplicam à geração baseada em transformadores.

## Envia-o

Salva como`outputs/prompt-seq2seq-design.md`- Não .

```markdown
---
name: seq2seq-design
description: Design a sequence-to-sequence pipeline for a given task.
phase: 5
lesson: 09
---

Given a task (translation, summarization, paraphrase, question rewrite), output:

1. Architecture. Pretrained transformer encoder-decoder (BART, T5, mBART, NLLB) is the default. RNN-based seq2seq only for specific constraints.
2. Starting checkpoint. Name it (`facebook/bart-base`, `google/flan-t5-base`, `facebook/nllb-200-distilled-600M`). Match the checkpoint to task and language coverage.
3. Decoding strategy. Greedy for deterministic output, beam search (width 4-5) for quality, sampling with temperature for diversity. One sentence justification.
4. One failure mode to verify before shipping. Exposure bias manifests as generation drift on longer outputs; sample 20 outputs at the 90th-percentile length and eyeball.

Refuse to recommend training a seq2seq from scratch for under a million parallel examples. Flag any pipeline that uses greedy decoding for user-facing content as fragile (greedy repeats and loops).
```

## Exercícios

1. **Easy.**Implementar a tarefa de cópia de brinquedo. Treinar um GRU seq2seq em pares de entrada e saída onde o alvo é igual à fonte. Medir a precisão em comprimentos 5, 10, 20. Reproduzir o gargalo de engarrafamento.
2. **Medium.**Adicionar a decodificação de busca de feixe com largura de feixe 3. Medir o azul em um pequeno corpus paralelo contra a ganância.
3. **Hard.**- A música é perfeita .`facebook/bart-base`Comparar a saída de feixe 4 do modelo de base com a do modelo base em entradas mantidas.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Encoder | Input RNN | Reads source. Produces per-step hidden states and a final context vector. |
| Decoder | Output RNN | Initialized from context vector. Generates target tokens one at a time. |
| Context vector | The summary | Final encoder hidden state. Fixed size. The bottleneck attention solves. |
| Teacher forcing | Use true tokens | Feed the ground-truth previous token at training time. Stabilizes learning. |
| Exposure bias | Train/test gap | Model trained on true tokens never practiced recovering from its own mistakes. |
| Beam search | Better decoding | Keep top-k partial sequences alive at each step instead of committing greedily. |

## Mais leitura

- [Sutskever, Vinyals, Le (2014). Sequence to Sequence Learning with Neural Networks](https://arxiv.org/abs/1409.3215)O papel original de sequência.
- [Cho et al. (2014). Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation](https://arxiv.org/abs/1406.1078) introduziu o GRU e o enquadramento de codificadores-decodificadores.
- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473)- O papel de atenção.
- [PyTorch NLP from Scratch tutorial](https://pytorch.org/tutorials/intermediate/seq2seq_translation_tutorial.html) Seq2seq + código de atenção.
