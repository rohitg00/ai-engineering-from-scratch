# LLaVA-OneVision: Imagem única, imagem múltipla, vídeo em um modelo

> Antes de LLaVA-OneVision (Li et al., agosto de 2024) o mundo de VLM aberto tinha linhagens separadas: LLaVA-1.5 para imagens individuais, modelos de imagens múltiplas como Mantis e VILA, modelos de vídeo como Video-LLaVA e Video-LLaMA. Cada um ganhou o seu valor de referência e falhou nos outros. A LLaVA-OneVision argumentou que um único currículo poderia treinar um modelo para dominar os três cenários, e que os efeitos emergentes de transferência de tarefas (habilidades de imagem única exportadas para vídeo, raciocínio de imagem múltipla exportado para imagem única) superaram a soma de especialistas. A receita é deceptivamente simples: um orçamento visual equilibrado entre cenários, além de um currículo explícito que passa de uma imagem única para OneVision (multi-imagem) para vídeo. Esta lição lê o orçamento, o currículo e os comportamentos emergentes.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, token budget solver + curriculum planner)
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 12 · 06 (any-resolution)
**Time:** ~180 minutes

## Objetivos de aprendizagem

- Desenhe um orçamento visual-token que permaneça equilibrado em entrada de imagem única, imagem múltipla e vídeo.
- Encomenda um currículo de formação que transfira habilidades de uma única imagem para um vídeo sem esquecer catastrófico.
- Explique por que um único modelo supera os especialistas na mesma contagem de parâmetros quando o currículo é feito corretamente.
- Cite as três capacidades emergentes relatadas pela LLaVA-OneVision: raciocínio com várias câmeras, solicitação de marcação, agente de captura de tela do iPhone.

## O problema

Imagem, multi-imagem e vídeo cada um enfatizam um modelo de forma diferente.

A imagem única requer tokens de alta resolução (AnyRes, ~ 2880 tokens visuais) para capturar OCR e detalhes finos. Orçamento por amostra: uma imagem, 2880 tokens.

Multi-imagem quer várias imagens com resolução moderada (~ 576 tokens cada) para que o raciocínio entre imagens se encaixa no contexto. Orçamento por amostra: 4-8 imagens, 576 cada, 2300-4600 tokens.

O vídeo precisa de muitos quadros com baixa resolução (~ 196 tokens por quadro após a agregação) para capturar a dinâmica temporal. Orçamento por amostra: 8-32 quadros, 196 cada, 1600-6200 tokens.

Se treinarmos modelos separados, escolheremos um orçamento. Se treinarmos um modelo, precisamos do orçamento para escalar sensatamente em todos os cenários sem estragar o contexto.

Antes da OneVision, a resposta padrão era "treinar um cenário, ignorar os outros". Video-LLaVA retrofittado vídeo em um modelo de imagem com etapas de treinamento extra. LLaVA-NeXT adicionou suporte a imagem múltipla com azulejos. Nenhum manuseou as três limpos.

## O conceito

### O orçamento do token OneVision

LLaVA-OneVision não fixa uma contagem exata de tokens. Balança a contagem máxima de tokens visuais por amostra, de modo que os três cenários aterram na mesma faixa, aproximadamente 6.000 a 9.000 tokens, atribuídos de forma diferente por cenário:

- Imagem única: AnyRes-Max-9 (até 9 azulejos + uma visão base), cada visão 384x384 dando 729 tokens do SigLIP SO400M. Maximo: 729 * (1 + 9) = 7290 tokens.
- Multi-imagem: cada imagem em 384 sem telas, 729 tokens sem pooling. Até 12 imagens → 8748 tokens.
- Vídeo: até 32 quadros em 384 com 2x2 bilinear pooling → 196 tokens por quadro.

A atribuição mantém os totais máximos na mesma faixa, de modo que nenhum cenário domina o contexto ou o gradiente.`code/main.py`O planeador abaixo usa um orçamento de brinquedos menor de 4096 para mostrar a mesma lógica de equilíbrio.

### O currículo em três fases

Os trens LLaVA-OneVision são divididos em três fases:

1. SFT de imagem única (estadio SI). Todos os dados são de imagem única e texto. Treinar com entrada AnyRes de alta resolução. Isso ensina percepção, OCR e compreensão de grãos finos.
2. OneVision SFT (estadio OV). Misture imagem única + imagem múltipla + vídeo (quadros de amostra uniformemente). Treine no orçamento de token unificado. Isso ensina o modelo a lidar com formas de lote heterogêneas. Nenhum reset de peso continua a partir do estágio SI.
3. Transferência de tarefas (fase TT). Continuar com um mix de tarefas alvo, normalmente mais pesado em imagem ou vídeo múltipla dependendo do produto. Opcional de ajuste fino para implantação.

O estudo também mostra que a formação de vídeo primeiro ou de imagem múltipla primeiro produz um desempenho de imagem pior do que a imagem única primeiro, mesmo com os mesmos dados.

### Por que o currículo funciona

O treinamento de imagem única constrói a base perceptiva. Os tokens de patch carregam características visuais de grãos finos; o LLM aprende a integrá-los com o texto. A imagem e o vídeo multi-introduem desafios estruturais (que imagem é qual, o que aconteceu primeiro) que são difíceis de aprender sem uma base perceptiva forte.

Se você treinar todos os cenários a partir do zero juntos, o modelo não se encaixa na percepção (data limitada de imagem única por lote) e na estrutura de sobre-excesso (muitos dados de imagem / vídeo).

