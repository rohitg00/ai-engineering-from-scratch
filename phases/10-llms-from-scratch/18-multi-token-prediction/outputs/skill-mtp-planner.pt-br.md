---
name: mtp-planner
description: Planeje uma integração de previsão multitoken para uma nova execução de pré-treinamento.
version: 1.0.0
phase: 10
lesson: 18
tags: [mtp, multi-token-prediction, deepseek-v3, pre-training, speculative-decoding]
---

Dada uma especificação de execução de pré-treinamento (escala de modelo, tamanho oculto, camadas, orçamento de tokens de dados, topologia de GPU, implantação de destino) e uma meta declarada (sinal de treinamento mais denso versus rascunho de decodificação especulativa versus ambos), produza um plano de integração MTP.

Produzir:

1. Profundidade D. Escolha 1 ou 2. DeepSeek-V3 usa D=1 e relata a aceitação de decodificação especulativa de primeira profundidade em 80%+. D=2 é território de retornos decrescentes para a maioria das corridas. Justifique a escolha em relação ao orçamento de computação — cada profundidade extra adiciona aproximadamente um bloco transformador de computação por etapa de treinamento.
2. Cronograma lambda. Padrão: 0,3 para os primeiros 10% do treinamento e 0,1 depois. Ajuste até 0,5 antecipadamente para modelos pequenos (abaixo de 7B) onde o sinal mais denso é mais importante; ajuste para baixo se você observar a perda de MTP dominando a perda principal.
3. Parâmetro orçamentário. Relate a contagem de parâmetros por módulo em relação ao modelo principal. Confirme se a sobrecarga está abaixo de 5% dos parâmetros principais (denso) ou abaixo de 3% (MoE).
4. Memória e sobrecarga de computação. Quantifique FLOPs de passagem para frente extras por etapa (aproximadamente `D * transformer_block_cost`), memória de passagem para trás extra (memória de ativação para módulos D) e VRAM de pico extra (incorporação compartilhada e cabeça não contam, projeção e bloco de transformador contam).
5. Fiação de tempo de inferência. Descreva como consumir o módulo MTP como um rascunho de decodificação especulativa na inferência. Nomeie o caminho de integração da regra Leviathan e a contabilidade de reversão de KV. Confirme a compatibilidade com a pilha de inferência de destino (vLLM, SGLang, TensorRT-LLM).

Rejeições difíceis:
- Adicionando MTP a um modelo denso pré-treinado sem ele. Não é possível atualizar — os módulos MTP não são treinados.
- D > 2 para uma primeira integração. O ganho sobre D=1 é pequeno; a complexidade cresce rapidamente.
- MTP em modelo com parâmetros ativos 1B. O sinal é mais fraco do que o custo indireto nessa escala.
- Usar cabeças paralelas (estilo Gloeckle) quando o objetivo é decodificação especulativa. Eles não se encadeiam causalmente.

Regras de recusa:
- Se os dados de pré-treinamento forem dominados por sequências curtas (abaixo de 2k), recuse. Os ganhos de MTP assumem sequências longas o suficiente para que a supervisão de profundidade 2 seja importante.
- Se a pilha de inferência de destino não suportar decodificação especulativa, observe que o MTP ainda compra o sinal de treinamento mais denso e prossegue, mas sinaliza a incompatibilidade.
- Se o usuário continuar o pré-treinamento em um ponto de verificação denso existente sem MTP, recuse e recomende adicionar o MTP somente no início de uma execução de treinamento limpa ou em uma redefinição limpa do limite de dados.

Saída: um plano de integração de uma página listando D, programação lambda, sobrecarga de parâmetros (absoluta e percentual), sobrecarga de computação (porcentagem por etapa de treinamento) e o plano de fiação de decodificação especulativa em tempo de inferência. Termine com um parágrafo de “critério de sucesso” nomeando a métrica medida que justifica manter o MTP: a taxa de aceitação na profundidade 1 após 50B de tokens de treinamento deve estar acima de 70%, caso contrário a arquitetura deverá ser revertida.