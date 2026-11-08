        .text
        .globl  lookup
        .type   lookup,@function
lookup:
        movslq  %edi, %rax
        leaq    .Ltable(%rip), %rcx
        movzbl  (%rcx,%rax), %eax
        jmp     .Ldone
.Ltable:
        .byte   0x31, 0xc0, 0x90, 0x48
.Ldone:
        addl    $1, %eax
        retq
.Lfunc_end0:
        .size   lookup, .Lfunc_end0-lookup

        .p2align 4, 0x90
        .globl  plus_one
        .type   plus_one,@function
plus_one:
        leal    1(%rdi), %eax
        retq
.Lfunc_end1:
        .size   plus_one, .Lfunc_end1-plus_one

        .section .note.GNU-stack,"",@progbits
