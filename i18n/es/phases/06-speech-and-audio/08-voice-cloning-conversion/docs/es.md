# Cloning de voz y conversión de voz

> La clonación de voz lee tu texto en la voz de otra persona. La conversión de voz reescribe tu voz en la de otra persona mientras se conserva lo que dijiste. Ambos se apoyan en la misma descomposición: la identidad del hablante separada del contenido.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 06 (Speaker Recognition), Phase 6 · 07 (TTS)
**Time:** ~75 minutes

## El problema

En 2026, un clip de audio de 5 segundos es suficiente para producir un clon de alta calidad de la voz de cualquier persona con una GPU de consumo. ElevenLabs, F5-TTS, OpenVoice v2, VoiceBox envían todos clonamiento de cero disparos o pocos disparos. La tecnología es una bendición (accesividad TTS, doblaje, voces asistentes) y un arma (llamadas de estafa, deepfakes políticos, robo de IP).

Dos tareas estrechamente relacionadas:

- **Voice cloning (TTS-side):**texto + 5 segundos de voz de referencia → audio en esa voz.
- **Voice conversion (speech-side):**Audio fuente (persona A diciendo X) + voz de referencia de la persona B → audio de B diciendo X.

Ambos factorizan una forma de onda en (contenido, altavoz, prosodia) y recombinan contenido de una fuente con altavoz de otra.

La principal restricción que ahora se embarca en 2026:**watermarking and consent gates are legally required in the EU (AI Act, enforceable August 2026) and in California (AB 2905, effective 2025)**Su oleoducto debe emitir una marca de agua inaudible y rechazar clones no consensuados.

## El concepto

![Voice cloning vs conversion: factorize, swap speaker, recombine](../assets/voice-cloning.svg)

**Zero-shot cloning.**Pasar un clip de 5 segundos a un modelo que ha sido entrenado en miles de altavoces. El codificador de altavoces mapea el clip a un altavoces que se incorpora; el decodificador TTS condiciones en esa incorporación más texto.

Utilizado por: F5-TTS (2024), YourTTS (2022), XTTS v2 (2024), OpenVoice v2 (2024).

**Few-shot fine-tuning.**El programa de audio de la audiencia de la audiencia de la audiencia de la audiencia de la audiencia de la audiencia de la audiencia de la audiencia de la audiencia de la audiencia de la audiencia de la audiencia de la audiencia de la audiencia de la audiencia de la audiencia de la audiencia de la audiencia de la audiencia de la audiencia de la audiencia de la audiencia de la audiencia de la audiencia de la audiencia de la audiencia de la audiencia de la audiencia de la audiencia de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de audición de la audición de la audición de la audición de audición de la audición de la audición de la audición de audición de la audición de audición de la audición de la audición de audición de la audición de audición de la audición de audición de la audición de audición de la audición de audición de la audición de audición de la audición de la audición de la audición de audición de audición de la audición de la audición de la audición de la audición de audición de la audición de la audición de la audición de la audición de audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición de la audición

**Voice conversion (VC).**Dos familias:

- **Recognition-synthesis.**ejecuta un modelo similar a ASR para extraer la representación de contenido (por ejemplo, posteriors fonéticos blandos, PPGs), luego sintetizar con el incrustamiento de altavoces objetivo. Robusto para el lenguaje y el acento.
- **Disentanglement.**Entrenar un autoencoder que separa el contenido, el altavoz y la prosodia en un espacio latente en el cuello de botella. Swap altavoz que se incorpora en la inferencia. Calidad menor pero más rápida. Utilizado por AutoVC (2019), VITS-VC variantes.

**Neural codec-based cloning (2024+).**VALL-E, VALL-E 2, NaturalSpeech 3, VoiceBox  tratan el audio como tokens discretos de SoundStream / EnCodec, entrenan un modelo autorregresivista o de coincidencia de flujo sobre los tokens de codec.

### El poco de ética, no un paralelo

**Watermarking.**PerTh (Perth) y SilentCipher (2024) incorporan un ID de ~16-32 bits imperceptiblemente en el audio. Sobrevive al reencodificación, transmisión y edición común.

**Consent gates.**Debe combinar cada salida clonada con un registro de consentimiento verificable. "Yo, Rohit, el 2026-04-22, autorizar esta voz para el propósito X".

**Detection.**AASIST, RawNet2 y Wav2Vec2-AASIST se utilizan como detectores. ASVspoof 2025 desafío publicó EERs de 0.82.3% para detectores de última generación contra ElevenLabs, VALL-E 2, y las salidas de Bark.

### Números (2026)

| Model | Zero-shot? | SECS (target sim) | WER (intel.) | Params |
|-------|-----------|--------------------|--------------|--------|
| F5-TTS | Yes | 0.72 | 2.1% | 335M |
| XTTS v2 | Yes | 0.65 | 3.5% | 470M |
| OpenVoice v2 | Yes | 0.70 | 2.8% | 220M |
| VALL-E 2 | Yes | 0.77 | 2.4% | 370M |
| VoiceBox | Yes | 0.78 | 2.1% | 330M |

SECS > 0,70 es generalmente indistinguible del objetivo para la mayoría de los oyentes.

```figure
sp-voice-factorize
```

## Construye el mismo

