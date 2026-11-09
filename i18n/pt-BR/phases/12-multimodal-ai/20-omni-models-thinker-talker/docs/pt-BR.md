# Modelos Omni: Qwen2.5-Omni e o Thinker-Talker Split

> A demonstração do produto do GPT-4o em maio de 2024 foi perturbadora não por causa do modelo subjacente, mas por causa da forma do produto  uma interface de voz onde você fala, o modelo vê o que a câmera vê, e fala de volta em menos de 250ms. O ecossistema aberto passou o resto de 2024 e 2025 a correr para alcançar essa superfície do produto. Qwen2.5-Omni (março 2025) é o projeto aberto de referência: um Thinker (grande transformador de geração de texto) mais um Talker (transformador paralelo de geração de voz), ligado por tokens de streaming de fala. Mini-Omni simplificou, Moshi combinou a latência, GLM-4-Voice estendeu para o chinês. Esta lição lê a arquitetura Thinker-Talker e o orçamento de latência que faz com que o diálogo em tempo real funcione.

**Type:** Build
**Languages:** Python (stdlib, streaming pipeline latency simulator + VAD loop), TypeScript
**Prerequisites:** Phase 12 · 19 (audio-LLMs), Phase 12 · 16 (any-to-any)
**Time:** ~180 minutes

## Objetivos de aprendizagem

- Divida o pipeline de inferência em Thinker (razão de texto) e Talker (sinteze de fala) e explique por que o streaming paralelo funciona.
- Calcular o orçamento de tempo para primeiro byte de áudio (TTFAB) para uma interação de conversação, componente por componente.
- Descreva a posição alinhada com o tempo do TMRoPE codificando visão, áudio e texto dentro do Pensador.
- Nomear os dois padrões de conversação em tempo real, meio duplex e duplex completo, e explicar como a tomada de turno VAD impulsiona a transferência de meio duplex.

## O problema

Um assistente de voz em tempo real tem que fazer muito, rápido:

1. Ouça o usuário. Tokenização de fala em tempo real, detecção de atividade vocal (VAD) para saber quando terminam de falar.
2. A entrada da câmera a 2 a 4 FPS, fluída para o Thinker ao lado do áudio.
3. Pense, escreva uma resposta condicionada ao histórico da conversa.
4. Sintetizar tokens de áudio, decodificar para forma de onda, transmitir para os alto-falantes do usuário.

Cada passo adiciona latência. A sensação de conversação requer total de ida e volta < 500ms  abaixo disso, o usuário deixa de notar o atraso. GPT-4o afirma ~250ms. Moshi ~160ms. Qwen2.5-Omni ~350-500ms.

Nada pode ser "batch everything then decode".

## O conceito

### Pensador e Falador

A decomposição do Qwen2.5 Omni:

- Pensador: um transformador de geração de texto 7B-80B. Consome tokens de texto + imagem + áudio entrelaçados.
- Falante: um transformador gerador de fala menor (200M-1B). Consome os tokens de saída de texto do Thinker além de tokens recentes de contexto de fala.
- Decodificador de voz: um decodificador de forma de onda de streaming (SNAC, família MoVQGAN) que leva tokens de voz para amostras de áudio em tempo real.

A separação é importante. O pensador tem que ser grande para um bom raciocínio. O conversador pode ser pequeno porque seu trabalho é local  converter texto em tokens de fala. O grande conversador não é mais expressivo; é mais lento.

- Elas estão em paralelo.

1. O pensador emite um token de texto .$t_i$- Não .
2. O falante consome .$t_i$(via streaming) e emite tokens de fala $s_i, s_{i+1}, \ldots, s_{i+k}$- Não .
3. O decodificador de voz consome tokens de voz à medida que eles chegam e emite amostras de áudio.
4. Quando o Pensador estiver no sinal de texto .$t_{i+3}$O Talker já transmitiu áudio para o$t_0, \ldots, t_{i+2}$- Não .

### Posições multimodal TMRoPE  alinhadas no tempo

O pensador precisa integrar quadros de imagem (que chegam a, digamos, 4 FPS), quadros de áudio (que chegam a 50 quadros/segundo) e texto do histórico de conversação.

TMRoPE atribui timestamps absolutos a cada token. token de visão em t = 2,3s. token de áudio em t = 2,32s. token de texto do usuário "stop" em t = 2,35s. RoPE gira a atenção por timestamp; o modelo vê-los como temporariamente simultâneos.

Esta é a infraestrutura para "ele acenou enquanto dizia olá" para funcionar  o modelo vê o quadro de vídeo e o áudio no mesmo momento conceitual.

### Sintese de fala em streaming

Tokens de fala devem ser transmitidos. Mini-Omni (Xie & Wu, 2024) introduziu "modelos de linguagem podem ouvir, falar enquanto pensam em streaming": Tokens de saída do pensador e tokens de saída do conversador interceptam-se na mesma sequência.

