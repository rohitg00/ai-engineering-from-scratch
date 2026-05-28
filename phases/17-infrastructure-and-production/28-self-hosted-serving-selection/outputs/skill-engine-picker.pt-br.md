---
name: engine-picker
description: Pick a self-hosted LLM engine (llama.cpp, Ollama, TGI, vLLM, SGLang) given hardware, scale, and workload. Name 2026 TGI maintenance mode as a migration trigger.
version: 1.0.0
phase: 17
lesson: 28
tags: [self-hosted, vllm, sglang, llama-cpp, ollama, tgi, trt-llm, engine-selection]
---
---
name: engine-picker
description: Pick a self-hosted LLM engine (llama.cpp, Ollama, TGI, vLLM, SGLang) given hardware, scale, and workload. Name 2026 TGI maintenance mode as a migration trigger.
version: 1.0.0
phase: 17
lesson: 28
tags: [self-hosted, vllm, sglang, llama-cpp, ollama, tgi, trt-llm, engine-selection]
---

Dado o hardware (CPU / Apple Silicon / AMD / NVIDIA Hopper / NVIDIA Blackwell), escala (usuário único / equipe pequena / produção / empresa) e carga de trabalho (bate-papo geral / agente / RAG / contexto longo / código), produza uma recomendação de mecanismo.

Produzir:

1. Motor. Nomeie o mecanismo específico. Cite a árvore que prioriza o hardware, a segunda a escala e a terceira a carga de trabalho.
2. Por que não as alternativas? Para cada mecanismo alternativo, indique por que não é a escolha (modo de manutenção TGI, AMD exclui TRT-LLM, Ollama é apenas para desenvolvedores).
3. Pipeline. Se for produção, nomeie o padrão de pipeline (dev Ollama → staging llama.cpp → prod vLLM/SGLang) e confirme o fluxo do formato de peso (GGUF ou HF).
4. Empilhamento de produção. Na escala de produção, aponte para Fase 17 · 18 (pilha de produção), · 17 (desagregado), · 11 (roteador com reconhecimento de cache) para a composição.
5. Migração TGI. Se o titular for a TGI, especifique o plano e o cronograma de migração — não urgente, mas deve começar dentro de 6 meses.
6. Pegadinha com o hardware. Cite as duas restrições rígidas: Somente CPU → llama.cpp; AMD → sem TRT-LLM.

Rejeições difíceis:
- Padronização de novos projetos para TGI em 2026. Recusar — modo de manutenção.
- Ollama para produção compartilhada com >1 usuário simultâneo. Recusar – lacuna de rendimento.
- Sugerir TRT-LLM sem confirmar apenas NVIDIA. Recusar – AMD/não-NVIDIA é um bloqueio difícil.

Regras de recusa:
- Se o hardware for misto (alguns AMD, alguns NVIDIA), serão necessárias decisões de mecanismo por cluster; não force um único motor.
- Se a carga de trabalho for "desconhecida/geral" em escala de produção, use vLLM como padrão e planeje uma reavaliação após 3 meses de dados de tráfego.
- Se a equipe quiser "mais rápido por GPU sem disponibilidade da Blackwell" e insistir apenas no Hopper, confirme - TRT-LLM ou vLLM são aceitáveis.

Resultado: uma recomendação de uma página com mecanismo, alternativas descartadas, pipeline, empilhamento de produção, postura de migração TGI. Termine com a revisão trimestral única: reavalie a escolha do mecanismo quando o formato da carga de trabalho mudar significativamente.