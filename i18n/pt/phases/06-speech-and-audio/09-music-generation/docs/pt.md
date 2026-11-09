# Geração de Música  Geração de Música, Áudio estável, Suno e o Terremoto de Licença

> A geração musical de 2026: Suno v5 e Udio v4 dominam os comerciais; MusicGen, Stable Audio Open e ACE-Step lideram o código aberto. O problema técnico é principalmente resolvido. O problema legal (Warner Music $ 500M acordo, UMG acordo) remodelaram o campo em 2025-2026.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms), Phase 4 · 10 (Diffusion Models)
**Time:** ~75 minutes

## O problema

Texto → um clipe musical de 30 segundos a 4 minutos, com letras, vocais e estrutura.

1. **Instrumental generation.**Texto como "bateria de hip-hop de lo-fi com teclas quentes" → áudio. MusicGen, Stable Audio, AudioLDM.
2. **Song generation (with vocals + lyrics).**"Canção country sobre noites chuvosas no Texas" → canção completa.
3. **Conditional / controllable.**Extender um clip existente, regenerar uma ponte, trocar gênero, separar-estampado ou inpaint.

## O conceito

![Music generation: token-LM vs diffusion, the 2026 model map](../assets/music-generation.svg)

### Token LM em relação a tokens neurais-codec

Meta's **MusicGen**(2023, MIT) e muitos derivados: condição em embutidos de texto/melodia, prevê autoregressivamente tokens EnCodec (32 kHz, 4 codebooks), decodifica com EnCodec. Parâmetros 300M - 3.3B. Base forte; luta além de 30 segundos.

**ACE-Step**(open source, 4B XL lançado em abril de 2026) estende isso para geração completa de letras.

### Diffusão sobre fusões ou latentes

**Stable Audio (2023)**E ...**Stable Audio Open (2024)**É excelente em circuitos, design de som, texturas ambientais, não é ótimo em músicas estruturadas.

**AudioLDM / AudioLDM2**A comunicação de texto a áudio através de difusão latente de estilo T2I, generalizada para música, efeitos sonoros, fala.

### Híbrido (produção)  Suno, Udio, Lyria

Pesos fechados. Provavelmente, o vocalista baseado em difusão com um codec AR LM + com cabeças de voz / tambor / melodia especializadas. Suno v5 (2026) é o líder de qualidade do ELO 1293.

### Avaliação

- **FAD (Fréchet Audio Distance).**Distância de nível de incorporação entre a distribuição de áudio gerada versus real usando recursos VGGish ou PANNs. Baixo é melhor. MusicGen pequeno: 4.5 FAD em MusicCaps; SOTA ~ 3.0.
- **Musicality (subjective).**Preferência humana. Suno v5 ELO 1293 leva.
- **Text-audio alignment.**CLAP pontuação entre o prompt e saída.
- **Musicality artifacts.**Transições fora do ritmo, deriva vocal, perda de estrutura depois de 30 segundos.

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

## O cenário jurídico (2025-2026)

- **Warner Music vs Suno settlement.**$500 milhões. A WMG agora tem supervisão da semelhança com a IA, direitos de música e faixas geradas pelo usuário no Suno.
- **EU AI Act**+ **California SB 942**A música gerada pela IA deve ser divulgada.
- **Riffusion / MusicGen**Não há nenhuma equipa de conformidade no MIT, mas também não há vocais comerciais.

Padrões de segurança para embarque:

1. Gerenar apenas instrumentos (MusicGen, Stable Audio Open, MIT/CC0 de saída).
2. Use APIs comerciais (Suno, Udio, ElevenLabs Music) com licença por geração.
3. Trem em catálogo de propriedade ou licenciado (a maioria das empresas acaba aqui).
4. Tag gerações com marcas de água + metadados.

```figure
sp-codec-tokens
```

## Construí-lo

### Passo 1: gerar com MusicGen

```python
from audiocraft.models import MusicGen
import torchaudio

model = MusicGen.get_pretrained("facebook/musicgen-small")
model.set_generation_params(duration=10)
wav = model.generate(["upbeat synthwave with driving drums, 128 BPM"])
torchaudio.save("out.wav", wav[0].cpu(), 32000)
```

Três tamanhos: `small`(300M, rápido),`medium`(1.5B), `large`(3.3B) O pequeno é suficiente para "fazer aterrar a ideia".

