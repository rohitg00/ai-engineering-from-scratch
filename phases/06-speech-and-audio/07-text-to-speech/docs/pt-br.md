# Text-to-Speech (TTS) — De Tacotron a F5 e Kokoro

> ASR inverte fala em texto; TTS inverte texto em fala. A pilha de 2026 tem três partes: texto → tokens, tokens → mel, mel → forma de onda. Cada parte tem um modelo padrão que cabe num laptop.

**Tipo:** Construir
**Idiomas:** Python
**Pré-requisitos:** Fase 6 · 02 (Eespecificaçãotrogramas e Mel), Fase 5 · 09 (Seq2Seq), Fase 7 · 05 (Transformer Completo)
**Tempo:** ~75 minutos

## O Problema

Você tem uma string: "Por favor, me lembre de regar as plantas às 18h." Precisa de um clipe de áudio de 3 segundos que soe natural, tenha prosódia correta (pausas, acentos), pronuncie "plantas" com a vogal certa, e rode em menos de 300 ms em CPU para um assistente de voz ao vivo. Precisa também trocar vozes, lidar com input trocado de código ("me lembre às 18h, daijoubu?"), e não passar vergonha com nomes.

Pipelines TTS modernas parecem isso:

1. **Frontend de texto.** Normalizar texto (datas, números, emails), converter para fonemas ou tokens subword, prever características de prosódia.
2. **Modelo acústico.** Texto → eespecificaçãotrograma mel. Tacotron 2 (2017), FastSpeech 2 (2020), VITS (2021), F5-TTS (2024), Kokoro (2024).
3. **Vocoder.** Mel → forma de onda. WaveNet (2016), WaveRNN, HiFi-GAN (2020), BigVGAN (2022), vocoders de codec neural em 2024+.

Em 2026 a divisão acústico + vocoder se blura com modelos de ponta a ponta de diffusão e flow-matching. Mas o modelo mental de três partes ainda vale para debug.

## O Conceito

![Tacotron, FastSpeech, VITS, F5/Kokoro lado a lado](../assets/tts.svg)

**Tacotron 2 (2017).** Seq2seq: char-embedding → BiLSTM encoder → attention sensível à posição → decoder LSTM autoregressivo emite frames mel. Lento (AR), instável em texto longo. Ainda citado como baseline.

**FastSpeech 2 (2020).** Não autoregressivo. Predictor de duração quantos frames mel cada fonema recebe. 1 passada, 10× mais rápido que Tacotron. Perde um pouco de naturalidade (alinhamento monotônico) mas roda em todo lugar.

**VITS (2021).** Treina encoder + duração baseada em flow + vocoder HiFi-GAN de ponta a ponta com inferência variacional. Alta qualidade, modelo único. Dominante em TTS open-source 2022–2024. Variantes: YourTTS (multi-falante zero-shot), XTTS v2 (2024, Coqui).

**F5-TTS (2024).** Transformer de diffusão sobre flow-matching. Prosódia natural, clonagem de voz zero-shot com 5 segundos de áudio de referência. Topo dos rankings de TTS open-source em 2026. 335M params.

**Kokoro (2024).** Pequeno (82M), rodável em CPU, melhor TTS em inglês para uso em tempo real. Vocabulário fechado, apenas inglês, apache-2.0.

**OpenAI TTS-1-HD, ElevenLabs v2.5, Google Chirp-3.** Estado da arte comercial. Tags de emoção do ElevenLabs v2.5 ("[whispered]", "[laughing]") e vozes de personagem dominam produção de audiolivros em 2026.

### Evolução dos vocoders

| Era | Vocoder | Latência | Qualidade |
|-----|---------|----------|-----------|
| 2016 | WaveNet | apenas offline | SOTA no lançamento |
| 2018 | WaveRNN | ~tempo real | boa |
| 2020 | HiFi-GAN | 100× tempo real | quase-humana |
| 2022 | BigVGAN | 50× tempo real | generaliza entre falantes/idiomas |
| 2024 | SNAC, DAC (codecs neurais) | integrado com modelos AR | tokens discretos, eficiente em bits |

Em 2026 a maioria dos modelos "TTS" são de ponta a ponta de texto a forma de onda; o eespecificaçãotrograma mel é uma representação interna.

### Avaliação

- **MOS (Mean Opinion Score).** Escala 1–5, coletado com crowd. Ainda o padrão ouro; dolorosamente lento.
- **CMOS (Comparative MOS).** Preferência A-vs-B. Intervalos de confiança mais apertados por anotação.
- **UTMOS, DNSMOS.** Preditores neurais de MOS sem referência. Usados para leaderboards.
- **CER (Character Error Rate) via ASR.** Rode saída do TTS pelo Whisper, compute CER contra texto de entrada. Proxy de inteligibilidade.
- **SECS (Speaker Embedding Cosine Similarity).** Qualidade de clonagem de voz.

Números de 2026 no LibriTTS test-clean:

| Modelo | UTMOS | CER (via Whisper) | Tamanho |
|--------|-------|-------------------|---------|
| Verdade terreno | 4,08 | 1,2% | — |
| F5-TTS | 3,95 | 2,1% | 335M |
| XTTS v2 | 3,81 | 3,5% | 470M |
| VITS | 3,62 | 3,1% | 25M |
| Kokoro v0.19 | 3,87 | 1,8% | 82M |
| Parler-TTS Large | 3,76 | 2,8% | 2,3B |

## Construa

