# Modelos de audio-idioma  Qwen2.5-Omni, Audio Flamingo, GPT-4o Audio

> Los modelos de audio-idioma 2026 razonan sobre el habla + sonido ambiental + música. Qwen2.5-Omni-7B coincide con GPT-4o Audio en MMAU-Pro. Audio Flamingo Next supera a Gemini 2.5 Pro en LongAudioBench. La brecha entre abierto y cerrado es esencialmente cerrada  excepto en tareas de audio múltiples, donde todos son casi aleatorios.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04 (ASR), Phase 12 · 03 (Vision-Language Models), Phase 7 · 10 (Audio Transformers)
**Time:** ~45 minutes

## El problema

Hay 5 segundos de audio: ladrones de perros, alguien grita "¡para!", luego silencio.

- **Transcription.**"Qué se dijo?"  Territorio de la RAS.
- **Semantic reasoning.**"¿Está la persona en peligro?"  requiere un entendimiento conjunto del ladrido + grito + silencio.
- **Music reasoning.**"¿Qué instrumentos tocan la melodía?"
- **Long-audio retrieval.**"¿Dónde en esta conferencia de 90 minutos explicó el instructor la descensos de gradientes?"

Un modelo único que responde a todos estos con un solo aviso es un **audio-language model**Separado de la ASR pura: los LALM producen respuestas de forma libre en lenguaje natural, no sólo transcripciones.

## El concepto

![Audio-language model: audio encoder + projector + LLM decoder](../assets/alm-architecture.svg)

### La plantilla de tres componentes

Cada 2026 LALM tiene el mismo esqueleto:

1. **Audio encoder.**Encodrador de susurros · BEATs · CLAP · WavLM · o un codificador personalizado por modelo.
2. **Projector.**Las funciones de audio-encoder de puente lineal o MLP en el espacio de incorporación de tokens del LLM.
3. **LLM.**Descriptor basado en Llama / Qwen / Gemma. Toma texto entrelazado + tokens de audio; genera texto.

Formación:

- **Stage 1.**Encoder de congelación + LLM; proyector de tren sólo en datos de ASR / subtítulos.
- **Stage 2.**La perfección de la función de audio (QA, razonamiento, comprensión de la música) que sigue las instrucciones.
- **Stage 3 (optional).**El Voice-in / voice-out añade un decodificador de voz. Qwen2.5-Omni y AF3-Chat hacen esto.

### El mapa modelo de 2026

| Model | Backbone | Audio encoder | Output modality | Access |
|-------|----------|---------------|-----------------|--------|
| Qwen2.5-Omni-7B | Qwen2.5-7B | Custom + Whisper | text + speech | Apache-2.0 |
| Qwen3-Omni | Qwen3 | Custom | text + speech | Apache-2.0 |
| Audio Flamingo 3 | Qwen2 | AF-CLAP | text | NVIDIA non-commercial |
| Audio Flamingo Next | Qwen2 | AF-CLAP v2 | text | NVIDIA non-commercial |
| SALMONN | Vicuna | Whisper + BEATs | text | Apache-2.0 |
| LTU / LTU-AS | Llama | CAV-MAE | text | Apache-2.0 |
| GAMA | Llama | AST + Q-Former | text | Apache-2.0 |
| Gemini 2.5 Flash/Pro (closed) | Gemini | proprietary | text + speech | API |
| GPT-4o Audio (closed) | GPT-4o | proprietary | text + speech | API |

### Verificación de realidad de referencia (2026)

**MMAU-Pro.**1800 pares de calidad que cubren voz / sonido / música / mezclado.

| Model | Overall | Speech | Sound | Music | Multi-audio |
|-------|---------|--------|-------|-------|-------------|
| Gemini 2.5 Pro | ~60% | 73.4% | 51.9% | 64.9% | ~22% |
| Gemini 2.5 Flash | ~57% | 73.4% | 50.5% | 64.9% | 21.2% |
| GPT-4o Audio | 52.5% | — | — | — | 26.5% |
| Qwen2.5-Omni-7B | 52.2% | 57.4% | 47.6% | 61.5% | ~20% |
| Audio Flamingo 3 | ~54% | — | — | — | — |
| Audio Flamingo Next | SOTA on LongAudioBench | — | — | — | — |

El **multi-audio column is damning for everyone.**La probabilidad aleatoria en la opción de 4 opciones = 25%; la mayoría de los modelos obtienen un puntaje alrededor de ahí.

### Donde los LALM son útiles en 2026

- **Compliance audit of call-center recordings.**"¿El agente mencionó la divulgación requerida?"
- **Accessibility.**Describa los eventos sonoros a los usuarios sordos (no sólo la transcripción).
- **Content moderation.**Detectar lenguaje violento + tono amenazante + contexto de fondo.
- **Podcast / meeting chaptering.**Resumen semántico, no sólo los giros del orador.
- **Music catalog analysis.**"Encuentra todas las pistas con un cambio de llave de sección B".

### Cuando no son (todavía) útiles

- Teoría de la música de granos finos (por debajo del nivel de acordes).
- Razonamiento atribuido por el orador durante largas conversaciones (grados pasados 10 minutos).
- Comparación de audio múltiple (22-26% es apenas más que aleatorio).
- Razonamiento en tiempo real de transmisión (la mayoría son inferencias de lotes fuera de línea).

```figure
v4-alm-tokens
```

## Construye el mismo

### Paso 1: consulta Qwen2.5-Omni

