# Geração de Áudio

> Áudio é um sinal 1D a 16-48 kHz. Um clip de cinco segundos são 80-240k samples. Nenhum transformer attende a essa sequência diretamente. A solução para todo modelo de áudio production em 2026 é a mesma: um codec neural (Encodec, SoundStream, DAC) comprime áudio em tokens discretos a 50-75 Hz, e um transformer ou modelo de difusão gera tokens.

**Tipo:** Construir
**Linguagens:** Python
**Pré-requisitos:** Fase 6 · 02 (Features de Áudio), Fase 6 · 04 (ASR), Fase 8 · 06 (DDPM)
**Tempo:** ~45 minutos

## O Problema

Três tarefas de geração de áudio:

1. **Text-to-speech.** Dado texto, produza fala. Fala limpa é de banda estreita e tem estrutura fonética forte — resolvida bem por transformer-sobre-tokens. VALL-E (Microsoft), NaturalSpeech 3, ElevenLabs, OpenAI TTS.
2. **Geração musical.** Dado um prompt (texto, melodia, progressão de acordes, gênero), produza música. Distribuição muito mais ampla. MusicGen (Meta), Stable Audio 2.5, Suno v4, Udio, Riffusion.
3. **Efeitos de áudio / sound design.** Dado um prompt, produza som ambiente ou Foley. AudioGen, AudioLDM 2, Stable Audio Open.

As três rodam no mesmo substrato: codec de áudio neural + gerador AR por tokens ou difusão.

## O Conceito

![Geração de áudio: tokens de codec + transformer ou difusão](../assets/audio-generation.svg)

### Codecs de áudio neurais

Encodec (Meta, 2022), SoundStream (Google, 2021), Descript Audio Codec (DAC, 2023). Um encoder convolucional comprime a forma de onda em um vetor por timestep; quantização vetorial residual (RVQ) converte cada vetor em uma cascata de K índices de codebook. Decoder inverte isso. Áudio a 24 kHz a 2 kbps usando 8 codebooks RVQ a 75 Hz = 600 tokens/seg.

```
forma de onda (16000 samples/seg)
    └─ encoder conv ─┐
                     ├─ RVQ layer 1 → índices a 75 Hz
                     ├─ RVQ layer 2 → índices a 75 Hz
                     ├─ ...
                     └─ RVQ layer 8
```

### Dois paradigmas gerativos por cima

**Autoregressivo por tokens.** Achate os tokens RVQ em uma sequência, rode um transformer só decoder. MusicGen usa "paralelo atrasado" para emitir K streams de codebook em paralelo com offsets por stream. VALL-E gera tokens de fala a partir de um prompt de texto + amostra de voz de 3 segundos.

**Latent diffusion.** Empacote tokens de codec como latentes contínuos ou modele-os com difusão categórica. Stable Audio 2.5 usa flow matching sobre latentes contínuos de áudio. AudioLDM 2 usa difusão de texto-para-mel-para-áudio.

A tendência de 2024-2026: flow matching está vencendo para música (inferência mais rápida, amostras mais limpas) enquanto token-AR ainda domina fala porque é naturalmente causal e faz streaming bem.

## Cenário production

|| Sistema | Tarefa | Backbone | Latência ||
||--------|------|----------|---------||
|| ElevenLabs V3 | TTS | Token-AR + vocoder neural | ~300ms primeiro token ||
|| OpenAI GPT-4o audio | Fala full-duplex | AR multimodal de ponta a ponta | ~200ms ||
|| NaturalSpeech 3 | TTS | Flow matching latente | Non-streaming ||
|| Stable Audio 2.5 | Música / SFX | DiT + flow matching sobre latentes de áudio | ~10s para clip de 1 min ||
|| Suno v4 | Músicas completas | Não divulgado; suspeita de token-AR | ~30s por música ||
|| Udio v1.5 | Músicas completas | Não divulgado | ~30s por música ||
|| MusicGen 3.3B | Música | Token-AR sobre Encodec 32kHz | Tempo real ||
|| AudioCraft 2 | Música + SFX | Flow matching | ~5s para clip de 5s ||
|| Riffusion v2 | Música | Difusão de eespecificaçãotrograma | ~10s ||

## Construa

`code/main.py` simula a ideia central: treine um pequeno transformer next-token em sequências sintéticas de "tokens de áudio" geradas a partir de dois "estilos" distintos (alternância de tokens baixos e altos para estilo A, rampa monotônica para estilo B). Condicione no estilo e amostragem.

### Passo 1: tokens de áudio sintéticos

```python
def make_tokens(style, length, vocab_size, rng):
    if style == 0:  # "estilo fala": alternância
        return [i % vocab_size for i in range(length)]
    # "estilo música": rampa
    return [(i * 3) % vocab_size for i in range(length)]
```

### Passo 2: treine um pequeno preditor de tokens

Um preditor estilo bigrama condicionado no estilo. O ponto é o padrão: tokens de codec → treino por entropia cruzada → amostragem autoregressiva.

### Passo 3: amostragem condicional

Dado o token de estilo e um token inicial, amostragem o próximo token da distribuição prevista. Continue por 20-40 tokens.

## Armadilhas

