---
name: seq2seq-design
description: Projete um pipeline sequência a sequência para uma determinada tarefa.
phase: 5
lesson: 09
---

Dada uma tarefa (tradução, resumo, paráfrase, reescrita de perguntas), o resultado:

1. Arquitetura. Codificador-decodificador de transformador pré-treinado (BART, T5, mBART, NLLB) é o padrão. Seq2seq baseado em RNN apenas para restrições específicas (streaming, inferência de borda, pedagogia).
2. Iniciando o ponto de verificação. Nomeie-o (`facebook/bart-base`, `google/flan-t5-base`, `facebook/nllb-200-distilled-600M`). Combine o ponto de verificação com a tarefa e a cobertura do idioma.
3. Estratégia de descodificação. Ávido por resultados determinísticos, pesquisa de feixe (largura 4-5) para qualidade, amostragem com temperatura para diversidade. Justificativa de uma frase.
4. Um modo de falha para verificar antes do envio. O viés de exposição manifesta-se como desvio de geração em resultados mais longos; amostrar 20 resultados no comprimento do percentil 90 e no globo ocular.

Recuse-se a recomendar o treinamento de um seq2seq do zero para menos de 1 milhão de exemplos paralelos. Sinalize qualquer pipeline usando decodificação gananciosa para conteúdo voltado ao usuário como frágil (repetições e loops gananciosos).