# Protocolo de transferência

Cada sessão termina com um pacote de transferência contendo:

- resumo
- arquivos_alterados
- comandos_run
- tentativas_falhadas
- open_risks (gravidade + detalhe)
- next_action (uma etapa concreta)
- verdict_pointer (caminhos para verificação + relatórios de revisão)

O pacote é enviado como handoff.md (humanos) e handoff.json (próximo agente).
Campos ausentes interrompem o gancho de final de sessão.