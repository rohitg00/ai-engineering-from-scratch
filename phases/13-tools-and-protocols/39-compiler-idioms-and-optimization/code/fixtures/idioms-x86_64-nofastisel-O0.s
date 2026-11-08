	.text
	.file	"idioms.c"
	.globl	div10u                          # -- Begin function div10u
	.p2align	4, 0x90
	.type	div10u,@function
div10u:                                 # @div10u
# %bb.0:
	pushq	%rbp
	movq	%rsp, %rbp
	movl	%edi, -4(%rbp)
	movl	-4(%rbp), %eax
                                        # kill: def $rax killed $eax
	movl	$3435973837, %ecx               # imm = 0xCCCCCCCD
	imulq	%rcx, %rax
	shrq	$35, %rax
                                        # kill: def $eax killed $eax killed $rax
	popq	%rbp
	retq
.Lfunc_end0:
	.size	div10u, .Lfunc_end0-div10u
                                        # -- End function
	.globl	div10s                          # -- Begin function div10s
	.p2align	4, 0x90
	.type	div10s,@function
div10s:                                 # @div10s
# %bb.0:
	pushq	%rbp
	movq	%rsp, %rbp
	movl	%edi, -4(%rbp)
	movslq	-4(%rbp), %rax
	imulq	$1717986919, %rax, %rax         # imm = 0x66666667
	movq	%rax, %rcx
	shrq	$63, %rcx
                                        # kill: def $ecx killed $ecx killed $rcx
	sarq	$34, %rax
                                        # kill: def $eax killed $eax killed $rax
	addl	%ecx, %eax
	popq	%rbp
	retq
.Lfunc_end1:
	.size	div10s, .Lfunc_end1-div10s
                                        # -- End function
	.globl	div7u                           # -- Begin function div7u
	.p2align	4, 0x90
	.type	div7u,@function
div7u:                                  # @div7u
# %bb.0:
	pushq	%rbp
	movq	%rsp, %rbp
	movl	%edi, -4(%rbp)
	movl	-4(%rbp), %eax
	movl	%eax, %ecx
	movl	%ecx, %eax
	imulq	$613566757, %rcx, %rcx          # imm = 0x24924925
	shrq	$32, %rcx
                                        # kill: def $ecx killed $ecx killed $rcx
	subl	%ecx, %eax
	shrl	%eax
	addl	%ecx, %eax
	shrl	$2, %eax
	popq	%rbp
	retq
.Lfunc_end2:
	.size	div7u, .Lfunc_end2-div7u
                                        # -- End function
	.globl	div3s                           # -- Begin function div3s
	.p2align	4, 0x90
	.type	div3s,@function
div3s:                                  # @div3s
# %bb.0:
	pushq	%rbp
	movq	%rsp, %rbp
	movl	%edi, -4(%rbp)
	movslq	-4(%rbp), %rax
	imulq	$1431655766, %rax, %rax         # imm = 0x55555556
	movq	%rax, %rcx
	shrq	$63, %rcx
                                        # kill: def $ecx killed $ecx killed $rcx
	shrq	$32, %rax
                                        # kill: def $eax killed $eax killed $rax
	addl	%ecx, %eax
	popq	%rbp
	retq
.Lfunc_end3:
	.size	div3s, .Lfunc_end3-div3s
                                        # -- End function
	.globl	mod10s                          # -- Begin function mod10s
	.p2align	4, 0x90
	.type	mod10s,@function
mod10s:                                 # @mod10s
# %bb.0:
	pushq	%rbp
	movq	%rsp, %rbp
	movl	%edi, -4(%rbp)
	movslq	-4(%rbp), %rcx
	movl	%ecx, %eax
	imulq	$1717986919, %rcx, %rdx         # imm = 0x66666667
	movq	%rdx, %rcx
	shrq	$63, %rcx
                                        # kill: def $ecx killed $ecx killed $rcx
	sarq	$34, %rdx
                                        # kill: def $edx killed $edx killed $rdx
	addl	%ecx, %edx
	addl	%edx, %edx
                                        # implicit-def: $rcx
	movl	%edx, %ecx
	leal	(%rcx,%rcx,4), %ecx
	subl	%ecx, %eax
	popq	%rbp
	retq
