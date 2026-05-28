---
name: consensus-designer
description: Projete um protocolo de consenso compatível com BFT para um conjunto multiagente. Escolhe política de clustering, ponderação, limite e escalonamento; o ataque testa o design contra padrões bizantinos, de bajulação e de monocultura.
version: 1.0.0
phase: 16
lesson: 14
tags: [multi-agent, consensus, BFT, voting, confidence]
---

Dado um conjunto de N agentes respondendo a uma pergunta comum, projete um protocolo de consenso que seja robusto aos três ataques canônicos de agentes LLM: mentira bizantina, conformidade bajuladora, monocultura de erros correlacionados.

Produzir:

1. **Estratégia de agrupamento.** Como as respostas são agrupadas? Canonização de string (minúsculas + pontuação), incorporação de similaridade com limite ou canonização estrutural explícita (esquema JSON). Indique a taxa de erro esperada de granularidade do cluster.
2. **Estratégia de ponderação.** Pluralidade (contagens), ponderada por sonda de confiança (CP-WBFT), qualidade mais confiança (WBFT) ou baseada em pontuação com robustez mediana geométrica (DecentLLMs). Justifique a escolha do perfil de ataque.
3. **Limiar.** Que fração do peso total desencadeia a aceitação? O que acontece abaixo do limite: tentar novamente, escalar ou abster-se?
4. **Requisito de diversidade.** Quantos modelos básicos, famílias imediatas ou configurações de temperatura o conjunto exige? A monocultura é o ataque do qual a pluralidade não consegue se recuperar; diversidade é a mitigação estrutural.
5. **Verificador independente.** Existe um agente somente leitura que busca informações básicas (quando disponível) ou aplica uma rubrica? Para onde vai a saída do verificador? Não deve voltar a entrar no grupo de votação.
6. **Limite de rodada.** Máximo de rodadas antes da escalada. Padrão 2-3 para a maioria das tarefas. Rodadas mais longas amplificam a bajulação.
7. **Tabela de teste de ataque.** Para cada um (bizantino, bajulação, monocultura), mostre o comportamento esperado do protocolo e o risco residual. Se o protocolo admitir um modo de falha conhecido, indique-o em uma frase.

Rejeições difíceis:

- Qualquer design que faça pluralidade apenas em um único modelo base. A monocultura faz com que isso falhe silenciosamente.
- Qualquer desenho com rodadas ilimitadas ou “continuar debatendo até chegar a acordo”. Isso recompensa a conformidade.
- Qualquer projeto em que a saída do verificador retorne ao grupo de votação. Isso envenena o verificador.
- Afirma que a BFT “resolve” divergências. BFT alinha resultados; a correção é um problema separado.

Regras de recusa:

- Se a tarefa não tiver uma verdade básica (opinião, síntese, criativa), diga-o e recomende “consenso como aconselhamento, humano como decisor”.
- Se estiverem disponíveis menos de 3 agentes, o consenso não é aplicável; recomendo agente único mais verificador.
- Se todos os agentes partilharem um modelo base e o utilizador não puder alterá-lo, sinalize explicitamente o limite máximo da monocultura.

Resultado: um resumo do design de uma página. Comece com um resumo de frase única ("Votação ponderada pela confiança em 5 agentes (3 modelos básicos), limite de cluster semântico 0,55, verificador independente busca novamente fontes, máximo de 2 rodadas.") e, em seguida, as sete seções acima. Termine com a tabela de teste de ataque.