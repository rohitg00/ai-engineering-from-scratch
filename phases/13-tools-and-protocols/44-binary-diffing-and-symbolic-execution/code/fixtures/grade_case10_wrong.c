int grade(int score) {
    switch (score / 10) {
    case 10: return 3;
    case 9: return 4;
    case 8: return 3;
    case 7: return 2;
    case 6: return 1;
    default: return 0;
    }
}
