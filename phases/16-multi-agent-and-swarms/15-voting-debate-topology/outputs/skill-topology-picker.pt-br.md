---
name: topology-picker
description: Escolha uma topologia de debate multiagente (estrela/cadeia/árvore/gráfico), um N de agentes, um perfil de heterogeneidade e um limite de rodada para uma determinada tarefa.
version: 1.0.0
phase: 16
lesson: 15
tags: [multi-agent, debate, topology, voting, self-consistency]
---

Dada uma descrição da tarefa, recomende uma topologia e dimensionamento multiagente.

Produzir:

1. **Impressão digital da tarefa.** Pesquisa (horizonte longo, aberto), factual rápido (resposta em formato fechado), refinamento gradual (pipeline em etapas) ou opinião (sem verdade). Escolha um; se abranger dois, escolha a forma dominante.
2. **Topologia.** Estrela, cadeia, árvore ou gráfico. Justifique a partir da impressão digital:
   - pesquisa → gráfico (qualquer crítica)
   - rápido-factual → estrela (agregados de hub)
   - refinamento passo a passo → cadeia (ou árvore se for dividir e conquistar)
   - opinião → nenhuma das opções acima; recomendar agente único + decisão humana
3. **N de agentes.** 3 é o conjunto útil mais barato; 5 é o ponto ideal comum; 7+ é especialidade. Acima de 5 na topologia gráfica, alerta sobre taxa de coordenação.
4. **Perfil de heterogeneidade.** Pelo menos um agente deve vir de uma família de modelo base diferente se a monocultura for importante (pesquisa, raciocínio). Prefira 3 modelos básicos diferentes em N=5.
5. **Rodada limitada.** 1 rodada = votação. 2 rodadas = um refinamento. 3 rodadas = máximo antes que a conformidade domine. Nunca ilimitado.
6. **Agregação.** Pluralidade (barato), ponderada pela confiança (CP-WBFT da Lição 14), mediana geométrica (DecentLLMs) ou pontuação do juiz. O padrão é baseado na confiança, a menos que restrições de custo imponham pluralidade.
7. **Escalonamento.** Consenso abaixo do limite → escalar para onde? Humano, outro conjunto com modelos de base diferentes, ou abstenção?

Rejeições difíceis:

- Qualquer recomendação de mais de 10 agentes na topologia gráfica. O imposto de coordenação domina; meça primeiro.
- Topologia em estrela para questões de pesquisa abertas. Star perde o benefício de qualquer crítica.
- Qualquer recomendação que execute o mesmo modelo base N vezes e o chame de multiagente. Isso é autoconsistência disfarçada; rotulá-lo corretamente.
- Rodadas ilimitadas. Conformidade de recompensas; quanto mais o debate se prolonga, mais os agentes concordam por pressão e não por lógica.

Regras de recusa:

- Se a tarefa não tiver base verdadeira (opinião, síntese, criativa), declare que o voto é consultivo. Recomendar agente único + decisão humana.
- Se o usuário não tiver acesso a vários modelos básicos, sinalize o teto da monocultura e recomende a autoconsistência com a variação de temperatura como alternativa.
- Se a tarefa for simples (pesquisa factual única, < 100 tokens de raciocínio), recomende um único agente com autoconsistência N=5.

Resultado: um resumo de uma página. Comece com uma recomendação de frase única ("Topologia gráfica, N=5 agentes de 3 modelos básicos diferentes, 2 rodadas, agregação ponderada pela confiança, escalonamento para humano abaixo do limite.") e, em seguida, as sete seções acima. Termine com uma estimativa de orçamento: tokens esperados por consulta e latência esperada em segundos.