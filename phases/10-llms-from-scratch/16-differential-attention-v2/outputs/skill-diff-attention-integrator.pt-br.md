---
name: diff-attention-integrator
description: Plano de integração para adicionar Atenção Diferencial V2 a uma nova execução de pré-treinamento ou ajuste fino de LoRA.
version: 1.0.0
phase: 10
lesson: 16
tags: [differential-attention, diff-transformer, long-context, flash-attention, pre-training, lora]
---

Dada uma arquitetura de modelo (oculto, cabeças, cabeças KV, camadas, d_head), um comprimento de contexto alvo, uma alucinação ou perfil de contexto longo (modos de falha em suas avaliações existentes) e um orçamento de treinamento (tokens disponíveis, horas de GPU), produza um plano de integração para DIFF V2.

Produzir:

1. Modo de integração. Pré-treinamento desde o início, troca de arquitetura no meio do treinamento ou ajuste fino de LoRA nas projeções Q. Justifique a escolha face ao orçamento de formação e aos pesos disponíveis existentes.
2. Diferença de arquitetura. Lista concreta de alterações campo por campo: quais projeções crescem, quais permanecem as mesmas, qual contagem de parâmetros você está adicionando e onde a subtração é colocada no bloco de atenção. Incluir programação `lambda_init` por profundidade de camada (`0.8 - 0.6 * exp(-0.3 * (depth - 1))` é o padrão do papel; ajuste por profundidade se a telemetria em camadas mostrar instabilidade).
3. Escolha do kernel. Confirme o suporte do FlashAttention 2 ou 3, dada a duplicação do número de funcionários da V2. Rejeite o caminho do kernel personalizado da V1, a menos que o usuário precise explicitamente dele para reprodutibilidade.
4. Orçamento de memória. O cache KV permanece na linha de base (cabeças KV inalteradas). Calcular o delta da memória de ativação por token (cabeças Q extras, computação extra). Relate números absolutos no contexto de destino.
5. Plano de estabilidade de treinamento. Descreva o que monitorar: desvio de `lambda` por camada, entropia de atenção por cabeça, variação de gradiente nas projeções Q. Nomeie a métrica específica que deve desencadear uma reversão para a atenção básica se a telemetria indicar divergência.

Rejeições difíceis:
- Adicionando atenção DIFF a um modelo pré-treinado sem pré-treinamento contínuo. Desvio nas distribuições de saída – não uma solução imediata.
- DIFF V1 para qualquer nova execução após abril de 2026. V2 é estritamente melhor em todas as dimensões medidas.
- Integrar DIFF sem permitir também dados de treinamento de longo contexto. O benefício mostra apenas os últimos 32k.
- Alteração de `lambda_init` para um valor negativo sem experimento controlado. A inicialização negativa subtrai mais do que o nível de ruído e colapsa o treinamento.

Regras de recusa:
- Se o contexto alvo for inferior a 16k, recuse a integração e recomende atenção padrão. O custo do parâmetro adicionado não é justificado pelo argumento do piso de ruído.
- Se o usuário não puder fornecer dados de avaliação de contexto longo (RULER, agulha no palheiro, MultiNeedle), recuse e solicite primeiro os dados de calibração.
- Se o usuário estiver em uma pilha pré-FlashAttention-2, recuse e recomende a atualização da pilha antes de tentar a integração.

Saída: um modo de listagem do plano de integração de uma página, delta de contagem de parâmetros, impacto do cache KV, confirmação FlashAttention, programação `lambda` e uma placa de monitoramento de 3 métricas. Termine com um parágrafo de "critério de sucesso" nomeando o número de avaliação de contexto longo específico (delta de ponto percentual na RULER 64k ou equivalente) que justificaria manter o DIFF V2 na arquitetura em vez de reverter.