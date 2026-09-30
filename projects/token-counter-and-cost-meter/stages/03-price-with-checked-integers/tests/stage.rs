#[allow(dead_code, unused_imports)]
mod project {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use project::*;
#[test]
fn weighted() {
    assert_eq!(
        cost(
            &Usage {
                input: 100,
                output: 20,
                cached: 40
            },
            &Rates {
                input: 2,
                output: 5,
                cached: 1
            }
        ),
        Ok(260)
    );
}
#[test]
fn zero_rates() {
    assert_eq!(
        cost(
            &Usage {
                input: 9,
                output: 4,
                cached: 0
            },
            &Rates {
                input: 0,
                output: 0,
                cached: 0
            }
        ),
        Ok(0)
    );
}
#[test]
fn all_cached() {
    assert_eq!(
        cost(
            &Usage {
                input: 10,
                output: 0,
                cached: 10
            },
            &Rates {
                input: 99,
                output: 99,
                cached: 1
            }
        ),
        Ok(10)
    );
}
#[test]
fn overflow() {
    assert_eq!(
        cost(
            &Usage {
                input: u64::MAX,
                output: 0,
                cached: 0
            },
            &Rates {
                input: 2,
                output: 1,
                cached: 1
            }
        ),
        Err(Error::Limit)
    );
}
#[test]
fn invalid_usage() {
    assert!(cost(
        &Usage {
            input: 0,
            output: 0,
            cached: 1
        },
        &Rates {
            input: 1,
            output: 1,
            cached: 1
        }
    )
    .is_err());
}
