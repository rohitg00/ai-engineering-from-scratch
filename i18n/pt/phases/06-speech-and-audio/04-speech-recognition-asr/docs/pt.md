# Reconhecimento do discurso (ASR)  CTC, RNN-T, atenção

> O reconhecimento da fala é classificação de áudio em cada passo do tempo, colada por um modelo de sequência que conhece o inglês e o silêncio. CTC, RNN-T e atenção são as três maneiras de fazer isso. Escolha uma e entenda por quê.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 08 (CNNs & RNNs for Text), Phase 5 · 10 (Attention)
**Time:** ~45 minutes

## O problema

Você tem um clip de 10 segundos de 16 kHz. Você quer uma corda: "acende as luzes da cozinha". O desafio é estrutural: os quadros de áudio não se alinham um a um com os caracteres. A palavra "okay" pode levar 200 ms ou 1200 ms. O silêncio pontua a pronunciação. Alguns fonemas são mais longos do que outros. O número de tokens de saída não é conhecido com antecedência.

Três formulações resolvem isto:

1. **CTC (Connectionist Temporal Classification).**Emite probabilidades de token por quadro, incluindo um *blank* especial. Repetências de colapso e espaços em tempo de decodificação. Não autoregressivo, rápido. usado por wav2vec 2.0, MMS.
2. **RNN-T (Recurrent Neural Network Transducer).**A rede conjunta prevê o próximo token dado quadro de codificação e tokens anteriores. Streamable. usado pelo ASR do Google no dispositivo, NVIDIA Parakeet.
3. **Attention encoder-decoder.**O encoder comprime áudio para estados ocultos, o decodificador atende cruzando para gerar tokens autoregressivamente.

Em 2026, a SOTA WER no LibriSpeech test-clean é de 1,4% (Parakeet-TDT-1.1B, NVIDIA) e 1,58% (Whisper-Large-v3-turbo). As diferenças são pequenas; as diferenças de implantação são enormes.

## O conceito

![Three ASR formulations: CTC, RNN-T, attention-encoder-decoder](../assets/asr-formulations.svg)

**CTC intuition.**Deixe o codificador sair `T`distribuições de nível de quadro sobre `V+1`Tokens (caráter V + em branco). Para uma cadeia-alvo `y`de comprimento `U < T`, qualquer alinhamento de quadro que colapse para `y`As diferenças entre os valores de um sistema de correção de dados e os valores de um sistema de correção de dados são:

Vantagens: não autoregressivo, streamable, zero lookahead. Desvantagem: *assunção de independência condicional*  cada previsão de quadro é independente dos outros, por isso não há um modelo de linguagem interna.

**RNN-T intuition.**Adiciona uma rede de * predictor * que incorpora o histórico do token e um * joiner * que combina o estado do predictor com o quadro de codificador em uma distribuição conjunta sobre `V+1`(o `+1`é um zero / não emitente). Modela explicitamente a dependência condicional CTC ignorado. Streamable porque cada passo condições apenas em quadros passados e tokens passados.

Vantagens: streaming + LM interno. Desvantagem: o treinamento é mais complexo e com fome de memória (3D reticula de perda); os núcleos de perda RNN-T são uma categoria inteira de biblioteca por si só.

**Attention encoder-decoder.**Encoder (6-32 camadas de transformador) sobre quadros log-mail. Decoder (6-32 camadas de transformador) atende cruzada para encoder saídas para gerar tokens autoregressivamente. Nenhuma restrição de alinhamento  atenção pode olhar em qualquer lugar no áudio. Não pode ser transmitido a menos que você restrinja a atenção (Whisper-Streaming, 2024).

Vantagens: alta qualidade em ASR offline, fácil de treinar com ferramentas seq2seq padrão.

### WER: o número único

**Word Error Rate**- Não .$(S + D + I) / N$, onde$S$=substituições, $D$= eliminações, $I$=inserções, $N$=conto de palavras de referência. Correspondem com a distância de edição Levenshtein no nível das palavras. Mais baixo é melhor. Um WER acima de 20% é geralmente inutilizável; abaixo de 5% é a paridade humana para a fala de leitura. Números 2026 em referências padrão:

| Model | LibriSpeech test-clean | LibriSpeech test-other | Size |
|-------|------------------------|------------------------|------|
| Parakeet-TDT-1.1B | 1.40% | 2.78% | 1.1B params |
| Whisper-Large-v3-turbo | 1.58% | 3.03% | 809M |
| Canary-1B Flash | 1.48% | 2.87% | 1B |
| Seamless M4T v2 | 1.7% | 3.5% | 2.3B |

Todos estes sistemas são baseados em codificadores-decodificadores ou RNN-T. Os sistemas de CTC puros (wav2vec 2.0) são de cerca de 1,82,1% em teste-limpo.

```figure
ctc-collapse
```

## Construí-lo

### Passo 1: codificação codificada de CTC

```python
def ctc_greedy(frame_logits, blank=0, vocab=None):
    # frame_logits: list of per-frame probability vectors
    preds = [max(range(len(p)), key=lambda i: p[i]) for p in frame_logits]
    out = []
    prev = -1
    for p in preds:
        if p != prev and p != blank:
            out.append(p)
        prev = p
    return "".join(vocab[i] for i in out) if vocab else out
```

