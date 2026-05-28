# Capstone 17 — Tutor IA Pessoal (Adaptativo, Multimodal, com Memória)

> Khanmigo (Khan Academy), Duolingo Max, LearnLM / Gemini for Education do Google, Quizlet Q-Chat e Synthesis Tutor todos lançaram tutoria multimodal adaptativa em escala em 2026. A forma comum é uma política socrática (nunca simplesmente despejar a resposta), um modelo de aprendiz que atualiza após cada interação (estilo de rastreamento de conhecimento bayesiano), entrada de voz + texto + foto-mat, recuperação de grafo curricular, agendamento de repetição espaçada e filtros de segurança rígidos para conteúdo apropriado à idade. O capstone é lançar um tutor de disciplina eespecificaçãoífica (álgebra do ensino fundamental ou introdução a Python), rodar um estudo de eficácia de duas semanas com 10 aprendizes e passar em uma auditoria de segurança de conteúdo.

**Tipo:** Capstone
**Linguagens:** Python (backend, modelo de aprendiz), TypeScript (app web), SQL (grafo curricular via Postgres + Neo4j)
**Pré-requisitos:** Fase 5 (NLP), Fase 6 (fala), Fase 11 (engenharia de LLM), Fase 12 (multimodal), Fase 14 (agents), Fase 17 (infraestrutura), Fase 18 (segurança)
**Fases exercitadas:** P5 · P6 · P11 · P12 · P14 · P17 · P18
**Tempo:** 30 horas

## Problema

Tutoria adaptativa costumava ser um nicho de pesquisa de ed-tech. Em 2026 é um produto para consumidores. Khanmigo está implantado na maioria dos distritos escolares americanos. Duolingo Max atingiu dezenas de milhões de MAUs. LearnLM / Gemini for Education do Google alimenta tutoria no Google Classroom. Quizlet Q-Chat fica ao lado de flashcards. Synthesis Tutor viralizou com tutor-para-crianças-curiosas. Elementos comuns: entrada multimodal (digitar, falar, fotografar equações), pedagogia socrática (perguntar primeiro, explicar depois), um modelo de aprendiz que atualiza após cada interação e segurança rigorosa apropriada à idade.

Você vai construir um desses para uma turma eespecificaçãoífica. A barra de medição é um estudo de eficácia real: pontuações de pré-teste e pós-teste ao longo de duas semanas com 10 aprendizes. O loop de voz precisa parecer natural (sub-stack do capstone 03). A memória precisa ser respeitosa de privacidade. O filtro de segurança precisa passar em red team consciente de COPPA para K-12.

## Conceito

Quatro componentes. **Política do tutor** é um loop socrático: quando o aprendiz pede a resposta, a política faz uma pergunta conduzente; quando acerta, avança para o conceito seguinte; quando está travado, oferece uma dica escalonada. **Modelo de aprendiz** é rastreamento de conhecimento bayesiano (ou uma variante simples) que atualiza a probabilidade de domínio por nó curricular após cada interação. **Grafo curricular** é um Neo4j de conceitos com arestas de pré-requisitos; a política percorre o grafo para escolher o próximo conceito. **Memória** é um armazenamento episódico + semântico (estilo agentmemory) guardando interações passadas, erros e preferências.

A UX é multimodal. Entrada de texto para respostas digitadas. Entrada de voz via LiveKit + Whisper (reutilize capstone 03). Entrada de foto para problemas de matemática via dots.ocr ou PaliGemma 2. Saída de voz via Cartesia Sonic-2. Segurança usa Llama Guard 4 mais um filtro apropriado à idade (bloqueia conteúdo adulto, violência, autolesão) e uma política de retenção de memória consciente de COPPA.

O estudo de eficácia é a entrega. 10 aprendizes, pré-teste e pós-teste, duas semanas. Relate o delta de ganho de aprendizado e intervalo de confiança. Compare contra uma baseline não-adaptativa (o mesmo conteúdo entregue linearmente sem a política do tutor).

## Arquitetura

