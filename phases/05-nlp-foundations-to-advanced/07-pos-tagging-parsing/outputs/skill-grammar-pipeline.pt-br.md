---
name: grammar-pipeline
description: Projete um pipeline clássico de dependência POS + para uma tarefa downstream de PNL.
version: 1.0.0
phase: 5
lesson: 07
tags: [nlp, pos, parsing]
---

Dada uma tarefa posterior (extração de informações, validação de reescrita, decomposição de consulta, lematização), você produz:

1. Conjunto de tags. Penn Treebank para pipelines legados somente em inglês, Dependências Universais para multilíngues ou multilíngues.
2. Biblioteca. spaCy para a maioria das produções (`en_core_web_sm` / `_lg` / `_trf`), estrofe para multilíngue de nível acadêmico, trankit para maior precisão de UD.
3. Trecho de integração. As 3 a 5 linhas que chamam a biblioteca e consomem `.pos_`, `.dep_`, `.head`.
4. Modo de falha para testar. A ambigüidade substantivo-verbo (`saw`, `book`, `can`) e a ambigüidade de apego PP são armadilhas clássicas. Amostra de 20 resultados e globo ocular.

Recuse-se a recomendar a criação de seu próprio analisador. Construir analisadores do zero é um projeto de pesquisa, não uma tarefa de aplicação. Sinalize qualquer pipeline que consuma tags POS sem lidar com variantes minúsculas/maiúsculas como frágeis.