# Modelos Omni: Qwen2.5-Omni e a Divisão Thinker-Talker

> A demonstração de produto do GPT-4o em maio de 2024 foi disruptiva não por causa do modelo subjacente, mas pela forma do produto — uma interface de voz onde você fala, o modelo vê o que a câmera vê, e responde em menos de 250ms. O ecossistema aberto passou o resto de 2024 e 2025 correndo para alcançar essa superfície de produto. O Qwen2.5-Omni (março de 2025) é o design aberto de referência: um Thinker (transformer grande de geração de texto) mais um Talker (transformer paralelo de geração de fala), ligados por tokens de fala em streaming. Mini-Omni simplificou, Moshi igualou sua latência, GLM-4-Voice estendeu para chinês. Esta aula lê a arquitetura Thinker-Talker e o orçamento de latência que faz o diálogo real-time em streaming funcionar.

**Tipo:** Construção
**Linguagens:** Python (stdlib, simulador de latência de pipeline em streaming + loop VAD)
**Pré-requisitos:** Fase 12 · 19 (áudio-LLMs), Fase 12 · 16 (any-to-any)
**Tempo:** ~180 minutos

## Objetivos de Aprendizado

- Dividir o pipeline de inferência em Thinker (raciocínio de texto) e Talker (síntese de fala) e explicar por que o streaming paralelo funciona.
- Computar o orçamento de TTFAB (time-to-first-audio-byte) para uma interação conversacional, componente por componente.
- Descrever a codificação de posição alinhada no tempo do TMRoPE entre visão, áudio e texto dentro do Thinker.
- Nomear os três padrões de conversação real-time: half-duplex, turn-taking, full-duplex.

## O Problema

Um assistente de voz real-time tem que fazer muita coisa, rápido:

1. Ouvir o usuário. Tokenização de fala real-time, detecção de atividade de voz (VAD) pra saber quando ele parou de falar.
2. Opcionalmente ver. Entrada de câmera a 2-4 FPS, enviada para o Thinker junto com o áudio.
3. Pensar. Compor uma resposta condicionada no histórico da conversa.
4. Falar. Sintetizar tokens de áudio, decodificar para forma de onda, transmitir para os alto-falantes do usuário.

Cada passo adiciona latência. Sensação conversacional exige round-trip total < 500ms — abaixo disso, o usuário para de notar o lag. GPT-4o promete ~250ms. Moshi ~160ms. Qwen2.5-Omni ~350-500ms.

Todo componente precisa fazer streaming. Nada pode ser "juntar tudo e depois decodificar."

## O Conceito

### Thinker e Talker

A decomposição do Qwen2.5-Omni:

- Thinker: um transformer de 7B-80B que gera texto. Consome tokens entrelaçados de texto + imagem + áudio. Saída: tokens de texto representando o que dizer.
- Talker: um transformer menor de geração de fala (200M-1B). Consome os tokens de texto de saída do Thinker mais tokens recentes de contexto de fala. Saída: tokens de fala discretos (índices residual-VQ).
- Decodificador de fala: um decodificador de forma de onda em streaming (família SNAC, MoVQGAN) que transforma tokens de fala em amostras de áudio em tempo real.

A separação importa. Thinker precisa ser grande pra ter raciocínio bom. Talker pode ser pequeno porque o trabalho dele é local — converter texto em tokens de fala. Talker maior não é mais expressivo; é mais lento.

Rodando ambos em paralelo:

1. Thinker emite o token de texto t_i.
2. Talker consome t_i (via streaming) e emite tokens de fala s_i, s_{i+1}, ..., s_{i+k}.
3. Decodificador de fala consome tokens de fala conforme chegam e emite amostras de áudio.
4. Quando o Thinker está no token de texto t_{i+3}, o Talker já transmitiu áudio para t_0..t_{i+2}.

### TMRoPE — posições multimodais alinhadas no tempo

Thinker precisa integrar frames de imagem (chegando, digamos, a 4 FPS), frames de áudio (chegando a 50 frames/segundo), e texto do histórico da conversa. Uma sequência ingênua (todas imagens, depois todo áudio, depois texto) perde alinhamento temporal.

TMRoPE atribui timestamps absolutos para cada token. Token de visão em t=2.3s. Token de áudio em t=2.32s. Token de texto do usuário "pare" em t=2.35s. RoPE rotaciona a attention por timestamp; o modelo vê todos como temporalmente concorrentes.

Essa é a infraestrutura pra "ele acenou enquanto dizia olá" funcionar — o modelo vê o frame de vídeo e o áudio no mesmo momento conceitual.

### Síntese de fala em streaming

Tokens de fala precisam fazer streaming. Mini-Omni (Xie & Wu, 2024) introduziu "modelos de linguagem podem ouvir, falar enquanto pensam em streaming": tokens de saída do Thinker e tokens de saída do Talker se entrelaçam na mesma sequência. Talker dispara assim que o Thinker confirma o próximo token de texto. Sem limites de batch.

Moshi (Défossez et al., outubro de 2024) é a implementação aberta mais rápida. 160ms TTFAB num único A100. Arquitetura: um único transformer de 7B que emite tokens de texto e de fala em posições alternadas, com um "monólogo interno" que separa o fluxo de raciocínio do fluxo de fala. Isso é efetivamente Thinker + Talker fundidos num modelo só com treinamento cuidadoso.

