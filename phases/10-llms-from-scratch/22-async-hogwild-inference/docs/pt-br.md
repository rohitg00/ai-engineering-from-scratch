# Async e Hogwild! Inference

> Decodificacao eespecificaçãoulativa (Fase 10, Aula 15) paraleliza tokens dentro de uma sequencia. Frameworks multi-agente paralelizam sequencias inteiras mas forcam coordenacao explicita (votacao, divisao de sub-tarefas). Hogwild! Inference (Rodionov et al., arXiv:2504.06261) faz algo diferente: roda N instancias do mesmo LLM em paralelo contra um KV cache COMPARTILHADO. Cada worker ve imediatamente os tokens gerados por todos os outros workers. Modelos de raciocinio modernos -- QwQ, DeepSeek-R1 -- conseguem se auto-coordenar por meio desse cache compartilhado sem nenhum fine-tuning. A abordagem e experimental mas abre um eixo totalmente novo de paralelismo de inferencia que fica ortogonal a decodificacao eespecificaçãoulativa. Esta aula implementa um simulador Hogwild! de dois workers em Python stdlib e explica por que a colaboracao por cache compartilhado emerge das habilidades de raciocinio do modelo existente.

**Tipo:** Construir
**Linguagens:** Python (stdlib)
**Pre-requisitos:** Fase 10 · 12 (otimizacao de inferencia), Fase 10 · 15 (decodificacao eespecificaçãoulativa)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Descrever as tres topologias comuns de LLM paralelo (votacao, sub-tarefa, Hogwild!) e nomear quais problemas cada uma foca.
- Enunciar o setup central do Hogwild! multiplos workers, um KV cache compartilhado, coordenacao emergente via auto-prompting.
- Calcular o speedup de tempo real do Hogwild! como funcao do numero de workers `N`, paralelismo por tarefa `p` e overhead de coordenacao `c`.
- Implementar um simulador Hogwild! de dois workers em uma tarefa toy e observar a divisao emergente de tarefas.

## O Problema

LLMs modernos resolvem problemas dificeis produzindo cadeias longas de raciocinio -- 5000 tokens de logica passo-a-passo e comum, dezenas de milhares de tokens acontecem em problemas de matematica profundos. A 35 tokens/segundo de decode num modelo 70B, 50k tokens e 24 minutos. Interativo o modelo nao e.

Decodificacao eespecificaçãoulativa (Fase 10, Aula 15) te da 3-5x de speedup paralelizando dentro de uma sequencia. Alem disso a dependencia sequencial da decodificacao autoregressiva e o teto rigido. Cada token novo depende de todos os anteriores.

A pergunta obvia: podemos paralelizar entre sequencias? Rodar multiplos copias do mesmo modelo no mesmo problema, deixar cooperar, dividir o trabalho?

Trabalhos anteriores: ensambles de votacao (rodar N modelos, escolher a resposta majoritaria), arvore de pensamento (ramificar caminhos de raciocinio e recombinar) e frameworks multi-agente (designar cada agente uma sub-tarefa, usar um coordenador). Todos ajudam em dominios de tarefas eespecificaçãoificos. Todos tambem introduzem maquinario explicito de coordenacao -- regras de votacao, logica de ramificar-e-podar, protocolos de mensagem agente-a-agente.

Hogwild! Inference usa uma abordagem diferente. N workers compartilham um unico KV cache. Cada worker ve imediatamente os tokens gerados por todos os outros workers, como se fossem seu proprio contexto. Os workers -- sem nenhum treinamento ou fine-tuning -- descobrem como dividir o trabalho. Modelos de raciocinio modernos (QwQ, DeepSeek-R1, modo de raciocinio da familia Claude) podem ler o cache compartilhado e dizer coisas como "vejo que o worker 2 ja cuidou do caso base, entao vou trabalhar no passo indutivo."

O speedup depende da carga de trabalho e e experimental em abril de 2026. Mas a ideia vale conhecer porque abre um novo eixo de paralelismo de inferencia.

## O Conceito

### O setup

Inicialize N processos worker, todos rodando o mesmo LLM. Ao inves de caches KV por worker, mantenha UM cache compartilhado. Quando o worker `i` gera o token `t_j`, o token e escrito no cache compartilhado na proxima posicao. Quando o worker `k` faz seu proximo passo, ele le o estado atual do cache (que inclui tudo que todos os N workers geraram ate agora).

