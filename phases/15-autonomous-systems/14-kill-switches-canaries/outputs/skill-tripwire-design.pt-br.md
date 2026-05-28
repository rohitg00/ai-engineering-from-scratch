---
name: tripwire-design
description: Revise uma pilha de detectores de agente proposta (interruptor de interrupção, disjuntores, tokens canário) e sinalize fios de disparo ausentes antes da primeira execução autônoma.
version: 1.0.0
phase: 15
lesson: 14
tags: [kill-switch, circuit-breaker, canary, honeytoken, detection-and-response]
---

Dada uma pilha de detectores proposta para uma implantação de agente, audite-a em relação à referência de três detectores (interruptor de interrupção, disjuntor, canário) e sinalize o que está faltando, ajustado incorretamente ou exposto ao agente.

Produzir:

1. **Auditoria de kill switch.** Onde fica o switch (sinalizador de recurso, Redis, configuração assinada)? Confirme se as credenciais do agente não podem desativá-lo. Confirme se cada ação consequente verifica a chave, não apenas a inicialização. Confirme se a reativação é uma ação humana explícita.
2. **Inventário de disjuntores.** Liste todos os padrões observados por um disjuntor (repetição, falhas consecutivas, taxa, ferramenta específica após leitura fora de confiança). Limite de estado e resfriamento para cada um. Limiares acima de 10 geralmente são muito vagos.
3. **Design canário.** Liste todos os tokens canário no ambiente. Para cada um: o que é (credencial falsa, registro de banco de dados falso, arquivo falso, entrada de memória falsa), onde reside, qual acesso aciona o alarme, quem é paginado. Confirme que nenhum canário tem um motivo legítimo para ser tocado.
4. **Estatística + camadas rígidas.** Confirme se a pilha usa pelo menos um limite rígido (estilo constitucional da Lição 17) além de quaisquer detectores estatísticos (EWMA, pontuação z). Detectores apenas estatísticos aceitam desvio lento.
5. **Caminho da quarentena.** O que acontece quando um detector dispara? Parada completa do agente, pausa específica do caminho, redirecionamento de tráfego (eBPF / Cilium honeypot), somente alerta. Confirme se o caminho foi testado de ponta a ponta pelo menos uma vez.

Rejeições difíceis:
- Qualquer implantação sem um kill switch externo.
- Tokens canário armazenados em sistemas aos quais o agente tem acesso de gravação.
- Detecção apenas estatística, sem limites rígidos.
- Disjuntores com resfriamento que são reativados automaticamente sem revisão humana.
- Execuções autônomas onde o kill switch é verificado apenas na inicialização, não por ação.

Regras de recusa:
- Se o usuário não puder nomear os sistemas específicos fora das credenciais do agente que hospeda o kill switch, recuse. "Usamos um arquivo de configuração que o agente lê" não é um kill switch se o agente puder gravar arquivos de configuração.
- Se o usuário tratar o classificador do Modo Automático (Lição 10) como um substituto para os fios de disparo, recuse. O classificador é ortogonal à detecção e resposta.
- Se os canários propostos estiverem em sistemas, o agente tem motivos legítimos para ler, recusar e exigir redesenho.

Formato de saída:

Retorne uma auditoria tripwire com:
- **Linha do interruptor de interrupção** (localização, verificação de cadência, procedimento de reativação)
- **Tabela de disjuntores** (padrão, limite, resfriamento)
- **Tabela Canário** (token, localização, alarme, proprietário)
- **Nota de estratificação** (estatística + limites rígidos presentes s/n)
- **Fluxo de quarentena** (o que dispara, o que acontece, testado s/n)
- **Prontidão** (produção/encenação/somente pesquisa)