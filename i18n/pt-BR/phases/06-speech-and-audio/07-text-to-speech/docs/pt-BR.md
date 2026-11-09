# Text-to-Speech (TTS)  De Tacotron para F5 e Kokoro

> A ASR inverte fala para texto; TTS inverte texto para fala. A pilha 2026 é de três partes: texto → tokens, tokens → mel, mel → forma de onda. Cada parte tem um modelo padrão que se encaixa em um laptop.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 09 (Seq2Seq), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## O problema

Você tem uma corda: "Por favor, lembre-me de regar as plantas às 18h". Você precisa de um vídeo de áudio de 3 segundos que soa natural, tem prosodia correta (pausas, estresse), pronuncia "plantes" com a vogais certas e corre em menos de 300 ms em uma CPU para um assistente de voz ao vivo. Você também precisa trocar vozes, lidar com entradas com código-switched ("lembrem-me às 18h, daijoubu?"), e não se envergonhar em nomes.

Os oleodutos modernos TTS parecem assim:

1. **Text frontend.**Normalize texto (datas, números, e-mails), converta em fonemas ou tokens de subpalavras, prevê recursos de prosodia.
2. **Acoustic model.**Texto → mel espectrograma. Tacotron 2 (2017), FastSpeech 2 (2020), VITS (2021), F5-TTS (2024), Kokoro (2024).
3. **Vocoder.**Mel → forma de onda. WaveNet (2016), WaveRNN, HiFi-GAN (2020), BigVGAN (2022), vocoders de codec neural em 2024+.

Em 2026, o vocalista acústico + vocal divide-se com modelos de difusão de ponta a ponta e de correspondência de fluxo.

## O conceito

![Tacotron, FastSpeech, VITS, F5/Kokoro side-by-side](../assets/tts.svg)

**Tacotron 2 (2017).**Seq2seq: car-embedding → BiLSTM encoder → atenção localização sensível → autoregressivo LSTM decoder emite molduras mel. Lento (AR), vacilante em texto longo. Ainda citado como uma linha de base.

**FastSpeech 2 (2020).**Não autoregressivo. Preditor de duração emitir quantas molduras mel cada fonema recebe. 1 pass, 10x mais rápido que Tacotron. Perde alguma naturalidade (alinhamento monótono) mas navega em todos os lugares.

**VITS (2021).**Juntamente treina codificador + duração baseada em fluxo + vocoder de extremo a extremo HiFi-GAN com inferência variável. Alta qualidade, modelo único. TTS de código aberto dominante 20222024. Variantes: YourTTS (multiplicador zero-shot), XTTS v2 (2024, Coqui).

**F5-TTS (2024).**Transformador de difusão sobre a correspondência de fluxo. Prósodia natural, clonagem de voz de tiro zero com 5 segundos de áudio de referência.

**Kokoro (2024).**Pequeno (82M), executável pela CPU, melhor TTS de inglês para uso em tempo real.

**OpenAI TTS-1-HD, ElevenLabs v2.5, Google Chirp-3.**ElevenLabs v2.5 emoção tags ("[suspirado]", "[risos]") e vozes de personagens dominam a produção de livros de áudio em 2026.

### Evolução do vocoder

| Era | Vocoder | Latency | Quality |
|-----|---------|---------|---------|
| 2016 | WaveNet | offline only | SOTA at release |
| 2018 | WaveRNN | ~realtime | good |
| 2020 | HiFi-GAN | 100× realtime | near-human |
| 2022 | BigVGAN | 50× realtime | generalizes across speakers/langs |
| 2024 | SNAC, DAC (neural codecs) | integrated with AR models | discrete tokens, bit-efficient |

Em 2026, a maioria dos modelos "TTS" são end-to-end de texto para forma de onda; o espectrograma mel é uma representação interna.

### Avaliação

- **MOS (Mean Opinion Score).**Escala de 1 a 5, de fontes públicas, ainda o padrão ouro, dolorosamente lento.
- **CMOS (Comparative MOS).**Preferência A versus B. Intervalos de confiança mais estreitos por anotação.
- **UTMOS, DNSMOS.**Predutores neurais de MOS sem referência, usados para rankings.
- **CER (Character Error Rate) via ASR.**Execute a saída TTS através do Whisper, computa o CER contra o texto de entrada.
- **SECS (Speaker Embedding Cosine Similarity).**Qualidade de clonagem de voz.

Números 2026 da limpeza de ensaio LibriTTS:

| Model | UTMOS | CER (via Whisper) | Size |
|-------|-------|-------------------|------|
| Ground truth | 4.08 | 1.2% | — |
| F5-TTS | 3.95 | 2.1% | 335M |
| XTTS v2 | 3.81 | 3.5% | 470M |
| VITS | 3.62 | 3.1% | 25M |
| Kokoro v0.19 | 3.87 | 1.8% | 82M |
| Parler-TTS Large | 3.76 | 2.8% | 2.3B |

```figure
sp-tts-stack
```

## Construí-lo

### Passo 1: fonemizar a entrada

```python
from phonemizer import phonemize
ph = phonemize("Hello world", language="en-us", backend="espeak")
# 'həloʊ wɜːld'
```

