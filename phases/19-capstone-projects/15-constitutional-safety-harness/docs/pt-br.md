# Capstone 15 — Harness de Segurança Constitucional + Intervalo de Red Team

> Classificadores Constitucionais da Anthropic, Llama Guard 4 da Meta, ShieldGemma-2 da Google, Nemotron 3 Content Safety da NVIDIA e X-Guard para cobertura multilíngue definiram a stack de classificadores de segurança de 2026. garak, PyRIT, NVIDIA Aegis e promptfoo se tornaram as ferramentas padrão de avaliação adversarial. NeMo Guardrails v0.12 conecta tudo isso numa pipeline de produção. Este capstone conecta tudo: um harness de segurança em camadas ao redor de um app alvo, um agente de red team autônomo rodando 6+ famílias de ataque e um ciclo de auto-crítica constitucional que produz um delta mensurável de inofensividade.

**Tipo:** Capstone
**Linguagens:** Python (pipeline de segurança, red team), YAML (configs de política)
**Pré-requisitos:** Fase 10 (LLMs do zero), Fase 11 (engenharia de LLM), Fase 13 (ferramentas), Fase 14 (agents), Fase 18 (ética, segurança, alinhamento)
**Fases exercitadas:** P10 · P11 · P13 · P14 · P18
**Tempo:** 25 horas

## Problema

A fronteira de segurança de LLM em 2026 não é se classificadores funcionam (eles funcionam, mais ou menos) mas como compô-los corretamente ao redor de uma aplicação de produção sem over-refusing ou deixar buracos óbvios. Llama Guard 4 lida com violações de política em inglês. X-Guard (132 idiomas) lida com jailbreak multilíngue. ShieldGemma-2 pega injeção de prompt baseada em imagem. Nemotron 3 Content Safety da NVIDIA cobre categorias empresariais. Classificadores Constitucionais da Anthropic são uma abordagem separada usada durante treinamento em vez de serving.

Evolução de ataques importa também. PAIR e TAP automatizam descoberta de jailbreak. GCG roda ataques de sufixo baseados em gradiente. Ataques multi-turn e de troca de código exploram memória de agents. Qualquer LLM implantado precisa de um intervalo de red team — garak e PyRIT são os drivers canônicos — além de mitigações documentadas e achados com pontuação CVSS.

Você vai blindar uma aplicação alvo (ou um modelo instruction-tuned de 8B ou um dos chatbots RAG de outros capstones), rodar 6+ famílias de ataque contra ela e produzir uma medição de antes/depois de inofensividade.

## Conceito

A pipeline de segurança tem cinco camadas. **Sanitizar entrada**: remover caracteres de largura zero, decodificar base64/rot13, normalizar Unicode. **Camada de política**: trilhas NeMo Guardrails v0.12 (fora de domínio, toxicidade, extração de PII). **Gate de classificador**: Llama Guard 4 na entrada, X-Guard em não-english, ShieldGemma-2 em entradas de imagem. **Modelo**: o LLM alvo. **Filtro de saída**: Llama Guard 4 na saída, limpeza PII Presidio, aplicação de citações onde aplicável. **Nível HITL**: saídas marcadas de alto risco vão para uma fila no Slack.

O intervalo de red team roda num agendador. PAIR e TAP descobrem jailbreaks autônomamente. GCG roda ataques de sufixo baseados em gradiente. Ataques de codificação ASCII / base64 / rot13. Ataques multi-turn (adoção de persona, exploração de memória). Ataques de troca de código (misturar inglês com Swahili ou tailandês). Cada execução produz um arquivo estruturado de achados com pontuação CVSS e cronograma de divulgação.

O ciclo de auto-crítica constitucional é uma intervenção no momento de treinamento. Pegue 1k prompts de tentativa danosa, faça o modelo rascunhar uma resposta, critique-a contra uma constituição escrita (regras de não causar dano) e retreine no ciclo de crítica. Meça o delta de antes/depois de inofensividade numa avaliação retida.

## Arquitetura