A ordem do currículo dá-lhe força de percepção a partir da fase SI, depois raciocínio composto/temporal a partir da fase OV, sem perder nenhum.

### Competências emergentes em situações transversais

O artigo LLaVA-OneVision relata três capacidades emergentes:

1. Raciocínio com várias câmeras. Treinado em várias imagens + vídeo separadamente; em inferência, solicitado a raciocínio sobre uma cena de condução com várias câmeras. O modelo integra corretamente as visões apesar de nunca ver esse formato exato no treinamento.
2. Instrução de conjunto de marcas. O usuário anota objetos em uma imagem com marcas numeradas; o modelo argumenta sobre "o que a marca 3 faz em relação à marca 7." Treinado nem em marcas nem anotações; aprendido a partir da combinação de aterragem espacial + referência de imagem múltipla.
3. Agente de captura de tela do iPhone. O usuário fornece uma captura de tela de uma tela do iPhone e pede para planejar o próximo clique. Fornecido em captura de tela da interface, vídeo dos fluxos de trabalho do usuário e imagem múltipla antes / depois de pares. Generaliza para o caso de uso do agente.

Estas não são tarefas formadas; emergem da estrutura composta do currículo.

### Compartilhamento de tokens visuais

O orçamento de tokens requer pooling. OneVision usa interpolação bilinear na grade de parches 2D: 24x24 = 576 parches torna-se 12x12 = 144 (2x factor) ou 8x8 = 64 (3x factor).

A escolha de um fator de pooling por cenário é em si um hiperparâmetro. Menos pooling = mais tokens = representação mais rica.

### LLaVA-OneVision-1.5

O seguimento de 2025 (LLaVA-OneVision-1.5, arXiv 2509.23661) é "totalmente aberto" em dados de treinamento, pesos de modelo e código.

### Contraste com Qwen2.5-VL

Qwen2.5-VL (Lessão 12.09) faz escolhas diferentes. Utiliza M-RoPE e FPS dinâmico em vez de pooling fixo. Suas escalas de orçamento com entrada  um vídeo de 1 minuto usa mais tokens do que um vídeo de 5 segundos. LLaVA-OneVision fixa o orçamento e escala o pooling. Ambos funcionam; eles trocam configurabilidade por previsibilidade.

```figure
l5-onevision-budget
```

## Usá-lo

`code/main.py`É um planejador curricular e orçamental para um VLM de estilo OneVision. Dada uma quantidade de tokens por amostra e uma mistura de cenários-alvo (por exemplo, 40% de imagem única, 30% de imagem múltipla, 30% de vídeo), ele:

- Aloca resolução, fator de agregação e quadros por cenário.
- Verifica que cada cenário se encaixa no orçamento compartilhado.
- Relatórios de contabilidade de tokens esperados, FLOPs de LLM e quais cenários são sub-tokenizados.
- Imprime um cronograma de treinamento passo a passo.

Usá-lo para planejar um ajuste da OneVision ou para verificar o custo por pedido de uma implantação de VLM.

## Envia-o

Esta lição produz`outputs/skill-onevision-budget-planner.md`. Dada uma distribuição de tarefas-alvo e um orçamento por amostra, ele emite o fator AnyRes, o pooling por quadro, a contagem de quadros de vídeo e os pesos de estágios do currículo.

## Exercícios

1. O seu produto suporta 80% de imagem única, 10% de imagem multi (2-4 imagens), 10% de vídeo (8-16 quadros).

2. Leia a Seção 4.3 (Capacidades emergentes) do LLaVA-OneVision. Propõe uma quarta habilidade emergente que o currículo provavelmente desbloquearia, mas o artigo não relatou.

3. Troque a ordem do currículo  treine a imagem múltipla primeiro, depois a imagem única, depois o vídeo.

4. O artigo relata que os benchmarks de vídeo treinados em apenas 8 quadros por amostra. Isso se generaliza para vídeos de 30 segundos na inferência?

5. A combinação bilinear de 24x24 patches para 12x12 é uma redução de 2x por dimensão, então 4x menos tokens. Implementar a combinação em stdlib Python e verificar que a média sobre cada bloco 2x2 corresponde à saída bilinear.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| OneVision scenario | "Single-image, multi-image, or video" | One of three input shapes the unified VLM handles; the budget stays balanced across |
| Token budget | "How many tokens per sample" | Total visual tokens the LLM sees per training / inference sample, about 6k to 9k at most in LLaVA-OneVision |
| Curriculum | "Training order" | Stage ordering (single-image → multi-image → video) chosen for emergent transfer |
| Bilinear pooling | "Token shrink" | Applying bilinear interpolation to the patch grid (2D) to reduce token count while preserving locality |
| Emergent skill | "Not trained, still works" | Capability that appears at inference without matching training data, due to curriculum composition |
| AnyRes-k | "k-tile setup" | k sub-tiles of fixed resolution plus one thumbnail, typical $k \in \lbrace 4, 9 \rbrace$ |
| Task transfer | "Cross-scenario generalization" | Skills learned on single-image that apply to video (and vice versa) via shared backbone |

## Mais leitura

- [Li et al. — LLaVA-OneVision (arXiv:2408.03326)](https://arxiv.org/abs/2408.03326)
- [LLaVA-OneVision-1.5: Fully Open Framework (arXiv:2509.23661)](https://arxiv.org/abs/2509.23661)
- [Lin et al. — Video-LLaVA (arXiv:2311.10122)](https://arxiv.org/abs/2311.10122)
- [Lin et al. — VILA (arXiv:2312.07533)](https://arxiv.org/abs/2312.07533)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