.Lfunc_end4:
	.size	mod10s, .Lfunc_end4-mod10s
                                        # -- End function
	.globl	mod8s                           # -- Begin function mod8s
	.p2align	4, 0x90
	.type	mod8s,@function
mod8s:                                  # @mod8s
# %bb.0:
	pushq	%rbp
	movq	%rsp, %rbp
	movl	%edi, -4(%rbp)
	movl	-4(%rbp), %eax
	movl	%eax, %edx
	addl	$7, %edx
	testl	%eax, %eax
	movl	%eax, %ecx
	cmovsl	%edx, %ecx
	andl	$-8, %ecx
	subl	%ecx, %eax
	popq	%rbp
	retq
.Lfunc_end5:
	.size	mod8s, .Lfunc_end5-mod8s
                                        # -- End function
	.globl	mul9                            # -- Begin function mul9
	.p2align	4, 0x90
	.type	mul9,@function
mul9:                                   # @mul9
# %bb.0:
	pushq	%rbp
	movq	%rsp, %rbp
	movl	%edi, -4(%rbp)
	movl	-4(%rbp), %ecx
                                        # implicit-def: $rax
	movl	%ecx, %eax
	leal	(%rax,%rax,8), %eax
	popq	%rbp
	retq
.Lfunc_end6:
	.size	mul9, .Lfunc_end6-mul9
                                        # -- End function
	.globl	linear_switch                   # -- Begin function linear_switch
	.p2align	4, 0x90
	.type	linear_switch,@function
linear_switch:                          # @linear_switch
# %bb.0:
	pushq	%rbp
	movq	%rsp, %rbp
	movl	%edi, -8(%rbp)
	movl	-8(%rbp), %eax
                                        # kill: def $rax killed $eax
	movq	%rax, -16(%rbp)                 # 8-byte Spill
	subq	$6, %rax
	ja	.LBB7_8
# %bb.10:
	movq	-16(%rbp), %rax                 # 8-byte Reload
	leaq	.LJTI7_0(%rip), %rcx
	movslq	(%rcx,%rax,4), %rax
	addq	%rcx, %rax
	jmpq	*%rax
.LBB7_1:
	movl	$10, -4(%rbp)
	jmp	.LBB7_9
.LBB7_2:
	movl	$20, -4(%rbp)
	jmp	.LBB7_9
.LBB7_3:
	movl	$30, -4(%rbp)
	jmp	.LBB7_9
.LBB7_4:
	movl	$40, -4(%rbp)
	jmp	.LBB7_9
.LBB7_5:
	movl	$50, -4(%rbp)
	jmp	.LBB7_9
.LBB7_6:
	movl	$60, -4(%rbp)
	jmp	.LBB7_9
.LBB7_7:
	movl	$70, -4(%rbp)
	jmp	.LBB7_9
.LBB7_8:
	movl	$-1, -4(%rbp)
	jmp	.LBB7_9
.LBB7_9:
	movl	-4(%rbp), %eax
	popq	%rbp
	retq
.Lfunc_end7:
	.size	linear_switch, .Lfunc_end7-linear_switch
	.section	.rodata,"a",@progbits
	.p2align	2, 0x0
.LJTI7_0:
	.long	.LBB7_1-.LJTI7_0
	.long	.LBB7_2-.LJTI7_0
	.long	.LBB7_3-.LJTI7_0
	.long	.LBB7_4-.LJTI7_0
	.long	.LBB7_5-.LJTI7_0
	.long	.LBB7_6-.LJTI7_0
	.long	.LBB7_7-.LJTI7_0
                                        # -- End function
	.text
	.globl	table_switch                    # -- Begin function table_switch
	.p2align	4, 0x90
	.type	table_switch,@function
