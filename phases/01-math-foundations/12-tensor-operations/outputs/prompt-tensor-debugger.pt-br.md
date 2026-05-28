---
name: prompt-tensor-debugger
description: Prompt passo a passo pra debugar erros de forma de tensor em codigo de deep learning
phase: 1
lesson: 12
---

Eu tenho um erro de forma de tensor no meu codigo de deep learning. Me ajude a corrigir.

**Mensagem de erro:** [cole o erro aqui]

**Minhas formas de tensor:**
- [nome]: [forma]
- [nome]: [forma]

**A operacao que estou tentando fazer:** [descreva-a]

---

Ao depurar, siga este processo exato:

**Passo 1: Identifique o tipo de operacao.**
Qual operacao produziu o erro? Mapeie pra uma dessas:
- Multiplicacao de matrizes / Camada Linear (dimensoes internas devem coincidir)
- Broadcasting (aline da direita, cada dim deve ser igual ou 1)
- Concatenacao (todas dims coincidem exceto a dim de cat)
- Convolution (espera rank e posicao de canal especificos)
- Reshape (elementos totais devem ser preservados)

**Passo 2: Escreva o contrato de forma.**
Pra operacao identificada, escreva as formas esperadas explicitamente:
```
matmul(A, B): A e (..., m, k), B e (..., k, n) -> (..., m, n)
broadcast(A, B): aline da direita, cada par deve ser (igual) ou (um e 1)
cat([A, B], dim=d): todas dims coincidem exceto dim d
Linear(in_f, out_f): ultima dim de input deve ser igual a in_f
Conv2d(in_c, out_c, k): input deve ser (B, in_c, H, W)
```

**Passo 3: Encontre o mismatch.**
Compare as formas reais contra o contrato. Identifique a dimensao exata que viola a regra.

**Passo 4: Escolha a correcao minima.**
Escolha dessa tabela:

| Sintoma | Correcao |
|---|---|
| Dimensao de batch ausente | `.unsqueeze(0)` |
| Dimensao de canal ausente | `.unsqueeze(1)` |
| Dimensao extra de tamanho 1 | `.squeeze(dim)` |
| Dims internas erradas pra matmul | `.transpose(-1, -2)` ou verifique a forma do peso |
| Precisa de NCHW de NHWC | `.permute(0, 3, 1, 2)` |
| Precisa de NHWC de NCHW | `.permute(0, 2, 3, 1)` |
| Achatar dims espaciais pra linear | `.flatten(1)` ou `.reshape(B, -1)` |
| Separar heads: (B,T,D) pra (B,H,T,D/H) | `.reshape(B, T, H, D//H).transpose(1, 2)` |
| Unir heads: (B,H,T,D/H) pra (B,T,D) | `.transpose(1, 2).reshape(B, T, H*(D//H))`
| Tensor nao-contiguo com .view() | `.contiguous().view(...)` ou use `.reshape(...)` |

**Passo 5: Verifique a correcao.**
Mostre as formas resultantes em cada passo. Confirme que o total de elementos e preservado em qualquer reshape. Confirme que o contrato de forma da operacao agora e satisfeito.

**Passo 6: Verifique bugs silenciosos.**
Mesmo que as formas coincidam, verifique:
- Broadcasting esta acontecendo no eixo pretendido (nao acidentalmente)
- Reducao esta somando na dimensao certa
- A dimensao de batch (dim 0) sobrevive por todo o forward pass
- Transpose + reshape e usado (nao so reshape) quando a ordem das dimensoes importa

Formate sua resposta como:
```
OPERACAO: [qual operacao falhou]
ESPERADO: [contrato de forma]
REAL: [quais formas foram fornecidas]
MISMATCH: [qual dimensao, por que]
CORRECAO: [codigo exato]
RESULTADO: [formas apos correcao]
```
