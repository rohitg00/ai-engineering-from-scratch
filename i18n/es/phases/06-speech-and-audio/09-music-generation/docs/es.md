# Generación de música  MusicGen, Audio estable, Suno y el terremoto de licencia

> 2026 generación de música: Suno v5 y Udio v4 dominan comercial; MusicGen, Stable Audio Open y ACE-Step lideran el código abierto. El problema técnico se resuelve en su mayoría. El problema legal (Warner Music $ 500M acuerdo, UMG acuerdo) remodela el campo en 2025-2026.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms), Phase 4 · 10 (Diffusion Models)
**Time:** ~75 minutes

## El problema

Text → un clip musical de 30 segundos a 4 minutos, con letras, voces y estructura.

1. **Instrumental generation.**Texto como "batería de hip-hop lo-fi con teclas calientes" → audio. MusicGen, Audio Stable, AudioLDM.
2. **Song generation (with vocals + lyrics).**"Canción country sobre las noches lluviosas de Texas" → canción completa.
3. **Conditional / controllable.**Extender un clip existente, regenerar un puente, cambiar género, separar el tallo o pintar.

## El concepto

![Music generation: token-LM vs diffusion, the 2026 model map](../assets/music-generation.svg)

### Token LM sobre los tokens de codec neuronal

Meta's **MusicGen**(2023, MIT) y muchos derivados: condición en las incorporaciones de texto/melodía, predecir autoregresivamente tokens EnCodec (32 kHz, 4 libros de código), decodificar con EnCodec. 300M - 3.3B parámetros.

**ACE-Step**(open source, 4B XL lanzado en abril de 2026) extiende esto a la generación de canciones completas con letra.

### Difusión sobre fundimientos o latencias

**Stable Audio (2023)**y **Stable Audio Open (2024)**La difusión latente en audio comprimido. Excelente en circuitos, diseño de sonido, texturas ambientales. No es excelente en canciones completas estructuradas.

**AudioLDM / AudioLDM2**: texto a audio a través de la difusión latente de estilo T2I, generalizada a la música, efectos sonoros, habla.

### Hybrid (producción)  Suno, Udio, Lyria

Peso cerrado. Probablemente un códec AR LM + vocoder basado en difusión con cabezas de voz / batería / melodía especializadas. Suno v5 (2026) es el líder de calidad de ELO 1293. Udio v4 añade inpainting + separación de tronco (bajo, batería, vocales descargas separadas).

### Evaluación

- **FAD (Fréchet Audio Distance).**Distancia de nivel de incorporación entre la distribución de audio generada y la real utilizando funciones VGGish o PANNs. Más bajo es mejor. MusicGen pequeño: 4.5 FAD en MusicCaps; SOTA ~ 3.0.
- **Musicality (subjective).**La preferencia humana. Suno v5 ELO 1293 conduce.
- **Text-audio alignment.**CLAP puntaje entre la respuesta y la salida.
- **Musicality artifacts.**Transiciones fuera de ritmo, deriva de la frase vocal, pérdida de estructura después de 30 segundos.

## Mapa modelo 2026

| Model | Params | Length | Vocals | License |
|-------|--------|--------|--------|---------|
| MusicGen-large | 3.3B | 30 s | no | MIT |
| Stable Audio Open | 1.2B | 47 s | no | Stability non-commercial |
| ACE-Step XL (Apr 2026) | 4B | &gt; 2 min | yes | Apache-2.0 |
| YuE | 7B | &gt; 2 min | yes, multilingual | Apache-2.0 |
| Suno v5 (closed) | ? | 4 min | yes, ELO 1293 | commercial |
| Udio v4 (closed) | ? | 4 min | yes + stems | commercial |
| Google Lyria 3 (closed) | ? | real-time | yes | commercial |
| MiniMax Music 2.5 | ? | 4 min | yes | commercial API |

## El panorama legal (2025-2026)

- **Warner Music vs Suno settlement.**$500M. WMG ahora tiene supervisión de la similitud de IA, derechos de música y pistas generadas por el usuario en Suno.
- **EU AI Act**¿ Qué es eso ?**California SB 942**: La música generada por IA debe ser revelada.
- **Riffusion / MusicGen**En el MIT no tienen equipaje de cumplimiento pero tampoco voces comerciales.

Modelos de seguridad para el buque:

1. Generar sólo instrumental (MusicGen, Stable Audio Open, MIT/CC0 salidas).
2. Utilice APIs comerciales (Suno, Udio, ElevenLabs Music) con licencia por generación.
3. El tren en catálogo de propiedad o con licencia (la mayoría de las empresas terminan aquí).
4. Etiquetar generaciones con marcas de agua + metadatos.

