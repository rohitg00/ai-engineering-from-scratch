---
name: token-gen-cost-analyzer
description: Calcule contagens de tokens, latência de inferência e teto de qualidade para a próxima geração de token no estilo Emu3 e escolha entre a família Emu3 e a difusão.
version: 1.0.0
phase: 12
lesson: 12
tags: [emu3, next-token-prediction, video-gen, diffusion, cfg]
---

Dada uma especificação de produto de geração (imagem ou vídeo, resolução alvo, nível de qualidade, requisito de rendimento), calcule a contagem de tokens para a próxima geração de token estilo Emu3, estime o custo de inferência e escolha entre a família Emu3 e a difusão.

Produzir:

1. Contagem de tokens. Tokens por imagem com redução de tokenizador escolhida (normalmente 8x por dim para imagem). Tokens por vídeo com VQ 3D (normalmente 4x4x4 espaço-temporal).
2. Latência de inferência. Tokens/taxa de transferência (tokens por segundo) para a família Emu3; denoise-steps * passo de tempo para difusão. Cite as faixas de concreto A100/H100.
3. Teto de qualidade. PSNR de reconstrução de tokenizador (30-32 dB para classe IBQ), expectativas FID em MJHQ-30K, FVD para vídeo.
4. Configuração do CFG. Peso de orientação recomendado (gama) por tarefa; típico 3,0 para geração padrão, 5-7 para forte adesão imediata.
5. Escolha. Família Emu3 se o produto precisar de compreensão unificada + geração ou flexibilidade de qualquer modalidade; difusão (SDXL/SD3/Flux) se o produto for somente geração de imagem com latência estrita.

Rejeições difíceis:
- Afirmar que o Emu3 é mais rápido que a difusão na inferência. Não é; a decodificação autorregressiva sobre milhares de tokens de imagem é o custo permanente.
- Recomendar a família Emu3 sem especificar o peso do CFG. A qualidade entra em colapso sem ele.
- Propondo Emu3 para geração estrita de imagens 4K. A contagem de tokens com resolução de 2048+ esgota o cache KV e leva minutos.

Regras de recusa:
- Se o orçamento de latência for <5s por imagem, recuse o Emu3 e recomende SDXL ou SD3.
- Se o produto deve emitir imagens E descrevê-las E raciocinar sobre imagens de terceiros, recomende a família Emu3 (a perda unificada é o ponto); a difusão não pode fazer isso sem um VLM separado.
- Se o usuário quiser pesos abertos com licença permissiva para uso comercial, recuse o Emu3 — verifique primeiro sua licença; algumas versões são apenas para pesquisa.

Resultado: análise de uma página com contagens de tokens, estimativas de latência, teto de qualidade, configuração de CFG e escolha com justificativa. Termine com arXiv 2409.18869 (Emu3) e 2408.11039 (Transfusion) para a alternativa.