No momento do passo, workers correm pra escrever tokens. Nao tem indice de posicao por worker -- o cache e uma sequencia unica crescendo. A ordem e determinada pela hora de chegada da escrita.

### Por que coordenacao emerge

Os workers compartilham um prompt. Tipicamente algo como "Voce e uma de N instancias trabalhando juntas neste problema. Cada instancia le a memoria compartilhada e pode ver o que outras instancias escreveram. Evite trabalho redundante." O prompt mais o cache compartilhado e suficiente. Modelos de raciocinio leem o cache, notam quais partes do problema ja foram tentadas e (frequentemente mas nao sempre) mudam pra partes inexploradas.

O paper Hogwild! (Rodionov et al., 2025) reporta observacoes como:

- Workers formulam planos e comunicam pra outros workers via o cache.
- Workers notam erros no raciocinio de outros workers e apontam.
- Workers adaptam quando um plano falha e propoem alternativas.
- Quando promptados pra checar redundancia, workers detectam e mudam.

Nenhum disso requer fine-tuning. O comportamento emergente vem das capacidades de raciocinio que o modelo ja tem.

### A nomenclatura

O nome do paper faz referencia a Hogwild! SGD (Recht et al., 2011), um otimizador de atualizacao assincrona. A analogia: workers assincronos do SGD todos escrevem em um vetor de parametros compartilhado; workers do Hogwild! Inference todos escrevem em um KV cache compartilhado. Ambos dependem de convergencia empirica ao inves de garantias de sincronizacao.

### RoPE viabiliza isso

Rotary Position Embeddings (RoPE, Su et al. 2021) codificam informacao posicional via rotacao nos vetores Q e K. Como posicoes sao rotacoes e nao offsets fixos, a posicao de um token pode mudar sem recomputar a entrada do KV cache. Quando o worker `i` escreve no cache compartilhado na posicao `p`, outros workers lendo aquela posicao podem usar a entrada em cache diretamente -- sem necessidade de re-rotacao.

Em um modelo de posicao aprendida ou posicao absoluta, Hogwild! precisaria invalidacao de cache em cada escrita concorrente. RoPE deixa o cache estavel.

### Matematica de tempo real

Seja `T_serial` o tempo pra um worker resolver o problema sozinho. Seja `p` a fracao paralelizavel por tarefa. Seja `c` o overhead de coordenacao por passo (ler o cache estendido, decidir o que escrever).

Tempo com um worker: `T_serial`.
Tempo com N workers Hogwild!, se coordenacao for gratis: `T_serial * ((1 - p) + p / N)`. Amdahl classico.
Com overhead de coordenacao: `T_serial * ((1 - p) + p / N) + c * steps_per_worker`.

Pra um worker ser produtivo, `c` precisa ser pequeno em relacao ao tempo de decode por passo. Em modelos de raciocinio gerando 5k+ tokens, os workers podem aguentar centenas de tokens de overhead de coordenacao e ainda sair na frente. Em tarefas de chat curtas, coordenacao domina e Hogwild! e pior que serial.

### Exemplo concreto

Problema de raciocinio: 10k tokens de cadeia de raciocinio. Suponha que o problema tenha `p = 0.7` de conteudo paralelizavel (estrategias de prova diferentes, analises de caso diferentes) e `c = 200` tokens de overhead de coordenacao por worker. Com `N = 4` workers:

- Tempo serial: 10000 passos de decode.
- Tempo Hogwild!: 10000 * (0.3 + 0.7 / 4) + 200 * 4 = 10000 * 0.475 + 800 = 5550 passos de decode.
- Speedup: 10000 / 5550 = 1.8x.

Isso e moderado. Mas em problemas de raciocinio mais longos (50k tokens), o overhead de coordenacao se amortiza e o speedup chega a 2.5-3x. Hogwild! e o equivalente de inferencia do paralelismo a nivel de threads em uma linguagem que deixa voce escrever codigo multi-threaded naturalmente.

### Quando usar Hogwild!

- Problemas de raciocinio longos (milhares de tokens) onde a tarefa pode ser paralelizada entre sub-objetivos independentes.
- Modelos de raciocinio que foram treinados pra pensar passo a passo. Modelos nao-raciocinio nao se auto-coordenam bem.
- Deploy em node unico com VRAM suficiente pra armazenar o cache compartilhado mais N processos worker. O cache e compartilhado, mas cada worker tem sua propria memoria de ativacao.

### Quando nao usar

