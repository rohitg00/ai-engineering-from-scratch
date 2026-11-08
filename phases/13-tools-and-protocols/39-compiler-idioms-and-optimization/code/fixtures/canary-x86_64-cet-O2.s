	.text
	.section	.note.gnu.property,"a",@note
	.p2align	3, 0x0
	.long	4
	.long	16
	.long	5
	.asciz	"GNU"
	.long	3221225474
	.long	4
	.long	3
	.p2align	3, 0x0
	.text
	.file	"canary.c"
	.globl	with_canary                     # -- Begin function with_canary
	.p2align	4, 0x90
	.type	with_canary,@function
with_canary:                            # @with_canary
# %bb.0:
	endbr64
	subq	$72, %rsp
	movq	%rdi, %rsi
	movq	%rsp, %rdi
	movl	$63, %edx
	callq	strncpy@PLT
	movsbl	(%rsp), %eax
	addq	$72, %rsp
	retq
.Lfunc_end0:
	.size	with_canary, .Lfunc_end0-with_canary
                                        # -- End function
	.globl	plain_leaf                      # -- Begin function plain_leaf
	.p2align	4, 0x90
	.type	plain_leaf,@function
plain_leaf:                             # @plain_leaf
# %bb.0:
	endbr64
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
