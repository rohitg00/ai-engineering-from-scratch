# Public implementation contract

The Backend trait is the reusable boundary. TSV uses capture, click<TAB>x<TAB>y<TAB>generation and type<TAB>text; the runner refuses unknown actions and caps 32 calls.

The CLI uses the fixture backend. Native capture is a separate opt-in main.rs command; macOS click/type methods require OS permission and remain unverified here. Generation invalidation detects this controller's mutations, not arbitrary external desktop changes.

The typed `main.rs` starter defines Frame, Point, Backend, FixtureBackend, Controller and MacBackend, including every method signature. `cli.rs` imports your module and implements only bounded TSV input and artifact output. Coordinates are physical pixels before scale conversion; frame and PPM dimensions are bounded integers.

The stage tests specify ordinary results and rejected inputs. Do not replace the learner imports with reference imports. The final stage also runs the supplied input driver against your cumulative implementation.
