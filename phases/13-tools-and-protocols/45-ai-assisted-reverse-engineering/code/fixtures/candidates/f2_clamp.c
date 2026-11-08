static int clamp_score(int score) {
    if (score < 0) return 0;
    if (score > 100) return 100;
    return score;
}

int grade(int score) {
    switch (clamp_score(score) / 10) {
    case 10:
    case 9: return 4;
    case 8: return 3;
    case 7: return 2;
    case 6: return 1;
    default: return 0;
    }
}
