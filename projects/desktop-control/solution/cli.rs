#[allow(dead_code)]
mod learner { include!("main.rs"); }
use learner::{Controller,FixtureBackend};
use std::{env,fs,path::Path};
fn execute(input:&str, output:&Path) -> Result<(),String> {
    if input.len()>16000 {return Err("action file too large".into());}
    fs::create_dir_all(output).map_err(|e|e.to_string())?;
    let mut controller=Controller::new(FixtureBackend::new(),32)?;
    for (index,line) in input.lines().enumerate(){
        if line.trim().is_empty(){continue;}
        let parts:Vec<_>=line.split('\t').collect();
        let result=match parts.as_slice(){
            ["capture"]=>controller.capture().and_then(|frame|fs::write(output.join(format!("frame-{}.ppm",index+1)),frame.bytes).map_err(|e|e.to_string())),
            ["click",x,y,generation]=>controller.click(x.parse().map_err(|_|"bad x")?,y.parse().map_err(|_|"bad y")?,generation.parse().map_err(|_|"bad generation")?),
            ["type",text]=>controller.type_text(text),
            _=>Err("expected capture, click<TAB>x<TAB>y<TAB>generation, or type<TAB>text".into())
        };
        result.map_err(|error|format!("line {}: {}",index+1,error))?;
    }
    fs::write(output.join("trace.txt"),controller.trace.join("\n")).map_err(|e|e.to_string())?;
    println!("backend=fixture complete={} calls={} frames={} native_verified=false",controller.backend.complete,controller.calls,output.display());
    Ok(())
}
fn main(){
    let args:Vec<_>=env::args().collect();
    let result=if args.len()!=3 {Err("usage: desktop-cli samples/actions.tsv output-directory".into())} else {fs::read_to_string(&args[1]).map_err(|e|e.to_string()).and_then(|input|execute(&input,Path::new(&args[2])))};
    if let Err(error)=result{eprintln!("{}",error);std::process::exit(1);}
}
