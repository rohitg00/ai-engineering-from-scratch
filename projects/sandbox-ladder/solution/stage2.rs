use super::*;
pub fn profiles() -> Vec<Profile> {
    vec![
        Profile {
            name: "process-fixture".into(),
            filesystem: false,
            network: false,
            kernel: false,
            cost: 1,
        },
        Profile {
            name: "filesystem-fixture".into(),
            filesystem: true,
            network: false,
            kernel: false,
            cost: 2,
        },
        Profile {
            name: "container-fixture".into(),
            filesystem: true,
            network: true,
            kernel: false,
            cost: 3,
        },
        Profile {
            name: "microvm-fixture".into(),
            filesystem: true,
            network: true,
            kernel: true,
            cost: 5,
        },
    ]
}
pub fn satisfies(n: &Needs, p: &Profile) -> bool {
    (!(n.untrusted || n.secrets) || p.filesystem)
        && (!n.network || p.network)
        && (!n.host_kernel || p.kernel)
}