table_switch:                           # @table_switch
# %bb.0:
	pushq	%rbp
	movq	%rsp, %rbp
	movl	%edi, -8(%rbp)
	movl	-8(%rbp), %eax
                                        # kill: def $rax killed $eax
	movq	%rax, -16(%rbp)                 # 8-byte Spill
	subq	$6, %rax
	ja	.LBB8_8
# %bb.10:
	movq	-16(%rbp), %rax                 # 8-byte Reload
	leaq	.LJTI8_0(%rip), %rcx
	movslq	(%rcx,%rax,4), %rax
	addq	%rcx, %rax
	jmpq	*%rax
.LBB8_1:
	movl	$10, -4(%rbp)
	jmp	.LBB8_9
.LBB8_2:
	movl	$20, -4(%rbp)
	jmp	.LBB8_9
.LBB8_3:
	movl	$30, -4(%rbp)
	jmp	.LBB8_9
.LBB8_4:
	movl	$40, -4(%rbp)
	jmp	.LBB8_9
.LBB8_5:
	movl	$50, -4(%rbp)
	jmp	.LBB8_9
.LBB8_6:
	movl	$60, -4(%rbp)
	jmp	.LBB8_9
.LBB8_7:
	movl	$71, -4(%rbp)
	jmp	.LBB8_9
.LBB8_8:
	movl	$-1, -4(%rbp)
	jmp	.LBB8_9
.LBB8_9:
	movl	-4(%rbp), %eax
	popq	%rbp
	retq
.Lfunc_end8:
	.size	table_switch, .Lfunc_end8-table_switch
	.section	.rodata,"a",@progbits
	.p2align	2, 0x0
.LJTI8_0:
	.long	.LBB8_1-.LJTI8_0
	.long	.LBB8_2-.LJTI8_0
	.long	.LBB8_3-.LJTI8_0
	.long	.LBB8_4-.LJTI8_0
	.long	.LBB8_5-.LJTI8_0
	.long	.LBB8_6-.LJTI8_0
	.long	.LBB8_7-.LJTI8_0
                                        # -- End function
	.text
	.globl	call_switch                     # -- Begin function call_switch
	.p2align	4, 0x90
	.type	call_switch,@function
call_switch:                            # @call_switch
# %bb.0:
	pushq	%rbp
	movq	%rsp, %rbp
	subq	$64, %rsp
	movl	%edi, -4(%rbp)
	movq	%rsi, -16(%rbp)
	movq	%rdx, -24(%rbp)
	movq	%rcx, -32(%rbp)
	movq	%r8, -40(%rbp)
	movq	%r9, -48(%rbp)
	movl	-4(%rbp), %eax
                                        # kill: def $rax killed $eax
	movq	%rax, -56(%rbp)                 # 8-byte Spill
	subq	$4, %rax
	ja	.LBB9_6
# %bb.8:
	movq	-56(%rbp), %rax                 # 8-byte Reload
	leaq	.LJTI9_0(%rip), %rcx
	movslq	(%rcx,%rax,4), %rax
	addq	%rcx, %rax
	jmpq	*%rax
.LBB9_1:
	movq	-16(%rbp), %rax
	callq	*%rax
	jmp	.LBB9_7
.LBB9_2:
	movq	-24(%rbp), %rax
	callq	*%rax
	jmp	.LBB9_7
.LBB9_3:
	movq	-32(%rbp), %rax
	callq	*%rax
	jmp	.LBB9_7
.LBB9_4:
	movq	-40(%rbp), %rax
	callq	*%rax
	jmp	.LBB9_7
.LBB9_5:
	movq	-48(%rbp), %rax
	callq	*%rax
	jmp	.LBB9_7
.LBB9_6:
	jmp	.LBB9_7
.LBB9_7:
	addq	$64, %rsp
	popq	%rbp
	retq
.Lfunc_end9:
	.size	call_switch, .Lfunc_end9-call_switch
	.section	.rodata,"a",@progbits
	.p2align	2, 0x0
