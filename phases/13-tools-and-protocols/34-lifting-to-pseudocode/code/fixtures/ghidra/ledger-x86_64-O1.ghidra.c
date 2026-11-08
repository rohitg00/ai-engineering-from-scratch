/* percent_change: Ghidra 12.1.4 decompiler text returned by rea 6.5.0 procedure_pseudo_code, verbatim. */
undefined1  [16] percent_change(int param_1,int param_2,ulong param_3)

{
  long lVar1;
  undefined1 auVar2 [16];
  undefined1 auVar3 [16];
  
  if (param_1 != 0) {
    lVar1 = (long)((param_2 - param_1) * 100);
    auVar3._0_8_ = lVar1 / (long)param_1 & 0xffffffff;
    auVar3._8_8_ = lVar1 % (long)param_1 & 0xffffffff;
    return auVar3;
  }
  auVar2._8_8_ = 0;
  auVar2._0_8_ = param_3;
  return auVar2 << 0x40;
}

/* grade: Ghidra 12.1.4 decompiler text returned by rea 6.5.0 procedure_pseudo_code, verbatim. */
uint grade(int param_1)

{
  uint uVar1;
  uint uVar2;
  
  uVar2 = param_1 / 10 - 6;
  uVar1 = -(param_1 >> 0x1f) ^ (uint)((ulong)((long)param_1 * 0x66666667) >> 0x3f);
  if (uVar2 < 5) {
    uVar1 = *(uint *)(&DAT_001000b4 + (ulong)uVar2 * 4);
  }
  return uVar1;
}

/* total: Ghidra 12.1.4 decompiler text returned by rea 6.5.0 procedure_pseudo_code, verbatim. */
int total(long param_1,uint param_2)

{
  int iVar1;
  ulong uVar2;
  
  if (0 < (int)param_2) {
    uVar2 = 0;
    iVar1 = 0;
    do {
      iVar1 = iVar1 + *(int *)(param_1 + uVar2 * 4);
      uVar2 = uVar2 + 1;
    } while (param_2 != uVar2);
    return iVar1;
  }
  return 0;
}
