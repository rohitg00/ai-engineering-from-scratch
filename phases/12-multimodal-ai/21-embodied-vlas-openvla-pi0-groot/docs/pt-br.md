# VLAs Embodiment: RT-2, OpenVLA, π0, GR00T

> A primeira vez que um modelo leu uma receita de um site e executou num robô de cozinha foi o RT-2 (Google DeepMind, julho de 2023). RT-2 discretizou ações como tokens de texto, fez co-fine-tuning de um VLM em dados web mais dados de ação de robô, e provou que conhecimento visão-linguagem em escala web transfere para controle robótico. OpenVLA (junho de 2024) lançou a referência aberta de 7B. A série π0 da Physical Intelligence (2024-2025) adicionou experts de ação por flow-matching. GR00T N1 da NVIDIA (março de 2025) entregou controle dual-system (Sistema 1 / Sistema 2) para robôs humanoides em escala. A primitiva VLA — visão-linguagem-ação, um modelo único que vê, lê e age — é a ponte entre os modelos de compreensão desta fase e os sistemas autônomos na Fase 15.

**Tipo:** Aprendizado
**Linguagens:** Python (stdlib, tokenizador de ação + esqueleto de inferência VLA)
**Pré-requisitos:** Fase 12 · 05 (LLaVA), Fase 15 (Sistemas Autônomos, referenciado)
**Tempo:** ~180 minutos

## Objetivos de Aprendizado

- Descrever tokenização de ação: codificação por bins discretos (RT-2), tokens de ação eficientes FAST, ações contínuas por flow-matching (π0).
- Explicar por que co-fine-tuning em dados web + dados de robô preserva a transferência de conhecimento geral para tarefas novas.
- Comparar OpenVLA (Llama+VLM aberto de 7B), π0 (flow-matching), e GR00T N1 (dual-system) na mesma tarefa robótica.
- Nomear o dataset Open X-Embodiment e seu papel como corpus de treinamento do RT-X.

## O Problema

Um robô que faz tarefas domésticas a partir de instruções em linguagem natural tem sido um alvo de pesquisa desde os anos 70. A resposta dos anos 2020: um modelo de visão-linguagem-ação (VLA). Mesma arquitetura VLM usada para VQA, mas a saída são ações (torques articulares, poses do efetuador final, comandos discretos) em vez de texto.

Desafios específicos de VLAs:

1. Espaços de ação são contínuos (ângulos articulares, forças) e de alta dimensionalidade (braço de 7 DOF + garra de 3 DOF = 10 dimensões a 30 Hz).
2. Dados de treinamento específicos de robô são escassos. Open X-Embodiment tem ~1M de trajetórias; texto-imagem web tem 5B+.
3. Frequência de controle importa. Loop de controle a 30 Hz significa orçamento de 33ms por ação.
4. Segurança. Uma ação errada danifica hardware, humanos ou propriedade.

## O Conceito

### Tokenização de ação (RT-2)

A sacada do RT-2: representar cada alvo articular como um token de texto quantizado. Discretizar o intervalo normalizado [-1, 1] em 256 bins, mapear cada bin para um ID de vocabulário. Uma ação de 10 DOF vira 10 tokens a cada passo de controle.

Co-fine-tune de um VLM PaLM-X numa mistura:

- Pares imagem-texto web (captioning, VQA).
- Demonstrações de robô, ação como tokens.

O modelo vê "pegue o cubo vermelho" (linguagem) → imagem (visão) → sequência de 10 tokens de ação (alvos articulares discretizados). Pré-treinamento web preserva transferência de conhecimento geral: RT-2 consegue seguir "mova em direção ao objeto em movimento rápido" mesmo que "movimento rápido" não esteja nos dados de treinamento.

Inferência a 3-5 Hz no artigo do RT-2, limitado pelo decode autoregressivo do VLM.

### OpenVLA — a referência aberta de 7B

OpenVLA (Kim et al., junho de 2024) é o equivalente aberto de pesos do RT-2. Backbone Llama de 7B, encoder visual dual DINOv2 + SigLIP, tokenização de ação sobre 256 bins.

Treinado no Open X-Embodiment (970k trajetórias em 22 robôs). Vem com suporte a fine-tuning via LoRA para adaptar a novos robôs.

Inferência: 4-5 Hz num A100 com quantização. Rápido o suficiente para manipulação lenta, não pra controle de alta frequência.

### Tokenizador FAST — decode de ação mais rápido

Pertsch et al. (2024) mostraram que tokenização por bins discretos é ineficiente — a maioria das ações se agrupa numa região pequena do espaço de bins. FAST (Frequency-domain Action Sequence Tokenizer) comprime sequências de ação via DCT e quantiza os coeficientes.

Uma trajetória de 30 passos de ação vira ~10 tokens FAST em vez de 300 tokens por bins discretos. Inferência acelera 3-5x sem perda de qualidade.

### π0 e ações por flow-matching

π0 da Physical Intelligence (Black et al., outubro de 2024) substitui tokens de ação discretos por um expert de ação por flow-matching:

- Um transformer pequeno de ação lê os hidden states do VLM e emite uma sequência contínua de 50 passos de ação via rectified flow.
- A cabeça de ação treina com perda de flow-matching; pré-treinamento do VLM fica inalterado.
- Inferência: sequência completa de ação emitida em ~5 passos de denoising, efetivamente controle a 50 Hz.

A afirmação do π0: supera OpenVLA e Octo numa ampla suíte de tarefas de manipulação. A formulação de ação contínua preserva suavidade que a discretização destrói.

π0.5 e π0-FAST são upgrades incrementais. π0-FAST combina tokenização FAST com flow-matching.

### GR00T N1 — dual-system para humanoides