```python
from transformers import AutoModelForCausalLM, AutoProcessor

processor = AutoProcessor.from_pretrained("Qwen/Qwen2.5-Omni-7B")
model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen2.5-Omni-7B", torch_dtype="auto")

audio, sr = load_wav("clip.wav", sr=16000)
messages = [{
    "role": "user",
    "content": [
        {"type": "audio", "audio": audio},
        {"type": "text", "text": "What sounds do you hear, and what's happening?"},
    ],
}]
inputs = processor.apply_chat_template(messages, tokenize=True, return_tensors="pt")
output = model.generate(**inputs, max_new_tokens=200)
print(processor.decode(output[0], skip_special_tokens=True))
```

### Paso 2: el patrón del proyector

```python
import torch.nn as nn

class AudioProjector(nn.Module):
    def __init__(self, audio_dim=1280, llm_dim=4096):
        super().__init__()
        self.down = nn.Linear(audio_dim, llm_dim)
        self.act = nn.GELU()
        self.up = nn.Linear(llm_dim, llm_dim)

    def forward(self, audio_features):
        return self.up(self.act(self.down(audio_features)))
```

El proyector es generalmente de 1-3 capas lineales. Entrenarlo en pares ASR (audio → transcripción) es la tarea de pretexto de la etapa 1.

### Paso 3: evaluación comparativa de MMAU / LongAudioBench

```python
from datasets import load_dataset
mmau = load_dataset("gamma-lab-umd/MMAU-Pro", split="test")
mcq = mmau.filter(lambda item: len(item["choices"] or []) > 1)

correct = 0
for item in mcq:
    answer = call_model(item["audio_path"], item["question"], item["choices"])
    if answer == item["answer"]:
        correct += 1
print(f"Accuracy: {correct / len(mcq):.3f}")
```

`audio_path`Puntos en los repositorios del conjunto de datos `data.zip`(alrededor de 47 GB), así que descarga y descifre antes de marcar. Este ciclo de coincidencia exacta es un control de cordura, no el punteador de referencia, por lo que su número no es comparable con los resultados publicados de MMAU-Pro. El evaluador oficial coincide con las respuestas de múltiples opciones mediante la incorporación de similitudes (NV-Embed-v2), califica las respuestas de límite abierto con un juez de LLM y verifica las respuestas que siguen las instrucciones con regex reglas: escriba predicciones a un `model_output`columna y ejecutar `evaluate_mmau_pro_comprehensive.py`de la [MMAU-Pro repo](https://github.com/sonalkum/MMAUPro)- Informar cada uno .`category`Los números agregados se esconden donde el modelo falla.

## Usalo

| Task | 2026 pick |
|------|-----------|
| Free-form audio QA (open) | Qwen2.5-Omni-7B |
| Best open on long audio | Audio Flamingo Next |
| Best closed | Gemini 2.5 Pro |
| Voice-in / voice-out agent | Qwen2.5-Omni or GPT-4o Audio |
| Music reasoning | Audio Flamingo 3 or 2 (music-specialized AF-CLAP) |
| Call-center audit | Gemini 2.5 Pro via API, with RAG over your policy docs |

## Las trampas

- **Over-trust on multi-audio.**Si su tarea necesita "cuál clip tiene X", el rendimiento al azar es real.
- **Long-audio degradation.**Después de 10 minutos, la mayoría de los modelos rompen la atribución de altavoces.
- **Hallucinations on silence.**El mismo problema de estilo Whisper heredado por los LALM que usan el codificador Whisper.
- **Benchmark cherry-picking.**Las publicaciones de los vendedores en el blog destacan las categorías de mejor caso. ejecutar el subconjunto multi-audio MMAU-Pro usted mismo.

## Envío

Salvo como`outputs/skill-alm-picker.md`. Seleccione LALM + subconjunto de referencia + modalidad de salida (texto vs habla) para una tarea de comprensión de audio dada.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`para ver un patrón de proyector de juguete + falso enrutamiento LALM de (audio-embedado, tokens de texto) → tokens de salida.
2. **Medium.**Ponte Qwen2.5-Omni-7B en 100 artículos de habla MMAU-Pro. Comparar con el número reportado del periódico.
3. **Hard.**Construir una línea de base de audio de capción mínima: BEATs codificador + proyector de 2 capas + congelado Llama-3.2-1B. Fine-tune sólo el proyector en AudioCaps. Comparar con SALMONN en Clotho-AQA.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| LALM | Audio ChatGPT | Audio encoder + projector + LLM decoder. |
| Projector | Adapter | Small MLP mapping audio features into LLM embedding space. |
| MMAU | The benchmark | 10k audio-QA pairs across speech, sound, music. |
| MMAU-Pro | Harder MMAU | 1800 multi-audio / reasoning-heavy questions. |
| LongAudioBench | Long-form eval | Multi-minute clips with semantic queries. |
| Voice-in / voice-out | Speech-native | Model ingests speech and emits speech without text detour. |

## Leer más

- [Chu et al. (2024). Qwen2-Audio](https://arxiv.org/abs/2407.10759) arquitectura de referencia.
- [Alibaba (2025). Qwen2.5-Omni](https://huggingface.co/Qwen/Qwen2.5-Omni-7B) hablar en hablar.
- [NVIDIA (2025). Audio Flamingo 3](https://arxiv.org/abs/2507.08128) el líder de audio largo abierto.
- [NVIDIA (2026). Audio Flamingo Next](https://arxiv.org/abs/2604.10905) LongAudioBench SOTA.
- [Tang et al. (2023). SALMONN](https://arxiv.org/abs/2310.13289)Pionero en el doble codificación.
- [MMAU-Pro leaderboard](https://sonalkum.github.io/mmau-pro/) ranking en vivo de 2026.
