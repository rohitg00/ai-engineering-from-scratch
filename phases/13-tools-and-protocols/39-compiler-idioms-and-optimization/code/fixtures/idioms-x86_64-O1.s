	.text
	.file	"idioms.c"
	.globl	div10u                          # -- Begin function div10u
	.p2align	4, 0x90
	.type	div10u,@function
div10u:                                 # @div10u
# %bb.0:
	movl	%edi, %ecx
	movl	$3435973837, %eax               # imm = 0xCCCCCCCD
	imulq	%rcx, %rax
	shrq	$35, %rax
                                        # kill: def $eax killed $eax killed $rax
	retq
.Lfunc_end0:
	.size	div10u, .Lfunc_end0-div10u
                                        # -- End function
	.globl	div10s                          # -- Begin function div10s
	.p2align	4, 0x90
	.type	div10s,@function
div10s:                                 # @div10s
# %bb.0:
	movslq	%edi, %rax
	imulq	$1717986919, %rax, %rax         # imm = 0x66666667
	movq	%rax, %rcx
	shrq	$63, %rcx
	sarq	$34, %rax
	addl	%ecx, %eax
                                        # kill: def $eax killed $eax killed $rax
	retq
.Lfunc_end1:
	.size	div10s, .Lfunc_end1-div10s
                                        # -- End function
	.globl	div7u                           # -- Begin function div7u
	.p2align	4, 0x90
	.type	div7u,@function
div7u:                                  # @div7u
# %bb.0:
	movl	%edi, %eax
	imulq	$613566757, %rax, %rax          # imm = 0x24924925
	shrq	$32, %rax
	subl	%eax, %edi
	shrl	%edi
	addl	%edi, %eax
	shrl	$2, %eax
                                        # kill: def $eax killed $eax killed $rax
	retq
.Lfunc_end2:
	.size	div7u, .Lfunc_end2-div7u
                                        # -- End function
	.globl	div3s                           # -- Begin function div3s
	.p2align	4, 0x90
	.type	div3s,@function
div3s:                                  # @div3s
# %bb.0:
	movslq	%edi, %rax
	imulq	$1431655766, %rax, %rax         # imm = 0x55555556
	movq	%rax, %rcx
	shrq	$63, %rcx
	shrq	$32, %rax
	addl	%ecx, %eax
                                        # kill: def $eax killed $eax killed $rax
	retq
.Lfunc_end3:
	.size	div3s, .Lfunc_end3-div3s
                                        # -- End function
	.globl	mod10s                          # -- Begin function mod10s
	.p2align	4, 0x90
	.type	mod10s,@function
mod10s:                                 # @mod10s
# %bb.0:
	movslq	%edi, %rax
	imulq	$1717986919, %rax, %rcx         # imm = 0x66666667
	movq	%rcx, %rdx
	shrq	$63, %rdx
	sarq	$34, %rcx
	addl	%edx, %ecx
	addl	%ecx, %ecx
	leal	(%rcx,%rcx,4), %ecx
	subl	%ecx, %eax
                                        # kill: def $eax killed $eax killed $rax
	retq
.Lfunc_end4:
	.size	mod10s, .Lfunc_end4-mod10s
                                        # -- End function
	.globl	mod8s                           # -- Begin function mod8s
	.p2align	4, 0x90
	.type	mod8s,@function
mod8s:                                  # @mod8s
# %bb.0:
	movl	%edi, %eax
	leal	7(%rax), %ecx
	testl	%edi, %edi
	cmovnsl	%edi, %ecx
	andl	$-8, %ecx
	subl	%ecx, %eax
                                        # kill: def $eax killed $eax killed $rax
	retq
.Lfunc_end5:
	.size	mod8s, .Lfunc_end5-mod8s
                                        # -- End function
	.globl	mul9                            # -- Begin function mul9
	.p2align	4, 0x90
	.type	mul9,@function
mul9:                                   # @mul9
# %bb.0:
                                        # kill: def $edi killed $edi def $rdi
	leal	(%rdi,%rdi,8), %eax
	retq
