# Transformers de Áudio — Arquitetura Whisper

> Áudio é uma imagem de frequência sobre tempo. Whisper é um ViT que come eespecificaçãotrogramas mel e fala de volta.

**Tipo:** Aprender
**Linguagens:** Python
**Pré-requisitos:** Fase 7 · 05 (Transformer Completo), Fase 7 · 08 (Encoder-Decoder), Fase 7 · 09 (ViT)
**Tempo:** ~45 minutos

## O Problema

Antes do Whisper (OpenAI, Radford et al. 2022), reconhecimento automático de fala (ASR) state-of-the-art significava wav2vec 2.0 e HuBERT — extratores de características auto-supervisionados com uma head de fine-tuning. Alta qualidade, pipelines de dados caros, frágil por domínio. ASR multilíngue precisava de modelos separados por família de idiomas.

Whisper apostou em três pontos:

1. **Treinar em tudo.** 680.000 horas de áudio rotulado fraco coletado da internet em 97 idiomas. Sem corpus acadêmico limpo. Sem rótulos de fonema.
2. **Modelo único multitarefa.** Um decoder treinado conjuntamente em transcrição, tradução, detecção de atividade de voz, identificação de idioma e marcação de tempo via task tokens.
3. **Transformer encoder-decoder padrão.** Encoder consome eespecificaçãotrogramas log-mel. Decoder gera tokens de texto autoregressivamente. Sem vocoder, sem CTC, sem HMM.

O resultado: Whisper large-v3 é robusto em sotaques, ruído e idiomas que têm zero dados rotulados limpos. É o frontend de fala padrão pra todo assistente de voz open source e a maioria dos comerciais em 2026.

## O Conceito

![Pipeline Whisper: áudio → mel → encoder → decoder → texto](../assets/whisper.svg)

### Passo 1 — reamostrar + janelar

Áudio a 16 kHz. Recorte/preencha pra 30 segundos. Calcule eespecificaçãotrograma log-mel: 80 bandas mel, stride de 10 ms → ~3.000 frames × 80 features. Essa é a "imagem de entrada" que o Whisper vê.

### Passo 2 — stem convolucional

Duas camadas Conv1D com kernel 3 e stride 2 reduzem os 3.000 frames pra 1.500. Metade do comprimento de sequência sem adicionar muitos parâmetros.

### Passo 3 — encoder

Encoder transformer de 24 camadas (para large) sobre 1.500 timesteps. Codificação posicional sinusoidal, self-attention, FFN GELU. Produz 1.500 × 1.280 estados ocultos.

### Passo 4 — decoder

Decoder transformer de 24 camadas. Gera tokens autoregressivamente de um vocabulário BPE que é superconjunto do GPT-2 com alguns tokens eespecificaçãoiais de áudio.

### Passo 5 — task tokens

O prompt do decoder começa com tokens de controle que dizem ao modelo o que fazer:

```
<|startoftranscript|>  <|en|>  <|transcribe|>  <|0.00|>
```

ou

```
<|startoftranscript|>  <|fr|>  <|translate|>   <|0.00|>
```

O modelo foi treinado nessa convenção. Você controla a tarefa pelo prefixo. O equivalente de 2026 a sintonização por instrução, mas aplicado a fala.

### Passo 6 — saída

Beam search (largura 5) com limiar de log-probabilidade. Marcações de tempo são previstas a cada 0,02 segundos de áudio quando o token `<|notimestamps|>` está ausente.

### Tamanhos do Whisper

| Modelo | Params | Camadas | d_model | Heads | VRAM (fp16) |
|--------|--------|---------|---------|-------|-------------|
| Tiny | 39M | 4 | 384 | 6 | ~1 GB |
| Base | 74M | 6 | 512 | 8 | ~1 GB |
| Small | 244M | 12 | 768 | 12 | ~2 GB |
| Medium | 769M | 24 | 1024 | 16 | ~5 GB |
| Large | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3 | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3-turbo | 809M | 32 | 1280 | 20 | ~6 GB (decoder de 4 camadas) |

Large-v3-turbo (2024) reduziu o decoder de 32 pra 4 camadas. Decodificação 8× mais rápida com regressão de <1 ponto WER. Essa destravamento de velocidade é por que Whisper-turbo é o padrão pra agentes de voz em tempo real em 2026.

### O que o Whisper NÃO faz

- Sem diarização (quem está falando). Combine com pyannote pra isso.
- Sem streaming nativo — a janela de 30 segundos é fixa. Wrappers modernos (`faster-whisper`, `WhisperX`) adicionam streaming via VAD + sobreposição.
- Sem contexto de longo prazo além de 30s sem chunking externo. Funciona bem na prática porque fala humana raramente precisa de contexto de longo alcance pra transcrição.

### Paisagem de 2026

| Tarefa | Modelo | Notas |
|--------|--------|-------|
| ASR em inglês | Whisper-turbo, Moonshine | Moonshine é 4× mais rápido em borda |
| ASR multilíngue | Whisper-large-v3 | 97 idiomas |
| ASR streaming | faster-whisper + VAD | Latência de 150 ms alcançável |
| TTS | Piper, XTTS-v2, Kokoro | Padrão encoder-decoder, mas formato Whisper |
| Áudio + linguagem | AudioLM, SeamlessM4T | Tokens de texto + tokens de áudio num transformer |

## Construindo

Veja `code/main.py`. Não treinamos Whisper — construímos o pipeline de eespecificaçãotrograma log-mel + formatador de prompt de task tokens. Essas são as partes que você realmente toca em produção.

### Passo 1: sintetizar áudio

Gere uma onda sinusoidal de 1 segundo a 440 Hz amostrada a 16 kHz. 16.000 amostras.

### Passo 2: eespecificaçãotrograma log-mel (simplificado)

