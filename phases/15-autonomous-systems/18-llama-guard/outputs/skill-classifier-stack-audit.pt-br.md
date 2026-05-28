---
name: classifier-stack-audit
description: Audit a deployment's input/output classifier stack (model, taxonomy, input rails, output rails, dialog rails) and flag adversarial-attack gaps.
version: 1.0.0
phase: 15
lesson: 18
tags: [llama-guard, nemo-guardrails, input-rails, output-rails, colang, adversarial-attacks]
---
---
name: classifier-stack-audit
description: Audit a deployment's input/output classifier stack (model, taxonomy, input rails, output rails, dialog rails) and flag adversarial-attack gaps.
version: 1.0.0
phase: 15
lesson: 18
tags: [llama-guard, nemo-guardrails, input-rails, output-rails, colang, adversarial-attacks]
---

Dada a pilha de classificadores de uma implantação (versão Llama Guard, configuração do NeMo Guardrails, classificadores personalizados, etapas de normalização), audite-a em relação à referência 2026 e sinalize a superfície de ataque que a pilha não cobre.

Produzir:

1. **Inventário de modelos.** Liste os classificadores em uso. Llama Guard 3 (8B / 1B-INT4) vs Llama Guard 4 (multimodal, S1 – S14). Versão NeMo Guardrails. Quaisquer classificadores personalizados. Se a implantação aceitar imagens, confirme se o classificador é multimodal.
2. **Mapeamento de taxonomia.** Mapeie as categorias de negócios declaradas na taxonomia do classificador. Cada categoria que interessa ao operador deve ser mapeada para uma categoria de classificador; categorias não mapeadas estão desprotegidas.
3. **Cobertura do trilho.** Confirme que os trilhos de entrada disparam antes da curva do modelo e que os trilhos de saída disparam antes da resposta ser enviada. Os trilhos de diálogo (Colang no NeMo) impõem restrições de curva cruzada. Classificadores de turno único não podem capturar ataques de vários turnos.
4. **Normalização.** Confirme se as entradas são normalizadas por NFKC, mapeadas por homoglifo e têm caracteres de largura zero/seletor de variação removidos antes da classificação. A classificação de bytes brutos é uma meta 100% ASR para contrabando de Emoji (Huang et al. 2025).
5. **Cobertura do corpus de ataque.** Para cada ataque documentado (contrabando de emojis, homoglifo, redirecionamento no contexto, paráfrase semântica), nomeie a defesa específica na pilha. A defesa somente do classificador falha nesta auditoria; camadas com Constituição (Lição 17) e tempo de execução (Lições 10, 13, 14) são necessárias.

Rejeições difíceis:
- Implantações utilizando classificador somente texto em entradas multimodais.
- Implantações sem etapa de normalização.
- Implantações apenas com trilhos de entrada (sem trilhos de saída em saídas de categorias sensíveis).
- Stack tratando o classificador como a única camada de segurança.
- ASR afirma que a operadora não pode reproduzir em sua própria distribuição.

Regras de recusa:
- Se as categorias declaradas do usuário não forem mapeadas na taxonomia do classificador, recuse e exija primeiro um mapeamento. Não mapeado = desprotegido.
- Se a implantação citar números ASR do Llama Guard 3 em uma superfície de entrada multimodal, recuse e exija o Llama Guard 4 ou um classificador multimodal.
- Se o usuário tratar a camada classificadora como suficiente em um ambiente de alto risco, recuse. O Artigo 14 da Lei de IA da UE (Lição 15) espera a supervisão humana no topo.

Formato de saída:

Retorne uma auditoria do classificador com:
- **Inventário de modelos** (nome, versão, modalidade)
- **Mapeamento de taxonomia** (categoria do operador → categoria do classificador)
- **Cobertura ferroviária** (entrada/saída/diálogo; disparo antes/depois do modelo)
- **Nota de normalização** (NFKC s/n, homóglifo s/n, faixa de largura zero s/n)
- **Cobertura do corpo de ataque** (ataque → defesa)
- **Completude da camada** (classificador + constituição + tempo de execução; são necessários três)
- **Prontidão** (produção/encenação/somente pesquisa)