- Chat interativo curto. Overhead de coordenacao domina.
- Tarefas que nao paralelizam (prova linear unica, compilacao unica). N=1 e o maximo.
- Modelos nao-raciocinio. Nenhuma coordenacao emerge.
- Deploy multi-node. O cache compartilhado precisa sincronizacao muito rapida entre workers. Intra-node e fine; entre nodes e desastre de latencia.

### O status experimental

Em abril de 2026, Hogwild! e um metodo de pesquisa com implementacao open-source em PyTorch. Adocao de producao nao aconteceu. Tres bloqueios:

1. Gerenciamento de KV cache compartilhado entre processos concorrentes e engenharia nao-trivial.
2. Coordenacao emergente depende da tarefa; benchmarks ainda estao sendo construidos.
3. Os speedups sao moderados comparados ao que decodificacao eespecificaçãoulativa ja entrega, e os dois podem ser combinados mas a engenharia combinada e outra camada.

Vale conhecer. Vale experimentar. Ainda nao vale apostar um produto.

## Construir

`code/main.py` implementa um simulador toy Hogwild!:

- Dois processos worker, cada um um "LLM" deterministico que produz uma de varias categorias de token (work-token, observe-token, coordinate-token) com probabilidades conhecidas.
- Um cache compartilhado (so uma lista de tokens) que ambos os workers leem e escrevem.
- Uma logica simples de coordenacao: quando um worker ve que o outro ja produziu tokens de trabalho suficientes numa categoria, ele escolhe uma categoria diferente.

O simulador roda por um orcamento fixo de passos e reporta:

- Total de work-tokens produzidos.
- Tempo real total (numero de passos de worker).
- Speedup efetivo sobre um worker unico.
- Um rastro de qual worker escreveu qual token.

### Passo 1: o cache compartilhado

Uma lista que ambos os workers adicionam. Trancamento simples (Python `threading.Lock`) em implementacao real; simulamos com um contador.

### Passo 2: o loop do worker

Cada worker, a cada passo:

- Le o cache compartilhado atual.
- Decide que categoria de token escrever baseado no que ja esta la.
- Escreve um token.

### Passo 3: a heuristica de coordenacao

Se a categoria X ja tem K tokens no cache e a categoria pretendida do worker e X, o worker muda pra categoria Y. Isso e um substituto toy do comportamento de "note que isso ja esta coberto, faca outra coisa" dos modelos de raciocinio.

### Passo 4: speedup medido

Rode o simulador com N=1 worker e com N=2 workers, mesmo orcamento total de passos. Conte work-tokens produzidos. N=2 deve produzir cerca de 1.5-1.8x mais work-tokens por causa da divisao de tarefas guiada por coordenacao.

### Passo 5: estressar a coordenacao

Reduza a sensibilidade da heuristica de coordenacao. Rode de novo. Observe que sem boa coordenacao, N=2 produz redundante os mesmos tokens e o speedup cai abaixo de 1. Isso combina com a observacao do paper: o truque so funciona se os workers tem a capacidade de raciocinio pra se auto-coordenarem.

## Usar

Integracao do Hogwild! em producao em abril de 2026 e de nivel de pesquisa. A implementacao de referencia do Yandex/HSE/IST e baseada em PyTorch e foca em setups de node unico multi-processo em modelos DeepSeek-R1 e QwQ.

Caminho pragmatico de adocao:

1. Profile da sua carga de trabalho de raciocinio. Meça a fracao de tokens que sao exploratorios (multiplos estrategias, analises de caso, busca) vs lineares.
2. Se exploracao domina, rode um experimento Hogwild! de dois workers. Meça a melhoria de tempo real.
3. Se a melhoria for abaixo de 1.3x, voce esta no regime dominado por coordenacao. Volte pra um worker.
4. Se a melhoria for acima de 1.5x, va pra N=4 e meça de novo. Retornos decrescentes tipicamente batem em torno de N=4-8.

Combine com decodificacao eespecificaçãoulativa: cada worker Hogwild! pode usar independentemente decodificacao eespecificaçãoulativa. Os dois speedups se multiplicam (aproximadamente), levando um 3x de decodificacao eespecificaçãoulativa e 1.8x de Hogwild! a um efetivo 5.4x sobre decodificacao ingenua de um worker.

## Entregar

Esta aula produz `outputs/skill-parallel-inference-router.md`. Dado um perfil de carga de trabalho de raciocinio (orcamento de tokens, perfil de paralelismo de tarefas, familia de modelo, alvo de deploy), rota entre votacao, arvore de pensamento, multi-agente, Hogwild! e estrategias de decodificacao eespecificaçãoulativa.

