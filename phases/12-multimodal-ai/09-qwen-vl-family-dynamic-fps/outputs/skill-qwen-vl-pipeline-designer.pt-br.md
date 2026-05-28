---
name: qwen-vl-pipeline-designer
description: Configure uma implantação Qwen2.5-VL ou Qwen3-VL — limites de resolução, política de FPS dinâmico, sinalizador de atenção de janela e modo de saída do agente JSON — para uma tarefa de vídeo ou imagem de destino.
version: 1.0.0
phase: 12
lesson: 09
tags: [qwen-vl, m-rope, dynamic-fps, json-agent, video-understanding]
---

Dada uma descrição da tarefa (controle de qualidade de imagem, reconhecimento de ação de vídeo, fluxo de trabalho do agente de interface do usuário, documento com alto uso de OCR, monitoramento de câmera de segurança, streaming de feed ao vivo) e uma restrição de implantação (janela de contexto, orçamento de latência, classe de GPU), emita uma configuração Qwen2.5-VL ou Qwen3-VL executável.

Produzir:

1. Limites de resolução. `min_pixels` e `max_pixels` escolhidos para a tarefa. Documentos e UI: máximo alto (>=1.806.336 = equivalente a 1344x1344). Fotos: padrão. Quadros de vídeo: diminua para preservar a contagem de quadros.
2. Política de FPS. Corrigido 1 FPS para baixo movimento; dinâmico 2-4 para médio; 4-8 para alto. Tokens de tempo absoluto ativados sempre que a tarefa envolve aterramento temporal.
3. Enquadrar o orçamento. Total de tokens por vídeo = duração * fps * tokens_per_frame. Ajuste-se ao contexto disponível (deixe 20% de folga para prompt + saída).
4. Atenção na janela. Ativar para entradas >720p; desativar para baixa resolução, onde a atenção global é mais barata.
5. Modo de saída. Texto de formato livre para legenda ou controle de qualidade; Chamada de ferramenta JSON para tarefas de agente e aterramento; Tags `<box>` para detecção.
6. Inferência kwargs. Dito concreto que o usuário passa para o modelo `process_vision_info` + adiante.

Rejeições difíceis:
- Propor Qwen2-VL (original, pré-2.5) como padrão para novos projetos. Falta FPS dinâmico e tokens de tempo absoluto.
- A reivindicação do M-RoPE requer uma tabela de posições. Isso não acontece - esse é todo o seu argumento de venda.
- Usando 1 FPS fixo para vídeos com alto movimento e esperando o reconhecimento correto da ação. O amostrador deve se adaptar.

Regras de recusa:
- Se o FPS *duração*tokens_per_frame solicitado exceder a janela de contexto, recuse e proponha pooling ou redução de frames.
- Se o usuário quiser >8 FPS em um vídeo >30s com um modelo >7B e <40 GB VRAM, recuse e recomende a redução de quadros ou uma GPU maior.
- Se o usuário solicitar saída de formato livre para uma tarefa do agente, recuse e recomende o modo de saída JSON com o esquema da ferramenta pré-declarado no prompt.

Saída: uma configuração de uma página com limites de resolução, política de FPS, orçamento de quadros, sinalizador de atenção de janela, modo de saída, kwargs de inferência e latência esperada. Termine com arXiv 2502.13923 (Qwen2.5-VL) e 2511.21631 (Qwen3-VL) para um acompanhamento mais profundo.