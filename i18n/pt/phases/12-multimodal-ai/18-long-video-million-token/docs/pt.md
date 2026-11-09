# Compreensão de vídeos longos em contexto de milhões de falados

> Um vídeo 4K de 1 hora a 24 FPS, parcheado e incorporado, produz a ordem de 60 milhões de tokens. Um episódio de podcast de 2 horas transcrito é de 30.000 tokens. Um filme completo de Blu-ray, mesmo comprimido com agressão, é de centenas de milhares de tokens. O Gemini 1.5 do Google (março de 2024) abriu esta era com um contexto de 10 milhões de tokens, fazendo uma recall confiável de agulha em uma pilha de feno em vídeos de uma hora. LWM (Liu et al., fevereiro 2024) mostrou o caminho de escala da atenção do anel. O LongVILA e o Video- XL aumentaram ainda mais a ingestão. O VideoAgent trocou o contexto bruto por recuperação agente. Cada abordagem é uma troca diferente na composição, na recordação e na complexidade da engenharia. Esta lição lê-os lado a lado.

**Type:** Build
**Languages:** Python (stdlib, needle-in-haystack simulator + agentic-retrieval router), TypeScript
**Prerequisites:** Phase 12 · 17 (video temporal tokens)
**Time:** ~180 minutes

## Objetivos de aprendizagem

- Calcule o conteúdo total de tokens visuais para vídeos de formato longo em diferentes FPS e pooling.
- Explique os quatro caminhos de escalagem: contexto bruto (Gemini 1.5), atenção ao anel (LWM), compressão de tokens (LongVILA / Video-XL), recuperação agente (VideoAgent).
- Compare VLMs de vídeo de contexto bruto vs VLMs de vídeo de recuperação de agentes (VideoAgent) em precisão e latência.
- Desenhar um teste de agulha em um monte de feno para um vídeo de 30 minutos e medir a recall em um minuto específico.

## O problema

Um único quadro de patches de tamanho Qwen2.5VL com 384 resoluções nativas é ~729 tokens. Em 3x3 pooling isso é 81 tokens por quadro. Um clip de 30 minutos em 1 FPS = 1800 quadros = 145.800 tokens. Feliz até 2025.

Um filme de 2 horas em 1 FPS é de 583k tokens. Além da maioria dos modelos abertos de 2026; requer Gemini 2.5 Pro ou agrupamento mais agressivo.

Foram quatro caminhos de escalada.

## O conceito

### Caminho 1: contexto bruto (Gemini 1.5, Claude Opus)

Atira hardware para o problema, escala contexto para milhões de tokens, processar tudo em uma passagem para a frente.

O Gemini 1.5 Pro foi lançado com 1M tokens; Gemini 1.5 Ultra para 10M; Gemini 2.5 Pro em 2026 faz horas de vídeo de forma confiável.

Engenharia: uma implementação de atenção personalizada com hierarquia de memória (local + global + escassa) mais roteamento de especialistas em MoE para eficiência de longo contexto. Não publicado em detalhes completos. Não de código aberto.

### Caminho 2: Atenção ao anel (LWM, LongVILA)

A atenção em anel distribui longas sequências entre dispositivos em um "anel" onde cada dispositivo mantém um pedaço.

LWM (Liu et al., 2024) treinou um modelo de contexto de 1M-token desta forma. Escalas de memória por dispositivo com o pedaço que cada dispositivo mantém, então adicionar dispositivos estende o contexto de forma aproximada linear.

LongVILA (arXiv:2408.10188) adaptou o padrão para VLMs. Vídeos de 1400 quadros em 192 tokens por quadro = contexto de 268k, treinados com atenção de anel em paralelo de 8 vias.

### Caminho 3: Compressão de tokens (Video-XL, LongVA)

Mais barato do que o contexto bruto: comprime agressivamente antes que o LLM veja a sequência.

Video-XL (arXiv:2409.14485) usa um token de resumo visual: cada clip de quadros N produz um único token de "resumo" que atende ao N. Na inferência, o LLM vê um token de resumo por clip, reduzindo drasticamente o contexto.

LongVA estende o contexto de LLM de 200 mil para 2 milhões com uma técnica de "transferência de contexto longo".

A compressão de tokens elimina o recall em marcas de tempo específicas para a escalabilidade. O modelo geralmente sabe o que aconteceu, mas às vezes perde os quadros exatos.

### Caminho 4: Recuperação de Agentes (VideoAgent)

Não entregue o vídeo completo ao LLM. Em vez disso, trate o vídeo como um banco de dados e use um LLM para consultá-lo.

VideoAgent (arXiv:2403.10517):

1. O LLM lê a pergunta.
2. O LLM pede uma ferramenta de recuperação de clips relevantes ("mostra-me segmentos com um gato").
3. A ferramenta retorna as marcas de tempo do clip.
4. O LLM lê esses clips através de um VLM.
5. O Mestrado em Direito e Direito compõe a resposta ou faz perguntas de acompanhamento.