.LJTI9_0:
	.long	.LBB9_1-.LJTI9_0
	.long	.LBB9_2-.LJTI9_0
	.long	.LBB9_3-.LJTI9_0
	.long	.LBB9_4-.LJTI9_0
	.long	.LBB9_5-.LJTI9_0
                                        # -- End function
	.text
	.globl	sparse_switch                   # -- Begin function sparse_switch
	.p2align	4, 0x90
	.type	sparse_switch,@function
sparse_switch:                          # @sparse_switch
# %bb.0:
	pushq	%rbp
	movq	%rsp, %rbp
	movl	%edi, -8(%rbp)
	movl	-8(%rbp), %eax
	movl	%eax, -12(%rbp)                 # 4-byte Spill
	subl	$1, %eax
	je	.LBB10_1
	jmp	.LBB10_8
.LBB10_8:
	movl	-12(%rbp), %eax                 # 4-byte Reload
	subl	$100, %eax
	je	.LBB10_2
	jmp	.LBB10_9
.LBB10_9:
	movl	-12(%rbp), %eax                 # 4-byte Reload
	subl	$10000, %eax                    # imm = 0x2710
	je	.LBB10_3
	jmp	.LBB10_10
.LBB10_10:
	movl	-12(%rbp), %eax                 # 4-byte Reload
	subl	$1000000, %eax                  # imm = 0xF4240
	je	.LBB10_4
	jmp	.LBB10_11
.LBB10_11:
	movl	-12(%rbp), %eax                 # 4-byte Reload
	subl	$100000000, %eax                # imm = 0x5F5E100
	je	.LBB10_5
	jmp	.LBB10_6
.LBB10_1:
	movl	$1, -4(%rbp)
	jmp	.LBB10_7
.LBB10_2:
	movl	$2, -4(%rbp)
	jmp	.LBB10_7
.LBB10_3:
	movl	$3, -4(%rbp)
	jmp	.LBB10_7
.LBB10_4:
	movl	$4, -4(%rbp)
	jmp	.LBB10_7
.LBB10_5:
	movl	$5, -4(%rbp)
	jmp	.LBB10_7
.LBB10_6:
	movl	$0, -4(%rbp)
	jmp	.LBB10_7
.LBB10_7:
	movl	-4(%rbp), %eax
	popq	%rbp
	retq
.Lfunc_end10:
	.size	sparse_switch, .Lfunc_end10-sparse_switch
                                        # -- End function
	.globl	two_cases                       # -- Begin function two_cases
	.p2align	4, 0x90
	.type	two_cases,@function
two_cases:                              # @two_cases
# %bb.0:
	pushq	%rbp
	movq	%rsp, %rbp
	movl	%edi, -8(%rbp)
	movl	-8(%rbp), %eax
	movl	%eax, -12(%rbp)                 # 4-byte Spill
	subl	$3, %eax
	je	.LBB11_1
	jmp	.LBB11_5
.LBB11_5:
	movl	-12(%rbp), %eax                 # 4-byte Reload
	subl	$4, %eax
	je	.LBB11_2
	jmp	.LBB11_3
.LBB11_1:
	movl	$7, -4(%rbp)
	jmp	.LBB11_4
.LBB11_2:
	movl	$9, -4(%rbp)
	jmp	.LBB11_4
.LBB11_3:
	movl	$0, -4(%rbp)
	jmp	.LBB11_4
.LBB11_4:
	movl	-4(%rbp), %eax
	popq	%rbp
	retq
.Lfunc_end11:
	.size	two_cases, .Lfunc_end11-two_cases
                                        # -- End function
	.globl	clamp_max                       # -- Begin function clamp_max
	.p2align	4, 0x90
	.type	clamp_max,@function
clamp_max:                              # @clamp_max
# %bb.0:
	pushq	%rbp
	movq	%rsp, %rbp
	movl	%edi, -4(%rbp)
	movl	%esi, -8(%rbp)
	movl	-4(%rbp), %eax
	movl	-8(%rbp), %ecx
	subl	%ecx, %eax
	jle	.LBB12_2
	jmp	.LBB12_1
