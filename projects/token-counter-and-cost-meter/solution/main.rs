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
    println!(
        "ESTIMATE {} tokens (4 chars/token fixture)",
        estimate("Explain agent budgets", 4).unwrap()
    );
    let u = parse_usage("100,20,40").unwrap();
    let c = cost(
        &u,
        &Rates {
            input: 2,
            output: 5,
            cached: 1,
        },
    )
    .unwrap();
    println!("RECORDED {:?}; COST {} nano-dollars", u, c);
    let mut spent = 740;
    println!(
        "ADMISSION {:?}; spent {}",
        reserve(&mut spent, c, 1000),
        spent
    );
    println!("NEXT {:?}", reserve(&mut spent, 1, 1000));
}
