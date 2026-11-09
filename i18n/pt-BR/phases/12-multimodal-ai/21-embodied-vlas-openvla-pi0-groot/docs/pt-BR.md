# VLAs incorporados: RT-2, OpenVLA, π0, GR00T

> A primeira vez que um modelo leu uma receita de um site e a executou em um robô de cozinha foi RT-2 (Google DeepMind, julho de 2023). RT-2 discretou ações como tokens de texto, co-finou um VLM em dados web mais dados de ação de robôs, e provou que a escala web de linguagem de visão transfere conhecimento para controle robótico. O OpenVLA (Junho de 2024) enviou a referência aberta 7B. A série π0 da Inteligência Física (2024-2025) adicionou especialistas em ação de correspondência de fluxo. O GR00T N1 da NVIDIA (março de 2025) forneceu controle de sistema duplo (Sistema 1 / Sistema 2) para robôs humanoides em escala. O VLA primitivo  ação de linguagem de visão, um único modelo que vê, lê e age  é a ponte entre os modelos de compreensão desta fase e os sistemas autônomos na Fase 15.

**Type:** Learn
**Languages:** Python (stdlib, action tokenizer + VLA inference skeleton), TypeScript
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 15 (Autonomous Systems, referenced)
**Time:** ~180 minutes

## Objetivos de aprendizagem

- Descrever a tokenização de ação: codificação discreta de bin (RT-2), tokens de ação eficientes FAST, ações de correspondência contínua de fluxo (π0).
- Explique por que a co-ajustação dos dados da web + dos robôs preserva a transferência de conhecimentos gerais para novas tarefas.
- Compare OpenVLA (aberto 7B Llama+VLM), π0 (corresponsão de fluxo) e GR00T N1 (sistema duplo) na mesma tarefa robótica.
- Cite o conjunto de dados Open X-Embodiment e o seu papel como corpo de formação RT-X.

## O problema

Um robô que faz tarefas a partir de instruções de linguagem natural tem sido um alvo de pesquisa desde a década de 1970. A resposta da década de 2020: um modelo de ação de linguagem de visão (VLA). A mesma arquitetura VLM usada para VQA, mas a saída é ações (torques conjuntos, poses de efetores finais, comandos discretos) em vez de texto.

Desafios específicos dos VLA:

1. Os espaços de acção são contínuos (ângulos conjuntos, forças) e de alta dimensão (7-DOF braço + 3-DOF aderente = 10 dims a 30 Hz).
2. Os dados de treinamento específicos para robôs são escassos. O Open X-Embodiment tem ~ 1M trajetórias; imagem de texto na web é 5B +.
3. O circuito de controlo de 30 Hz significa um orçamento de 33 ms por ação.
4. Ação errada danifica hardware, humanos ou propriedades.

## O conceito

### Tokenization de ações (RT-2)

RT-2 truque: representar cada alvo conjunto como um token de texto quantizado. Discrete o normal [-1, 1] gama em 256 canas, mapear cada canha para um vocabulário ID. Uma ação de 10 DOF se torna 10 tokens em cada etapa de controle.

Co-finação de um VLM PaLM-X em uma mistura:

- Pares de imagem e texto da Web (captioning, VQA).
- Demonstrações de robôs, ação como tokens.

O modelo vê "colher o cubo vermelho" (linguagem) → imagem (visão) → sequência de ação de 10 tokens (alvos conjuntos discretos). O treinamento pré-web preserva a transferência de conhecimento geral: RT-2 pode seguir "mover-se em direção ao objeto em movimento rápido" mesmo que "muover-se rápido" não esteja em dados de treinamento.

Inferência de 3 a 5 Hz no papel RT-2, limitada pelo decodificação autoregressiva VLM.

### OpenVLA  a referência aberta 7B

OpenVLA (Kim et al., junho 2024) é o equivalente RT-2 de peso aberto. 7B Llama backbone, DINOv2 + SigLIP dual vision encoder, tokenization de ação em 256 canas.

Formada em Open X-Embodiment (970 mil trajetórias em 22 robôs).

Inferência: 4-5 Hz em um A100 com quantização.

### FAST tokenizer  decodificação de ação mais rápida

Pertsch et al. (2024) mostrou que a tokenização discreta bin é ineficiente  a maioria das ações agrupam-se em uma pequena região do espaço bin. FAST (Frequency-domain Action Sequence Tokenizer) comprime as sequências de ação através de DCT e quantiza os coeficientes.

Uma trajetória de ação de 30 passos torna-se ~ 10 tokens FAST em vez de 300 tokens discretos.

### π0 e ações de correspondência de fluxo

A π0 da Inteligência Física (Black et al., outubro de 2024) substitui os tokens de ação discretos por um especialista em ação de correspondência de fluxo:

- Um pequeno transformador de ação lê os estados ocultos do VLM e produz uma sequência de ação contínua de 50 passos através de fluxo rectificado.
- A cabeça de ação entra com perda de correspondência de fluxo; o VLM permanece inalterado antes do treino.
- Inferência: sequência de ação completa emitida em ~5 passos de denotação, controlo efetivo de 50 Hz.

A fórmula de acção contínua preserva a suavidade que a discretizão destrói.

π0.5 e π0-FAST são atualizações incrementais. π0-FAST combina a tokenização FAST com a correspondência de fluxo.

### GR00T N1  Sistema duplo para humanoides

