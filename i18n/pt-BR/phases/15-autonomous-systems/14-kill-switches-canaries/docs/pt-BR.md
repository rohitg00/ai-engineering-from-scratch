# Matar interruptores, interruptores de circuito e tokens canários

> Um interruptor de eliminação é um booleano mantido fora da superfície de edição do agente  uma chave Redis, uma bandeira de recurso, uma configuração assinada  que desativa completamente o agente. Um interruptor de circuito é mais fino: ele tropeça em um padrão específico (cinco chamadas de ferramenta idênticas seguidas), pausa o caminho ofensivo e escala para um ser humano. Um token canário herda do classico engano: uma credencial falsa ou um registro de honeypot um agente não tem razão legítima para tocar, cujo acesso desencadeia um alerta. Os dados baseados em eBPF (por exemplo, Cilium) pode reescrever a saída de um módulo em quarentena para um honeyypot forense na camada do kernel; os referências publicados do Cilium relatam latência de dados P99 sub-millisecondas sob carga (o seu orçamento de propagação depende de como uma atualização de política atinge o nó, não o próprio datapath). Os detectores estatísticos (EWMA, CUSUM) que se adaptam a uma linha de base em movimento aceitarão silenciosamente a deriva  revestidos com limites constitucionais duros que não se dobram.

**Type:** Learn
**Languages:** Python (stdlib, three-detector simulator: kill switch, circuit breaker, canary), TypeScript
**Prerequisites:** Phase 15 · 13 (Cost governors), Phase 15 · 10 (Permission modes)
**Time:** ~60 minutes

## O problema

Os governadores de custos (Lessão 13) limitam o que o agente pode gastar. Eles não limitam o que o agente pode fazer dentro do orçamento. Um agente com um limite de velocidade de $ 50 ainda pode exfiltrar um segredo, publicar a publicação errada ou excluir um recurso.

Esta lição abrange os três detectores que se encontram ao lado da camada de custo:

1. **Kill switch**: botão de saída booleano mantido fora do alcance do agente.
2. **Circuit breaker**: detector de padrões de ação que suspende um caminho específico.
3. **Canary token**Um isco que um agente sem razão legítima para tocar se revelará ao tocar.

Os três são engenharia pré-LLM. O engano clássico, os quebra-límites de taxa e os flags de características matam agentes autônomos anteriores. O que é novo é a superfície de ataque: os agentes lêem conteúdo não confiável (Lessão 11), editam sua própria memória e podem compor muitas ações seguras em uma insegura. Os detectores aqui mencionados funcionam porque não confiam no auto-relatório do agente.

## O conceito

### Interruptores de apagão

Um interruptor de execução é um booleano que o agente lê mas não pode escrever.

- **Feature flag in a managed service.**Lançamento: Darkly, Statsig, Release.
- **Redis key the agent polls.**Simples, requer que o processo do agente verifique em cada turno.
- **Signed config in object storage.**O agente verifica uma assinatura no boot; rejeita estados não assinados.
- **OS-level signal or container-lifecycle kill.**Docker .`kill`, Kubernetes `kubectl delete pod`- Não, não.

Propriedades de um interruptor de execução correta:

- O agente não pode configurá-lo .`off`(Vive num sistema onde as credenciais do agente não são escritas.)
- É verificado em todas as ações consequentes, não apenas no início.
- Quando está desligado, o agente não faz nada externamente observável, incluindo o registro de sistemas que o agente pode alcançar.
- A reabilitação é uma ação humana explícita, não um tempo de espera automático.

### Fusões de circuitos

Um interruptor de circuito pausa um padrão específico, não o agente inteiro. Forma clássica (do livro de 2007 Nygard, ainda atual):

- **Closed**A acção é permitida.
- **Open**A acção está bloqueada.
- **Half-open**: após um resfriamento, 13 tentativas de sonda são permitidas (default 1); o sucesso fecha o interruptor, qualquer falha restante reabre-o.

Trigadores relevantes para o agente:

