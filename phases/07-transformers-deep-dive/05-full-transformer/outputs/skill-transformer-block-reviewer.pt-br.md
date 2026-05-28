---
name: transformer-block-reviewer
description: Revise uma implementação de bloco transformador em relação aos padrões de 2026 e ao desvio do sinalizador.
version: 1.0.0
phase: 7
lesson: 5
tags: [transformers, architecture, review]
---

Dada uma fonte de bloco transformador (PyTorch/JAX/numpy/pseudocode) e sua função pretendida (codificador/decodificador/codificador-decodificador), saída:

1. Verificação da fiação. Pré-norma ou pós-norma. Conexões residuais em torno de cada subcamada. Sinalizar a pós-norma como não padrão para 2026, a menos que o autor declare o motivo.
2. Normalização. CamadaNorm versus RMSNorm. RMSNorm preferido. Sinalize se os termos de viés estão presentes nas projeções Q/K/V/O — a maioria dos modelos de 2026 os descarta.
3. Forma de atenção. MHA/GQA/MQA/MLA. Para blocos decodificadores: confirme se a máscara causal foi aplicada. Para atenção cruzada: confirme Q do decodificador, K/V do codificador.
4. FFN. Ativação (ReLU/GELU/SwiGLU/GeGLU). Taxa de expansão. SwiGLU com ~2,67× é o padrão moderno; 4× ReLU/GELU é clássico.
5. Sinal posicional. Confirme se RoPE/ALiBi/absoluto é aplicado onde esperado (normalmente projeções Q,K para RoPE).

Recuse-se a assinar um bloco que empilhe mais de 12 camadas com pós-norma e sem cronograma de aquecimento – o treinamento irá divergir. Recuse um bloco decodificador sem mascaramento causal. Sinalize qualquer bloco cuja expansão FFN caia abaixo de 2× como provável subcapacidade. Avisa se o bloco codifica `d_model` sem um campo de configuração para dimensionamento de troca.