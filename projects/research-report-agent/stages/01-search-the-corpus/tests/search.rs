#[allow(dead_code)]
mod engine { include!(concat!(env!("PROJECT_WORKSPACE"), "/search/main.rs")); }
use engine::*;
fn doc(id: &str, text: &str) -> Document { Document { id:id.into(), title:"".into(), source_url:"https://example.test".into(), published:"2026-09-28".into(), text:text.into() } }
#[test] fn tokenization() { assert_eq!(tokenize("The kernel, VM!"), vec!["kernel","vm"]); }
#[test] fn headers_required() { assert!(parse_document("bad", "title: only\n\nBody").is_err()); }
#[test] fn ranks_and_breaks_ties() { let idx=Index::new(vec![doc("b","socket daemon"),doc("a","socket daemon"),doc("c","kernel")]); assert_eq!(idx.search("socket",2).iter().map(|x|x.0.as_str()).collect::<Vec<_>>(),vec!["a","b"]); assert!(idx.search("unknown",5).is_empty()); }
#[test] fn rare_terms_weigh_more() { let idx=Index::new(vec![doc("a","kernel socket"),doc("b","kernel")]); let idf=idx.idf_table(); assert!(idf["socket"]>idf["kernel"]); }
#[test] fn json_round_trip_and_surrogates() { let s="quote \" backslash \\ newline\nλ😀"; assert_eq!(parse_json(&json_string(s)),Ok(Json::Str(s.into()))); assert_eq!(parse_json(r#""\uD83D\uDE00""#),Ok(Json::Str("😀".into()))); }
#[test] fn malformed_json_rejected() { for raw in ["01","1.","1e","1e999","[1,]", "{\"x\":1,}", "\"bad\nstring\"", r#""\ud800""#] { assert!(parse_json(raw).is_err(),"{raw}"); } }
#[test] fn protocol_has_structured_errors() { let idx=Index::new(vec![doc("a","socket daemon")]); assert!(handle_line(&idx,"[]").contains("error")); assert!(handle_line(&idx,r#"{"query":"socket","k":1.5}"#).contains("error")); assert_eq!(handle_line(&idx,r#"{"query":"socket","k":0}"#),r#"{"results":[]}"#); assert!(handle_line(&idx,r#"{"query":"socket"}"#).contains(r#""doc_id":"a""#)); }
