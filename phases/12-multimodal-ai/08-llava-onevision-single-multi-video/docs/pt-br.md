# LLaVA-OneVision: Imagem Única, Multi-Imagem, Vídeo num Modelo Único

> Antes do LLaVA-OneVision (Li et al., agosto de 2024), o mundo de VLMs abertos tinha linhagens separadas: LLaVA-1.5 pra imagens únicas, modelos multi-imagem como Mantis e VILA, modelos de vídeo como Video-LLaVA e Video-LLaMA. Cada um ganhou seu benchmark e falhou nos outros. LLaVA-OneVision argumentou que um único currículo podia treinar um modelo pra dominar os três cenários, e que os efeitos emergentes de transferência de tarefas (habilidades de imagem única exportadas pra vídeo, raciocínio multi-imagem exportado pra imagem única) superavam a soma de especialistas. A receita é enganosamente simples: um orçamento de tokens visuais que se mantém constante entre cenários, mais um currículo explícito que vai de imagem única pra OneVision (multi-imagem) pra vídeo. Essa lição lê o orçamento, o currículo e os comportamentos emergentes.

**Tipo:** Construção
**Linguagens:** Python (stdlib, resolvedor de orçamento de tokens + planejador de currículo)
**Pré-requisitos:** Fase 12 · 05 (LLaVA), Fase 12 · 06 (qualquer resolução)
**Tempo:** ~180 minutos

## Objetivos de Aprendizado

- Projetar um orçamento de tokens visuais que se mantém constante entre entradas de imagem única, multi-imagem e vídeo.
- Ordenar um currículo de treino que transfere habilidades de imagem única pra vídeo sem esquecimento catastrófico.
- Explicar por que um único modelo supera especialistas no mesmo número de parâmetros quando o currículo é bem feito.
- Nomear as três capacidades emergentes reportadas pelo LLaVA-OneVision: raciocínio multi-câmera, set-of-mark prompting, agente de screenshot de iPhone.

## O Problema

Imagem, multi-imagem e vídeo cada um estressa um modelo de forma diferente.

Imagem única quer tokens de alta resolução (AnyRes, ~2880 tokens visuais) pra pegar OCR e detalhes finos. Orçamento por amostra: uma imagem, 2880 tokens.

Multi-imagem quer várias imagens em resolução moderada (~576 tokens cada) pra que raciocínio entre imagens caiba no contexto. Orçamento por amostra: 4-8 imagens, 576 cada, 2300-4600 tokens.

Vídeo quer muitos frames em baixa resolução (~196 tokens por frame após pooling) pra capturar dinâmicas temporais. Orçamento por amostra: 8-32 frames, 196 cada, 1600-6200 tokens.

Se você treina modelos separados, escolhe um orçamento. Se treina um modelo único, precisa do orçamento escalar de forma sensata entre cenários sem estourar o contexto.

Pré-OneVision, a resposta padrão era "treina um cenário, ignora os outros." Video-LLaVA adaptou vídeo num modelo de imagem com etapas extras de treino. LLaVA-NeXT adicionou suporte a multi-imagem com mosaico. Nenhum lidou com todos os três limpo.

## O Conceito

### O orçamento de tokens do OneVision

LLaVA-OneVision escolhe um orçamento unificado de tokens visuais de aproximadamente 3000-4000 tokens por amostra, alocado de forma diferente por cenário:

- Imagem única: AnyRes-9 (tiles 3x3 + thumbnail), cada tile em 384 com 729 patches, pooling bilinear agressivo 2x2 → 182 por tile. Total: 9 * 182 + 182 = 1820 tokens. Ou AnyRes-4 com 729 por tile = 2916 + 729.
- Multi-imagem: cada imagem em resolução moderada (384, sem mosaico), 729 tokens sem pooling. Orçamento 6 imagens → 4374 tokens.
- Vídeo: 32 frames em resolução 384 com pooling bilinear 3x3 agressivo → 81 tokens por frame. Total: 32 * 81 = 2592 tokens.

