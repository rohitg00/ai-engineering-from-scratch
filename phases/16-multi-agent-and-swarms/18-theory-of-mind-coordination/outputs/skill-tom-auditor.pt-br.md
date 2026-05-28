---
name: tom-auditor
description: Audite um sistema multiagente que alega “coordenação emergente”. Separa a coordenação real habilitada para ToM da ilusão pronta com condições de controle, testes estatísticos e medição de complementaridade.
version: 1.0.0
phase: 16
lesson: 18
tags: [multi-agent, theory-of-mind, coordination, evaluation, emergence]
---

Dado um sistema multiagente que reivindica coordenação emergente, audite se a coordenação é real ou um artefato de engenharia imediata.

Produzir:

1. **Extração de declaração.** Qual comportamento de coordenação está sendo reivindicado? (divisão do trabalho, antecipação, ações complementares, obtenção de consenso). Indique-o com precisão.
2. **Inspeção imediata.** Os avisos do sistema de algum agente instruem explicitamente a coordenação, a seleção de funções ou a conscientização da equipe? Em caso afirmativo, sinalize a reivindicação como parcialmente solicitada e crie um controle.
3. **Condição de controle.** Uma versão do sistema sem linguagem de indução de coordenação. Especifique exatamente o que o texto muda.
4. **Métrica.** Pelo menos um dos seguintes: diferenciação ligada à identidade, complementaridade direcionada a objetivos, sinergia de ordem superior (Riedl 2025). Não aceite “os agentes parecem trabalhar juntos” como prova.
5. **Teste estatístico.** Significância da métrica no sistema versus controle. Tamanho de amostra necessário para `p < 0.05`. Se `n < 50` for testado, relate a potência explicitamente.
6. **Verificação da capacidade do modelo.** Repita a comparação em um modelo base menor. O efeito persiste ou desaparece? Li/Riedl mostram dependência de capacidade.
7. **Revisão de caso de falha.** Quando o sistema falha, como é o estado do ToM (se houver)? Confusão de identidade (ligação entre crença e agente quebrada) ou alucinação de conteúdo (conteúdo de crença errado)?

Rejeições difíceis:

- Reivindicações de emergência sem condição de controle. Os rolos de demonstração não são evidências.
- Alegações que desaparecem no escrutínio estatístico (efeito abaixo de `p < 0.05` em ensaios `n >= 50`). Estas são ilusões de coordenação.
- Reivindicações válidas apenas para um modelo. Se uma linha de base forte menor também alcançar o efeito sem a solicitação do ToM, a coordenação não será orientada pelo ToM.
- "Nossos agentes acabaram de descobrir" como explicação do mecanismo. As reivindicações do mecanismo precisam que o estado do ToM seja registrado e inspecionável.

Regras de recusa:

- Se o sistema não tiver registro do raciocínio por agente, a auditoria não poderá distinguir a coordenação real da aleatoriedade. Recomendamos adicionar logs estruturados de estado do ToM antes de uma nova auditoria.
- Se a tarefa tiver uma coordenação ideal calculada pelo oráculo, compare com a ideal em vez de com o controle.
- Se a afirmação for limitada ("coordenação numa tarefa de ronda única"), a auditoria pode ser uma verificação mais curta: medir a complementaridade na ronda única, sem necessidade de análise de longo horizonte.

Resultado: uma auditoria de duas páginas. Comece com um veredicto de uma frase (“A afirmação de coordenação é imediata: a remoção da linguagem de 'trabalhar em conjunto' reduz a métrica de 0,82 para 0,31, significativo para o controle.”) e, em seguida, as sete seções acima. Termine com uma lista de soluções para converter a coordenação pronta em coordenação real: estado ToM explícito, horizontes mais longos com registro, conjuntos de modelos mistos.