#include <setjmp.h>
#include <signal.h>
#include <stdio.h>
#include <string.h>

#if TARGET == 1
int f1(int before, int after);
int cand(int before, int after);
#else
int f2(int score);
int cand(int score);
#endif

static sigjmp_buf trap_env;

static void on_fpe(int sig) {
    (void)sig;
    siglongjmp(trap_env, 1);
}

static void show(int which, int a, int b) {
    if (sigsetjmp(trap_env, 1) == 0) {
#if TARGET == 1
        int result = which ? cand(a, b) : f1(a, b);
#else
        int result = which ? cand(a) : f2(a);
        (void)b;
#endif
        printf(" %d", result);
    } else {
        printf(" trap");
    }
}

int main(void) {
    struct sigaction action;
    char line[256];
    int a;
    int b;

    memset(&action, 0, sizeof action);
    action.sa_handler = on_fpe;
    sigemptyset(&action.sa_mask);
    action.sa_flags = SA_NODEFER;
    sigaction(SIGFPE, &action, 0);

    while (fgets(line, sizeof line, stdin)) {
        b = 0;
        if (sscanf(line, "%d %d", &a, &b) < 1) continue;
        printf("%d %d", a, b);
        show(0, a, b);
        show(1, a, b);
        printf("\n");
    }
    return 0;
}
