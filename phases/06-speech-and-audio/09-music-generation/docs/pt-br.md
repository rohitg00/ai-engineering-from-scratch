# Geração de Música — MusicGen, Stable Audio, Suno e o Terremoto da Licenciamento

> Geração de música em 2026: Suno v5 e Udio v4 dominam o comercial; MusicGen, Stable Audio Open e ACE-Step lideram o open-source. O problema técnico está quase resolvido. O problema jurídico (acordo Warner Music de $500M, acordo UMG) remodelou o campo em 2025-2026.

**Tipo:** Construir
**Idiomas:** Python
**Pré-requisitos:** Fase 6 · 02 (Eespecificaçãotrogramas), Fase 4 · 10 (Modelos de Diffusão)
**Tempo:** ~75 minutos

## O Problema

Texto → clipe de música de 30 segundos a 4 minutos, com letras, vocais e estrutura. Três subproblemas:

1. **Geração instrumental.** Texto como "bateria lo-fi hip-hop com teclas quentes" → áudio. MusicGen, Stable Audio, AudioLDM.
2. **Geração de música (com vocais + letras).** "Música country sobre noites chuvosas no Texas" → música completa. Suno, Udio, YuE, ACE-Step.
3. **Condicional / controlável.** Estender um clipe existente, regenerar uma ponte, trocar gênero, separar stems, ou inpainting. O inpainting + separação de stems do Udio é a funcionalidade a bater em 2026.

## O Conceito

![Geração de música: token-LM vs diffusão, o mapa de modelos de 2026](../assets/music-generation.svg)

### Token LM sobre tokens de codec neural

**MusicGen** da Meta (2023, MIT) e muitos derivados: condiciona em embeddings de texto/melodia, prevê autoregressivamente tokens EnCodec (32 kHz, 4 codebooks), decodifica com EnCodec. 300M - 3,3B params. Baseline forte; dificuldade passa de 30 segundos.

**ACE-Step** (open-source, 4B XL lançado abril de 2026) estende isso para geração de música inteira condicionada a letras. A coisa mais próxima que a comunidade open tem do Suno.

### Diffusão sobre mels ou latentes

**Stable Audio (2023)** e **Stable Audio Open (2024)**: diffusão latente em áudio comprimido. Excelente em loops, design de som, texturas ambientais. Não tão bom em músicas estruturadas completas.

**AudioLDM / AudioLDM2**: texto-para-áudio via diffusão latente estilo T2I, generalizado para música, efeitos sonoros, fala.

### Híbrido (produção) — Suno, Udio, Lyria

Pesos fechados. Provavelmente codec LM AR + vocoder baseado em diffusão com heads eespecificaçãoializados de voz/bateria/melodia. Suno v5 (2026) é o líder de qualidade ELO 1293. Udio v4 adiciona inpainting + separação de stems (baixo, bateria, vocals downloads separados).

### Avaliação

- **FAD (Fréchet Audio Distance).** Distância no nível de embedding entre distribuições de áudio gerado vs real usando características VGGish ou PANNs. Menor é melhor. MusicGen small: 4,5 FAD no MusicCaps; SOTA ~3,0.
- **Musicalidade (subjetiva).** Preferência humana. Suno v5 ELO 1293 lidera.
- **Alinhamento texto-áudio.** Escore CLAP entre prompt e saída.
- **Artefatos musicais.** Transições fora do compasso, deriva de frase vocal, perda de estrutura passa de 30 s.

## Mapa de modelos 2026

| Modelo | Params | Comprimento | Vocais | Licença |
|--------|--------|-------------|--------|---------|
| MusicGen-large | 3,3B | 30 s | não | MIT |
| Stable Audio Open | 1,2B | 47 s | não | Stability não-comercial |
| ACE-Step XL (Abr 2026) | 4B | > 2 min | sim | Apache-2.0 |
| YuE | 7B | > 2 min | sim, multilíngue | Apache-2.0 |
| Suno v5 (fechado) | ? | 4 min | sim, ELO 1293 | comercial |
| Udio v4 (fechado) | ? | 4 min | sim + stems | comercial |
| Google Lyria 3 (fechado) | ? | tempo real | sim | comercial |
| MiniMax Music 2.5 | ? | 4 min | sim | API comercial |

## A paisagem jurídica (2025-2026)

- **Acordo Warner Music vs Suno.** $500M. WMG agora supervisiona similaridade de IA, direitos musicais e faixas geradas por usuários no Suno. Acordo similar da UMG no Udio.
- **AI Act da UE** + **California SB 942**: música gerada por IA deve ser divulgada.
- **Riffusion / MusicGen** sob MIT não têm ônus de conformidade mas também não têm vocais comerciais.

Padrões seguros para deploy:

1. Gerar apenas instrumental (MusicGen, Stable Audio Open, saídas MIT/CC0).
2. Usar APIs comerciais (Suno, Udio, ElevenLabs Music) com licença por geração.
3. Treinar em catálogo próprio ou licenciado (a maioria das empresas chega aqui).
4. Marcar gerações com marcas d'água + metadados.

## Construa