### Paso 1: descomponer con reconocimiento-síntesis (demo de código sólo en main.py)

```python
def clone_pipeline(ref_audio, text, target_embedder, tts_model):
    speaker_emb = target_embedder.encode(ref_audio)
    mel = tts_model(text, speaker=speaker_emb)
    return vocoder(mel)
```

Conceptualmente simple; la masa de implementación es de`tts_model`y el codificador de altavoces.

### Paso 2: clona de tiro cero con F5-TTS

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="rohit_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please add milk and bread to my list.",
)
```

La transcripción de referencia debe coincidir exactamente con el audio; la falta de coincidencia rompe la alineación.

### Paso 3: conversión de voz con KNN-VC

```python
import torch
from knnvc import KNNVC  # 2023 model, https://github.com/bshall/knn-vc
vc = KNNVC.load("wavlm-base-plus")
out_wav = vc.convert(source="my_voice.wav", target_pool=["alice_1.wav", "alice_2.wav"])
```

KNN-VC ejecuta WavLM para extraer embebidos por marco para el pool de fuentes y objetivos, luego reemplaza cada marco de origen con su vecino más cercano en el pool.

### Paso 4: incrustar una marca de agua

```python
from silentcipher import SilentCipher
sc = SilentCipher(model="2024-06-01")
payload = b"consent_id:abc123;ts:1745353200"
watermarked = sc.embed(wav, sr=24000, message=payload)
detected = sc.detect(watermarked, sr=24000)   # returns payload bytes
```

~ 32 bits de carga útil, detectable después de la recodificación de MP3 y ruido ligero.

### Paso 5: Puerta de consentimiento

```python
def cloned_inference(text, ref_audio, consent_record):
    assert verify_signature(consent_record), "Signed consent required"
    assert consent_record["speaker_id"] == hash_speaker(ref_audio)
    wav = tts.infer(ref_file=ref_audio, gen_text=text)
    wav = watermark(wav, payload=consent_record["id"])
    return wav
```

## Usalo

La pila de 2026:

| Situation | Pick |
|-----------|------|
| 5-sec zero-shot clone, open-source | F5-TTS or OpenVoice v2 |
| Commercial production cloning | ElevenLabs Instant Voice Clone v2.5 |
| Voice conversion (rewriting) | KNN-VC or Diff-HierVC |
| Many-speaker fine-tune | StyleTTS 2 + speaker adapter |
| Cross-lingual cloning | XTTS v2 or VALL-E X |
| Deepfake detection | Wav2Vec2-AASIST |

## Las trampas

- **Misaligned reference transcript.**F5-TTS y similares requieren que el texto de referencia coincida exactamente con el audio de referencia, incluida la puntuación.
- **Reverberant reference.**Echo mata al clon, graba en secas y cercanas.
- **Emotional mismatch.**La referencia de entrenamiento "alegre" produce clones alegres de todo.
- **Language leakage.**Clonar a un hablante inglés y luego pedir al modelo que hable francés a menudo lleva el acento de todos modos; use modelos interlinguísticos (XTTS, VALL-E X).
- **No watermark.**No se puede enviar legalmente en la UE a partir de agosto de 2026.

## Envío

Salvo como`outputs/skill-voice-cloner.md`. Diseñar un conducto de clonación o conversión con puerta de consentimiento + marca de agua + objetivo de calidad.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`.Demonstra el intercambio entre altavoces integrados calculando el cosino entre dos " altavoces" antes y después del intercambio.
2. **Medium.**Utilice OpenVoice v2 para clonar su propia voz. Medir SECS entre referencia y clonación. Medir CER a través de Whisper.
3. **Hard.**Aplicar el signo de agua SilentCipher a 20 clones, ejecutarlos a través de 128 kbps MP3 codificación + decodificación, detectar la carga útil.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Zero-shot clone | 5 seconds is enough | Pretrained model + speaker embedding; no training. |
| PPG | Phonetic posteriorgram | Per-frame ASR posteriors used as language-agnostic content rep. |
| KNN-VC | Nearest-neighbor conversion | Replace each source frame with nearest target-pool frame. |
| Neural codec TTS | VALL-E style | AR model over EnCodec/SoundStream tokens. |
| Watermark | Inaudible signature | Bits embedded in audio, survive re-encode. |
| SECS | Cloning fidelity | Cosine between target and clone speaker embeddings. |
| AASIST | Deepfake detector | Anti-spoof model; detects synthesized speech. |

## Leer más

- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885) Cloning de código abierto de SOTA con disparos cero.
- [Baevski et al. / Microsoft (2023). VALL-E](https://arxiv.org/abs/2301.02111)y [VALL-E 2 (2024)](https://arxiv.org/abs/2406.05370) TTS de codec neuronal.
- [Qian et al. (2019). AutoVC](https://arxiv.org/abs/1905.05879) conversión de voz basada en desentrañación.
- [Baas, Waubert de Puiseau, Kamper (2023). KNN-VC](https://arxiv.org/abs/2305.18975) VC basado en la recuperación.
- [SilentCipher (2024) — Audio Watermarking](https://github.com/sony/silentcipher) Marca de agua de audio de 32 bits lista para producción.
- [ASVspoof 2025 results](https://www.asvspoof.org/) detector vs sintetizador carrera de armamento, actualizada en 2026.