.LBB12_1:
	movl	-4(%rbp), %eax
	movl	%eax, -12(%rbp)                 # 4-byte Spill
	jmp	.LBB12_3
.LBB12_2:
	movl	-8(%rbp), %eax
	movl	%eax, -12(%rbp)                 # 4-byte Spill
	jmp	.LBB12_3
.LBB12_3:
	movl	-12(%rbp), %eax                 # 4-byte Reload
	popq	%rbp
	retq
.Lfunc_end12:
	.size	clamp_max, .Lfunc_end12-clamp_max
                                        # -- End function
	.globl	abs_int                         # -- Begin function abs_int
	.p2align	4, 0x90
	.type	abs_int,@function
abs_int:                                # @abs_int
# %bb.0:
	pushq	%rbp
	movq	%rsp, %rbp
	movl	%edi, -4(%rbp)
	movl	-4(%rbp), %eax
	testl	%eax, %eax
	jns	.LBB13_2
	jmp	.LBB13_1
.LBB13_1:
	movl	-4(%rbp), %eax
	negl	%eax
	movl	%eax, -8(%rbp)                  # 4-byte Spill
	jmp	.LBB13_3
.LBB13_2:
	movl	-4(%rbp), %eax
	movl	%eax, -8(%rbp)                  # 4-byte Spill
	jmp	.LBB13_3
.LBB13_3:
	movl	-8(%rbp), %eax                  # 4-byte Reload
	popq	%rbp
	retq
.Lfunc_end13:
	.size	abs_int, .Lfunc_end13-abs_int
                                        # -- End function
	.globl	is_pos                          # -- Begin function is_pos
	.p2align	4, 0x90
	.type	is_pos,@function
is_pos:                                 # @is_pos
# %bb.0:
	pushq	%rbp
	movq	%rsp, %rbp
	movl	%edi, -4(%rbp)
	movl	-4(%rbp), %eax
	testl	%eax, %eax
	setg	%al
	movzbl	%al, %eax
	popq	%rbp
	retq
.Lfunc_end14:
	.size	is_pos, .Lfunc_end14-is_pos
                                        # -- End function
	.globl	tail_caller                     # -- Begin function tail_caller
	.p2align	4, 0x90
	.type	tail_caller,@function
tail_caller:                            # @tail_caller
# %bb.0:
	pushq	%rbp
	movq	%rsp, %rbp
	subq	$16, %rsp
	movl	%edi, -4(%rbp)
	movl	-4(%rbp), %edi
	incl	%edi
	callq	tail_target@PLT
	addq	$16, %rsp
	popq	%rbp
	retq
.Lfunc_end15:
	.size	tail_caller, .Lfunc_end15-tail_caller
                                        # -- End function
	.globl	leaf_add                        # -- Begin function leaf_add
	.p2align	4, 0x90
	.type	leaf_add,@function
leaf_add:                               # @leaf_add
# %bb.0:
	pushq	%rbp
	movq	%rsp, %rbp
	movl	%edi, -4(%rbp)
	movl	%esi, -8(%rbp)
	movl	-4(%rbp), %eax
	movl	-8(%rbp), %ecx
	addl	%ecx, %eax
	popq	%rbp
	retq
.Lfunc_end16:
	.size	leaf_add, .Lfunc_end16-leaf_add
                                        # -- End function
	.globl	twice_sum                       # -- Begin function twice_sum
	.p2align	4, 0x90
	.type	twice_sum,@function
twice_sum:                              # @twice_sum
# %bb.0:
	pushq	%rbp
	movq	%rsp, %rbp
	subq	$16, %rsp
	movl	%edi, -4(%rbp)
	movl	%esi, -8(%rbp)
	movl	-4(%rbp), %edi
	movl	-8(%rbp), %esi
	callq	leaf_add
	addl	%eax, %eax
	addq	$16, %rsp
	popq	%rbp
	retq
