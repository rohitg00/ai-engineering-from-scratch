# Susurro  Arquitectura y ajuste fino

> Whisper es un transformer de ventana de 30 segundos, entrenado en 680 mil horas de pares de audio-texto multilingües con poca supervisión. Una arquitectura, múltiples tareas, robusta en 99 idiomas.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04 (ASR), Phase 5 · 10 (Attention), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## El problema

Whisper, lanzado por OpenAI en septiembre de 2022, fue el primer modelo ASR en ser enviado como un producto básico: pegar audio, obtener texto, 99 idiomas, robusto al ruido, se ejecuta en una computadora portátil. Para 2024 OpenAI había enviado variantes Large-v3 y Turbo; para 2026, Whisper es la línea de base predeterminada para todo, desde la transcripción de podcast hasta asistentes de voz hasta subtítulos de YouTube.

Pero Whisper no es un pipeline que se puede tratar como una caja negra para siempre.

1. Lo que realmente es dentro.
2. Cómo darlo en pedazos, en streaming o en formato largo correctamente.
3. ¿Cuándo y cómo ajustar?

## El concepto

![Whisper encoder-decoder, tasks, chunked inference, fine-tune](../assets/whisper.svg)

**Architecture.**El transformer estándar codificador-decodificador.

- Entrada: Espectograma log-mel de 30 segundos, 80 mels, 10 ms hop → 3000 cuadros.
- Encodrador: muestra de la con-descisión (fase 2) + `N`Bloques de transformador para grandes v3: 32 capas, 1280-dim, 20 cabezas.
- Descriptor:`N`bloques de transformador con auto-atn causal + atn cruzado a salida de codificador. del mismo tamaño que el codificador.
- Resultado: Tokens BPE sobre una vocabulario de 51.865 tokens.

El Large-v3 tiene parámetros de 1.55B. Turbo utiliza un decodificador de 4 capas (desde 32), reduciendo la latencia 8x con un golpe WER <1% .

**The prompt format.**Whisper es un modelo multitarea dirigido por tokens especiales en el descifrador de instrucciones:

```
<|startoftranscript|><|en|><|transcribe|><|notimestamps|> Hello world.<|endoftext|>
```

- `<|en|>`: etiqueta de idioma; nombres del idioma hablado en el audio.
- `<|transcribe|>`o `<|translate|>`: etiqueta de tarea; transcribir el discurso en su lenguaje de origen, o traducirlo a texto en inglés.
- `<|notimestamps|>`: saltar las temporadas de nivel de palabra (más rápido).

El prompt es lo que permite a un modelo hacer muchas tareas.`<|en|>`¿ Qué ?`<|fr|>`y transcribe francés.

**30-second window.**Todo está fijado a 30 segundos. Los clips más largos necesitan ser recheados; los clips más cortos están empolgados. Windows no se transmiten de forma nativa.

**Log-mel normalization.** `(log_mel - mean) / std`donde las estadísticas provienen del propio cuerpo de entrenamiento de Whisper.`whisper.audio.log_mel_spectrogram`), no `librosa.feature.melspectrogram`¿ Qué ?

### Variantes en 2026

| Variant | Params | Latency (A100) | WER (LibriSpeech-clean) |
|---------|--------|----------------|------------------------|
| Tiny | 39M | 1× realtime | 5.4% |
| Base | 74M | 1× | 4.1% |
| Small | 244M | 1× | 3.0% |
| Medium | 769M | 1× | 2.7% |
| Large-v3 | 1.55B | 2× | 1.8% |
| Large-v3-turbo | 809M | 8× | 1.58% |
| Whisper-Streaming (2024) | 1.55B | streaming | 2.0% |

### Arreglamiento

Flujo de trabajo canónico en 2026:

1. Recoger 10100 horas de audio del dominio objetivo con transcripciones alineadas.
2. - ¿ Qué ?`transformers.Seq2SeqTrainer`con`generate_with_loss`- ¿Qué?
3. Eficiencia parámetrica: LoRA en `q_proj`¿ Qué ?`k_proj`¿ Qué ?`v_proj`de capas de atención reduce la memoria de la GPU 4× con < 0,3 costo WER.
4. Congelar el codificador si tiene < 10 horas. Sólo sintonizar el decodificador.
5. Utilice el propio tokenizer y formato de solicitud de Whisper; nunca cambie los tokenizadores.

Resultados comunitarios: ajuste fino Mediano en 20 horas de dictado médico disminuye el WER de 12% a 4,5% en el vocabulario médico.

```figure
sp-asr-attention
```

## Construye el mismo

### Paso 1: ejecutar el susurro fuera de la caja

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe(
    "clip.wav",
    language="en",
    task="transcribe",
    temperature=0.0,
    condition_on_previous_text=False,  # prevents runaway repetition
)
print(result["text"])
for seg in result["segments"]:
    print(f"[{seg['start']:.2f}–{seg['end']:.2f}] {seg['text']}")
