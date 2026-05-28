---
name: speculative-tuning
description: Crie o perfil de uma carga de trabalho de decodificação e escolha o modelo de rascunho, o comprimento do rascunho K, a porta de temperatura e a política de fallback para decodificação especulativa.
version: 1.0.0
phase: 10
lesson: 25
tags: [speculative-decoding, draft-model, alpha, throughput, inference, decode-latency]
---

Dado o modelo de destino (tamanho, família, tokenizador), a telemetria da carga de trabalho (combinação de tarefas, proporção de token prompt vs decodificação, latência de decodificação p50/p99, acelerador e headroom HBM, tamanho médio do lote, distribuição de temperatura de amostragem) e os pontos de verificação de rascunho disponíveis, saída:

1. Escolha do rascunho. Escolha entre pequenos da mesma família (Llama-3.2-1B para Llama-70B), rascunho destilado (especificação Qwen3-0.6B), cabeças Medusa aparafusadas no alvo ou "sem decodificação de especificação" se nenhum rascunho estiver mais próximo de 30 por cento da taxa de custo FLOP. Confirme a correspondência do tokenizer com o byte por byte de destino; recusar um tokenizer incompatível.
2. Comprimento do rascunho K. Argmax de E[tokens] / (1 + K x c) onde c é a relação entre o custo do rascunho e o alvo. Mostre o trabalho para K em 2, 3, 4, 5, 6 usando o alfa medido de uma execução de calibração em 5.000 tokens de dados em distribuição. Padrão K=4 para bate-papo, K=6 para código, K=2 para escrita criativa em alta temperatura.
3. Porta de temperatura. Defina um limite de temperatura acima do qual a decodificação de especificação será desativada. Padrão 0,8; inferior para 0,6 se a calibração mostrar o colapso alfa mais cedo. Rejeite qualquer restrição de temperatura que dependa de inspeção por solicitação que adicione mais de 50 microssegundos.
4. Orçamento da árvore. Se a pilha de serviço suportar o desenho em árvore, escolha uma pequena árvore fixa (profundidade 2, ramificação 3-2) para lotes abaixo de 8; cadeia plana para lote acima de 32. Indique o tamanho do risco KV do verificador em bytes e confirme se ele se ajusta ao espaço livre da HBM.
5. Política de reserva. Nomeie a métrica (alfa medido em janela deslizante nas últimas 1.000 verificações) e o limite (alfa abaixo de 0,4) no qual o servidor volta para a decodificação autorregressiva simples para esse fluxo de solicitação. Inclua o tempo de vida por solicitação da decisão substituta.

Recuse a decodificação de especificações em tamanho de lote acima do ponto em que o verificador está vinculado à computação. Acima desse ponto, os FLOPs não utilizados que o especulador deveria absorver não existem mais; a produtividade cai. Recuse a decodificação de especificações para qualquer família de tarefas com alfa medido abaixo de 0,4; a sobrecarga de corrente de ar domina e a latência do relógio piora. Recuse um rascunho que não foi validado em uma amostra retida de 1.000 tokens em relação ao alvo: um rascunho não validado é um desvio KL silencioso.

Entrada de exemplo: "Llama-3.3-70B em 8xH100, carga de trabalho de chat, lote 16, decodificação p50 28 ms, p99 60 ms, média de distribuição de temperatura 0,4 / máx. 1,2, calibração mostra alfa 0,78 no chat, 0,61 no código."

Exemplo de saída:
- Rascunho: Llama-3.2-1B-Instruct-spec. Mesmo tokenizer, mesma família, proporção c aproximadamente 0,03.
- K: 4. E[tokens/verificar] = 3,4 chat, 2,5 código. K=5 ganha 0,1 token chat e paga 0,03 c extras; rejeitar.
- Porta de temperatura: 0,8. Acima de 0,8 alfa cai abaixo de 0,45 no conjunto de calibração.
- Orçamento da árvore: ramo de profundidade 2 (3, 2). KV scratch 480 MB no lote 16 cabe.
- Fallback: janela deslizante alfa sobre o último 1_000 verifica abaixo de 0,40 desativa a decodificação de especificação para esse fluxo por 30 s e, em seguida, investiga novamente.