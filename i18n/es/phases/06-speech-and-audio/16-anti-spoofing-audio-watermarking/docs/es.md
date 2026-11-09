# Voto anti-espoofing y marcado de agua de audio  ASVspoof 5, AudioSeal, WaveVerify

> El clonamiento de voz se envió más rápido que las defensas. En 2026 los sistemas de voz de producción necesitan dos cosas: un detector (AASIST, RawNet2) que clasifique el habla real vs falsa, y una marca de agua (AudioSeal) que sobreviva a la compresión y edición.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 06 (Speaker Recognition), Phase 6 · 08 (Voice Cloning)
**Time:** ~75 minutes

## El problema

Tres defensas relacionadas:

1. **Anti-spoofing / deepfake detection.**Dado un clip de audio, ¿es sintético o real? Los puntos de referencia ASVspoof (ASVspoof 2019 → 2021 → 5) son el estándar de oro.
2. **Audio watermarking.**Embed una señal imperceptible en el audio generado que un detector puede extraer más tarde. AudioSeal (Meta) y WavMark son las opciones abiertas.
3. **Authenticated provenance.**Firmar criptográficamente archivos de audio + metadatos. Iniciativa de autenticidad de contenido.

La detección maneja a los adversarios que no cooperan. Watermarking maneja el cumplimiento.

## El concepto

![Anti-spoofing vs watermarking vs provenance — three defense layers](../assets/spoofing-watermark.svg)

### ASVspoof 5  el índice de referencia 2024-2025

El mayor cambio de las ediciones anteriores:

- **Crowdsourced data**No está limpio.
- **~2000 speakers**(vs ~ 100 antes).
- **32 attack algorithms.**TTS + conversión de voz + perturbación adversaria.
- **Two tracks.**Contramedida (CM) detección independiente; ASV (SASV) de seguridad para sistemas biométricos.

El estado de la técnica en ASVspoof 5: ~ 7.23% EER. En el ASVspoof más viejo 2019 LA: 0.42% EER. Despliegue en el mundo real: espere 5-10% EER en clips en el medio ambiente.

### Famílias de modelos de detección de AASIST y RawNet2 

**AASIST**(en el caso de los Estados Unidos, el número de Estados miembros que han adoptado las medidas de contraposición es de 2021 a 2026).

**RawNet2.**Convolución delantera sobre la forma de onda bruta + espina dorsal TDNN. Línea de base más simple; todavía competitivo con ajuste fino.

**NeXt-TDNN + SSL features.**Variante 2025: ECAPA-style + WavLM características + pérdida focal. Lleva el 0,42% EER en ASVspoof 2019 LA.

### AudioSeal  el 2024 marca de agua por defecto

Meta's **AudioSeal**(Jan 2024, v0.2 de diciembre de 2024).

- **Localized.**Detecta la marca de agua por fotograma a 16 kHz (1/16000 s) de resolución de muestra.
- **Generator + detector jointly trained.**El generador aprende a incorporar una señal inaudible; el detector aprende a encontrarla a través de aumentos.
- **Robust.**Sobrevive a la compresión MP3 / AAC, EQ, cambio de velocidad ±10%, mezcla de ruido +10 dB SNR.
- **Fast.**El detector funciona en tiempo real 485 veces; 1000 veces más rápido que WavMark.
- **Capacity.**Carga útil de 16 bits (puede codificar el ID del modelo, timestamp de generación, ID del usuario) incrustable en cada declaración.

### WavMark

La línea de base de apertura pre-AudioSeal. red neuronal invertible, 32 bits/sec. Problemas:

- La sincronización de la fuerza bruta es lenta.
- Puede ser eliminado por ruido gaussiano o compresión MP3.
- No es amigable en tiempo real.

### WaveVerify (julio 2025)

Adresa las debilidades de AudioSeal  específicamente manipulaciones temporales (inversión, velocidad). Utiliza generador basado en FiLM + detector de mezcla de expertos. Competitivo con AudioSeal en ataques estándar; maneja modificaciones temporales.

### Los adversarios explotan la brecha

De AudioMarkBench: "bajo cambio de tono, todas las marcas de agua muestran la precisión de recuperación de bits por debajo de 0.6, lo que indica una eliminación casi completa". **Pitch-shift is the universal attack.**No 2026 marca de agua es totalmente robusta para la modificación agresiva de tono.

### C2PA / Iniciativa de autenticidad de contenidos

