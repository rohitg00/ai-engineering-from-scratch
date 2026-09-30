pub mod types;
pub use types::*;
pub mod stage1;
pub use stage1::*;
pub mod stage2;
pub use stage2::*;
pub mod stage3;
pub use stage3::*;
pub mod stage4;
pub use stage4::*;
fn main() {
    let mut log = vec![];
    for raw in [
        "1|reader|read|notes.md",
        "2|reader|write|notes.md",
        "3|editor|write|notes.md",
    ] {
        let c = call(raw, 256).unwrap();
        let d = decide(&c);
        audit(&mut log, &c, &d, 10).unwrap();
        println!("{:?}", d);
    }
    println!("AUDIT\n{}", log.join("\n"));
}