### Passo 1: fonemize o input

```python
from phonemizer import phonemize
ph = phonemize("Hello world", language="en-us", backend="espeak")
```

Fonemas são a ponte universal. Evite alimentar texto bruto em qualquer coisa abaixo da qualidade VITS.

### Passo 2: rode o Kokoro (padrão CPU de 2026)

```python
from kokoro import KPipeline
tts = KPipeline(lang_code="a")
audio, sr = tts("Please remind me to water the plants at 6 pm.", voice="af_bella")
```

Roda offline, arquivo único, 82M params.

### Passo 3: rode o F5-TTS com clonagem de voz

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="my_voice_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please remind me to water the plants.",
)
```

Passe um clipe de referência de 5 segundos + sua transcrição; F5 clona prosódia e timbre.

### Passo 4: vocoder HiFi-GAN do zero

Grande demais para um script de tutorial, mas o formato é:

```python
class HiFiGAN(nn.Module):
    def __init__(self, mel_channels=80, upsample_rates=[8, 8, 2, 2]):
        super().__init__()
        ...
    def forward(self, mel):
        return self.blocks(mel)  # -> forma de onda
```

Treino: adversarial (discriminador em janelas curtas) + perda de reconstrução de eespecificaçãotrograma mel + perda de matching de características. Comoditizado — use checkpoints pré-treinados do repo `hifi-gan` ou nvidia-NeMo.

### Passo 5: a pipeline completa (pseudocódigo)

```python
text = "Please remind me at 6 pm."
phones = phonemize(text)
mel = acoustic_model(phones, speaker=alice)
wav = vocoder(mel)
soundfile.write("out.wav", wav, 24000)
```

## Use

A pilha de 2026:

| Situação | Escolha |
|----------|---------|
| Assistente de voz em tempo real em inglês | Kokoro (CPU) ou XTTS v2 (GPU) |
| Clonagem de voz a partir de 5 s de referência | F5-TTS |
| Vozes de personagem comerciais | ElevenLabs v2.5 |
| Narração de audiolivro | ElevenLabs v2.5 ou XTTS v2 + ajuste fino |
| Idioma de baixo recurso | Treine VITS em 5–20 h de dados do idioma alvo |
| Tags expressivas / emoção | ElevenLabs v2.5 ou ajuste fino StyleTTS 2 |

Líder open-source em 2026: **F5-TTS para qualidade, Kokoro para eficiência**. Não alcance o Tacotron a menos que você seja historiador.

## Armadilhas

- **Sem normalizador de texto.** "Dr. Smith" é lido como "Doutor" ou "Drive"? "2026" como "vinte e vinte e seis" ou "dois zero dois seis"? Normalize ANTES do fonemizador.
- **OOV em substantivos próprios.** "Ghumare" → "ghyu-mair"? Tenha um modelo reserva de grafema-para-fonema para tokens desconhecidos.
- **Clipping.** Saída do vocoder raramente clipping, mas mismatch de escala mel na inferência pode ultrapassar ±1,0. Sempre `np.clip(wav, -1, 1)`.
- **Incompatibilidade de taxa de amostragem.** Kokoro produz 24 kHz; sua pipeline downstream espera 16 kHz → resample ou terá aliasing.

## Entregue

Salve como `outputs/skill-tts-designer.md`. Projete uma pipeline TTS para uma voz, latência e idioma alvo.

## Exercícios

1. **Fácil.** Execute `code/main.py`. Constrói um dicionário de fonemas de um vocabulário toy, estima duração por fonema e imprime um cronograma "mel" falso.
2. **Médio.** Instale Kokoro, sintetize a mesma frase com voz `af_bella` e `am_adam`. Compare durações de áudio e qualidade subjetiva.
3. **Difícil.** Grave um clipe de referência de 5 segundos da sua voz. Use F5-TTS para clonar. Reporte SECS entre referência e clone.

## Termos Chave

| Termo | O que a gente diz | O que significa de verdade |
|-------|-------------------|---------------------------|
| Fonema | Unidade de som | Classe de som abstrata; 39 em inglês (ARPABet). |
| Predictor de duração | Quanto tempo cada fonema dura | Saída de modelo não-AR; frames inteiros por fonema. |
| Vocoder | Mel → forma de onda | Rede neural que mapeia mel-especificação para amostras brutas. |
| HiFi-GAN | Vocoder padrão | Baseado em GAN; dominante 2020–2024. |
| MOS | Qualidade subjetiva | Pontuação média de opinião 1–5 de avaliadores humanos. |
| SECS | Métrica de clonagem | Cosseno entre embeddings do falante alvo e saída. |
| F5-TTS | SOTA open-source de 2024 | Diffusão por flow-matching; clonagem zero-shot. |
| Kokoro | Líder em inglês para CPU | Modelo de 82M params, Apache 2.0. |

## Leitura Adicional

- [Shen et al. (2017). Tacotron 2](https://arxiv.org/abs/1712.05884) — o baseline seq2seq.
- [Kim, Kong, Son (2021). VITS](https://arxiv.org/abs/2106.06103) — de ponta a ponta baseado em flow.
- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885) — SOTA open-source atual.
- [Kong, Kim, Bae (2020). HiFi-GAN](https://arxiv.org/abs/2010.05646) — o vocoder que ainda roda em 2026.
- [Kokoro-82M no HuggingFace](https://huggingface.co/hexgrad/Kokoro-82M) — TTS amigável a CPU de 2024.