```
dispositivo do aprendiz
  |
  +-- texto         -> app web
  +-- voz           -> LiveKit Agents (ASR + TTS)
  +-- foto mat      -> dots.ocr / PaliGemma 2
       |
       v
  política do tutor (LangGraph)
       - cabeça de decisão socrática
       - escolha do próximo conceito (percorrer grafo curricular)
       - escalonamento de dicas
       - atualização de domínio
       |
       v
  modelo de aprendiz (BKT / teoria de resposta ao item)
       - probabilidade de domínio por conceito
       - agendador de repetição espaçada (SM-2 ou FSRS)
       |
       v
  memória (estilo agentmemory)
       - episódica: cada interação
       - semântica: erros aprendidos, preferências
       - política de retenção: consciente de COPPA / GDPR
       |
       v
  grafo curricular (Neo4j)
       - arestas de pré-requisitos
       - conteúdo OER anexado
       |
       v
  segurança:
    Llama Guard 4 + filtro apropriado à idade
    acesso à memória controlado por escopo de ID do aprendiz
```

## Stack

- Escolha de disciplina: álgebra do ensino fundamental ou introdução a Python (escolha uma para profundidade)
- Política do tutor: LangGraph sobre Claude Sonnet 4.7 (com prompt caching)
- Modelo de aprendiz: rastreamento de conhecimento bayesiano (clássico) ou FSRS para espaçamento
- Grafo curricular: Neo4j de conceitos + arestas de pré-requisitos + conteúdo OER
- Memória: armazenamento persistente vetorial + episódico + semântico estilo agentmemory
- Voz: LiveKit Agents 1.0 + Cartesia Sonic-2 (reutilize sub-stack do capstone 03)
- Foto mat: dots.ocr ou PaliGemma 2 para reconhecimento de equações
- Segurança: Llama Guard 4 + filtro apropriado à idade customizado
- Avaliação: geração de questões nível Bloom, suíte de pré/pós-teste, ferramentas de estudo de eficácia

## Construa

1. **Grafo curricular.** Construa um Neo4j de 50-150 nós de conceitos (ex.: álgebra do ensino fundamental da "reta numérica" à "fórmula de bhaskara") com arestas de pré-requisitos. Anexe conteúdo OER por nó (Open Textbook, OpenStax).

2. **Modelo de aprendiz.** Inicialize rastreamento de conhecimento bayesiano com priors: chute, escorregão, taxa-aprendizado. Atualize domínio por conceito após cada interação. Persista por aprendiz.

3. **Política do tutor.** LangGraph com nós: `ler_sinal` (a resposta do aprendiz estava correta / parcial / travada?), `escolher_conceito` (percorrer grafo curricular escolhendo o conceito de maior prioridade), `escalonar` (prompt socrático), `atualizar_domínio`.

4. **Memória.** Cada interação escreve em um armazenamento episódico. Erros e preferências promovem para memória semântica. Política de retenção consciente de COPPA: auto-delete após 1 ano, acessível aos pais.

5. **Caminho de voz.** Worker LiveKit Agents anexado à política do tutor. ASR via Whisper-v3-turbo. TTS via Cartesia Sonic-2. Suporte a interrupção (reutilize mecânicas do capstone 03).

6. **Caminho de foto-mat.** Carregar ou capturar imagem; rodar dots.ocr ou PaliGemma 2 para reconhecer a equação; alimentar ao tutor como entrada estruturada.

7. **Segurança.** Cada saída do modelo passa por Llama Guard 4 + filtro apropriado à idade (bloqueia autolesão, conteúdo adulto, violência). Acesso à memória escopado por ID do aprendiz; superfície de acesso parental para exclusão.

8. **Estudo de eficácia.** 10 aprendizes, pré-teste (baseline padronizada de 30 questões), duas semanas de interação com o tutor (3 sessões/semana), pós-teste. Compare contra uma coorte baseline não-adaptativa de 10 aprendizes no mesmo conteúdo.

9. **Relatórios de progresso semanais.** Por aprendiz, gere automaticamente um PDF com resumo de tópicos explorados, trajetórias de domínio e próximos passos recomendados.

## Use

