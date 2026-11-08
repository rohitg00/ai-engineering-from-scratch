	.text
	.file	"canary.c"
	.globl	with_canary                     # -- Begin function with_canary
	.p2align	4, 0x90
	.type	with_canary,@function
with_canary:                            # @with_canary
# %bb.0:
	subq	$72, %rsp
	movq	%rdi, %rsi
	movq	%fs:40, %rax
	movq	%rax, 64(%rsp)
	movq	%rsp, %rdi
	movl	$63, %edx
	callq	strncpy@PLT
	movsbl	(%rsp), %eax
	movq	%fs:40, %rcx
	cmpq	64(%rsp), %rcx
	jne	.LBB0_2
# %bb.1:
	addq	$72, %rsp
	retq
.LBB0_2:
	callq	__stack_chk_fail@PLT
.Lfunc_end0:
	.size	with_canary, .Lfunc_end0-with_canary
                                        # -- End function
	.globl	plain_leaf                      # -- Begin function plain_leaf
	.p2align	4, 0x90
	.type	plain_leaf,@function
plain_leaf:                             # @plain_leaf
# %bb.0:
                                        # kill: def $edi killed $edi def $rdi
	imull	%esi, %edi
	leal	1(%rdi), %eax
	retq
.Lfunc_end1:
	.size	plain_leaf, .Lfunc_end1-plain_leaf
                                        # -- End function
	.ident	"Apple clang version 17.0.0 (clang-1700.6.3.2)"
	.section	".note.GNU-stack","",@progbits
	.addrsig
	.addrsig_sym __stack_chk_fail
