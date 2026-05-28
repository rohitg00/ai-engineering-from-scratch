---
name: ai-tutor
description: Envie um tutor pessoal multimodal adaptativo para um assunto específico com rastreamento de conhecimento Bayesiano, um gráfico curricular, filtros de segurança e um estudo de eficácia medido de duas semanas.
version: 1.0.0
phase: 19
lesson: 17
tags: [capstone, tutor, adaptive, bkt, fsrs, livekit, multimodal, coppa]
---

Dada uma matéria (álgebra K-12 ou introdução a Python), crie um tutor pessoal com entrada de texto + voz + fotomatemática, modelo de aluno de rastreamento de conhecimento bayesiano, seleção de conceito baseada em gráfico de currículo, memória compatível com COPPA e filtros de segurança. Faça um estudo de eficácia de duas semanas com 10 alunos.

Plano de construção:

1. Gráfico de currículo no Neo4j: 50-150 nós de conceito com arestas de pré-requisito e conteúdo REA anexado (OpenStax, Open Textbook).
2. Modelo de aluno: rastreamento de conhecimento bayesiano com antecedentes para adivinhação/deslize/taxa de aprendizagem por conceito; estado persistente por aluno.
3. Política do tutor (LangGraph sobre Claude Sonnet 4.7 com cache de prompt): read_signal -> select_concept (graph walk) -> scaffold (Socratic) -> update_mastery.
4. Memória: armazenamento episódico + semântico persistente no estilo de memória do agente; Exclusão automática compatível com COPPA após 1 ano; exclusão acessível aos pais.
5. Voz: Agentes LiveKit trabalhando com Whisper-v3-turbo ASR e Cartesia Sonic-2 TTS; reutilizar o pipeline capstone 03.
6. Matemática fotográfica: dots.ocr ou PaliGemma 2 para reconhecimento de equações; fornecer informações estruturadas ao tutor.
7. Segurança: entrada/saída do Llama Guard 4; filtro adequado à idade que bloqueia automutilação/adulto/violência; isolamento de memória no escopo do aluno.
8. Relatórios semanais de progresso em PDF por aluno.
9. Estudo de eficácia: 10 alunos, pré-teste (linha de base padronizada com 30 perguntas), 2 semanas de sessões (3/semana), pós-teste; compare com a coorte linear não adaptativa.

Rubrica de avaliação:

| Peso | Critério | Medição |
|:-:|---|---|
| 25 | Delta de ganho de aprendizagem | Delta pré/pós-teste no estudo de 2 semanas com 10 alunos |
| 20 | Fidelidade socrática | Pontuação de rubrica em amostras de transcrição |
| 20 | UX multimodal | Voz + foto + coerência de texto de ponta a ponta |
| 20 | Postura de segurança + privacidade | Taxa de aprovação do Llama Guard 4 + retenção com reconhecimento de COPPA + isolamento entre alunos |
| 15 | Amplitude curricular e qualidade gráfica | Cobertura de conceito + consistência gráfica de pré-requisitos |

Rejeições difíceis:

- Políticas do tutor que respondem e descartam em vez de fazer a próxima pergunta. Socrático é um requisito difícil.
- Modelos de aprendizagem que não são atualizados por interação. BKT é um piso.
- Memória sem retenção compatível com COPPA. Inaceitável para um público K-12.
- Alegações de eficácia sem uma coorte de base não adaptativa.

Regras de recusa:

- Recuse-se a implantar sem o Llama Guard 4 na entrada e na saída.
- Recuse-se a persistir os dados do aluno sem uma superfície de exclusão acessível aos pais.
- Recuse-se a reivindicar “adaptável” sem analisar a linha de base não adaptativa.

Saída: um repositório contendo o gráfico do currículo, o modelo de aluno BKT, a política do tutor LangGraph, os manipuladores de entrada multimodais, o pipeline de voz LiveKit, o pipeline de segurança, o painel dos pais, o executor do estudo de eficácia, o equipamento pré/pós-teste e um artigo documentando o delta do ganho de aprendizagem versus a linha de base linear com intervalos de confiança.