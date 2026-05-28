---
name: provenance-check
description: Verifique um conjunto de dados de treinamento em relação às obrigações de exclusão do TDM da California AB 2013 e da UE.
version: 1.0.0
phase: 18
lesson: 27
tags: [data-provenance, ab-2013, tdm-opt-out, legitimate-interest, dpa]
---

Dado um conjunto de dados de treinamento usado por uma implantação, verifique a conformidade com a Califórnia AB 2013 e a desativação do TDM da UE.

Produzir:

1. Cobertura AB 2013. Preencha os 12 campos. Sinalize quaisquer campos ausentes ou apenas de espaço reservado. Observe que o resumo se torna vinculativo uma vez publicado.
2. Desativação da conformidade. O conjunto de dados respeita sinais de exclusão legíveis por máquina (robots.txt, C2PA "No AI Training", TDM.Reservation)? O filtro de pré-coleta deve estar instalado.
3. Mapeamento de jurisdição da DPA. Para cada jurisdição à qual os titulares dos dados pertencem, identifique o DPA aplicável e a posição de interesse legítimo de 2025 (DPC irlandês, Tribunal Regional Superior de Colônia, DPA de Hamburgo, ICO do Reino Unido, ANPD brasileira).
4. Auditoria de irreversibilidade. Se o conjunto de dados contiver PII, qual procedimento de desaprendizagem ou correção está em vigor? Reconheça que nenhum procedimento corrige totalmente os dados de treinamento.
5. Completude da cadeia de proveniência. Existe uma cadeia assinada desde a fonte de dados até o pipeline de treinamento? Se o conjunto de dados for derivado (rastreado + filtrado), documente a derivação.

Rejeições difíceis:
- Qualquer implantação que cite o AB 2013 sem resumos de 12 campos por conjunto de dados.
- Qualquer implantação que não respeite o robots.txt ou sinais de cancelamento equivalentes.
- Qualquer reclamação de remediação que pressuponha a remoção cirúrgica de dados de pesos treinados.

Regras de recusa:
- Se o usuário perguntar se um conjunto de dados específico é “seguro para treinamento”, recuse sem análise jurisdição por jurisdição.
- Se o usuário solicitar uma estratégia de conformidade universal, recuse — as jurisdições diferem materialmente.

Resultado: uma verificação de uma página preenchendo as cinco seções, identificando a lacuna de conformidade de maior risco e nomeando a correção mais urgente. Cite a exceção TDM da California AB 2013 e da Diretiva de Direitos Autorais da UE uma vez cada.