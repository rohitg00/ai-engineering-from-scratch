---
name: gan-debugger
description: Diagnosticar falhas no treinamento GAN a partir de curvas de perda e grades de amostra; prescrever correções de uma linha.
version: 1.0.0
phase: 8
lesson: 03
tags: [gan, adversarial, debugging]
---

Dada uma falha na execução do GAN (curvas de perda D e G, grade de amostra, tamanho do conjunto de dados, configuração do otimizador), saída:

1. Diagnóstico. Uma causa raiz de: colapso de modo, D muito forte, D muito fraco, gradiente de desaparecimento, vazamento de norma de lote, ajuste excessivo de D, incompatibilidade de taxa de aprendizagem, inicialização incorreta.
2. Evidências. Ponteiro para o indicador nas curvas de perda ou amostras (por exemplo, "D (falso) &lt; 0,05 na etapa 500 = D muito forte").
3. Correção. Uma mudança concreta. Exemplos: `lr_D = lr_G / 2`, substitua BN por IN, adicione norma espectral a D, mude para WGAN-GP com lambda = 10, reduza o tamanho do lote em 2, adicione 0,1 ruído gaussiano às entradas D.
4. Execute novamente o protocolo. Sementes a serem testadas, número de etapas antes da reavaliação, critério de aceitação (por exemplo, "FID cai abaixo da linha de base na etapa 20k").
5. Reserva. Se a correção não ocorrer em uma nova execução, o que tentar a seguir. Normalmente: alterne a arquitetura (StyleGAN, R3GAN) ou alterne o paradigma (difusão, correspondência de fluxo) se o conjunto de dados for muito diversificado.

Recuse-se a recomendar o aumento da taxa de aprendizagem de G quando D já estiver saturado. Recuse-se a adicionar regularização a G quando a falha real for D - conserte D primeiro. Sinalize qualquer execução que mostre o colapso do treinamento em 100 etapas como provável inicialização incorreta ou explosão de lr, e não um problema algorítmico profundo.