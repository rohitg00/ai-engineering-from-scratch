# Capstone 15  Arnes de Segurança Constitucional + Range Red-Team

> Os Classificadores Constitucionais da Anthropic, o Llama Guard 4 da Meta, o ShieldGemma 2 do Google, a Nemotron 3 Content Safety da NVIDIA e o X-Guard para cobertura multilíngue definiram a pilha de classificadores de segurança de 2026. Garak, PyRIT, NVIDIA Aegis e promptfoo tornaram-se as ferramentas padrão de avaliação adversária. O NeMo Guardrails v0.12 liga-os a um gasoduto de produção. Esta pedra-chave liga tudo: um arame de segurança em camadas em torno de um aplicativo alvo, um agente autônomo da equipe vermelha que executa mais de 6 famílias de ataque e uma corrida constitucional de autocrítica que produz um delta de inofensividade mensurável.

**Type:** Capstone
**Languages:** Python (safety pipeline, red team), TypeScript, YAML (policy configs)
**Prerequisites:** Phase 10 (LLMs from scratch), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 18 (ethics, safety, alignment)
**Phases exercised:**P10 · P11 · P13 · P14 · P18
**Time:** 25 hours

## Problemas

A fronteira da segurança do LLM em 2026 não é se os classificadores funcionam (fazem, aproximadamente), mas como compor-los corretamente em torno de um aplicativo de produção sem recusar excessivamente ou deixar buracos óbvios. A Guarda Llama 4 lida com violações de políticas inglesas. O X-Guard (132 idiomas) lida com jailbreak multilingue. ShieldGemma-2 capta injecção rápida baseada em imagem. NVIDIA Nemotron 3 Segurança de conteúdo abrange categorias de empresas. Os Classificadores Constitucionais da Anthropic são uma abordagem separada usada durante o treinamento em vez de servir.

O PAIR e o TAP automatizam a descoberta do jailbreak. O GCG executa ataques de sufixo baseados em gradientes. Ataques de múltiplos giros e comutação de código exploram a memória do agente. Qualquer LLM implantado precisa de um intervalo de equipe vermelha  garak e PyRIT são os drivers canônicos  mais mitigações documentadas e resultados marcados pelo CVSS.

Você irá endurecer uma aplicação alvo (ou um modelo 8B com instruções ou um dos chatbots RAG de outras capstones), executar 6+ famílias de ataque contra ele, e produzir uma medição de inofensividade antes/após.

## Conceptos

O tubo de segurança é de cinco camadas.**Input sanitize**: strip caráter de largura zero, decodificar base64/rot13, normalizar Unicode. **Policy layer**: NeMo Guardrails v0.12 trilhos (fora do domínio, toxicidade, extracção de PII). **Classifier gate**: Llama Guard 4 em entrada, X-Guard em não inglês, ShieldGemma-2 em entrada de imagem. **Model**: o Mestrado em Direito Direito alvo. **Output filter**: Llama Guard 4 em saída, Presidio PII scrub, execução de citação, se aplicável. **HITL tier**: as saídas marcadas por alto risco vão para uma fila Slack.

O intervalo de equipe vermelha é executado em um cronógrafo. PAIR e TAP detectam jailbreaks de forma autônoma. GCG executa ataques de sufixo baseados em gradientes. Ataques de codificação ASCII / base64 / rot13. Ataques de várias voltas (aprobação de pessoa, exploração de memória). Ataques de comutação de código (misturado inglês com swahili ou tailandês). Cada execução produz um arquivo de resultados estruturado com pontuação CVSS e linha de tempo de divulgação.

A corrida constitucional-autocrítica é uma intervenção de treinamento-tempo. Tome 1k de tentativas prejudiciais, faça com que o modelo redigia uma resposta, critique-a contra uma constituição escrita (regras de não prejudicar) e retraine no ciclo de crítica. Messe o delta de inofensividade antes/após em uma avaliação realizada.

## Arquitetura

```
request (text / image / multilingual)
      |
      v
input sanitize (strip zero-width, decode, normalize)
      |
      v
NeMo Guardrails v0.12 rails (off-domain, policy)
      |
      v
classifier gate:
  Llama Guard 4 (English)
  X-Guard (multilingual, 132 langs)
  ShieldGemma-2 (image prompts)
  Nemotron 3 Content Safety (enterprise)
      |
      v (allowed)
target LLM
      |
      v
output filter: Llama Guard 4 + Presidio PII + citation check
      |
      v
HITL tier for flagged outputs

parallel:
  red-team scheduler
    -> garak (classic attacks)
    -> PyRIT (orchestrated red team)
    -> autonomous jailbreak agent (PAIR + TAP)
    -> GCG suffix attacks
    -> multilingual / code-switch
    -> multi-turn persona adoption

output: CVSS-scored findings + disclosure timeline + before/after harmlessness delta
```

## Estaca

- Classificadores de segurança: Llama Guard 4, ShieldGemma-2, NVIDIA Nemotron 3 Segurança de conteúdo, X-Guard
- Estrutura de guarda-rail: NeMo Guardrails v0.12 + OPA
- Drivers red-team: garak (NVIDIA), PyRIT (Microsoft Azure), NVIDIA Aegis, promptfoo
- Agentes de fuga de prisão: PAIR (Chao et al., 2023), Tree-of-Attacks (TAP), sufixo GCG
- Formação constitucional: ciclo de autocrítica de estilo antropológico + SFT sobre críticas
- Presidio
- Objetivo: um modelo 8B com ajuste de instruções ou um dos outros chatbots RAG das outras pedras de captura

