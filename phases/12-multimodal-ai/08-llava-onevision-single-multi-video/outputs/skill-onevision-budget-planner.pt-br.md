---
name: onevision-budget-planner
description: Allocate LLaVA-OneVision-style unified visual-token budgets across single-image, multi-image, and video scenarios for a target product mix.
version: 1.0.0
phase: 12
lesson: 08
tags: [llava-onevision, token-budget, curriculum, multi-image, video]
---
---
name: onevision-budget-planner
description: Allocate LLaVA-OneVision-style unified visual-token budgets across single-image, multi-image, and video scenarios for a target product mix.
version: 1.0.0
phase: 12
lesson: 08
tags: [llava-onevision, token-budget, curriculum, multi-image, video]
---

Dada a distribuição de tarefas esperada de um produto – porcentagens de solicitações de imagem única, múltiplas imagens e vídeo – e um orçamento de token visual por amostra, emita um plano de alocação por cenário e um currículo de treinamento.

Produzir:

1. Configuração por cenário. Imagem única: contagem de blocos AnyRes + miniatura + fator de agrupamento; multi-imagem: imagens por amostra + pooling por imagem; vídeo: contagem de quadros + pool por quadro.
2. Saldo orçamentário simbólico. O total de tokens de cada cenário deve ficar dentro de ±30% do orçamento alvo; sinalizar qualquer cenário que fique abaixo de 70% da meta (subtokenizado) ou acima de 130% (risco de contexto).
3. Plano curricular. Três estágios (SI → OV → TT) com pesos de dados. Para a etapa TT, utilize o mix de produtos do usuário.
4. Habilidades emergentes esperadas. Dado o mix de produtos do usuário, preveja quais recursos emergentes do estilo LLaVA-OneVision provavelmente aparecerão (multicâmera, conjunto de marca, agente de captura de tela ou variantes específicas do produto).
5. Estimativa de dados de treinamento. Contagens aproximadas de token/imagem/quadro necessárias por estágio, considerando o LLM de base 7B, citando a escala de dados OneVision-1.5.

Rejeições difíceis:
- Propor ordens de palco que coloquem vídeo ou multiimagem antes de imagem única. OneVision mostra que isso perde de 2 a 4 MMMU.
- Alocar todo o orçamento para vídeo quando o produto for 80% de imagem única. Desperdício, não equilíbrio.
- Supondo que AnyRes-16 (grade 4x4) se encaixe em um orçamento de token de 4k sem pooling agressivo. Isso não acontece.

Regras de recusa:
- Se o orçamento de token por amostra for inferior a 1.024, recuse casos de uso de múltiplas imagens ou vídeo – abaixo desse piso, os cenários entram em colapso.
- Se o usuário quiser mais de 5 quadros de vídeo com resolução total de 729 tokens, recuse; recomendo pooling de 3x ou menos quadros.
- Se a distribuição do produto omitir totalmente a imagem única, recuse e recomende o M-RoPE estilo Qwen2.5-VL - o currículo da OneVision assume a imagem única como base de percepção.

Resultado: um plano de uma página com configuração de token por cenário, pesos de estágio curricular, previsões de habilidades emergentes e uma estimativa em escala de dados. Termine com ponteiros para arXiv 2408.03326 (OneVision) e arXiv 2509.23661 (OneVision-1.5 totalmente aberto).