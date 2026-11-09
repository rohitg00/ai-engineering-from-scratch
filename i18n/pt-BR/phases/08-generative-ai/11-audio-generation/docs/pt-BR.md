# Geração de áudio

> O áudio é um sinal 1-D em 16-48 kHz. Um clip de cinco segundos é 80-240k amostras. Nenhum transformador atende a essa sequência diretamente. A solução para todos os modelos de áudio de produção em 2026 é a mesma: um codec neural (Encodec, SoundStream, DAC) comprime áudio para tokens discretos em 50-75 Hz, e um transformador ou modelo de difusão gera tokens.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Audio Features), Phase 6 · 04 (ASR), Phase 8 · 06 (DDPM)
**Time:** ~45 minutes

## O problema

Três tarefas de geração de áudio:

1. **Text-to-speech.**Dado texto, produzir fala. O discurso limpo é de banda estreita e tem uma estrutura fonética forte  bem resolvido por transformador-over-tokens. VALL-E (Microsoft), NaturalSpeech 3, ElevenLabs, OpenAI TTS.
2. **Music generation.**Dado um impulso (texto, melodia, progressão de acordes, gênero), produz música. Distribuição muito mais ampla. MusicGen (Meta), Stable Audio 2.5, Suno v4, Udio, Riffusion.
3. **Audio effects / sound design.**Se for pedido, produzir som ambiente ou Foley.

Todos os três funcionam no mesmo substrato: codec de áudio neural + token-AR ou gerador de difusão.

## O conceito

![Audio generation: codec tokens + transformer or diffusion](../assets/audio-generation.svg)

### Códecagem de áudio neural

Encodec (Meta, 2022), SoundStream (Google, 2021), Descript Audio Codec (DAC, 2023). Um codificador convolucional comprime a forma de onda para um vetor por passo; quantização de vetor residual (RVQ) converte cada vetor em uma cascata de índices de K codebook. O decodificador inverte-o.

```
waveform (16000 samples/sec)
    └─ encoder conv ─┐
                     ├─ RVQ layer 1 → indices at 75 Hz
                     ├─ RVQ layer 2 → indices at 75 Hz
                     ├─ ...
                     └─ RVQ layer 8
```

### Dois paradigmas geracionais no topo

**Token-autoregressive.**Desbloquear tokens RVQ em uma sequência, executar um transformador apenas para decodificador. MusicGen usa "paralelo atrasado" para emitir fluxos de código K em paralelo com offsets por fluxo. VALL-E gera tokens de fala a partir de um texto de prompt + amostra de voz de 3 segundos.

**Latent diffusion.**Paque os tokens de codec como latentes contínuos ou modele-os com difusão categórica. Stable Audio 2.5 usa a correspondência de fluxo em latentes de áudio contínuos.

A tendência 2024-2026: a combinação de fluxo está ganhando para a música (inferação mais rápida, amostras mais limpas) enquanto a token-AR ainda domina a fala porque é naturalmente causal e fluem bem.

## Paisagem da produção

| System | Task | Backbone | Latency |
|--------|------|----------|---------|
| ElevenLabs V3 | TTS | Token-AR + neural vocoder | ~300ms first token |
| OpenAI GPT-4o audio | Full-duplex speech | End-to-end multimodal AR | ~200ms |
| NaturalSpeech 3 | TTS | Latent flow matching | Non-streaming |
| Stable Audio 2.5 | Music / SFX | DiT + flow matching on audio latents | ~10s for 1-minute clip |
| Suno v4 | Full songs | Undisclosed; token-AR suspected | ~30s per song |
| Udio v1.5 | Full songs | Undisclosed | ~30s per song |
| MusicGen 3.3B | Music | Token-AR on Encodec 32kHz | Real-time |
| AudioCraft 2 | Music + SFX | Flow matching | ~5s for 5s clip |
| Riffusion v2 | Music | Spectrogram diffusion | ~10s |

```figure
score-matching
```

## Construí-lo

`code/main.py`simula a ideia principal: treinar um pequeno transformador de next-token em sequências sintéticas de "tokens de áudio" geradas a partir de dois "estilos" distintos (alternando tokens baixos e altos para o estilo A, rampa monótona para o estilo B). Condição no estilo e amostra.

### Passo 1: Tokens de áudio sintéticos

```python
def make_tokens(style, length, vocab_size, rng):
    if style == 0:  # "speech-like": alternating
        return [i % vocab_size for i in range(length)]
    # "music-like": ramp
    return [(i * 3) % vocab_size for i in range(length)]
```

### Passo 2: treinar um pequeno preditor de token

Um preditor de estilo bigram condicionado ao estilo. O ponto é o padrão: tokens de codec → treinamento de entropia cruzada → amostragem autoregressiva.

### Passo 3: amostra condicionalmente

Dado o token de estilo e um token de início, mostre o próximo token da distribuição prevista. Continue para 20-40 tokens.

## Encurralagens

