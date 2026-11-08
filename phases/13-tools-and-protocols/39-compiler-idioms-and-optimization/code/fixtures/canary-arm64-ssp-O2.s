	.text
	.file	"canary.c"
	.globl	with_canary                     // -- Begin function with_canary
	.p2align	2
	.type	with_canary,@function
with_canary:                            // @with_canary
// %bb.0:
	sub	sp, sp, #96
	stp	x29, x30, [sp, #80]             // 16-byte Folded Spill
	adrp	x8, :got:__stack_chk_guard
	add	x29, sp, #80
	ldr	x8, [x8, :got_lo12:__stack_chk_guard]
	mov	x1, x0
	add	x0, sp, #8
	mov	w2, #63                         // =0x3f
	ldr	x8, [x8]
	stur	x8, [x29, #-8]
	bl	strncpy
	adrp	x8, :got:__stack_chk_guard
	ldr	x8, [x8, :got_lo12:__stack_chk_guard]
	ldrb	w0, [sp, #8]
	ldur	x9, [x29, #-8]
	ldr	x8, [x8]
	cmp	x8, x9
	b.ne	.LBB0_2
// %bb.1:
	ldp	x29, x30, [sp, #80]             // 16-byte Folded Reload
	add	sp, sp, #96
	ret
.LBB0_2:
	bl	__stack_chk_fail
.Lfunc_end0:
	.size	with_canary, .Lfunc_end0-with_canary
                                        // -- End function
	.globl	plain_leaf                      // -- Begin function plain_leaf
	.p2align	2
	.type	plain_leaf,@function
plain_leaf:                             // @plain_leaf
// %bb.0:
	mov	w8, #1                          // =0x1
	madd	w0, w1, w0, w8
	ret
.Lfunc_end1:
	.size	plain_leaf, .Lfunc_end1-plain_leaf
                                        // -- End function
	.ident	"Apple clang version 17.0.0 (clang-1700.6.3.2)"
	.section	".note.GNU-stack","",@progbits
	.addrsig