No es una técnica de ML  un formato manifiesto. Los archivos de audio contienen metadatos firmados criptográficamente sobre la herramienta de creación, autor, fecha. Audobox / Seamless lo utiliza.

```figure
v4-audio-watermark
```

## Construye el mismo

### Paso 1: un detector de características espectrales simple (juego)

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

El habla sintética a menudo tiene una energía de alta frecuencia inusualmente plana.

### Paso 2: AudioSeal embebed + detecta

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

### Paso 3: evaluación  EER

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

### Paso 4: la integración de la producción

```python
def safe_tts(text, voice, clone_reference=None):
    if clone_reference is not None:
        verify_consent(user_id, clone_reference)
    audio = tts_model.synthesize(text, voice)
    audio_with_wm = audioseal_embed(audio, payload=build_payload(user_id, model_id))
    manifest = c2pa_sign(audio_with_wm, user_id, timestamp=now())
    return audio_with_wm, manifest
```

Cada generación de buques: (1) marca de agua, (2) manifiesto firmado, (3) registro de auditoría conforme a las políticas de retención.

## Usalo

| Use case | Defense |
|----------|---------|
| Shipping TTS / voice cloning | AudioSeal embed on every output (non-negotiable) |
| Biometric voice unlock | AASIST + ECAPA ensemble; liveness challenge |
| Call-center fraud detection | AASIST on 20% sample of incoming calls |
| Podcast authenticity | C2PA signing on upload, AudioSeal if AI-generated |
| Research / training detectors | ASVspoof 5 train/dev/eval sets |

## Las trampas

- **Watermark without detector ever running.**Envía el detector en tu informador.
- **Detection without calibration.**AASIST entrenado en los sobresaltos de los EE.UU. y la precisión en el mundo real.
- **Pitch-shift gap.**El cambio de tono agresivo elimina la mayoría de las marcas de agua.
- **Metadata strip-and-rehost.**C2PA es trivialmente evitable mediante el re-encodificación. Siempre añadir criptografía + perceptual (marca de agua) defensa juntos.
- **Liveness as detection.**Pida al usuario que diga una frase aleatoria. Previene los ataques de repetición pero no la clonación en tiempo real.

## Envío

Salvo como`outputs/skill-spoof-defender.md`. Seleccionar el modelo de detección, la marca de agua, el manifiesto de procedencia y el manual de juego operativo para un despliegue de la generación de voz.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`. Detector de juguetes + marca de agua de juguetes incorporada/detectada en audio sintético.
2. **Medium.**Instalar`audioseal`, embebebedar una carga útil de 16 bits en una salida TTS, volver a decodificar, corromper el audio con ruido y medir la precisión de recuperación de bits.
3. **Hard.**Tune a la perfección un RawNet2 o AASIST en ASVspoof 2019 LA. Medir EER. Prueba en un conjunto prolongado de clips generados por F5-TTS  ver cómo se degrada la detección de OOD.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| ASVspoof | The benchmark | Biennial challenge; 2024 = ASVspoof 5. |
| CM (countermeasure) | Detector | Classifier: real speech vs synthetic / converted. |
| SASV | Speaker verif + CM | Integrated biometric + spoof detection. |
| AudioSeal | Meta watermark | Localized, 16-bit payload, 485× faster than WavMark. |
| Bit Recovery Accuracy | Watermark survival | Fraction of payload bits recovered after attack. |
| C2PA | Provenance manifest | Cryptographic metadata about creation / authorship. |
| AASIST | Detector family | Graph-attention-based anti-spoofing SOTA. |

## Leer más

- [Todisco et al. (2024). ASVspoof 5](https://dl.acm.org/doi/10.1016/j.csl.2025.101825) el índice de referencia actual.
- [Defossez et al. (2024). AudioSeal](https://arxiv.org/abs/2401.17264) el signo de agua por defecto.
- [Chen et al. (2025). WaveVerify](https://arxiv.org/abs/2507.21150)Detector de EMO para ataques temporales.
- [Jung et al. (2022). AASIST](https://arxiv.org/abs/2110.01200) la columna vertebral de detección de SOTA.
- [AudioMarkBench (2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/5d9b7775296a641a1913ab6b4425d5e8-Paper-Datasets_and_Benchmarks_Track.pdf) Evaluación de la robustez.
- [C2PA specification](https://spec.c2pa.org/specifications/specifications/2.4/index.html) formato del manifiesto de procedencia.