- Cinco chamadas de ferramenta idênticas seguidas (loop repetitivo).
- Cinco falhas consecutivas na mesma ferramenta com entradas diferentes (falha sistêmica).
- A taxa de chamadas da ferramenta acima de um limiar (velocidade do Ensino 13).
- Instrumentos específicos invocados (por exemplo, `file.delete`O artigo 11o da Lei n.o 1 do Tratado CEE é aplicável a todos os Estados-Membros.

### Tokens canários

Os tokens canários (também chamados de honeytokens) são entradas que o agente nunca deve tocar.

Exemplos para agentes:

- Uma falsa .`AWS_SECRET_ACCESS_KEY`As tentativas de exfiltração são instantaneamente atribuíveis.
- Um registro falso de base de dados marcado com um valor sentinela conhecido.
- Um arquivo falso no espaço de trabalho.
- Uma entrada de memória falsa injetada no início da sessão.

O design de Canary é específico para o fluxo de trabalho.

### Por que as camadas estatísticas e limites rígidos

Os detectores estatísticos (EWMA, CUSUM, z-score em taxas de chamadas de ferramentas) se adaptam a uma linha de base em movimento. Essa é uma característica para a deriva legítima e um bug para a deriva adversária. Um atacante paciente pode mudar a linha de base lentamente o suficiente para que nenhum alarme se acenda.

Os limites constitucionais duros (Lessão 17) não se dobram.`secrets@`"como uma regra constitucional é mais simples, auditable e não jogável por deriva lenta.

### Quarentena através de redirecionamento de dados eBPF

A política de rede baseada no eBPF da Cilium pode reescrever a saída de uma cápsula em quarentena para um honeypot forense na camada do núcleo. Os referências públicas do Cilium relatam latência de dados P99 de sub-millisecondas no TCP_RR; o orçamento do relógio de parede para * desencadear* uma quarentena no seu cluster é dominado pela forma como uma atualização de política se propaga do seu plano de controle para o nó (alguns centenas de milisecondas são realistas em Kubernetes com o operador pré-carregado; a latência da cauda depende do tamanho do cluster e da cadência de conciliamento). Isto dá-lhe duas coisas: o agente não exfiltra nada real, e o comportamento do agente dentro do honeypot é totalmente observado. O mesmo padrão, camada diferente, como o token canário: o agente revela a intenção pelo que tenta fazer enquanto contido.

### O que nenhum detector consegue

- **Semantic attacks that compose from allowed primitives.**Cada ação individual passa por todos os detectores; a composição é o problema.
- **Attacks that include the detector as part of the payload.**Se um agente lê uma página que diz "antes de agir, desativar o canário" e o agente tem a capacidade, o detector é comprometido.

```figure
circuit-breaker
```

## Usá-lo

`code/main.py`Simula uma trajetória curta do agente através de três detectores. Um interruptor de morte mantido em um ditado externo; um interruptor de circuito que tropeça em cinco chamadas idênticas de ferramenta; um arquivo canário cuja leitura desencadeia um alerta.

## Envia-o

`outputs/skill-tripwire-design.md`Revisar uma pilha de detectores proposta para a implantação de um agente e detectar falhas (falta de interruptor de execução, falta de canário, limite de interruptor de circuito demasiado solto).

## Exercícios

1. Corra .`code/main.py`- Confirmar o incêndio do interruptor de circuito na curva 7 (quinta chamada idêntica) e o incêndio canário na curva 9 (lectura de chave falsa).

2. Adicione um detector estatístico: EWMA z-score na taxa de chamada de ferramenta. Alimenta uma trajetória que desloca lentamente e mostra que o detector nunca dispara. Agora adicione um limite de duração (não mais de 50 chamadas de ferramenta em 10 minutos) e mostre os incêndios de limite de duração na mesma trajetória.

3. Desenhe um conjunto de tokens de canários para um agente de navegador (Lessão 11).

4. Leia os documentos da política de rede Cilium. Descreva concretamente um fluxo de quarentena de saída-redireção: qual selector de política, qual módulo, qual saída reescreve, qual alerta. O que rege a latência do relógio de parede de "decidir para quarentena" para "primeiro pacote redirecionado"?

5. Defina um procedimento de reabilitação para um agente commutado para matar. Quem pode reabilitação? O que deve ser documentado?

## Termos-chave

| Term | What people say | What it actually means |
|---|---|---|
| Kill switch | "Off button" | Boolean outside the agent's edit surface; checked on every consequential action |
| Circuit breaker | "Pattern pause" | Action-specific trip on repetition, failure rate, or rate-limit |
| Canary token | "Honeytoken" | Bait the agent has no legitimate reason to touch; access fires an alert |
| Honeypot | "Forensic sandbox" | Redirected traffic / workspace where a quarantined agent is observed |
| EWMA | "Moving average" | Exponentially weighted; adapts to drift (feature + bug) |
| CUSUM | "Cumulative sum" | Detects sustained shift from baseline |
| Hard limit | "Constitutional rule" | Does not adapt; constant regardless of history |
| Constitutional limit | "Always-true rule" | Tied to Lesson 17's constitution; cannot be edited by the agent |

## Mais leitura

- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) Enquadramento de interruptores de desvio e de interruptores de circuito para agentes autônomos.
- [Microsoft Agent Framework — HITL and oversight](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) padrões de governação da produção.
- [OWASP LLM / Agentic Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/) Requisitos de detecção e resposta.
- [Cilium — Network policy and eBPF](https://docs.cilium.io/en/stable/security/network/) Redirecionamento de saída de nível de cápsula e padrões forenses de honeypot.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) proibições codificadas como "limites constitucionais".