.Lfunc_end17:
	.size	twice_sum, .Lfunc_end17-twice_sum
                                        # -- End function
	.globl	sum_n                           # -- Begin function sum_n
	.p2align	4, 0x90
	.type	sum_n,@function
sum_n:                                  # @sum_n
# %bb.0:
	pushq	%rbp
	movq	%rsp, %rbp
	movq	%rdi, -8(%rbp)
	movl	%esi, -12(%rbp)
	movl	$0, -16(%rbp)
	movl	$0, -20(%rbp)
	jmp	.LBB18_1
.LBB18_1:                               # =>This Inner Loop Header: Depth=1
	movl	-20(%rbp), %eax
	movl	-12(%rbp), %ecx
	subl	%ecx, %eax
	jge	.LBB18_4
	jmp	.LBB18_2
.LBB18_2:                               #   in Loop: Header=BB18_1 Depth=1
	movq	-8(%rbp), %rax
	movslq	-20(%rbp), %rcx
	movl	(%rax,%rcx,4), %ecx
	movl	-16(%rbp), %eax
	addl	%ecx, %eax
	movl	%eax, -16(%rbp)
	jmp	.LBB18_3
.LBB18_3:                               #   in Loop: Header=BB18_1 Depth=1
	movl	-20(%rbp), %eax
	incl	%eax
	movl	%eax, -20(%rbp)
	jmp	.LBB18_1
.LBB18_4:
	movl	-16(%rbp), %eax
	popq	%rbp
	retq
.Lfunc_end18:
	.size	sum_n, .Lfunc_end18-sum_n
                                        # -- End function
	.globl	sum4                            # -- Begin function sum4
	.p2align	4, 0x90
	.type	sum4,@function
sum4:                                   # @sum4
# %bb.0:
	pushq	%rbp
	movq	%rsp, %rbp
	movq	%rdi, -8(%rbp)
	movl	$0, -12(%rbp)
	movl	$0, -16(%rbp)
	jmp	.LBB19_1
.LBB19_1:                               # =>This Inner Loop Header: Depth=1
	movl	-16(%rbp), %eax
	subl	$3, %eax
	jg	.LBB19_4
	jmp	.LBB19_2
.LBB19_2:                               #   in Loop: Header=BB19_1 Depth=1
	movq	-8(%rbp), %rax
	movslq	-16(%rbp), %rcx
	movl	(%rax,%rcx,4), %ecx
	movl	-12(%rbp), %eax
	addl	%ecx, %eax
	movl	%eax, -12(%rbp)
	jmp	.LBB19_3
.LBB19_3:                               #   in Loop: Header=BB19_1 Depth=1
	movl	-16(%rbp), %eax
	incl	%eax
	movl	%eax, -16(%rbp)
	jmp	.LBB19_1
.LBB19_4:
	movl	-12(%rbp), %eax
	popq	%rbp
	retq
.Lfunc_end19:
	.size	sum4, .Lfunc_end19-sum4
                                        # -- End function
	.globl	poly8                           # -- Begin function poly8
	.p2align	4, 0x90
	.type	poly8,@function
poly8:                                  # @poly8
# %bb.0:
	pushq	%rbp
	movq	%rsp, %rbp
	movq	%rdi, -8(%rbp)
	movl	$0, -12(%rbp)
	movl	$0, -16(%rbp)
	jmp	.LBB20_1
.LBB20_1:                               # =>This Inner Loop Header: Depth=1
	movl	-16(%rbp), %eax
	subl	$7, %eax
	jg	.LBB20_4
	jmp	.LBB20_2
.LBB20_2:                               #   in Loop: Header=BB20_1 Depth=1
	movl	-12(%rbp), %ecx
	movl	%ecx, %eax
	shll	$5, %eax
	subl	%ecx, %eax
	movq	-8(%rbp), %rcx
	movslq	-16(%rbp), %rdx
	movl	(%rcx,%rdx,4), %ecx
	addl	%ecx, %eax
	movl	%eax, -12(%rbp)
	jmp	.LBB20_3
