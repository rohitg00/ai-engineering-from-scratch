# Voz Anti-Spoofing & Áudio Watermarking  ASVspoof 5, AudioSeal, WaveVerify

> A clonagem de voz foi enviada mais rápido do que as defesas. Os sistemas de voz de produção de 2026 precisam de duas coisas: um detector (AASIST, RawNet2) que classifica fala real vs falsa, e uma marca de água (AudioSeal) que sobrevive à compressão e edição.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 06 (Speaker Recognition), Phase 6 · 08 (Voice Cloning)
**Time:** ~75 minutes

## O problema

Três defesas relacionadas:

1. **Anti-spoofing / deepfake detection.**Dado um vídeo de áudio, é sintético ou real? ASVspoof benchmarks (ASVspoof 2019 → 2021 → 5) são o padrão de ouro.
2. **Audio watermarking.**Embed um sinal imperceptível em áudio gerado que um detector pode extrair mais tarde.
3. **Authenticated provenance.**Assinatura criptográfica de arquivos de áudio + metadados.

A detecção lida com adversários que não cooperam. A marca de água lida com o cumprimento.

## O conceito

![Anti-spoofing vs watermarking vs provenance — three defense layers](../assets/spoofing-watermark.svg)

### ASVspoof 5  o índice de referência 2024-2025

A maior mudança das edições anteriores:

- **Crowdsourced data**- Não é um estúdio limpo.
- **~2000 speakers**(versus ~ 100 antes).
- **32 attack algorithms.**TTS + conversão de voz + perturbação adversária.
- **Two tracks.**Contro-medida (CM) detecção independente; ASV (SASV) robusto em falsificação para sistemas biométricos.

Estado da arte em ASVspoof 5: ~ 7,23% EER. No ASVspoof mais antigo 2019 LA: 0,42% EER. Desplojamento no mundo real: espere 5-10% EER em clips no meio selvagem.

### Famílias de modelos de detecção AASIST e RawNet2 

**AASIST**(2021, atualizado até 2026). Atenção gráfica às características espectrais. SOTA atual sobre a tarefa de contra-medida ASVspoof 5.

**RawNet2.**Convolução frontal sobre forma de onda bruta + espinha dorsal TDNN. Linha de base mais simples; ainda competitiva com ajuste fino.

**NeXt-TDNN + SSL features.**Variante 2025: ECAPA-style + WavLM recursos + perda focal. Atinge a 0,42% EER em ASVspoof 2019 LA.

### AudioSeal  o 2024 marca de água padrão

Meta's **AudioSeal**(Jan 2024, v0.2 Dec 2024).

- **Localized.**Detecta a marca de água por quadro em resolução de amostra de 16 kHz (1/16000 s).
- **Generator + detector jointly trained.**O gerador aprende a incorporar um sinal inaudible; o detector aprende a encontrá-lo através de aumentos.
- **Robust.**Sobrevive à compressão MP3 / AAC, EQ, velocidade de mudança ±10%, mistura de ruído +10 dB SNR.
- **Fast.**O detector funciona a 485x em tempo real, 1000x mais rápido do que o WavMark.
- **Capacity.**Carga útil de 16 bits (pode codificar ID de modelo, timestamp de geração, ID de usuário) incorporável em cada expressão.

### WavMark

A linha de base aberta pré-AudioSeal. Rede neural invertível, 32 bits/seg.

- A sincronização da força bruta é lenta.
- Pode ser removido por ruído gaussiano ou compressão MP3.
- Não é amigável em tempo real.

### WaveVerify (julho de 2025)

Resolve as fraquezas do AudioSeal  especificamente manipulações temporais (inversion, velocidade). Utiliza gerador baseado em FiLM + detector de mistura de especialistas. Competitivo com o AudioSeal em ataques padrão; lida com edições temporais.

### Os adversários exploram a lacuna

De AudioMarkBench: "em baixo da mudança de pitch, todas as marcas de água mostram Bit Recovery Accuracy abaixo de 0,6, indicando remoção quase completa". **Pitch-shift is the universal attack.**A marca de água no 2026 é totalmente robusta para modificações agressivas de tom. É por isso que você precisa de detecção (AASIST) ao lado da marca de água.

### C2PA / Iniciativa de Autenticidade de Conteúdo

Não é uma técnica de ML  um formato manifesto. Os arquivos de áudio carregam metadados criptograficamente assinados sobre a ferramenta de criação, autor, data. Audobox / Seamless usá-lo. Bom para a proveniência; não faz nada se um mau ator recodificar e strip metadados.

```figure
v4-audio-watermark
```

## Construí-lo

### Passo 1: um simples detector de características espectrais (joguete)

```python
def spectral_rolloff(spec, percentile=0.85):
    cum = 0
    total = sum(spec)
    if total == 0:
        return 0
    threshold = total * percentile
    for k, v in enumerate(spec):
        cum += v
        if cum >= threshold:
            return k
    return len(spec) - 1

def is_suspicious(audio):
    spec = magnitude_spectrum(audio)
    rolloff = spectral_rolloff(spec)
    return rolloff / len(spec) > 0.92
```

