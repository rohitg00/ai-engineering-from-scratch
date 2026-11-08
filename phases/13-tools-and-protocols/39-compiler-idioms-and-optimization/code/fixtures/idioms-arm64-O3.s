	.text
	.file	"idioms.c"
	.globl	div10u                          // -- Begin function div10u
	.p2align	2
	.type	div10u,@function
div10u:                                 // @div10u
// %bb.0:
	mov	w8, #52429                      // =0xcccd
	movk	w8, #52428, lsl #16
	umull	x8, w0, w8
	lsr	x0, x8, #35
                                        // kill: def $w0 killed $w0 killed $x0
	ret
.Lfunc_end0:
	.size	div10u, .Lfunc_end0-div10u
                                        // -- End function
	.globl	div10s                          // -- Begin function div10s
	.p2align	2
	.type	div10s,@function
div10s:                                 // @div10s
// %bb.0:
	mov	w8, #26215                      // =0x6667
	movk	w8, #26214, lsl #16
	smull	x8, w0, w8
	lsr	x9, x8, #63
	asr	x8, x8, #34
	add	w0, w8, w9
	ret
.Lfunc_end1:
	.size	div10s, .Lfunc_end1-div10s
                                        // -- End function
	.globl	div7u                           // -- Begin function div7u
	.p2align	2
	.type	div7u,@function
div7u:                                  // @div7u
// %bb.0:
	mov	w8, #18725                      // =0x4925
	movk	w8, #9362, lsl #16
	umull	x8, w0, w8
	lsr	x8, x8, #32
	sub	w9, w0, w8
	add	w8, w8, w9, lsr #1
	lsr	w0, w8, #2
	ret
.Lfunc_end2:
	.size	div7u, .Lfunc_end2-div7u
                                        // -- End function
	.globl	div3s                           // -- Begin function div3s
	.p2align	2
	.type	div3s,@function
div3s:                                  // @div3s
// %bb.0:
	mov	w8, #21846                      // =0x5556
	movk	w8, #21845, lsl #16
	smull	x8, w0, w8
	lsr	x9, x8, #63
	lsr	x8, x8, #32
	add	w0, w8, w9
	ret
.Lfunc_end3:
	.size	div3s, .Lfunc_end3-div3s
                                        // -- End function
	.globl	mod10s                          // -- Begin function mod10s
	.p2align	2
	.type	mod10s,@function
mod10s:                                 // @mod10s
// %bb.0:
	mov	w8, #26215                      // =0x6667
	movk	w8, #26214, lsl #16
	smull	x8, w0, w8
	lsr	x9, x8, #63
	asr	x8, x8, #34
	add	w8, w8, w9
	mov	w9, #10                         // =0xa
	msub	w0, w8, w9, w0
	ret
.Lfunc_end4:
	.size	mod10s, .Lfunc_end4-mod10s
                                        // -- End function
	.globl	mod8s                           // -- Begin function mod8s
	.p2align	2
	.type	mod8s,@function
mod8s:                                  // @mod8s
// %bb.0:
	negs	w8, w0
	and	w9, w0, #0x7
	and	w8, w8, #0x7
	csneg	w0, w9, w8, mi
	ret
.Lfunc_end5:
	.size	mod8s, .Lfunc_end5-mod8s
                                        // -- End function
	.globl	mul9                            // -- Begin function mul9
	.p2align	2
	.type	mul9,@function
mul9:                                   // @mul9
// %bb.0:
	add	w0, w0, w0, lsl #3
	ret
.Lfunc_end6:
	.size	mul9, .Lfunc_end6-mul9
                                        // -- End function
	.globl	linear_switch                   // -- Begin function linear_switch
	.p2align	2
	.type	linear_switch,@function
linear_switch:                          // @linear_switch
// %bb.0:
	mov	w8, #10                         // =0xa
	mov	w9, #10                         // =0xa
	cmp	w0, #7
	madd	w8, w0, w8, w9
	csinv	w0, w8, wzr, lo
	ret
.Lfunc_end7:
	.size	linear_switch, .Lfunc_end7-linear_switch
                                        // -- End function
	.globl	table_switch                    // -- Begin function table_switch
	.p2align	2
	.type	table_switch,@function
table_switch:                           // @table_switch
// %bb.0:
	cmp	w0, #6
	b.hi	.LBB8_2