.Lfunc_end6:
	.size	mul9, .Lfunc_end6-mul9
                                        # -- End function
	.globl	linear_switch                   # -- Begin function linear_switch
	.p2align	4, 0x90
	.type	linear_switch,@function
linear_switch:                          # @linear_switch
# %bb.0:
                                        # kill: def $edi killed $edi def $rdi
	cmpl	$7, %edi
	leal	(%rdi,%rdi,4), %eax
	leal	10(%rax,%rax), %ecx
	movl	$-1, %eax
	cmovbl	%ecx, %eax
	retq
.Lfunc_end7:
	.size	linear_switch, .Lfunc_end7-linear_switch
                                        # -- End function
	.globl	table_switch                    # -- Begin function table_switch
	.p2align	4, 0x90
	.type	table_switch,@function
table_switch:                           # @table_switch
# %bb.0:
	movl	$-1, %eax
	cmpl	$6, %edi
	ja	.LBB8_2
# %bb.1:
	movl	%edi, %eax
	leaq	.Lswitch.table.table_switch(%rip), %rcx
	movl	(%rcx,%rax,4), %eax
.LBB8_2:
	retq
.Lfunc_end8:
	.size	table_switch, .Lfunc_end8-table_switch
                                        # -- End function
	.globl	call_switch                     # -- Begin function call_switch
	.p2align	4, 0x90
	.type	call_switch,@function
call_switch:                            # @call_switch
# %bb.0:
	cmpl	$4, %edi
	ja	.LBB9_7
# %bb.1:
	movl	%edi, %eax
	leaq	.LJTI9_0(%rip), %rdi
	movslq	(%rdi,%rax,4), %rax
	addq	%rdi, %rax
	jmpq	*%rax
.LBB9_2:
	jmpq	*%rdx                           # TAILCALL
.LBB9_5:
	movq	%r9, %rsi
.LBB9_6:
	jmpq	*%rsi                           # TAILCALL
.LBB9_3:
	jmpq	*%rcx                           # TAILCALL
.LBB9_4:
	jmpq	*%r8                            # TAILCALL
.LBB9_7:
	retq
.Lfunc_end9:
	.size	call_switch, .Lfunc_end9-call_switch
	.section	.rodata,"a",@progbits
	.p2align	2, 0x0
.LJTI9_0:
	.long	.LBB9_6-.LJTI9_0
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
	movl	%edi, %eax
	cmpl	$9999, %edi                     # imm = 0x270F
	jle	.LBB10_1
# %bb.4:
	cmpl	$10000, %eax                    # imm = 0x2710
	je	.LBB10_8
# %bb.5:
	cmpl	$1000000, %eax                  # imm = 0xF4240
	je	.LBB10_9
# %bb.6:
	cmpl	$100000000, %eax                # imm = 0x5F5E100
	jne	.LBB10_10
# %bb.7:
	movl	$5, %eax
	retq
.LBB10_1:
	cmpl	$1, %eax
	je	.LBB10_11
# %bb.2:
	cmpl	$100, %eax
	jne	.LBB10_10
# %bb.3:
	movl	$2, %eax
	retq
.LBB10_8:
	movl	$3, %eax
	retq
.LBB10_9:
	movl	$4, %eax
	retq
.LBB10_10:
	xorl	%eax, %eax
.LBB10_11:
	retq
.Lfunc_end10:
	.size	sparse_switch, .Lfunc_end10-sparse_switch
                                        # -- End function
	.globl	two_cases                       # -- Begin function two_cases
	.p2align	4, 0x90
	.type	two_cases,@function
two_cases:                              # @two_cases
# %bb.0:
	xorl	%eax, %eax
	cmpl	$4, %edi
	sete	%al
	leal	(%rax,%rax,8), %ecx
	cmpl	$3, %edi
	movl	$7, %eax
	cmovnel	%ecx, %eax
	retq
.Lfunc_end11:
	.size	two_cases, .Lfunc_end11-two_cases
                                        # -- End function
	.globl	clamp_max                       # -- Begin function clamp_max
	.p2align	4, 0x90
	.type	clamp_max,@function
clamp_max:                              # @clamp_max
# %bb.0:
	movl	%esi, %eax
	cmpl	%esi, %edi
	cmovgl	%edi, %eax
	retq