### VAD e turn-taking

Detecção de atividade de voz roda no lado da entrada. Dois padrões:

- Half-duplex: usuário fala, modelo escuta. Modelo fala, usuário escuta. Passagem clara via detecção de silêncio do VAD (~200ms).
- Full-duplex: ambos podem falar ao mesmo tempo. Modelo pode fazer backchannel ("uh-huh") ou interromper. Muito mais difícil. Moshi suporta isso.

Qwen2.5-Omni suporta half-duplex por padrão, com turn-taking via threshold de silêncio. Full-duplex exige tratamento na camada de aplicação.

### Qwen3-Omni (novembro de 2025)

O sucessor. Thinker Qwen3-80B, Talker maior, TMRoPE-v2 melhorado. Latência perto dos 250ms do GPT-4o. Pesos abertos. Benchmarks no OmniBench competitivos com Gemini 2.0 Live.

### Orçamento de latência em produção

Para uma interação típica em streaming:

- Microfone -> tokens de áudio: 40-80ms.
- Prefill (prompt + histórico): 100-200ms a 7B, muito mais a 70B.
- Primeiro token de texto do Thinker: 40ms.
- Talker processa o primeiro token de texto: 20ms.
- Primeiros tokens de fala commitados: 40ms.
- Decodificação residual-VQ: 30ms.
- Decodificação de forma de onda de fala: 50-80ms.

TTFAB total: 320-510ms a 7B, 600-900ms a 70B. Qualidade na frente geralmente significa 70B+; daí o gap de latência entre o que é aberto e o proprietário.

### Matemática de taxa de tokens

Com fala a 16kHz e tokens de fala base a 50 Hz, você precisa de 50 tokens de fala por segundo de saída. Talker precisa emitir ≥50 tok/s pra acompanhar. Com throughput típico de LLM de 30-80 tok/s num H100, um Talker pequeno (200-300M) é rápido o suficiente; um Talker de 7B ficaria pra trás.

Essa é a razão por que existem modelos Talker pequenos dedicados em vez de "só usar o modelo principal."

## Use

`code/main.py`:

- Simula um pipeline Thinker-Talker com taxas de emissão de tokens simuladas.
- Computa TTFAB para tamanhos de modelo configuráveis e taxas de amostragem de microfone.
- Demonstra turn-taking half-duplex com threshold de silêncio do VAD.

## Entregue

Esta aula produz `outputs/skill-omni-streaming-budget.md`. Dado o TTFAB alvo de um produto de voz real-time e conjunto de funcionalidades (visão entrada, bilíngue, full-duplex), escolhe Qwen2.5-Omni, Qwen3-Omni, Moshi, ou Mini-Omni e dimensiona o Thinker/Talker.

## Exercícios

1. Seu TTFAB alvo é 300ms. Num Thinker de 7B e Talker de 300M, escreva a latência de cada componente.

2. Qwen2.5-Omni usa TMRoPE. Descreva o que o modelo vê para um prompt onde o usuário começa a falar em t=1s e a câmera pega um gesto em t=1.2s.

3. Suporte full-duplex exige que o modelo emita áudio enquanto escuta. Proponha um formato de dados de treinamento que ensine isso.

4. Leia a Seção 4 do artigo do Moshi. Descreva a separação do "monólogo interno" e por que ela evita a divisão Thinker-Talker.

5. Compute o orçamento de throughput: a que velocidade um Talker precisa emitir tokens pra acompanhar fala a 16kHz com 50 tokens por camada base por segundo?

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|--------------------------|
| Thinker | "Cérebro de raciocínio" | Transformer grande de geração de texto produzindo o que dizer |
| Talker | "Boca geradora de fala" | Transformer pequeno produzindo tokens de fala discretos a partir do texto do Thinker |
| TTFAB | "Orçamento de latência" | Time-to-first-audio-byte: do fim da fala do usuário à primeira amostra de áudio |
| TMRoPE | "RoPE alinhado no tempo" | Codificação de posição usando timestamps absolutos entre visão, áudio, texto |
| Half-duplex | "Turn-taking" | Usuário e modelo se alternam; VAD detecta silêncio pra saber quando o usuário parou |
| Full-duplex | "Simultâneo" | Modelo pode falar e escutar ao mesmo tempo; suporta backchannel |
| Monólogo interno | "Separação Moshi" | Design de modelo único onde fluxo de raciocínio e fluxo de fala se entrelaçam |

## Leitura Adicional

- [Xu et al. — Qwen2.5-Omni (arXiv:2503.20215)](https://arxiv.org/abs/2503.20215)
- [Qwen Team — Qwen3-Omni (arXiv:2509.17765)](https://arxiv.org/html/2509.17765v1)
- [Xie & Wu — Mini-Omni (arXiv:2408.16725)](https://arxiv.org/abs/2408.16725)
- [Défossez et al. — Moshi (arXiv:2410.00037)](https://arxiv.org/abs/2410.00037)
- [Zeng et al. — GLM-4-Voice (arXiv:2412.02612)](https://arxiv.org/abs/2412.02612)