Moshi (Défossez et al., outubro 2024) é a implementação aberta mais rápida. 160ms TTFAB em um único A100. Arquitetura: um único transformador 7B que emite tokens de texto e fala em posições alternadas, com um "monólogo interno" que separa o fluxo de pensamento do fluxo de fala.

### VAD e viragem

A detecção da atividade vocal é executada no lado de entrada.

- Meio duplex: usuário fala, modelo ouve. Modelo fala, usuário ouve. Transferência clara através da detecção de silêncio VAD (~ 200ms).
- Duplex completo: ambos podem falar simultaneamente. Modelo pode backchannel ("uh-huh") ou interromper. Muito mais difícil. Moshi suporta isso.

Qwen2.5 Omni suporta meio duplex por padrão, com a tomada de turno através do limiar de silêncio.

### Qwen3-Omni (novembro 2025)

O sucessor. Qwen3-80B Thinker, maior Talker, melhorou TMRoPE-v2. Latência próxima a 250ms de GPT-4o. Pesos abertos. Benchmarks em OmniBench competitivo com Gemini 2.0 Live.

### Orçamento de latência de produção

Para uma interação de streaming típica:

- Mic -> tokens de áudio: 40-80ms.
- Preenchimento (promete + histórico): 100-200 ms em 7B, muito mais em 70B.
- Primeiro token de texto do Thinker: 40ms.
- Talker processar o primeiro token de texto: 20ms.
- Primeiros tokens de fala comprometem-se: 40ms.
- Decodificação residual-VQ: 30 ms.
- Decodificação de forma de onda de fala: 50-80ms.

TTFAB total: 320-490ms em 7B, 600-900ms em 70B. A qualidade de fronteira geralmente significa 70B +; portanto, a diferença de latência de fronteira.

### Matemática de taxa de tokens

Em 16kHz de fala com 50 Hz de tokens de fala base, você precisa de 50 tokens de fala por segundo de saída. O falante deve emitir ≥ 50 tok/s para acompanhar. Em um rendimento típico de LLM de 30-80 tok/s em um H100, um pequeno (200-300M) falante é rápido o suficiente; um 7B falante ficaria para trás.

É por isso que existem pequenos modelos dedicados Talker em vez de "apenas usar o modelo principal".

```figure
l5-thinker-talker
```

## Usá-lo

`code/main.py`- Não .

- Simula um pipeline Thinker-Talker com taxas de emissão de tokens falsas.
- Computa TTFAB para tamanhos de modelos configuráveis e taxas de amostragem de microfones.
- Demonstra uma rotação de meio duplex com um limiar de silêncio VAD.

## Envia-o

Esta lição produz`outputs/skill-omni-streaming-budget.md`. Tendo em conta o objetivo TTFAB e o conjunto de recursos (visão, bilíngue, duplex completo) de um produto de voz em tempo real, escolhe Qwen2.5-Omni, Qwen3-Omni, Moshi ou Mini-Omni e dimensionar o Thinker/Talker.

## Exercícios

1. O seu alvo TTFAB é de 300ms. num Thinker 7B e 300M Talker, escreva a latência de cada componente.

2. Qwen2.5-Omni usa TMRoPE. Descreva o que o modelo vê para um prompt em que o usuário começa a falar em t=1s e a câmera capta um gesto em t=1.2s.

3. O suporte de duplex completo exige que o modelo emite áudio enquanto ouve.

4. Leia o artigo de Moshi, Secção 4. Descreva a separação do "monólogo interno" e por que ela evita a divisão Pensador-Falar.

5. Calcule o orçamento de transmissão: a que velocidade um Talker deve emitir tokens para acompanhar a fala de 16 kHz a 50 tokens de camada base/segundo?

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Thinker | "Reasoning brain" | Large text-generating transformer producing what to say |
| Talker | "Speech-generating mouth" | Small transformer producing discrete speech tokens from Thinker's text |
| TTFAB | "Latency budget" | Time-to-first-audio-byte: from user speech end to first audio sample out |
| TMRoPE | "Time-aligned RoPE" | Position encoding using absolute timestamps across vision, audio, text |
| Half-duplex | "Turn-taking" | User and model alternate; VAD silence detects user-done |
| Full-duplex | "Simultaneous" | Model can speak and listen at the same time; backchannel capable |
| Inner monologue | "Moshi separation" | Single-model design where thinking-stream and speaking-stream interleave |

## Mais leitura

- [Xu et al. — Qwen2.5-Omni (arXiv:2503.20215)](https://arxiv.org/abs/2503.20215)
- [Qwen Team — Qwen3-Omni (arXiv:2509.17765)](https://arxiv.org/html/2509.17765v1)
- [Xie & Wu — Mini-Omni (arXiv:2408.16725)](https://arxiv.org/abs/2408.16725)
- [Défossez et al. — Moshi (arXiv:2410.00037)](https://arxiv.org/abs/2410.00037)
- [Zeng et al. — GLM-4-Voice (arXiv:2412.02612)](https://arxiv.org/abs/2412.02612)