.LBB20_3:                               #   in Loop: Header=BB20_1 Depth=1
	movl	-16(%rbp), %eax
	incl	%eax
	movl	%eax, -16(%rbp)
	jmp	.LBB20_1
.LBB20_4:
	movl	-12(%rbp), %eax
	popq	%rbp
	retq
.Lfunc_end20:
	.size	poly8, .Lfunc_end20-poly8
                                        # -- End function
	.globl	fill                            # -- Begin function fill
	.p2align	4, 0x90
	.type	fill,@function
fill:                                   # @fill
# %bb.0:
	pushq	%rbp
	movq	%rsp, %rbp
	movq	%rdi, -8(%rbp)
	movl	%esi, -12(%rbp)
	movl	$0, -16(%rbp)
	jmp	.LBB21_1
.LBB21_1:                               # =>This Inner Loop Header: Depth=1
	movl	-16(%rbp), %eax
	movl	-12(%rbp), %ecx
	subl	%ecx, %eax
	jge	.LBB21_4
	jmp	.LBB21_2
.LBB21_2:                               #   in Loop: Header=BB21_1 Depth=1
	movq	-8(%rbp), %rax
	movslq	-16(%rbp), %rcx
	movb	$0, (%rax,%rcx)
	jmp	.LBB21_3
.LBB21_3:                               #   in Loop: Header=BB21_1 Depth=1
	movl	-16(%rbp), %eax
	incl	%eax
	movl	%eax, -16(%rbp)
	jmp	.LBB21_1
.LBB21_4:
	popq	%rbp
	retq
.Lfunc_end21:
	.size	fill, .Lfunc_end21-fill
                                        # -- End function
	.globl	copy_n                          # -- Begin function copy_n
	.p2align	4, 0x90
	.type	copy_n,@function
copy_n:                                 # @copy_n
# %bb.0:
	pushq	%rbp
	movq	%rsp, %rbp
	subq	$32, %rsp
	movq	%rdi, -8(%rbp)
	movq	%rsi, -16(%rbp)
	movq	%rdx, -24(%rbp)
	movq	-8(%rbp), %rdi
	movq	-16(%rbp), %rsi
	movq	-24(%rbp), %rdx
	callq	memcpy@PLT
	addq	$32, %rsp
	popq	%rbp
	retq
.Lfunc_end22:
	.size	copy_n, .Lfunc_end22-copy_n
                                        # -- End function
	.globl	copy16                          # -- Begin function copy16
	.p2align	4, 0x90
	.type	copy16,@function
copy16:                                 # @copy16
# %bb.0:
	pushq	%rbp
	movq	%rsp, %rbp
	movq	%rdi, -8(%rbp)
	movq	%rsi, -16(%rbp)
	movq	-8(%rbp), %rax
	movq	-16(%rbp), %rcx
	movups	(%rcx), %xmm0
	movups	%xmm0, (%rax)
	popq	%rbp
	retq
.Lfunc_end23:
	.size	copy16, .Lfunc_end23-copy16
                                        # -- End function
	.globl	digest                          # -- Begin function digest
	.p2align	4, 0x90
	.type	digest,@function
digest:                                 # @digest
# %bb.0:
	pushq	%rbp
	movq	%rsp, %rbp
	movq	%rdi, -8(%rbp)
	movl	%esi, -12(%rbp)
	movl	$0, -16(%rbp)
	movl	$0, -20(%rbp)
	jmp	.LBB24_1
.LBB24_1:                               # =>This Inner Loop Header: Depth=1
	movl	-20(%rbp), %eax
	movl	-12(%rbp), %ecx
	subl	%ecx, %eax
	jge	.LBB24_4
	jmp	.LBB24_2
