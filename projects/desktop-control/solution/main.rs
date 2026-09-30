// Desktop Control Backend from the standard library.
// Stage contracts live under projects/desktop-control/stages/.
// The default demo is bounded and uses only the local fixture.
// Official references are listed in README.md.

use std::fs;
use std::process::Command;
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
        if self.width == 0
            || self.height == 0
            || self.width > 10000
            || self.height > 10000
            || !self.scale.is_finite()
            || self.scale <= 0.0
            || self.scale > 4.0
            || !matches!(self.format.as_str(), "ppm" | "png")
            || self.bytes.is_empty()
        {
            return Err("invalid frame".into());
        }
        Ok(())
    }
    pub fn logical_point(&self, x: f64, y: f64) -> Result<Point, String> {
        self.validate()?;
        if !x.is_finite()
            || !y.is_finite()
            || x < 0.0
            || y < 0.0
            || x >= self.width as f64
            || y >= self.height as f64
        {
            return Err("point outside frame".into());
        }
        Ok(Point {
            x: (x / self.scale).floor() as u32,
            y: (y / self.scale).floor() as u32,
        })
    }
}
pub trait Backend {
    fn capture(&mut self) -> Result<Frame, String>;
    fn click(&mut self, point: Point) -> Result<(), String>;
    fn type_text(&mut self, text: &str) -> Result<(), String>;
}
pub struct FixtureBackend {
    pub focused: bool,
    pub text: String,
    pub complete: bool,
    pub generation: u64,
}
impl FixtureBackend {
    pub fn new() -> Self {
        Self {
            focused: false,
            text: String::new(),
            complete: false,
            generation: 0,
        }
    }
}
impl Backend for FixtureBackend {
    fn capture(&mut self) -> Result<Frame, String> {
        let mut bytes = b"P6\n320 200\n255\n".to_vec();
        for y in 0..200 {
            for x in 0..320 {
                let color = if self.complete {
                    [20, 150, 90]
                } else if (20..300).contains(&x) && (50..105).contains(&y) {
                    if self.focused {
                        [210, 230, 250]
                    } else {
                        [245, 245, 245]
                    }
                } else if (180..300).contains(&x) && (140..180).contains(&y) {
                    [40, 100, 180]
                } else {
                    [30, 35, 42]
                };
                bytes.extend_from_slice(&color);
            }
        }
        Ok(Frame {
            width: 320,
            height: 200,
            scale: 1.0,
            generation: self.generation,
            format: "ppm".into(),
            bytes,
        })
    }
    fn click(&mut self, p: Point) -> Result<(), String> {
        if p.x >= 320 || p.y >= 200 {
            return Err("outside scene".into());
        }
        self.focused = (20..300).contains(&p.x) && (50..105).contains(&p.y);
        if (180..300).contains(&p.x) && (140..180).contains(&p.y) && !self.text.is_empty() {
            self.complete = true;
        }
        self.generation += 1;
        Ok(())
    }
    fn type_text(&mut self, text: &str) -> Result<(), String> {
        if !self.focused {
            return Err("field not focused".into());
        }
        if text.is_empty() || text.len() > 200 || text.chars().any(|c| c.is_control()) {
            return Err("invalid text".into());
        }
        self.text = text.into();
        self.generation += 1;
        Ok(())
    }
}
pub struct Controller<B: Backend> {
    pub backend: B,
    pub last: Option<Frame>,
    pub calls: usize,
    pub max_calls: usize,
    pub trace: Vec<String>,
}
impl<B: Backend> Controller<B> {
    pub fn new(backend: B, max_calls: usize) -> Result<Self, String> {
        if max_calls == 0 || max_calls > 100 {
            return Err("invalid budget".into());
        }
        Ok(Self {
            backend,
            last: None,
            calls: 0,
            max_calls,
            trace: Vec::new(),
        })
    }
    fn reserve(&mut self) -> Result<(), String> {
        if self.calls >= self.max_calls {
            return Err("action budget exhausted".into());
        }
        self.calls += 1;
        Ok(())
    }
    pub fn capture(&mut self) -> Result<Frame, String> {
        self.reserve()?;
        let frame = self.backend.capture()?;
        frame.validate()?;
        self.last = Some(frame.clone());
        self.trace
            .push(format!("capture generation={}", frame.generation));
        Ok(frame)
    }
    pub fn click(&mut self, x: f64, y: f64, generation: u64) -> Result<(), String> {
        let frame = self.last.as_ref().ok_or("capture required")?;
        if frame.generation != generation {
            return Err("stale frame".into());
        }
        let point = frame.logical_point(x, y)?;
        self.reserve()?;
        self.last = None;
        self.backend.click(point)?;
        self.trace.push(format!("click {},{}", point.x, point.y));
        Ok(())
    }
    pub fn type_text(&mut self, text: &str) -> Result<(), String> {
        if text.is_empty() || text.len() > 200 || text.chars().any(|c| c.is_control()) {
            return Err("invalid text".into());
        }
        self.reserve()?;
        self.last = None;
        self.backend.type_text(text)?;
        self.trace.push(format!("type {} bytes", text.len()));
        Ok(())
    }
}
pub fn click_argv(p: Point) -> Vec<String> {
    vec!["-e".into(),"on run argv\ntell application \"System Events\" to click at {(item 1 of argv as integer), (item 2 of argv as integer)}\nend run".into(),"--".into(),p.x.to_string(),p.y.to_string()]
}
pub fn text_argv(text: &str) -> Result<Vec<String>, String> {
    if text.is_empty() || text.len() > 200 || text.chars().any(|c| c.is_control()) {
        return Err("invalid text".into());
    }
    Ok(vec![
        "-e".into(),
        "on run argv\ntell application \"System Events\" to keystroke (item 1 of argv)\nend run"
            .into(),
        "--".into(),
        text.into(),
    ])
}
pub fn png_dimensions(bytes: &[u8]) -> Result<(u32, u32), String> {
    if bytes.len() < 24 || &bytes[..8] != b"\x89PNG\r\n\x1a\n" || &bytes[12..16] != b"IHDR" {
        return Err("invalid screenshot PNG".into());
    }
    let w = u32::from_be_bytes(bytes[16..20].try_into().unwrap());
    let h = u32::from_be_bytes(bytes[20..24].try_into().unwrap());
    if w == 0 || h == 0 || w > 10000 || h > 10000 {
        return Err("invalid screenshot dimensions".into());
    }
    Ok((w, h))
}
pub struct MacBackend {
    pub scale: f64,
    pub generation: u64,
}
impl Backend for MacBackend {
    fn capture(&mut self) -> Result<Frame, String> {
        if !cfg!(target_os = "macos") {
            return Err("macOS only".into());
        }
        let name = format!(
            "desktop-{}-{}.png",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|e| e.to_string())?
                .as_nanos()
        );
        let file = std::env::temp_dir().join(name);
        let status = Command::new("screencapture")
            .arg("-x")
            .arg(&file)
            .status()
            .map_err(|e| e.to_string())?;
        if !status.success() {
            return Err("screen recording permission or capture failed".into());
        }
        let bytes = fs::read(&file).map_err(|e| e.to_string())?;
        let _ = fs::remove_file(file);
        let (width, height) = png_dimensions(&bytes)?;
        Ok(Frame {
            width,
            height,
            scale: self.scale,
            generation: self.generation,
            format: "png".into(),
            bytes,
        })
    }
    fn click(&mut self, p: Point) -> Result<(), String> {
        if !cfg!(target_os = "macos") {
            return Err("macOS only".into());
        }
        let status = Command::new("osascript")
            .args(click_argv(p))
            .status()
            .map_err(|e| e.to_string())?;
        if !status.success() {
            return Err("native click failed".into());
        }
        self.generation += 1;
        Ok(())
    }
    fn type_text(&mut self, text: &str) -> Result<(), String> {
        if !cfg!(target_os = "macos") {
            return Err("macOS only".into());
        }
        let status = Command::new("osascript")
            .args(text_argv(text)?)
            .status()
            .map_err(|e| e.to_string())?;
        if !status.success() {
            return Err("native typing failed".into());
        }
        self.generation += 1;
        Ok(())
    }
}
fn demo() -> Result<(), String> {
    let mut controller = Controller::new(FixtureBackend::new(), 8)?;
    let frame = controller.capture()?;
    controller.click(50.0, 70.0, frame.generation)?;
    controller.type_text("Ada Lovelace")?;
    let frame = controller.capture()?;
    controller.click(230.0, 160.0, frame.generation)?;
    let frame = controller.capture()?;
    fs::write("desktop-frame.ppm", &frame.bytes).map_err(|e| e.to_string())?;
    println!("backend=fixture-scene native_verified=false");
    for event in &controller.trace {
        println!("{}", event);
    }
    println!(
        "complete={} artifact=desktop-frame.ppm calls={}",
        controller.backend.complete, controller.calls
    );
    Ok(())
}
fn main() {
    let result = if std::env::args().any(|a| a == "--native-capture") {
        let scale = std::env::var("DESKTOP_SCALE")
            .unwrap_or("1".into())
            .parse::<f64>()
            .unwrap_or(0.0);
        let mut backend = MacBackend {
            scale,
            generation: 0,
        };
        backend.capture().and_then(|frame| {
            frame.validate()?;
            fs::write("native-frame.png", frame.bytes).map_err(|e| e.to_string())
        })
    } else {
        demo()
    };
    if let Err(error) = result {
        eprintln!("error: {}", error);
        std::process::exit(1);
    }
}