// %bb.1:
	adrp	x8, .Lswitch.table.table_switch
	add	x8, x8, :lo12:.Lswitch.table.table_switch
	ldr	w0, [x8, w0, uxtw #2]
	ret
.LBB8_2:
	mov	w0, #-1                         // =0xffffffff
	ret
.Lfunc_end8:
	.size	table_switch, .Lfunc_end8-table_switch
                                        // -- End function
	.globl	call_switch                     // -- Begin function call_switch
	.p2align	2
	.type	call_switch,@function
call_switch:                            // @call_switch
// %bb.0:
	cmp	w0, #1
	b.le	.LBB9_5
// %bb.1:
	cmp	w0, #2
	mov	x1, x3
	b.eq	.LBB9_7
// %bb.2:
	cmp	w0, #3
	mov	x1, x4
	b.eq	.LBB9_7
// %bb.3:
	cmp	w0, #4
	b.ne	.LBB9_8
// %bb.4:
	br	x5
.LBB9_5:
	cbz	w0, .LBB9_7
// %bb.6:
	cmp	w0, #1
	mov	x1, x2
	b.ne	.LBB9_8
.LBB9_7:
	br	x1
.LBB9_8:
	ret
.Lfunc_end9:
	.size	call_switch, .Lfunc_end9-call_switch
                                        // -- End function
	.globl	sparse_switch                   // -- Begin function sparse_switch
	.p2align	2
	.type	sparse_switch,@function
sparse_switch:                          // @sparse_switch
// %bb.0:
	mov	w8, #9999                       // =0x270f
	cmp	w0, w8
	b.le	.LBB10_5
// %bb.1:
	mov	w8, #10000                      // =0x2710
	cmp	w0, w8
	b.eq	.LBB10_8
// %bb.2:
	mov	w8, #16960                      // =0x4240
	movk	w8, #15, lsl #16
	cmp	w0, w8
	b.eq	.LBB10_9
// %bb.3:
	mov	w8, #57600                      // =0xe100
	movk	w8, #1525, lsl #16
	cmp	w0, w8
	b.ne	.LBB10_10
// %bb.4:
	mov	w0, #5                          // =0x5
	ret
.LBB10_5:
	cmp	w0, #1
	b.eq	.LBB10_11
// %bb.6:
	cmp	w0, #100
	b.ne	.LBB10_10
// %bb.7:
	mov	w0, #2                          // =0x2
	ret
.LBB10_8:
	mov	w0, #3                          // =0x3
	ret
.LBB10_9:
	mov	w0, #4                          // =0x4
	ret
.LBB10_10:
	mov	w0, wzr
.LBB10_11:
	ret
.Lfunc_end10:
	.size	sparse_switch, .Lfunc_end10-sparse_switch
                                        // -- End function
	.globl	two_cases                       // -- Begin function two_cases
	.p2align	2
	.type	two_cases,@function
two_cases:                              // @two_cases
// %bb.0:
	mov	w8, #9                          // =0x9
	cmp	w0, #4
	mov	w9, #7                          // =0x7
	csel	w8, w8, wzr, eq
	cmp	w0, #3
	csel	w0, w9, w8, eq
	ret
.Lfunc_end11:
	.size	two_cases, .Lfunc_end11-two_cases
                                        // -- End function
	.globl	clamp_max                       // -- Begin function clamp_max
	.p2align	2
	.type	clamp_max,@function
clamp_max:                              // @clamp_max
// %bb.0:
	cmp	w0, w1
	csel	w0, w0, w1, gt
	ret
.Lfunc_end12:
	.size	clamp_max, .Lfunc_end12-clamp_max
                                        // -- End function
	.globl	abs_int                         // -- Begin function abs_int
	.p2align	2
	.type	abs_int,@function
abs_int:                                // @abs_int
// %bb.0:
	cmp	w0, #0
	cneg	w0, w0, mi
	ret
.Lfunc_end13:
	.size	abs_int, .Lfunc_end13-abs_int
                                        // -- End function
	.globl	is_pos                          // -- Begin function is_pos
	.p2align	2
	.type	is_pos,@function
is_pos:                                 // @is_pos
// %bb.0:
	cmp	w0, #0
	cset	w0, gt
	ret
.Lfunc_end14:
	.size	is_pos, .Lfunc_end14-is_pos
                                        // -- End function
	.globl	tail_caller                     // -- Begin function tail_caller
	.p2align	2
	.type	tail_caller,@function
tail_caller:                            // @tail_caller
// %bb.0:
	add	w0, w0, #1
	b	tail_target
.Lfunc_end15:
	.size	tail_caller, .Lfunc_end15-tail_caller
                                        // -- End function
	.globl	leaf_add                        // -- Begin function leaf_add
	.p2align	2
	.type	leaf_add,@function
leaf_add:                               // @leaf_add
// %bb.0:
	add	w0, w1, w0
	ret
.Lfunc_end16:
	.size	leaf_add, .Lfunc_end16-leaf_add
                                        // -- End function
	.globl	twice_sum                       // -- Begin function twice_sum
	.p2align	2
	.type	twice_sum,@function
twice_sum:                              // @twice_sum
// %bb.0:
	add	w8, w1, w0
	lsl	w0, w8, #1
	ret
.Lfunc_end17:
	.size	twice_sum, .Lfunc_end17-twice_sum
                                        // -- End function
	.globl	sum_n                           // -- Begin function sum_n
	.p2align	2
	.type	sum_n,@function
sum_n:                                  // @sum_n
// %bb.0:
	cmp	w1, #1
	b.lt	.LBB18_3
// %bb.1:
	cmp	w1, #7
	mov	w9, w1
	b.hi	.LBB18_4
// %bb.2:
	mov	x10, xzr
	mov	w8, wzr
	b	.LBB18_7
.LBB18_3:
	mov	w8, wzr
	mov	w0, w8
	ret
.LBB18_4:
	movi	v0.2d, #0000000000000000
	movi	v1.2d, #0000000000000000
	and	x10, x9, #0x7ffffff8
	add	x8, x0, #16
	mov	x11, x10
.LBB18_5:                               // =>This Inner Loop Header: Depth=1
	ldp	q2, q3, [x8, #-16]
	subs	x11, x11, #8
	add	x8, x8, #32
	add	v0.4s, v2.4s, v0.4s
	add	v1.4s, v3.4s, v1.4s
	b.ne	.LBB18_5
// %bb.6:
	add	v0.4s, v1.4s, v0.4s
	cmp	x10, x9
	addv	s0, v0.4s
	fmov	w8, s0
	b.eq	.LBB18_9
.LBB18_7:
	add	x11, x0, x10, lsl #2
	sub	x9, x9, x10
.LBB18_8:                               // =>This Inner Loop Header: Depth=1
	ldr	w10, [x11], #4
	subs	x9, x9, #1
	add	w8, w10, w8
	b.ne	.LBB18_8
.LBB18_9:
	mov	w0, w8
	ret
.Lfunc_end18:
	.size	sum_n, .Lfunc_end18-sum_n
                                        // -- End function
	.globl	sum4                            // -- Begin function sum4
	.p2align	2
	.type	sum4,@function
sum4:                                   // @sum4
// %bb.0:
	ldr	q0, [x0]
	addv	s0, v0.4s
	fmov	w0, s0
	ret
.Lfunc_end19:
	.size	sum4, .Lfunc_end19-sum4
                                        // -- End function
	.globl	poly8                           // -- Begin function poly8
	.p2align	2
	.type	poly8,@function
poly8:                                  // @poly8
// %bb.0:
	ldp	w8, w9, [x0]
	sub	w9, w9, w8
	add	w8, w9, w8, lsl #5
	ldp	w9, w10, [x0, #8]
	sub	w9, w9, w8
	add	w8, w9, w8, lsl #5
	sub	w9, w10, w8
	add	w8, w9, w8, lsl #5
	ldp	w9, w10, [x0, #16]
	sub	w9, w9, w8
	add	w8, w9, w8, lsl #5
	sub	w9, w10, w8
	add	w8, w9, w8, lsl #5
	ldp	w9, w10, [x0, #24]
	sub	w9, w9, w8
	add	w8, w9, w8, lsl #5
	sub	w9, w10, w8
	add	w0, w9, w8, lsl #5
	ret
.Lfunc_end20:
	.size	poly8, .Lfunc_end20-poly8
                                        // -- End function
	.globl	fill                            // -- Begin function fill
	.p2align	2
	.type	fill,@function
fill:                                   // @fill
// %bb.0:
	cmp	w1, #1
	b.lt	.LBB21_2
// %bb.1:
	mov	w2, w1
	mov	w1, wzr
	b	memset
.LBB21_2:
	ret
.Lfunc_end21:
	.size	fill, .Lfunc_end21-fill
                                        // -- End function
	.globl	copy_n                          // -- Begin function copy_n
	.p2align	2
	.type	copy_n,@function
copy_n:                                 // @copy_n
// %bb.0:
	b	memcpy
.Lfunc_end22:
	.size	copy_n, .Lfunc_end22-copy_n
                                        // -- End function
	.globl	copy16                          // -- Begin function copy16
	.p2align	2
	.type	copy16,@function
copy16:                                 // @copy16
// %bb.0:
	ldr	q0, [x1]
	str	q0, [x0]
	ret
.Lfunc_end23:
	.size	copy16, .Lfunc_end23-copy16
                                        // -- End function
	.globl	digest                          // -- Begin function digest
	.p2align	2
	.type	digest,@function
digest:                                 // @digest
// %bb.0:
	cmp	w1, #1
	b.lt	.LBB24_3
// %bb.1:
	cmp	w1, #7
	mov	w9, w1
	b.hi	.LBB24_5
// %bb.2:
	mov	x10, xzr
	mov	w8, wzr
	b	.LBB24_8
.LBB24_3:
	mov	w8, wzr
.LBB24_4:
	mov	w9, wzr
	b	.LBB24_19
.LBB24_5:
	movi	v0.2d, #0000000000000000
	movi	v1.2d, #0000000000000000
	and	x10, x9, #0x7ffffff8
	add	x8, x0, #16
	mov	x11, x10
.LBB24_6:                               // =>This Inner Loop Header: Depth=1
	ldp	q2, q3, [x8, #-16]
	subs	x11, x11, #8
	add	x8, x8, #32
	add	v0.4s, v2.4s, v0.4s
	add	v1.4s, v3.4s, v1.4s
	b.ne	.LBB24_6
// %bb.7:
	add	v0.4s, v1.4s, v0.4s
	cmp	x10, x9
	addv	s0, v0.4s
	fmov	w8, s0
	b.eq	.LBB24_10
.LBB24_8:
	add	x11, x0, x10, lsl #2
	sub	x9, x9, x10
.LBB24_9:                               // =>This Inner Loop Header: Depth=1
	ldr	w10, [x11], #4
	subs	x9, x9, #1
	add	w8, w10, w8
	b.ne	.LBB24_9
.LBB24_10:
	mov	w9, #26215                      // =0x6667
	movk	w9, #26214, lsl #16
	smull	x9, w8, w9
	lsr	x10, x9, #63
	asr	x9, x9, #34
	add	w9, w9, w10
	cmp	w9, #8
	b.gt	.LBB24_15
// %bb.11:
	cmp	w9, #6
	b.eq	.LBB24_17
// %bb.12:
	cmp	w9, #7
	b.eq	.LBB24_18
// %bb.13:
	cmp	w9, #8
	b.ne	.LBB24_4
// %bb.14:
	mov	w9, #64                         // =0x40
	b	.LBB24_19
.LBB24_15:
	sub	w9, w9, #9
	cmp	w9, #2
	b.hs	.LBB24_4
// %bb.16:
	mov	w9, #128                        // =0x80
	b	.LBB24_19
.LBB24_17:
	mov	w9, #16                         // =0x10
	b	.LBB24_19
.LBB24_18:
	mov	w9, #32                         // =0x20
.LBB24_19:
	mov	w10, #26215                     // =0x6667
	movk	w10, #26214, lsl #16
	smull	x10, w8, w10
	lsr	x11, x10, #63
	asr	x10, x10, #34
	add	w10, w10, w11
	mov	w11, #10                        // =0xa
	msub	w8, w10, w11, w8
	mov	w10, #5                         // =0x5
	cmp	w8, #5
	csel	w8, w8, w10, lt
	add	w0, w9, w8
	ret
.Lfunc_end24:
	.size	digest, .Lfunc_end24-digest
                                        // -- End function
	.type	.Lswitch.table.table_switch,@object // @switch.table.table_switch
	.section	.rodata,"a",@progbits
	.p2align	2, 0x0
.Lswitch.table.table_switch:
	.word	10                              // 0xa
	.word	20                              // 0x14
	.word	30                              // 0x1e
	.word	40                              // 0x28
	.word	50                              // 0x32
	.word	60                              // 0x3c
	.word	71                              // 0x47
	.size	.Lswitch.table.table_switch, 28

	.ident	"Apple clang version 17.0.0 (clang-1700.6.3.2)"
	.section	".note.GNU-stack","",@progbits
	.addrsig