## Exercicios

1. Rode `code/main.py` com as configuracoes padrao. Confirme que a configuracao Hogwild! de N=2 produz mais work-tokens que o baseline de N=1 no mesmo tempo real.

2. Reduza a forca da heuristica de coordenacao (set `coordination_weight=0.1`). Rode de novo. Mostre que o speedup despenca. Explique por que: os workers duplicam esforco quando nao conseguem coordenar.

3. Calcule o speedup esperado do Hogwild! pra uma tarefa de raciocinio de 50k tokens com `p=0.8, c=500` e N=4 workers. Faca o mesmo pra uma tarefa de chat de 1k tokens com `p=0.3, c=200` e N=4. Por que uma e ganho e a outra e perda?

4. Leia a Secao 4 do paper Hogwild! (avaliacao preliminar). Identifique os dois modos de falha que os autores reportam. Descreva como um prompt de coordenacao melhor poderia mitigar cada um.

5. Combine Hogwild! com decodificacao eespecificaçãoulativa no toy: cada worker usa uma decodificacao eespecificaçãoulativa de 2 tokens internamente. Reporte o speedup multiplicativo. Que problema de contabilidade surge quando dois workers querem ambos estender o mesmo prefixo do cache compartilhado?

## Termos Principais

| Termo | O que a gente diz | O que realmente significa |
|-------|-------------------|--------------------------|
| Hogwild! | "Workers paralelos, cache compartilhado" | N instancias do mesmo LLM rodando concorrentemente com um KV cache compartilhado; coordenacao emergente via auto-prompting |
| KV cache compartilhado | "O meio de coordenacao" | Um unico buffer KV crescendo que todos os workers leem e escrevem; viabiliza visibilidade instantanea de tokens entre workers |
| Coordenacao emergente | "Nao precisa treinamento" | LLMs com capacidade de raciocinio podem ler o cache compartilhado e dividir trabalho sem nenhum fine-tuning ou protocolo explicito |
| Overhead de coordenacao (c) | "Tokens gastos se orientando" | O custo por worker de ler o cache estendido e decidir o que fazer; precisa ficar pequeno vs tempo total de decode |
| Fracao paralelizavel (p) | "O que pode rodar em paralelo" | Paralelismo a nivel de tarefa: a fracao do trabalho total que nao e intrinsecamente sequencial |
| RoPE viabiliza Hogwild! | "Posicoes rotacionais sao shift-invariant" | Como posicoes sao rotacoes, escrever em um cache compartilhado nao requer recomputar tokens anteriores |
| Ensemble de votacao | "Rodar N, escolher a maioria" | A topologia mais simples de inferencia paralela; util pra classificacao, menos pra raciocinio longo |
| Arvore de pensamento | "Ramificar e podar" | Estrategia de raciocinio que explora multiplos ramos e poda; logica explicita de coordenacao |
| Framework multi-agente | "Designar sub-tarefas" | Cada agente ganha um papel; um coordenador orquestra; overhead pesado de protocolo |

## Leitura Complementar

- [Rodionov et al. -- Hogwild! Inference: Parallel LLM Generation via Concurrent Attention (arXiv:2504.06261)](https://arxiv.org/abs/2504.06261) -- o paper Hogwild!, avaliacao preliminar em QwQ e DeepSeek-R1
- [Recht, Re, Wright, Niu -- Hogwild!: A Lock-Free Approach to Parallelizing Stochastic Gradient Descent (arXiv:1106.5730, NeurIPS 2011)](https://arxiv.org/abs/1106.5730) -- o original Hogwild!, a origem do nome
- [Su et al. -- RoFormer: Enhanced Transformer with Rotary Position Embedding (arXiv:2104.09864)](https://arxiv.org/abs/2104.09864) -- RoPE, a propriedade que torna inferencia de cache compartilhado viavel
- [Yao et al. -- Tree of Thoughts: Deliberate Problem Solving with Large Language Models (arXiv:2305.10601)](https://arxiv.org/abs/2305.10601) -- a estrategia de raciocinio em arvore que Hogwild! fica ortogonal a
- [Leviathan et al. -- Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192)](https://arxiv.org/abs/2211.17192) -- decodificacao eespecificaçãoulativa, o paralelismo intra-sequencia que Hogwild! combina com
- [Implementacao de referencia Hogwild! em PyTorch](https://github.com/eqimp/hogwild_llm) -- a unica fonte de verdade pros experimentos do paper
