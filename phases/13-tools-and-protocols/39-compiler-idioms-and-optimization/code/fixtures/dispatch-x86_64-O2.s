	.text
	.file	"dispatch.c"
	.globl	dispatch                        # -- Begin function dispatch
	.p2align	4, 0x90
	.type	dispatch,@function
dispatch:                               # @dispatch
# %bb.0:
	cmpl	$15, %edi
	ja	.LBB0_18
# %bb.1:
	movl	%edi, %eax
	leaq	.LJTI0_0(%rip), %rcx
	movslq	(%rcx,%rax,4), %rax
	addq	%rcx, %rax
	jmpq	*%rax
.LBB0_2:
	movl	%esi, %edi
	jmp	f0@PLT                          # TAILCALL
.LBB0_16:
	movl	%esi, %edi
	jmp	f14@PLT                         # TAILCALL
.LBB0_13:
	movl	%esi, %edi
	jmp	f11@PLT                         # TAILCALL
.LBB0_6:
	movl	%esi, %edi
	jmp	f4@PLT                          # TAILCALL
.LBB0_14:
	movl	%esi, %edi
	jmp	f12@PLT                         # TAILCALL
.LBB0_11:
	movl	%esi, %edi
	jmp	f9@PLT                          # TAILCALL
.LBB0_4:
	movl	%esi, %edi
	jmp	f2@PLT                          # TAILCALL
.LBB0_17:
	movl	%esi, %edi
	jmp	f15@PLT                         # TAILCALL
.LBB0_5:
	movl	%esi, %edi
	jmp	f3@PLT                          # TAILCALL
.LBB0_9:
	movl	%esi, %edi
	jmp	f7@PLT                          # TAILCALL
.LBB0_3:
	movl	%esi, %edi
	jmp	f1@PLT                          # TAILCALL
.LBB0_7:
	movl	%esi, %edi
	jmp	f5@PLT                          # TAILCALL
.LBB0_15:
	movl	%esi, %edi
	jmp	f13@PLT                         # TAILCALL
.LBB0_8:
	movl	%esi, %edi
	jmp	f6@PLT                          # TAILCALL
.LBB0_12:
	movl	%esi, %edi
	jmp	f10@PLT                         # TAILCALL
.LBB0_10:
	movl	%esi, %edi
	jmp	f8@PLT                          # TAILCALL
.LBB0_18:
	movl	$-1, %eax
	retq
.Lfunc_end0:
	.size	dispatch, .Lfunc_end0-dispatch
	.section	.rodata,"a",@progbits
	.p2align	2, 0x0
.LJTI0_0:
	.long	.LBB0_2-.LJTI0_0
	.long	.LBB0_3-.LJTI0_0
	.long	.LBB0_4-.LJTI0_0
	.long	.LBB0_5-.LJTI0_0
	.long	.LBB0_6-.LJTI0_0
	.long	.LBB0_7-.LJTI0_0
	.long	.LBB0_8-.LJTI0_0
	.long	.LBB0_9-.LJTI0_0
	.long	.LBB0_10-.LJTI0_0
	.long	.LBB0_11-.LJTI0_0
	.long	.LBB0_12-.LJTI0_0
	.long	.LBB0_13-.LJTI0_0
	.long	.LBB0_14-.LJTI0_0
	.long	.LBB0_15-.LJTI0_0
	.long	.LBB0_16-.LJTI0_0
	.long	.LBB0_17-.LJTI0_0
                                        # -- End function
	.ident	"Apple clang version 17.0.0 (clang-1700.6.3.2)"
	.section	".note.GNU-stack","",@progbits
	.addrsig
