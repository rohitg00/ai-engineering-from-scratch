# Modos de Falha — MAST, Groupthink, Monocultura, Erros Cascateantes

> A taxonomia de referência pra 2026 é **MAST** (Cemri et al., NeurIPS 2025, arXiv:2503.13657), derivada de 1642 traces de execução em 7 MAS open-source state-of-the-art mostrando **taxa de falha de 41–86.7%**. Três categorias raiz: **Problemas de Eespecificaçãoificação** (41.77%) — ambiguidade de papel, definições de tarefa incertas; **Falhas de Coordenação** (36.94%) — falhas de comunicação, dessincronia de estado; **Lacunas de Verificação** (21.30%) — validação faltando, verificações de qualidade ausentes. A família **Groupthink** (arXiv:2508.05687) adiciona: colapso de monocultura (mesmo modelo base → falhas correlacionadas), viés de conformidade (agents reforçam erros uns dos outros), teoria da mente deficiente, dinâmicas de motive misto, falhas de confiabilidade cascateantes. Exemplo cascateante: tempestades de retry onde uma falha de pagamento dispara retries de pedido, que disparam retries de estoque, que sobrecarregam o serviço de estoque (carga de 10x em segundos — precisa de circuit breakers). Envenenamento de memória: uma alucinação de um agente entra na memória compartilhada, downstream agentes tratam como fato; acurácia degrada gradualmente, tornando diagnóstico de causa raiz doloroso. **STRATUS** (NeurIPS 2025) reporta melhoria de 1.5x na taxa de sucesso de mitigação via agentes eespecificaçãoializados de detecção / diagnóstico / validação. Esta aula trata modos de falha como alvos de engenharia de primeira classe.

**Tipo:** Aprender
**Idiomas:** Python (stdlib)
**Pré-requisitos:** Fase 16 · 13 (Memória Compartilhada), Fase 16 · 14 (Consenso e BFT), Fase 16 · 15 (Topologia de Votação e Debate)
**Tempo:** ~75 minutos

## Problema

Sistemas multi-agente falham 41-86.7% do tempo em tarefas reais (Cemri et al. 2025 mediu isso em 7 MAS open-source). Isso não é debugável com "só adicione mais agents". As falhas têm causas estruturais. A taxonomia MAST dá as categorias. Esta aula mapeia cada categoria pra um padrão concreto de detecção, diagnóstico e mitigação pra que os números parem de parecer arbitrários.

A prática de produção em 2026 é tratar modos de falha como inputs de design. Sua arquitetura não é "boa o suficiente" até você apontar pra cada categoria MAST e nomear a mitigação que você implementou.

## Conceito

### Categorias MAST

**Problemas de Eespecificaçãoificação (41.77% das falhas).** A tarefa do agente não foi definida estritamente o suficiente. Exemplos:

- Ambiguidade de papel: dois agentes acham que são o revisor.
- Tarefa subeespecificaçãoificada: "resuma isso" quando o usuário queria um ângulo eespecificaçãoífico.
- Critérios de sucesso implícitos: o agente não consegue dizer se teve sucesso.

Mitigações:
- Escreva contratos de papel explícitos. O prompt de cada agente diz o que ele faz *e o que não faz*.
- Testes de aceitação por tarefa. Antes do agente começar, defina "feito parece X".
- Verificação pré-despacho: um agente separado revisa a definição da tarefa antes de despachar.

**Falhas de Coordenação (36.94%).** Falhas de comunicação ou estado.

Exemplos:
- Dois agentes atualizam estado compartilhado sem sincronização.
- Mensagem perdida entre agentes (falha de fila, timeout).
- Deriva de estado: agente A acha que a tarefa está feita; agente B ainda está executando.

Mitigações:
- Estado compartilhado versionado com concorrência otimista.
- Confirmação explícita pra mensagens críticas (retry até acked).
- Checkpoints periódicos de sincronização de estado; detecte deriva cedo.

**Lacunas de Verificação (21.30%).** Sem verificação independente nas saídas.

Exemplos:
- Um agente declara sucesso; ninguém verifica.
- Cadeia de agentes em que cada um confia na saída do anterior.
- Cobertura de teste faltando no comportamento composto emergente.

Mitigações:
- Agent verificador independente (Aula 13). Somente leitura, acesso independente a fontes.
- Contrato de handoff explícito: "saída de A deve passar no verificador C antes de B começar."
- Logging de resultado pra análise posterior.

### Família Groupthink (arXiv:2508.05687)

Cinco falhas relacionadas quando agentes homogeneizam ou imitam uns aos outros:

**Colapso de monocultura.** Mesmo modelo base ou dados de treino → erros correlacionados. Quando três agentes compartilham um LLM, compartilham suas alucinações.

