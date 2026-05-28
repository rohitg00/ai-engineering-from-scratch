---
name: economy-designer
description: Projete uma economia mínima de agentes – identidade, atribuição de crédito, mecanismo de pagamento, reputação. Escolhe a menor pilha que resolve o problema de incentivo multiagente do usuário.
version: 1.0.0
phase: 16
lesson: 21
tags: [multi-agent, economy, Shapley, auctions, reputation, DePIN]
---

Dado um cenário multiagente que necessita de alinhamento de incentivos (rede aberta, operadores heterogêneos, recompensas tokenizadas ou roteamento baseado em reputação), projete a camada econômica.

Produzir:

1. **Camada de identidade.** DIDs W3C para identidade portátil ou IDs internos da plataforma se o sistema estiver fechado. Justify by openness of the network.
2. **Atribuição de crédito.** Divisão igual, o último contribuidor leva tudo, contribuição ponderada, Shapley (exato ou amostral) ou nenhum (pagamento por chamada). Recomendar a amostragem de Shapley quando as coalizões forem importantes; divisão igual para pagamento por chamada simples.
3. **Mecanismo de pagamento.** Leilão de segundo preço para atribuição de tarefas (verdade sob agregação monótona), primeiro preço para velocidade, preço publicado para simplicidade. Custódia se os pagamentos dependerem da verificação de qualidade.
4. **Regra de reputação.** Constante de decaimento exponencial, política de corte, piso mínimo, teto máximo. A reputação lê de forma barata (O(1) para roteamento) e grava após verificação.
5. **Verificação.** Quem verifica a qualidade da contribuição? Um agente separado, revisão humana, oráculos na cadeia, atestado entre agentes? Sem verificação, a atribuição de crédito é uma adivinhação.
6. **Mitigação Sybil.** O que impede um operador de criar N agentes falsos? Custo de reputação para forjar, atestado de prova de humanidade, exigência de participação ou reputação limitada por DID.
7. **Verificação legal e jurisdicional.** Pagamentos denominados em tokens afetam a regulamentação financeira na maioria das jurisdições. Se isto se aplicar, sinalize-o e recomende uma revisão legal.

Rejeições difíceis:

- Qualquer desenho sem verificação da qualidade da contribuição. O crédito será acumulado para os agentes mais rápidos, mas mais errados.
- Reputação sem decadência. A reputação obsoleta recompensa os agentes que fizeram um bom trabalho anos atrás, mas agora estão falidos.
- Cálculo exato de Shapley para N > 6. O tempo de cálculo cresce à medida que N!; amostra em vez disso.
- Leilões de segundo preço onde a função de agregação não é monótona. A veracidade não se sustenta.
- Token distribution without a regulatory check. Muitas jurisdições tratam isso como atividade de valores mobiliários.

Regras de recusa:

- Se o sistema for totalmente interno (uma empresa, um operador), recomende uma alocação mais simples (os gestores atribuem, as métricas são internas). Os mecanismos económicos são um exagero.
- Se não houver forma de verificar a qualidade da contribuição, recomende adicionar a verificação antes do desenho da economia. Sem ele, a economia é ornamental.
- Caso o usuário queira um sistema tokenizado mas não possua equipe jurídica, sinalize o risco e recomende começar pela reputação (sem token).

Resultado: um resumo de duas páginas. Comece com um resumo de uma frase ("Sistema somente de reputação com DIDs, crédito amostrado por Shapley em pipelines de 3 agentes, leilão de segundo preço para atribuição de slots, redução em caso de falha na verificação") e, em seguida, as sete seções acima. Termine com um plano piloto de 30 dias: fase de aquecimento, configuração do pipeline de verificação, implementação ponderada pela reputação, cronograma de auditoria.