```figure
sp-codec-tokens
```

## Construye el mismo

### Paso 1: genera con MusicGen

```python
from audiocraft.models import MusicGen
import torchaudio

model = MusicGen.get_pretrained("facebook/musicgen-small")
model.set_generation_params(duration=10)
wav = model.generate(["upbeat synthwave with driving drums, 128 BPM"])
torchaudio.save("out.wav", wav[0].cpu(), 32000)
```

Tres tamaños: `small`(300M, rápido),`medium`(1.5B), `large`(3.3B) Lo pequeño es suficiente para "hace que la idea aterrice".

### Paso 2: Condicionamiento de la melodía

```python
melody, sr = torchaudio.load("humming.wav")
wav = model.generate_with_chroma(
    ["jazz piano cover"],
    melody.squeeze(),
    sr,
)
```

MusicGen-melody toma un cromagrama y conserva la melodía mientras cambia de timbre.

### Paso 3: Evaluación del FAD

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()

fad.get_fad_score("generated_folder/", "reference_folder/")
```

Computa distancia de incorporación VGGish. Útil para pruebas de regresión a nivel de género; no es un sustituto para los oyentes humanos.

### Paso 4: añadir al flujo de trabajo de LLM-música

Combina con las ideas de las lecciones 7-8:

```python
prompt = "Write a 30-second jazz loop. Describe the drums, bass, and piano voicing."
description = llm.complete(prompt)
music = musicgen.generate([description], duration=30)
```

## Usalo

| Goal | Stack |
|------|-------|
| Instrumental sound design | Stable Audio Open |
| Game / adaptive music | Google Lyria RealTime (closed) |
| Full songs with vocals (commercial) | Suno v5 or Udio v4 with explicit license |
| Full songs with vocals (open) | ACE-Step XL or YuE |
| Short ad jingle | MusicGen melody-conditioned on a hummed reference |
| Music-video background | MusicGen + Stable Video Diffusion |

## Las trampas que todavía se envían en 2026

- **Copyright-laundering prompts.**"Cantando al estilo de Taylor Swift"  comercial Suno / Audio filtro estos ahora, modelos abiertos no. Agregue su propia lista de filtros.
- **Repetition / drift past 30 s.**Modelos de AR en bucle. Crossfade múltiples generaciones, o usar ACE-Step para la coherencia estructural.
- **Tempo drift.**Los modelos se alejan del BPM. Utilice las etiquetas BPM en el prompt y post-filter con librosa's `beat_track`¿ Qué ?
- **Vocal intelligibility.**El Suno es excelente; los modelos abiertos a menudo son suaves en palabras.
- **Mono output.**Los modelos abiertos generan estereo mono o falso.

## Envío

Salvo como`outputs/skill-music-designer.md`. Seleccionar el modelo, la estrategia de licencia, el plan de longitud / estructura y los metadatos de divulgación para una implementación de la generación musical.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`Produce una progresión de acordes "generacional" + patrón de tambor como símbolos ASCII  una caricatura de la generación musical.
2. **Medium.**Instalar`audiocraft`, generar clips de 10 segundos en 4 generaciones con MusicGen-small, medir FAD contra un conjunto de géneros de referencia.
3. **Hard.**Utilizando ACE-Step (o MusicGen-melody), genera tres variaciones de la misma melodía con diferentes instrucciones de timbre.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| FAD | Audio FID | Fréchet distance between embedding distributions of real vs generated. |
| Chromagram | Melody as pitches | 12-dim per-frame vector; input to melody conditioning. |
| Stems | Instrument tracks | Separated bass / drums / vocals / melody as WAV. |
| Inpainting | Regen a section | Mask a time window; model regenerates just that. |
| CLAP | Text-audio CLIP | Contrastive audio-text embedding; eval text-audio alignment. |
| EnCodec | Music codec | Meta's neural codec used by MusicGen; 32 kHz, 4 codebooks. |

## Leer más

- [Copet et al. (2023). MusicGen](https://arxiv.org/abs/2306.05284) el índice de referencia autorregresor abierto.
- [Evans et al. (2024). Stable Audio Open](https://arxiv.org/abs/2407.14358) el diseño de sonido por defecto.
- [ACE-Step](https://github.com/ace-step/ACE-Step) generador de 4B de canciones completas abierto, abril 2026.
- [Suno v5 platform docs](https://suno.com) el líder en calidad comercial.
- [AudioLDM2](https://arxiv.org/abs/2308.05734) difusión latente para la música + efectos sonoros.
- [WMG-Suno settlement coverage](https://www.musicbusinessworldwide.com/warner-music-group-settles-with-suno-strikes-first-of-its-kind-deal-with-ai-song-generator/) Novembre 2025 precedente.
