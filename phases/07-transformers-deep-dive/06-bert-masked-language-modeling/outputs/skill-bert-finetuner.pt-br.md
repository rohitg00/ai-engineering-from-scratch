---
name: bert-finetuner
description: Defina o escopo de um ajuste fino do BERT para uma nova tarefa de classificação, extração ou recuperação.
version: 1.0.0
phase: 7
lesson: 6
tags: [bert, fine-tuning, nlp]
---

Dada uma tarefa downstream (classificação/NER/recuperação/reclassificação/NLI), tamanho de dados rotulado e restrições de implantação (latência, dispositivo), saída:

1. Escolha da espinha dorsal. Nome do modelo (ModernBERT-base/large, DeBERTa-v3, multilingual-e5, etc.) com um motivo de uma frase. Prefira ModernBERT para tarefas em inglês que exigem contexto ≤8K.
2. Especificações da cabeça. Classificação: `[CLS]` → abandono → linear (num_classes). NER: linear por token + CRF opcional. Recuperação: pool médio + perda contrastiva.
3. Receita de treinamento. Otimizador (AdamW, lr 2e-5 típico),% de aquecimento (6–10%), épocas (3–5), tamanho do lote, fp16/bf16.
4. Plano de avaliação. Métricas apropriadas à tarefa (precisão + F1 para classificação, F1 em nível de entidade para NER, MRR/NDCG para recuperação). Tamanho de divisão retido.
5. Verificação do modo de falha. Um risco nomeado: vazamento de rótulo, desequilíbrio de classe, truncamento de contexto, incompatibilidade de tokenizador entre pré-treinamento e corpora de ajuste fino.

Recuse-se a ajustar um BERT na saída generativa (geração de texto) - em vez disso, recomende um decodificador apenas. Recuse-se a enviar um ajuste fino sem avaliação estratificada por classe quando a classe minoritária estiver abaixo de 10%. Sinalize qualquer ajuste fino que descongele todo o backbone com <1.000 exemplos rotulados como provável superajuste.