```
aprendiz: "não entendo por que 3x + 6 = 12 significa x = 2"
[sinal]    travado
[conceito] 'isolar variáveis' (pré-requisito: adição-subtração-igualdade)
[escalonar] "qual número você subtrairia dos dois lados para começar?"
aprendiz: "6"
[sinal]    correto
[domínio]  adição-subtração-igualdade: 0.62 -> 0.77
[conceito] continuar 'isolar variáveis'
[escalonar] "ótimo. agora o que é 3x / 3 igual a?"
```

## Entregue

`outputs/skill-ai-tutor.md` é a entrega. Um tutor adaptativo de disciplina eespecificaçãoífica com entrada multimodal, modelo de aprendiz, memória, segurança e eficácia medida.

| Peso | Critério | Como é medido |
|:-:|---|---|
| 25 | Delta de ganho de aprendizado | Delta pré/pós-teste em estudo de duas semanas com 10 aprendizes |
| 20 | Fidelidade socrática | Pontuação por rubrica em amostras de transcrição |
| 20 | UX multimodal | Coerência voz + foto + texto ponta a ponta |
| 20 | Postura de segurança + privacidade | Taxa de pass Llama Guard 4 + retenção consciente de COPPA |
| 15 | Abertura curricular e qualidade do grafo | Cobertura de conceitos + consistência do grafo de pré-requisitos |
| **100** | | |

## Exercícios

1. Rode o estudo de eficácia com e sem o modelo de aprendiz adaptativo (ordem aleatória de conceitos). Relate o delta. Espere adaptativo vencer, mas o tamanho é o número interessante.

2. Adicione um probe multimodal: a mesma questão de conceito entregue como texto, voz e foto. Meça se aprendizes convergem mais rápido com a modalidade que preferem.

3. Construa um painel para pais: tópicos praticados, trajetórias de domínio, conceitos seguintes, eventos de segurança (qualquer hit de guardrail). Alinhado com COPPA.

4. Adicione um modo de troca de idioma: o tutor aceita entrada em espanhol e ensina em espanhol. Meça a cobertura do X-Guard.

5. Estresse a privacidade da memória: verifique que o aprendiz A não consegue ver dados do aprendiz B mesmo através de um ataque de re-ingestão de clipe de áudio. Registre a tentativa de acesso e alerte.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|------|------------------------|------------------------|
| Política socrática | "Perguntar, não despejar" | Tutor faz uma pergunta conduzente em vez de dar a resposta |
| Rastreamento de conhecimento bayesiano | "BKT" | Equações clássicas de modelo de aprendiz para probabilidade de domínio por conceito |
| FSRS | "Free Spaced Repetition Scheduler" | Agendador de repetição espaçada de 2024, melhor que SM-2 |
| Grafo curricular | "DAG de conceitos" | Neo4j de conceitos com arestas de pré-requisitos |
| Memória episódica | "Log por interação" | Cada interação armazenada para recuperação posterior |
| Memória semântica | "Loja de padrões aprendidos" | Erros e preferências compactados promovidos do episódico |
| COPPA | "Lei de privacidade para crianças" | Lei americana restringindo coleta de dados de menores de 13 anos |

## Leitura Complementar

- [Khanmigo (Khan Academy)](https://www.khanmigo.ai) — tutor K-12 de referência para consumidores
- [Duolingo Max](https://blog.duolingo.com/duolingo-max/) — tutor de aprendizado de idiomas de referência
- [LearnLM / Gemini for Education Google](https://blog.google/technology/google-deepmind/learnlm) — modelo hospedado de referência
- [Quizlet Q-Chat](https://quizlet.com) — referência alternativa
- [Synthesis Tutor](https://www.synthesis.com) — referência de startup
- [Algoritmo FSRS](https://github.com/open-spaced-repetition/fsrs4anki) — agendador de repetição espaçada
- [Rastreamento de Conhecimento Bayesiano](https://en.wikipedia.org/wiki/Bayesian_knowledge_tracing) — clássico de modelo de aprendiz
- [LiveKit Agents](https://github.com/livekit/agents) — stack de voz
