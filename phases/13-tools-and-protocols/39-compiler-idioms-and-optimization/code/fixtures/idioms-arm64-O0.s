	.text
	.file	"idioms.c"
	.globl	div10u                          // -- Begin function div10u
	.p2align	2
	.type	div10u,@function
div10u:                                 // @div10u
// %bb.0:
	sub	sp, sp, #16
	str	w0, [sp, #12]
	ldr	w8, [sp, #12]
	mov	w9, #10                         // =0xa
	udiv	w0, w8, w9
	add	sp, sp, #16
	ret
.Lfunc_end0:
	.size	div10u, .Lfunc_end0-div10u
                                        // -- End function
	.globl	div10s                          // -- Begin function div10s
	.p2align	2
	.type	div10s,@function
div10s:                                 // @div10s
// %bb.0:
	sub	sp, sp, #16
	str	w0, [sp, #12]
	ldr	w8, [sp, #12]
	mov	w9, #10                         // =0xa
	sdiv	w0, w8, w9
	add	sp, sp, #16
	ret
.Lfunc_end1:
	.size	div10s, .Lfunc_end1-div10s
                                        // -- End function
	.globl	div7u                           // -- Begin function div7u
	.p2align	2
	.type	div7u,@function
div7u:                                  // @div7u
// %bb.0:
	sub	sp, sp, #16
	str	w0, [sp, #12]
	ldr	w8, [sp, #12]
	mov	w9, #7                          // =0x7
	udiv	w0, w8, w9
	add	sp, sp, #16
	ret
.Lfunc_end2:
	.size	div7u, .Lfunc_end2-div7u
                                        // -- End function
	.globl	div3s                           // -- Begin function div3s
	.p2align	2
	.type	div3s,@function
div3s:                                  // @div3s
// %bb.0:
	sub	sp, sp, #16
	str	w0, [sp, #12]
	ldr	w8, [sp, #12]
	mov	w9, #3                          // =0x3
	sdiv	w0, w8, w9
	add	sp, sp, #16
	ret
.Lfunc_end3:
	.size	div3s, .Lfunc_end3-div3s
                                        // -- End function
	.globl	mod10s                          // -- Begin function mod10s
	.p2align	2
	.type	mod10s,@function
mod10s:                                 // @mod10s
// %bb.0:
	sub	sp, sp, #16
	str	w0, [sp, #12]
	ldr	w8, [sp, #12]
	mov	w10, #10                        // =0xa
	sdiv	w9, w8, w10
	mul	w9, w9, w10
	subs	w0, w8, w9
	add	sp, sp, #16
	ret
.Lfunc_end4:
	.size	mod10s, .Lfunc_end4-mod10s
                                        // -- End function
	.globl	mod8s                           // -- Begin function mod8s
	.p2align	2
	.type	mod8s,@function
mod8s:                                  // @mod8s
// %bb.0:
	sub	sp, sp, #16
	str	w0, [sp, #12]
	ldr	w8, [sp, #12]
	mov	w10, #8                         // =0x8
	sdiv	w9, w8, w10
	mul	w9, w9, w10
	subs	w0, w8, w9
	add	sp, sp, #16
	ret
.Lfunc_end5:
	.size	mod8s, .Lfunc_end5-mod8s
                                        // -- End function
	.globl	mul9                            // -- Begin function mul9
	.p2align	2
	.type	mul9,@function
mul9:                                   // @mul9
// %bb.0:
	sub	sp, sp, #16
	str	w0, [sp, #12]
	ldr	w8, [sp, #12]
	mov	w9, #9                          // =0x9
	mul	w0, w8, w9
	add	sp, sp, #16
	ret
.Lfunc_end6:
	.size	mul9, .Lfunc_end6-mul9
                                        // -- End function
	.globl	linear_switch                   // -- Begin function linear_switch
	.p2align	2
	.type	linear_switch,@function
linear_switch:                          // @linear_switch
// %bb.0:
	sub	sp, sp, #16
	str	w0, [sp, #8]
	ldr	w8, [sp, #8]
	str	w8, [sp, #4]                    // 4-byte Folded Spill
	cbz	w8, .LBB7_7
	b	.LBB7_1
.LBB7_1:
	ldr	w8, [sp, #4]                    // 4-byte Folded Reload
	subs	w8, w8, #1
	b.eq	.LBB7_8
	b	.LBB7_2
.LBB7_2:
	ldr	w8, [sp, #4]                    // 4-byte Folded Reload
	subs	w8, w8, #2
	b.eq	.LBB7_9
	b	.LBB7_3
.LBB7_3:
	ldr	w8, [sp, #4]                    // 4-byte Folded Reload
	subs	w8, w8, #3
	b.eq	.LBB7_10
	b	.LBB7_4
.LBB7_4:
	ldr	w8, [sp, #4]                    // 4-byte Folded Reload
	subs	w8, w8, #4
	b.eq	.LBB7_11
	b	.LBB7_5
.LBB7_5:
	ldr	w8, [sp, #4]                    // 4-byte Folded Reload
	subs	w8, w8, #5
	b.eq	.LBB7_12
	b	.LBB7_6
.LBB7_6:
	ldr	w8, [sp, #4]                    // 4-byte Folded Reload
	subs	w8, w8, #6
	b.eq	.LBB7_13
	b	.LBB7_14
.LBB7_7:
	mov	w8, #10                         // =0xa
	str	w8, [sp, #12]
	b	.LBB7_15
.LBB7_8:
	mov	w8, #20                         // =0x14
	str	w8, [sp, #12]
	b	.LBB7_15
.LBB7_9:
	mov	w8, #30                         // =0x1e
	str	w8, [sp, #12]
	b	.LBB7_15
.LBB7_10:
	mov	w8, #40                         // =0x28
	str	w8, [sp, #12]
	b	.LBB7_15
.LBB7_11:
	mov	w8, #50                         // =0x32
	str	w8, [sp, #12]
	b	.LBB7_15
.LBB7_12:
	mov	w8, #60                         // =0x3c
	str	w8, [sp, #12]
	b	.LBB7_15
.LBB7_13:
	mov	w8, #70                         // =0x46
	str	w8, [sp, #12]
	b	.LBB7_15
.LBB7_14:
	mov	w8, #-1                         // =0xffffffff
	str	w8, [sp, #12]
	b	.LBB7_15
.LBB7_15:
	ldr	w0, [sp, #12]
	add	sp, sp, #16
	ret
.Lfunc_end7:
	.size	linear_switch, .Lfunc_end7-linear_switch
                                        // -- End function
	.globl	table_switch                    // -- Begin function table_switch
	.p2align	2
	.type	table_switch,@function
table_switch:                           // @table_switch
// %bb.0:
	sub	sp, sp, #16
	str	w0, [sp, #8]
	ldr	w8, [sp, #8]
	str	w8, [sp, #4]                    // 4-byte Folded Spill
	cbz	w8, .LBB8_7
	b	.LBB8_1
.LBB8_1:
	ldr	w8, [sp, #4]                    // 4-byte Folded Reload
	subs	w8, w8, #1
	b.eq	.LBB8_8
	b	.LBB8_2
.LBB8_2:
	ldr	w8, [sp, #4]                    // 4-byte Folded Reload
	subs	w8, w8, #2
	b.eq	.LBB8_9
	b	.LBB8_3
.LBB8_3:
	ldr	w8, [sp, #4]                    // 4-byte Folded Reload
	subs	w8, w8, #3
	b.eq	.LBB8_10
	b	.LBB8_4
.LBB8_4:
	ldr	w8, [sp, #4]                    // 4-byte Folded Reload
	subs	w8, w8, #4
	b.eq	.LBB8_11
	b	.LBB8_5
.LBB8_5:
	ldr	w8, [sp, #4]                    // 4-byte Folded Reload
	subs	w8, w8, #5
	b.eq	.LBB8_12
	b	.LBB8_6
.LBB8_6:
	ldr	w8, [sp, #4]                    // 4-byte Folded Reload
	subs	w8, w8, #6
	b.eq	.LBB8_13
	b	.LBB8_14
.LBB8_7:
	mov	w8, #10                         // =0xa
	str	w8, [sp, #12]
	b	.LBB8_15
.LBB8_8:
	mov	w8, #20                         // =0x14
	str	w8, [sp, #12]
	b	.LBB8_15
.LBB8_9:
	mov	w8, #30                         // =0x1e
	str	w8, [sp, #12]
	b	.LBB8_15
.LBB8_10:
	mov	w8, #40                         // =0x28
	str	w8, [sp, #12]
	b	.LBB8_15
.LBB8_11:
	mov	w8, #50                         // =0x32
	str	w8, [sp, #12]
	b	.LBB8_15
.LBB8_12:
	mov	w8, #60                         // =0x3c
	str	w8, [sp, #12]
	b	.LBB8_15
.LBB8_13:
	mov	w8, #71                         // =0x47
	str	w8, [sp, #12]
	b	.LBB8_15
.LBB8_14:
	mov	w8, #-1                         // =0xffffffff
	str	w8, [sp, #12]
	b	.LBB8_15
.LBB8_15:
	ldr	w0, [sp, #12]
	add	sp, sp, #16
	ret
.Lfunc_end8:
	.size	table_switch, .Lfunc_end8-table_switch
                                        // -- End function
	.globl	call_switch                     // -- Begin function call_switch
	.p2align	2
	.type	call_switch,@function
call_switch:                            // @call_switch
// %bb.0:
	sub	sp, sp, #80
	stp	x29, x30, [sp, #64]             // 16-byte Folded Spill
	add	x29, sp, #64
	stur	w0, [x29, #-4]
	stur	x1, [x29, #-16]
	stur	x2, [x29, #-24]
	str	x3, [sp, #32]
	str	x4, [sp, #24]
	str	x5, [sp, #16]
	ldur	w8, [x29, #-4]
	str	w8, [sp, #12]                   // 4-byte Folded Spill
	cbz	w8, .LBB9_5
	b	.LBB9_1
.LBB9_1:
	ldr	w8, [sp, #12]                   // 4-byte Folded Reload
	subs	w8, w8, #1
	b.eq	.LBB9_6
	b	.LBB9_2
.LBB9_2:
	ldr	w8, [sp, #12]                   // 4-byte Folded Reload
	subs	w8, w8, #2
	b.eq	.LBB9_7
	b	.LBB9_3
.LBB9_3:
	ldr	w8, [sp, #12]                   // 4-byte Folded Reload
	subs	w8, w8, #3
	b.eq	.LBB9_8
	b	.LBB9_4
.LBB9_4:
	ldr	w8, [sp, #12]                   // 4-byte Folded Reload
	subs	w8, w8, #4
	b.eq	.LBB9_9
	b	.LBB9_10
.LBB9_5:
	ldur	x8, [x29, #-16]
	blr	x8
	b	.LBB9_11
.LBB9_6:
	ldur	x8, [x29, #-24]
	blr	x8
	b	.LBB9_11
.LBB9_7:
	ldr	x8, [sp, #32]
	blr	x8
	b	.LBB9_11
.LBB9_8:
	ldr	x8, [sp, #24]
	blr	x8
	b	.LBB9_11
.LBB9_9:
	ldr	x8, [sp, #16]
	blr	x8
	b	.LBB9_11
.LBB9_10:
	b	.LBB9_11
.LBB9_11:
	ldp	x29, x30, [sp, #64]             // 16-byte Folded Reload
	add	sp, sp, #80
	ret
.Lfunc_end9:
	.size	call_switch, .Lfunc_end9-call_switch
                                        // -- End function
	.globl	sparse_switch                   // -- Begin function sparse_switch
	.p2align	2
	.type	sparse_switch,@function
sparse_switch:                          // @sparse_switch
// %bb.0:
	sub	sp, sp, #16
	str	w0, [sp, #8]
	ldr	w8, [sp, #8]
	str	w8, [sp, #4]                    // 4-byte Folded Spill
	subs	w8, w8, #1
	b.eq	.LBB10_5
	b	.LBB10_1
.LBB10_1:
	ldr	w8, [sp, #4]                    // 4-byte Folded Reload
	subs	w8, w8, #100
	b.eq	.LBB10_6
	b	.LBB10_2
.LBB10_2:
	ldr	w8, [sp, #4]                    // 4-byte Folded Reload
	mov	w9, #10000                      // =0x2710
	subs	w8, w8, w9
	b.eq	.LBB10_7
	b	.LBB10_3
.LBB10_3:
	ldr	w8, [sp, #4]                    // 4-byte Folded Reload
	mov	w9, #16960                      // =0x4240
	movk	w9, #15, lsl #16
	subs	w8, w8, w9
	b.eq	.LBB10_8
	b	.LBB10_4
.LBB10_4:
	ldr	w8, [sp, #4]                    // 4-byte Folded Reload
	mov	w9, #57600                      // =0xe100
	movk	w9, #1525, lsl #16
	subs	w8, w8, w9
	b.eq	.LBB10_9
	b	.LBB10_10
.LBB10_5:
	mov	w8, #1                          // =0x1
	str	w8, [sp, #12]
	b	.LBB10_11
.LBB10_6:
	mov	w8, #2                          // =0x2
	str	w8, [sp, #12]
	b	.LBB10_11
.LBB10_7:
	mov	w8, #3                          // =0x3
	str	w8, [sp, #12]
	b	.LBB10_11
.LBB10_8:
	mov	w8, #4                          // =0x4
	str	w8, [sp, #12]
	b	.LBB10_11
.LBB10_9:
	mov	w8, #5                          // =0x5
	str	w8, [sp, #12]
	b	.LBB10_11
.LBB10_10:
	str	wzr, [sp, #12]
	b	.LBB10_11
.LBB10_11:
	ldr	w0, [sp, #12]
	add	sp, sp, #16
	ret
.Lfunc_end10:
	.size	sparse_switch, .Lfunc_end10-sparse_switch
                                        // -- End function
	.globl	two_cases                       // -- Begin function two_cases
	.p2align	2
	.type	two_cases,@function
two_cases:                              // @two_cases
// %bb.0:
	sub	sp, sp, #16
	str	w0, [sp, #8]
	ldr	w8, [sp, #8]
	str	w8, [sp, #4]                    // 4-byte Folded Spill
	subs	w8, w8, #3
	b.eq	.LBB11_2
	b	.LBB11_1
.LBB11_1:
	ldr	w8, [sp, #4]                    // 4-byte Folded Reload
	subs	w8, w8, #4
	b.eq	.LBB11_3
	b	.LBB11_4
.LBB11_2:
	mov	w8, #7                          // =0x7
	str	w8, [sp, #12]
	b	.LBB11_5
.LBB11_3:
	mov	w8, #9                          // =0x9
	str	w8, [sp, #12]
	b	.LBB11_5
.LBB11_4:
	str	wzr, [sp, #12]
	b	.LBB11_5
.LBB11_5:
	ldr	w0, [sp, #12]
	add	sp, sp, #16
	ret
.Lfunc_end11:
	.size	two_cases, .Lfunc_end11-two_cases
                                        // -- End function
	.globl	clamp_max                       // -- Begin function clamp_max
	.p2align	2
	.type	clamp_max,@function
clamp_max:                              // @clamp_max
// %bb.0:
	sub	sp, sp, #16
	str	w0, [sp, #12]
	str	w1, [sp, #8]
	ldr	w8, [sp, #12]
	ldr	w9, [sp, #8]
	subs	w8, w8, w9
	b.le	.LBB12_2
	b	.LBB12_1
.LBB12_1:
	ldr	w8, [sp, #12]
	str	w8, [sp, #4]                    // 4-byte Folded Spill
	b	.LBB12_3
.LBB12_2:
	ldr	w8, [sp, #8]
	str	w8, [sp, #4]                    // 4-byte Folded Spill
	b	.LBB12_3
.LBB12_3:
	ldr	w0, [sp, #4]                    // 4-byte Folded Reload
	add	sp, sp, #16
	ret
.Lfunc_end12:
	.size	clamp_max, .Lfunc_end12-clamp_max
                                        // -- End function
	.globl	abs_int                         // -- Begin function abs_int
	.p2align	2
	.type	abs_int,@function
abs_int:                                // @abs_int
// %bb.0:
	sub	sp, sp, #16
	str	w0, [sp, #12]
	ldr	w8, [sp, #12]
	tbz	w8, #31, .LBB13_2
	b	.LBB13_1
.LBB13_1:
	ldr	w9, [sp, #12]
	mov	w8, wzr
	subs	w8, w8, w9
	str	w8, [sp, #8]                    // 4-byte Folded Spill
	b	.LBB13_3
.LBB13_2:
	ldr	w8, [sp, #12]
	str	w8, [sp, #8]                    // 4-byte Folded Spill
	b	.LBB13_3
.LBB13_3:
	ldr	w0, [sp, #8]                    // 4-byte Folded Reload
	add	sp, sp, #16
	ret
.Lfunc_end13:
	.size	abs_int, .Lfunc_end13-abs_int
                                        // -- End function
	.globl	is_pos                          // -- Begin function is_pos
	.p2align	2
	.type	is_pos,@function
is_pos:                                 // @is_pos
// %bb.0:
	sub	sp, sp, #16
	str	w0, [sp, #12]
	ldr	w8, [sp, #12]
	subs	w8, w8, #0
	cset	w0, gt
	add	sp, sp, #16
	ret
.Lfunc_end14:
	.size	is_pos, .Lfunc_end14-is_pos
                                        // -- End function
	.globl	tail_caller                     // -- Begin function tail_caller
	.p2align	2
	.type	tail_caller,@function
tail_caller:                            // @tail_caller
// %bb.0:
	sub	sp, sp, #32
	stp	x29, x30, [sp, #16]             // 16-byte Folded Spill
	add	x29, sp, #16
	stur	w0, [x29, #-4]
	ldur	w8, [x29, #-4]
	add	w0, w8, #1
	bl	tail_target
	ldp	x29, x30, [sp, #16]             // 16-byte Folded Reload
	add	sp, sp, #32
	ret
.Lfunc_end15:
	.size	tail_caller, .Lfunc_end15-tail_caller
                                        // -- End function
	.globl	leaf_add                        // -- Begin function leaf_add
	.p2align	2
	.type	leaf_add,@function
leaf_add:                               // @leaf_add
// %bb.0:
	sub	sp, sp, #16
	str	w0, [sp, #12]
	str	w1, [sp, #8]
	ldr	w8, [sp, #12]
	ldr	w9, [sp, #8]
	add	w0, w8, w9
	add	sp, sp, #16
	ret
.Lfunc_end16:
	.size	leaf_add, .Lfunc_end16-leaf_add
                                        // -- End function
	.globl	twice_sum                       // -- Begin function twice_sum
	.p2align	2
	.type	twice_sum,@function
twice_sum:                              // @twice_sum
// %bb.0:
	sub	sp, sp, #32
	stp	x29, x30, [sp, #16]             // 16-byte Folded Spill
	add	x29, sp, #16
	stur	w0, [x29, #-4]
	str	w1, [sp, #8]
	ldur	w0, [x29, #-4]
	ldr	w1, [sp, #8]
	bl	leaf_add
	lsl	w0, w0, #1
	ldp	x29, x30, [sp, #16]             // 16-byte Folded Reload
	add	sp, sp, #32
	ret
.Lfunc_end17:
	.size	twice_sum, .Lfunc_end17-twice_sum
                                        // -- End function
	.globl	sum_n                           // -- Begin function sum_n
	.p2align	2
	.type	sum_n,@function
sum_n:                                  // @sum_n
// %bb.0:
	sub	sp, sp, #32
	str	x0, [sp, #24]
	str	w1, [sp, #20]
	str	wzr, [sp, #16]
	str	wzr, [sp, #12]
	b	.LBB18_1
.LBB18_1:                               // =>This Inner Loop Header: Depth=1
	ldr	w8, [sp, #12]
	ldr	w9, [sp, #20]
	subs	w8, w8, w9
	b.ge	.LBB18_4
	b	.LBB18_2
.LBB18_2:                               //   in Loop: Header=BB18_1 Depth=1
	ldr	x8, [sp, #24]
	ldrsw	x9, [sp, #12]
	ldr	w9, [x8, x9, lsl #2]
	ldr	w8, [sp, #16]
	add	w8, w8, w9
	str	w8, [sp, #16]
	b	.LBB18_3
.LBB18_3:                               //   in Loop: Header=BB18_1 Depth=1
	ldr	w8, [sp, #12]
	add	w8, w8, #1
	str	w8, [sp, #12]
	b	.LBB18_1
.LBB18_4:
	ldr	w0, [sp, #16]
	add	sp, sp, #32
	ret
.Lfunc_end18:
	.size	sum_n, .Lfunc_end18-sum_n
                                        // -- End function
	.globl	sum4                            // -- Begin function sum4
	.p2align	2
	.type	sum4,@function
sum4:                                   // @sum4
// %bb.0:
	sub	sp, sp, #16
	str	x0, [sp, #8]
	str	wzr, [sp, #4]
	str	wzr, [sp]
	b	.LBB19_1
.LBB19_1:                               // =>This Inner Loop Header: Depth=1
	ldr	w8, [sp]
	subs	w8, w8, #4
	b.ge	.LBB19_4
	b	.LBB19_2
.LBB19_2:                               //   in Loop: Header=BB19_1 Depth=1
	ldr	x8, [sp, #8]
	ldrsw	x9, [sp]
	ldr	w9, [x8, x9, lsl #2]
	ldr	w8, [sp, #4]
	add	w8, w8, w9
	str	w8, [sp, #4]
	b	.LBB19_3
.LBB19_3:                               //   in Loop: Header=BB19_1 Depth=1
	ldr	w8, [sp]
	add	w8, w8, #1
	str	w8, [sp]
	b	.LBB19_1
.LBB19_4:
	ldr	w0, [sp, #4]
	add	sp, sp, #16
	ret
.Lfunc_end19:
	.size	sum4, .Lfunc_end19-sum4
                                        // -- End function
	.globl	poly8                           // -- Begin function poly8
	.p2align	2
	.type	poly8,@function
poly8:                                  // @poly8
// %bb.0:
	sub	sp, sp, #16
	str	x0, [sp, #8]
	str	wzr, [sp, #4]
	str	wzr, [sp]
	b	.LBB20_1
.LBB20_1:                               // =>This Inner Loop Header: Depth=1
	ldr	w8, [sp]
	subs	w8, w8, #8
	b.ge	.LBB20_4
	b	.LBB20_2
.LBB20_2:                               //   in Loop: Header=BB20_1 Depth=1
	ldr	w8, [sp, #4]
	mov	w9, #31                         // =0x1f
	mul	w8, w8, w9
	ldr	x9, [sp, #8]
	ldrsw	x10, [sp]
	ldr	w9, [x9, x10, lsl #2]
	add	w8, w8, w9
	str	w8, [sp, #4]
	b	.LBB20_3
.LBB20_3:                               //   in Loop: Header=BB20_1 Depth=1
	ldr	w8, [sp]
	add	w8, w8, #1
	str	w8, [sp]
	b	.LBB20_1
.LBB20_4:
	ldr	w0, [sp, #4]
	add	sp, sp, #16
	ret
.Lfunc_end20:
	.size	poly8, .Lfunc_end20-poly8
                                        // -- End function
	.globl	fill                            // -- Begin function fill
	.p2align	2
	.type	fill,@function
fill:                                   // @fill
// %bb.0:
	sub	sp, sp, #16
	str	x0, [sp, #8]
	str	w1, [sp, #4]
	str	wzr, [sp]
	b	.LBB21_1
.LBB21_1:                               // =>This Inner Loop Header: Depth=1
	ldr	w8, [sp]
	ldr	w9, [sp, #4]
	subs	w8, w8, w9
	b.ge	.LBB21_4
	b	.LBB21_2
.LBB21_2:                               //   in Loop: Header=BB21_1 Depth=1
	ldr	x8, [sp, #8]
	ldrsw	x9, [sp]
	add	x8, x8, x9
	strb	wzr, [x8]
	b	.LBB21_3
.LBB21_3:                               //   in Loop: Header=BB21_1 Depth=1
	ldr	w8, [sp]
	add	w8, w8, #1
	str	w8, [sp]
	b	.LBB21_1
.LBB21_4:
	add	sp, sp, #16
	ret
.Lfunc_end21:
	.size	fill, .Lfunc_end21-fill
                                        // -- End function
	.globl	copy_n                          // -- Begin function copy_n
	.p2align	2
	.type	copy_n,@function
copy_n:                                 // @copy_n
// %bb.0:
	sub	sp, sp, #48
	stp	x29, x30, [sp, #32]             // 16-byte Folded Spill
	add	x29, sp, #32
	stur	x0, [x29, #-8]
	str	x1, [sp, #16]
	str	x2, [sp, #8]
	ldur	x0, [x29, #-8]
	ldr	x1, [sp, #16]
	ldr	x2, [sp, #8]
	bl	memcpy
	ldp	x29, x30, [sp, #32]             // 16-byte Folded Reload
	add	sp, sp, #48
	ret
.Lfunc_end22:
	.size	copy_n, .Lfunc_end22-copy_n
                                        // -- End function
	.globl	copy16                          // -- Begin function copy16
	.p2align	2
	.type	copy16,@function
copy16:                                 // @copy16
// %bb.0:
	sub	sp, sp, #16
	str	x0, [sp, #8]
	str	x1, [sp]
	ldr	x8, [sp, #8]
	ldr	x9, [sp]
	ldr	q0, [x9]
	str	q0, [x8]
	add	sp, sp, #16
	ret
.Lfunc_end23:
	.size	copy16, .Lfunc_end23-copy16
                                        // -- End function
	.globl	digest                          // -- Begin function digest
	.p2align	2
	.type	digest,@function
digest:                                 // @digest
// %bb.0:
	sub	sp, sp, #48
	str	x0, [sp, #40]
	str	w1, [sp, #36]
	str	wzr, [sp, #32]
	str	wzr, [sp, #28]
	b	.LBB24_1
.LBB24_1:                               // =>This Inner Loop Header: Depth=1
	ldr	w8, [sp, #28]
	ldr	w9, [sp, #36]
	subs	w8, w8, w9
	b.ge	.LBB24_4
	b	.LBB24_2
.LBB24_2:                               //   in Loop: Header=BB24_1 Depth=1
	ldr	x8, [sp, #40]
	ldrsw	x9, [sp, #28]
	ldr	w9, [x8, x9, lsl #2]
	ldr	w8, [sp, #32]
	add	w8, w8, w9
	str	w8, [sp, #32]
	b	.LBB24_3
.LBB24_3:                               //   in Loop: Header=BB24_1 Depth=1
	ldr	w8, [sp, #28]
	add	w8, w8, #1
	str	w8, [sp, #28]
	b	.LBB24_1
.LBB24_4:
	ldr	w8, [sp, #32]
	mov	w9, #10                         // =0xa
	sdiv	w8, w8, w9
	str	w8, [sp, #24]
	ldr	w8, [sp, #24]
	str	w8, [sp, #8]                    // 4-byte Folded Spill
	subs	w8, w8, #6
	b.eq	.LBB24_8
	b	.LBB24_5
.LBB24_5:
	ldr	w8, [sp, #8]                    // 4-byte Folded Reload
	subs	w8, w8, #7
	b.eq	.LBB24_9
	b	.LBB24_6
.LBB24_6:
	ldr	w8, [sp, #8]                    // 4-byte Folded Reload
	subs	w8, w8, #8
	b.eq	.LBB24_10
	b	.LBB24_7
.LBB24_7:
	ldr	w8, [sp, #8]                    // 4-byte Folded Reload
	subs	w8, w8, #9
	subs	w8, w8, #1
	b.ls	.LBB24_11
	b	.LBB24_12
.LBB24_8:
	mov	w8, #1                          // =0x1
	str	w8, [sp, #20]
	b	.LBB24_13
.LBB24_9:
	mov	w8, #2                          // =0x2
	str	w8, [sp, #20]
	b	.LBB24_13
.LBB24_10:
	mov	w8, #4                          // =0x4
	str	w8, [sp, #20]
	b	.LBB24_13
.LBB24_11:
	mov	w8, #8                          // =0x8
	str	w8, [sp, #20]
	b	.LBB24_13
.LBB24_12:
	str	wzr, [sp, #20]
	b	.LBB24_13
.LBB24_13:
	ldr	w8, [sp, #32]
	mov	w10, #10                        // =0xa
	sdiv	w9, w8, w10
	mul	w9, w9, w10
	subs	w8, w8, w9
	str	w8, [sp, #16]
	ldr	w8, [sp, #16]
	subs	w8, w8, #5
	b.le	.LBB24_15
	b	.LBB24_14
.LBB24_14:
	mov	w8, #5                          // =0x5
	str	w8, [sp, #4]                    // 4-byte Folded Spill
	b	.LBB24_16
.LBB24_15:
	ldr	w8, [sp, #16]
	str	w8, [sp, #4]                    // 4-byte Folded Spill
	b	.LBB24_16
.LBB24_16:
	ldr	w8, [sp, #4]                    // 4-byte Folded Reload
	str	w8, [sp, #12]
	ldr	w9, [sp, #20]
	ldr	w8, [sp, #12]
	add	w0, w8, w9, lsl #4
	add	sp, sp, #48
	ret
.Lfunc_end24:
	.size	digest, .Lfunc_end24-digest
                                        // -- End function
	.ident	"Apple clang version 17.0.0 (clang-1700.6.3.2)"
	.section	".note.GNU-stack","",@progbits
	.addrsig
	.addrsig_sym tail_target
	.addrsig_sym leaf_add