Este é o padrão LLM-as-agente aplicado a vídeos longos. inferência mais barata (apenas clips relevantes codificados), engenharia mais difícil (qualidade de recuperação torna-se o gargalo de engarrafamento).

### Indicadores de referência para agulhas em um estábulo de feno

O teste padrão de longo contexto: insira um marcador visual ou textual único em um ponto aleatório no vídeo, e, em seguida, faça uma consulta que exige a sua recordação.

Metrícula: Recall@k em longo de vídeo e posição do marcador.

Os modelos Gemini 2.5 Pro pontua >99% de recall em vídeos de até 90 minutos. Os modelos 72B abertos (Qwen2.5-VL-72B, InternVL3-78B) pontua ~85-90% em 30 minutos e degradam para além de 60.

O VideoAgent pode combinar ou vencer modelos de contexto bruto em 2 horas ou mais porque a recuperação atinge a agulha se a ferramenta for boa.

### Que caminho escolher

Para um clip de 15 minutos com precisão de fronteira: aberto 72B + contexto nativo geralmente funciona.

Para conteúdo de 30 minutos a 1 hora: LongVILA ou Video-XL para aberta; Gemini 2.5 Pro para fechado.

Para conteúdo de mais de 2 horas: VideoAgent ou padrões de recuperação similares. Alternativamente, resuma em pedaços menores e alimenta resumos hierárquicos.

### Modelo de produção 2026

Na prática, as canais de produção de vídeo longo são híbridas:

1. Execute amostragem dinâmica de FPS + agressão em conjunto em todo o vídeo (obtenha uma representação global de 100k-token).
2. Passe para um VLM 72B para um resumo global.
3. Se o utilizador fizer perguntas detalhadas, execute a recuperação agencial usando o resumo como índice.

Isso combina contexto bruto para compreensão global e recuperação de detalhes locais.

```figure
mm-video-token-budget
```

## Usá-lo

`code/main.py`- Não .

- Computa orçamentos de tokens para vídeos de 1 minuto a 3 horas em diferentes FPS + pooling.
- Simula uma corrida de agulha em um monte de feno: injetar um marcador em um tempo aleatório, fazer uma pergunta, marcar a recordação.
- Inclui um simulador de roteador de recuperação de agentes que seleciona clips específicos para alimentar um VLM a jusante.

Escreva a tabela de orçamento e sinta a diferença na escala.

## Envia-o

Esta lição produz`outputs/skill-long-video-strategy-planner.md`. Dada a duração do vídeo e a complexidade da consulta, ele escolhe entre conteúdo bruto, compressão e recuperação agencial e calcula as expectativas de latência + qualidade.

## Exercícios

1. Uma palestra de 45 minutos a 1 FPS, 81 tokens por quadro.

2. Desenhar um teste de agulha em um monte de feno: em que minuto você injeta o marcador, e qual é o formato exato da consulta?

3. Comparar o conteúdo bruto Qwen2.5-VL-72B (contexto 80k) com o VideoAgent (Claude 3.5 + recuperação) em um vídeo de 1 hora. Qual vence na recordação? Qual vence na latência?

4. As escalas de memória de atenção de anel por dispositivo com comprimento de sequência dividido pelo número de dispositivos, enquanto o cálculo total de atenção permanece quadrático. Explique por que e o que falha se você deixar cair a fase de rotação de anel.

5. Leia Gemini 1.5 Secção 5 sobre agulha em um monte de feno.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Brute context | "Just more tokens" | Scale LLM context to millions of tokens; process everything in one pass |
| Ring attention | "LWM-style parallel" | Distributed attention pattern where each device holds a chunk and rotates |
| Token compression | "Summary tokens" | Reduce per-clip tokens via a learned compressor before the LLM |
| Needle-in-haystack | "NIH test" | Insert a unique marker at a random point, ask model to recall it at test time |
| Agentic retrieval | "LLM as query planner" | LLM asks a retrieval tool for relevant clips, reads them via a VLM, composes answer |
| VideoAgent | "Retrieval pattern for video" | Canonical agentic-retrieval design: question -> tool -> clip -> answer |

## Mais leitura

- [Gemini Team — Gemini 1.5 (arXiv:2403.05530)](https://arxiv.org/abs/2403.05530)
- [Liu et al. — LWM / RingAttention (arXiv:2402.08268)](https://arxiv.org/abs/2402.08268)
- [Xue et al. — LongVILA (arXiv:2408.10188)](https://arxiv.org/abs/2408.10188)
- [Shu et al. — Video-XL (arXiv:2409.14485)](https://arxiv.org/abs/2409.14485)
- [Wang et al. — VideoAgent (arXiv:2403.10517)](https://arxiv.org/abs/2403.10517)
