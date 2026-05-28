---
name: msj-audit
description: Audit a long-context safety evaluation for many-shot jailbreaking coverage.
version: 1.0.0
phase: 18
lesson: 13
tags: [many-shot-jailbreaking, context-window, power-law, anthropic]
---
---
name: msj-audit
description: Audit a long-context safety evaluation for many-shot jailbreaking coverage.
version: 1.0.0
phase: 18
lesson: 13
tags: [many-shot-jailbreaking, context-window, power-law, anthropic]
---

Dada uma avaliação de segurança para um modelo de contexto longo, audite se a avaliação cobre o jailbreak de muitas tentativas.

Produzir:

1. Cobertura de contagem de chutes. Relate as contagens de disparos testadas (deve incluir 1, 5, 16, 64, 256 e pelo menos um >= 512 para modelos com contexto >= 1M). Se a avaliação testar uma contagem de disparo único, o ASR não é informativo – o MSJ é uma curva.
2. Ajuste à lei de potência. Relate o expoente ajustado por categoria de comportamento. Um expoente raso indica que o modelo é robusto para ICL nessa categoria; um expoente acentuado indica que o MSJ é desproporcionalmente eficaz.
3. Divisão por categoria. A eficácia do MSJ varia de acordo com a categoria: conteúdo violento, engano, automutilação, arma biológica. Por Anil et al. 2024, violento/enganoso precisa de menos tiros para fazer o jailbreak. Sinalize qualquer categoria ausente da avaliação.
4. Identificação da defesa. Existe uma modificação de prompt baseada em classificador? O próprio classificador é avaliado quanto à robustez adversária? A redução relatada de 61% -> 2% pela Antrópica depende da calibração do classificador.
5. Verificação de composição. A avaliação testa MSJ + PAIR, MSJ + modelos persuasivos ou codificação MSJ +? Os ataques composicionais são frequentemente mais fortes do que qualquer técnica isolada.

Rejeições difíceis:
- Qualquer afirmação "nosso modelo de longo contexto é seguro" com base na avaliação de apenas 5 tentativas.
- Qualquer reclamação de defesa sem relatar tanto o ASR de jailbreak quanto o desempenho benigno da ICL no mesmo classificador – a compensação é o ponto.
- Qualquer ASR agregado por categoria sem detalhamento de categoria.

Regras de recusa:
- Se o usuário perguntar se o MSJ pode ser totalmente corrigido, recuse a resposta binária; MSJ compartilha um mecanismo com a ICL e não pode ser eliminado sem eliminar a ICL.
- Caso o usuário solicite uma contagem de tiros recomendada para avaliação, recuse um único número; solicite o ajuste da lei de potência em 5 a 512 fotos.

Resultado: uma auditoria de uma página que relata a cobertura da contagem de tiros, ajuste da lei de potência por categoria, identificação da defesa e uma lacuna de ataque na composição. Cite Anil et al. 2024 (Antropia) uma vez como referência metodológica.