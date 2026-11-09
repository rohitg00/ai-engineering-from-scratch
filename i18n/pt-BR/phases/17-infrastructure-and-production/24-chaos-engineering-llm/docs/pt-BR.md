# Chaos Engineering para a Produção de LLM

> A engenharia do caos para LLM é sua própria disciplina em 2026. Preerequisito antes de executar experimentos em produção: SLI/SLO definido, observabilidade de rastreamento+metrico+log, retrocesso automatizado, runbooks, em chamada. A arquitetura tem quatro planos: controle (programador de experimentos), alvo (serviços, infra, armazéns de dados), segurança (guardas + abortos + filtros de tráfego), observabilidade (metricas + vestígios + registros), feedback (em ajustes SLO). Os guardrails são obrigatórios: alertas de taxa de queimação interrompem os experimentos se se espera que a queima diária de erro-orçamento > 2x; janelas de supressão + correlação de rastreamento-ID dedupção de ruído de alerta. Cadência: revisão semanal de pequenas canárias + SLO; dia de jogo mensal + pós-mortem; auditoria trimestral de resiliência entre equipes + mapeamento de dependência. Experimentos específicos do LLM: sobrecarga de memória, falhas de rede, interrupções de fornecedores, instruções malformadas, tempestades de despejo de cache KV. Ferramentas: Engenharia de Caos de Aproveitamento (recomendações derivadas do LLM, redução do raio de explosão, integração de ferramentas MCP); LitmusChaos (CNCF); Chaos Mesh (nativa do Kubernetes do CNCF).

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy chaos experiment runner)
**Prerequisites:** Phase 17 · 23 (SRE for AI), Phase 17 · 13 (Observability)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Cite os cinco requisitos prévios de engenharia do caos (SLI/SLO, observabilidade, retrocesso, runbooks, on-call) e explique por que saltar qualquer um rompe a prática.
- Diagrama os quatro planos (controle, alvo, segurança, observabilidade) e o ciclo de feedback em SLO.
- Cite cinco experimentos específicos do LLM (supercarga de memória, falha da rede, interrupção do fornecedor, aviso mal formado, tempestade de despejo de KV).
- Escolha uma ferramenta  Arnes, LitmusChaos, Chaos Mesh  dado pilha.

## O problema

O teste de caos nas pilhas tradicionais é estabelecido. As pilhas LLM adicionam novos modos de falha. Um prompt de token 4K com um caracter venenoso impede o tokenizer por 12 segundos. Um provedor upstream 429s; sua gateway retries; seus OOMs de serviço em simultâneo amplificado retry. Uma tempestade de despejo de cache KV sob carga de explosão causa cascas de preenchimento que saturam a computação.

A engenharia do caos é a forma de descobri-las antes que os usuários o façam.

## O conceito

### Pre-requisitos

Não faça caos na produção sem:

1. **SLI/SLO** definidos indicadores e objectivos de nível de serviço.
2. **Observability**Traços, métricas, registos, ligados a painéis de controlo.
3. **Automated rollback** Fase 17 · 20 Rolo de volta à política de bandeira.
4. **Runbooks** estruturada, fase 17 · 23.
5. **On-call**- Alguém para responder.

Faltando qualquer meio, o caos torna-se um incidente real.

### Quatro aviões + feedback

**Control plane** programação de experiências (fluxo de trabalho de Litmus, programação Chaos Mesh, UI Harness).

**Target plane**Serviços, cápsulas, nós, balançadores de carga, armazéns de dados.

**Safety plane**- interruptor de eliminação, janelas de supressão, limites de raio de explosão, portões de orçamento de erro.

**Observability plane** métricas normais + correlação de rastreamento de identificação para distinguir os erros induzidos pelo caos e os erros naturais.

**Feedback loop** Os resultados são repassados para o ajuste do SLO, atualizações do cadastro de execução, correções de código.

### Os corredores são obrigatórios

- **Burn-rate alert**A redução da taxa de erro de orçamento diário é de 2x a esperada.
- **Suppression windows**: silenciar as alertas não experimentais no raio da explosão durante o experimento.
- **Trace-ID correlation**Todos os erros induzidos pela experiência têm uma etiqueta para que a chamada possa deduzir.

### Cinco experiências específicas de LLM

1. **Memory overload** forçar uma tempestade de prevenção do cache KV enviando solicitações de longo contexto com alta concurência. Observe: o serviço desce graciosamente ou falha?

