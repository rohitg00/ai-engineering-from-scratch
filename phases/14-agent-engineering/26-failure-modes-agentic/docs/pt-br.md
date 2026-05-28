# Modos de Falha: Por Que Agentes Quebram

> MASFT (Berkeley, 2025) cataloga 14 modos de falha multi-agente em 3 categorias. A Taxonomia da Microsoft documenta como falhas de IA existentes se amplificam em contextos agênticos. Dados de campo da indústria convergem em cinco modos recorrentes: ações alucinadas, scope creep, erros em cascata, perda de contexto, uso indevido de tools.

**Tipo:** Aprender + Construir
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 14 · 05 (Self-Refine e CRITIC), Fase 14 · 24 (Observabilidade)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Nomear as três categorias de falha do MASFT e pelo menos quatro modos específicos em cada uma.
- Explicar por que falhas agênticas amplificam modos de falha de IA existentes (viés, alucinação).
- Descrever os cinco modos recorrentes da indústria e suas mitigações.
- Implementar um detector em stdlib que etiqueta traces de agentes com labels de modo de falha.

## O Problema

Times lançam agentes que funcionam em 90% dos traces. Os 10% de falha não são ruído aleatório — caem em um pequeno número de categorias recorrentes. Uma vez que você consegue nomeá-las, consegue monitorar e corrigir.

## O Conceito

### MASFT (Berkeley, arXiv:2503.13657)

Taxonomia de Falha de Sistemas Multi-Agente. 14 modos de falha agrupados em 3 categorias. Cohen's Kappa inter-anotador 0.88 — as categorias são distinguíveis de forma confiável.

Afirmação central: falhas são defeitos de design fundamentais em sistemas multi-agente, não limitações de LLM a serem corrigidas com melhores modelos base.

### Taxonomia de Modos de Falha em Sistemas de IA Agêntica da Microsoft

- Falhas de IA existentes (viés, alucinação, vazamento de dados) se amplificam em contextos agênticos.
- Novas falhas surgem da autonomia: ação não intencional em escala, uso indevido de tools, deriva de missão.
- O whitepaper é o risk register pra produtos agênticos.

### Characterizing Faults in Agentic AI (arXiv:2603.06847)

- Falhas surgem de orquestração, evolução de estado interno e interação com o ambiente.
- Não é só "código ruim" ou "saída ruim de modelo".

### LLM Agent Hallucinations Survey (arXiv:2509.18970)

Duas manifestações principais:

1. **Desvio no Seguimento de Instrução** — agente não segue o system prompt.
2. **Uso Incorreto de Contexto de Longo Alcance** — agente esquece ou aplica mal contexto de turns anteriores.

Erros sub-intenção: Omissão (passo perdido), Redundância (passo repetido), Desordem (passos fora de ordem).

### Os cinco modos recorrentes da indústria

Análises de campo da Arize, Galileo, NimbleBrain 2024-2026 convergem em:

1. **Ações alucinadas.** Agente invoca uma tool que não existe ou fabrica argumentos.
2. **Scope creep.** Agente expande a tarefa além do pedido pelo usuário (cria PRs extras, envia emails extras).
3. **Erros em cascata.** Uma chamada errada dispara efeitos downstream. Uma alucinação de SKU fantasma dispara quatro chamadas de API — um incidente multi-sistema.
4. **Perda de contexto.** Tarefas de longo horizonte esquecem restrições de turns anteriores.
5. **Uso indevido de tools.** Chama a tool certa com argumentos errados, ou a tool errada completamente.

Cascata é o matador. Agentes não conseguem distinguir "eu falhei" da "tarefa é impossível" e frequentemente alucinam uma mensagem de sucesso em erros 400 pra fechar o loop.

### Mitigação: gates em cada passo

Gates de verificação automatizados em cada passo de uma cadeia de raciocínio, checando grounding factual contra estado do ambiente. Concretamente:

- Classificador de segurança por passo (Aula 21).
- Validação de argumentos em chamadas de tool (Aula 06).
- Cross-check de conteúdo recuperado contra fatos conhecidos (Aula 05, CRITIC).
- Detecção de alucinação de sucesso re-proando estado (o arquivo foi realmente criado?).

### Onde monitoramento de falhas dá errado

- **Etiquetar só crashes.** A maioria das falhas de agente produz output com aparência válida. Precisa de checagens no nível de conteúdo.
- **Sem baseline.** Detecção de drift precisa de um last-known-good; sem ele você não diz "isso tá piorando".
- **Over-alerting.** Cada falha gera um page. Agrupe e faça rate-limit.

## Construa

`code/main.py` implementa um tagger de modos de falha em stdlib:

- Um conjunto de dados de trace sintético cobrindo os cinco modos.
- Funções detectoras por modo (padrões de assinatura em chamadas de tool, outputs, ações repetidas).
- Um tagger que etiqueta cada trace e reporta a distribuição de modos.

Execute:

```
python3 code/main.py
```

Saída: labels por trace + distribuição agregada, uma reprodução barata do que o clustering de traces do Phoenix superficia.

## Use

- **Phoenix** pra clustering de drift em produção (Aula 24).
- **Langfuse** pra replay de sessão + anotação.
- **Custom** pra assinaturas específicas de domínio que sua plataforma de observabilidade não detecta.

## Entregue

`outputs/skill-failure-detector.md` gera detectores de modos de falha sob medida pro seu domínio, conectados a um store de traces.

## Exercícios

1. Adicione um detector pra "alucinação de sucesso": agente retorna sucesso mas o estado alvo não mudou.
2. Etiquete 100 traces reais de um produto que você construiu. Qual modo domina? Qual o custo de corrigi-lo?
3. Implemente uma métrica de "raio de cascata": dada uma falha no passo N, quantos passos downstream ela afetou?
4. Leia os 14 modos de falha do MASFT. Escolha três que se aplicam ao seu produto. Escreva detectores.
5. Conecte um detector num job de CI: falhe o build se >=5% dos traces etiquetarem um modo.

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| MASFT | "Taxonomia de falha multi-agente" | Categorização de 14 modos da Berkeley |
| Erro em cascata | "Falha em efeito dominó" | Um erro inicial se propaga por N passos |
| Perda de contexto | "Esqueceu a restrição" | Turn de longo horizonte perde fatos de turns anteriores |
| Uso indevido de tool | "Tool errada / args errados" | Chamada válida, invocação errada |
| Alucinação de sucesso | "Conclusão falsa" | Agente declara sucesso num 400; estado inalterado |
| Scope creep | "Excesso" | Agente faz mais do que pedido |
| Desvio no seguimento de instrução | "Desobediência" | Ignora system prompt ou restrição do usuário |
| Erros sub-intenção | "Bugs de plano" | Omissão, redundância, desordem na execução do plano |

## Leitura Complementar

- [Cemri et al., MASFT (arXiv:2503.13657)](https://arxiv.org/abs/2503.13657) — 14 modos de falha, 3 categorias
- [Microsoft, Taxonomy of Failure Mode in Agentic AI Systems](https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/microsoft/final/en-us/microsoft-brand/documents/Taxonomy-of-Failure-Mode-in-Agentic-AI-Systems-Whitepaper.pdf) — risk register
- [Arize Phoenix](https://docs.arize.com/phoenix) — clustering de drift na prática
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — quando padrões mais simples evitam modos completamente
