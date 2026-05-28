# Reconhecimento de Fala (ASR) — CTC, RNN-T, Attention

> Reconhecimento de fala é classificação de áudio em cada timestep, colado junto por um modelo de sequência que conhece inglês e silêncio. CTC, RNN-T e attention são as três formas de fazer isso. Escolha uma e entenda por quê.

**Tipo:** Construir
**Idiomas:** Python
**Pré-requisitos:** Fase 6 · 02 (Eespecificaçãotrogramas e Mel), Fase 5 · 08 (CNNs e RNNs para Texto), Fase 5 · 10 (Attention)
**Tempo:** ~45 minutos

## O Problema

Você tem um clipe de 10 segundos a 16 kHz. Quer uma string: "acenda as luzes da cozinha". O desafio é estrutural: frames de áudio não se alinham um-a-um com caracteres. A palavra "ok" pode levar 200 ms ou 1200 ms. Silêncio pontua a fala. Alguns fonemas são mais longos que outros. O número de tokens de saída não é conhecido antecipadamente.

Três formulações resolvem isso:

1. **CTC (Connectionist Temporal Classification).** Emitir probabilidades de token por frame incluindo um *blank* eespecificaçãoial. Colapsar repetições e blanks no momento do decode. Não autoregressivo, rápido. Usado por wav2vec 2.0, MMS.
2. **RNN-T (Recurrent Neural Network Transducer).** Rede conjunta que prevê o próximo token dado o frame do encoder e tokens anteriores. Transmissível. Usado pelo ASR on-device do Google, NVIDIA Parakeet.
3. **Attention encoder-decoder.** Encoder comprime áudio em estados ocultos, decoder cross-attends para gerar tokens autoregressivamente. Usado por Whisper, SeamlessM4T.

Em 2026, o WER SOTA no LibriSpeech test-clean é 1,4% (Parakeet-TDT-1.1B, NVIDIA) e 1,58% (Whisper-Large-v3-turbo). As diferenças são mínimas; as diferenças de implantação são enormes.

## O Conceito

![Três formulações ASR: CTC, RNN-T, attention encoder-decoder](../assets/asr-formulations.svg)

**Intuição do CTC.** Deixe o encoder produzir `T` distribuições por frame sobre `V+1` tokens (V caracteres + blank). Para uma string alvo `y` de comprimento `U < T`, qualquer alinhamento de frame que colapse para `y` conta. A perda CTC soma sobre todos esses alinhamentos. Inferência: argmax por frame, colapsar repetições, remover blanks.

Vantagens: não autoregressivo, transmissível, zero lookahead. Desvantagem: *hipótese de independência condicional* — cada previsão de frame é independente das outras, então não há modelo de linguagem interno. Corrija com LM externo via beam search ou shallow fusion.

**Intuição do RNN-T.** Adiciona uma rede *predictor* que embute o histórico de tokens e um *joiner* que combina o estado do predictor com o frame do encoder em uma distribuição conjunta sobre `V+1` (o `+1` é null / não-emite). Modela explicitamente a dependência condicional que o CTC ignorou. Transmissível porque cada passo condiciona apenas em frames passados e tokens passados.

Vantagens: transmissível + LM interno. Desvantagem: treino mais complexo e consumidor de memória (grade 3D de perda); kernels de perda RNN-T são uma categoria de biblioteca por si só.

**Attention encoder-decoder.** Encoder (6-32 camadas transformer) sobre frames log-mel. Decoder (6-32 camadas transformer) cross-attends aos outputs do encoder para gerar tokens autoregressivamente. Sem restrição de alinhamento — attention pode olhar em qualquer lugar do áudio. Não transmissível a menos que você restrinja attention (Whisper-Streaming chunked, 2024).

Vantagens: maior qualidade em ASR offline, fácil de treinar com ferramentas padrão seq2seq. Desvantagem: latência autoregressiva proporcional ao comprimento da saída; não transmite sem engenharia.

### WER: o número que importa

**Word Error Rate** = `(S + D + I) / N`, onde S=substituições, D=deleções, I=inserções, N=número de palavras da referência. Equivale à distância de edição Levenshtein no nível de palavra. Menor é melhor. WER acima de 20% é geralmente inutilizável; abaixo de 5% é paridade com humanos em fala lida. Números de 2026 em benchmarks padrão:

| Modelo | LibriSpeech test-clean | LibriSpeech test-other | Tamanho |
|--------|------------------------|------------------------|---------|
| Parakeet-TDT-1.1B | 1,40% | 2,78% | 1,1B params |
| Whisper-Large-v3-turbo | 1,58% | 3,03% | 809M |
| Canary-1B Flash | 1,48% | 2,87% | 1B |
| Seamless M4T v2 | 1,7% | 3,5% | 2,3B |

Todos baseados em encoder-decoder ou RNN-T. Sistemas puros CTC (wav2vec 2.0) ficam em torno de 1,8–2,1% no test-clean.

## Construa