Os fonemas são a ponte universal. Evite alimentar texto bruto a qualquer coisa abaixo do nível de qualidade do VITS.

### Passo 2: executar Kokoro (2026 CPU padrão)

```python
from kokoro import KPipeline
tts = KPipeline(lang_code="a")  # "a" = American English
audio, sr = tts("Please remind me to water the plants at 6 pm.", voice="af_bella")
# audio: float32 tensor, sr=24000
```

Funciona offline, único arquivo, 82M params.

### Passo 3: executar F5-TTS com clonagem de voz

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="my_voice_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please remind me to water the plants.",
)
```

Passe um clipe de referência de 5 segundos + sua transcrição; F5 clona prosodia e timbre.

### Passo 4: Vocoder HiFi-GAN a partir do zero

Muito grande para caber num guião de tutorial, mas a forma é:

```python
class HiFiGAN(nn.Module):
    def __init__(self, mel_channels=80, upsample_rates=[8, 8, 2, 2]):
        super().__init__()
        # 4 upsample blocks, total 256x to go from mel-rate to audio-rate
        ...
    def forward(self, mel):
        return self.blocks(mel)  # -> waveform
```

Formação: adversária (discriminador em janelas curtas) + perda de reconstrução do espectrograma mel + perda de correspondência de características.`hifi-gan`repo ou nvidia-neMo.

### Passo 5: o conjunto completo do gasoduto (pseudo-código)

```python
text = "Please remind me at 6 pm."
phones = phonemize(text)
mel = acoustic_model(phones, speaker=alice)      # [T, 80]
wav = vocoder(mel)                                # [T * 256]
soundfile.write("out.wav", wav, 24000)
```

## Usá-lo

A pilha de 2026:

| Situation | Pick |
|-----------|------|
| Real-time English voice assistant | Kokoro (CPU) or XTTS v2 (GPU) |
| Voice cloning from 5 s reference | F5-TTS |
| Commercial character voices | ElevenLabs v2.5 |
| Audiobook narration | ElevenLabs v2.5 or XTTS v2 + fine-tune |
| Low-resource language | Train VITS on 5–20 h target-lang data |
| Expressive / emotion tags | ElevenLabs v2.5 or StyleTTS 2 fine-tune |

Líder de código aberto a partir de 2026: **F5-TTS for quality, Kokoro for efficiency**Não busques o Tacotron a menos que seja um historiador.

## Encurralagens

- **No text normalizer.**"Dr. Smith" diz "Doutor" ou "Drive"? "2026" diz "vinte e vinte e seis" ou "dois zero dois seis"?
- **OOV proper nouns.**"Ghumare" → "ghyu-mair"? Enviar um modelo de fallback grapheme-to-phoneme para tokens desconhecidos.
- **Clipping.**A saída do vocoder raramente é clipe, mas a descoincidência de escalação mel na inferência pode ultrapassar ±1,0.`np.clip(wav, -1, 1)`- Não .
- **Sample-rate mismatch.**Kokoro produz 24 kHz; o seu pipeline aguardando 16 kHz → re-sampulação ou obter aliasing.

## Envia-o

Salva como`outputs/skill-tts-designer.md`. Desenhar um canal TTS para um determinado alvo de voz, latência e linguagem.

## Exercícios

1. **Easy.**Corra .`code/main.py`Construi um dicionário fonético a partir de um vocabulário de brinquedo, estima a duração por fonema e imprime um cronograma falso de "mel".
2. **Medium.**Instale Kokoro, sintetize a mesma frase com voz.`af_bella`E ...`am_adam`Comparar a duração do áudio e a qualidade subjetiva.
3. **Hard.**Grave um clip de referência de 5 segundos de si mesmo, use o F5-TTS para cloná-lo, informe o SECS entre a referência e a saída clonada.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Phoneme | Sound unit | Abstract sound class; 39 in English (ARPABet). |
| Duration predictor | How long each phoneme lasts | Non-AR model output; integer frames per phoneme. |
| Vocoder | Mel → waveform | Neural net mapping mel-spec to raw samples. |
| HiFi-GAN | Standard vocoder | GAN-based; dominant 2020–2024. |
| MOS | Subjective quality | 1–5 mean opinion score from human raters. |
| SECS | Voice-clone metric | Cosine similarity between target and output speaker embedding. |
| F5-TTS | 2024 open-source SOTA | Flow-matching diffusion; zero-shot cloning. |
| Kokoro | CPU English leader | 82M-param model, Apache 2.0. |

## Mais leitura

- [Shen et al. (2017). Tacotron 2](https://arxiv.org/abs/1712.05884) a linha de base de seguimento.
- [Kim, Kong, Son (2021). VITS](https://arxiv.org/abs/2106.06103) baseado em fluxos de ponta a ponta.
- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885) SOTA de código aberto atual.
- [Kong, Kim, Bae (2020). HiFi-GAN](https://arxiv.org/abs/2010.05646)O vocoder que ainda vai para 2026.
- [Kokoro-82M on HuggingFace](https://huggingface.co/hexgrad/Kokoro-82M) 2024 TTS Inglês com CPU-friendly.
