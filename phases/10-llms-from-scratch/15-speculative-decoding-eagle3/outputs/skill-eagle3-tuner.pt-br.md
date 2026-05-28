---
name: eagle3-tuner
description: Escolha e ajuste uma estratégia de decodificação especulativa (vanilla/Medusa/EAGLE-1/2/3/lookahead) para uma nova carga de trabalho de inferência.
version: 1.0.0
phase: 10
lesson: 15
tags: [speculative-decoding, eagle, eagle-3, medusa, inference, vllm, sglang, tensorrt-llm]
---

Dado um alvo de inferência de produção (modelo de verificador, tamanho do lote, perfil de comprimento de sequência, latência de decodificação p50/p99 alvo, acelerador, faixa alfa esperada de telemetria, combinação de tarefas), recomende uma estratégia de decodificação especulativa e parâmetros de ajuste. A recomendação deve preservar exatamente a distribuição dos resultados do verificador – nenhuma compensação de qualidade é aceitável sem aprovação explícita.

Produzir:

1. Projeto de família. Escolha entre vanilla, Medusa, EAGLE-1, EAGLE-2, EAGLE-3 ou lookahead. Justifique usando telemetria alfa (ou uma estimativa calibrada), custo de treinamento disponível (nenhum, SFT pequeno, execução completa de token 60B+) e se o verificador é enviado com um rascunho publicado (existem pontos de verificação EAGLE-3 para Llama 3.1/3.3, DeepSeek-V3, Qwen 2.5, Qwen 3).
2. Comprimento do rascunho N. Escolha o número inteiro N que minimiza o tempo de parede esperado por token, dado alfa e relação de custo do rascunho para verificador c: minimizar (1 + N*c) / ((1 - alfa ^ (N+1)) / (1 - alfa)). Mostre o trabalho para três valores candidatos de N em torno do ótimo.
3. Parâmetros de pesquisa em árvore se EAGLE-2/3. Escolha a profundidade da árvore e o fator de ramificação para permanecer dentro do orçamento de memória. O padrão é profundidade 3, ramificação (4, 2, 2) para lote <=8, profundidade 2 (4, 2) para lote 16-64 e nenhuma árvore para lote >64.
4. Controle de temperatura. Quando a temperatura > 0,8, o alfa entra em colapso. Recomendamos desabilitar a decodificação de especificações acima de um limite calibrado ou mudar para uma árvore mais ampla com menor ramificação por nó.
5. Plano de reversão de KV. Nomeie a implementação específica do cache KV (buffer de rascunho do vLLM versus comprimento lógico por sequência do TensorRT-LLM) e confirme se ela suporta rejeição em lote na simultaneidade de destino.

Rejeições difíceis:
- Qualquer recomendação que altere a distribuição de saída do verificador (por exemplo, decodificação de especificação aproximada, rejeição relaxada).
- Decodificação de especificação no lote 1 em um único modelo pequeno onde o custo do rascunho excede o custo do verificador economizado.
- EAGLE com um ponto de verificação de rascunho treinado contra um tokenizer ou revisão de modelo base diferente do verificador.
- Executar a decodificação de especificação sem reversão de KV — corromperá silenciosamente os tokens subsequentes.

Regras de recusa:
- Se a telemetria alfa não estiver disponível E a combinação de tarefas for escrita criativa em alta temperatura, recuse a recomendação e solicite primeiro uma execução de calibração.
- Se o verificador for menor que 7B de parâmetros densos, recomendamos desabilitar a decodificação de especificações em vez de escolher uma estratégia.
- Se a pilha de serviços não suportar a família de rascunhos escolhida (por exemplo, versão vLLM sem EAGLE-3), faça downgrade para EAGLE-2 em vez de solicitar ao usuário que reconstrua a pilha.

Saída: uma recomendação de uma página listando família de rascunho, N, formato de árvore (se aplicável), confirmação de reversão de KV e faixa de aceleração esperada. Termine com um parágrafo "plano de telemetria alfa" nomeando os ganchos de registro exatos que o usuário deve adicionar ao servidor de inferência para verificar a recomendação na primeira semana de produção.