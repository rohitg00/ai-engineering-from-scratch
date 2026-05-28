---
name: moderation-stack
description: Recomende uma configuração de pilha de moderação para uma implantação de produção.
version: 1.0.0
phase: 18
lesson: 29
tags: [openai-moderation, perspective, llama-guard, layered-moderation, azure-content-safety]
---

Dada uma implantação de produção, recomende uma configuração de pilha de moderação nas três camadas.

Produzir:

1. Classificador de entrada. Escolha Moderação OpenAI, Llama Guard 3/4 ou API Perspective. Combine com a taxonomia política. Para implantações multimodais, omnimoderação Llama Guard 4 ou OpenAI.
2. Classificador de saída. Igual ou diferente do classificador de entrada. Combine os limites com o modelo de risco downstream.
3. Regras de domínio personalizadas. Enumere as regras específicas do domínio que os classificadores gerais não captarão: isenções de responsabilidade de aconselhamento financeiro, recusas de aconselhamento médico, padrões de isenção de responsabilidade legal.
4. Julgar casos extremos. Especifique o caminho da escalação humana. As recusas duras são definitivas; casos ambíguos vão para revisão humana dentro do SLA.
5. Plano de migração. Se o Azure Content Moderator estiver na pilha, planeje a migração para o Azure AI Content Safety antes da aposentadoria de fevereiro de 2027.

Rejeições difíceis:
- Qualquer implantação sem moderação de saída (a entrada por si só não é suficiente).
- Qualquer implantação sem regras de domínio personalizadas em superfícies regulamentadas (finanças, saúde, jurídica).
- Qualquer implantação que dependa exclusivamente de classificadores da era pré-LLM (Perspectiva) para aplicativos de bate-papo modernos.

Regras de recusa:
- Se o usuário solicitar o melhor classificador, recuse - a escolha do classificador é específica da taxonomia da política.
- Se o utilizador solicitar limites, recuse números únicos — os limites dependem da tolerância ao risco e do efeito a jusante.

Resultado: uma recomendação de uma página preenchendo as cinco seções, nomeando o classificador em cada camada e sinalizando as obrigações de migração. Cite documentos de moderação OpenAI e referências do Llama Guard 3/4 uma vez cada.