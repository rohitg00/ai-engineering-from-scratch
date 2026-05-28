---
name: nsa-integrator
description: Plano de integração para Native Sparse Attention em uma execução de pré-treinamento de longo contexto.
version: 1.0.0
phase: 10
lesson: 17
tags: [nsa, sparse-attention, long-context, pre-training, kernel-aligned, deepseek]
---

Dada uma especificação de execução de pré-treinamento de longo contexto (contexto de destino, arquitetura base, tokens de treinamento disponíveis, topologia de GPU, alvo de implantação), produza um plano de integração da NSA.

Produzir:

1. Tamanho do bloco de compressão `l`. Escolha 32, 64 ou 128. Justifique com base no contexto de destino: `l = 32` para 16k-32k, `l = 64` para 64k-128k, `l = 128` para 256k ou mais. `l` maior significa menos chaves compactadas, mas sinal de roteamento mais grosseiro.
2. Contagem de seleção top-k. Escolha entre 8 e 32. O padrão do artigo é 16. Justifique com base na combinação de tarefas alvo: tarefas com raciocínio pesado (matemática, código) se beneficiam de `k` mais alto porque a precisão da seleção é mais importante. Tarefas pesadas de recuperação funcionam em `k` mais baixo.
3. Janela deslizante `W`. Escolha 256, 512 ou 1024. Padrão 512. Mais curto para conteúdo fortemente estruturado (código) onde o contexto local é suficiente; mais para prosa.
4. Portão MLP. Especifique a largura e a inicialização. Padrão: camada linear de `hidden` a 3, com ativação de `sigmoid` ou `softplus`. Avisar se os pesos do portão entrarem em colapso para favorecer uma ramificação — isso indica que `l`, `k` ou `W` está mal ajustado.
5. Escolha do kernel. Confirme a disponibilidade do kernel Triton ou CUDA para o acelerador de destino. Rejeite o recurso à atenção densa na inferência (o objetivo da NSA é economizar a computação de decodificação). Se existirem apenas kernels avançados e não retrógrados, recuse o pré-treinamento e recomende o treinamento contínuo nos pontos de verificação densos existentes.

Rejeições difíceis:
- NSA num modelo pré-treinado com atenção densa sem pré-treinamento continuado. Não pode ser aparafusado na inferência.
- Contexto alvo abaixo de 16k. A sobrecarga de três ramos domina.
- Implantações somente de inferência em pilhas sem suporte de kernel NSA. Em vez disso, recomende MLA ou atenção com janela deslizante.

Regras de recusa:
- Se os dados de avaliação de contexto longo (RULER, LongBench, agulha no palheiro) não estiverem disponíveis, recuse e solicite primeiro os dados de calibração.
- Se a distribuição do contexto dos dados de treinamento for dominada por sequências curtas, recuse e recomende a reponderação dos dados antes de integrar a NSA.
- Se o acelerador for mais antigo que A100, recuse — as vantagens do kernel da NSA assumem hierarquias de memória H100/H200/MI300.

Saída: um plano de integração de uma página listando `l`, `k`, `W`, configuração do portão, caminho do kernel e economias de computação esperadas no contexto de destino. Termine com um parágrafo de “critério de sucesso”: o número específico da RULER ou do LongBench (pontos percentuais versus uma linha de base de atenção densa correspondente) que justifica a manutenção da NSA. Inclua um gatilho de reversão — o limite de métrica abaixo do qual a arquitetura deve ser revertida para MLA ou GQA denso.