---
name: mt-evaluator
description: Avalie o resultado de uma tradução automática para envio.
version: 1.0.0
phase: 5
lesson: 11
tags: [nlp, translation, evaluation]
---

Dado um texto fonte e uma tradução candidata, a saída:

1. Estimativa automática de pontuação. Faixas BLEU e chrF que você esperaria. Indique se uma referência está disponível.
2. Lista de verificação de cinco pontos verificável por humanos: preservação do conteúdo (sem alucinações), idioma alvo correto, correspondência de registro/formalidade, consistência terminológica com glossário, se fornecido, sem truncamento ou explosão de comprimento.
3. Um problema específico do domínio a ser investigado. Legal: entidades nomeadas, citações de estatutos. Médico: nomes de medicamentos, dosagens. UI: variáveis ​​de espaço reservado como `{name}`.
4. Bandeira de confiança. "Enviar" / "Enviar com revisão" / "Não enviar". Vincule à gravidade dos problemas encontrados.

Recuse-se a enviar sem uma verificação de identificação de idioma na saída. Recuse-se a avaliar sem referência, a menos que o usuário opte explicitamente pela pontuação sem referência (COMET-QE, BLEURT-QE). Sinalize qualquer conteúdo com mais de 1.000 tokens como provavelmente necessitando de tradução fragmentada.