Duas regras: colapso repetidas consecutivas, soltar espaços em branco.`a a _ _ a b b _ c`→ `a a b c`- Não .

### Passo 2: CTC de busca de feixe

```python
def ctc_beam(frame_logits, beam=8, blank=0):
    import math
    beams = [([], 0.0)]  # (tokens, log_prob)
    for p in frame_logits:
        log_p = [math.log(max(pi, 1e-10)) for pi in p]
        candidates = []
        for seq, lp in beams:
            for t, lpt in enumerate(log_p):
                new = seq[:] if t == blank else (seq + [t] if not seq or seq[-1] != t else seq)
                candidates.append((new, lp + lpt))
        candidates.sort(key=lambda x: -x[1])
        beams = candidates[:beam]
    return beams[0][0]
```

A produção usa a busca de feixe de árvore de prefixos com fusão LM; este é o esqueleto conceitual.

### Passo 3: WER

```python
def wer(ref, hyp):
    r, h = ref.split(), hyp.split()
    dp = [[0] * (len(h) + 1) for _ in range(len(r) + 1)]
    for i in range(len(r) + 1):
        dp[i][0] = i
    for j in range(len(h) + 1):
        dp[0][j] = j
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            cost = 0 if r[i - 1] == h[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            )
    return dp[len(r)][len(h)] / max(1, len(r))
```

### Passo 4: inferência contra o sussurro

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("clip.wav")
print(result["text"])
```

Um linheiro para o ASR geral mais forte em 2026.

### Passo 5: streaming com Parakeet ou wav2vec 2.0

```python
from transformers import pipeline
asr = pipeline("automatic-speech-recognition", model="nvidia/parakeet-tdt-1.1b")
for chunk in streaming_audio():
    print(asr(chunk, return_timestamps=True))
```

Streaming ASR requer atenção de codificador em pedaços e estado de carregamento; use uma biblioteca que o suporta (NeMo para Parakeet, `transformers`O gasoduto com `chunk_length_s`)).

## Usá-lo

A pilha de 2026:

| Situation | Pick |
|-----------|------|
| English, offline, max quality | Whisper-large-v3-turbo |
| Multilingual, robust | SeamlessM4T v2 |
| Streaming, low latency | Parakeet-TDT-1.1B or Riva |
| Edge, mobile, <500 ms latency | Whisper-Tiny quantized or Moonshine (2024) |
| Long-form | Whisper with VAD-based chunking (WhisperX) |
| Domain-specific (medical, legal) | Fine-tune wav2vec 2.0 + domain LM fusion |

## Encurralagens que ainda se lançam em 2026

- **No VAD.**Correr Whisper em silêncio produz alucinações ("Obrigado por assistir!").
- **Character vs word vs subword WER.**Relatório de WER de nível de palavra *após* normalização (minúscula, pontuação despojada).
- **Language ID drift.**O LID automático do Whisper encaminha erroneamente os clips barulhentos para o japonês ou galês; força `language="en"`Quando você sabe.
- **Long clips without chunking.**O Whisper tem uma janela de 30 segundos.`chunk_length_s=30, stride=5`Para qualquer coisa mais longa.

## Envia-o

Salva como`outputs/skill-asr-picker.md`Selecionar modelo, estratégia de decodificação, fragmentação e fusão LM para um determinado alvo de implantação.

## Exercícios

1. **Easy.**Corra .`code/main.py`- Descifrar com ganância uma saída CTC feita à mão e calcular o WER em relação a uma referência.
2. **Medium.**Implementar a busca de feixe de árvore de prefixo na etapa 2 corretamente (conta a regra de fusão em branco). Compare com a ganância em um conjunto de dados sintéticos de 10 exemplos.
3. **Hard.**Utilização`whisper-large-v3-turbo`- Não .[LibriSpeech test-clean](https://www.openslr.org/12)- Calcular o WER das primeiras 100 declarações.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| CTC | The blank-token loss | Marginal over all frame-to-token alignments; non-AR. |
| RNN-T | The streaming loss | CTC + next-token predictor; handles word-order. |
| Attention enc-dec | Whisper-style | Encoder + cross-attending decoder; best offline quality. |
| WER | The number you report | `(S+D+I)/N` at word level. |
| Blank | The emptiness | Special token in CTC signalling "no emission this frame". |
| LM fusion | External language model | Add weighted LM log-probs during beam search. |
| VAD | The silence gate | Voice activity detector; trims non-speech. |

## Mais leitura

- [Graves et al. (2006). Connectionist Temporal Classification](https://www.cs.toronto.edu/~graves/icml_2006.pdf) o papel do CTC.
- [Graves (2012). Sequence Transduction with RNNs](https://arxiv.org/abs/1211.3711)O papel RNN-T.
- [Radford et al. / OpenAI (2022). Whisper: Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) o papel canônico de 2022; extensão v3-turbo em 2024.
- [NVIDIA NeMo — Parakeet-TDT card](https://huggingface.co/nvidia/parakeet-tdt-1.1b) Líder do quadro de liderança de RAS abertos de 2026.
- [Hugging Face — Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) referência ao vivo em mais de 25 modelos.