Eespecificaçãotrograma mel completo precisa FFT. Fazemos uma versão simplificada com enquadramento + energia por frame que mostra o pipeline sem precisar de `librosa`:

```python
def frame_signal(x, frame_size=400, hop=160):
    frames = []
    for start in range(0, len(x) - frame_size + 1, hop):
        frames.append(x[start:start + frame_size])
    return frames
```

Frame = 25 ms, hop = 10 ms. Combina com o janelamento do Whisper. Energia por frame substitui bandas mel pra didática.

### Passo 3: preencher pra 30s

Whisper sempre processa blocos de 30 segundos. Preencha (ou recorte) o eespecificaçãotrograma pra 3.000 frames.

### Passo 4: construir os tokens de prompt

```python
def whisper_prompt(lang="en", task="transcribe", timestamps=True):
    tokens = ["<|startoftranscript|>", f"<|{lang}|>", f"<|{task}|>"]
    if not timestamps:
        tokens.append("<|notimestamps|>")
    return tokens
```

Essa é a superfície inteira de controle de tarefa. Um prefixo de 4 tokens.

## Usando

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("meeting.wav", language="en", task="transcribe")
print(result["text"])
print(result["segments"][0]["start"], result["segments"][0]["end"])
```

Mais rápido, compatível com OpenAI:

```python
from faster_whisper import WhisperModel
model = WhisperModel("large-v3-turbo", compute_type="int8_float16")
segments, info = model.transcribe("meeting.wav", vad_filter=True)
for s in segments:
    print(f"{s.start:.2f} - {s.end:.2f}: {s.text}")
```

**Quando escolher Whisper em 2026:**

- ASR multilíngue com um modelo.
- Transcrição robusta de áudio ruidoso e diverso.
- ASR pra pesquisa/protótipo — ponto de partida mais rápido.

**Quando escolher outra coisa:**

- Streaming de baixa latência ultra em borda — Moonshine vence Whisper em qualidade equivalente.
- IA conversacional em tempo real precisando <200 ms — ASR streaming dedicado.
- Diarização de falante — Whisper não faz isso; acople pyannote.

## Entregando

Veja `outputs/skill-asr-configurator.md`. A skill escolhe um modelo ASR, parâmetros de decodificação e pipeline de pré-processamento pra uma nova aplicação de fala.

## Exercícios

1. **Fácil.** Rode `code/main.py`. Confirme que contagem de frames pra um sinal de 1 segundo a 16 kHz com hop de 10 ms é ~100 frames. Pra 30 segundos: ~3.000 frames.
2. **Médio.** Construa o eespecificaçãotrograma log-mel completo usando `numpy.fft`. Verifique que 80 bandas mel combinam com `librosa.feature.melespecificaçãotrogram(n_mels=80)` dentro de erro numérico.
3. **Difícil.** Implemente inferência streaming: fatie o áudio em janelas de 10s com sobreposição de 2s, rode Whisper em cada bloco, merge transcrições. Meça taxa de erro por palavra vs passagem única num sample de podcast de 5 minutos.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|--------------------------|
| Eespecificaçãotrograma mel | "Imagem de áudio" | Representação 2D: bandas de frequência num eixo, frames de tempo no outro; energia logarítmica por célula. |
| Log-mel | "O que o Whisper vê" | Eespecificaçãotrograma mel passado por log; aproxima percepção humana de volume. |
| Frame | "Uma fatia de tempo" | Janela de 25 ms de amostras; sobrepostas com stride de 10 ms. |
| Task token | "Prefixo de prompt pra fala" | Tokens eespecificaçãoiais como `<\|transcribe\|>` / `<\|translate\|>` no prompt do decoder. |
| VAD (Voice Activity Detection) | "Encontrar a fala" | Portão que remove silêncio antes do ASR; reduz custo massivamente. |
| CTC | "Connectionist Temporal Classification" | Perda clássica de ASR pra treinamento sem alinhamento; Whisper NÃO usa. |
| Whisper-turbo | "Decoder pequeno, encoder completo" | Encoder large-v3 + decoder de 4 camadas; decodificação 8× mais rápida. |
| Faster-whisper | "O wrapper de produção" | Reimplementação CTranslate2; quantização int8; 4× mais rápido que referência da OpenAI. |

## Leituras Complementares

- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) — paper Whisper.
- [Repositório Whisper da OpenAI](https://github.com/openai/whisper) — código de referência + pesos. Leia `whisper/model.py` pra ver o stem Conv1D + encoder + decoder de ponta a ponta em ~400 linhas.
- [OpenAI Whisper — `whisper/decoding.py`](https://github.com/openai/whisper/blob/main/whisper/decoding.py) — a lógica de beam search + task token descrita nos Passos 5–6 está aqui; 500 linhas, totalmente legível.
- [Baevski et al. (2020). wav2vec 2.0: A Framework for Self-Supervised Learning of Speech Representations](https://arxiv.org/abs/2006.11477) — precursor; ainda features SOTA em alguns contextos.
- [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) — wrapper de produção, 4× mais rápido que referência.
- [Jia et al. (2024). Moonshine: Speech Recognition for Live Transcription and Voice Commands](https://arxiv.org/abs/2410.15608) — ASR amigável a borda de 2024, formato Whisper mas menor.
- [Blog HuggingFace — "Fine-Tune Whisper For Multilingual ASR with 🤗 Transformers"](https://huggingface.co/blog/fine-tune-whisper) — receita canônica de fine-tuning incluindo pré-processador de eespecificaçãotrograma mel e tratamento de token-timestamp.
- [HuggingFace `modeling_whisper.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/whisper/modeling_whisper.py) — implementação completa (encoder, decoder, cross-attention, geração) que espelha o diagrama da arquitetura da aula.