GR00T N1 da NVIDIA (março de 2025) é construído para robôs humanoides (>30 DOF, corpo inteiro):

- Sistema 2: um VLM grande lendo cena + instrução, produzindo subgoals de alto nível a ~1 Hz.
- Sistema 1: um transformer pequeno de ação produzindo comandos articulares de baixo nível a 50-100 Hz condicionado nos subgoals.

A divisão mapeia pra teoria de raciocínio rápido e lento de Kahneman: Sistema 2 planeja, Sistema 1 age. Benefícios: planejamento lento no tamanho do VLM não bloqueia controle rápido; Sistema 1 fica pequeno pra manter latência baixa.

GR00T N1.7 (fim de 2025) melhora escala de dados. GR00T fine-tuna com dados sim-to-real do Omniverse.

### Open X-Embodiment

Os dados de treinamento. RT-X (outubro de 2023) reuniu 22 datasets cobrindo 1M de trajetórias em 22 robôs. Open X-Embodiment é o corpus que todo mundo usa:

- ALOHA / Bridge V2 / Droid / RT-2 Kitchen / Language Table.
- Cada amostra: (estado do robô, visões de câmera, instrução, sequência de ação).
- Higiene de treinamento: unificar espaço de ação, normalizar intervalos articulares, redimensionar câmeras.

OpenVLA e π0 treinam no Open X-Embodiment. Gap de domínio para qualquer robô específico é fechado com fine-tuning LoRA em 100-1000 demos específicas de tarefa.

### Co-fine-tuning vs apenas robô

Co-fine-tuning mistura dados web de VQA com trajetórias de robô. A proporção importa: muito VQA e o modelo esquece ações; muitos dados de robô e o modelo perde conhecimento geral.

Proporção do RT-2: ~1:1. OpenVLA: ~0.5:1 web-to-robô. π0: similar. A proporção exata é um hiperparâmetro pra sintonizar por tamanho de dataset.

Treinamento só com robôs produz modelos específicos de tarefa que falham em instruções fora de distribuição. Co-fine-tuning é a diferença entre "pegue o cubo vermelho (na demonstração)" e "pegue o terceiro maior objeto da esquerda (formulação nova)."

### Segurança e limites de ação

Todo VLA em produção vem com:

- Limites duros de articulação (não pode aplicar torque além da especificação).
- Limites de velocidade (clipping suave).
- Limites do espaço de trabalho (efetuador final não pode sair da mesa).
- Aprovação humana no loop para tarefas novas.

Esses ficam fora do VLA como verificações na camada de controle. Saída do VLA é uma sugestão, não um comando.

## Use

`code/main.py`:

- Implementa tokenização de ação por 256 bins e de-tokenização.
- Esboça um tokenizador FAST baseado em DCT + quantização.
- Compara contagem de tokens por passo de ação entre (bins discretos, FAST, fluxo contínuo).
- Imprime resumo da linhagem RT-2 → OpenVLA → π0 → GR00T.

## Entregue

Esta aula produz `outputs/skill-vla-action-format-picker.md`. Dada uma tarefa robótica (manipulação, navegação, corpo inteiro humanoide), escolhe entre bins discretos + RT-2, FAST + OpenVLA, flow-matching + π0, ou dual-system + GR00T.

## Exercícios

1. Braço de 10 DOF com taxa de controle de 30 Hz. Tokenização por bins discretos a 256 bins emite quantos tokens por segundo? Um VLM de 7B consegue acompanhar?

2. Tokenização FAST comprime trajetórias de 30 passos para ~10 tokens. O que o usuário perde se a trajetória tem movimento de alta frequência (ex: bater)?

3. A cabeça de flow-matching do π0 denoisa em ~5 passos. Compare o throughput com o decode autoregressivo do OpenVLA a 4-5 Hz.

4. A divisão Sistema 1 / Sistema 2 do GR00T mapeia pra Kahneman. Proponha uma divisão diferente (Sistema 3?) que possa ajudar em caminhada bípede.

5. Leia a Seção 4 do Open X-Embodiment sobre curadoria de dataset. Nomeie as três regras de curadoria que prevenem vazamento de domínio.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|--------------------------|
| VLA | "Visão-linguagem-ação" | Modelo que recebe imagem + instrução e emite comandos de ação |
| Tokenização de ação | "Bins discretos" | Quantiza alvos articulares contínuos em 256 bins por dimensão, cada um um ID de vocabulário |
| Tokenizador FAST | "Tokens de ação em frequência" | DCT + quantização pra comprimir trajetórias de 30 passos em ~10 tokens |
| Co-fine-tune | "Mistura web + robô" | Treina em dados de VQA web junto com demos de robô pra preservar conhecimento geral |
| Cabeça de ação flow-matching | "Saída contínua π0" | Transformer pequeno que emite sequência de 50 passos de ação via rectified flow |
| Sistema 1 / Sistema 2 | "Controle dual-system" | VLM grande planeja devagar, cabeça de ação pequena age rápido; padrão GR00T |
| Open X-Embodiment | "Dataset RT-X" | Dataset cross-robô com 1M de trajetórias; o corpus de treinamento |

## Leitura Adicional

- [Brohan et al. — RT-2 (arXiv:2307.15818)](https://arxiv.org/abs/2307.15818)
- [Kim et al. — OpenVLA (arXiv:2406.09246)](https://arxiv.org/abs/2406.09246)
- [Black et al. — π0 (arXiv:2410.24164)](https://arxiv.org/abs/2410.24164)
- [NVIDIA — GR00T N1 (arXiv:2503.14734)](https://arxiv.org/abs/2503.14734)
- [Open X-Embodiment Collab — RT-X (arXiv:2310.08864)](https://arxiv.org/abs/2310.08864)