- **Qualidade do codec limita qualidade de saída.** Se o codec não consegue representar um som fielmente, nenhuma qualidade de gerador ajuda. DAC é o melhor aberto atual.
- **Acumulação de erro RVQ.** Cada camada RVQ modela o resíduo da anterior. Erros na camada 1 propagam. Amostrar com temperatura 0 nas camadas superiores ajuda.
- **Estrutura musical.** 30 segundos de tokens são 20k+ tokens a 75 Hz. Difícil para transformers. MusicGen usa janela deslizante + continuação de prompt; Stable Audio usa clips menores + crossfading.
- **Artefatos nas bordas.** Crossfading entre clips gerados precisa de overlap-add cuidadoso.
- **Apetite por dados limpos.** Geradores musicais precisam de dezenas de milhares de horas de música licenciada. O processo da RIAA contra Suno / Udio (2024) trouxe isso à tona.
- **Ética de clonagem de voz.** Uma amostra de 3 segundos + um prompt de texto é suficiente para VALL-E / XTTS / ElevenLabs clonarem uma voz. Todo modelo production precisa de detecção de abuso + listas de exclusão.

## Use

|| Tarefa | Stack de 2026 ||
||------|------------||
|| TTS comercial | ElevenLabs, OpenAI TTS ou Azure Neural ||
|| Clonagem de voz (com consentimento verificado) | XTTS v2 (aberto) ou ElevenLabs Pro ||
|| Música de fundo, rápido | API do Stable Audio 2.5, Suno ou Udio ||
|| Música com letras | Suno v4 ou Udio v1.5 ||
|| Efeitos sonoros / Foley | AudioCraft 2, ElevenLabs SFX ou Stable Audio Open ||
|| Agente de voz em tempo real | GPT-4o realtime ou Gemini Live ||
|| Pesquisa musical de pesos abertos | MusicGen 3.3B, Stable Audio Open 1.0, AudioLDM 2 ||
|| Dublagem / tradução | HeyGen, ElevenLabs Dubbing ||

## Entregue

Salve `outputs/skill-audio-brief.md`. A skill recebe um briefing de áudio (tarefa, duração, estilo, voz, licença) e gera: modelo + hospedagem, formato de prompt (tags de gênero, descritores de estilo, marcadores estruturais), cadeia codec + gerador + vocoder, protocolo de semente, e plano de avaliação (MOS / score CLAP / CER para TTS / A/B do usuário).

## Exercícios

1. **Fácil.** Execute `code/main.py` e defina o estilo explicitamente. Verifique que as sequências geradas correspondem ao padrão do estilo.
2. **Médio.** Adicione decodificação paralela atrasada: simule 2 streams de tokens que devem ficar deslocados em 1 passo. Treine um preditor conjunto.
3. **Difícil.** Use os transformers do HuggingFace para rodar MusicGen-small localmente. Gere um clip de 10 segundos com três prompts diferentes; A/B para aderência ao estilo.

## Termos Chave

|| Termo | O que as pessoas dizem | O que realmente significa ||
||------|-----------------|-----------------------||
|| Codec | "Compressão neural" | Encoder / decoder para áudio; saída típica são tokens a 50-75 Hz. ||
|| RVQ | "VQ residual" | Cascata de K quantizadores; cada um modela o resíduo da anterior. ||
|| Token | "Um símbolo de codec" | Índice discreto em um codebook; 1024 ou 2048 típico. ||
|| Paralelo atrasado | "Codebooks deslocados" | Emitir K streams de tokens com offsets escalonados para reduzir tamanho da sequência. ||
|| Flow matching | "A vitória de 2024 para áudio" | Alternativa de caminho mais reto à difusão; amostragem mais rápida. ||
|| Voice prompt | "Amostra de 3 segundos" | Embedding de locutor ou prefixo de token que direciona a voz clonada. ||
|| Mel especificaçãotrogram | "O visual" | Eespecificaçãotrograma perceptual de magnitude logarítmica; usado por muitos sistemas TTS. ||
|| Vocoder | "Mel para onda" | Componente neural que converte mel especificaçãotrograms de volta para áudio. |

## Nota de produção: áudio é um problema de streaming

Áudio é a única modalidade de saída que os usuários esperam receber *conforme é gerado*, não tudo de uma vez. Em termos de production, isso significa que TPOT importa (Time Per Output Token) porque a velocidade de escuta do usuário é o throughput alvo — não a velocidade de leitura. Para áudio de 16kHz tokenizado a ~75 tokens/segundo (Encodec), o servidor deve gerar ≥75 tokens/seg por usuário para manter a reprodução suave.

Duas consequências arquiteturais:

- **Modelos de áudio por flow matching não conseguem fazer streaming trivialmente.** Stable Audio 2.5 e AudioCraft 2 renderizam um comprimento de clip fixo em uma passada. Para streaming, você chunka o clip e sobrepõe as bordas — pense em difusão por sliding-window — adicionando 100-300ms de sobrecarga de latência vs um modelo codec AR.

Se o produto é "chat de voz ao vivo" ou "continuação musical em tempo real", escolha o caminho codec AR. Se é "renderizar um clip de 30 segundos ao submeter", flow matching vence em qualidade e latência total.

## Leituras Complementares

- [Défossez et al. (2022). Encodec: High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) — o padrão de codec.
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) — o primeiro codec neural amplamente utilizado.
- [Kumar et al. (2023). High-Fidelity Audio Compression with Improved RVQGAN (DAC)](https://arxiv.org/abs/2306.06546) — DAC.
- [Wang et al. (2023). Neural Codec Language Models are Zero-Shot Text to Speech Synthesizers (VALL-E)](https://arxiv.org/abs/2301.02111) — VALL-E.
- [Copet et al. (2023). Simple and Controllable Music Generation (MusicGen)](https://arxiv.org/abs/2306.05284) — MusicGen.
- [Liu et al. (2023). AudioLDM 2: Learning Holistic Audio Generation with Self-supervised Pretraining](https://arxiv.org/abs/2308.05734) — AudioLDM 2.
- [Stability AI (2024). Stable Audio 2.5](https://stability.ai/news/introducing-stable-audio-2-5) — texto-to-música de 2025 com flow matching.