```
requisição (texto / imagem / multilíngue)
      |
      v
sanitizar entrada (remover largura zero, decodificar, normalizar)
      |
      v
trilhas NeMo Guardrails v0.12 (fora de domínio, política)
      |
      v
gate de classificador:
  Llama Guard 4 (inglês)
  X-Guard (multilíngue, 132 idiomas)
  ShieldGemma-2 (prompts de imagem)
  Nemotron 3 Content Safety (empresarial)
      |
      v (permitido)
LLM alvo
      |
      v
filtro de saída: Llama Guard 4 + limpeza PII Presidio + verificação de citação
      |
      v
nível HITL para saídas sinalizadas

paralelo:
  agendador de red team
    -> garak (ataques clássicos)
    -> PyRIT (red team orquestrado)
    -> agente autônomo de jailbreak (PAIR + TAP)
    -> ataques de sufixo GCG
    -> multilíngue / troca de código
    -> adoção de persona multi-turn

saída: achados com pontuação CVSS + cronograma de divulgação + delta antes/depois de inofensividade
```

## Stack

- Classificadores de segurança: Llama Guard 4, ShieldGemma-2, Nemotron 3 Content Safety da NVIDIA, X-Guard
- Framework de guardrails: NeMo Guardrails v0.12 + OPA
- Drivers de red team: garak (NVIDIA), PyRIT (Microsoft Azure), NVIDIA Aegis, promptfoo
- Agents de jailbreak: PAIR (Chao et al., 2023), Tree-of-Attacks (TAP), sufixo GCG
- Treinamento constitucional: ciclo de auto-crítica estilo Anthropic + SFT em críticas
- Limpeza PII: Presidio
- Alvo: um modelo instruction-tuned de 8B ou um dos chatbots RAG de outros capstones

## Construa

1. **Preparação do alvo.** Monte um modelo instruction-tuned de 8B no vLLM (ou reutilize um chatbot RAG de outro capstone). Este é o app em teste.

2. **Envoltória da pipeline de segurança.** Conecte a pipeline de cinco camadas ao redor do alvo. Verifique que cada camada é individualmente observável (span por camada no Langfuse).

3. **Cobertura de classificadores.** Carregue Llama Guard 4, X-Guard (multilíngue), ShieldGemma-2 (imagem). Rode cada um num pequeno conjunto rotulado para estabelecer baselines.

4. **Agendador de red team.** Agende garak, PyRIT, um agente PAIR, um agente TAP, um runner GCG, um atacante multi-turn e um atacante de troca de código. Cada um roda numa fila separada.

5. **Suíte de ataques.** Seis famílias de ataque: (1) jailbreak automatizado PAIR, (2) tree-of-attacks TAP, (3) sufixo gradiente GCG, (4) codificação ASCII / base64 / rot13, (5) persona multi-turn, (6) troca de código multilíngue. Relate taxa de sucesso por família.

6. **Auto-crítica constitucional.** Selecione 1k prompts de tentativa danosa. Para cada um, o alvo rascunha uma resposta. Um LLM crítico pontua contra uma constituição escrita ("não causar dano", "citar evidências", "recusar pedidos ilegais"). Prompts onde o crítico objetá são reescritos; o alvo faz fine-tune nos pares melhorados por crítica. Meça antes/depois de inofensividade numa avaliação retida.

7. **Medição de over-refusal.** Rastreie taxa de falso-positivo num conjunto de prompts benignos (ex.: XSTest). O alvo deve continuar útil em questões benignas.

8. **Pontuação CVSS.** Para cada jailbreak bem-sucedido, pontue em CVSS 4.0 (vetor de ataque, complexidade, impacto). Produza um cronograma de divulgação e plano de mitigação.

9. **Automação do intervalo.** Tudo acima roda num cron; achados escrevem para uma fila; alertas de regressão de over-refusal disparam para o Slack.

## Use