### Passo 1: decode CTC greedy

```python
def ctc_greedy(frame_logits, blank=0, vocab=None):
    preds = [max(range(len(p)), key=lambda i: p[i]) for p in frame_logits]
    out = []
    prev = -1
    for p in preds:
        if p != prev and p != blank:
            out.append(p)
        prev = p
    return "".join(vocab[i] for i in out) if vocab else out
```

Duas regras: colapsar repetições consecutivas, descartar blanks. Exemplo: `a a _ _ a b b _ c` → `a a b c`.

### Passo 2: beam-search CTC

```python
def ctc_beam(frame_logits, beam=8, blank=0):
    import math
    beams = [([], 0.0)]
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

Produção usa prefix tree beam search com fusão de LM; esse é o esqueleto conceitual.

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

### Passo 4: inferência contra o Whisper

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("clip.wav")
print(result["text"])
```

Uma linha para o ASR geral mais forte de 2026. Roda em GPU de 24 GB a ~20× tempo real.

### Passo 5: streaming com Parakeet ou wav2vec 2.0

```python
from transformers import pipeline
asr = pipeline("automatic-speech-recognition", model="nvidia/parakeet-tdt-1.1b")
for chunk in streaming_audio():
    print(asr(chunk, return_timestamps=True))
```

ASR streaming precisa de attention chunked no encoder e estado de carryover; use uma biblioteca que suporte (NeMo para Parakeet, pipeline `transformers` com `chunk_length_s`).

## Use

A pilha de 2026:

| Situação | Escolha |
|----------|---------|
| Inglês, offline, qualidade máxima | Whisper-large-v3-turbo |
| Multilíngue, robusto | SeamlessM4T v2 |
| Streaming, baixa latência | Parakeet-TDT-1.1B ou Riva |
| Edge, mobile, latência <500 ms | Whisper-Tiny quantizado ou Moonshine (2024) |
| Formato longo | Whisper com chunking por VAD (WhisperX) |
| Domínio eespecificaçãoífico (médico, jurídico) | Ajuste fino wav2vec 2.0 + fusão de LM de domínio |

## Armadilhas que ainda aparecem em 2026

- **Sem VAD.** Rodar Whisper em silêncio produz alucinações ("Thanks for watching!"). Sempre use VAD como gate.
- **WER de caractere vs palavra vs subword.** Reporte WER no nível de palavra *depois* da normalização (minúsculas, pontuação removida).
- **Drift de ID de idioma.** A LID automática do Whisper manda clips ruidosos para japonês ou galês; force `language="en"` quando você sabe.
- **Clipes longos sem chunking.** Whisper tem janela de 30 segundos. Use `chunk_length_s=30, stride=5` para qualquer coisa mais longa.

## Entregue

Salve como `outputs/skill-asr-picker.md`. Escolha modelo, estratégia de decodificação, chunking e fusão de LM para um alvo de deploy.

## Exercícios

1. **Fácil.** Execute `code/main.py`. Faz decode greedy de uma saída CTC artesanal e computa WER contra uma referência.
2. **Médio.** Implemente o prefix-tree beam search do Passo 2 corretamente (considere a regra de merge do blank). Compare com greedy em um dataset sintético de 10 exemplos.
3. **Difícil.** Use `whisper-large-v3-turbo` no [LibriSpeech test-clean](https://www.openslr.org/12). Compute WER nas primeiras 100 utterances. Compare com números publicados.

## Termos Chave

| Termo | O que a gente diz | O que significa de verdade |
|-------|-------------------|---------------------------|
| CTC | A perda de blank-token | Marginalização sobre todos os alinhamentos frame-token; não-AR. |
| RNN-T | A perda streaming | CTC + predictor de próximo-token; lida com ordem de palavras. |
| Attention enc-dec | Estilo Whisper | Encoder + decoder cross-attend; melhor qualidade offline. |
| WER | O número que você reporta | `(S+D+I)/N` no nível de palavra. |
| Blank | O vazio | Token eespecificaçãoial no CTC sinalizando "sem emissão neste frame". |
| LM fusion | Modelo de linguagem externo | Adicionar log-probs ponderados do LM durante beam search. |
| VAD | O gate de silêncio | Detector de atividade vocal; corta não-fala. |

## Leitura Adicional

- [Graves et al. (2006). Connectionist Temporal Classification](https://www.cs.toronto.edu/~graves/icml_2006.pdf) — o paper CTC.
- [Graves (2012). Sequence Transduction with RNNs](https://arxiv.org/abs/1211.3711) — o paper RNN-T.
- [Radford et al. / OpenAI (2022). Whisper: Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) — o paper canônico de 2022; extensão v3-turbo em 2024.
- [NVIDIA NeMo — Parakeet-TDT card](https://huggingface.co/nvidia/parakeet-tdt-1.1b) — líder do Open ASR Leaderboard em 2026.
- [Hugging Face — Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) — benchmark ao vivo com 25+ modelos.
