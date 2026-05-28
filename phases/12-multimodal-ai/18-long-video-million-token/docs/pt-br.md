# Compreensão de Vídeo Longo em Contexto de Milhão de Tokens

> Um vídeo 4K de 1 hora a 24 FPS, com patches e embeddings, produz na ordem de 60 milhões de tokens. Um episódio de podcast de 2 horas transcrito tem 30.000 tokens. Um filme Blu-ray completo, mesmo comprimido com pooling agressivo, são centenas de milhares de tokens. Google Gemini 1.5 (março 2024) abriu essa era com contexto de 10 milhões de tokens, fazendo recall needle-in-a-haystack confiável sobre vídeos de mais de uma hora. LWM (Liu et al., fevereiro 2024) mostrou o caminho de escalonamento do ring attention. LongVILA e Video-XL escalaram a ingestão ainda mais. VideoAgent trocou contexto bruto por recuperação agentic. Cada abordagem é um trade diferente em compute, recall e complexidade de engenhara. Esta aula analisa elas lado a lado.

**Tipo:** Construção
**Linguagens:** Python (stdlib, simulador needle-in-a-haystack + roteador de recuperação agentic)
**Pré-requisitos:** Fase 12 · 17 (tokens temporais de vídeo)
**Tempo:** ~180 minutos

## Objetivos de Aprendizado

- Calcular contagens totais de tokens visuais pra vídeo longo em diferentes FPS e pooling.
- Explicar os três caminhos de escalonamento: contexto bruto (Gemini 1.5), ring attention (LWM), compressão de tokens (LongVILA / Video-XL).
- Comparar VLMs de vídeo de contexto bruto vs VLMs de vídeo de recuperação agentic (VideoAgent) em acurácia e latência.
- Projetar um teste needle-in-a-haystack pra um vídeo de 30 minutos e medir recall num minuto eespecificaçãoífico.

## O Problemo

Um único frame com patches do tamanho do Qwen2.5-VL em resolução nativa de 384 é ~729 tokens. A pooling 3x3 são 81 tokens por frame. Um clip de 30 minutos a 1 FPS = 1800 frames = 145.800 tokens. Factível pra VLMs open de 2025, apertado. A 2 FPS, 291.600 tokens — só os maiores contextos cabem.

Um filme de 2 horas a 1 FPS são 583k tokens. Fora do alcance da maioria dos modelos open de 2026; precisa de Gemini 2.5 Pro ou pooling mais agressivo.

Três caminhos de escalonamento surgiram.

## O Conceito

### Caminho 1: Contexto bruto (Gemini 1.5, Claude Opus)

Jogue hardware no problema. Escale o contexto pra milhões de tokens, processa tudo em um passo forward.

Gemini 1.5 Pro lançou com 1M tokens; Gemini 1.5 Ultra pra 10M; Gemini 2.5 Pro em 2026 lida com horas de vídeo de forma confiável. O paper (arXiv:2403.05530) documenta recall needle-in-a-haystack de 99.7% até ~9.5M tokens.

Engenhara: implementação custom de attention com hierarquia de memória (local + global + sparse) mais roteamento MoE pra eficiência em contexto longo. Não publicado em detalhe completo. Não open-source.

### Caminho 2: Ring attention (LWM, LongVILA)

Ring attention distribui sequências longas entre dispositivos em um "anel" onde cada dispositivo guarda um chunk. Atenção em toda a sequência acontece cada dispositivo enviando seu chunk pro próximo em padrão anel, computando attention parcial, e agregando.

LWM (Liu et al., 2024) treinou um modelo de contexto de 1M tokens assim. Compute de treinamento escala linearmente com contexto, não quadraticamente — o custo quadrático da attention é amortizado entre os dispositivos do anel.

LongVILA (arXiv:2408.10188) adaptou o padrão pra VLMs. Vídeos de 1400 frames com 192 tokens por frame = 268k de contexto, treinado com ring attention em paralelismo de 8 vias.

### Caminho 3: Compressão de tokens (Video-XL, LongVA)

Mais barato que contexto bruto: comprima agressivamente antes do LLM ver a sequência.

Video-XL (arXiv:2409.14485) usa token de resumo visual: cada clip de N frames produz um único token de "resumo" que faz attention sobre os N. Na inferência, o LLM vê um token de resumo por clip, encolhendo drasticamente o contexto.

LongVA estende o contexto do LLM de 200k pra 2M com uma técnica de "transferência de contexto longo". Treina em texto de contexto longo, transfere pra vídeo de contexto longo via representação compartilhada.

Compressão de tokens troca recall em timestamps eespecificaçãoíficos por escalabilidade. O modelo sabe geralmente o que aconteceu, mas às vezes perde frames exatos.

### Caminho 4: Recuperação agentic (VideoAgent)

Não alimente o vídeo inteiro no LLM. Ao invés disso, trate o vídeo como um banco de dados e use um LLM pra consultá-lo.

VideoAgent (arXiv:2403.10517):

1. LLM lê a pergunta.
2. LLM pede pra ferramenta de recuperação clips relevantes ("mostre segmentos com um gato").
3. Ferramenta retorna timestamps dos clips correspondentes.
4. LLM lê esses clips via um VLM.
5. LLM compõe a resposta ou faz perguntas de follow-up.

