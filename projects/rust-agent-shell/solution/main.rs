// Streaming Agent Shell in Rust from the standard library.
// Stage contracts live under projects/rust-agent-shell/stages/.
// The default demo is bounded and uses only the local fixture.
// Official references are listed in README.md.

use std::fs;
use std::io::{self, BufRead, Read, Write};
use std::path::{Component, Path, PathBuf};
#[derive(Debug, Clone, PartialEq)]
pub enum Action {
    Help,
    Pwd,
    List(String),
    Read(String),
    Search { pattern: String, path: String },
    Quit,
}
pub fn parse_action(line: &str) -> Result<Action, String> {
    if line.len() > 4096 {
        return Err("command too long".into());
    }
    let text = line.trim();
    let (command, args) = text.split_once(' ').unwrap_or((text, ""));
    match command {
        "help" if args.is_empty() => Ok(Action::Help),
        "pwd" if args.is_empty() => Ok(Action::Pwd),
        "quit" if args.is_empty() => Ok(Action::Quit),
        "list" => Ok(Action::List(
            if args.is_empty() { "." } else { args }.into(),
        )),
        "read" if !args.is_empty() => Ok(Action::Read(args.into())),
        "search" => {
            let (pattern, file) = args
                .split_once('\t')
                .ok_or("search expects pattern<TAB>path")?;
            if pattern.is_empty() || file.is_empty() {
                return Err("empty search argument".into());
            }
            Ok(Action::Search {
                pattern: pattern.into(),
                path: file.into(),
            })
        }
        _ => Err("unsupported command".into()),
    }
}
pub fn contained(root: &Path, relative: &str) -> Result<PathBuf, String> {
    let rel = Path::new(relative);
    if relative.is_empty()
        || rel.is_absolute()
        || rel.components().any(|c| {
            matches!(
                c,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err("unsafe path".into());
    }
    let target = root.join(rel).canonicalize().map_err(|e| e.to_string())?;
    if !target.starts_with(root) {
        return Err("path escapes root".into());
    }
    Ok(target)
}
pub fn read_text(file: &Path) -> Result<String, String> {
    let metadata = fs::metadata(file).map_err(|e| e.to_string())?;
    if !metadata.is_file() || metadata.len() > 16384 {
        return Err("file is not bounded text".into());
    }
    let mut bytes = Vec::new();
    fs::File::open(file)
        .map_err(|e| e.to_string())?
        .take(16385)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() > 16384 {
        return Err("file grew beyond limit".into());
    }
    String::from_utf8(bytes).map_err(|_| "file is not UTF-8".into())
}
pub fn execute(root: &Path, action: &Action) -> Result<String, String> {
    match action {
        Action::Help => {
            Ok("help | pwd | list [path] | read path | search pattern<TAB>path | quit".into())
        }
        Action::Pwd => Ok(root.display().to_string()),
        Action::Quit => Ok("session closed".into()),
        Action::List(relative) => {
            let dir = contained(root, relative)?;
            let mut names = Vec::new();
            for entry in fs::read_dir(dir).map_err(|e| e.to_string())?.take(101) {
                let entry = entry.map_err(|e| e.to_string())?;
                names.push(entry.file_name().to_string_lossy().into_owned());
            }
            if names.len() > 100 {
                return Err("directory entry budget exceeded".into());
            }
            names.sort();
            Ok(names.join("\n"))
        }
        Action::Read(relative) => read_text(&contained(root, relative)?),
        Action::Search { pattern, path } => {
            let text = read_text(&contained(root, path)?)?;
            let matches: Vec<String> = text
                .lines()
                .enumerate()
                .filter(|(_, line)| line.contains(pattern))
                .take(50)
                .map(|(i, line)| format!("{}:{}", i + 1, line))
                .collect();
            Ok(matches.join("\n"))
        }
    }
}
pub fn json_string(value: &str) -> String {
    let mut out = String::from("\"");
    for ch in value.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if c.is_control() => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}
#[derive(Debug, Clone)]
pub struct Event {
    pub seq: usize,
    pub kind: String,
    pub output: String,
    pub terminal: bool,
}
impl Event {
    pub fn json(&self) -> String {
        format!(
            "{{\"seq\":{},\"kind\":{},\"output\":{},\"terminal\":{}}}",
            self.seq,
            json_string(&self.kind),
            json_string(&self.output),
            self.terminal
        )
    }
}
pub struct Session {
    pub root: PathBuf,
    pub steps: usize,
    pub limit: usize,
    pub closed: bool,
}
impl Session {
    pub fn new(root: &Path, limit: usize) -> Result<Self, String> {
        if limit == 0 || limit > 1000 {
            return Err("invalid action budget".into());
        }
        let root = root.canonicalize().map_err(|e| e.to_string())?;
        if !root.is_dir() {
            return Err("root is not directory".into());
        }
        Ok(Self {
            root,
            steps: 0,
            limit,
            closed: false,
        })
    }
    pub fn handle(&mut self, line: &str) -> Event {
        if self.closed {
            return Event {
                seq: self.steps,
                kind: "error".into(),
                output: "session already closed".into(),
                terminal: true,
            };
        }
        if self.steps >= self.limit {
            self.closed = true;
            return Event {
                seq: self.steps,
                kind: "error".into(),
                output: "action budget exhausted".into(),
                terminal: true,
            };
        }
        self.steps += 1;
        match parse_action(line) {
            Ok(action) => {
                let quit = action == Action::Quit;
                let result = execute(&self.root, &action);
                self.closed = quit;
                match result {
                    Ok(output) => Event {
                        seq: self.steps,
                        kind: "ok".into(),
                        output,
                        terminal: quit,
                    },
                    Err(error) => Event {
                        seq: self.steps,
                        kind: "error".into(),
                        output: error,
                        terminal: false,
                    },
                }
            }
            Err(error) => Event {
                seq: self.steps,
                kind: "rejected".into(),
                output: error,
                terminal: false,
            },
        }
    }
}
pub fn read_bounded<R: BufRead>(reader: &mut R) -> Result<Option<String>, String> {
    let mut out = Vec::new();
    loop {
        let buffer = reader.fill_buf().map_err(|e| e.to_string())?;
        if buffer.is_empty() {
            return if out.is_empty() {
                Ok(None)
            } else {
                String::from_utf8(out)
                    .map(Some)
                    .map_err(|_| "invalid UTF-8 command".into())
            };
        }
        let end = buffer.iter().position(|b| *b == b'\n');
        let count = end.map(|n| n + 1).unwrap_or(buffer.len());
        if out.len() + count > 4097 {
            return Err("command too long".into());
        }
        out.extend_from_slice(&buffer[..count]);
        reader.consume(count);
        if end.is_some() {
            while matches!(out.last(), Some(b'\n' | b'\r')) {
                out.pop();
            }
            return String::from_utf8(out)
                .map(Some)
                .map_err(|_| "invalid UTF-8 command".into());
        }
    }
}
pub fn run_loop<R: BufRead, W: Write>(
    session: &mut Session,
    reader: &mut R,
    writer: &mut W,
) -> Result<usize, String> {
    let mut emitted = 0;
    while let Some(line) = read_bounded(reader)? {
        let event = session.handle(&line);
        writeln!(writer, "{}", event.json()).map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())?;
        emitted += 1;
        if event.terminal {
            break;
        }
    }
    Ok(emitted)
}
fn demo() -> Result<(), String> {
    let dir = std::env::temp_dir().join(format!("rust-agent-shell-demo-{}", std::process::id()));
    fs::create_dir(&dir).map_err(|e| e.to_string())?;
    let result = (|| {
        fs::write(
            dir.join("README.md"),
            "A bounded local agent shell.\nEvery read stays inside the workspace.\n",
        )
        .map_err(|e| e.to_string())?;
        let mut session = Session::new(&dir, 10)?;
        let script =
            b"help\nlist .\nread README.md\nsearch bounded\tREADME.md\nexec rm -rf /\nquit\n";
        println!("mode=actual Rust stdin action loop; commands use filesystem APIs, no OS shell");
        run_loop(
            &mut session,
            &mut io::Cursor::new(script),
            &mut io::stdout(),
        )
        .map(|_| ())
    })();
    let _ = fs::remove_dir_all(dir);
    result
}
fn main() {
    let args: Vec<String> = std::env::args().collect();
    let result = if args.iter().any(|a| a == "--demo") {
        demo()
    } else {
        let root = args.get(1).map(String::as_str).unwrap_or(".");
        let limit = args
            .get(2)
            .map(|s| {
                s.parse::<usize>()
                    .map_err(|_| "invalid action budget".to_string())
            })
            .transpose();
        limit
            .and_then(|n| Session::new(Path::new(root), n.unwrap_or(50)))
            .and_then(|mut session| {
                run_loop(&mut session, &mut io::stdin().lock(), &mut io::stdout()).map(|_| ())
            })
    };
    if let Err(error) = result {
        eprintln!("error: {}", error);
        std::process::exit(1);
    }
}
