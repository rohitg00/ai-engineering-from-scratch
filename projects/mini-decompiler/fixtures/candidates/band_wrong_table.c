int band(int zone) {
    switch (zone) {
    case 0: return 5;
    case 1: return 8;
    case 2: return 12;
    case 3: return 20;
    case 4: return 21;
    case 5: return 35;
    default: return -1;
    }
}
