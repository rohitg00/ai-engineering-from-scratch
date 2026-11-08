	.text
	.file	"dispatch.c"
	.globl	dispatch                        // -- Begin function dispatch
	.p2align	2
	.type	dispatch,@function
dispatch:                               // @dispatch
// %bb.0:
	cmp	w0, #15
	b.hi	.LBB0_18
// %bb.1:
	mov	w8, w0
	adrp	x9, .LJTI0_0
	add	x9, x9, :lo12:.LJTI0_0
	adr	x10, .LBB0_2
	ldrb	w11, [x9, x8]
	add	x10, x10, x11, lsl #2
	br	x10
.LBB0_2:
	mov	w0, w1
	b	f0
.LBB0_3:
	mov	w0, w1
	b	f14
.LBB0_4:
	mov	w0, w1
	b	f11
.LBB0_5:
	mov	w0, w1
	b	f4
.LBB0_6:
	mov	w0, w1
	b	f12
.LBB0_7:
	mov	w0, w1
	b	f9
.LBB0_8:
	mov	w0, w1
	b	f2
.LBB0_9:
	mov	w0, w1
	b	f15
.LBB0_10:
	mov	w0, w1
	b	f3
.LBB0_11:
	mov	w0, w1
	b	f7
.LBB0_12:
	mov	w0, w1
	b	f1
.LBB0_13:
	mov	w0, w1
	b	f5
.LBB0_14:
	mov	w0, w1
	b	f13
.LBB0_15:
	mov	w0, w1
	b	f6
.LBB0_16:
	mov	w0, w1
	b	f10
.LBB0_17:
	mov	w0, w1
	b	f8
.LBB0_18:
	mov	w0, #-1                         // =0xffffffff
	ret
.Lfunc_end0:
	.size	dispatch, .Lfunc_end0-dispatch
	.section	.rodata,"a",@progbits
.LJTI0_0:
	.byte	(.LBB0_2-.LBB0_2)>>2
	.byte	(.LBB0_12-.LBB0_2)>>2
	.byte	(.LBB0_8-.LBB0_2)>>2
	.byte	(.LBB0_10-.LBB0_2)>>2
	.byte	(.LBB0_5-.LBB0_2)>>2
	.byte	(.LBB0_13-.LBB0_2)>>2
	.byte	(.LBB0_15-.LBB0_2)>>2
	.byte	(.LBB0_11-.LBB0_2)>>2
	.byte	(.LBB0_17-.LBB0_2)>>2
	.byte	(.LBB0_7-.LBB0_2)>>2
	.byte	(.LBB0_16-.LBB0_2)>>2
	.byte	(.LBB0_4-.LBB0_2)>>2
	.byte	(.LBB0_6-.LBB0_2)>>2
	.byte	(.LBB0_14-.LBB0_2)>>2
	.byte	(.LBB0_3-.LBB0_2)>>2
	.byte	(.LBB0_9-.LBB0_2)>>2
                                        // -- End function
	.ident	"Apple clang version 17.0.0 (clang-1700.6.3.2)"
	.section	".note.GNU-stack","",@progbits
	.addrsig