### Passo 2: Condicionamento da melodia

```python
melody, sr = torchaudio.load("humming.wav")
wav = model.generate_with_chroma(
    ["jazz piano cover"],
    melody.squeeze(),
    sr,
)
```

MusicGen-melody toma um cromagrama e preserva a melodia enquanto troca timbre. Útil para "dar-me essa melodia como um quarteto de cordas".

### Passo 3: Avaliação do FAD

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()

fad.get_fad_score("generated_folder/", "reference_folder/")
```

Computa distância de inserção VGGish. Útil para testes de regressão de nível de gênero; não substitui os ouvintes humanos.

### Passo 4: adição ao fluxo de trabalho de Mestrado em Música

Combine com as ideias das lições 7-8:

```python
prompt = "Write a 30-second jazz loop. Describe the drums, bass, and piano voicing."
description = llm.complete(prompt)
music = musicgen.generate([description], duration=30)
```

## Usá-lo

| Goal | Stack |
|------|-------|
| Instrumental sound design | Stable Audio Open |
| Game / adaptive music | Google Lyria RealTime (closed) |
| Full songs with vocals (commercial) | Suno v5 or Udio v4 with explicit license |
| Full songs with vocals (open) | ACE-Step XL or YuE |
| Short ad jingle | MusicGen melody-conditioned on a hummed reference |
| Music-video background | MusicGen + Stable Video Diffusion |

## Encurralagens que ainda se lançam em 2026

- **Copyright-laundering prompts.**"Canção no estilo de Taylor Swift"  comercial Suno / Áudio filtro estes agora, modelos abertos não. Adicionar sua própria lista de filtros.
- **Repetition / drift past 30 s.**Modelos AR circuito. Crossfade múltiplas gerações, ou usar ACE-Step para a coerência estrutural.
- **Tempo drift.**Os modelos desviam-se do BPM. Use as etiquetas BPM no prompt e pós-filtro com librosa's `beat_track`- Não .
- **Vocal intelligibility.**O Suno é excelente; os modelos abertos são muitas vezes fracos em palavras.
- **Mono output.**Os modelos abertos geram mono ou falso estereo.

## Envia-o

Salva como`outputs/skill-music-designer.md`. Selecionar modelo, estratégia de licença, plano de comprimento / estrutura e divulgação de metadados para uma implantação de geração musical.

## Exercícios

1. **Easy.**Corra .`code/main.py`Ele produz uma progressão de acordes "generacional" + padrão de tambor como símbolos ASCII  um desenho animado de geração musical.
2. **Medium.**Instalação`audiocraft`, gerar clips de 10 segundos em 4 conjuntos de gêneros com MusicGen-small, medir FAD contra um conjunto de gêneros de referência.
3. **Hard.**Usando o ACE-Step (ou MusicGen-melody), gerar três variações da mesma melodia com diferentes pedidos de timbre.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| FAD | Audio FID | Fréchet distance between embedding distributions of real vs generated. |
| Chromagram | Melody as pitches | 12-dim per-frame vector; input to melody conditioning. |
| Stems | Instrument tracks | Separated bass / drums / vocals / melody as WAV. |
| Inpainting | Regen a section | Mask a time window; model regenerates just that. |
| CLAP | Text-audio CLIP | Contrastive audio-text embedding; eval text-audio alignment. |
| EnCodec | Music codec | Meta's neural codec used by MusicGen; 32 kHz, 4 codebooks. |

## Mais leitura

- [Copet et al. (2023). MusicGen](https://arxiv.org/abs/2306.05284) o índice de referência autoregressivo aberto.
- [Evans et al. (2024). Stable Audio Open](https://arxiv.org/abs/2407.14358) o design de som padrão.
- [ACE-Step](https://github.com/ace-step/ACE-Step)- Gerador de música completa 4B, abril de 2026.
- [Suno v5 platform docs](https://suno.com) o líder da qualidade comercial.
- [AudioLDM2](https://arxiv.org/abs/2308.05734) difusão latente para música + efeitos sonoros.
- [WMG-Suno settlement coverage](https://www.musicbusinessworldwide.com/warner-music-group-settles-with-suno-strikes-first-of-its-kind-deal-with-ai-song-generator/) Novembro 2025 precedente.
