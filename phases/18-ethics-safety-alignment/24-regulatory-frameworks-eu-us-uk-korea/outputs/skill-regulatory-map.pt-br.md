---
name: regulatory-map
description: Mapeie as obrigações regulatórias de IA de uma implantação na UE, EUA, Reino Unido e Coreia.
version: 1.0.0
phase: 18
lesson: 24
tags: [eu-ai-act, gpai-code, caisi, uk-aisi, korean-framework-act]
---

Dada uma descrição da implantação (jurisdição do fornecedor, jurisdição da infraestrutura, jurisdição do utilizador), mapeie as obrigações regulamentares de IA aplicáveis.

Produzir:

1. Exposição na UE. Se a implantação afetar utilizadores ou infraestruturas da UE, aplique a Lei da UE sobre IA. Identifique o nível de risco (proibido, de alto risco, GPAI sistêmico, GPAI-outros, limitado). Informar o prazo para cada classe de obrigação.
2. Exposição no Reino Unido. Se for usuário do Reino Unido, indique as expectativas de avaliação do UK AI Security Institute. O Reino Unido não possui uma regulamentação abrangente sobre IA (2026); aplicam-se regras sectoriais.
3. Exposição nos EUA. Se for usuário dos EUA, identifique atividades federais (padrões CAISI, NIST) e regras estaduais (California AB 2013, Colorado AI Act, etc.). A estrutura federal é pró-crescimento; as regras estaduais definem o piso.
4. Exposição à Coreia. Se forem usuários coreanos, aplique a Lei-Quadro Coreana de IA; identificar se a implantação é IA de alto impacto ou IA generativa; sinalizar o requisito de representação local para fornecedores estrangeiros.
5. Determinação de regras vinculativas. Para cada obrigação substantiva (transparência, avaliação de riscos, direitos autorais), identifique a regra mais rigorosa entre jurisdições. Essa é a regra vinculativa.

Rejeições difíceis:
- Qualquer mapa de implantação sem nomear as jurisdições aplicáveis.
- Qualquer avaliação de exposição na UE sem identificação do nível de risco.
- Qualquer avaliação de exposição nos EUA que ignore as regras estaduais.

Regras de recusa:
- Se o usuário perguntar "esta implantação é compatível", recuse a reivindicação binária sem mapeamento de jurisdição por jurisdição.
- Se o usuário solicitar uma estratégia de conformidade global única, recuse — as jurisdições têm requisitos diferentes.

Resultado: um mapa de uma página preenchendo as cinco seções acima, identificando a regra vinculativa em cada questão substantiva e nomeando a lacuna de conformidade de maior risco. Citar a Lei de IA da UE (Regulamento 2024/1689), o Código de Prática GPAI (2025) e a Lei-Quadro Coreana de IA uma vez cada.