A alocação mantém aproximadamente constante o total de tokens. O LLM nunca vê um batch que estoura seu contexto. O encoder produz geometria diferente por cenário, mas o LLM consome o mesmo orçamento.

### O currículo em três etapas

LLaVA-OneVision treina em três etapas:

1. SFT de imagem única (estágio SI). Todos os dados são imagem-única-mais-texto. Treina em entrada AnyRes de alta resolução. Isso ensina percepção, OCR e compreensão refinada. Usa dados do LLaVA-NeXT mais dados específicos de imagem única do OneVision.
2. SFT OneVision (estágio OV). Mistura imagem-única + multi-imagem + vídeo (frames amostrados uniformemente). Treina no orçamento unificado de tokens. Isso ensina o modelo a lidar com formas heterogêneas de batch. Sem reset de pesos — continua do estágio SI.
3. Transferência de tarefa (estágio TT). Continua com uma mistura-alvo de tarefas, geralmente mais pesada em multi-imagem ou vídeo dependendo do produto. Fine-tuning opcional pra deploy.

Crucial: a ordem do currículo importa. Treinar vídeo primeiro ou multi-imagem primeiro produz performance de imagem pior que treinar imagem única primeiro, mesmo com os mesmos dados. O artigo ablationa isso explicitamente.

### Por que currículo funciona

Treino de imagem única constrói a base perceptual. Patch tokens carregam features visuais refinadas; o LLM aprende a integrá-las com texto. Multi-imagem e vídeo introduzem desafios estruturais (qual imagem é qual, o que aconteceu primeiro) que são difíceis de aprender sem uma base perceptual forte.

Se você treina todos os cenários do zero juntos, o modelo subajusta percepção (dados de imagem única limitados por batch) e sobreajusta estrutura (muitos dados multi-imagem / vídeo). Resultado: um modelo que segue padrões de raciocínio entre imagens mas é visualmente raso.

A ordenação do currículo te dá força perceptiva do estágio SI, depois raciocínio composicional/temporal do estágio OV, sem perder nenhum dos dois.

### Habilidades emergentes entre cenários

O artigo LLaVA-OneVision reporta três capacidades emergentes:

1. Raciocínio multi-câmera. Treinado em multi-imagem + vídeo separadamente; na inferência, pede pra raciocinar sobre uma cena de direção multi-câmera. O modelo integra corretamente as vistas apesar de nunca ter visto esse formato exato no treino.
2. Set-of-mark prompting. Usuário anota objetos numa imagem com marcações numeradas; o modelo raciocina sobre "o que a marcação 3 está fazendo relativo à marcação 7." Nunca foi treinado em marcações ou anotação; aprendeu da combinação de grounding espacial + referência multi-imagem.
3. Agente de screenshot de iPhone. Usuário fornece um screenshot de tela de iPhone e pede pra planejar o clique seguinte. Treinado em screenshots de UI, vídeos de fluxos de trabalho de usuário e pares multi-imagem antes/depois. Generaliza pro caso de uso de agente.

Essas não são tarefas treinadas; emergem da estrutura composicional do currículo.

### Pooling de tokens visuais

O orçamento de tokens exige pooling. OneVision usa interpolação bilinear na grade de patches 2D: 24x24 = 576 patches vira 12x12 = 144 (fator 2x) ou 8x8 = 64 (fator 3x). Pooling é feito no espaço da grade de patches, não no espaço de tokens, pra preservar localidade.

A escolha do fator de pooling por cenário é em si um hiperparâmetro. Menos pooling = mais tokens = representação mais rica. Mais pooling = menos tokens = mais frames / imagens cabem.

### LLaVA-OneVision-1.5

O follow-up de 2025 (LLaVA-OneVision-1.5, arXiv 2509.23661) é "totalmente aberto" em dados de treino, pesos do modelo e código. Igualgap a lacuna proprietária em alguns benchmarks e democratiza a receita. Mesmo currículo, mais dados, melhor LLM base. Sem mudança de arquitetura.

### Contraste com Qwen2.5-VL

