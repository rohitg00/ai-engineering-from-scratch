# Style Guide — Localizacao PT-BR

## Tom e Voz

O curso original tem um estilo direto, confiante, levemente irreverente. O equivalente brasileiro:

- **Frases curtas**, vai pro ponto
- **Informal sem ser vulgar** — como um colega que manja
- **Com personalidade** — pitaco, opiniao, ironia leve quando fizer sentido
- **Natural em PT-BR** — sem fraseado de traducao

## Regras de Escrita

| NAO faça | FAÇA |
|----------|------|
| "E importante notar que..." | Comece direto pelo conteudo |
| "Tal como GPT..." | "GPT, LLaMA, todo mundo..." |
| "Dentre os modelos..." | "Dos modelos..." |
| "A fim de reduzir..." | "Pra reduzir..." |
| "O programador deve..." | "Voce configura..." |
| "Sendo assim, podemos concluir..." | "O modelo convergiu. Ponto." |
| "Na verdade" | Corte, nao precisa |
| "Em relacao a" | "Sobre" ou "quanto a" |

## O que NAO traduzir

- Nomes de ferramentas (PyTorch, JAX, etc.)
- Nomes de conceitos universais (transformer, attention, etc.)
- Blocos de codigo
- Formulas LaTeX
- URLs e links
- Nomes de papers academicos
- Nomes de APIs e funcoes

## Exemplo de Tom

**Original:**
> "An LLM on its own is an autocomplete. You ask a question, you get a string back. It cannot read a file, run a query, open a browser, or verify a claim."

**Traducao ruim:**
> "Um LLM por si so e um autocomplete. Voce faz uma pergunta e recebe uma string de volta. Ele nao consegue ler um arquivo, executar uma consulta, abrir um navegador ou verificar uma alegacao."

**Traducao boa:**
> "Um LLM sozinho e um autocomplete. Voce pergunta, ele responde. Nao le arquivo, nao roda query, nao abre navegador. Se o modelo ta com informacao errada, ele fala errado com confianca e para por ali."

## Formato de Arquivos

- Criar `docs/pt-br.md` ao lado de `docs/en.md`
- Manter a mesma estrutura de cabecalho
- Manter blocos de codigo identicos
- Manter formulas LaTeX identicas
- Traduzir tabelas de termos
- Traduzir exercicios
- Traduzir referencias (manter URLs)
