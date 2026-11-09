# Modos de falha  MAST, pensamento em grupo, monocultura, erros em cascata

> A taxonomia de referência para 2026 é **MAST**(Cemri et al., NeurIPS 2025, arXiv:2503.13657), derivado de 1642 traços de execução em 7 state-of-the-art open source MAS mostrando **41–86.7% failure rate**. Três categorias raízes: **Specification Problems**(41,77%)  ambiguidade de papel, definições de tarefas pouco claras; **Coordination Failures**(36,94%)  falhas de comunicação, dessincronização de estado; **Verification Gaps**(21,30%)  falta de validação, ausência de verificações de qualidade.**Groupthink**A família (arXiv:2508.05687) acrescenta: colapso da monocultura (o mesmo modelo base → falhas correlacionadas), viés de conformidade (agentes reforçam os erros uns dos outros), teoria de mente deficiente, dinâmica de motivos mistos, falhas de confiabilidade em cascata. Exemplo em cascata: tempestades de retoma em que uma falha de pagamento desencadeia retomas de encomendas, que desencadeiam retomas de inventário, que sobrecarregam o serviço de inventário (10 vezes a carga em segundos  necessitam de interruptores de circuito). Envenenamento da memória: a alucinação de um agente entra na memória compartilhada, agentes a seguir a corrente tratam-na como um fato; a precisão declina gradualmente, tornando doloroso o diagnóstico da causa raiz.**STRATUS**(NeurIPS 2025) relata uma melhoria de 1,5 vezes na mitigação e sucesso através de agentes especializados de detecção / diagnóstico / validação.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 13 (Shared Memory), Phase 16 · 14 (Consensus and BFT), Phase 16 · 15 (Voting and Debate Topology)
**Time:** ~75 minutes

## Problemas

Os sistemas multi-agentes falham 41-86,7% do tempo em tarefas reais (Cemri et al. 2025 mediram isso em 7 MAS de código aberto). Isso não é depurável por "somente adicionar mais agentes". As falhas têm causas estruturais. A taxonomia MAST dá-lhe as categorias. Esta lição mapeia cada categoria para um padrão concreto de detecção, diagnóstico e mitigação para que os números deixem de parecer arbitrários.

A prática de produção 2026 é tratar os modos de falha como entradas de design.

## Conceptos

### Categorias de MÁST

**Specification Problems (41.77% of failures).**A tarefa do agente não foi definida suficientemente estritamente.

- Ambiguidade de papel: dois agentes pensam que são os críticos.
- A tarefa foi subespecificada: "resumir isto" quando o usuário queria um ângulo específico.
- Critérios de sucesso implícitos: o agente não pode dizer se foi bem sucedido.

Mitigações:
- Escreva contratos de funções explícitos. O aviso de cada agente indica o que faz *e o que não faz*.
- Antes de começar, define "feito parece X".
- Verificação das especificações pré-voio: um agente separado revisa a definição da tarefa antes do envio.

**Coordination Failures (36.94%).**Comunicação ou falhas de estado.

Exemplos:
- Dois agentes atualizam o estado compartilhado sem sincronização.
- Mensagem perdida entre agentes (falha da fila, tempo de espera).
- Drift de estado: o agente A acha que a tarefa está concluída; o agente B ainda está executando.

Mitigações:
- Estado compartilhado com simultâneo otimista.
- Reconhecimento explícito de mensagens críticas (reter até aque).
- Pontos de controlo periódicos de sincronização de estado; detecção da deriva precoce.

**Verification Gaps (21.30%).**Não há verificação independente das saídas.

Exemplos:
- Um agente afirma ser bem sucedido, ninguém verifica.
- A cadeia de agentes, cada um, confia na saída do anterior.
- A cobertura de teste que falta no comportamento composto emergente.

Mitigações:
- Agente verificador independente (Lessão 13). Acesso à fonte independente, somente de leitura.
- Contrato de transferência explícito: "A saída de A deve passar o check C antes de B começar".
- Registros de resultados para análise pós-hoc.

### Família de pensamento em grupo (arXiv:2508.05687)

