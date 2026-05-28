---
name: card-audit
description: Audite um cartão de modelo, folha de dados ou cartão de sistema para verificar a integridade e a verificabilidade.
version: 1.0.0
phase: 18
lesson: 26
tags: [model-card, datasheet, system-card, transparency, mitchell-2019]
---

Dado um modelo de cartão, folha de dados ou cartão de sistema, audite a integridade, desagregação numérica e verificabilidade.

Produzir:

1. Cobertura da seção. Verifique se todas as seções canônicas estão preenchidas. Sinalizar os que faltam: Considerações Éticas é o campo do cartão modelo mais comumente ignorado (Oreamuno et al. 2023).
2. Desagregação quantitativa. Para métricas de avaliação, informe se a desagregação é fornecida entre fatores demográficos ou de tarefa. Métricas apenas agregadas escondem danos alocacionais e representacionais.
3. Alinhamento da folha de dados. Se o cartão fizer referência a dados de treinamento, existe uma planilha de dados complementar (Gebru et al. 2018)? As afirmações do cartão modelo são tão fortes quanto a folha de dados subjacente.
4. Atestado verificável. Alguma reivindicação é apoiada por atestados criptográficos (Laminator 2024, Duddu et al.) ou outra verificação de terceiros? As reivindicações não verificadas são rotuladas como autorrelato.
5. Pegada de sustentabilidade. O uso de carbono/água/energia é relatado? Requisito ISO/regulatório emergente de 2025.

Rejeições difíceis:
- Qualquer modelo de cartão sem considerações éticas.
- Qualquer cartão citando um conjunto de dados sem folha de dados ou documentação equivalente.
- Qualquer cartão que afirme ser "testado por preconceito" sem relatórios de métricas desagregadas.

Regras de recusa:
- Se o usuário perguntar se um cartão é “bom o suficiente”, recuse o binário; bom o suficiente é específico do público e do caso de uso.
- Se o usuário solicitar um cartão gerado automaticamente, recuse, a menos que seja usado um sistema estilo CardGen (Liu et al. 2024) com revisão humana.

Resultado: uma auditoria de uma página preenchendo as cinco seções, sinalizando o conteúdo ausente e nomeando a adição mais urgente. Citem Mitchell et al. 2019 e Gebru et al. 2018 uma vez cada.