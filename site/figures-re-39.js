/* figures-re-39.js - lesson 39: one function, four optimization levels, each recognized idiom highlighted.
   DATA is the output of python3 code/main.py figure-data in the lesson folder.
   Every instruction, address, byte, and span below comes from the idiom recognizer in that lesson
   run over idioms-x86_64-O*.o and idioms-arm64-O*.o. The test suite checks that this copy matches. */
(function () {
  'use strict';

  var LF = window.LF;
  if (!LF) return;

  var el = LF.el;

  var DATA = {"function":"digest","source":["int sum = 0;","    for (int i = 0; i < n; i++) sum += data[i];","    int tens = sum / 10;","    int band;","    switch (tens) {","    case 6: band = 1; break;","    case 7: band = 2; break;","    case 8: band = 4; break;","    case 9: case 10: band = 8; break;","    default: band = 0; break;","    }","    int rem = sum % 10;","    int capped = rem > 5 ? 5 : rem;","    return band * 16 + capped;"],"kinds":["division","modulo","switch","vector loop","unrolled loop","branchless select","branchless flag","tail call","inlined call","memset","memcpy","strength reduction"],"arches":{"x86_64":{"O0":{"instructions":[{"a":1376,"b":"55","t":"pushq %rbp"},{"a":1377,"b":"48 89 e5","t":"movq %rsp, %rbp"},{"a":1380,"b":"48 89 7d f8","t":"movq %rdi, -0x8(%rbp)"},{"a":1384,"b":"89 75 f4","t":"movl %esi, -0xc(%rbp)"},{"a":1387,"b":"c7 45 f0 00 00 00 00","t":"movl $0x0, -0x10(%rbp)"},{"a":1394,"b":"c7 45 ec 00 00 00 00","t":"movl $0x0, -0x14(%rbp)"},{"a":1401,"b":"8b 45 ec","t":"movl -0x14(%rbp), %eax"},{"a":1404,"b":"3b 45 f4","t":"cmpl -0xc(%rbp), %eax"},{"a":1407,"b":"7d 1c","t":"jge 0x59d"},{"a":1409,"b":"48 8b 45 f8","t":"movq -0x8(%rbp), %rax"},{"a":1413,"b":"48 63 4d ec","t":"movslq -0x14(%rbp), %rcx"},{"a":1417,"b":"8b 04 88","t":"movl (%rax,%rcx,4), %eax"},{"a":1420,"b":"03 45 f0","t":"addl -0x10(%rbp), %eax"},{"a":1423,"b":"89 45 f0","t":"movl %eax, -0x10(%rbp)"},{"a":1426,"b":"8b 45 ec","t":"movl -0x14(%rbp), %eax"},{"a":1429,"b":"83 c0 01","t":"addl $0x1, %eax"},{"a":1432,"b":"89 45 ec","t":"movl %eax, -0x14(%rbp)"},{"a":1435,"b":"eb dc","t":"jmp 0x579"},{"a":1437,"b":"48 63 45 f0","t":"movslq -0x10(%rbp), %rax"},{"a":1441,"b":"48 69 c0 67 66 66 66","t":"imulq $0x66666667, %rax, %rax"},{"a":1448,"b":"48 89 c1","t":"movq %rax, %rcx"},{"a":1451,"b":"48 c1 e9 3f","t":"shrq $0x3f, %rcx"},{"a":1455,"b":"48 c1 f8 22","t":"sarq $0x22, %rax"},{"a":1459,"b":"01 c8","t":"addl %ecx, %eax"},{"a":1461,"b":"89 45 e8","t":"movl %eax, -0x18(%rbp)"},{"a":1464,"b":"8b 45 e8","t":"movl -0x18(%rbp), %eax"},{"a":1467,"b":"83 c0 fa","t":"addl $-0x6, %eax"},{"a":1470,"b":"89 c1","t":"movl %eax, %ecx"},{"a":1472,"b":"48 89 4d d0","t":"movq %rcx, -0x30(%rbp)"},{"a":1476,"b":"83 e8 04","t":"subl $0x4, %eax"},{"a":1479,"b":"77 38","t":"ja 0x601"},{"a":1481,"b":"48 8b 45 d0","t":"movq -0x30(%rbp), %rax"},{"a":1485,"b":"48 8d 0d 00 00 00 00","t":"leaq (%rip), %rcx"},{"a":1492,"b":"48 63 04 81","t":"movslq (%rcx,%rax,4), %rax"},{"a":1496,"b":"48 01 c8","t":"addq %rcx, %rax"},{"a":1499,"b":"ff e0","t":"jmpq *%rax"},{"a":1501,"b":"c7 45 e4 01 00 00 00","t":"movl $0x1, -0x1c(%rbp)"},{"a":1508,"b":"eb 22","t":"jmp 0x608"},{"a":1510,"b":"c7 45 e4 02 00 00 00","t":"movl $0x2, -0x1c(%rbp)"},{"a":1517,"b":"eb 19","t":"jmp 0x608"},{"a":1519,"b":"c7 45 e4 04 00 00 00","t":"movl $0x4, -0x1c(%rbp)"},{"a":1526,"b":"eb 10","t":"jmp 0x608"},{"a":1528,"b":"c7 45 e4 08 00 00 00","t":"movl $0x8, -0x1c(%rbp)"},{"a":1535,"b":"eb 07","t":"jmp 0x608"},{"a":1537,"b":"c7 45 e4 00 00 00 00","t":"movl $0x0, -0x1c(%rbp)"},{"a":1544,"b":"8b 45 f0","t":"movl -0x10(%rbp), %eax"},{"a":1547,"b":"b9 0a 00 00 00","t":"movl $0xa, %ecx"},{"a":1552,"b":"99","t":"cltd"},{"a":1553,"b":"f7 f9","t":"idivl %ecx"},{"a":1555,"b":"89 55 e0","t":"movl %edx, -0x20(%rbp)"},{"a":1558,"b":"83 7d e0 05","t":"cmpl $0x5, -0x20(%rbp)"},{"a":1562,"b":"7e 0a","t":"jle 0x626"},{"a":1564,"b":"b8 05 00 00 00","t":"movl $0x5, %eax"},{"a":1569,"b":"89 45 cc","t":"movl %eax, -0x34(%rbp)"},{"a":1572,"b":"eb 06","t":"jmp 0x62c"},{"a":1574,"b":"8b 45 e0","t":"movl -0x20(%rbp), %eax"},{"a":1577,"b":"89 45 cc","t":"movl %eax, -0x34(%rbp)"},{"a":1580,"b":"8b 45 cc","t":"movl -0x34(%rbp), %eax"},{"a":1583,"b":"89 45 dc","t":"movl %eax, -0x24(%rbp)"},{"a":1586,"b":"8b 45 e4","t":"movl -0x1c(%rbp), %eax"},{"a":1589,"b":"c1 e0 04","t":"shll $0x4, %eax"},{"a":1592,"b":"03 45 dc","t":"addl -0x24(%rbp), %eax"},{"a":1595,"b":"5d","t":"popq %rbp"},{"a":1596,"b":"c3","t":"retq"}],"spans":[{"k":"division","s":"sum / 10","e":[1437,1441,1448,1451,1455,1459],"d":{"form":"magic multiply","magic":"0x66666667","shift":34}},{"k":"modulo","s":"sum % 10","e":[1547,1552,1553],"d":{"form":"hardware idivl"}},{"k":"switch","s":"switch (sum / 10) as jump table","e":[1476,1479,1485,1492,1496,1499],"d":{"lowering":"jump table","entries":5,"targets":["0x5dd","0x5e6","0x5ef","0x5f8","0x5f8"]}}],"bytes":221,"count":64},"O1":{"instructions":[{"a":656,"b":"31 c9","t":"xorl %ecx, %ecx"},{"a":658,"b":"b8 00 00 00 00","t":"movl $0x0, %eax"},{"a":663,"b":"85 f6","t":"testl %esi, %esi"},{"a":665,"b":"7e 20","t":"jle 0x2bb"},{"a":667,"b":"89 f2","t":"movl %esi, %edx"},{"a":669,"b":"31 f6","t":"xorl %esi, %esi"},{"a":671,"b":"31 c0","t":"xorl %eax, %eax"},{"a":673,"b":"66 66 66 66 66 66 2e 0f 1f 84 00 00 00 00 00","t":"nopw %cs:(%rax,%rax)"},{"a":688,"b":"03 04 b7","t":"addl (%rdi,%rsi,4), %eax"},{"a":691,"b":"48 ff c6","t":"incq %rsi"},{"a":694,"b":"48 39 f2","t":"cmpq %rsi, %rdx"},{"a":697,"b":"75 f5","t":"jne 0x2b0"},{"a":699,"b":"48 63 d0","t":"movslq %eax, %rdx"},{"a":702,"b":"48 69 c2 67 66 66 66","t":"imulq $0x66666667, %rdx, %rax"},{"a":709,"b":"48 89 c6","t":"movq %rax, %rsi"},{"a":712,"b":"48 c1 ee 3f","t":"shrq $0x3f, %rsi"},{"a":716,"b":"48 c1 f8 22","t":"sarq $0x22, %rax"},{"a":720,"b":"8d 3c 30","t":"leal (%rax,%rsi), %edi"},{"a":723,"b":"01 ff","t":"addl %edi, %edi"},{"a":725,"b":"8d 3c bf","t":"leal (%rdi,%rdi,4), %edi"},{"a":728,"b":"29 fa","t":"subl %edi, %edx"},{"a":730,"b":"01 f0","t":"addl %esi, %eax"},{"a":732,"b":"83 c0 fa","t":"addl $-0x6, %eax"},{"a":735,"b":"83 f8 05","t":"cmpl $0x5, %eax"},{"a":738,"b":"73 0c","t":"jae 0x2f0"},{"a":740,"b":"89 c0","t":"movl %eax, %eax"},{"a":742,"b":"48 8d 0d 00 00 00 00","t":"leaq (%rip), %rcx"},{"a":749,"b":"8b 0c 81","t":"movl (%rcx,%rax,4), %ecx"},{"a":752,"b":"83 fa 05","t":"cmpl $0x5, %edx"},{"a":755,"b":"b8 05 00 00 00","t":"movl $0x5, %eax"},{"a":760,"b":"0f 4c c2","t":"cmovll %edx, %eax"},{"a":763,"b":"01 c8","t":"addl %ecx, %eax"},{"a":765,"b":"c3","t":"retq"}],"spans":[{"k":"division","s":"sum / 10","e":[699,702,709,712,716,730],"d":{"form":"magic multiply","magic":"0x66666667","shift":34}},{"k":"modulo","s":"sum % 10","e":[699,702,709,712,716,720,723,725,728],"d":{"form":"quotient multiplied back and subtracted"}},{"k":"switch","s":"switch (sum / 10) as lookup table","e":[735,738,742,749],"d":{"lowering":"lookup table","entries":5,"values":[16,32,64,128,128]}},{"k":"branchless select","s":"sum % 10 < 5 ? sum % 10 : 5","e":[752,760],"d":{}}],"bytes":110,"count":33},"O2":{"instructions":[{"a":800,"b":"31 c9","t":"xorl %ecx, %ecx"},{"a":802,"b":"b8 00 00 00 00","t":"movl $0x0, %eax"},{"a":807,"b":"85 f6","t":"testl %esi, %esi"},{"a":809,"b":"0f 8e c5 00 00 00","t":"jle 0x3f4"},{"a":815,"b":"89 f2","t":"movl %esi, %edx"},{"a":817,"b":"83 fe 07","t":"cmpl $0x7, %esi"},{"a":820,"b":"77 06","t":"ja 0x33c"},{"a":822,"b":"31 f6","t":"xorl %esi, %esi"},{"a":824,"b":"31 c0","t":"xorl %eax, %eax"},{"a":826,"b":"eb 64","t":"jmp 0x3a0"},{"a":828,"b":"89 d6","t":"movl %edx, %esi"},{"a":830,"b":"81 e6 f8 ff ff 7f","t":"andl $0x7ffffff8, %esi"},{"a":836,"b":"89 d0","t":"movl %edx, %eax"},{"a":838,"b":"c1 e8 03","t":"shrl $0x3, %eax"},{"a":841,"b":"25 ff ff ff 0f","t":"andl $0xfffffff, %eax"},{"a":846,"b":"48 c1 e0 05","t":"shlq $0x5, %rax"},{"a":850,"b":"66 0f ef c0","t":"pxor %xmm0, %xmm0"},{"a":854,"b":"45 31 c0","t":"xorl %r8d, %r8d"},{"a":857,"b":"66 0f ef c9","t":"pxor %xmm1, %xmm1"},{"a":861,"b":"0f 1f 00","t":"nopl (%rax)"},{"a":864,"b":"f3 42 0f 6f 14 07","t":"movdqu (%rdi,%r8), %xmm2"},{"a":870,"b":"66 0f fe c2","t":"paddd %xmm2, %xmm0"},{"a":874,"b":"f3 42 0f 6f 54 07 10","t":"movdqu 0x10(%rdi,%r8), %xmm2"},{"a":881,"b":"66 0f fe ca","t":"paddd %xmm2, %xmm1"},{"a":885,"b":"49 83 c0 20","t":"addq $0x20, %r8"},{"a":889,"b":"4c 39 c0","t":"cmpq %r8, %rax"},{"a":892,"b":"75 e2","t":"jne 0x360"},{"a":894,"b":"66 0f fe c8","t":"paddd %xmm0, %xmm1"},{"a":898,"b":"66 0f 70 c1 ee","t":"pshufd $0xee, %xmm1, %xmm0"},{"a":903,"b":"66 0f fe c1","t":"paddd %xmm1, %xmm0"},{"a":907,"b":"66 0f 70 c8 55","t":"pshufd $0x55, %xmm0, %xmm1"},{"a":912,"b":"66 0f fe c8","t":"paddd %xmm0, %xmm1"},{"a":916,"b":"66 0f 7e c8","t":"movd %xmm1, %eax"},{"a":920,"b":"39 d6","t":"cmpl %edx, %esi"},{"a":922,"b":"74 0f","t":"je 0x3ab"},{"a":924,"b":"0f 1f 40 00","t":"nopl (%rax)"},{"a":928,"b":"03 04 b7","t":"addl (%rdi,%rsi,4), %eax"},{"a":931,"b":"48 ff c6","t":"incq %rsi"},{"a":934,"b":"48 39 f2","t":"cmpq %rsi, %rdx"},{"a":937,"b":"75 f5","t":"jne 0x3a0"},{"a":939,"b":"48 63 d0","t":"movslq %eax, %rdx"},{"a":942,"b":"48 69 d2 67 66 66 66","t":"imulq $0x66666667, %rdx, %rdx"},{"a":949,"b":"48 89 d6","t":"movq %rdx, %rsi"},{"a":952,"b":"48 c1 fe 22","t":"sarq $0x22, %rsi"},{"a":956,"b":"48 c1 ea 3f","t":"shrq $0x3f, %rdx"},{"a":960,"b":"01 f2","t":"addl %esi, %edx"},{"a":962,"b":"83 c2 fa","t":"addl $-0x6, %edx"},{"a":965,"b":"83 fa 04","t":"cmpl $0x4, %edx"},{"a":968,"b":"77 2a","t":"ja 0x3f4"},{"a":970,"b":"48 8d 0d 00 00 00 00","t":"leaq (%rip), %rcx"},{"a":977,"b":"48 63 14 91","t":"movslq (%rcx,%rdx,4), %rdx"},{"a":981,"b":"48 01 ca","t":"addq %rcx, %rdx"},{"a":984,"b":"ff e2","t":"jmpq *%rdx"},{"a":986,"b":"b9 80 00 00 00","t":"movl $0x80, %ecx"},{"a":991,"b":"eb 13","t":"jmp 0x3f4"},{"a":993,"b":"b9 40 00 00 00","t":"movl $0x40, %ecx"},{"a":998,"b":"eb 0c","t":"jmp 0x3f4"},{"a":1000,"b":"b9 10 00 00 00","t":"movl $0x10, %ecx"},{"a":1005,"b":"eb 05","t":"jmp 0x3f4"},{"a":1007,"b":"b9 20 00 00 00","t":"movl $0x20, %ecx"},{"a":1012,"b":"48 63 d0","t":"movslq %eax, %rdx"},{"a":1015,"b":"48 69 c2 67 66 66 66","t":"imulq $0x66666667, %rdx, %rax"},{"a":1022,"b":"48 89 c6","t":"movq %rax, %rsi"},{"a":1025,"b":"48 c1 ee 3f","t":"shrq $0x3f, %rsi"},{"a":1029,"b":"48 c1 f8 22","t":"sarq $0x22, %rax"},{"a":1033,"b":"01 f0","t":"addl %esi, %eax"},{"a":1035,"b":"01 c0","t":"addl %eax, %eax"},{"a":1037,"b":"8d 04 80","t":"leal (%rax,%rax,4), %eax"},{"a":1040,"b":"29 c2","t":"subl %eax, %edx"},{"a":1042,"b":"83 fa 05","t":"cmpl $0x5, %edx"},{"a":1045,"b":"b8 05 00 00 00","t":"movl $0x5, %eax"},{"a":1050,"b":"0f 4c c2","t":"cmovll %edx, %eax"},{"a":1053,"b":"01 c8","t":"addl %ecx, %eax"},{"a":1055,"b":"c3","t":"retq"}],"spans":[{"k":"division","s":"sum / 10","e":[939,942,949,952,956,960],"d":{"form":"magic multiply","magic":"0x66666667","shift":34}},{"k":"modulo","s":"sum % 10","e":[1012,1015,1022,1025,1029,1033,1035,1037,1040],"d":{"form":"quotient multiplied back and subtracted"}},{"k":"switch","s":"switch (sum / 10) as jump table","e":[965,968,970,977,981,984],"d":{"lowering":"jump table","entries":5,"targets":["0x3e8","0x3ef","0x3e1","0x3da","0x3da"]}},{"k":"vector loop","s":"vectorized loop: 4 lanes x 2 accumulators = 8 elements per iteration","e":[817,830,864,870,874,881,885,889,892,894,898,903,907,912,916],"d":{"lanes":4,"accumulators":2,"elementsPerIteration":8}},{"k":"branchless select","s":"sum % 10 < 5 ? sum % 10 : 5","e":[1042,1050],"d":{}}],"bytes":256,"count":74},"O3":{"instructions":[{"a":800,"b":"31 c9","t":"xorl %ecx, %ecx"},{"a":802,"b":"b8 00 00 00 00","t":"movl $0x0, %eax"},{"a":807,"b":"85 f6","t":"testl %esi, %esi"},{"a":809,"b":"0f 8e c5 00 00 00","t":"jle 0x3f4"},{"a":815,"b":"89 f2","t":"movl %esi, %edx"},{"a":817,"b":"83 fe 07","t":"cmpl $0x7, %esi"},{"a":820,"b":"77 06","t":"ja 0x33c"},{"a":822,"b":"31 f6","t":"xorl %esi, %esi"},{"a":824,"b":"31 c0","t":"xorl %eax, %eax"},{"a":826,"b":"eb 64","t":"jmp 0x3a0"},{"a":828,"b":"89 d6","t":"movl %edx, %esi"},{"a":830,"b":"81 e6 f8 ff ff 7f","t":"andl $0x7ffffff8, %esi"},{"a":836,"b":"89 d0","t":"movl %edx, %eax"},{"a":838,"b":"c1 e8 03","t":"shrl $0x3, %eax"},{"a":841,"b":"25 ff ff ff 0f","t":"andl $0xfffffff, %eax"},{"a":846,"b":"48 c1 e0 05","t":"shlq $0x5, %rax"},{"a":850,"b":"66 0f ef c0","t":"pxor %xmm0, %xmm0"},{"a":854,"b":"45 31 c0","t":"xorl %r8d, %r8d"},{"a":857,"b":"66 0f ef c9","t":"pxor %xmm1, %xmm1"},{"a":861,"b":"0f 1f 00","t":"nopl (%rax)"},{"a":864,"b":"f3 42 0f 6f 14 07","t":"movdqu (%rdi,%r8), %xmm2"},{"a":870,"b":"66 0f fe c2","t":"paddd %xmm2, %xmm0"},{"a":874,"b":"f3 42 0f 6f 54 07 10","t":"movdqu 0x10(%rdi,%r8), %xmm2"},{"a":881,"b":"66 0f fe ca","t":"paddd %xmm2, %xmm1"},{"a":885,"b":"49 83 c0 20","t":"addq $0x20, %r8"},{"a":889,"b":"4c 39 c0","t":"cmpq %r8, %rax"},{"a":892,"b":"75 e2","t":"jne 0x360"},{"a":894,"b":"66 0f fe c8","t":"paddd %xmm0, %xmm1"},{"a":898,"b":"66 0f 70 c1 ee","t":"pshufd $0xee, %xmm1, %xmm0"},{"a":903,"b":"66 0f fe c1","t":"paddd %xmm1, %xmm0"},{"a":907,"b":"66 0f 70 c8 55","t":"pshufd $0x55, %xmm0, %xmm1"},{"a":912,"b":"66 0f fe c8","t":"paddd %xmm0, %xmm1"},{"a":916,"b":"66 0f 7e c8","t":"movd %xmm1, %eax"},{"a":920,"b":"39 d6","t":"cmpl %edx, %esi"},{"a":922,"b":"74 0f","t":"je 0x3ab"},{"a":924,"b":"0f 1f 40 00","t":"nopl (%rax)"},{"a":928,"b":"03 04 b7","t":"addl (%rdi,%rsi,4), %eax"},{"a":931,"b":"48 ff c6","t":"incq %rsi"},{"a":934,"b":"48 39 f2","t":"cmpq %rsi, %rdx"},{"a":937,"b":"75 f5","t":"jne 0x3a0"},{"a":939,"b":"48 63 d0","t":"movslq %eax, %rdx"},{"a":942,"b":"48 69 d2 67 66 66 66","t":"imulq $0x66666667, %rdx, %rdx"},{"a":949,"b":"48 89 d6","t":"movq %rdx, %rsi"},{"a":952,"b":"48 c1 fe 22","t":"sarq $0x22, %rsi"},{"a":956,"b":"48 c1 ea 3f","t":"shrq $0x3f, %rdx"},{"a":960,"b":"01 f2","t":"addl %esi, %edx"},{"a":962,"b":"83 c2 fa","t":"addl $-0x6, %edx"},{"a":965,"b":"83 fa 04","t":"cmpl $0x4, %edx"},{"a":968,"b":"77 2a","t":"ja 0x3f4"},{"a":970,"b":"48 8d 0d 00 00 00 00","t":"leaq (%rip), %rcx"},{"a":977,"b":"48 63 14 91","t":"movslq (%rcx,%rdx,4), %rdx"},{"a":981,"b":"48 01 ca","t":"addq %rcx, %rdx"},{"a":984,"b":"ff e2","t":"jmpq *%rdx"},{"a":986,"b":"b9 80 00 00 00","t":"movl $0x80, %ecx"},{"a":991,"b":"eb 13","t":"jmp 0x3f4"},{"a":993,"b":"b9 40 00 00 00","t":"movl $0x40, %ecx"},{"a":998,"b":"eb 0c","t":"jmp 0x3f4"},{"a":1000,"b":"b9 10 00 00 00","t":"movl $0x10, %ecx"},{"a":1005,"b":"eb 05","t":"jmp 0x3f4"},{"a":1007,"b":"b9 20 00 00 00","t":"movl $0x20, %ecx"},{"a":1012,"b":"48 63 d0","t":"movslq %eax, %rdx"},{"a":1015,"b":"48 69 c2 67 66 66 66","t":"imulq $0x66666667, %rdx, %rax"},{"a":1022,"b":"48 89 c6","t":"movq %rax, %rsi"},{"a":1025,"b":"48 c1 ee 3f","t":"shrq $0x3f, %rsi"},{"a":1029,"b":"48 c1 f8 22","t":"sarq $0x22, %rax"},{"a":1033,"b":"01 f0","t":"addl %esi, %eax"},{"a":1035,"b":"01 c0","t":"addl %eax, %eax"},{"a":1037,"b":"8d 04 80","t":"leal (%rax,%rax,4), %eax"},{"a":1040,"b":"29 c2","t":"subl %eax, %edx"},{"a":1042,"b":"83 fa 05","t":"cmpl $0x5, %edx"},{"a":1045,"b":"b8 05 00 00 00","t":"movl $0x5, %eax"},{"a":1050,"b":"0f 4c c2","t":"cmovll %edx, %eax"},{"a":1053,"b":"01 c8","t":"addl %ecx, %eax"},{"a":1055,"b":"c3","t":"retq"}],"spans":[{"k":"division","s":"sum / 10","e":[939,942,949,952,956,960],"d":{"form":"magic multiply","magic":"0x66666667","shift":34}},{"k":"modulo","s":"sum % 10","e":[1012,1015,1022,1025,1029,1033,1035,1037,1040],"d":{"form":"quotient multiplied back and subtracted"}},{"k":"switch","s":"switch (sum / 10) as jump table","e":[965,968,970,977,981,984],"d":{"lowering":"jump table","entries":5,"targets":["0x3e8","0x3ef","0x3e1","0x3da","0x3da"]}},{"k":"vector loop","s":"vectorized loop: 4 lanes x 2 accumulators = 8 elements per iteration","e":[817,830,864,870,874,881,885,889,892,894,898,903,907,912,916],"d":{"lanes":4,"accumulators":2,"elementsPerIteration":8}},{"k":"branchless select","s":"sum % 10 < 5 ? sum % 10 : 5","e":[1042,1050],"d":{}}],"bytes":256,"count":74}},"arm64":{"O0":{"instructions":[{"a":1884,"b":"d100c3ff","t":"sub sp, sp, #0x30"},{"a":1888,"b":"f90017e0","t":"str x0, [sp, #0x28]"},{"a":1892,"b":"b90027e1","t":"str w1, [sp, #0x24]"},{"a":1896,"b":"b90023ff","t":"str wzr, [sp, #0x20]"},{"a":1900,"b":"b9001fff","t":"str wzr, [sp, #0x1c]"},{"a":1904,"b":"14000001","t":"b 0x774"},{"a":1908,"b":"b9401fe8","t":"ldr w8, [sp, #0x1c]"},{"a":1912,"b":"b94027e9","t":"ldr w9, [sp, #0x24]"},{"a":1916,"b":"6b090108","t":"subs w8, w8, w9"},{"a":1920,"b":"540001aa","t":"b.ge 0x7b4"},{"a":1924,"b":"14000001","t":"b 0x788"},{"a":1928,"b":"f94017e8","t":"ldr x8, [sp, #0x28]"},{"a":1932,"b":"b9801fe9","t":"ldrsw x9, [sp, #0x1c]"},{"a":1936,"b":"b8697909","t":"ldr w9, [x8, x9, lsl #2]"},{"a":1940,"b":"b94023e8","t":"ldr w8, [sp, #0x20]"},{"a":1944,"b":"0b090108","t":"add w8, w8, w9"},{"a":1948,"b":"b90023e8","t":"str w8, [sp, #0x20]"},{"a":1952,"b":"14000001","t":"b 0x7a4"},{"a":1956,"b":"b9401fe8","t":"ldr w8, [sp, #0x1c]"},{"a":1960,"b":"11000508","t":"add w8, w8, #0x1"},{"a":1964,"b":"b9001fe8","t":"str w8, [sp, #0x1c]"},{"a":1968,"b":"17fffff1","t":"b 0x774"},{"a":1972,"b":"b94023e8","t":"ldr w8, [sp, #0x20]"},{"a":1976,"b":"52800149","t":"mov w9, #0xa"},{"a":1980,"b":"1ac90d08","t":"sdiv w8, w8, w9"},{"a":1984,"b":"b9001be8","t":"str w8, [sp, #0x18]"},{"a":1988,"b":"b9401be8","t":"ldr w8, [sp, #0x18]"},{"a":1992,"b":"b9000be8","t":"str w8, [sp, #0x8]"},{"a":1996,"b":"71001908","t":"subs w8, w8, #0x6"},{"a":2000,"b":"540001e0","t":"b.eq 0x80c"},{"a":2004,"b":"14000001","t":"b 0x7d8"},{"a":2008,"b":"b9400be8","t":"ldr w8, [sp, #0x8]"},{"a":2012,"b":"71001d08","t":"subs w8, w8, #0x7"},{"a":2016,"b":"540001c0","t":"b.eq 0x818"},{"a":2020,"b":"14000001","t":"b 0x7e8"},{"a":2024,"b":"b9400be8","t":"ldr w8, [sp, #0x8]"},{"a":2028,"b":"71002108","t":"subs w8, w8, #0x8"},{"a":2032,"b":"540001a0","t":"b.eq 0x824"},{"a":2036,"b":"14000001","t":"b 0x7f8"},{"a":2040,"b":"b9400be8","t":"ldr w8, [sp, #0x8]"},{"a":2044,"b":"71002508","t":"subs w8, w8, #0x9"},{"a":2048,"b":"71000508","t":"subs w8, w8, #0x1"},{"a":2052,"b":"54000169","t":"b.ls 0x830"},{"a":2056,"b":"1400000d","t":"b 0x83c"},{"a":2060,"b":"52800028","t":"mov w8, #0x1"},{"a":2064,"b":"b90017e8","t":"str w8, [sp, #0x14]"},{"a":2068,"b":"1400000c","t":"b 0x844"},{"a":2072,"b":"52800048","t":"mov w8, #0x2"},{"a":2076,"b":"b90017e8","t":"str w8, [sp, #0x14]"},{"a":2080,"b":"14000009","t":"b 0x844"},{"a":2084,"b":"52800088","t":"mov w8, #0x4"},{"a":2088,"b":"b90017e8","t":"str w8, [sp, #0x14]"},{"a":2092,"b":"14000006","t":"b 0x844"},{"a":2096,"b":"52800108","t":"mov w8, #0x8"},{"a":2100,"b":"b90017e8","t":"str w8, [sp, #0x14]"},{"a":2104,"b":"14000003","t":"b 0x844"},{"a":2108,"b":"b90017ff","t":"str wzr, [sp, #0x14]"},{"a":2112,"b":"14000001","t":"b 0x844"},{"a":2116,"b":"b94023e8","t":"ldr w8, [sp, #0x20]"},{"a":2120,"b":"5280014a","t":"mov w10, #0xa"},{"a":2124,"b":"1aca0d09","t":"sdiv w9, w8, w10"},{"a":2128,"b":"1b0a7d29","t":"mul w9, w9, w10"},{"a":2132,"b":"6b090108","t":"subs w8, w8, w9"},{"a":2136,"b":"b90013e8","t":"str w8, [sp, #0x10]"},{"a":2140,"b":"b94013e8","t":"ldr w8, [sp, #0x10]"},{"a":2144,"b":"71001508","t":"subs w8, w8, #0x5"},{"a":2148,"b":"540000ad","t":"b.le 0x878"},{"a":2152,"b":"14000001","t":"b 0x86c"},{"a":2156,"b":"528000a8","t":"mov w8, #0x5"},{"a":2160,"b":"b90007e8","t":"str w8, [sp, #0x4]"},{"a":2164,"b":"14000004","t":"b 0x884"},{"a":2168,"b":"b94013e8","t":"ldr w8, [sp, #0x10]"},{"a":2172,"b":"b90007e8","t":"str w8, [sp, #0x4]"},{"a":2176,"b":"14000001","t":"b 0x884"},{"a":2180,"b":"b94007e8","t":"ldr w8, [sp, #0x4]"},{"a":2184,"b":"b9000fe8","t":"str w8, [sp, #0xc]"},{"a":2188,"b":"b94017e9","t":"ldr w9, [sp, #0x14]"},{"a":2192,"b":"b9400fe8","t":"ldr w8, [sp, #0xc]"},{"a":2196,"b":"0b091100","t":"add w0, w8, w9, lsl #4"},{"a":2200,"b":"9100c3ff","t":"add sp, sp, #0x30"},{"a":2204,"b":"d65f03c0","t":"ret"}],"spans":[{"k":"division","s":"sum / 10","e":[1976,1980],"d":{"form":"hardware sdiv"}},{"k":"modulo","s":"sum % 10","e":[2120,2124,2128,2132],"d":{"form":"hardware sdiv + mul + subs"}},{"k":"switch","s":"switch (sum / 10) as compare chain","e":[1996,2000,2012,2016,2028,2032,2048,2052],"d":{"lowering":"compare chain"}}],"bytes":324,"count":81},"O1":{"instructions":[{"a":668,"b":"7100043f","t":"cmp w1, #0x1"},{"a":672,"b":"5400010b","t":"b.lt 0x2c0"},{"a":676,"b":"2a1f03e8","t":"mov w8, wzr"},{"a":680,"b":"2a0103e9","t":"mov w9, w1"},{"a":684,"b":"b840440a","t":"ldr w10, [x0], #0x4"},{"a":688,"b":"f1000529","t":"subs x9, x9, #0x1"},{"a":692,"b":"0b080148","t":"add w8, w10, w8"},{"a":696,"b":"54ffffa1","t":"b.ne 0x2ac"},{"a":700,"b":"14000002","t":"b 0x2c4"},{"a":704,"b":"2a1f03e8","t":"mov w8, wzr"},{"a":708,"b":"528ccce9","t":"mov w9, #0x6667"},{"a":712,"b":"72acccc9","t":"movk w9, #0x6666, lsl #16"},{"a":716,"b":"9b297d09","t":"smull x9, w8, w9"},{"a":720,"b":"d37ffd2a","t":"lsr x10, x9, #63"},{"a":724,"b":"9362fd29","t":"asr x9, x9, #34"},{"a":728,"b":"0b0a0129","t":"add w9, w9, w10"},{"a":732,"b":"5100192a","t":"sub w10, w9, #0x6"},{"a":736,"b":"7100155f","t":"cmp w10, #0x5"},{"a":740,"b":"540000a2","t":"b.hs 0x2f8"},{"a":744,"b":"9000000b","t":"adrp x11, 0x0"},{"a":748,"b":"9100016b","t":"add x11, x11, #0x0"},{"a":752,"b":"b86a596a","t":"ldr w10, [x11, w10, uxtw #2]"},{"a":756,"b":"14000002","t":"b 0x2fc"},{"a":760,"b":"2a1f03ea","t":"mov w10, wzr"},{"a":764,"b":"5280014b","t":"mov w11, #0xa"},{"a":768,"b":"1b0ba128","t":"msub w8, w9, w11, w8"},{"a":772,"b":"528000a9","t":"mov w9, #0x5"},{"a":776,"b":"7100151f","t":"cmp w8, #0x5"},{"a":780,"b":"1a89b108","t":"csel w8, w8, w9, lt"},{"a":784,"b":"0b080140","t":"add w0, w10, w8"},{"a":788,"b":"d65f03c0","t":"ret"}],"spans":[{"k":"division","s":"sum / 10","e":[708,712,716,720,724,728],"d":{"form":"magic multiply","magic":"0x66666667","shift":34}},{"k":"modulo","s":"sum % 10","e":[708,712,716,720,724,728,764,768],"d":{"form":"msub quotient * divisor from dividend"}},{"k":"switch","s":"switch (sum / 10) as lookup table","e":[736,740,744,748,752],"d":{"lowering":"lookup table","entries":5,"values":[16,32,64,128,128]}},{"k":"branchless select","s":"sum % 10 < 5 ? sum % 10 : 5","e":[776,780],"d":{}}],"bytes":124,"count":31},"O2":{"instructions":[{"a":776,"b":"7100043f","t":"cmp w1, #0x1"},{"a":780,"b":"540000eb","t":"b.lt 0x328"},{"a":784,"b":"71001c3f","t":"cmp w1, #0x7"},{"a":788,"b":"2a0103e9","t":"mov w9, w1"},{"a":792,"b":"540000e8","t":"b.hi 0x334"},{"a":796,"b":"aa1f03ea","t":"mov x10, xzr"},{"a":800,"b":"2a1f03e8","t":"mov w8, wzr"},{"a":804,"b":"14000014","t":"b 0x374"},{"a":808,"b":"2a1f03e8","t":"mov w8, wzr"},{"a":812,"b":"2a1f03e9","t":"mov w9, wzr"},{"a":816,"b":"1400002f","t":"b 0x3ec"},{"a":820,"b":"6f00e400","t":"movi v0.2d, #0000000000000000"},{"a":824,"b":"6f00e401","t":"movi v1.2d, #0000000000000000"},{"a":828,"b":"927d6d2a","t":"and x10, x9, #0x7ffffff8"},{"a":832,"b":"91004008","t":"add x8, x0, #0x10"},{"a":836,"b":"aa0a03eb","t":"mov x11, x10"},{"a":840,"b":"ad7f8d02","t":"ldp q2, q3, [x8, #-0x10]"},{"a":844,"b":"f100216b","t":"subs x11, x11, #0x8"},{"a":848,"b":"91008108","t":"add x8, x8, #0x20"},{"a":852,"b":"4ea08440","t":"add v0.4s, v2.4s, v0.4s"},{"a":856,"b":"4ea18461","t":"add v1.4s, v3.4s, v1.4s"},{"a":860,"b":"54ffff61","t":"b.ne 0x348"},{"a":864,"b":"4ea08420","t":"add v0.4s, v1.4s, v0.4s"},{"a":868,"b":"eb09015f","t":"cmp x10, x9"},{"a":872,"b":"4eb1b800","t":"addv s0, v0.4s"},{"a":876,"b":"1e260008","t":"fmov w8, s0"},{"a":880,"b":"540000e0","t":"b.eq 0x38c"},{"a":884,"b":"8b0a080b","t":"add x11, x0, x10, lsl #2"},{"a":888,"b":"cb0a0129","t":"sub x9, x9, x10"},{"a":892,"b":"b840456a","t":"ldr w10, [x11], #0x4"},{"a":896,"b":"f1000529","t":"subs x9, x9, #0x1"},{"a":900,"b":"0b080148","t":"add w8, w10, w8"},{"a":904,"b":"54ffffa1","t":"b.ne 0x37c"},{"a":908,"b":"528ccce9","t":"mov w9, #0x6667"},{"a":912,"b":"72acccc9","t":"movk w9, #0x6666, lsl #16"},{"a":916,"b":"9b297d09","t":"smull x9, w8, w9"},{"a":920,"b":"d37ffd2a","t":"lsr x10, x9, #63"},{"a":924,"b":"9362fd29","t":"asr x9, x9, #34"},{"a":928,"b":"0b0a0129","t":"add w9, w9, w10"},{"a":932,"b":"7100213f","t":"cmp w9, #0x8"},{"a":936,"b":"5400012c","t":"b.gt 0x3cc"},{"a":940,"b":"7100193f","t":"cmp w9, #0x6"},{"a":944,"b":"54000180","t":"b.eq 0x3e0"},{"a":948,"b":"71001d3f","t":"cmp w9, #0x7"},{"a":952,"b":"54000180","t":"b.eq 0x3e8"},{"a":956,"b":"7100213f","t":"cmp w9, #0x8"},{"a":960,"b":"54fffb61","t":"b.ne 0x32c"},{"a":964,"b":"52800809","t":"mov w9, #0x40"},{"a":968,"b":"14000009","t":"b 0x3ec"},{"a":972,"b":"51002529","t":"sub w9, w9, #0x9"},{"a":976,"b":"7100093f","t":"cmp w9, #0x2"},{"a":980,"b":"54fffac2","t":"b.hs 0x32c"},{"a":984,"b":"52801009","t":"mov w9, #0x80"},{"a":988,"b":"14000004","t":"b 0x3ec"},{"a":992,"b":"52800209","t":"mov w9, #0x10"},{"a":996,"b":"14000002","t":"b 0x3ec"},{"a":1000,"b":"52800409","t":"mov w9, #0x20"},{"a":1004,"b":"528cccea","t":"mov w10, #0x6667"},{"a":1008,"b":"72acccca","t":"movk w10, #0x6666, lsl #16"},{"a":1012,"b":"9b2a7d0a","t":"smull x10, w8, w10"},{"a":1016,"b":"d37ffd4b","t":"lsr x11, x10, #63"},{"a":1020,"b":"9362fd4a","t":"asr x10, x10, #34"},{"a":1024,"b":"0b0b014a","t":"add w10, w10, w11"},{"a":1028,"b":"5280014b","t":"mov w11, #0xa"},{"a":1032,"b":"1b0ba148","t":"msub w8, w10, w11, w8"},{"a":1036,"b":"528000aa","t":"mov w10, #0x5"},{"a":1040,"b":"7100151f","t":"cmp w8, #0x5"},{"a":1044,"b":"1a8ab108","t":"csel w8, w8, w10, lt"},{"a":1048,"b":"0b080120","t":"add w0, w9, w8"},{"a":1052,"b":"d65f03c0","t":"ret"}],"spans":[{"k":"division","s":"sum / 10","e":[908,912,916,920,924,928],"d":{"form":"magic multiply","magic":"0x66666667","shift":34}},{"k":"modulo","s":"sum % 10","e":[1004,1008,1012,1016,1020,1024,1028,1032],"d":{"form":"msub quotient * divisor from dividend"}},{"k":"switch","s":"switch (sum / 10) as comparison tree","e":[932,936,940,944,948,952,956,960,976,980],"d":{"lowering":"comparison tree"}},{"k":"vector loop","s":"vectorized loop: 4 lanes x 2 accumulators = 8 elements per iteration","e":[784,828,840,844,848,852,856,860,872,876],"d":{"lanes":4,"accumulators":2,"elementsPerIteration":8}},{"k":"branchless select","s":"sum % 10 < 5 ? sum % 10 : 5","e":[1040,1044],"d":{}}],"bytes":280,"count":70},"O3":{"instructions":[{"a":772,"b":"7100043f","t":"cmp w1, #0x1"},{"a":776,"b":"540000eb","t":"b.lt 0x324"},{"a":780,"b":"71001c3f","t":"cmp w1, #0x7"},{"a":784,"b":"2a0103e9","t":"mov w9, w1"},{"a":788,"b":"540000e8","t":"b.hi 0x330"},{"a":792,"b":"aa1f03ea","t":"mov x10, xzr"},{"a":796,"b":"2a1f03e8","t":"mov w8, wzr"},{"a":800,"b":"14000014","t":"b 0x370"},{"a":804,"b":"2a1f03e8","t":"mov w8, wzr"},{"a":808,"b":"2a1f03e9","t":"mov w9, wzr"},{"a":812,"b":"1400002f","t":"b 0x3e8"},{"a":816,"b":"6f00e400","t":"movi v0.2d, #0000000000000000"},{"a":820,"b":"6f00e401","t":"movi v1.2d, #0000000000000000"},{"a":824,"b":"927d6d2a","t":"and x10, x9, #0x7ffffff8"},{"a":828,"b":"91004008","t":"add x8, x0, #0x10"},{"a":832,"b":"aa0a03eb","t":"mov x11, x10"},{"a":836,"b":"ad7f8d02","t":"ldp q2, q3, [x8, #-0x10]"},{"a":840,"b":"f100216b","t":"subs x11, x11, #0x8"},{"a":844,"b":"91008108","t":"add x8, x8, #0x20"},{"a":848,"b":"4ea08440","t":"add v0.4s, v2.4s, v0.4s"},{"a":852,"b":"4ea18461","t":"add v1.4s, v3.4s, v1.4s"},{"a":856,"b":"54ffff61","t":"b.ne 0x344"},{"a":860,"b":"4ea08420","t":"add v0.4s, v1.4s, v0.4s"},{"a":864,"b":"eb09015f","t":"cmp x10, x9"},{"a":868,"b":"4eb1b800","t":"addv s0, v0.4s"},{"a":872,"b":"1e260008","t":"fmov w8, s0"},{"a":876,"b":"540000e0","t":"b.eq 0x388"},{"a":880,"b":"8b0a080b","t":"add x11, x0, x10, lsl #2"},{"a":884,"b":"cb0a0129","t":"sub x9, x9, x10"},{"a":888,"b":"b840456a","t":"ldr w10, [x11], #0x4"},{"a":892,"b":"f1000529","t":"subs x9, x9, #0x1"},{"a":896,"b":"0b080148","t":"add w8, w10, w8"},{"a":900,"b":"54ffffa1","t":"b.ne 0x378"},{"a":904,"b":"528ccce9","t":"mov w9, #0x6667"},{"a":908,"b":"72acccc9","t":"movk w9, #0x6666, lsl #16"},{"a":912,"b":"9b297d09","t":"smull x9, w8, w9"},{"a":916,"b":"d37ffd2a","t":"lsr x10, x9, #63"},{"a":920,"b":"9362fd29","t":"asr x9, x9, #34"},{"a":924,"b":"0b0a0129","t":"add w9, w9, w10"},{"a":928,"b":"7100213f","t":"cmp w9, #0x8"},{"a":932,"b":"5400012c","t":"b.gt 0x3c8"},{"a":936,"b":"7100193f","t":"cmp w9, #0x6"},{"a":940,"b":"54000180","t":"b.eq 0x3dc"},{"a":944,"b":"71001d3f","t":"cmp w9, #0x7"},{"a":948,"b":"54000180","t":"b.eq 0x3e4"},{"a":952,"b":"7100213f","t":"cmp w9, #0x8"},{"a":956,"b":"54fffb61","t":"b.ne 0x328"},{"a":960,"b":"52800809","t":"mov w9, #0x40"},{"a":964,"b":"14000009","t":"b 0x3e8"},{"a":968,"b":"51002529","t":"sub w9, w9, #0x9"},{"a":972,"b":"7100093f","t":"cmp w9, #0x2"},{"a":976,"b":"54fffac2","t":"b.hs 0x328"},{"a":980,"b":"52801009","t":"mov w9, #0x80"},{"a":984,"b":"14000004","t":"b 0x3e8"},{"a":988,"b":"52800209","t":"mov w9, #0x10"},{"a":992,"b":"14000002","t":"b 0x3e8"},{"a":996,"b":"52800409","t":"mov w9, #0x20"},{"a":1000,"b":"528cccea","t":"mov w10, #0x6667"},{"a":1004,"b":"72acccca","t":"movk w10, #0x6666, lsl #16"},{"a":1008,"b":"9b2a7d0a","t":"smull x10, w8, w10"},{"a":1012,"b":"d37ffd4b","t":"lsr x11, x10, #63"},{"a":1016,"b":"9362fd4a","t":"asr x10, x10, #34"},{"a":1020,"b":"0b0b014a","t":"add w10, w10, w11"},{"a":1024,"b":"5280014b","t":"mov w11, #0xa"},{"a":1028,"b":"1b0ba148","t":"msub w8, w10, w11, w8"},{"a":1032,"b":"528000aa","t":"mov w10, #0x5"},{"a":1036,"b":"7100151f","t":"cmp w8, #0x5"},{"a":1040,"b":"1a8ab108","t":"csel w8, w8, w10, lt"},{"a":1044,"b":"0b080120","t":"add w0, w9, w8"},{"a":1048,"b":"d65f03c0","t":"ret"}],"spans":[{"k":"division","s":"sum / 10","e":[904,908,912,916,920,924],"d":{"form":"magic multiply","magic":"0x66666667","shift":34}},{"k":"modulo","s":"sum % 10","e":[1000,1004,1008,1012,1016,1020,1024,1028],"d":{"form":"msub quotient * divisor from dividend"}},{"k":"switch","s":"switch (sum / 10) as comparison tree","e":[928,932,936,940,944,948,952,956,972,976],"d":{"lowering":"comparison tree"}},{"k":"vector loop","s":"vectorized loop: 4 lanes x 2 accumulators = 8 elements per iteration","e":[780,824,836,840,844,848,852,856,868,872],"d":{"lanes":4,"accumulators":2,"elementsPerIteration":8}},{"k":"branchless select","s":"sum % 10 < 5 ? sum % 10 : 5","e":[1036,1040],"d":{}}],"bytes":280,"count":70}}}};

  var LEVELS = ['O0', 'O1', 'O2', 'O3'];
  var ARCHES = [
    { id: 'x86_64', label: 'x86-64' },
    { id: 'arm64', label: 'arm64' }
  ];
  var TINTS = {
    'division': 'rgba(53,83,255,.22)',
    'modulo': 'rgba(53,83,255,.42)',
    'switch': 'rgba(184,135,15,.30)',
    'vector loop': 'rgba(24,140,90,.26)',
    'unrolled loop': 'rgba(24,140,90,.46)',
    'branchless select': 'rgba(150,60,170,.26)',
    'branchless flag': 'rgba(150,60,170,.16)',
    'tail call': 'rgba(200,80,40,.26)',
    'inlined call': 'rgba(200,80,40,.16)',
    'memset': 'rgba(110,110,110,.28)',
    'memcpy': 'rgba(110,110,110,.28)',
    'strength reduction': 'rgba(53,83,255,.12)'
  };

  function ensureStyles() {
    if (document.getElementById('re39-styles')) return;
    var style = document.createElement('style');
    style.id = 're39-styles';
    style.textContent = [
      '.re39 *{box-sizing:border-box}',
      '.re39__note{margin:0 0 12px!important;color:var(--ink-soft,#555)!important;font-family:var(--font-body,serif)!important;font-size:.96rem!important;line-height:1.55!important;text-align:left!important}',
      '.re39__controls{display:grid;gap:10px;margin-bottom:12px}',
      '.re39__group-label{font-family:var(--font-mono,monospace);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-mute,#777);margin-bottom:6px}',
      '.re39__row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
      '.re39 button{min-height:40px;padding:8px 12px;border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5);color:var(--ink,#1a1a1a);font-family:var(--font-mono,monospace);font-size:.76rem;line-height:1.35;cursor:pointer;transition:transform 150ms cubic-bezier(.23,1,.32,1),border-color 180ms ease,background-color 180ms ease}',
      '.re39 button:active{transform:scale(.96)}',
      '.re39 button:focus-visible{outline:2px solid var(--blueprint,#3553ff);outline-offset:2px}',
      '.re39 button[aria-pressed="true"]{border-color:var(--blueprint,#3553ff);background:var(--blueprint,#3553ff);color:var(--bg,#fafaf5)}',
      '.re39__slider{display:grid;grid-template-columns:1fr;gap:4px;flex:1 1 220px;min-width:220px}',
      '.re39__slider input{width:100%;accent-color:var(--blueprint,#3553ff);min-height:40px;margin:0}',
      '.re39__ticks{display:flex;justify-content:space-between;font-family:var(--font-mono,monospace);font-size:.74rem;color:var(--ink-mute,#777)}',
      '.re39__ticks span[data-on="true"]{color:var(--blueprint,#3553ff);font-weight:600}',
      '.re39__legend{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}',
      '.re39__chip{min-height:32px!important;padding:4px 10px!important;font-size:.72rem!important;border-radius:999px}',
      '.re39__chip[data-absent="true"]{opacity:.45}',
      '.re39__chip[aria-pressed="true"]{color:var(--ink,#1a1a1a)!important;background:var(--bg,#fafaf5)!important;border-color:var(--ink,#1a1a1a)!important}',
      '.re39__swatch{display:inline-block;width:10px;height:10px;border:1px solid var(--rule-soft,#ddd);margin-right:6px;vertical-align:-1px}',
      '.re39__panes{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:12px}',
      '.re39__listing{border:1px solid var(--rule-soft,#ddd);background:var(--bg,#fafaf5);max-height:440px;overflow:auto;font-family:var(--font-mono,monospace);font-size:.74rem;line-height:1.45}',
      '.re39__line{display:grid;grid-template-columns:3.2em minmax(6.5em,auto) 1fr;gap:10px;padding:1px 8px;white-space:pre;color:var(--ink,#1a1a1a);border-left:3px solid transparent}',
      '.re39__line[data-dim="true"]{opacity:.38}',
      '.re39__line[data-focus="true"]{border-left-color:var(--ink,#1a1a1a)}',
      '.re39__addr{color:var(--ink-mute,#777)}',
      '.re39__bytes{color:var(--ink-soft,#555);overflow:hidden;text-overflow:ellipsis}',
      '.re39__detail{border:1px solid var(--rule-soft,#ddd);background:var(--bg-surface,#f3f1e8);padding:10px 12px;font-family:var(--font-mono,monospace);font-size:.76rem;line-height:1.5;color:var(--ink,#1a1a1a);max-height:440px;overflow:auto}',
      '.re39__item{padding:8px 0;border-top:1px solid var(--rule-soft,#ddd);cursor:pointer}',
      '.re39__item:first-child{border-top:none;padding-top:0}',
      '.re39__item[data-on="true"] .re39__kind{text-decoration:underline}',
      '.re39__kind{font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-mute,#777)}',
      '.re39__src{display:block;margin:2px 0;color:var(--ink,#1a1a1a);white-space:pre-wrap;word-break:break-word}',
      '.re39__meta{color:var(--ink-soft,#555);white-space:pre-wrap;word-break:break-word}',
      '.re39__verdict{margin-top:10px;padding:10px 12px;border:1px solid var(--blueprint,#3553ff);font-family:var(--font-mono,monospace);font-size:.8rem;line-height:1.5;color:var(--ink,#1a1a1a);background:var(--blueprint-tint,rgba(53,83,255,.08))}',
      '@media (hover:hover) and (pointer:fine){.re39 button:hover{border-color:var(--blueprint,#3553ff)}.re39__item:hover .re39__kind{color:var(--ink,#1a1a1a)}}',
      '@media (max-width:760px){.re39__panes{grid-template-columns:1fr}.re39__listing,.re39__detail{max-height:300px}}',
      '@media (prefers-reduced-motion:reduce){.re39 button{transition:none!important}.re39 button:active{transform:none!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function hex(n) { return '0x' + n.toString(16); }

  function levelData(arch, level) {
    return DATA.arches[arch][LEVELS[level]];
  }

  function ownerMap(spans) {
    var owner = {};
    var i, j;
    for (i = 0; i < spans.length; i++) {
      for (j = 0; j < spans[i].e.length; j++) {
        if (owner[spans[i].e[j]] === undefined) owner[spans[i].e[j]] = i;
      }
    }
    return owner;
  }

  function countKinds(spans) {
    var counts = {};
    var i;
    for (i = 0; i < spans.length; i++) counts[spans[i].k] = (counts[spans[i].k] || 0) + 1;
    return counts;
  }

  function detailText(span) {
    var parts = [];
    var d = span.d || {};
    if (d.form) parts.push('form: ' + d.form);
    if (d.lowering) parts.push('lowering: ' + d.lowering);
    if (d.magic) parts.push('magic ' + d.magic + ', shift ' + d.shift);
    if (d.entries !== undefined && d.entries !== null) parts.push(d.entries + ' entries');
    if (d.values) parts.push('values [' + d.values.join(', ') + ']');
    if (d.targets && d.targets.length) parts.push('targets ' + d.targets.join(' '));
    if (d.lanes) parts.push(d.lanes + ' lanes x ' + d.accumulators + ' accumulators, ' + d.elementsPerIteration + ' elements per iteration');
    if (d.copies) parts.push(d.copies + ' copies');
    if (d.formula) parts.push('formula ' + d.formula);
    if (d.callee) parts.push('callee ' + d.callee);
    parts.push(span.e.length + (span.e.length === 1 ? ' instruction: ' : ' instructions: ') + span.e.map(hex).join(' '));
    return parts.join('\n');
  }

  function verdictText(arch, level, data) {
    var counts = countKinds(data.spans);
    var names = Object.keys(counts).sort();
    var list = [];
    var i;
    for (i = 0; i < names.length; i++) list.push(counts[names[i]] > 1 ? names[i] + ' x' + counts[names[i]] : names[i]);
    var archLabel = arch === 'x86_64' ? 'x86-64' : 'arm64';
    var head = DATA['function'] + ' at -' + LEVELS[level] + ' on ' + archLabel + ': ' + data.count + ' instructions, ' + data.bytes + ' bytes, ' + data.spans.length + (data.spans.length === 1 ? ' idiom' : ' idioms');
    return head + (list.length ? ' (' + list.join(', ') + ').' : '.');
  }

  function idiomSlider(host) {
    ensureStyles();
    var state = { arch: 'x86_64', level: 2, focus: -1 };
    var listing = el('div', { class: 're39__listing', role: 'list', 'aria-label': 'Disassembly listing with recognized idioms' });
    var detail = el('div', { class: 're39__detail' });
    var verdict = el('div', { class: 're39__verdict', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    var legend = el('div', { class: 're39__legend', role: 'group', 'aria-label': 'Idiom kinds' });
    var archButtons = [];
    var sliderId = LF.uid('lf-re39-level');
    var slider = el('input', { type: 'range', min: '0', max: '3', step: '1', value: String(state.level), id: sliderId, 'aria-label': 'Optimization level', 'aria-valuetext': '-O2' });
    var ticks = el('div', { class: 're39__ticks', 'aria-hidden': 'true' });
    var tickNodes = [];
    var i;
    for (i = 0; i < LEVELS.length; i++) {
      var tick = el('span', {}, ['-' + LEVELS[i]]);
      tickNodes.push(tick);
      ticks.appendChild(tick);
    }

    function render() {
      var data = levelData(state.arch, state.level);
      var owner = ownerMap(data.spans);
      var counts = countKinds(data.spans);
      var k;
      if (state.focus >= data.spans.length) state.focus = -1;
      while (listing.firstChild) listing.removeChild(listing.firstChild);
      for (k = 0; k < data.instructions.length; k++) {
        var insn = data.instructions[k];
        var spanIndex = owner[insn.a];
        var attrs = { class: 're39__line', role: 'listitem' };
        if (spanIndex !== undefined) {
          attrs.style = 'background:' + (TINTS[data.spans[spanIndex].k] || 'transparent');
          attrs.title = data.spans[spanIndex].k + ': ' + data.spans[spanIndex].s;
        }
        if (state.focus >= 0) {
          attrs['data-dim'] = spanIndex === state.focus ? 'false' : 'true';
          attrs['data-focus'] = spanIndex === state.focus ? 'true' : 'false';
        }
        listing.appendChild(el('div', attrs, [
          el('span', { class: 're39__addr' }, [hex(insn.a)]),
          el('span', { class: 're39__bytes' }, [insn.b]),
          el('span', {}, [insn.t])
        ]));
      }
      while (detail.firstChild) detail.removeChild(detail.firstChild);
      if (!data.spans.length) {
        detail.appendChild(el('div', { class: 're39__meta' }, ['no idiom recognized at this level']));
      }
      data.spans.forEach(function (span, index) {
        var item = el('div', { class: 're39__item', role: 'button', tabindex: '0', 'data-on': state.focus === index ? 'true' : 'false', 'aria-pressed': state.focus === index ? 'true' : 'false' }, [
          el('div', { class: 're39__kind' }, [el('span', { class: 're39__swatch', style: 'background:' + (TINTS[span.k] || 'transparent') }), span.k]),
          el('span', { class: 're39__src' }, [span.s]),
          el('div', { class: 're39__meta' }, [detailText(span)])
        ]);
        function toggle() { state.focus = state.focus === index ? -1 : index; render(); }
        item.addEventListener('click', toggle);
        item.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); } });
        detail.appendChild(item);
      });
      while (legend.firstChild) legend.removeChild(legend.firstChild);
      DATA.kinds.forEach(function (kind) {
        var present = !!counts[kind];
        var chip = el('button', { type: 'button', class: 're39__chip', 'data-absent': present ? 'false' : 'true', 'aria-pressed': (state.focus >= 0 && data.spans[state.focus].k === kind) ? 'true' : 'false' }, [
          el('span', { class: 're39__swatch', style: 'background:' + (TINTS[kind] || 'transparent') }),
          kind + (counts[kind] > 1 ? ' x' + counts[kind] : '')
        ]);
        if (!present) chip.setAttribute('disabled', 'disabled');
        chip.addEventListener('click', function () {
          var j;
          var first = -1;
          for (j = 0; j < data.spans.length; j++) if (data.spans[j].k === kind) { first = j; break; }
          state.focus = (state.focus >= 0 && data.spans[state.focus].k === kind) ? -1 : first;
          render();
        });
        legend.appendChild(chip);
      });
      for (k = 0; k < archButtons.length; k++) archButtons[k].button.setAttribute('aria-pressed', archButtons[k].id === state.arch ? 'true' : 'false');
      for (k = 0; k < tickNodes.length; k++) tickNodes[k].setAttribute('data-on', k === state.level ? 'true' : 'false');
      slider.value = String(state.level);
      slider.setAttribute('aria-valuetext', '-' + LEVELS[state.level]);
      verdict.textContent = verdictText(state.arch, state.level, data);
    }

    var archRow = el('div', { class: 're39__row', role: 'group', 'aria-label': 'Architecture' });
    ARCHES.forEach(function (arch) {
      var button = el('button', { type: 'button', 'aria-pressed': 'false' }, [arch.label]);
      button.addEventListener('click', function () { state.arch = arch.id; state.focus = -1; render(); });
      archButtons.push({ id: arch.id, button: button });
      archRow.appendChild(button);
    });
    slider.addEventListener('input', function () { state.level = parseInt(slider.value, 10) || 0; state.focus = -1; render(); });
    slider.addEventListener('change', function () { state.level = parseInt(slider.value, 10) || 0; render(); });

    var controls = el('div', { class: 're39__controls' }, [
      el('div', { class: 're39__row' }, [
        el('div', {}, [el('div', { class: 're39__group-label' }, ['architecture']), archRow]),
        el('div', { class: 're39__slider' }, [el('label', { class: 're39__group-label', 'for': sliderId }, ['optimization level']), slider, ticks])
      ])
    ]);

    host.appendChild(el('div', { class: 'lf re39' }, [
      el('div', { class: 'lf-head' }, [el('span', { class: 'lf-label' }, ['IDIOMS BY LEVEL']), el('span', {}, [DATA['function'] + ' from idioms.c, clang 17'])]),
      el('div', { class: 'lf-body' }, [
        el('p', { class: 're39__note' }, ['Move the slider from -O0 to -O3 and switch the architecture. The listing is llvm-objdump output of digest. Each tinted row belongs to one idiom the recognizer found; the panel on the right gives the decoded source form and the evidence instructions. Click an idiom or a legend chip to dim everything else.']),
        controls,
        legend,
        el('div', { class: 're39__panes' }, [listing, detail]),
        verdict
      ]),
      el('div', { class: 'lf-cap' }, ['Blue rows are the division and the modulo by 10, amber rows are the switch lowering, green rows are the vectorized loop, purple rows are the branchless select. Rows with no tint are prologue, loop control, or moves the recognizer does not claim. On x86-64 at -O0 the division is already a magic multiply, the modulo is a hardware idivl, and the switch is a jump table. On arm64 at -O0 both use sdiv and the switch is a compare chain. At -O1 the switch becomes a lookup table on both. At -O2 and -O3 the loop is vectorized, the x86-64 switch is a jump table again, and the arm64 switch is a comparison tree.'])
    ]));
    render();
  }

  LF.register({ 're-39-idioms-by-level': idiomSlider });
})();
