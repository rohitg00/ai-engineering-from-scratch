# Modos de falha: Por que os agentes rompem

> MASFT (Berkeley, 2025) cataloga 14 modos de falha multi-agente em 3 categorias. Taxonomy da Microsoft documenta como falhas existentes de IA se amplificam em configurações agenciais. Dados de campo da indústria convergem em cinco modos recorrentes: ações alucinadas, deslocamento de escopo, erros de cascata, perda de contexto, uso indevido de ferramentas.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 05 (Self-Refine and CRITIC), Phase 14 · 24 (Observability)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Nomear as três categorias de falhas do MASFT e pelo menos quatro modos específicos em cada uma delas.
- Explique por que a falha agencial amplifica os modos de falha da IA existentes (bias, alucinações).
- Descreva os cinco modos recorrentes na indústria e as suas mitigações.
- Implementar um detector stdlib que marca agentes rastreados com rótulos de modo de falha.

## O problema

As equipes enviam agentes que trabalham em 90% das pistas. Os 10% de falhas não são ruído aleatório  eles caem em um pequeno número de categorias recorrentes. Uma vez que você pode nomeá-los, você pode monitorá-los e corrigir-los.

## O conceito

### MASFT (Berkeley, arXiv:2503.13657)

Taxonomia de falhas de sistemas de vários agentes. 14 modos de falha agrupados em 3 categorias.

A alegação central: as falhas são falhas fundamentais de design em sistemas multi-agentes, não limitações de LLM a serem corrigidas com melhores modelos base.

### Taxonomia da Microsoft do Modo de Falha em Sistemas de IA Agênticos

- Falhas existentes da IA (bias, alucinações, vazamento de dados) ampliam-se em configurações agentes.
- Novos fracassos surgem da autonomia: ação involuntária em escala, o uso indevido de ferramentas, a deriva da missão.
- O whitepaper é o registo de riscos dos produtos agentes.

### Caracterizando falhas na IA Agêntica (arXiv:2603.06847)

- Os fracasso surgem da orquestração, evolução do estado interno e interação ambiental.
- Não é só "mau código" ou "mau modelo de saída".

### Estudo de Alucinações de Agentes da LLM (arXiv:2509.18970)

Duas manifestações primárias:

1. **Instruction-following Deviation**O agente não segue o aviso do sistema.
2. **Long-range Contextual Misuse** O agente esquece ou aplica mal o contexto das curvas anteriores.

Erros de subintenção: omissão (passo perdido), redundancia (passo repetido), desordem (passo fora de ordem).

### Os cinco modos recorrentes do setor

As análises de campo de Arize, Galileo, NimbleBrain 2024-2026 convergem em:

1. **Hallucinated actions.**O agente invoca uma ferramenta que não existe ou fabrica argumentos.
2. **Scope creep.**O agente expande a tarefa além do pedido do usuário (cria relações públicas adicionais, envia e-mails adicionais).
3. **Cascading errors.**Uma chamada errada desencadeia efeitos a jusante. Uma alucinação fantasma SKU desencadeia quatro chamadas API  um incidente de vários sistemas.
4. **Context loss.**As tarefas de longo horizonte esquecem as restrições de turno precoce.
5. **Tool misuse.**Chama a ferramenta certa com argumentos errados, ou a ferramenta errada inteiramente.

Os agentes não conseguem distinguir "eu falhei" de "a tarefa é impossível" e muitas vezes alucinam uma mensagem de sucesso em 400 erros para fechar o ciclo.

### Mitigation: portões em cada passo

Portais de verificação automáticas em cada etapa de uma cadeia de raciocínio, verificando a base de fatos em relação ao estado ambiental.

- Classificador de segurança por etapa (Lessão 21).
- Validação de argumentos de chamada de ferramenta (Lessão 06).
- Verificação cruzada do conteúdo recuperado com relação a fatos conhecidos (Lessão 05, CRÍTICA).
- Detectar alucinação de sucesso por re-probar estado (o arquivo foi realmente criado?).

### Onde o monitoramento de falhas vai mal

- **Tagging only crashes.**A maioria das falhas dos agentes produzem resultados válidos.
- **No baseline.**A detecção da deriva precisa de um último bom conhecido; sem ela não se pode dizer "este está a piorar".
- **Over-alerting.**Cada falha produz uma página, um cluster e um limite de taxa.

```figure
failure-cascade
```

## Construí-lo

`code/main.py`Implementa um tagger de modo de falha stdlib:

- Um conjunto de dados sintéticos de rastreamento que abrange os cinco modos.
- Funções do detector por modo (patrões de assinatura em chamadas de ferramenta, saídas, ações repetidas).
- Um tagger que marca cada traço e relata a distribuição de modo.

- É o que é ?

```
python3 code/main.py
npx tsx code/main.ts
```

Resultado: rótulos por rastro + distribuição agregada, uma reprodução barata do que a superfície de aglomeração de rastro da Phoenix.

## Usá-lo

- **Phoenix**para o agrupamento de derivação da produção (Lessão 24).
- **Langfuse**para repetição de sessão + anotação.
- **Custom**para assinaturas específicas de domínio que a sua plataforma de observação não pode detectar.

## Envia-o

`outputs/skill-failure-detector.md`gera detectores de modo de falha adaptados ao seu domínio, ligados a uma loja de rastreamento.

## Exercícios

1. Adicione um detector para "alucinação de sucesso": o agente retorna sucesso, mas o estado-alvo permanece inalterado.
2. Marque 100 traços reais de um produto que construiu. Qual modo domina?
3. Implementar uma métrica de "rádio de cascata": dada uma falha no passo N, quantas etapas a jusante foram afectadas?
4. Leia os 14 modos de falha do MASFT, escolha três que se aplicam ao seu produto, escreva detectores.
5. Conectar um detector a um trabalho de CI: falhar na construção se >=5% das pistas marcar um modo.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MASFT | "Multi-agent failure taxonomy" | Berkeley 14-mode categorization |
| Cascading error | "Ripple failure" | One early mistake propagates through N steps |
| Context loss | "Forgot the constraint" | Long-horizon turn drops early-turn facts |
| Tool misuse | "Wrong tool / wrong args" | Valid call, wrong invocation |
| Success hallucination | "Faked completion" | Agent claims success on a 400; state unchanged |
| Scope creep | "Overreach" | Agent does more than asked |
| Instruction-following deviation | "Disobedience" | Ignores system prompt or user constraint |
| Sub-intention errors | "Plan bugs" | Omission, redundancy, disorder in plan execution |

## Mais leitura

- [Cemri et al., MASFT (arXiv:2503.13657)](https://arxiv.org/abs/2503.13657) 14 modos de falha, 3 categorias
- [Microsoft, Taxonomy of Failure Mode in Agentic AI Systems](https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/microsoft/final/en-us/microsoft-brand/documents/Taxonomy-of-Failure-Mode-in-Agentic-AI-Systems-Whitepaper.pdf)Registro de riscos
- [Arize Phoenix](https://docs.arize.com/phoenix) Clustering de deriva na prática
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) quando os padrões mais simples evitam completamente os modos
