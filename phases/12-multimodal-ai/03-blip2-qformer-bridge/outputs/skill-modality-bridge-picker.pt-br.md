---
name: modality-bridge-picker
description: Recomende Q-Former vs projetor MLP vs reamostrador Perceiver para uma configuração VLM dado orçamento de token, meta de qualidade e computação de treinamento.
version: 1.0.0
phase: 12
lesson: 03
tags: [blip2, qformer, vlm, modality-bridge, architecture]
---

Dada a contagem de tokens de um codificador de visão por imagem, o orçamento de contexto do LLM, o número alvo de imagens por prompt e o orçamento de computação de treinamento, recomende qual ponte de modalidade usar e justifique com contagens de parâmetros e economia de tokens.

Produzir:

1. Auditoria orçamentária simbólica. Relate tokens brutos por imagem do codificador de visão, tokens por imagem após cada opção de ponte e a fração do contexto LLM consumido nas contagens declaradas de imagem por prompt.
2. Comparação de pontes. Para cada um dos Q-Former (32 tokens, ~ 188 milhões de parâmetros), projetor MLP (todos os patches, ~ 20 milhões de parâmetros) e reamostrador Perceptor (K consultas aprendíveis por meio de atenção cruzada de N camadas, variável), forneça parâmetros, proxies de qualidade e estimativa de custo de treinamento.
3. Recomendação. Melhor escolha única para as restrições declaradas, com justificativa de uma linha. Sinalize quando as restrições são contraditórias (alta qualidade + orçamento de token apertado + baixa computação de treinamento).
4. Rastreamento de treinamento em dois estágios. Se o Q-Former for escolhido, descreva as perdas ITC + ITM + ITG para o estágio 1 e a perda de LM para o estágio 2. Nomeie um conjunto de dados representativo para cada um (COCO, LAION, Genoma Visual).
5. Lista de verificação de ablação. Cinco experimentos que o chamador deve executar antes de bloquear a ponte (contagem de consultas, dois estágios versus estágio único, profundidade do projetor, programação de congelamento, subconjunto de ajuste fino).

Rejeições difíceis:
- Qualquer recomendação que ignore o orçamento de tokens. "Usar MLP" com 576 tokens por imagem falha em 10 imagens em um contexto de 4k.
- Afirmar que Q-Former domina estritamente o MLP. Em tarefas de alta qualidade com imagem única e contexto ilimitado, o MLP vence.
- Tratar o reamostrador Perceiver como equivalente ao Q-Former. Flamingo aplica-o em todas as camadas do LLM; BLIP-2 aplica-o uma vez.

Regras de recusa:
- Se o chamador solicitar uma ponte que possa lidar com vídeo sem especificar quantos quadros e em qual taxa de quadros, recuse - as pontes de vídeo diferem das pontes de imagem única pela especificação, não apenas pela escala.
- Se o LLM no escopo for treinado do zero com a torre de visão (fusão precoce, estilo Camaleão), recuse — a Lição 12.11 cobre esse caso separadamente.
- Se nenhum cálculo de treinamento for declarado, recuse e pergunte se o chamador pode pagar o estágio 2 do BLIP-2 (cerca de algumas centenas de A100 horas) ou apenas treinamento somente com projetor.

Resultado: uma recomendação de ponte de uma página com matemática simbólica, contagens de parâmetros, arquitetura recomendada, esboço de treinamento e lista de verificação de ablação. Termine com um parágrafo "o que ler a seguir" apontando para a Lição 12.04 (Flamingo) para atenção cruzada em todos os lugares, Lição 12.05 (LLaVA) apenas para MLP ou Lição 12.07 (ablações) para a compensação entre dados e arquitetura.