# Votação, autoconsistência e topologia do debate

> A mais barata agregação: amostra N agentes independentes, maioria-voto. Wang et al. 2022 autoconsistência fez isso com um modelo amostrado N vezes. Multi-agente amplia com **heterogeneous**Agentes para escapar da monocultura  diferentes modelos, diferentes indicações, diferentes temperaturas, diferentes contextos. Além da maioria dos votos, debate topologia questões: MultiAgentBench (arXiv:2503.01935, ACL 2025) avaliou a coordenação estrela / cadeia / árvore / gráfico e encontrou **graph best for research**O AgentVerse (ICLR 2024) documenta dois padrões emergentes  comportamentos voluntários e comportamentos de conformidade  e a conformidade é tanto uma característica (encontrando consenso) quanto um risco (pensamento em grupo, lição 24). Esta lição mapeia o espaço topológico, constrói cada variante e mede o imposto de coordenação.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 14 (Consensus and BFT)
**Time:** ~75 minutes

## Problemas

O debate pode melhorar a precisão (Du et al., arXiv:2305.14325).

1. Quem fala com quem (topologia).
2. Quantas rondas (Du 2023: ambas as rondas e agentes importam independentemente).
3. Se os agentes são heterogêneos (modelos base diferentes quebram a monocultura).
4. Se há ou não uma voz adversária (steel-manning vs straw-manning).

As equipes que "exercem 5 agentes e votam" em uma tarefa geralmente regressam contra um único agente. Os falhas não são aleatórios. Eles rastream topologia e heterogeneidade. Esta lição é o mapa topológico.

## Conceptos

### Autoconsistência, linha de base de modelo único

Wang et al. 2022 ("A autoconsistência melhora a cadeia de raciocínio do pensamento") amostrou o mesmo modelo N vezes a temperatura > 0 e votou a maioria nas respostas do caminho de raciocínio. O resultado no GSM8K: ganhos substanciais com amostras N = 40 em uma única decodificação gananciosa.

Limites: autoconsistência usa um modelo base. erros são correlacionados pela construção. Se o modelo tem um viés sistemático, todas as amostras N compartilham.

### Voto multi-agente, extensão heterogênea

Substitua as amostras N por N * diferentes* agentes. Diferentes modelos base (Claude, GPT, Llama), diferentes instruções, acesso a ferramentas diferente. O benefício: erros não correlacionados. O custo: diferentes agentes custam diferentes quantidades; coordená-los adiciona custos gerais.

O nome canônico para o debate heterogêneo para 2026 é **A-HMAD** Debate heterogêneo multi-agente adversário. Não é universalmente adotado, mas os artigos usam o termo para "debate de modelos diferentes, o que reduz os erros correlacionados do colapso da monocultura".

### As quatro topologias

```
star                chain               tree                graph

    ┌─A─┐           A─B─C─D         ┌──A──┐              A───B
    │   │                           │     │              │ × │
    B   C                           B     C              D───C
    │   │                          / \   / \
    D   E                         D   E F   G           (fully connected)
```

Uma linha, todas as outras falam apenas com a linha, equivalente a um supervisor sem canal de volta.
Chain: linear, cada agente vê a saída do anterior.
Árvore: hierárquica, utilizada pelos sistemas de agentes hierárquicos (Lessão 06).
Grafico: qualquer um a qualquer. Inclui clique totalmente conectado e DAGs arbitrários.

### O imposto de coordenação (MultiAgentBench)

MultiAgentBench (MARBLE, ACL 2025, arXiv:2503.01935) benchmarked estrela, cadeia, árvore, gráfico em um conjunto de tarefas incluindo pesquisa, codificação e planejamento. Resultados principais medidos:

- **Graph**A topologia vence as tarefas de investigação.
- **Star**O Hub filtra e consolida.
- **Chain**ganhos em oleodutos gradualmente (refinamento por etapas).
- **Coordination tax**O valor do relógio de parede e do token crescem mais rápido do que a qualidade.