```figure
cf-safety-stack
```

## Construí-lo

1. **Target setup.**Estabelecer um modelo 8B com instruções sintonizadas no vLLM (ou reutilizar um chatbot RAG de outro capstone).

2. **Safety pipeline wrap.**Fique atento a cada camada de observação individual (espanha por camada em Langfuse).

3. **Classifier coverage.**Carregar Llama Guard 4, X-Guard (multilingue), ShieldGemma-2 (imagem).

4. **Red-team scheduler.**Agente de PAIR, agente de TAP, corredor GCG, atacante de várias voltas e atacante de comutação de código.

5. **Attack suite.**Seis famílias de ataque: (1) jailbreak automático PAIR, (2) árvore de ataques TAP, (3) sufixo de gradiente GCG, (4) codificação ASCII / base64 / rot13, (5) persona multi-turn, (6) comutador de código multilingue.

6. **Constitutional self-critique.**Curar 1k tentativas prejudiciais. Para cada uma, o alvo elabora uma resposta. Um LLM crítico marca contra uma constituição escrita ("não prejudique", "citar evidências", "recusar pedidos ilegais").

7. **Over-refusal measurement.**Rastrear a taxa de falsos positivos em um conjunto de perguntas benignas (por exemplo, XSTest).

8. **CVSS scoring.**Para cada jailbreak bem-sucedido, pontuação no CVSS 4.0 (vector de ataque, complexidade, impacto).

9. **Range automation.**Tudo acima é executado em cron; resultados são escritos em uma fila; a regressão de recusa excessiva alerta fogo para Slack.

## Usá-lo

```
$ safety probe --model=target --family=PAIR --budget=50
[attacker]   PAIR agent running on target
[attack]     attempt 1/50: disguise query as academic research ... blocked
[attack]     attempt 2/50: appeal to roleplay ... blocked
[attack]     attempt 3/50: chain-of-thought coax ... SUCCEEDED
[finding]    CVSS 4.8 medium: roleplay bypass on target
[range]      7 successes out of 50 (14% success rate)
```

## Envia-o

`outputs/skill-safety-harness.md`Uma linha de segurança em camadas de nível de produção mais uma gama red-team reprodutivel com delta de inocuidade antes/após.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Attack-surface coverage | 6+ attack families exercised, 2+ languages |
| 20 | True-positive / false-positive trade-off | Attack block rate vs XSTest benign pass rate |
| 20 | Self-critique delta | Before/after harmlessness on held-out eval |
| 20 | Documentation and disclosure | CVSS-scored findings with timeline |
| 15 | Automation and repeatability | Everything runs on cron with alerts |
| **100** | | |

## Exercícios

1. Execute o plugin do garak para injeção de prompt em um chatbot RAG e compare a taxa de sucesso do ataque com e sem a camada de filtro de saída.

2. Adicione uma sétima família de ataques: injeção direta através de documentos recuperados.

3. Implementar um modo de "refusão com ajuda": quando o barranco de proteção bloqueia, o alvo oferece uma resposta relacionada mais segura em vez de uma recusa plana.

4. Gap de cobertura multilingue: encontrar uma língua onde o X-Guard não funciona bem. Proporcionar um conjunto de dados de ajuste fino para atingir o X-Guard.

5. Faça a autocrítica constitucional num modelo 30B e mede se o delta é escalado.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Layered safety | "Defense in depth" | Multiple guardrails at input, gate, output, HITL |
| Llama Guard 4 | "Meta's safety classifier" | The 2026 reference input/output content classifier |
| PAIR | "Jailbreak agent" | Paper (Chao et al.) on LLM-driven jailbreak discovery |
| TAP | "Tree-of-Attacks" | Tree-search variant of PAIR |
| GCG | "Greedy coordinate gradient" | Gradient-based adversarial suffix attack |
| Constitutional self-critique | "Anthropic-style training" | Target drafts -> critic scores -> rewrite -> retrain |
| XSTest | "Benign probe set" | Benchmark for over-refusal regression |
| CVSS 4.0 | "Severity score" | Standard vulnerability scoring for safety findings |

## Mais leitura

- [Anthropic Constitutional Classifiers](https://www.anthropic.com/research/constitutional-classifiers) Referência ao tempo de formação
- [Meta Llama Guard 4](https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/) o classificador de entrada/saída de 2026
- [Google ShieldGemma-2](https://huggingface.co/google/shieldgemma-2b) imagem + segurança multimodal
- [NVIDIA Nemotron 3 Content Safety](https://developer.nvidia.com/blog/building-nvidia-nemotron-3-agents-for-reasoning-multimodal-rag-voice-and-safety/) Referência empresarial
- [X-Guard (arXiv:2504.08848)](https://arxiv.org/abs/2504.08848) Segurança multilingue em 132 línguas
- [garak](https://github.com/NVIDIA/garak) Kit de ferramentas da equipe vermelha da NVIDIA
- [PyRIT](https://github.com/Azure/PyRIT) Framework do Microsoft Red Team
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) Estrutura ferroviária
- [PAIR (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419)Papel de agente de jailbreak