.Lfunc_end12:
	.size	clamp_max, .Lfunc_end12-clamp_max
                                        # -- End function
	.globl	abs_int                         # -- Begin function abs_int
	.p2align	4, 0x90
	.type	abs_int,@function
abs_int:                                # @abs_int
# %bb.0:
	movl	%edi, %eax
	negl	%eax
	cmovsl	%edi, %eax
	retq
.Lfunc_end13:
	.size	abs_int, .Lfunc_end13-abs_int
                                        # -- End function
	.globl	is_pos                          # -- Begin function is_pos
	.p2align	4, 0x90
	.type	is_pos,@function
is_pos:                                 # @is_pos
# %bb.0:
	xorl	%eax, %eax
	testl	%edi, %edi
	setg	%al
	retq
.Lfunc_end14:
	.size	is_pos, .Lfunc_end14-is_pos
                                        # -- End function
	.globl	tail_caller                     # -- Begin function tail_caller
	.p2align	4, 0x90
	.type	tail_caller,@function
tail_caller:                            # @tail_caller
# %bb.0:
	incl	%edi
	jmp	tail_target@PLT                 # TAILCALL
.Lfunc_end15:
	.size	tail_caller, .Lfunc_end15-tail_caller
                                        # -- End function
	.globl	leaf_add                        # -- Begin function leaf_add
	.p2align	4, 0x90
	.type	leaf_add,@function
leaf_add:                               # @leaf_add
# %bb.0:
                                        # kill: def $esi killed $esi def $rsi
                                        # kill: def $edi killed $edi def $rdi
	leal	(%rdi,%rsi), %eax
	retq
.Lfunc_end16:
	.size	leaf_add, .Lfunc_end16-leaf_add
                                        # -- End function
	.globl	twice_sum                       # -- Begin function twice_sum
	.p2align	4, 0x90
	.type	twice_sum,@function
twice_sum:                              # @twice_sum
# %bb.0:
                                        # kill: def $esi killed $esi def $rsi
                                        # kill: def $edi killed $edi def $rdi
	leal	(%rdi,%rsi), %eax
	addl	%eax, %eax
	retq
.Lfunc_end17:
	.size	twice_sum, .Lfunc_end17-twice_sum
                                        # -- End function
	.globl	sum_n                           # -- Begin function sum_n
	.p2align	4, 0x90
	.type	sum_n,@function
sum_n:                                  # @sum_n
# %bb.0:
	testl	%esi, %esi
	jle	.LBB18_1
# %bb.3:
	movl	%esi, %ecx
	xorl	%edx, %edx
	xorl	%eax, %eax
	.p2align	4, 0x90
.LBB18_4:                               # =>This Inner Loop Header: Depth=1
	addl	(%rdi,%rdx,4), %eax
	incq	%rdx
	cmpq	%rdx, %rcx
	jne	.LBB18_4
# %bb.2:
	retq
.LBB18_1:
	xorl	%eax, %eax
	retq
.Lfunc_end18:
	.size	sum_n, .Lfunc_end18-sum_n
                                        # -- End function
	.globl	sum4                            # -- Begin function sum4
	.p2align	4, 0x90
	.type	sum4,@function
sum4:                                   # @sum4
# %bb.0:
	xorl	%ecx, %ecx
	xorl	%eax, %eax
	.p2align	4, 0x90
.LBB19_1:                               # =>This Inner Loop Header: Depth=1
	addl	(%rdi,%rcx,4), %eax
	incq	%rcx
	cmpq	$4, %rcx
	jne	.LBB19_1
# %bb.2:
	retq
.Lfunc_end19:
	.size	sum4, .Lfunc_end19-sum4
                                        # -- End function
	.globl	poly8                           # -- Begin function poly8
	.p2align	4, 0x90
	.type	poly8,@function
poly8:                                  # @poly8
# %bb.0:
	xorl	%ecx, %ecx
	xorl	%eax, %eax
	.p2align	4, 0x90
