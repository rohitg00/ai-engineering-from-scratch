#[derive(Debug, Clone, PartialEq)]
pub struct Frame {
    pub width: u32,
    pub height: u32,
    pub scale: f64,
    pub generation: u64,
    pub format: String,
    pub bytes: Vec<u8>,
}
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Point {
    pub x: u32,
    pub y: u32,
}
impl Frame {
    pub fn validate(&self) -> Result<(), String> {
        Err("Not implemented: validate frame".into())
    }
    pub fn logical_point(&self, _x: f64, _y: f64) -> Result<Point, String> {
        Err("Not implemented: coordinate conversion".into())
    }
}
pub trait Backend {
    fn capture(&mut self) -> Result<Frame,String>;
    fn click(&mut self,point:Point) -> Result<(),String>;
    fn type_text(&mut self,text:&str) -> Result<(),String>;
}
pub struct FixtureBackend {pub focused:bool,pub text:String,pub complete:bool,pub generation:u64}
impl FixtureBackend {pub fn new()->Self {Self{focused:false,text:String::new(),complete:false,generation:0}}}
impl Backend for FixtureBackend {
    fn capture(&mut self)->Result<Frame,String>{Err("Not implemented: fixture pixels".into())}
    fn click(&mut self,_point:Point)->Result<(),String>{Err("Not implemented: focus and submit".into())}
    fn type_text(&mut self,_text:&str)->Result<(),String>{Err("Not implemented: focused typing".into())}
}
pub struct Controller<B:Backend>{pub backend:B,pub last:Option<Frame>,pub calls:usize,pub max_calls:usize,pub trace:Vec<String>}
impl<B:Backend> Controller<B>{
    pub fn new(_backend:B,_max_calls:usize)->Result<Self,String>{Err("Not implemented: controller".into())}
    pub fn capture(&mut self)->Result<Frame,String>{Err("Not implemented: bounded capture".into())}
    pub fn click(&mut self,_x:f64,_y:f64,_generation:u64)->Result<(),String>{Err("Not implemented: guarded click".into())}
    pub fn type_text(&mut self,_text:&str)->Result<(),String>{Err("Not implemented: bounded typing".into())}
}
pub fn click_argv(_point:Point)->Vec<String>{panic!("Not implemented: click arguments")}
pub fn text_argv(_text:&str)->Result<Vec<String>,String>{Err("Not implemented: text arguments".into())}
pub fn png_dimensions(_bytes:&[u8])->Result<(u32,u32),String>{Err("Not implemented: dimensions".into())}
pub struct MacBackend{pub scale:f64,pub generation:u64}
impl Backend for MacBackend {
    fn capture(&mut self)->Result<Frame,String>{Err("Not implemented: native capture".into())}
    fn click(&mut self,_point:Point)->Result<(),String>{Err("Not implemented: native click".into())}
    fn type_text(&mut self,_text:&str)->Result<(),String>{Err("Not implemented: native typing".into())}
}
fn main(){panic!("Use cli.rs after implementing the stages");}