```

Las diferencias clave que siempre debe anotar: `temperature=0.0`(muestreo de valores por defecto a 0,0 → 0,2 → 0,4 ... cadena de retroceso), `condition_on_previous_text=False`(previene el problema de alucinación en cascada), y `no_speech_threshold=0.6`(detección de silencio).

### Paso 2: forma larga en pedazos

```python
# whisperx is the 2026 reference for long-form with word-level timestamps
import whisperx
model = whisperx.load_model("large-v3-turbo", device="cuda", compute_type="float16")
segments = model.transcribe("1hour.mp3", batch_size=16, chunk_size=30)
```

WhisperX añade (1) Silero VAD gateing, (2) alineación a nivel de palabras a través de wav2vec 2.0, (3) diarización a través de `pyannote.audio`El caballo de trabajo 2026 para la transcripción de producción.

### Paso 3: ajuste a la perfección con LoRA

```python
from transformers import WhisperForConditionalGeneration, WhisperProcessor
from peft import LoraConfig, get_peft_model

model = WhisperForConditionalGeneration.from_pretrained("openai/whisper-large-v3-turbo")
lora = LoraConfig(
    r=16, lora_alpha=32, target_modules=["q_proj", "v_proj"],
    lora_dropout=0.1, bias="none", task_type="SEQ_2_SEQ_LM",
)
model = get_peft_model(model, lora)
# model.print_trainable_parameters()  -> ~3M trainable / 809M total
```

Luego el bucle de entrenadores estándar, un punto de control cada 1000 pasos, evalúa con WER el tiempo de espera.

### Paso 4: inspeccionar lo que cada capa aprende

```python
# Grab cross-attention weights during decode to see what the decoder attends to.
with torch.inference_mode():
    out = model.generate(
        input_features=features,
        return_dict_in_generate=True,
        output_attentions=True,
    )
# out.cross_attentions: layer × head × step × src_len
```

Visualice con una mapa de calor  verá la alineación diagonal a medida que los pasos del decodificador escanean a través de los marcos del codificador. Esa diagonal es la noción de tiempo de palabras de Whisper.

## Usalo

La pila de 2026:

| Situation | Pick |
|-----------|------|
| General English, offline | Large-v3-turbo via `whisperx` |
| Mobile / edge | Whisper-Tiny quantized (int8) or Moonshine |
| Multilingual long-form | Large-v3 via `whisperx` + diarization |
| Low-resource language | Fine-tune Medium or Turbo with LoRA |
| Streaming (2 s latency) | Whisper-Streaming or Parakeet-TDT |
| Word-level timestamps | WhisperX (forced alignment via wav2vec 2.0) |

`faster-whisper`(CTranslate2 backend) es el tiempo de ejecución de inferencia CPU+GPU más rápido en 2026  4x más rápido que la vainilla con salida idéntica.

## Las trampas que todavía se envían en 2026

- **Hallucinated text on silence.**El susurro entrenado en los títulos incluye "Gracias por ver!", "Abonéctate!", letras de las canciones.
- **`condition_on_previous_text` cascade.**Una alucinación contamina las ventanas posteriores.`False`a menos que necesites fluidez en pedazos.
- **Short-clip padding.**Un clip de 2 segundos empolvado a 30 segundos puede alucinar en el silencio posterior.`pad=False`o VAD-gate.
- **Wrong mel stats.**Usar los mels de librosa en lugar de los de Whisper produce una salida casi aleatoria.`whisper.audio.log_mel_spectrogram`¿ Qué ?

## Envío

Salvo como`outputs/skill-whisper-tuner.md`Diseñar un flujo de sintonía o inferencia de Whisper para un dominio determinado.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`Se tokeniza un mensaje de estilo Whisper, calcula los presupuestos de forma decodificada, e imprime el horario de piezas para un clip de 10 minutos.
2. **Medium.**Instalar`faster-whisper`, transcribir un podcast de 10 minutos, comparar WER con una transcripción humana.`language="auto"`contra forzado `language="en"`¿ Qué ?
3. **Hard.**El uso de HF `datasets`, elegir un idioma con el que Whisper lucha (por ejemplo, Urdu), ajustar mediano con LoRA durante 2 épocas en 2 horas, y informar WER delta.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| 30-sec window | Whisper's limit | Hard input cap; chunk longer audio. |
| SOT | Start-of-transcript | `<\|startoftranscript\|>` kicks off the decoder prompt. |
| Timestamps token | Temporal alignment | Every 0.02 s offset is a special token in the 51k vocab. |
| Turbo | The fast variant | 4-decoder layers, 8× faster, <1% WER regression. |
| WhisperX | The long-form wrapper | VAD + Whisper + wav2vec alignment + diarization. |
| LoRA fine-tune | Efficient tuning | Add low-rank adapters to attention; train ~0.3% of params. |
| Hallucination | The silent failure | Whisper produces fluent English from noise/silence. |

## Leer más

- [Radford et al. (2022). Whisper paper](https://arxiv.org/abs/2212.04356) la arquitectura original y la receta de formación.
- [OpenAI (2024). Whisper Large-v3-turbo release](https://github.com/openai/whisper/discussions/2363)- Decodificador de 4 capas, acelerador de 8 veces.
- [Bain et al. (2023). WhisperX](https://arxiv.org/abs/2303.00747)- de forma larga, alineada con las palabras, diarializada.
- [Systran — faster-whisper repo](https://github.com/SYSTRAN/faster-whisper) CTranslate2 respaldado, 4x más rápido.
- [HuggingFace — Whisper fine-tune tutorial](https://huggingface.co/blog/fine-tune-whisper) canónica LoRA / Full-FT de paso.
