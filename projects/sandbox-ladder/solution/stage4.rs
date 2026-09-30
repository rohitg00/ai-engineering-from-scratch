use super::*;
pub fn plan(n: &Needs, p: &Profile) -> Result<String, Error> {
    if !satisfies(n, p) {
        return Err(Error::Invalid("insufficient profile".into()));
    }
    let mut out = format!(
        "profile={} mode=policy-simulation os_isolation=false\n",
        p.name
    );
    if !p.kernel {
        out.push_str("residual=shared-host-kernel\n");
    }
    if !p.network {
        out.push_str("residual=network-not-denied\n");
    }
    out.push_str("verify=runtime-configuration-and-escape-tests\n");
    Ok(out)
}