2. **Network failure** cortar a conectividade entre o gateway de inferência e o provedor.

3. **Provider outage simulation** 100% 429 da OpenAI. Observação: faz o roteamento falhar para Anthropic? (fase 17 · 16, 19)

4. **Malformed prompt** injectar carga útil de instalação de tokenizer (por exemplo, unicode profundamente aninhado, um enorme código UTF-8). Observe: um único pedido bloqueia um trabalhador?

5. **KV eviction storm**Observe: a LMCache recupera ou o serviço deteriora?

### Cadência

- **Weekly**- Pequenas experiências de canários em fase, talvez 5% de prod.
- **Monthly** dia de jogo programado num cenário específico; participação de equipas cruzadas; pós-mortem.
- **Quarterly** Auditoria de resiliência entre equipes; atualização do mapa de dependência.

### Ferramentas

- **Harness Chaos Engineering** comercial; recomendações de experiências derivadas da IA; redução da escala do raio de explosão; integração de ferramentas MCP.
- **LitmusChaos** Graduado no CNCF; Kubernetes baseado no fluxo de trabalho.
- **Chaos Mesh** caixa de areia CNCF; estilo CRD nativo Kubernetes.
- **Gremlin** comercial; amplo apoio.
- **AWS FIS**- Não .**Azure Chaos Studio** Ofertas em nuvem gerenciadas.

### Começando pequeno

Primeiro experimento: matem uma réplica de decodificação sob tráfego constante, observem o redirecionamento e a recuperação, se isto funcionar e parecer seguro, passam para o caos da rede.

Primeiro experimento específico do LLM: injetar um fornecedor 429 por 5 minutos. Observe o retorno. A maioria das equipes descobre que o retorno não foi totalmente testado.

### Números que você deve lembrar

- Quatro aviões: controlo, alvo, segurança, observabilidade.
- Pausa de taxa de queima: 2x a queima de orçamento diário esperada.
- Cadência: canário semanal, dia de jogo mensal, auditoria trimestral.
- Cinco experiências de LLM: memória, rede, provedor, prompt malformado, KV tempestade.

```figure
i4-chaos-guard
```

## Usá-lo

`code/main.py`Simula três experimentos de caos com portões de segurança, relatos de quais experimentos poderiam tropeçar o aborto de queimadura.

## Envia-o

Esta lição produz`outputs/skill-chaos-plan.md`- Dada a pilha e a maturidade, escolhe os três primeiros experimentos e as ferramentas.

## Exercícios

1. Corra .`code/main.py`Qual experimento desacelera o portão de velocidade e porquê?
2. Desenhar as cinco primeiras experiências de caos para um serviço RAG baseado em vLLM. Incluir critérios de sucesso.
3. O seu alerta de taxa de queimação parou um experimento.
4. Discutir se o caos deve correr na produção ou apenas em cena.
5. Cite três modos de falha específicos do MLC que o caos genérico da rede não pode reproduzir.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| SLI / SLO | "service targets" | Indicator + objective; required prerequisite |
| Blast radius | "scope" | Set of services / users affected by experiment |
| Burn-rate alert | "budget gate" | Fires when error-budget burn rate > 2x expected |
| Game day | "monthly drill" | Scheduled cross-team chaos exercise |
| LitmusChaos | "CNCF workflow" | Graduated CNCF Kubernetes chaos tool |
| Chaos Mesh | "CNCF CRD" | CNCF sandbox Kubernetes-native chaos |
| Harness CE | "commercial AI-assisted" | Harness chaos with AI recommendations |
| Malformed prompt | "tokenizer bomb" | Input that stalls tokenization |
| KV eviction storm | "preemption cascade" | Mass eviction triggering re-prefills |

## Mais leitura

- [DevSecOps School — Chaos Engineering 2026 Guide](https://devsecopsschool.com/blog/chaos-engineering/)
- [Ankush Sharma — Observability for Large Language Models (Apress, 2026)](https://link.springer.com/book/10.1007/979-8-8688-2827-0)
- [LitmusChaos (CNCF)](https://litmuschaos.io/)
- [Chaos Mesh (CNCF)](https://chaos-mesh.org/)
- [Harness Chaos Engineering](https://www.harness.io/products/chaos-engineering)
- [AWS FIS](https://aws.amazon.com/fis/)
