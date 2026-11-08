#include <setjmp.h>
#include <signal.h>
#include <stdio.h>
#include <string.h>

int percent_change(int before, int after);
int grade(int score);
int cand_percent_change(int before, int after);
int cand_grade(int score);

static sigjmp_buf trap_env;

static void on_fpe(int sig) {
    (void)sig;
    siglongjmp(trap_env, 1);
}

static void show(int (*two)(int, int), int (*one)(int), int a, int b) {
    if (sigsetjmp(trap_env, 1) == 0) {
        int result = two ? two(a, b) : one(a);
        printf(" %d", result);
    } else {
        printf(" trap");
    }
}

int main(void) {
    struct sigaction action;
    char line[256];
    char name[64];
    int a;
    int b;

    memset(&action, 0, sizeof action);
    action.sa_handler = on_fpe;
    sigemptyset(&action.sa_mask);
    action.sa_flags = SA_NODEFER;
    sigaction(SIGFPE, &action, 0);

    while (fgets(line, sizeof line, stdin)) {
        int fields = sscanf(line, "%63s %d %d", name, &a, &b);
        if (fields < 2) continue;
        if (strcmp(name, "percent_change") == 0 && fields == 3) {
            printf("percent_change %d %d", a, b);
            show(percent_change, 0, a, b);
            show(cand_percent_change, 0, a, b);
            printf("\n");
        } else if (strcmp(name, "grade") == 0) {
            printf("grade %d", a);
            show(0, grade, a, 0);
            show(0, cand_grade, a, 0);
            printf("\n");
        }
    }
    return 0;
}
