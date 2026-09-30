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
    let fields=parse("---\nname: code-review\ndescription: Check every changed line\n---\nRead the diff. Cite line numbers.").unwrap();
    let skill = validate(&fields, "code-review").unwrap();
    println!("DISCOVERY {}", disclose(&skill, false, 200).unwrap());
    println!("ACTIVATED {}", disclose(&skill, true, 200).unwrap());
    println!("BUDGET {:?}", disclose(&skill, true, 10));
}
