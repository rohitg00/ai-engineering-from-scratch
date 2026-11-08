extern "C" int printf(const char *format, ...);

struct Shape {
    virtual ~Shape() {}
    virtual int area() const = 0;
    virtual const char *name() const { return "shape"; }
};

struct Rect : Shape {
    int w, h;
    Rect(int w_, int h_) : w(w_), h(h_) {}
    int area() const override { return w * h; }
    const char *name() const override { return "rect"; }
};

int describe(const Shape &s, int scale) {
    return s.area() * scale;
}

int main() {
    Rect r(3, 4);
    printf("%s %d\n", r.name(), describe(r, 2));
    return 0;
}
