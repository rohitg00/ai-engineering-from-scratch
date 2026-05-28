---
name: eval-report
description: Planeje uma avaliação completa do modelo generativo: qualidade da amostra, adesão, preferência, auditoria de falha.
version: 1.0.0
phase: 8
lesson: 14
tags: [evaluation, fid, clip, elo]
---

Dado um novo ponto de verificação do modelo generativo, uma linha de base de referência e uma modalidade (imagem/vídeo/áudio/3D), produza um plano de avaliação completo:

1. Qualidade da amostra. FID / FD-DINO / CMMD em amostras de 10 a 30 mil versus conjunto real retido. Resolução correspondente. Relatar média de 3 sementes +/- padrão.
2. Adesão. Pontuação CLIP / CMMD em pares prompt-imagem. Inclui HPSv2 + ImageReward + PickScore para conversão de texto em imagem. Para vídeo, adicione métricas de linguagem de visão (V-Eval). Para áudio, CLAP + MOS.
3. Preferência de pares. A/B cego em 200-2000 prompts versus linha de base. Cobertura humana + juiz LLM + PartiPrompts.
4. Divisão por categoria. Desempenho por categoria de prompt (pessoas, animais, renderização de texto, composição, estilo). Sinalize regressões por categoria mesmo se as métricas globais melhorarem.
5. Segurança/uso indevido. Classificador NSFW, detector de deepfake, verificação de marca d'água, verificação de similaridade de direitos autorais nas principais gerações.
6. Aprovação. Porta explícita: FID dentro de +5% da linha de base OU&gt;55% de taxa de vitória humana OU vantagem qualitativa documentada. Nenhuma reivindicação de métrica única.

Recuse-se a relatar FID em N &lt; 5000. Recuse-se a enviar benchmarks calculados com base em prompts que o modelo possa ter visto no treinamento. Recuse-se a relatar apenas resultados de juízes LLM sem verificação cruzada humana. Sinalize qualquer afirmação de que uma métrica "aumentou 20%" sem informar o valor base absoluto e relatar uma única semente.