O teto de 4 agentes é empírico, não fundamental. Reflete a capacidade de contexto de 2026 LLM: o contexto de cada agente se enche de resultados de pares, e o valor marginal de adição de agente N + 1 cai uma vez que todos podem ver todos.

### Estratégias de Debate Multidisponentes ("Deveríamos estar a ENFALAR?")

ArXiv:2311.17371 é a pesquisa de 2023 das estratégias MAD. Descoberta-chave replicada por outros: variantes MAD que são *estruturalmente semelhantes* à autoconsistência (ampliamento independente + agregação) muitas vezes apresentam um desempenho inferior à autoconsistência ao usar o mesmo orçamento.

### AgenteVerse padrões emergentes

AgenteVerse (ICLR 2024, https://proceedings.iclr.cc/paper_files/paper/2024/file/578e65cdee35d00c708d4c64bce32971-Paper-Conference.pdf) documenta dois comportamentos que emergem do debate multi-agente, mesmo sem um desenho explícito:

- **Volunteer.**Um agente oferece ajuda ("Eu posso dar o próximo passo") sem ser solicitado. Útil: atribui trabalho ao agente mais capacitado para uma subtarefa.
- **Conformity.**O agente ajusta a sua posição para corresponder a um crítico, mesmo quando o crítico está errado.

A conformidade é o motivo pelo qual o debate até acordo recompensa os intimidantes.

### Heterogeneidade: o botão real que move precisão

Um padrão 2024-2026 na literatura prática: trocar um dos seus agentes N por um modelo base diferente dá uma maior precisão do que aumentar N por 1.

Em um limite, a heterogeneidade supera a numerosidade. Três modelos diferentes superam cinco cópias de um modelo na maioria das tarefas que têm verdade de terra limpa.

### Métodos de júri

O quadro Sibyl (citado na literatura Minsky-LLM) formaliza um "jurado"  um pequeno conjunto de agentes especializados que refinam respostas votando em cada etapa. Ao contrário do voto de maioria simples, um júri tem papéis: um agente interroga, um fornece contexto, um marca plausibilidade. Os métodos do júri são um ponto médio entre o voto simples (barato, propenso à monocultura) e o MAD completo (custo, propenso à conformidade).

### Quando o voto com debate domina

- A questão tem verdade fundamental (fatos, matemática, comportamento de código).
- Os agentes podem aceder a diferentes fontes ou ferramentas (disponível a heterogeneidade).
- As rodadas são limitadas (2-3 típicas) e há um juiz ou verificador separado.
- O orçamento permite 3-5 agentes. Além de 5-7 em topologia gráfica, o imposto de coordenação domina.

### Quando a votação com debate dói

- A pergunta é de opinião, os agentes convergem para a resposta que parece mais confiante, não mais correta.
- Todos os agentes compartilham um modelo base.
- As rodadas são ilimitadas, a conformidade ganha sempre.
- A tarefa é simples. Um agente único com autoconsistência em N=5 é mais barato e tão preciso.

```figure
sw-debate-topology
```

## Construí-lo

`code/main.py`Implementos:

- `run_star(agents, hub, question)` Pesquisas de cada trabalhador, agregados.
- `run_chain(agents, question)` refinamento sequencial.
- `run_tree(root, children, question)` hierárquica com agregação profundidade-2.
- `run_graph(agents, question, rounds)`- Debate total, rodadas limitadas.
- Um dial de heterogeneidade scripted: cada agente tem um `error_bias`Indicando a sua erroneidade sistemática.
- Um arame de medição que executa cada topologia em N=3, 5, 7 e relata (acurateza, total_tokens, wallclock_simulated).

- Correr .

```
python3 code/main.py
npx tsx code/main.ts
```

Resultados esperados: uma tabela de topologia × N → (acurateza, tokens, latência). Grafico ganha em N=3-5 nas tarefas de estilo de pesquisa; estrela ganha nas tarefas de fatos rápidos; grafico em N=7 mostra o imposto de coordenação (latencia infla mais rápido do que precisão).

## Usá-lo

`outputs/skill-topology-picker.md`é uma habilidade que lê uma descrição de tarefa e recomenda uma topologia (estrela / cadeia / árvore / gráfico), um N (número de agentes), um perfil de heterogeneidade (modelos básicos a utilizar) e um limite redondo.

## Envia-o

Para qualquer conjunto:

- Começa com **self-consistency at N=5**O modelo base é o mais barato.
- Avaliar para **heterogeneous voting at N=3**Se a precisão for importante, mede o delta.
- Apenas atualizar para **debate topology**se a tarefa tiver estrutura (investigação, múltiplas etapas) e se for possível realizar rodadas limitadas.
- Sempre registar o grupo de minorias. Quando uma minoria está persistentemente certa, você tem um sinal de diversidade.
- "Melhor precisão a 10 vezes o custo" é uma decisão empresarial.

## Exercícios

1. Corra .`code/main.py`. Descrever a curva de coordenação-imposto para topologia do gráfico: precisão vs N, tokens vs N. Em que N a curva se inclui?
2. Implementar A-HMAD: três agentes com preconceitos deliberadamente diferentes. Como a linha de base de todos os mesmos preconceitos compara-se com A-HMAD no ataque de monocultura da lição 14?
3. Adicionar um papel de "juiz" à topologia do gráfico que não vota, apenas marca o consenso final.
4. Leia o artigo AgentVerse (ICLR 2024). Identifique qual é o comportamento emergente que a sua implementação mostra mais fortemente.
5. Leia MultiAgentBench (arXiv:2503.01935) Seção 4 (experimentos topológicos). Reproduzir o resultado "grafo-ganha-investigação" em uma tarefa do papel usando o seu arnes.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Self-consistency | "Sample N times, vote" | Wang 2022. Single model, N temperature>0 samples, majority vote on reasoning paths. |
| Heterogeneity | "Different models" | Ensemble of different base models or prompt families. Breaks monoculture. |
| MAD | "Multi-agent debate" | Generic term for agents exchanging critiques over rounds. See Du 2023. |
| A-HMAD | "Adversarial Heterogeneous MAD" | MAD variant emphasizing different models + adversarial structure. |
| Topology | "Who talks to whom" | Star, chain, tree, graph. Determines information flow. |
| Coordination tax | "Diminishing returns" | Above ~4 agents on graph, cost grows faster than quality. |
| Volunteer behavior | "Unprompted help" | AgentVerse emergent pattern: an agent offers to take a step. |
| Conformity behavior | "Agreement under pressure" | AgentVerse emergent pattern: an agent aligns with a critic. |
| Jury | "Small specialized panel" | Sibyl-style ensemble with roles (examiner, context, scorer). |

## Mais leitura

- [Wang et al. — Self-Consistency Improves Chain of Thought Reasoning](https://arxiv.org/abs/2203.11171) Linha de base para um único modelo
- [Du et al. — Improving Factuality and Reasoning via Multiagent Debate](https://arxiv.org/abs/2305.14325) Os dois agentes e as rodadas são independentes
- [MultiAgentBench / MARBLE](https://arxiv.org/abs/2503.01935) índice de referência de topologia que mostra o gráfico melhor para a investigação, cadeia para os oleodutos
- [Should we be going MAD?](https://arxiv.org/abs/2311.17371) Pesquisa de estratégia MAD; constata que a MAD muitas vezes perde para a autoconsistência com orçamento igual
- [AgentVerse (ICLR 2024)](https://proceedings.iclr.cc/paper_files/paper/2024/file/578e65cdee35d00c708d4c64bce32971-Paper-Conference.pdf) padrões emergentes de voluntariado e conformidade
- [MARBLE repo](https://github.com/ulab-uiuc/MARBLE) Implementação de referência