**Viés de conformidade.** Agents ajustam em direção ao peer mais alto ou mais confiante, mesmo quando errado.

**Teoria da mente deficiente.** Agents falham em modelar crenças uns dos outros; coordenação desmorona (Aula 18).

**Dinâmicas de motive misto.** Agents com incentivos parcialmente alinhados deriva pra um meio-termo que satisfaz ninguém.

**Falhas de confiabilidade cascateantes.** Padrão de erro de um componente dispara padrões de erro em componentes dependentes.

### Exemplo cascateante — a tempestade de retry

Um padrão clássico de incidente em 2026:

```
serviço de pagamento falha em 10% das requisições
   ↓
agent de pedido tenta pagamento de novo (backoff exponencial mas ingênuo)
   ↓
cada retry é uma nova verificação de pedido-estoque
   ↓
serviço de estoque vê 2x a carga normal
   ↓
serviço de estoque começa a dar timeout
   ↓
toda pedido tenta retry de verificação de estoque
   ↓
serviço de estoque vê 10x a carga normal
   ↓
cluster cai
```

A correção é clássica: **circuit breakers**. Quando a taxa de erro downstream excede o limiar, curto-circuite com resultados cacheados ou padrão. Mais budgets de retry com limite por requisição.

Circuit breakers são uma das poucas mitigações de falha multi-agente que você pega diretamente de sistemas distribuídos sem modificação.

### Envenenamento de memória (revisitado)

Da Aula 13: alucinação de um agente vira fato de memória compartilhada; downstream agentes raciocinam sobre o fato envenenado. Em termos MAST, isso é uma lacuna de verificação na camada de memória compartilhada.

Degradamento gradual de acurácia é o sintoma. Você não leva um crash; leva uma deriva lenta difícil de rastrear até a causa raiz.

Mitigação: log append-only, proveniência, verificador não-escritável. Já coberto na Aula 13.

### STRATUS — agentes eespecificaçãoializados pra detecção de falhas

STRATUS (NeurIPS 2025) reporta melhoria de 1.5x na taxa de sucesso de mitigação quando você implementa:

- **Agent de detecção.** Monitora padrões de sintomas (alta discordância, spikes de retry, deriva de acurácia).
- **Agent de diagnóstico.** Dados os sintomas, infere causa raiz provável da taxonomia MAST.
- **Agent de validação.** Após aplicar uma mitigação, verifica que os sintomas desapareceram.

Isso é resposta a incidente no estilo SRE, aplicada a sistemas de agent. Os três papéis podem ser todos LLM agentes com prompts eespecificaçãoializados.

### A auditoria de modos de falha

Uma melhor prática de 2026 é uma auditoria anual (ou por release maior) de modos de falha:

1. **Amostra de traces.** Colete ~1000 traces reais de execução.
2. **Categorize.** Pra cada falha do trace, mapeie pra categorias MAST + Groupthink.
3. **Compute taxa de falha por categoria.** Quais categorias dominam seu sistema?
4. **Ranqueie mitigações.** Qual correção eliminaria mais falhas?
5. **Escolha 2-3 mitigações.** Implemente; re-audite no próximo trimestre.

A disciplina é mais importante que as escolhas eespecificaçãoíficas. Sem auditorias, falhas se misturam ao ruído e nunca são sistematicamente endereçadas.

### Quando sistemas falham silenciosamente

A categoria de falha mais perigosa é falha de correção silenciosa. Um sistema que falha alto (crash, exceção, alerta) pode ser monitorado. Um sistema que produz saídas plausíveis-mas-erradas não pode ser detectado por logs de exceção. Por isso lacunas de verificação são a categoria mais cara por falha mesmo sendo só 21.30% em contagem.

Invista em:
- Revisão humana baseada em amostragem.
- Testes de regressão com golden datasets.
- Verificação cruzada entre agentes pra saídas importantes.

### Falha vs falha lenta

Algumas falhas são imediatas; outras são lentas. Falhas imediatas (timeout, incompatibilidade de schema, erro de auth) são baratas de detectar. Falhas lentas (envenenamento de memória, deriva de monocultura, ambiguidade de papel) são caras de detectar e prevenir.

A movimentação de engenharia em 2026: instrumente proxies de falha lenta pra pegar deriva antes que se torne um erro visível. Taxa de concordância, taxa de retry, distribuição de tamanho de saída e distância de edição entre versões consecutivas de agente são todos proxies úteis.

## Construir

`code/main.py` implementa:

