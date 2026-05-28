---
name: cross-policy-diff
description: Produza uma comparação entre políticas para um recurso específico usando o OpenAI Preparedness Framework v2, Anthropic RSP v3.0 e DeepMind FSF v3 como referência.
version: 1.0.0
phase: 15
lesson: 20
tags: [preparedness-framework, fsf, rsp, cross-policy, scaling-policy]
---

Dada uma capacidade de fronteira específica (por exemplo, “autonomia de longo alcance”, “replicação e adaptação autônomas”, “automação de P&D”), produza uma diferença entre políticas mostrando como cada uma das três estruturas classifica a capacidade e quais mitigações são desencadeadas.

Produzir:

1. **Classificação OpenAI PF v2.** Rastreado ou Pesquisado. Se Rastreado, nomeie os gatilhos do Relatório de Capacidades + Salvaguardas. Se for Pesquisa, observe que a linguagem da política é mitigações “potenciais”.
2. **Classificação Antrópica RSP v3.0.** Qual limite (ASL-3, AI R&D-4, proibição codificada)? Qual mitigação (caso afirmativo, segurança + implantação)? Confirme se o compromisso está no nível antrópico-unilateral ou no nível de recomendação da indústria.
3. **Classificação DeepMind FSF v3.** Qual domínio (Cyber, Bio, ML R&D, CBRN)? Qual CCL ou nível de capacidade rastreada? O monitoramento de alinhamento enganoso é invocado?
4. **Resumo da convergência.** As três políticas concordam quanto à gravidade da capacidade ou há divergências significativas? Qual classificação é mais rigorosa e qual menos?
5. **Dependência de medição.** Toda classificação depende da medição de capacidade. Cite como a capacidade é medida e qual provedor de avaliação (METR, Apollo, interno, terceirizado) possui essa medição.

Rejeições difíceis:
- Alegações de alinhamento entre políticas com base na semelhança da linguagem do anúncio, sem provas ao nível do documento.
- Qualquer classificação que não possa apontar para uma cláusula específica no documento de origem.
- Tratar a "Categoria de Pesquisa" (OpenAI) como equivalente à "Categoria Rastreada" — elas têm consequências operacionais diferentes.

Regras de recusa:
- Se o usuário não puder produzir as passagens do documento fonte para cada classificação, recuse e solicite citações primeiro.
- Se o usuário tratar a existência de políticas como evidência de mitigação na prática, recuse e exija evidências do disparo de mitigações específicas.
- Se a capacidade for declarada “coberta” por uma estrutura, mas a palavra não aparecer no documento, recuse e exija uma referência de cláusula concreta.

Formato de saída:

Retorne um documento diff com:
- **Definição de capacidade** (uma frase)
- **Linha OpenAI PF v2** (classificação, gatilho, cláusula de origem)
- **Linha Antrópica RSP v3.0** (classificação, gatilho, recomendação unilateral vs.)
- **Linha DeepMind FSF v3** (domínio, CCL/TCL, envolvimento de alinhamento enganoso)
- **Resumo de convergência** (acordo + desacordo significativo)
- **Propriedade da medição** (provedor de avaliação, cadência de avaliação)
- **Recomendação do leitor** (mais rigoroso, menos rigoroso, justificado)