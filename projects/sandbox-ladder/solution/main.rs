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
    let n = needs("untrusted=true,secrets=true,network=true,host_kernel=true").unwrap();
    println!("BUDGET 4: {:?}", select(&n, &profiles(), 4));
    let p = select(&n, &profiles(), 5).unwrap();
    print!("{}", plan(&n, &p).unwrap());
}