.LBB24_2:                               #   in Loop: Header=BB24_1 Depth=1
	movq	-8(%rbp), %rax
	movslq	-20(%rbp), %rcx
	movl	(%rax,%rcx,4), %ecx
	movl	-16(%rbp), %eax
	addl	%ecx, %eax
	movl	%eax, -16(%rbp)
	jmp	.LBB24_3
.LBB24_3:                               #   in Loop: Header=BB24_1 Depth=1
	movl	-20(%rbp), %eax
	incl	%eax
	movl	%eax, -20(%rbp)
	jmp	.LBB24_1
.LBB24_4:
	movslq	-16(%rbp), %rax
	imulq	$1717986919, %rax, %rax         # imm = 0x66666667
	movq	%rax, %rcx
	shrq	$63, %rcx
                                        # kill: def $ecx killed $ecx killed $rcx
	sarq	$34, %rax
                                        # kill: def $eax killed $eax killed $rax
	addl	%ecx, %eax
	movl	%eax, -24(%rbp)
	movl	-24(%rbp), %eax
	addl	$-6, %eax
	movl	%eax, %ecx
	movq	%rcx, -48(%rbp)                 # 8-byte Spill
	subl	$4, %eax
	ja	.LBB24_9
# %bb.14:
	movq	-48(%rbp), %rax                 # 8-byte Reload
	leaq	.LJTI24_0(%rip), %rcx
	movslq	(%rcx,%rax,4), %rax
	addq	%rcx, %rax
	jmpq	*%rax
.LBB24_5:
	movl	$1, -28(%rbp)
	jmp	.LBB24_10
.LBB24_6:
	movl	$2, -28(%rbp)
	jmp	.LBB24_10
.LBB24_7:
	movl	$4, -28(%rbp)
	jmp	.LBB24_10
.LBB24_8:
	movl	$8, -28(%rbp)
	jmp	.LBB24_10
.LBB24_9:
	movl	$0, -28(%rbp)
	jmp	.LBB24_10
.LBB24_10:
	movslq	-16(%rbp), %rcx
	movl	%ecx, %eax
	imulq	$1717986919, %rcx, %rdx         # imm = 0x66666667
	movq	%rdx, %rcx
	shrq	$63, %rcx
                                        # kill: def $ecx killed $ecx killed $rcx
	sarq	$34, %rdx
                                        # kill: def $edx killed $edx killed $rdx
	addl	%ecx, %edx
	addl	%edx, %edx
                                        # implicit-def: $rcx
	movl	%edx, %ecx
	leal	(%rcx,%rcx,4), %ecx
	subl	%ecx, %eax
	movl	%eax, -32(%rbp)
	movl	-32(%rbp), %eax
	subl	$6, %eax
	jl	.LBB24_12
	jmp	.LBB24_11
.LBB24_11:
	movl	$5, %eax
	movl	%eax, -52(%rbp)                 # 4-byte Spill
	jmp	.LBB24_13
.LBB24_12:
	movl	-32(%rbp), %eax
	movl	%eax, -52(%rbp)                 # 4-byte Spill
	jmp	.LBB24_13
.LBB24_13:
	movl	-52(%rbp), %eax                 # 4-byte Reload
	movl	%eax, -36(%rbp)
	movl	-28(%rbp), %eax
	shll	$4, %eax
	movl	-36(%rbp), %ecx
	addl	%ecx, %eax
	popq	%rbp
	retq
.Lfunc_end24:
	.size	digest, .Lfunc_end24-digest
	.section	.rodata,"a",@progbits
	.p2align	2, 0x0
.LJTI24_0:
	.long	.LBB24_5-.LJTI24_0
	.long	.LBB24_6-.LJTI24_0
	.long	.LBB24_7-.LJTI24_0
	.long	.LBB24_8-.LJTI24_0
	.long	.LBB24_8-.LJTI24_0
                                        # -- End function
	.ident	"Apple clang version 17.0.0 (clang-1700.6.3.2)"
	.section	".note.GNU-stack","",@progbits
	.addrsig
	.addrsig_sym tail_target
	.addrsig_sym leaf_add