### Passo 1: gere com MusicGen

```python
from audiocraft.models import MusicGen
import torchaudio

model = MusicGen.get_pretrained("facebook/musicgen-small")
model.set_generation_params(duration=10)
wav = model.generate(["upbeat synthwave with driving drums, 128 BPM"])
torchaudio.save("out.wav", wav[0].cpu(), 32000)
```

Três tamanhos: `small` (300M, rápido), `medium` (1,5B), `large` (3,3B). Small é suficiente para "a ideia funciona".

### Passo 2: condicionamento de melodia

```python
melody, sr = torchaudio.load("humming.wav")
wav = model.generate_with_chroma(
    ["jazz piano cover"],
    melody.squeeze(),
    sr,
)
```

MusicGen-melody recebe uma cromagrama e preserva a melodia trocando timbre. Útil para "me dê essa melodia como quarteto de cordas".

### Passo 3: avaliação FAD

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()
fad.get_fad_score("generated_folder/", "reference_folder/")
```

Computa distância de embedding VGGish. Útil para testes de regressão no nível de gênero; não substitui ouvintes humanos.

### Passo 4: adicionar ao workflow LLM-música

```python
prompt = "Write a 30-second jazz loop. Describe the drums, bass, and piano voicing."
description = llm.complete(prompt)
music = musicgen.generate([description], duration=30)
```

## Use

| Objetivo | Pilha |
|----------|-------|
| Design de som instrumental | Stable Audio Open |
| Música adaptativa para jogos | Google Lyria RealTime (fechado) |
| Músicas completas com vocais (comercial) | Suno v5 ou Udio v4 com licença explícita |
| Músicas completas com vocais (open) | ACE-Step XL ou YuE |
| Jingle curto de propaganda | MusicGen condicionado a melodia de referência cantada |
| Fundo de clipe musical | MusicGen + Stable Video Diffusion |

## Armadilhas que ainda aparecem em 2026

- **Prompts de lavagem de direitos autorais.** "Música no estilo de Taylor Swift" — Suno/Udio comercial filtram isso agora, modelos open não. Adicione sua própria lista de filtros.
- **Repetição / deriva passa de 30 s.** Modelos AR entram em loop. Crossfade múltiplas gerações, ou use ACE-Step para coerência estrutural.
- **Deriva de tempo.** Modelos saem do BPM. Use tags de BPM no prompt e pós-filtre com `beat_track` do librosa.
- **Inteligibilidade vocal.** Suno é excelente; modelos open frequentemente são confusos nas palavras. Se letras importam, use API comercial ou ajuste fino.
- **Saída mono.** Modelos open geram mono ou falso-stereo. Melhore com reconstrução stereo adequada (ezst, diffusão stereo da Cartesia).

## Entregue

Salve como `outputs/skill-music-designer.md`. Escolha modelo, estratégia de licença, plano de comprimento/estrutura e metadados de divulgação para uma implantação de geração musical.

## Exercícios

1. **Fácil.** Execute `code/main.py`. Produz uma progressão de acordes + padrão de bateria "generativo" como símbolos ASCII — um cartoon de music-gen. Toque com qualquer renderizador MIDI se quiser.
2. **Médio.** Instale `audiocraft`, gere clips de 10 segundos em 4 prompts de gênero com MusicGen-small, meça FAD contra um conjunto de referência do gênero.
3. **Difícil.** Usando ACE-Step (ou MusicGen-melody), gere três variações da mesma melodia com prompts de timbre diferentes. Compute similaridade CLAP com o prompt para verificar alinhamento.

## Termos Chave

| Termo | O que a gente diz | O que significa de verdade |
|-------|-------------------|---------------------------|
| FAD | FID de áudio | Distância Fréchet entre distribuições de embedding de real vs gerado. |
| Cromagrama | Melodia como notas | Vetor por-frame de 12 dimensões; input para condicionamento de melodia. |
| Stems | Faixas de instrumentos | Bateria / bateria / vocais / melodia separados como WAV. |
| Inpainting | Regen de uma seção | Mascarar uma janela temporal; modelo regenera apenas aquela. |
| CLAP | CLIP texto-áudio | Embedding áudio-texto contrastivo; avalia alinhamento texto-áudio. |
| EnCodec | Codec de música | Codec neural da Meta usado pelo MusicGen; 32 kHz, 4 codebooks. |

## Leitura Adicional

- [Copet et al. (2023). MusicGen](https://arxiv.org/abs/2306.05284) — o benchmark autoregressivo open.
- [Evans et al. (2024). Stable Audio Open](https://arxiv.org/abs/2407.14358) — o padrão de design de som.
- [ACE-Step](https://github.com/ace-step/ACE-Step) — gerador open 4B de música completa, abril de 2026.
- [Docs da plataforma Suno v5](https://suno.com) — o líder de qualidade comercial.
- [AudioLDM2](https://arxiv.org/abs/2308.05734) — diffusão latente para música + efeitos sonoros.
- [Cobertura do acordo WMG-Suno](https://www.musicbusinessworldwide.com/suno-warner-music-settlement/) — precedente de novembro de 2025.