- `FailureTaxonomy` — categoriza incidentes simulados em categorias MAST + Groupthink.
- `CircuitBreaker` — padrão clássico; abre quando taxa de erro excede limiar.
- `RetryStormSimulator` — mostra a falha cascateante; alterna circuit breaker ligado / desligado.
- `DetectionAgent` — matcher de sintomas estilo STRATUS scriptado.

Execute:

```
python3 code/main.py
```

Saída esperada:
- tempestade de retry sem circuit breaker: erros de estoque explodem (simulado).
- com circuit breaker: limite no limiar; respostas em modo degradado servidas.
- agente de detecção sinaliza o padrão e nomeia a categoria MAST.

## Usar

`outputs/skill-mast-auditor.md` roda uma auditoria de modos de falha estilo MAST em um sistema multi-agente. Traces → categorização → ranqueamento de mitigações.

## Em produção

Disciplina de modos de falha em produção:

- **Auditoria MAST por trimestre.** Não anual. Categorias mudam conforme seu sistema cresce.
- **Circuit breakers em todo lugar.** Cada chamada outbound pra qualquer serviço dependente. Limiar default aberto a 5-10% de taxa de erro.
- **Golden datasets.** Pequenos, de alta qualidade, auditados manualmente. Teste regressão contra eles semanalmente.
- **Trio STRATUS.** Agents de Detecção + Diagnóstico + Validação monitorando produção. Comece só com o agente de detecção; adicione diagnóstico quando os sintomas ficarem ruidosos.
- **Budget de falha.** SLO explícito pra taxa de falha por categoria. Exceder o budget dispara uma conversa de stop-shipping.

## Exercícios

1. Execute `code/main.py`. Confirme que o circuit breaker limita a tempestade de retry. Varie o limiar de falha e observe o trade-off.
2. Implemente um **proxy de falha lenta**: taxa de concordância entre 3 agentes paralelos. Quando cair bruscamente, dispare um alerta. Simule uma deriva de monocultura correlacionando gradualmente as saídas dos agents.
3. Leia Cemri et al. (arXiv:2503.13657). Escolha um dos 7 sistemas MAS deles e mapeie suas top 3 categorias de falha. Como se comparam com o que o MAST prevê?
4. Leia o artigo Groupthink (arXiv:2508.05687). Identifique qual dos cinco padrões é mais difícil de detectar em produção. Proponha uma métrica proxy.
5. Projete um trio detecção-diagnóstico-validação estilo STRATUS pra um sistema multi-agente eespecificaçãoífico que você conheça. Quais sintomas o agente de detecção monitora? Quais mitigações o diagnóstico recomenda? Como a validação confirma que funcionam?

## Termos-chave

| Termo | O que dizem | O que realmente significa |
|------|----------------|------------------------|
| MAST | "A taxonomia de 2026" | Cemri 2025; 3 categorias raiz + 14 subtipos de falhas. |
| Problema de Eespecificaçãoificação | "Ambiguidade de papel" | Tarefa ou papel sub-definido; agentes não sabem o que fazer. |
| Falha de Coordenação | "Deriva de estado" | Falha de comunicação ou sincronização entre agents. |
| Lacuna de Verificação | "Ninguém verificou" | Saídas aceitas sem validação independente. |
| Família Groupthink | "Falhas de homogeneidade" | Monocultura, conformidade, teoria da mente deficiente, motive misto, cascateante. |
| Colapso de monocultura | "Mesmo modelo, mesmas alucinações" | Erros correlacionados de modelo base ou dados de treino compartilhados. |
| Tempestade de retry | "Amplificação cascateante de erro" | Uma falha dispara retries que amplificam carga downstream. |
| Circuit breaker | "Falhe rápido na taxa de erro" | Abre quando taxa de erro excede limiar; curto-circuito com padrão. |
| STRATUS | "Trio de resposta a incidente" | Agents de detecção + diagnóstico + validação. 1.5x sucesso de mitigação. |
| Envenenamento de memória | "Alucinações se propagam" | Fato de memória compartilhada contaminado; agentes downstream raciocinam sobre veneno. |

## Leitura Adicional

- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) — taxonomia MAST, NeurIPS 2025
- [Groupthink failures in multi-agent LLMs](https://arxiv.org/abs/2508.05687) — monocultura, conformidade e a taxonomia de cinco famílias
- [STRATUS — agentes eespecificaçãoializados pra resposta a incidentes em MAS](https://neurips.cc/) — proceedings NeurIPS 2025 (detecção + diagnóstico + validação)
- [Release It! — padrões de estabilidade (Nygard)](https://pragprog.com/titles/mnee2/release-it-second-edition/) — referência canônica de circuit breaker
- [Anthropic — Sistema de pesquisa multi-agente](https://www.anthropic.com/engineering/multi-agent-research-system) — notas de modos de falha em produção