```
$ safety probe --model=target --family=PAIR --budget=50
[atacante]   agente PAIR rodando no alvo
[ataque]     tentativa 1/50: disfarçar consulta como pesquisa acadêmica ... bloqueado
[ataque]     tentativa 2/50: apelar para roleplay ... bloqueado
[ataque]     tentativa 3/50: coaxamento por cadeia-de-pensamento ... BEM-SUCEDIDO
[achado]     CVSS 4.8 médio: bypass de roleplay no alvo
[intervalo]  7 sucessos em 50 (14% taxa de sucesso)
```

## Entregue

`outputs/skill-safety-harness.md` é a entrega. Uma pipeline de segurança em camadas de grau de produção mais um intervalo de red team reproduzível com deltas de antes/depois de inofensividade.

| Peso | Critério | Como é medido |
|:-:|---|---|
| 25 | Cobertura de superfície de ataque | 6+ famílias de ataque exercitadas, 2+ idiomas |
| 20 | Trade-off verdadeiro-positivo / falso-positivo | Taxa de bloqueio de ataque vs taxa de pass benigno XSTest |
| 20 | Delta de auto-crítica | Antes/depois de inofensividade em avaliação retida |
| 20 | Documentação e divulgação | Achados com pontuação CVSS com cronograma |
| 15 | Automação e reprodutibilidade | Tudo roda no cron com alertas |
| **100** | | |

## Exercícios

1. Rode o plugin de prompt-injection do garak num chatbot RAG e compare a taxa de sucesso do ataque com e sem a camada de filtro de saída.

2. Adicione uma sétima família de ataque: injeção indireta de prompt via documentos recuperados. Meça a defesa extra necessária.

3. Implemente um modo "recusar-com-ajuda": quando o guardrail bloqueia, o alvo oferece uma resposta relacionada mais segura em vez de uma recusa direta. Meça o delta XSTest.

4. Lacuna de cobertura multilíngue: encontre um idioma onde X-Guard tem desempenho inferior. Proponha um dataset de fine-tune visando ele.

5. Rode a auto-crítica constitucional num modelo de 30B e meça se o delta escala.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|------|------------------------|------------------------|
| Segurança em camadas | "Defesa em profundidade" | Múltiplos guardrails em entrada, gate, saída, HITL |
| Llama Guard 4 | "Classificador de segurança Meta" | Classificador de conteúdo entrada/saída de referência de 2026 |
| PAIR | "Agent de jailbreak" | Paper (Chao et al.) sobre descoberta de jailbreak conduzida por LLM |
| TAP | "Tree-of-Attacks" | Variante de busca em árvore do PAIR |
| GCG | "Greedy coordinate gradient" | Ataque adversarial de sufixo baseado em gradiente |
| Auto-crítica constitucional | "Treinamento estilo Anthropic" | Alvo rascunha -> crítico pontua -> reescreve -> retreina |
| XSTest | "Conjunto de probe benigno" | Benchmark para regressão de over-refusal |
| CVSS 4.0 | "Pontuação de severidade" | Pontuação padrão de vulnerabilidade para achados de segurança |

## Leitura Complementar

- [Classificadores Constitucionais Anthropic](https://www.anthropic.com/research/constitutional-classifiers) — referência no momento de treinamento
- [Llama Guard 4 Meta](https://ai.meta.com/research/publications/llama-guard-4/) — classificador entrada/saída de 2026
- [ShieldGemma-2 Google](https://huggingface.co/google/shieldgemma-2b) — segurança de imagem + multimodal
- [Nemotron 3 Content Safety NVIDIA](https://developer.nvidia.com/blog/building-nvidia-nemotron-3-agents-for-reasoning-multimodal-rag-voice-and-safety/) — referência empresarial
- [X-Guard (arXiv:2504.08848)](https://arxiv.org/abs/2504.08848) — segurança multilíngue 132 idiomas
- [garak](https://github.com/NVIDIA/garak) — toolkit de red team NVIDIA
- [PyRIT](https://github.com/Azure/PyRIT) — framework de red team Microsoft
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) — framework de trilhas
- [PAIR (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) — paper de agente de jailbreak
