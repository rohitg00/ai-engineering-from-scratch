/* figures-re-41.js - lesson 41: struct layout recovery from memory accesses against DWARF 5.
   DATA is the output of python3 code/main.py figure-data in the lesson folder.
   Every access, field, stride, and status below comes from the type-recovery pass in that
   lesson run over the three account objects. The test suite checks that this copy matches. */
(function () {
  'use strict';

  var LF = window.LF;
  if (!LF) return;

  var el = LF.el;
  var svgEl = LF.svgEl;
  var INK = 'var(--ink,#1a1a1a)';
  var MUTE = 'var(--ink-mute,#7a7a78)';
  var BP = 'var(--blueprint,#3553ff)';
  var SURF = 'var(--bg-surface,#f3f1e8)';
  var RULE = 'var(--rule-soft,rgba(26,26,26,0.16))';
  var WARN = 'var(--warn,#b8870f)';
  var BG = 'var(--bg,#fafaf5)';
  var MONO = 'var(--font-mono,monospace)';

  var DATA = {"struct":"account","truth":{"size":32,"align":8,"members":[{"n":"kind","t":"char","o":0,"s":1,"k":"int"},{"n":"balance","t":"int","o":4,"s":4,"k":"int"},{"n":"code","t":"short","o":8,"s":2,"k":"int"},{"n":"rate","t":"double","o":16,"s":8,"k":"float"},{"n":"label","t":"const char *","o":24,"s":8,"k":"pointer"}],"padding":[1,2,3,10,11,12,13,14,15]},"order":["bump","sum_balances","tag","projected","label_length","main"],"builds":{"O0":{"object":"account-x86_64-O0-g.o","steps":[{"function":"bump","accesses":[{"f":"bump","a":18,"t":"addl 0x4(%rax), %ecx","o":4,"w":4,"k":"int","r":"param0"},{"f":"bump","a":21,"t":"movl %ecx, 0x4(%rax)","o":4,"w":4,"k":"int","r":"param0"},{"f":"bump","a":28,"t":"movl 0x4(%rax), %eax","o":4,"w":4,"k":"int","r":"param0"}],"callSites":[],"fields":[{"o":4,"s":4,"k":"int","l":"int32","n":3,"p":0}],"stride":null,"strideEvidence":[],"size":null,"lowerBound":8,"rows":[{"m":"kind","o":0,"t":"char","i":null,"s":"no-evidence"},{"m":"balance","o":4,"t":"int","i":"int32","s":"match"},{"m":"code","o":8,"t":"short","i":null,"s":"no-evidence"},{"m":"rate","o":16,"t":"double","i":null,"s":"no-evidence"},{"m":"label","o":24,"t":"const char *","i":null,"s":"no-evidence"}],"sizeStatus":"unknown","conflicts":0},{"function":"sum_balances","accesses":[{"f":"bump","a":18,"t":"addl 0x4(%rax), %ecx","o":4,"w":4,"k":"int","r":"param0"},{"f":"bump","a":21,"t":"movl %ecx, 0x4(%rax)","o":4,"w":4,"k":"int","r":"param0"},{"f":"bump","a":28,"t":"movl 0x4(%rax), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":96,"t":"movl 0x4(%rax), %eax","o":4,"w":4,"k":"int","r":"param0"}],"callSites":[],"fields":[{"o":4,"s":4,"k":"int","l":"int32","n":4,"p":0}],"stride":32,"strideEvidence":[{"v":32,"k":"scale","f":"sum_balances","a":96}],"size":32,"lowerBound":8,"rows":[{"m":"kind","o":0,"t":"char","i":null,"s":"no-evidence"},{"m":"balance","o":4,"t":"int","i":"int32","s":"match"},{"m":"code","o":8,"t":"short","i":null,"s":"no-evidence"},{"m":"rate","o":16,"t":"double","i":null,"s":"no-evidence"},{"m":"label","o":24,"t":"const char *","i":null,"s":"no-evidence"}],"sizeStatus":"match","conflicts":0},{"function":"tag","accesses":[{"f":"bump","a":18,"t":"addl 0x4(%rax), %ecx","o":4,"w":4,"k":"int","r":"param0"},{"f":"bump","a":21,"t":"movl %ecx, 0x4(%rax)","o":4,"w":4,"k":"int","r":"param0"},{"f":"bump","a":28,"t":"movl 0x4(%rax), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":96,"t":"movl 0x4(%rax), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"tag","a":140,"t":"movsbl (%rax), %eax","o":0,"w":1,"k":"int","r":"param0"},{"f":"tag","a":152,"t":"movswl 0x8(%rax), %ecx","o":8,"w":2,"k":"int","r":"param0"},{"f":"tag","a":169,"t":"movswl 0x8(%rax), %eax","o":8,"w":2,"k":"int","r":"param0"}],"callSites":[],"fields":[{"o":0,"s":1,"k":"int","l":"i8","n":1,"p":0},{"o":4,"s":4,"k":"int","l":"int32","n":4,"p":0},{"o":8,"s":2,"k":"int","l":"i16","n":2,"p":0}],"stride":32,"strideEvidence":[{"v":32,"k":"scale","f":"sum_balances","a":96}],"size":32,"lowerBound":10,"rows":[{"m":"kind","o":0,"t":"char","i":"i8","s":"match"},{"m":"balance","o":4,"t":"int","i":"int32","s":"match"},{"m":"code","o":8,"t":"short","i":"i16","s":"match"},{"m":"rate","o":16,"t":"double","i":null,"s":"no-evidence"},{"m":"label","o":24,"t":"const char *","i":null,"s":"no-evidence"}],"sizeStatus":"match","conflicts":0},{"function":"projected","accesses":[{"f":"bump","a":18,"t":"addl 0x4(%rax), %ecx","o":4,"w":4,"k":"int","r":"param0"},{"f":"bump","a":21,"t":"movl %ecx, 0x4(%rax)","o":4,"w":4,"k":"int","r":"param0"},{"f":"bump","a":28,"t":"movl 0x4(%rax), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":96,"t":"movl 0x4(%rax), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"tag","a":140,"t":"movsbl (%rax), %eax","o":0,"w":1,"k":"int","r":"param0"},{"f":"tag","a":152,"t":"movswl 0x8(%rax), %ecx","o":8,"w":2,"k":"int","r":"param0"},{"f":"tag","a":169,"t":"movswl 0x8(%rax), %eax","o":8,"w":2,"k":"int","r":"param0"},{"f":"projected","a":204,"t":"cvtsi2sdl 0x4(%rax), %xmm0","o":4,"w":4,"k":"int","r":"param0"},{"f":"projected","a":213,"t":"mulsd 0x10(%rax), %xmm0","o":16,"w":8,"k":"float","r":"param0"}],"callSites":[],"fields":[{"o":0,"s":1,"k":"int","l":"i8","n":1,"p":0},{"o":4,"s":4,"k":"int","l":"i32","n":5,"p":0},{"o":8,"s":2,"k":"int","l":"i16","n":2,"p":0},{"o":16,"s":8,"k":"float","l":"float64","n":1,"p":0}],"stride":32,"strideEvidence":[{"v":32,"k":"scale","f":"sum_balances","a":96}],"size":32,"lowerBound":24,"rows":[{"m":"kind","o":0,"t":"char","i":"i8","s":"match"},{"m":"balance","o":4,"t":"int","i":"i32","s":"match"},{"m":"code","o":8,"t":"short","i":"i16","s":"match"},{"m":"rate","o":16,"t":"double","i":"float64","s":"match"},{"m":"label","o":24,"t":"const char *","i":null,"s":"no-evidence"}],"sizeStatus":"match","conflicts":0},{"function":"label_length","accesses":[{"f":"bump","a":18,"t":"addl 0x4(%rax), %ecx","o":4,"w":4,"k":"int","r":"param0"},{"f":"bump","a":21,"t":"movl %ecx, 0x4(%rax)","o":4,"w":4,"k":"int","r":"param0"},{"f":"bump","a":28,"t":"movl 0x4(%rax), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":96,"t":"movl 0x4(%rax), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"tag","a":140,"t":"movsbl (%rax), %eax","o":0,"w":1,"k":"int","r":"param0"},{"f":"tag","a":152,"t":"movswl 0x8(%rax), %ecx","o":8,"w":2,"k":"int","r":"param0"},{"f":"tag","a":169,"t":"movswl 0x8(%rax), %eax","o":8,"w":2,"k":"int","r":"param0"},{"f":"projected","a":204,"t":"cvtsi2sdl 0x4(%rax), %xmm0","o":4,"w":4,"k":"int","r":"param0"},{"f":"projected","a":213,"t":"mulsd 0x10(%rax), %xmm0","o":16,"w":8,"k":"float","r":"param0"},{"f":"label_length","a":243,"t":"movq 0x18(%rax), %rax","o":24,"w":8,"k":"int","r":"param0"},{"f":"label_length","a":251,"t":"cmpb $0x0, (%rax,%rcx)","o":0,"w":1,"k":"int","r":"param0->0x18"}],"callSites":[],"fields":[{"o":0,"s":1,"k":"int","l":"i8","n":1,"p":0},{"o":4,"s":4,"k":"int","l":"i32","n":5,"p":0},{"o":8,"s":2,"k":"int","l":"i16","n":2,"p":0},{"o":16,"s":8,"k":"float","l":"float64","n":1,"p":0},{"o":24,"s":8,"k":"pointer","l":"pointer","n":1,"p":1}],"stride":32,"strideEvidence":[{"v":32,"k":"scale","f":"sum_balances","a":96}],"size":32,"lowerBound":32,"rows":[{"m":"kind","o":0,"t":"char","i":"i8","s":"match"},{"m":"balance","o":4,"t":"int","i":"i32","s":"match"},{"m":"code","o":8,"t":"short","i":"i16","s":"match"},{"m":"rate","o":16,"t":"double","i":"float64","s":"match"},{"m":"label","o":24,"t":"const char *","i":"pointer","s":"match"}],"sizeStatus":"match","conflicts":0},{"function":"main","accesses":[{"f":"bump","a":18,"t":"addl 0x4(%rax), %ecx","o":4,"w":4,"k":"int","r":"param0"},{"f":"bump","a":21,"t":"movl %ecx, 0x4(%rax)","o":4,"w":4,"k":"int","r":"param0"},{"f":"bump","a":28,"t":"movl 0x4(%rax), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":96,"t":"movl 0x4(%rax), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"tag","a":140,"t":"movsbl (%rax), %eax","o":0,"w":1,"k":"int","r":"param0"},{"f":"tag","a":152,"t":"movswl 0x8(%rax), %ecx","o":8,"w":2,"k":"int","r":"param0"},{"f":"tag","a":169,"t":"movswl 0x8(%rax), %eax","o":8,"w":2,"k":"int","r":"param0"},{"f":"projected","a":204,"t":"cvtsi2sdl 0x4(%rax), %xmm0","o":4,"w":4,"k":"int","r":"param0"},{"f":"projected","a":213,"t":"mulsd 0x10(%rax), %xmm0","o":16,"w":8,"k":"float","r":"param0"},{"f":"label_length","a":243,"t":"movq 0x18(%rax), %rax","o":24,"w":8,"k":"int","r":"param0"},{"f":"label_length","a":251,"t":"cmpb $0x0, (%rax,%rcx)","o":0,"w":1,"k":"int","r":"param0->0x18"}],"callSites":[{"a":322,"c":"memcpy","arg":"frame(rbp-0x70)"},{"a":404,"c":"bump","arg":"frame(rbp-0x70)0x20"},{"a":418,"c":"sum_balances","arg":"frame(rbp-0x70)"},{"a":434,"c":"tag","arg":"frame(rbp-0x70)0x40"},{"a":450,"c":"projected","arg":"frame(rbp-0x70)0x20"},{"a":468,"c":"label_length","arg":"frame(rbp-0x70)0x20"}],"fields":[{"o":0,"s":1,"k":"int","l":"i8","n":1,"p":0},{"o":4,"s":4,"k":"int","l":"i32","n":5,"p":0},{"o":8,"s":2,"k":"int","l":"i16","n":2,"p":0},{"o":16,"s":8,"k":"float","l":"float64","n":1,"p":0},{"o":24,"s":8,"k":"pointer","l":"pointer","n":1,"p":1}],"stride":32,"strideEvidence":[{"v":32,"k":"scale","f":"sum_balances","a":96},{"v":32,"k":"call-site","f":"main","a":0},{"v":64,"k":"call-site","f":"main","a":0}],"size":32,"lowerBound":32,"rows":[{"m":"kind","o":0,"t":"char","i":"i8","s":"match"},{"m":"balance","o":4,"t":"int","i":"i32","s":"match"},{"m":"code","o":8,"t":"short","i":"i16","s":"match"},{"m":"rate","o":16,"t":"double","i":"float64","s":"match"},{"m":"label","o":24,"t":"const char *","i":"pointer","s":"match"}],"sizeStatus":"match","conflicts":0}]},"O1":{"object":"account-x86_64-O1-g.o","steps":[{"function":"bump","accesses":[{"f":"bump","a":2,"t":"addl 0x4(%rdi), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"bump","a":5,"t":"movl %eax, 0x4(%rdi)","o":4,"w":4,"k":"int","r":"param0"}],"callSites":[],"fields":[{"o":4,"s":4,"k":"int","l":"int32","n":2,"p":0}],"stride":null,"strideEvidence":[],"size":null,"lowerBound":8,"rows":[{"m":"kind","o":0,"t":"char","i":null,"s":"no-evidence"},{"m":"balance","o":4,"t":"int","i":"int32","s":"match"},{"m":"code","o":8,"t":"short","i":null,"s":"no-evidence"},{"m":"rate","o":16,"t":"double","i":null,"s":"no-evidence"},{"m":"label","o":24,"t":"const char *","i":null,"s":"no-evidence"}],"sizeStatus":"unknown","conflicts":0},{"function":"sum_balances","accesses":[{"f":"bump","a":2,"t":"addl 0x4(%rdi), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"bump","a":5,"t":"movl %eax, 0x4(%rdi)","o":4,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":32,"t":"addl 0x4(%rdi,%rdx), %eax","o":4,"w":4,"k":"int","r":"param0"}],"callSites":[],"fields":[{"o":4,"s":4,"k":"int","l":"int32","n":3,"p":0}],"stride":32,"strideEvidence":[{"v":32,"k":"loop-step","f":"sum_balances","a":36}],"size":32,"lowerBound":8,"rows":[{"m":"kind","o":0,"t":"char","i":null,"s":"no-evidence"},{"m":"balance","o":4,"t":"int","i":"int32","s":"match"},{"m":"code","o":8,"t":"short","i":null,"s":"no-evidence"},{"m":"rate","o":16,"t":"double","i":null,"s":"no-evidence"},{"m":"label","o":24,"t":"const char *","i":null,"s":"no-evidence"}],"sizeStatus":"match","conflicts":0},{"function":"tag","accesses":[{"f":"bump","a":2,"t":"addl 0x4(%rdi), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"bump","a":5,"t":"movl %eax, 0x4(%rdi)","o":4,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":32,"t":"addl 0x4(%rdi,%rdx), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"tag","a":64,"t":"movswl 0x8(%rdi), %ecx","o":8,"w":2,"k":"int","r":"param0"},{"f":"tag","a":72,"t":"cmpb $0x6c, (%rdi)","o":0,"w":1,"k":"int","r":"param0"}],"callSites":[],"fields":[{"o":0,"s":1,"k":"int","l":"int8","n":1,"p":0},{"o":4,"s":4,"k":"int","l":"int32","n":3,"p":0},{"o":8,"s":2,"k":"int","l":"i16","n":1,"p":0}],"stride":32,"strideEvidence":[{"v":32,"k":"loop-step","f":"sum_balances","a":36}],"size":32,"lowerBound":10,"rows":[{"m":"kind","o":0,"t":"char","i":"int8","s":"match"},{"m":"balance","o":4,"t":"int","i":"int32","s":"match"},{"m":"code","o":8,"t":"short","i":"i16","s":"match"},{"m":"rate","o":16,"t":"double","i":null,"s":"no-evidence"},{"m":"label","o":24,"t":"const char *","i":null,"s":"no-evidence"}],"sizeStatus":"match","conflicts":0},{"function":"projected","accesses":[{"f":"bump","a":2,"t":"addl 0x4(%rdi), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"bump","a":5,"t":"movl %eax, 0x4(%rdi)","o":4,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":32,"t":"addl 0x4(%rdi,%rdx), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"tag","a":64,"t":"movswl 0x8(%rdi), %ecx","o":8,"w":2,"k":"int","r":"param0"},{"f":"tag","a":72,"t":"cmpb $0x6c, (%rdi)","o":0,"w":1,"k":"int","r":"param0"},{"f":"projected","a":80,"t":"cvtsi2sdl 0x4(%rdi), %xmm0","o":4,"w":4,"k":"int","r":"param0"},{"f":"projected","a":85,"t":"mulsd 0x10(%rdi), %xmm0","o":16,"w":8,"k":"float","r":"param0"}],"callSites":[],"fields":[{"o":0,"s":1,"k":"int","l":"int8","n":1,"p":0},{"o":4,"s":4,"k":"int","l":"i32","n":4,"p":0},{"o":8,"s":2,"k":"int","l":"i16","n":1,"p":0},{"o":16,"s":8,"k":"float","l":"float64","n":1,"p":0}],"stride":32,"strideEvidence":[{"v":32,"k":"loop-step","f":"sum_balances","a":36}],"size":32,"lowerBound":24,"rows":[{"m":"kind","o":0,"t":"char","i":"int8","s":"match"},{"m":"balance","o":4,"t":"int","i":"i32","s":"match"},{"m":"code","o":8,"t":"short","i":"i16","s":"match"},{"m":"rate","o":16,"t":"double","i":"float64","s":"match"},{"m":"label","o":24,"t":"const char *","i":null,"s":"no-evidence"}],"sizeStatus":"match","conflicts":0},{"function":"label_length","accesses":[{"f":"bump","a":2,"t":"addl 0x4(%rdi), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"bump","a":5,"t":"movl %eax, 0x4(%rdi)","o":4,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":32,"t":"addl 0x4(%rdi,%rdx), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"tag","a":64,"t":"movswl 0x8(%rdi), %ecx","o":8,"w":2,"k":"int","r":"param0"},{"f":"tag","a":72,"t":"cmpb $0x6c, (%rdi)","o":0,"w":1,"k":"int","r":"param0"},{"f":"projected","a":80,"t":"cvtsi2sdl 0x4(%rdi), %xmm0","o":4,"w":4,"k":"int","r":"param0"},{"f":"projected","a":85,"t":"mulsd 0x10(%rdi), %xmm0","o":16,"w":8,"k":"float","r":"param0"},{"f":"label_length","a":96,"t":"movq 0x18(%rdi), %rcx","o":24,"w":8,"k":"int","r":"param0"},{"f":"label_length","a":114,"t":"cmpb $0x0, (%rcx)","o":0,"w":1,"k":"int","r":"param0->0x18"}],"callSites":[],"fields":[{"o":0,"s":1,"k":"int","l":"int8","n":1,"p":0},{"o":4,"s":4,"k":"int","l":"i32","n":4,"p":0},{"o":8,"s":2,"k":"int","l":"i16","n":1,"p":0},{"o":16,"s":8,"k":"float","l":"float64","n":1,"p":0},{"o":24,"s":8,"k":"pointer","l":"pointer","n":1,"p":2}],"stride":32,"strideEvidence":[{"v":32,"k":"loop-step","f":"sum_balances","a":36}],"size":32,"lowerBound":32,"rows":[{"m":"kind","o":0,"t":"char","i":"int8","s":"match"},{"m":"balance","o":4,"t":"int","i":"i32","s":"match"},{"m":"code","o":8,"t":"short","i":"i16","s":"match"},{"m":"rate","o":16,"t":"double","i":"float64","s":"match"},{"m":"label","o":24,"t":"const char *","i":"pointer","s":"match"}],"sizeStatus":"match","conflicts":0},{"function":"main","accesses":[{"f":"bump","a":2,"t":"addl 0x4(%rdi), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"bump","a":5,"t":"movl %eax, 0x4(%rdi)","o":4,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":32,"t":"addl 0x4(%rdi,%rdx), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"tag","a":64,"t":"movswl 0x8(%rdi), %ecx","o":8,"w":2,"k":"int","r":"param0"},{"f":"tag","a":72,"t":"cmpb $0x6c, (%rdi)","o":0,"w":1,"k":"int","r":"param0"},{"f":"projected","a":80,"t":"cvtsi2sdl 0x4(%rdi), %xmm0","o":4,"w":4,"k":"int","r":"param0"},{"f":"projected","a":85,"t":"mulsd 0x10(%rdi), %xmm0","o":16,"w":8,"k":"float","r":"param0"},{"f":"label_length","a":96,"t":"movq 0x18(%rdi), %rcx","o":24,"w":8,"k":"int","r":"param0"},{"f":"label_length","a":114,"t":"cmpb $0x0, (%rcx)","o":0,"w":1,"k":"int","r":"param0->0x18"}],"callSites":[],"fields":[{"o":0,"s":1,"k":"int","l":"int8","n":1,"p":0},{"o":4,"s":4,"k":"int","l":"i32","n":4,"p":0},{"o":8,"s":2,"k":"int","l":"i16","n":1,"p":0},{"o":16,"s":8,"k":"float","l":"float64","n":1,"p":0},{"o":24,"s":8,"k":"pointer","l":"pointer","n":1,"p":2}],"stride":32,"strideEvidence":[{"v":32,"k":"loop-step","f":"sum_balances","a":36}],"size":32,"lowerBound":32,"rows":[{"m":"kind","o":0,"t":"char","i":"int8","s":"match"},{"m":"balance","o":4,"t":"int","i":"i32","s":"match"},{"m":"code","o":8,"t":"short","i":"i16","s":"match"},{"m":"rate","o":16,"t":"double","i":"float64","s":"match"},{"m":"label","o":24,"t":"const char *","i":"pointer","s":"match"}],"sizeStatus":"match","conflicts":0}]},"O2":{"object":"account-x86_64-O2-g.o","steps":[{"function":"bump","accesses":[{"f":"bump","a":2,"t":"addl 0x4(%rdi), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"bump","a":5,"t":"movl %eax, 0x4(%rdi)","o":4,"w":4,"k":"int","r":"param0"}],"callSites":[],"fields":[{"o":4,"s":4,"k":"int","l":"int32","n":2,"p":0}],"stride":null,"strideEvidence":[],"size":null,"lowerBound":8,"rows":[{"m":"kind","o":0,"t":"char","i":null,"s":"no-evidence"},{"m":"balance","o":4,"t":"int","i":"int32","s":"match"},{"m":"code","o":8,"t":"short","i":null,"s":"no-evidence"},{"m":"rate","o":16,"t":"double","i":null,"s":"no-evidence"},{"m":"label","o":24,"t":"const char *","i":null,"s":"no-evidence"}],"sizeStatus":"unknown","conflicts":0},{"function":"sum_balances","accesses":[{"f":"bump","a":2,"t":"addl 0x4(%rdi), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"bump","a":5,"t":"movl %eax, 0x4(%rdi)","o":4,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":80,"t":"movd -0x80(%rax), %xmm2","o":100,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":85,"t":"movd -0xa0(%rax), %xmm3","o":68,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":97,"t":"movd -0xc0(%rax), %xmm2","o":36,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":105,"t":"movd -0xe0(%rax), %xmm4","o":4,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":125,"t":"movd (%rax), %xmm2","o":228,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":129,"t":"movd -0x20(%rax), %xmm3","o":196,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":138,"t":"movd -0x40(%rax), %xmm2","o":164,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":143,"t":"movd -0x60(%rax), %xmm4","o":132,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":224,"t":"addl (%rdx), %eax","o":4,"w":4,"k":"int","r":"param0"}],"callSites":[],"fields":[{"o":4,"s":4,"k":"int","l":"int32","n":11,"p":0}],"stride":32,"strideEvidence":[{"v":32,"k":"offset-delta","f":"sum_balances","a":80},{"v":32,"k":"unrolled","f":"sum_balances","a":80},{"v":256,"k":"loop-step","f":"sum_balances","a":160},{"v":32,"k":"scale","f":"sum_balances","a":224},{"v":32,"k":"loop-step","f":"sum_balances","a":226}],"size":32,"lowerBound":8,"rows":[{"m":"kind","o":0,"t":"char","i":null,"s":"no-evidence"},{"m":"balance","o":4,"t":"int","i":"int32","s":"match"},{"m":"code","o":8,"t":"short","i":null,"s":"no-evidence"},{"m":"rate","o":16,"t":"double","i":null,"s":"no-evidence"},{"m":"label","o":24,"t":"const char *","i":null,"s":"no-evidence"}],"sizeStatus":"match","conflicts":0,"raw":{"fields":[{"o":4,"s":4,"k":"int","l":"int32","n":4,"p":0},{"o":36,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":68,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":100,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":132,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":164,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":196,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":228,"s":4,"k":"int","l":"int32","n":1,"p":0}],"stride":32,"strideEvidence":[{"v":32,"k":"offset-delta","f":"sum_balances","a":80},{"v":32,"k":"unrolled","f":"sum_balances","a":80},{"v":256,"k":"loop-step","f":"sum_balances","a":160},{"v":32,"k":"scale","f":"sum_balances","a":224},{"v":32,"k":"loop-step","f":"sum_balances","a":226}],"size":null,"lowerBound":232,"rows":[{"m":"kind","o":0,"t":"char","i":null,"s":"no-evidence"},{"m":"balance","o":4,"t":"int","i":"int32","s":"match"},{"m":"code","o":8,"t":"short","i":null,"s":"no-evidence"},{"m":"rate","o":16,"t":"double","i":null,"s":"no-evidence"},{"m":"label","o":24,"t":"const char *","i":null,"s":"no-evidence"},{"m":null,"o":36,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":68,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":100,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":132,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":164,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":196,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":228,"t":"padding","i":"int32","s":"unexpected"}],"sizeStatus":"unknown","conflicts":0}},{"function":"tag","accesses":[{"f":"bump","a":2,"t":"addl 0x4(%rdi), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"bump","a":5,"t":"movl %eax, 0x4(%rdi)","o":4,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":80,"t":"movd -0x80(%rax), %xmm2","o":100,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":85,"t":"movd -0xa0(%rax), %xmm3","o":68,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":97,"t":"movd -0xc0(%rax), %xmm2","o":36,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":105,"t":"movd -0xe0(%rax), %xmm4","o":4,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":125,"t":"movd (%rax), %xmm2","o":228,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":129,"t":"movd -0x20(%rax), %xmm3","o":196,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":138,"t":"movd -0x40(%rax), %xmm2","o":164,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":143,"t":"movd -0x60(%rax), %xmm4","o":132,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":224,"t":"addl (%rdx), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"tag","a":240,"t":"movswl 0x8(%rdi), %ecx","o":8,"w":2,"k":"int","r":"param0"},{"f":"tag","a":248,"t":"cmpb $0x6c, (%rdi)","o":0,"w":1,"k":"int","r":"param0"}],"callSites":[],"fields":[{"o":0,"s":1,"k":"int","l":"int8","n":1,"p":0},{"o":4,"s":4,"k":"int","l":"int32","n":11,"p":0},{"o":8,"s":2,"k":"int","l":"i16","n":1,"p":0}],"stride":32,"strideEvidence":[{"v":32,"k":"offset-delta","f":"sum_balances","a":80},{"v":32,"k":"unrolled","f":"sum_balances","a":80},{"v":256,"k":"loop-step","f":"sum_balances","a":160},{"v":32,"k":"scale","f":"sum_balances","a":224},{"v":32,"k":"loop-step","f":"sum_balances","a":226}],"size":32,"lowerBound":10,"rows":[{"m":"kind","o":0,"t":"char","i":"int8","s":"match"},{"m":"balance","o":4,"t":"int","i":"int32","s":"match"},{"m":"code","o":8,"t":"short","i":"i16","s":"match"},{"m":"rate","o":16,"t":"double","i":null,"s":"no-evidence"},{"m":"label","o":24,"t":"const char *","i":null,"s":"no-evidence"}],"sizeStatus":"match","conflicts":0,"raw":{"fields":[{"o":0,"s":1,"k":"int","l":"int8","n":1,"p":0},{"o":4,"s":4,"k":"int","l":"int32","n":4,"p":0},{"o":8,"s":2,"k":"int","l":"i16","n":1,"p":0},{"o":36,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":68,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":100,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":132,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":164,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":196,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":228,"s":4,"k":"int","l":"int32","n":1,"p":0}],"stride":32,"strideEvidence":[{"v":32,"k":"offset-delta","f":"sum_balances","a":80},{"v":32,"k":"unrolled","f":"sum_balances","a":80},{"v":256,"k":"loop-step","f":"sum_balances","a":160},{"v":32,"k":"scale","f":"sum_balances","a":224},{"v":32,"k":"loop-step","f":"sum_balances","a":226}],"size":null,"lowerBound":232,"rows":[{"m":"kind","o":0,"t":"char","i":"int8","s":"match"},{"m":"balance","o":4,"t":"int","i":"int32","s":"match"},{"m":"code","o":8,"t":"short","i":"i16","s":"match"},{"m":"rate","o":16,"t":"double","i":null,"s":"no-evidence"},{"m":"label","o":24,"t":"const char *","i":null,"s":"no-evidence"},{"m":null,"o":36,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":68,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":100,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":132,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":164,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":196,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":228,"t":"padding","i":"int32","s":"unexpected"}],"sizeStatus":"unknown","conflicts":0}},{"function":"projected","accesses":[{"f":"bump","a":2,"t":"addl 0x4(%rdi), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"bump","a":5,"t":"movl %eax, 0x4(%rdi)","o":4,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":80,"t":"movd -0x80(%rax), %xmm2","o":100,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":85,"t":"movd -0xa0(%rax), %xmm3","o":68,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":97,"t":"movd -0xc0(%rax), %xmm2","o":36,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":105,"t":"movd -0xe0(%rax), %xmm4","o":4,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":125,"t":"movd (%rax), %xmm2","o":228,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":129,"t":"movd -0x20(%rax), %xmm3","o":196,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":138,"t":"movd -0x40(%rax), %xmm2","o":164,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":143,"t":"movd -0x60(%rax), %xmm4","o":132,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":224,"t":"addl (%rdx), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"tag","a":240,"t":"movswl 0x8(%rdi), %ecx","o":8,"w":2,"k":"int","r":"param0"},{"f":"tag","a":248,"t":"cmpb $0x6c, (%rdi)","o":0,"w":1,"k":"int","r":"param0"},{"f":"projected","a":256,"t":"cvtsi2sdl 0x4(%rdi), %xmm0","o":4,"w":4,"k":"int","r":"param0"},{"f":"projected","a":261,"t":"mulsd 0x10(%rdi), %xmm0","o":16,"w":8,"k":"float","r":"param0"}],"callSites":[],"fields":[{"o":0,"s":1,"k":"int","l":"int8","n":1,"p":0},{"o":4,"s":4,"k":"int","l":"i32","n":12,"p":0},{"o":8,"s":2,"k":"int","l":"i16","n":1,"p":0},{"o":16,"s":8,"k":"float","l":"float64","n":1,"p":0}],"stride":32,"strideEvidence":[{"v":32,"k":"offset-delta","f":"sum_balances","a":80},{"v":32,"k":"unrolled","f":"sum_balances","a":80},{"v":256,"k":"loop-step","f":"sum_balances","a":160},{"v":32,"k":"scale","f":"sum_balances","a":224},{"v":32,"k":"loop-step","f":"sum_balances","a":226}],"size":32,"lowerBound":24,"rows":[{"m":"kind","o":0,"t":"char","i":"int8","s":"match"},{"m":"balance","o":4,"t":"int","i":"i32","s":"match"},{"m":"code","o":8,"t":"short","i":"i16","s":"match"},{"m":"rate","o":16,"t":"double","i":"float64","s":"match"},{"m":"label","o":24,"t":"const char *","i":null,"s":"no-evidence"}],"sizeStatus":"match","conflicts":0,"raw":{"fields":[{"o":0,"s":1,"k":"int","l":"int8","n":1,"p":0},{"o":4,"s":4,"k":"int","l":"i32","n":5,"p":0},{"o":8,"s":2,"k":"int","l":"i16","n":1,"p":0},{"o":16,"s":8,"k":"float","l":"float64","n":1,"p":0},{"o":36,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":68,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":100,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":132,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":164,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":196,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":228,"s":4,"k":"int","l":"int32","n":1,"p":0}],"stride":32,"strideEvidence":[{"v":32,"k":"offset-delta","f":"sum_balances","a":80},{"v":32,"k":"unrolled","f":"sum_balances","a":80},{"v":256,"k":"loop-step","f":"sum_balances","a":160},{"v":32,"k":"scale","f":"sum_balances","a":224},{"v":32,"k":"loop-step","f":"sum_balances","a":226}],"size":null,"lowerBound":232,"rows":[{"m":"kind","o":0,"t":"char","i":"int8","s":"match"},{"m":"balance","o":4,"t":"int","i":"i32","s":"match"},{"m":"code","o":8,"t":"short","i":"i16","s":"match"},{"m":"rate","o":16,"t":"double","i":"float64","s":"match"},{"m":"label","o":24,"t":"const char *","i":null,"s":"no-evidence"},{"m":null,"o":36,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":68,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":100,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":132,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":164,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":196,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":228,"t":"padding","i":"int32","s":"unexpected"}],"sizeStatus":"unknown","conflicts":0}},{"function":"label_length","accesses":[{"f":"bump","a":2,"t":"addl 0x4(%rdi), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"bump","a":5,"t":"movl %eax, 0x4(%rdi)","o":4,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":80,"t":"movd -0x80(%rax), %xmm2","o":100,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":85,"t":"movd -0xa0(%rax), %xmm3","o":68,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":97,"t":"movd -0xc0(%rax), %xmm2","o":36,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":105,"t":"movd -0xe0(%rax), %xmm4","o":4,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":125,"t":"movd (%rax), %xmm2","o":228,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":129,"t":"movd -0x20(%rax), %xmm3","o":196,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":138,"t":"movd -0x40(%rax), %xmm2","o":164,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":143,"t":"movd -0x60(%rax), %xmm4","o":132,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":224,"t":"addl (%rdx), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"tag","a":240,"t":"movswl 0x8(%rdi), %ecx","o":8,"w":2,"k":"int","r":"param0"},{"f":"tag","a":248,"t":"cmpb $0x6c, (%rdi)","o":0,"w":1,"k":"int","r":"param0"},{"f":"projected","a":256,"t":"cvtsi2sdl 0x4(%rdi), %xmm0","o":4,"w":4,"k":"int","r":"param0"},{"f":"projected","a":261,"t":"mulsd 0x10(%rdi), %xmm0","o":16,"w":8,"k":"float","r":"param0"},{"f":"label_length","a":272,"t":"movq 0x18(%rdi), %rcx","o":24,"w":8,"k":"int","r":"param0"},{"f":"label_length","a":290,"t":"cmpb $0x0, (%rcx)","o":0,"w":1,"k":"int","r":"param0->0x18"}],"callSites":[],"fields":[{"o":0,"s":1,"k":"int","l":"int8","n":1,"p":0},{"o":4,"s":4,"k":"int","l":"i32","n":12,"p":0},{"o":8,"s":2,"k":"int","l":"i16","n":1,"p":0},{"o":16,"s":8,"k":"float","l":"float64","n":1,"p":0},{"o":24,"s":8,"k":"pointer","l":"pointer","n":1,"p":2}],"stride":32,"strideEvidence":[{"v":32,"k":"offset-delta","f":"sum_balances","a":80},{"v":32,"k":"unrolled","f":"sum_balances","a":80},{"v":256,"k":"loop-step","f":"sum_balances","a":160},{"v":32,"k":"scale","f":"sum_balances","a":224},{"v":32,"k":"loop-step","f":"sum_balances","a":226}],"size":32,"lowerBound":32,"rows":[{"m":"kind","o":0,"t":"char","i":"int8","s":"match"},{"m":"balance","o":4,"t":"int","i":"i32","s":"match"},{"m":"code","o":8,"t":"short","i":"i16","s":"match"},{"m":"rate","o":16,"t":"double","i":"float64","s":"match"},{"m":"label","o":24,"t":"const char *","i":"pointer","s":"match"}],"sizeStatus":"match","conflicts":0,"raw":{"fields":[{"o":0,"s":1,"k":"int","l":"int8","n":1,"p":0},{"o":4,"s":4,"k":"int","l":"i32","n":5,"p":0},{"o":8,"s":2,"k":"int","l":"i16","n":1,"p":0},{"o":16,"s":8,"k":"float","l":"float64","n":1,"p":0},{"o":24,"s":8,"k":"pointer","l":"pointer","n":1,"p":2},{"o":36,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":68,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":100,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":132,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":164,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":196,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":228,"s":4,"k":"int","l":"int32","n":1,"p":0}],"stride":32,"strideEvidence":[{"v":32,"k":"offset-delta","f":"sum_balances","a":80},{"v":32,"k":"unrolled","f":"sum_balances","a":80},{"v":256,"k":"loop-step","f":"sum_balances","a":160},{"v":32,"k":"scale","f":"sum_balances","a":224},{"v":32,"k":"loop-step","f":"sum_balances","a":226}],"size":null,"lowerBound":232,"rows":[{"m":"kind","o":0,"t":"char","i":"int8","s":"match"},{"m":"balance","o":4,"t":"int","i":"i32","s":"match"},{"m":"code","o":8,"t":"short","i":"i16","s":"match"},{"m":"rate","o":16,"t":"double","i":"float64","s":"match"},{"m":"label","o":24,"t":"const char *","i":"pointer","s":"match"},{"m":null,"o":36,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":68,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":100,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":132,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":164,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":196,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":228,"t":"padding","i":"int32","s":"unexpected"}],"sizeStatus":"unknown","conflicts":0}},{"function":"main","accesses":[{"f":"bump","a":2,"t":"addl 0x4(%rdi), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"bump","a":5,"t":"movl %eax, 0x4(%rdi)","o":4,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":80,"t":"movd -0x80(%rax), %xmm2","o":100,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":85,"t":"movd -0xa0(%rax), %xmm3","o":68,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":97,"t":"movd -0xc0(%rax), %xmm2","o":36,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":105,"t":"movd -0xe0(%rax), %xmm4","o":4,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":125,"t":"movd (%rax), %xmm2","o":228,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":129,"t":"movd -0x20(%rax), %xmm3","o":196,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":138,"t":"movd -0x40(%rax), %xmm2","o":164,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":143,"t":"movd -0x60(%rax), %xmm4","o":132,"w":4,"k":"int","r":"param0"},{"f":"sum_balances","a":224,"t":"addl (%rdx), %eax","o":4,"w":4,"k":"int","r":"param0"},{"f":"tag","a":240,"t":"movswl 0x8(%rdi), %ecx","o":8,"w":2,"k":"int","r":"param0"},{"f":"tag","a":248,"t":"cmpb $0x6c, (%rdi)","o":0,"w":1,"k":"int","r":"param0"},{"f":"projected","a":256,"t":"cvtsi2sdl 0x4(%rdi), %xmm0","o":4,"w":4,"k":"int","r":"param0"},{"f":"projected","a":261,"t":"mulsd 0x10(%rdi), %xmm0","o":16,"w":8,"k":"float","r":"param0"},{"f":"label_length","a":272,"t":"movq 0x18(%rdi), %rcx","o":24,"w":8,"k":"int","r":"param0"},{"f":"label_length","a":290,"t":"cmpb $0x0, (%rcx)","o":0,"w":1,"k":"int","r":"param0->0x18"}],"callSites":[],"fields":[{"o":0,"s":1,"k":"int","l":"int8","n":1,"p":0},{"o":4,"s":4,"k":"int","l":"i32","n":12,"p":0},{"o":8,"s":2,"k":"int","l":"i16","n":1,"p":0},{"o":16,"s":8,"k":"float","l":"float64","n":1,"p":0},{"o":24,"s":8,"k":"pointer","l":"pointer","n":1,"p":2}],"stride":32,"strideEvidence":[{"v":32,"k":"offset-delta","f":"sum_balances","a":80},{"v":32,"k":"unrolled","f":"sum_balances","a":80},{"v":256,"k":"loop-step","f":"sum_balances","a":160},{"v":32,"k":"scale","f":"sum_balances","a":224},{"v":32,"k":"loop-step","f":"sum_balances","a":226}],"size":32,"lowerBound":32,"rows":[{"m":"kind","o":0,"t":"char","i":"int8","s":"match"},{"m":"balance","o":4,"t":"int","i":"i32","s":"match"},{"m":"code","o":8,"t":"short","i":"i16","s":"match"},{"m":"rate","o":16,"t":"double","i":"float64","s":"match"},{"m":"label","o":24,"t":"const char *","i":"pointer","s":"match"}],"sizeStatus":"match","conflicts":0,"raw":{"fields":[{"o":0,"s":1,"k":"int","l":"int8","n":1,"p":0},{"o":4,"s":4,"k":"int","l":"i32","n":5,"p":0},{"o":8,"s":2,"k":"int","l":"i16","n":1,"p":0},{"o":16,"s":8,"k":"float","l":"float64","n":1,"p":0},{"o":24,"s":8,"k":"pointer","l":"pointer","n":1,"p":2},{"o":36,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":68,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":100,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":132,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":164,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":196,"s":4,"k":"int","l":"int32","n":1,"p":0},{"o":228,"s":4,"k":"int","l":"int32","n":1,"p":0}],"stride":32,"strideEvidence":[{"v":32,"k":"offset-delta","f":"sum_balances","a":80},{"v":32,"k":"unrolled","f":"sum_balances","a":80},{"v":256,"k":"loop-step","f":"sum_balances","a":160},{"v":32,"k":"scale","f":"sum_balances","a":224},{"v":32,"k":"loop-step","f":"sum_balances","a":226}],"size":null,"lowerBound":232,"rows":[{"m":"kind","o":0,"t":"char","i":"int8","s":"match"},{"m":"balance","o":4,"t":"int","i":"i32","s":"match"},{"m":"code","o":8,"t":"short","i":"i16","s":"match"},{"m":"rate","o":16,"t":"double","i":"float64","s":"match"},{"m":"label","o":24,"t":"const char *","i":"pointer","s":"match"},{"m":null,"o":36,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":68,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":100,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":132,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":164,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":196,"t":"padding","i":"int32","s":"unexpected"},{"m":null,"o":228,"t":"padding","i":"int32","s":"unexpected"}],"sizeStatus":"unknown","conflicts":0}}]}}};

  var BUILDS = [
    { id: 'O0', label: '-O0' },
    { id: 'O1', label: '-O1' },
    { id: 'O2', label: '-O2' }
  ];

  var W = 560;
  var TOP = 30;
  var ROW = 13;
  var BYTE = 8;
  var LEFT_X = 8;
  var MID_X = 222;
  var MID_STRIP_W = 22;
  var RIGHT_X = 392;
  var RIGHT_STRIP_W = 22;
  var FOOT = 56;

  function ensureStyles() {
    if (document.getElementById('re41-styles')) return;
    var style = document.createElement('style');
    style.id = 're41-styles';
    style.textContent = [
      '.re41 *{box-sizing:border-box}',
      '.re41__note{margin:0 0 12px!important;color:var(--ink-soft,#555)!important;font-family:var(--font-body,serif)!important;font-size:.96rem!important;line-height:1.55!important;text-align:left!important}',
      '.re41__controls{display:grid;gap:10px;margin-bottom:12px}',
      '.re41__group-label{font-family:var(--font-mono,monospace);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-mute,#777);margin-bottom:6px}',
      '.re41__row{display:flex;flex-wrap:wrap;gap:8px}',
      '.re41 button{min-height:40px;padding:8px 12px;border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5);color:var(--ink,#1a1a1a);font-family:var(--font-mono,monospace);font-size:.76rem;line-height:1.35;cursor:pointer;transition:transform 150ms cubic-bezier(.23,1,.32,1),border-color 180ms ease,background-color 180ms ease}',
      '.re41 button:active{transform:scale(.96)}',
      '.re41 button:focus-visible{outline:2px solid var(--blueprint,#3553ff);outline-offset:2px}',
      '.re41 button[aria-pressed="true"]{border-color:var(--blueprint,#3553ff);background:var(--blueprint,#3553ff);color:var(--bg,#fafaf5)}',
      '.re41 button[disabled]{opacity:.45;cursor:default}',
      '.re41__scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5)}',
      '.re41__scroll svg{display:block;min-width:540px;width:100%;height:auto}',
      '.re41__current{margin-top:10px;font-family:var(--font-mono,monospace);font-size:.78rem;line-height:1.5;color:var(--ink-soft,#555);white-space:pre-wrap;word-break:break-word}',
      '.re41__verdict{margin-top:8px;padding:10px 12px;border:1px solid var(--blueprint,#3553ff);font-family:var(--font-mono,monospace);font-size:.8rem;line-height:1.5;color:var(--ink,#1a1a1a);background:var(--blueprint-tint,rgba(53,83,255,.08))}',
      '.re41__verdict[data-tone="warn"]{border-color:var(--warn,#b8870f)}',
      '@media (hover:hover) and (pointer:fine){.re41 button:hover{border-color:var(--blueprint,#3553ff)}}',
      '@media (max-width:640px){.re41 button{font-size:.78rem}}',
      '@media (prefers-reduced-motion:reduce){.re41 button{transition:none!important}.re41 button:active{transform:none!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function hex(n) { return '0x' + n.toString(16); }

  function text(x, y, s, fill, anchor, size, weight) {
    var attrs = {
      x: x, y: y, 'text-anchor': anchor || 'start', 'font-family': MONO,
      'font-size': String(size || 10.5), fill: fill || INK
    };
    if (weight) attrs['font-weight'] = weight;
    return svgEl('text', attrs, [document.createTextNode(s)]);
  }

  function kindColor(kind) {
    if (kind === 'float') return WARN;
    if (kind === 'pointer') return INK;
    if (kind === 'conflict' || kind === 'vector') return WARN;
    return BP;
  }

  function statusColor(status) {
    if (status === 'match') return BP;
    if (status === 'no-evidence') return MUTE;
    return WARN;
  }

  function stepOf(state) {
    var steps = DATA.builds[state.build].steps;
    if (state.step === 0) return null;
    return steps[Math.min(state.step, steps.length) - 1];
  }

  function viewOf(step, state) {
    if (!step) return null;
    if (!state.fold && step.raw) return step.raw;
    return step;
  }

  function leftRows(step) {
    var rows = [];
    var i;
    if (!step) return rows;
    var lastFunction = null;
    for (i = 0; i < step.accesses.length; i++) {
      var a = step.accesses[i];
      if (a.f !== lastFunction) {
        rows.push({ head: true, label: a.f });
        lastFunction = a.f;
      }
      var where = a.r === 'param0' ? '+' + a.o : a.r.replace('param0->', 'via +').replace('0x', '') + ' +' + a.o;
      rows.push({ label: hex(a.a) + '  ' + a.t, sub: where + '  w' + a.w + ' ' + a.k, kind: a.k, pointee: a.r !== 'param0' });
    }
    if (step.callSites && step.callSites.length) {
      rows.push({ head: true, label: 'main call sites' });
      for (i = 0; i < step.callSites.length; i++) {
        var c = step.callSites[i];
        rows.push({ label: hex(c.a) + '  callq ' + c.c, sub: 'rdi = ' + c.arg.replace('frame(rbp-0x70)', 'rows').replace(/^rows0x/, 'rows+0x'), kind: 'call', pointee: false });
      }
    }
    return rows;
  }

  function drawLeft(svg, rows, height) {
    svg.appendChild(text(LEFT_X, 14, 'accesses in the listing', MUTE, 'start', 10.5));
    if (!rows.length) {
      svg.appendChild(text(LEFT_X, TOP + 12, 'nothing added yet, press add', MUTE));
      return;
    }
    var y = TOP;
    var i;
    for (i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (row.head) {
        svg.appendChild(text(LEFT_X, y + 10, row.label, INK, 'start', 10.5, '600'));
        y += ROW;
        continue;
      }
      svg.appendChild(svgEl('rect', { x: LEFT_X, y: y + 2, width: 4, height: ROW * 2 - 5, fill: row.kind === 'call' ? MUTE : kindColor(row.kind), opacity: row.pointee ? '0.45' : '1' }));
      svg.appendChild(text(LEFT_X + 9, y + 10, row.label, INK, 'start', 9.5));
      svg.appendChild(text(LEFT_X + 9, y + ROW + 8, row.sub, MUTE, 'start', 9));
      y += ROW * 2;
    }
  }

  function drawStrip(svg, x, width, size, blocks, gapFill) {
    var b;
    for (b = 0; b < size; b++) {
      svg.appendChild(svgEl('rect', { x: x, y: TOP + b * BYTE, width: width, height: BYTE, fill: gapFill, stroke: BG, 'stroke-width': '0.5' }));
    }
    var i;
    for (i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      if (block.o >= size) continue;
      var h = Math.min(block.s, size - block.o) * BYTE;
      svg.appendChild(svgEl('rect', { x: x, y: TOP + block.o * BYTE, width: width, height: h, fill: block.fill, stroke: BG, 'stroke-width': '1', 'fill-opacity': block.opacity || '1' }));
    }
    for (b = 0; b <= size; b += 8) {
      svg.appendChild(text(x - 3, TOP + b * BYTE + (b === size ? 0 : 7), String(b), MUTE, 'end', 8.5));
    }
  }

  function drawMiddle(svg, view, truthSize) {
    svg.appendChild(text(MID_X, 14, 'inferred layout', MUTE, 'start', 10.5));
    var blocks = [];
    var i;
    var fields = view ? view.fields : [];
    for (i = 0; i < fields.length; i++) {
      blocks.push({ o: fields[i].o, s: fields[i].s, fill: kindColor(fields[i].k) });
    }
    drawStrip(svg, MID_X, MID_STRIP_W, truthSize, blocks, SURF);
    var labelX = MID_X + MID_STRIP_W + 8;
    var lastY = -100;
    for (i = 0; i < fields.length; i++) {
      var f = fields[i];
      if (f.o >= truthSize) continue;
      var y = Math.max(TOP + f.o * BYTE + 7, lastY + 11);
      lastY = y;
      var label = '+' + f.o + ' ' + f.l + '  x' + f.n + (f.p ? ' deref' : '');
      svg.appendChild(text(labelX, y, label, kindColor(f.k), 'start', 9.5));
    }
    var footY = TOP + truthSize * BYTE + 16;
    if (!view) {
      svg.appendChild(text(MID_X, footY, 'no fields yet', MUTE, 'start', 9.5));
      return footY;
    }
    var strideText = view.stride === null ? 'stride unknown' : 'stride ' + view.stride;
    var kinds = [];
    var seen = {};
    for (i = 0; i < view.strideEvidence.length; i++) {
      var kind = view.strideEvidence[i].k + ' ' + view.strideEvidence[i].v;
      if (!seen[kind]) { seen[kind] = true; kinds.push(kind); }
    }
    svg.appendChild(text(MID_X, footY, strideText, view.stride === null ? WARN : INK, 'start', 9.5));
    if (kinds.length) svg.appendChild(text(MID_X, footY + 11, kinds.join(', '), MUTE, 'start', 8.5));
    var sizeText = view.size === null ? 'size unknown, at least ' + view.lowerBound : 'size ' + view.size;
    svg.appendChild(text(MID_X, footY + 24, sizeText, view.size === null ? WARN : INK, 'start', 9.5));
    var beyond = [];
    for (i = 0; i < fields.length; i++) if (fields[i].o >= truthSize) beyond.push('+' + fields[i].o);
    if (beyond.length) {
      svg.appendChild(text(MID_X, footY + 36, beyond.length + ' fields past byte ' + truthSize + ':', WARN, 'start', 9.5));
      svg.appendChild(text(MID_X, footY + 47, beyond.join(' '), WARN, 'start', 8.5));
      return footY + 52;
    }
    return footY + 28;
  }

  function drawRight(svg, view) {
    var truth = DATA.truth;
    svg.appendChild(text(RIGHT_X, 14, 'DWARF truth', MUTE, 'start', 10.5));
    var statuses = {};
    var i;
    if (view) {
      for (i = 0; i < view.rows.length; i++) {
        var r = view.rows[i];
        if (r.m !== null && r.s !== 'unexpected') statuses[r.m] = r.s;
      }
    }
    var blocks = [];
    for (i = 0; i < truth.members.length; i++) {
      var m = truth.members[i];
      var status = statuses[m.n] || 'no-evidence';
      blocks.push({ o: m.o, s: m.s, fill: statusColor(status), opacity: status === 'no-evidence' ? '0.35' : '1' });
    }
    drawStrip(svg, RIGHT_X, RIGHT_STRIP_W, truth.size, blocks, SURF);
    var labelX = RIGHT_X + RIGHT_STRIP_W + 8;
    var lastY = -100;
    for (i = 0; i < truth.members.length; i++) {
      var member = truth.members[i];
      var st = statuses[member.n] || 'no-evidence';
      var y = Math.max(TOP + member.o * BYTE + 7, lastY + 11);
      lastY = y;
      svg.appendChild(text(labelX, y, '+' + member.o + ' ' + member.t + ' ' + member.n, statusColor(st), 'start', 9.5));
      var connector = svgEl('line', { x1: MID_X + MID_STRIP_W + 2, y1: TOP + member.o * BYTE + 4, x2: RIGHT_X - 2, y2: TOP + member.o * BYTE + 4, stroke: statusColor(st), 'stroke-width': '1' });
      if (st === 'no-evidence') connector.setAttribute('stroke-dasharray', '3 3');
      svg.appendChild(connector);
      if (st !== 'match' && st !== 'no-evidence') {
        svg.appendChild(text(RIGHT_X - 6, TOP + member.o * BYTE + 8, st, WARN, 'end', 8.5));
      }
    }
    var footY = TOP + truth.size * BYTE + 16;
    svg.appendChild(text(RIGHT_X, footY, 'DW_AT_byte_size ' + truth.size + ', align ' + truth.align, INK, 'start', 9.5));
    svg.appendChild(text(RIGHT_X, footY + 11, 'padding bytes ' + truth.padding.length + ': 1-3, 10-15', MUTE, 'start', 8.5));
    if (view) {
      var sizeLabel = view.sizeStatus === 'match' ? 'size matches' : 'size ' + view.sizeStatus;
      svg.appendChild(text(RIGHT_X, footY + 24, sizeLabel, view.sizeStatus === 'match' ? BP : WARN, 'start', 9.5));
    }
  }

  function verdictText(state, step, view) {
    var build = state.build;
    if (!step) return build + ': no evidence yet. Press add to include the next function of the listing.';
    var functions = DATA.order.slice(0, state.step).join(', ');
    var matches = 0;
    var missing = [];
    var unexpected = 0;
    var i;
    for (i = 0; i < view.rows.length; i++) {
      if (view.rows[i].s === 'match') matches++;
      else if (view.rows[i].s === 'no-evidence') missing.push(view.rows[i].m);
      else if (view.rows[i].s === 'unexpected') unexpected++;
    }
    var parts = [build + ', evidence from ' + functions + ': ' + matches + ' of ' + DATA.truth.members.length + ' members match'];
    if (missing.length) parts.push('no access touches ' + missing.join(', '));
    if (view.size === null) parts.push('size unknown, the accesses only prove at least ' + view.lowerBound + ' bytes');
    else if (view.sizeStatus === 'match') parts.push('stride ' + view.stride + ' equals DW_AT_byte_size');
    else parts.push('size ' + view.size + ' disagrees with DW_AT_byte_size ' + DATA.truth.size);
    if (unexpected) parts.push(unexpected + ' fields fall past the real struct because the unrolled loop was not folded, the loop step 256 is 8 elements of 32');
    if (step.callSites && step.callSites.length && build === 'O0') parts.push('main passes one frame object to every function at offsets 0, 0x20, 0x40');
    if (step.function === 'main' && build !== 'O0') parts.push('main adds nothing, the compiler inlined every call');
    return parts.join('. ') + '.';
  }

  function structRecovery(host) {
    ensureStyles();
    var state = { build: 'O0', step: DATA.order.length, fold: true };
    var titleId = LF.uid('lf-re41-title');
    var descId = LF.uid('lf-re41-desc');
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' 420', role: 'img', 'aria-labelledby': titleId + ' ' + descId });
    var current = el('div', { class: 're41__current' });
    var verdict = el('div', { class: 're41__verdict', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    var buildButtons = [];
    var addButton = el('button', { type: 'button' }, ['add function']);
    var allButton = el('button', { type: 'button' }, ['all']);
    var resetButton = el('button', { type: 'button' }, ['reset']);
    var foldButton = el('button', { type: 'button', 'aria-pressed': 'true' }, ['fold unrolled loops']);

    function setDisabled(button, disabled) {
      if (disabled) button.setAttribute('disabled', 'disabled'); else button.removeAttribute('disabled');
    }

    function render() {
      var step = stepOf(state);
      var view = viewOf(step, state);
      var rows = leftRows(step);
      var i;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(svgEl('title', { id: titleId }, [document.createTextNode('Memory accesses, the struct layout inferred from them, and the DWARF layout of account')]));
      svg.appendChild(svgEl('desc', { id: descId }, [document.createTextNode(verdictText(state, step, view))]));
      var leftHeight = TOP;
      for (i = 0; i < rows.length; i++) leftHeight += rows[i].head ? ROW : ROW * 2;
      var midBottom = drawMiddle(svg, view, DATA.truth.size);
      drawRight(svg, view);
      drawLeft(svg, rows, leftHeight);
      var height = Math.max(leftHeight + 12, midBottom + 10, TOP + DATA.truth.size * BYTE + FOOT);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + height);
      for (i = 0; i < buildButtons.length; i++) buildButtons[i].button.setAttribute('aria-pressed', buildButtons[i].id === state.build ? 'true' : 'false');
      setDisabled(addButton, state.step >= DATA.order.length);
      setDisabled(allButton, state.step >= DATA.order.length);
      setDisabled(resetButton, state.step === 0);
      foldButton.setAttribute('aria-pressed', state.fold ? 'true' : 'false');
      setDisabled(foldButton, !(step && step.raw));
      current.textContent = step
        ? 'step ' + state.step + ' of ' + DATA.order.length + ': added ' + step.function + ' from ' + DATA.builds[state.build].object + ', ' + step.accesses.length + ' accesses through the first parameter so far'
        : 'step 0 of ' + DATA.order.length + ': no function added yet';
      verdict.textContent = verdictText(state, step, view);
      var warn = !step || view.size === null || view.sizeStatus !== 'match';
      if (view) {
        for (i = 0; i < view.rows.length; i++) if (view.rows[i].s !== 'match') warn = true;
      }
      verdict.setAttribute('data-tone', warn ? 'warn' : 'pass');
    }

    var buildRow = el('div', { class: 're41__row', role: 'group', 'aria-label': 'Build' });
    BUILDS.forEach(function (build) {
      var button = el('button', { type: 'button', 'aria-pressed': 'false' }, [build.label]);
      button.addEventListener('click', function () { state.build = build.id; render(); });
      buildButtons.push({ id: build.id, button: button });
      buildRow.appendChild(button);
    });
    addButton.addEventListener('click', function () { state.step = Math.min(state.step + 1, DATA.order.length); render(); });
    allButton.addEventListener('click', function () { state.step = DATA.order.length; render(); });
    resetButton.addEventListener('click', function () { state.step = 0; render(); });
    foldButton.addEventListener('click', function () { state.fold = !state.fold; render(); });

    var controls = el('div', { class: 're41__controls' }, [
      el('div', {}, [el('div', { class: 're41__group-label' }, ['build']), buildRow]),
      el('div', {}, [el('div', { class: 're41__group-label' }, ['evidence']), el('div', { class: 're41__row' }, [addButton, allButton, resetButton, foldButton])])
    ]);

    host.appendChild(el('div', { class: 'lf re41' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['STRUCT RECOVERY']), el('span', {}, ['account, 32 bytes, three builds'])]),
      el('div', { class: 'lf-body' }, [
        el('p', { class: 're41__note' }, ['Pick a build, press reset, then add one function at a time. The left column lists every access through the first parameter. The middle column is the layout the pass infers from those accesses. The right column is the layout DWARF 5 records, with each member colored by how the inferred layout compares to it.']),
        controls,
        el('div', { class: 're41__scroll' }, [svg]),
        current,
        verdict
      ]),
      el('div', { class: 'lf-cap' }, ['Blue is an integer field or a member that matches, amber is a floating-point field or a disagreement, black is a pointer. A grey dashed connector is a DWARF member that no access touched. The fold button applies to the -O2 build only, where the vectorised loop reads eight elements per pass: with folding off, the pass reports seven fields past the end of the struct.'])
    ]));
    render();
  }

  LF.register({ 're-41-struct-recovery': structRecovery });
})();