Qwen2.5-VL (Lição 12.09) faz escolhas diferentes. Usa M-RoPE e FPS dinâmico em vez de pooling fixo. Seu orçamento escala com a entrada — um vídeo de 1 minuto usa mais tokens que um de 5 segundos. LLaVA-OneVision fixa o orçamento e escala o pooling. Ambos funcionam; trocam configurabilidade por previsibilidade.

## Use

`code/main.py` é um planejador de currículo e orçamento pra um VLM estilo OneVision. Dado um orçamento de tokens por amostra e uma mistura-alvo de cenários (digamos 40% imagem única, 30% multi-imagem, 30% vídeo), ele:

- Aloca resolução, fator de pooling e frames por cenário.
- Verifica que cada cenário cabe no orçamento compartilhado.
- Reporta contagem de tokens esperada, FLOPs do LLM e quais cenários estão sub-tokenizados.
- Imprime um cronograma de treino estágio a estágio.

Use pra planejar um fine-tuning OneVision ou pra sanity-check o custo por requisição de um deploy de VLM.

## Entregue

Essa lição produz `outputs/skill-onevision-budget-planner.md`. Dada uma distribuição-alvo de tarefas e um orçamento por amostra, emite o fator AnyRes, pooling por frame, contagem de frames de vídeo e pesos do estágio de currículo. Use sempre que treinar ou fizer fine-tuning de um VLM de cenário unificado.

## Exercícios

1. Seu produto suporta 80% imagem única, 10% multi-imagem (2-4 imagens), 10% vídeo (8-16 frames). Projetar o orçamento de tokens. Onde você colocaria o orçamento extra que economiza não fazendo multi-imagem pesado?

2. Leia Seção 4.3 do LLaVA-OneVision (capacidades emergentes). Proponha uma quarta habilidade emergente que o currículo provavelmente desbloquearia mas o artigo não reportou.

3. Troque a ordem do currículo — treine multi-imagem primeiro, depois imagem única, depois vídeo. Prevê quais benchmarks degradam e por quê.

4. O artigo reporta benchmarks de vídeo treinados com apenas 8 frames por amostra. Isso generaliza pra vídeos de 30 segundos na inferência? O que quebra primeiro — o orçamento de tokens ou o raciocínio temporal?

5. Pooling bilinear de patches 24x24 pra 12x12 é redução de 4x por dim. Implemente o pooling em Python stdlib e verifique que a média de cada bloco 2x2 bate com a saída bilinear.

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|-------------------------|
| Cenário OneVision | "Imagem única, multi-imagem ou vídeo" | Uma das três formas de entrada que o VLM unificado lida; o orçamento se mantém constante |
| Orçamento de tokens | "Quantos tokens por amostra" | Total de tokens visuais que o LLM vê por amostra de treino / inferência, tipicamente 3000-4000 |
| Currículo | "Ordem de treino" | Ordenação de estágios (imagem-única → multi-imagem → vídeo) escolhida pra transferência emergente |
| Pooling bilinear | "Encolhimento de tokens" | Aplica interpolação bilinear na grade de patches (2D) pra reduzir contagem de tokens preservando localidade |
| Habilidade emergente | "Não treinada, ainda funciona" | Capacidade que aparece na inferência sem dados de treino correspondentes, devido à composição do currículo |
| AnyRes-k | "Configuração k-tile" | k sub-tiles de resolução fixa mais um thumbnail, típico k ∈ {4, 9} |
| Transferência de tarefa | "Generalização entre cenários" | Habilidades aprendidas em imagem única que se aplicam a vídeo (e vice-versa) via backbone compartilhado |

## Leitura Complementar

- [Li et al. — LLaVA-OneVision (arXiv:2408.03326)](https://arxiv.org/abs/2408.03326)
- [LLaVA-OneVision-1.5: Fully Open Framework (arXiv:2509.23661)](https://arxiv.org/abs/2509.23661)
- [Lin et al. — Video-LLaVA (arXiv:2311.10122)](https://arxiv.org/abs/2311.10122)
- [Lin et al. — VILA (arXiv:2312.07533)](https://arxiv.org/abs/2312.07533)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)