A GR00T N1 da NVIDIA (março 2025) é construída para robôs humanoides (> 30 DOF, corpo inteiro):

- Sistema 2: uma grande cena de leitura VLM + instrução, produzindo sub-objetivos de alto nível em ~ 1 Hz.
- Sistema 1: um pequeno transformador de cabeça de ação que produz comandos conjuntos de baixo nível de 50-100 Hz condicionados aos subobjetivos.

Os mapas divididos para o pensamento rápido e lento de Kahneman: planos do sistema 2, o sistema 1 atua. Benefícios: planejamento lento do tamanho VLM não bloqueia o controle rápido; o sistema 1 permanece pequeno para a latência.

GR00T N1.7 (final de 2025) melhora a escalação de dados. GR00T sintoniza com dados sim-to-real do Omniverse.

### O corpo X aberto

Os dados de treinamento. RT-X (outubro de 2023) reuniram 22 conjuntos de dados que cobrem 1M de trajetórias em 22 robôs.

- ALOHA / Bridge V2 / Droid / RT-2 Kitchen / Language Table.
- Cada amostra: (estado do robô, visualização da câmera, instrução, sequência de ação).
- Higiene de treinamento: unificar espaço de ação, normalizar os rangos articulares, redimensionar as câmeras.

OpenVLA e π0 treinam em Open X-Embodiment.

### Co-ajuste perfeito versus apenas robô

A co-ajuste de qualidade mistura dados VQA da web com trajetórias de robôs. A relação importa: muito VQA e o modelo esquece ações; muito dados robóticos e o modelo perde conhecimento geral.

Ratio RT-2: ~1:1. OpenVLA: ~0.5:1 web-to-robot. π0: similar. A relação precisa é um hiperparâmetro para sintonizar por tamanho de conjunto de dados.

O treinamento apenas com robôs produz modelos específicos de tarefas que falham em instruções fora da distribuição. Co-fine-tuning é a diferença entre "colher o cubo vermelho (em demonstração) " e "colher o terceiro maior objeto da esquerda (fraseamento de novidade). "

### Limite de segurança e de acção

Todos os navios VLA de produção com:

- Limites de articulação rígida (não pode passar o torque da especificação).
- Limite de velocidade (clipagem suave).
- Limitações do espaço de trabalho (o efetor final não pode sair da mesa).
- Homem em curso de aprovação para novas tarefas.

Estes estão fora do VLA como controles de camada de controle.

```figure
mm-action-tokens
```

## Usá-lo

`code/main.py`- Não .

- Implementa tokenização e destokenização de ações de 256 bin.
- Esboça um tokenizer FAST baseado na quantização DCT +.
- Comparar o número de tokens por passo de ação (bin discreto, FAST, fluxo contínuo).
- Imprime um resumo de linhagem de RT-2 → OpenVLA → π0 → GR00T.

## Envia-o

Esta lição produz`outputs/skill-vla-action-format-picker.md`. Dada uma tarefa robótica (manipulação, navegação, corpo humanoide), escolha entre bin discreto + RT-2, FAST + OpenVLA, fluxo de correspondência + π0, ou sistema duplo + GR00T.

## Exercícios

1. Um braço de 10 DOF com uma taxa de controlo de 30 Hz. A tokenization de bin discretos em 256 canteiros emite quantos tokens por segundo?

2. A tokenization FAST comprime as trajetórias de 30 passos para ~ 10 tokens. O que perde o usuário se a trajetória tiver movimento de alta frequência (por exemplo, bateria)?

3. A cabeça de correspondência de fluxo de π0 denota em ~ 5 passos. Compare a passagem com o decodificador autoregressivo do OpenVLA em 4-5 Hz.

4. O Sistema 1 / Sistema 2 do GR00T divide mapas para Kahneman. Propõe uma divisão diferente (Sistema 3?) que possa ajudar a caminhada bipedal.

5. Leia a Seção 4 do Open X-Embodiment sobre curatividade de conjuntos de dados.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| VLA | "Vision-language-action" | Model that takes image + instruction and outputs action commands |
| Action tokenization | "Discrete bins" | Quantize continuous joint targets into 256 bins per dim, each a vocab ID |
| FAST tokenizer | "Frequency action tokens" | DCT + quantize to compress 30-step trajectories to ~10 tokens |
| Co-fine-tune | "Mix web + robot" | Train on web VQA data alongside robot demos to preserve general knowledge |
| Flow-matching action head | "π0 continuous output" | Small transformer that outputs a 50-step action sequence via rectified flow |
| System 1 / System 2 | "Dual-system control" | Large VLM plans slowly, small action head acts quickly; GR00T pattern |
| Open X-Embodiment | "RT-X dataset" | 1M-trajectory cross-robot dataset; the training corpus |

## Mais leitura

- [Brohan et al. — RT-2 (arXiv:2307.15818)](https://arxiv.org/abs/2307.15818)
- [Kim et al. — OpenVLA (arXiv:2406.09246)](https://arxiv.org/abs/2406.09246)
- [Black et al. — π0 (arXiv:2410.24164)](https://arxiv.org/abs/2410.24164)
- [NVIDIA — GR00T N1 (arXiv:2503.14734)](https://arxiv.org/abs/2503.14734)
- [Open X-Embodiment Collab — RT-X (arXiv:2310.08864)](https://arxiv.org/abs/2310.08864)