Cinco falhas relacionadas quando os agentes homogeneizam ou imitam uns aos outros:

**Monoculture collapse.**O mesmo modelo base ou dados de treinamento → erros correlacionados. Quando três agentes compartilham um LLM, eles compartilham suas alucinações.

**Conformity bias.**Os agentes se adaptam ao colega mais alto ou mais confiante, mesmo quando estão errados.

**Deficient ToM.**Os agentes não conseguem modela-se mutuamente nas crenças; a coordenação cai em colapso (Lessão 18).

**Mixed-motive dynamics.**Os agentes com incentivos parcialmente alinhados desviam para o meio de compromisso, o que não satisfaz ninguém.

**Cascading reliability failures.**O padrão de erro de um componente desencadeia padrões de erro em componentes dependentes.

### Exemplo em cascata  a tempestade de retomada

Um padrão clássico de incidentes de 2026:

```
payment service fails 10% of requests
   ↓
order agent retries payment (exponential backoff but naive)
   ↓
each retry is a new order-inventory check
   ↓
inventory service sees 2x normal load
   ↓
inventory service starts timing out
   ↓
every order retries inventory check
   ↓
inventory service sees 10x normal load
   ↓
cluster goes down
```

A solução é clássica:**circuit breakers**- Quando a taxa de erro inferior exceder o limiar, curto-circuito com resultados em cache ou por defeito.

Os interruptores de circuito são uma das poucas medidas de mitigação de falhas de vários agentes que emprestamos diretamente a partir de sistemas distribuídos sem modificações.

### Envenenamento da memória (revisto)

A partir da lição 13: a alucinação de um agente torna-se fato de memória compartilhada; agentes a jusante raciocinam sobre o fato envenenado.

A degradação gradual da precisão é o sintoma.

Mitigation: só apenda registro, proveniência, verificador não-escritível. Já abordado na lição 13.

### STRATUS  Agentes especializados para detecção de falhas

O STRATUS (NeurIPS 2025) relata uma melhoria de 1,5 vezes no sucesso da mitigação quando se implementa:

- **Detection agent.**Observação dos padrões de sintomas (alto desacordo, picos de retest, deriva de precisão).
- **Diagnosis agent.**Dados os sintomas, deduz a provavelmente causa raiz da taxonomia MAST.
- **Validation agent.**Após a aplicação de uma mitigação, verifique se os sintomas desaparecem.

Esta é a resposta a incidentes no estilo SRE, aplicada a sistemas de agentes.

### A auditoria de modo de falha

Uma das melhores práticas para 2026 é uma auditoria trimestral (e por lançamento principal) de modo de falha:

1. **Trace sample.**Coletar 1000 traços reais de execução.
2. **Categorize.**Para cada falha de rastreamento, mapear para categorias MAST + Groupthink.
3. **Compute failure-by-category rate.**Que categorias dominam o seu sistema?
4. **Rank mitigations.**Qual solução eliminaria a maioria dos falhas?
5. **Pick 2-3 mitigations.**Implementação; re-auditoria no próximo trimestre.

A disciplina é mais importante do que as escolhas específicas.

### Quando os sistemas falham silenciosamente

A categoria de falhas mais perigosa é falha de corretão silenciosa. Um sistema que falha em voz alta (crash, exceção, alerta) pode ser monitorado. Um sistema que produz saídas plausíveis mas erradas não pode ser detectado por registros de exceção. É por isso que as lacunas de verificação são a categoria mais cara por falha, embora sejam apenas 21,30% em contagem.

Investi em:
- Revisão humana baseada em amostras.
- Testes de regressão do conjunto de dados dourados.
- Verificação de resultados importantes.

### Falha versus falha lenta

Algumas falhas são imediatas; outras são lentas. falhas imediatas (out of time, desajuste de esquema, erro de autor) são baratas de detectar. falhas lentas (intoxicação da memória, deriva de monocultura, ambiguidade de papel) são caras de detectar e prevenir.

A mudança de engenharia de 2026: proxies de falha lenta do instrumento para que você possa capturar a deriva antes que se torne um erro visível.

```figure
a5-retry-cascade
```