A fala sintética tem frequência de alta frequência, mas a intuição é válida.

### Passo 2: AudioSeal embutida + detectada

```python
from audioseal import AudioSeal
import torch

generator = AudioSeal.load_generator("audioseal_wm_16bits")
detector = AudioSeal.load_detector("audioseal_detector_16bits")

audio = load_wav("generated.wav", sr=16000)[None, None, :]
payload = torch.tensor([[1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0]])
watermark = generator.get_watermark(audio, sample_rate=16000, message=payload)
watermarked = audio + watermark

result, decoded_payload = detector.detect_watermark(watermarked, sample_rate=16000)
# result: float in [0, 1] — probability of watermark presence
# decoded_payload: 16 bits; match against embedded payload
```

### Passo 3: avaliação  EER

```python
def eer(real_scores, fake_scores):
    thresholds = sorted(set(real_scores + fake_scores))
    best = (1.0, 0.0)
    for t in thresholds:
        far = sum(1 for s in fake_scores if s >= t) / len(fake_scores)
        frr = sum(1 for s in real_scores if s < t) / len(real_scores)
        if abs(far - frr) < best[0]:
            best = (abs(far - frr), (far + frr) / 2)
    return best[1]
```

### Passo 4: integração da produção

```python
def safe_tts(text, voice, clone_reference=None):
    if clone_reference is not None:
        verify_consent(user_id, clone_reference)
    audio = tts_model.synthesize(text, voice)
    audio_with_wm = audioseal_embed(audio, payload=build_payload(user_id, model_id))
    manifest = c2pa_sign(audio_with_wm, user_id, timestamp=now())
    return audio_with_wm, manifest
```

Cada navio de geração: (1) marca de água, (2) manifesto assinado, (3) registro de auditoria conforme às políticas de retenção.

## Usá-lo

| Use case | Defense |
|----------|---------|
| Shipping TTS / voice cloning | AudioSeal embed on every output (non-negotiable) |
| Biometric voice unlock | AASIST + ECAPA ensemble; liveness challenge |
| Call-center fraud detection | AASIST on 20% sample of incoming calls |
| Podcast authenticity | C2PA signing on upload, AudioSeal if AI-generated |
| Research / training detectors | ASVspoof 5 train/dev/eval sets |

## Encurralagens

- **Watermark without detector ever running.**Envia o detector para o teu informador.
- **Detection without calibration.**AASIST treinado em sobre-exames de LA, redução de precisão no mundo real.
- **Pitch-shift gap.**A mudança de pitch agressiva remove a maioria das marcas de água.
- **Metadata strip-and-rehost.**C2PA é trivialmente evitável por recodificação. Sempre adicione a defesa criptográfica + perceptual (marca de água) juntas.
- **Liveness as detection.**Peça ao usuário para dizer uma frase aleatória.

## Envia-o

Salva como`outputs/skill-spoof-defender.md`Selecionar o modelo de detecção, a marca de água, o manifesto de proveniência e o manual operacional para a implantação de uma geração de voz.

## Exercícios

1. **Easy.**Corra .`code/main.py`- Detector de brinquedos + marca de água de brinquedos embutida/detectada em áudio sintético.
2. **Medium.**Instalação`audioseal`, incorporar uma carga útil de 16 bits numa saída TTS, recodificar, corromper o áudio com ruído e medir a precisão de recuperação de bits.
3. **Hard.**Tune-se em linha reta um RawNet2 ou AASIST em ASVspoof 2019 LA. Mese a EER. Teste em um conjunto de clips gerados por F5-TTS  ver como a detecção de OOD se degrada.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| ASVspoof | The benchmark | Biennial challenge; 2024 = ASVspoof 5. |
| CM (countermeasure) | Detector | Classifier: real speech vs synthetic / converted. |
| SASV | Speaker verif + CM | Integrated biometric + spoof detection. |
| AudioSeal | Meta watermark | Localized, 16-bit payload, 485× faster than WavMark. |
| Bit Recovery Accuracy | Watermark survival | Fraction of payload bits recovered after attack. |
| C2PA | Provenance manifest | Cryptographic metadata about creation / authorship. |
| AASIST | Detector family | Graph-attention-based anti-spoofing SOTA. |

## Mais leitura

- [Todisco et al. (2024). ASVspoof 5](https://dl.acm.org/doi/10.1016/j.csl.2025.101825) o indicador de referência actual.
- [Defossez et al. (2024). AudioSeal](https://arxiv.org/abs/2401.17264) o signo de água padrão.
- [Chen et al. (2025). WaveVerify](https://arxiv.org/abs/2507.21150)Detetor de MoE para ataques temporais.
- [Jung et al. (2022). AASIST](https://arxiv.org/abs/2110.01200) a espinha dorsal de detecção de SOTA.
- [AudioMarkBench (2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/5d9b7775296a641a1913ab6b4425d5e8-Paper-Datasets_and_Benchmarks_Track.pdf) Avaliação da robustez.
- [C2PA specification](https://spec.c2pa.org/specifications/specifications/2.4/index.html) formato do manifesto de proveniência.