.LBB20_1:                               # =>This Inner Loop Header: Depth=1
	movl	%eax, %edx
	shll	$5, %edx
	subl	%eax, %edx
	movl	%edx, %eax
	addl	(%rdi,%rcx,4), %eax
	incq	%rcx
	cmpq	$8, %rcx
	jne	.LBB20_1
# %bb.2:
	retq
.Lfunc_end20:
	.size	poly8, .Lfunc_end20-poly8
                                        # -- End function
	.globl	fill                            # -- Begin function fill
	.p2align	4, 0x90
	.type	fill,@function
fill:                                   # @fill
# %bb.0:
	testl	%esi, %esi
	jle	.LBB21_1
# %bb.2:
	movl	%esi, %edx
	xorl	%esi, %esi
	jmp	memset@PLT                      # TAILCALL
.LBB21_1:
	retq
.Lfunc_end21:
	.size	fill, .Lfunc_end21-fill
                                        # -- End function
	.globl	copy_n                          # -- Begin function copy_n
	.p2align	4, 0x90
	.type	copy_n,@function
copy_n:                                 # @copy_n
# %bb.0:
	jmp	memcpy@PLT                      # TAILCALL
.Lfunc_end22:
	.size	copy_n, .Lfunc_end22-copy_n
                                        # -- End function
	.globl	copy16                          # -- Begin function copy16
	.p2align	4, 0x90
	.type	copy16,@function
copy16:                                 # @copy16
# %bb.0:
	movups	(%rsi), %xmm0
	movups	%xmm0, (%rdi)
	retq
.Lfunc_end23:
	.size	copy16, .Lfunc_end23-copy16
                                        # -- End function
	.globl	digest                          # -- Begin function digest
	.p2align	4, 0x90
	.type	digest,@function
digest:                                 # @digest
# %bb.0:
	xorl	%ecx, %ecx
	movl	$0, %eax
	testl	%esi, %esi
	jle	.LBB24_3
# %bb.1:
	movl	%esi, %edx
	xorl	%esi, %esi
	xorl	%eax, %eax
	.p2align	4, 0x90
.LBB24_2:                               # =>This Inner Loop Header: Depth=1
	addl	(%rdi,%rsi,4), %eax
	incq	%rsi
	cmpq	%rsi, %rdx
	jne	.LBB24_2
.LBB24_3:
	movslq	%eax, %rdx
	imulq	$1717986919, %rdx, %rax         # imm = 0x66666667
	movq	%rax, %rsi
	shrq	$63, %rsi
	sarq	$34, %rax
	leal	(%rax,%rsi), %edi
	addl	%edi, %edi
	leal	(%rdi,%rdi,4), %edi
	subl	%edi, %edx
	addl	%esi, %eax
	addl	$-6, %eax
	cmpl	$5, %eax
	jae	.LBB24_5
# %bb.4:
	movl	%eax, %eax
	leaq	.Lswitch.table.digest(%rip), %rcx
	movl	(%rcx,%rax,4), %ecx
.LBB24_5:
	cmpl	$5, %edx
	movl	$5, %eax
	cmovll	%edx, %eax
	addl	%ecx, %eax
	retq
.Lfunc_end24:
	.size	digest, .Lfunc_end24-digest
                                        # -- End function
	.type	.Lswitch.table.table_switch,@object # @switch.table.table_switch
	.section	.rodata,"a",@progbits
	.p2align	2, 0x0
.Lswitch.table.table_switch:
	.long	10                              # 0xa
	.long	20                              # 0x14
	.long	30                              # 0x1e
	.long	40                              # 0x28
	.long	50                              # 0x32
	.long	60                              # 0x3c
	.long	71                              # 0x47
	.size	.Lswitch.table.table_switch, 28

	.type	.Lswitch.table.digest,@object   # @switch.table.digest
	.p2align	2, 0x0
.Lswitch.table.digest:
	.long	16                              # 0x10
	.long	32                              # 0x20
	.long	64                              # 0x40
	.long	128                             # 0x80
	.long	128                             # 0x80
	.size	.Lswitch.table.digest, 20

	.ident	"Apple clang version 17.0.0 (clang-1700.6.3.2)"
	.section	".note.GNU-stack","",@progbits
	.addrsig