## Construí-lo

`code/main.py`Implementos:

- `FailureTaxonomy` categoriza os incidentes simulados em categorias MAST + Groupthink.
- `CircuitBreaker` padrão clássico; abre quando a taxa de erro excede o limiar.
- `RetryStormSimulator` mostra a falha de cascata; liga/ desliga o interruptor de circuito.
- `DetectionAgent`- Simptoma de STRATUS.

- Correr .

```
python3 code/main.py
npx tsx code/main.ts
```

Produção esperada:
- Tormenta de retest sem interruptor de circuito: erros de inventário explodem (simulados).
- com interruptor de circuito: tampa no limiar; respostas em modo degradado servidas.
- O agente de detecção marca o padrão e nomeia a categoria MAST.

## Usá-lo

`outputs/skill-mast-auditor.md`Executa uma auditoria de modo de falha de estilo MAST em um sistema multi-agente.

## Envia-o

Disciplina de modo de falha na produção:

- **MAST audit per quarter.**Não é anual, as categorias mudam à medida que o sistema cresce.
- **Circuit breakers everywhere.**Cada chamada de saída para qualquer serviço dependente.
- **Golden datasets.**Pequenas, de alta qualidade, verificadas à mão, testes de regressão contra elas semanalmente.
- **STRATUS trio.**Detecção + Diagnóstico + Agentes de validação monitorando a produção. Comece com apenas o agente de detecção; adicione o diagnóstico quando os sintomas são barulhentos.
- **Failure budget.**Explicita a taxa de falhas por categoria.

## Exercícios

1. Corra .`code/main.py`Confirme que o interruptor de circuito bloqueia a tempestade, varia o limiar de falha e observa a compensação.
2. Implementar um **slow-failure proxy**A taxa de concordância entre três agentes paralelos. Quando cair drasticamente, activa um alerta. Simula uma deriva de monocultura, correlação gradual das saídas dos agentes.
3. Leia Cemri et al. (arXiv:2503.13657). Escolha um dos seus 7 sistemas MAS e mapeie as suas três principais categorias de falhas.
4. Leia o artigo "Grupo de reflexão" (arXiv:2508.05687). Identifique qual dos cinco padrões é mais difícil de detectar na produção.
5. Desenhe um trio de detecção-diagnóstico-validação de estilo STRATUS para um sistema específico de vários agentes que você conhece. Que sintomas a detecção observa? Que mitigações o diagnóstico recomenda? Como a validação confirma que funcionam?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MAST | "The 2026 taxonomy" | Cemri 2025; 3 root categories + 14 sub-types of failures. |
| Specification Problem | "Role ambiguity" | Task or role under-defined; agents do not know what to do. |
| Coordination Failure | "State drift" | Communication or sync breakdown between agents. |
| Verification Gap | "No one checked" | Outputs accepted without independent validation. |
| Groupthink family | "Homogeneity failures" | Monoculture, conformity, deficient ToM, mixed-motive, cascading. |
| Monoculture collapse | "Same model, same hallucinations" | Correlated errors from shared base model or training data. |
| Retry storm | "Cascading error amplification" | One failure triggers retries which amplify load downstream. |
| Circuit breaker | "Fail fast on error rate" | Open when error rate exceeds threshold; short-circuit with default. |
| STRATUS | "Incident response trio" | Detection + diagnosis + validation agents. 1.5x mitigation success. |
| Memory poisoning | "Hallucinations propagate" | Shared-memory fact tainted; downstream agents reason on poison. |

## Mais leitura

- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) Taxonomia MAST, NeurIPS 2025
- [Groupthink failures in multi-agent LLMs](https://arxiv.org/abs/2508.05687) monocultura, conformidade e taxonomia de cinco famílias
- [STRATUS — specialized agents for MAS incident response](https://neurips.cc/) Inscrição no processo NeurIPS 2025 (detecção + diagnóstico + validação)
- [Release It! — stability patterns (Nygard)](https://pragprog.com/titles/mnee2/release-it-second-edition/) a referência canónica do interruptor de circuito
- [Anthropic — Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) Notas de falha de produção
