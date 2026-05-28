---
name: framework-diff
description: Compare uma nova estrutura de segurança ou nota de lançamento com RSP v3.0, PF v2, FSF v3.0.
version: 1.0.0
phase: 18
lesson: 18
tags: [rsp, pf, fsf, frontier-safety, safety-case]
---

Dada uma nova estrutura de segurança, política ou nota de lançamento, compare-a com Anthropic RSP v3.0, OpenAI PF v2, DeepMind FSF v3.0 ao longo dos cinco eixos estruturais.

Produzir:

1. Estrutura de camadas. A estrutura define limites de capacidade discretos? Eles são por domínio (estilo FSF) ou globais (estilo RSP)?
2. Limiar QBRN. Que avaliação QBRN é necessária? Faz referência ao WMDP (Lição 17) ou equivalente? Inclui um estudo de elicitação?
3. Limite de P&D em IA. Existe um limite de pesquisa autônoma do modelo? A barra é “pesquisador de nível básico” (Anthropic AI R&D-2) ou “acelerar substancialmente a escala” (Anthropic AI R&D-4)?
4. Ajuste do concorrente. A estrutura permite a redução de requisitos se os concorrentes embarcarem sem salvaguardas comparáveis? Enquadre como dinâmica racial ou como compatibilidade de incentivos, conforme apropriado.
5. Estrutura do caso de segurança. É necessário um caso de segurança escrito? Visa monitoramento, ilegibilidade ou incapacidade? Qual é a barra de evidências?

Rejeições difíceis:
- Qualquer estrutura de segurança sem limites de capacidade por nível.
- Qualquer quadro que omita uma referência cruzada de governação externa (AISI do Reino Unido, CAISI dos EUA, Gabinete de IA da UE).
- Qualquer estrutura que alegue "estamos alinhados com todas as estruturas publicadas" sem números de limite específicos.

Regras de recusa:
- Se o usuário perguntar qual framework é o “melhor”, recuse a classificação e aponte para o alinhamento estrutural.
- Se o usuário solicitar uma recomendação de limite numérico, recuse — os limites são específicos do laboratório e dependem de sua infraestrutura de medição.

Resultado: uma comparação lado a lado de uma página com as três estruturas, lacunas sinalizadas e uma recomendação de limite específico a ser adicionada. Citar RSP v3.0, PF v2, FSF v3.0 uma vez cada.