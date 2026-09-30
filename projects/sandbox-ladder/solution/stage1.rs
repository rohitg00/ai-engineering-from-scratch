use super::*;
pub fn needs(text: &str) -> Result<Needs, Error> {
    let mut n = Needs {
        untrusted: false,
        secrets: false,
        network: false,
        host_kernel: false,
    };
    let mut seen = std::collections::BTreeSet::new();
    for pair in text.split(',') {
        let (k, v) = pair
            .split_once('=')
            .ok_or_else(|| Error::Invalid("key=boolean required".into()))?;
        if !seen.insert(k) {
            return Err(Error::Conflict);
        }
        let flag = match v {
            "true" => true,
            "false" => false,
            _ => return Err(Error::Invalid("true or false required".into())),
        };
        match k {
            "untrusted" => n.untrusted = flag,
            "secrets" => n.secrets = flag,
            "network" => n.network = flag,
            "host_kernel" => n.host_kernel = flag,
            _ => return Err(Error::Invalid("unknown capability".into())),
        }
    }
    Ok(n)
}