- **Codec quality caps output quality.**Se o codec não pode representar um som fielmente, nenhuma quantidade de qualidade do gerador ajuda.
- **RVQ error accumulation.**Cada camada RVQ modela o resíduo da anterior. Os erros na camada 1 se propagam.
- **Musical structure.**30 segundos de tokens são 20k + tokens a 75 Hz. Difícil para transformadores. MusicGen usa janela deslizante + continuação rápida; Stable Audio usa clipes mais curtos + crossfading.
- **Artifacts at boundaries.**A encruzilhada entre os clips gerados requer um colapso cuidadoso.
- **Clean-data appetite.**Os geradores de música precisam de dezenas de milhares de horas de música licenciada.
- **Voice cloning ethics.**Uma amostra de 3 segundos mais um prompt de texto é suficiente para que o VALL-E / XTTS / ElevenLabs clone uma voz.

## Usá-lo

| Task | 2026 stack |
|------|------------|
| Commercial TTS | ElevenLabs, OpenAI TTS, or Azure Neural |
| Voice cloning (consent-verified) | XTTS v2 (open) or ElevenLabs Pro |
| Background music, fast | Stable Audio 2.5 API, Suno, or Udio |
| Music with lyrics | Suno v4 or Udio v1.5 |
| Sound effects / Foley | AudioCraft 2, ElevenLabs SFX, or Stable Audio Open |
| Real-time voice agent | GPT-4o realtime or Gemini Live |
| Open-weights music research | MusicGen 3.3B, Stable Audio Open 1.0, AudioLDM 2 |
| Dubbing / translation | HeyGen, ElevenLabs Dubbing |

## Envia-o

Salvar`outputs/skill-audio-brief.md`. A Skill toma um resumo de áudio (tarefa, duração, estilo, voz, licença) e as saídas: modelo + hospedagem, formato de resposta (tags de gênero, descriptores de estilo, marcadores estruturais), codec + gerador + cadeia de vocoder, protocolo de semente e plano de avaliação (score MOS / CLAP / CER para TTS / usuário A / B).

## Exercícios

1. **Easy.**Corra .`code/main.py`Verifique se as sequências geradas correspondem ao padrão do estilo.
2. **Medium.**Adicionar decodificação paralela atrasada: simular 2 fluxos de tokens que devem permanecer compensados por 1 passo. Treinar um predictor conjunto.
3. **Hard.**Use transformadores HuggingFace para executar MusicGen-small localmente. Gerencie um clip de 10 segundos com três instruções diferentes; A/B para adesão ao estilo.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Codec | "Neural compression" | Encoder / decoder for audio; typical output is 50-75 Hz tokens. |
| RVQ | "Residual VQ" | Cascade of K quantizers; each models the residual of the previous. |
| Token | "One codec symbol" | Discrete index into a codebook; 1024 or 2048 typical. |
| Delayed parallel | "Offset codebooks" | Emit K token streams with staggered offsets to reduce sequence length. |
| Flow matching | "The 2024 win for audio" | Straighter-path alternative to diffusion; faster sampling. |
| Voice prompt | "3-second sample" | Speaker embedding or token prefix that steers the cloned voice. |
| Mel spectrogram | "The visual" | Log-magnitude perceptual spectrogram; used by many TTS systems. |
| Vocoder | "Mel to wave" | Neural component that converts mel spectrograms back to audio. |

## Nota de produção: áudio é um problema de streaming

O áudio é a única modalidade de saída que os usuários esperam chegar *como é gerado*, não de uma vez. Em termos de produção, isso significa que a TPOT importa (Time Per Output Token) porque a velocidade de escuta do usuário é a velocidade de transmissão alvo  não a sua velocidade de leitura. Para áudio de 16kHz tokenizado em ~75 tokens/segundo (Encodec), o servidor deve gerar ≥75 tokens/segundo por usuário para manter a reprodução suave.

Duas consequências arquitetônicas:

- **Flow-matching audio models cannot stream trivially.**O Stable Audio 2.5 e o AudioCraft 2 renderizam um comprimento fixo de clip em uma passagem. Para transmitir, você despeja o clip e as fronteiras de sobreposição  pense na difusão de janela deslizante  adicionando 100-300ms de latencia superior versus um modelo de AR de codec.

Se o produto for "chat de voz ao vivo" ou "continuidade de música em tempo real", escolha o caminho de AR do codec. Se for "rendere um clipe de 30 segundos no submetimento", o fluxo de correspondência ganha na qualidade e latência total.

## Mais leitura

- [Défossez et al. (2022). Encodec: High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) o padrão de codec.
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) o primeiro codec de áudio neural amplamente utilizado.
- [Kumar et al. (2023). High-Fidelity Audio Compression with Improved RVQGAN (DAC)](https://arxiv.org/abs/2306.06546)- DAC.
- [Wang et al. (2023). Neural Codec Language Models are Zero-Shot Text to Speech Synthesizers (VALL-E)](https://arxiv.org/abs/2301.02111)- VALL-E.
- [Copet et al. (2023). Simple and Controllable Music Generation (MusicGen)](https://arxiv.org/abs/2306.05284) MusicGen.
- [Liu et al. (2023). AudioLDM 2: Learning Holistic Audio Generation with Self-supervised Pretraining](https://arxiv.org/abs/2308.05734) AudioLDM 2.
- [Stability AI (2025). Stable Audio 2.5](https://stability.ai/news-updates/stability-ai-introduces-stable-audio-25-the-first-audio-model-built-for-enterprise-sound-production-at-scale) 2025 texto-música com fluxo de correspondência.