Esse é o padrão LLM-como-agent aplicado a vídeo longo. Inferência mais barata (só clips relevantes são codificados), engenhara mais difícil (qualidade da recuperação vira o gargalo).

### Benchmarks needle-in-a-haystack

O teste padrão de contexto longo: insere um marcador visual ou textual único em um ponto aleatório no vídeo, depois faz uma pergunta que requer recall dele.

Métrica: Recall@k ao longo do comprimento do vídeo e posição do marcador.

Gemini 2.5 Pro marca >99% de recall em vídeos até 90 minutos. Modelos open de 72B (Qwen2.5-VL-72B, InternVL3-78B) marcam ~85-90% a 30 minutos e degradam além de 60.

VideoAgent pode igualar ou superar modelos de contexto bruto em 2+ horas porque a recuperação acerta o marcador se a ferramenta for boa.

### Qual caminho escolher

Pra um clip de 15 minutos com acurácia frontier: 72B open + contexto nativo geralmente funciona. Escolha Qwen2.5-VL-72B.

Pra conteúdo de 30 minutos a 1 hora: LongVILA ou Video-XL pra open; Gemini 2.5 Pro pra fechado. A barra de qualidade importa — frontier vai pra fechado.

Pra conteúdo de 2+ horas: VideoAgent ou padrões de recuperação similares. Alternativamente, sumarize em chunks menores e alimente sumários hierárquicos.

### Padrão de produção em 2026

Na prática, pipelines de vídeo longo de produção são híbridos:

1. Rode amostragem FPS dinâmico + pooling agressivo no vídeo inteiro (obtém representação global de 100k tokens).
2. Passe pra um VLM de 72B pra sumário global.
3. Se o usuário faz perguntas detalhadas, rode recuperação agentic usando o sumário como índice.

Isso combina contexto bruto pra compreensão global e recuperação pra detalhe local.

## Use

`code/main.py`:

- Calcula orçamentos de tokens pra vídeos de 1 minuto a 3 horas em diferentes FPS + pooling.
- Simula uma execução needle-in-a-haystack: injeta marcador num timestamp aleatório, faz pergunta, pontua recall.
- Inclui um simulador de roteador de recuperação agentic que escolhe clips eespecificaçãoíficos pra alimentar um VLM downstream.

Rode a tabela de orçamento e sinta a差距 de escala.

## Implemente

Esta aula produz `outputs/skill-long-video-strategy-planner.md`. Dada uma duração de vídeo e complexidade de consulta, escolhe entre contexto bruto, compressão e recuperação agentic, e calcula expectativas de latência + qualidade.

## Exercícios

1. Uma palestra de 45 minutos a 1 FPS, 81 tokens por frame. Total de tokens? Cabem no contexto de quais modelos?

2. Projete um teste needle-in-a-haystack: em que minuto você injeta o marcador e qual o formato exato da pergunta?

3. Compare contexto bruto Qwen2.5-VL-72B (contexto 80k) com VideoAgent (Claude 3.5 + recuperação) num vídeo de 1 hora. Qual ganha em recall? Qual ganha em latência?

4. O custo de memória do ring attention escala linearmente com comprimento da sequência e linearmente com número de dispositivos. Explique por que e o que falha se você elimina a fase de rotação do anel.

5. Leia a Seção 5 do Gemini 1.5 sobre needle-in-a-haystack. O que o paper encontrou sobre recall na fronteira de 1M vs 10M tokens?

## Termos-Chave

| Termo | O que a galera diz | O que realmente significa |
|-------|-------------------|--------------------------|
| Contexto bruto | "Só mais tokens" | Escale contexto do LLM pra milhões de tokens; processa tudo em uma passada |
| Ring attention | "Paralelismo estilo LWM" | Padrão de attention distribuído onde cada dispositivo guarda um chunk e rotaciona |
| Compressão de tokens | "Tokens de resumo" | Reduz tokens por clip via compressor aprendido antes do LLM |
| Needle-in-haystack | "Teste NIH" | Insere marcador único em ponto aleatório, pede pro modelo recall no teste |
| Recuperação agentic | "LLM como planejador de consulta" | LLM pede clips relevantes pra ferramenta de recuperação, lê via VLM, compõe resposta |
| VideoAgent | "Padrão de recuperação pra vídeo" | Design canônico de recuperação agentic: pergunta -> ferramenta -> clip -> resposta |

## Leitura Complementar

- [Gemini Team — Gemini 1.5 (arXiv:2403.05530)](https://arxiv.org/abs/2403.05530)
- [Liu et al. — LWM / RingAttention (arXiv:2402.08268)](https://arxiv.org/abs/2402.08268)
- [Xue et al. — LongVILA (arXiv:2408.10188)](https://arxiv.org/abs/2402.08268)
- [Shu et al. — Video-XL (arXiv:2409.14485)](https://arxiv.org/abs/2409.14485)
- [Wang et al. — VideoAgent (arXiv:2403.10517)](https://arxiv.org/abs/2403.10517)
