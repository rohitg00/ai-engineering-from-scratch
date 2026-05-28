# Regras do Agente

## inicialização/arquivo de estado atualizado
- categoria: inicialização
- verifique: state_file_fresh
O agente deve ler agent_state.json antes de qualquer chamada de ferramenta.

## gravações proibidas/não fora do escopo
- categoria: proibido
- verifique: no_out_of_scope_writes
Nunca edite um arquivo fora do contrato de escopo da tarefa ativa.

## concluído/testes aprovados
- categoria: definição_de_feito
- verifique: testes_pass
Uma tarefa é concluída somente quando todo comando de aceitação sai de zero.

## incerteza/nota de pergunta aberta
- categoria: incerteza
- verificar: open_question_when_unsure
Quando a confiança estiver abaixo do limite, abra uma nota de pergunta em vez de adivinhar.

## aprovação/nova dependência
- categoria: aprovação
- verifique: new_dependency_approved
Adicionar uma dependência de tempo de execução requer aprovação humana explícita.