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
    let args: Vec<String> = std::env::args().skip(1).collect();
    let result = (|| -> Result<String, Error> {
        let request = needs(
            args.first()
                .ok_or_else(|| Error::Invalid("requirements required".into()))?,
        )?;
        let budget = args
            .get(1)
            .ok_or(Error::Limit)?
            .parse::<u32>()
            .map_err(|_| Error::Limit)?;
        let selected = select(&request, &profiles(), budget)?;
        plan(&request, &selected)
    })();
    match result {
        Ok(out) => print!("{}", out),
        Err(e) => {
            eprintln!("{:?}", e);
            std::process::exit(1)
        }
    }
}
