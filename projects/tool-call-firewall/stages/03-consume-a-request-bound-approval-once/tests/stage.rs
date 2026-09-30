#[allow(dead_code, unused_imports)]
mod project {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use project::*;
#[test]
fn consume() {
    let c = call("1|editor|write|a", 100).unwrap();
    let mut a = Approval {
        request: c.clone(),
        used: false,
    };
    assert!(authorize(&c, Some(&mut a)).is_ok());
    assert!(a.used);
}
#[test]
fn replay() {
    let c = call("1|editor|write|a", 100).unwrap();
    let mut a = Approval {
        request: c.clone(),
        used: true,
    };
    assert_eq!(authorize(&c, Some(&mut a)), Err(Error::Conflict));
}
#[test]
fn wrong_id() {
    let c = call("1|editor|write|a", 100).unwrap();
    let mut a = Approval {
        request: call("2|editor|write|a", 100).unwrap(),
        used: false,
    };
    assert!(authorize(&c, Some(&mut a)).is_err());
    assert!(!a.used);
}
#[test]
fn missing() {
    assert!(authorize(&call("1|editor|write|a", 100).unwrap(), None).is_err());
}
#[test]
fn read_no_approval() {
    assert!(authorize(&call("1|reader|read|a", 100).unwrap(), None).is_ok());
}

#[test]
fn changed_arguments_do_not_reuse_approval() {
    let approved = call("1|editor|write|a", 100).unwrap();
    let changed = call("1|editor|write|b", 100).unwrap();
    let mut approval = Approval {
        request: approved,
        used: false,
    };
    assert_eq!(
        authorize(&changed, Some(&mut approval)),
        Err(Error::Conflict)
    );
    assert!(!approval.used);
}
