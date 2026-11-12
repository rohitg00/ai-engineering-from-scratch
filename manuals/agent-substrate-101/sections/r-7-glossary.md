# Glossary

> Each term below has one meaning across the manual, and the last column names the section that explains it.

The meanings come from the Agent Substrate source and documentation at v1.0.0 and from our runs. Terms in code font are literal names that you type or read in output.

| Term | Meaning in this manual | Explained in |
|---|---|---|
| Access policy | A list of bindings that grants roles on the API, for one atespace or for the whole install | [5.2](#s-access-policies) |
| Actor | One isolated workload with an identity and a state that Substrate can suspend to a snapshot and resume on any fitting worker | [1.1](#s-what-substrate-does-and-what-it-leaves-to-you) |
| Actor JWT | A signed token that states the identity of one actor, which the egress gateway can attach to an outbound request | [5.3](#s-actor-jwts) |
| `ACTOR_STATE_CRASHED` | The state of an actor whose sandbox, worker, or restore was lost. Only a revert or a delete leaves it. | [3.5](#s-crashed-and-revertactor) |
| ActorTemplate | The record that describes the containers, the resource limits, and the snapshot fidelity of the actors made from it | [3.1](#s-actortemplate-and-the-golden-snapshot) |
| Agent (kagent) | The pair of one AgentTemplate and one Harness, which kagent compiles into one ActorTemplate | [7.1](#s-kagent-on-substrate) |
| agentgateway | An open-source proxy that Substrate can run as its dataplane in place of Envoy | [6.6](#s-the-dataplane-choice) |
| AgentTemplate | The kagent object that holds the model, the prompt, and the tools of an agent | [7.1](#s-kagent-on-substrate) |
| Asynchronous suspend | A suspend that returns when the snapshot is on the node, before the upload to the bucket. The default. | [3.3](#s-suspendactor-and-resumeactor) |
| `ate-api-server` | The Substrate API server. It serves both gRPC services and is the only component that reads and writes Postgres. | [1.2](#s-one-request-from-client-to-actor) |
| `ate-controller` | The component that turns each WorkerPool into worker pods and registers them as workers | [2.4](#s-what-the-install-created) |
| `ate-idp-server` | The component that publishes the public keys for actor JWTs | [5.3](#s-actor-jwts) |
| `ate-setup` | The installer program in the Substrate repository | [2.1](#s-install-with-ate-setup) |
| `atelet` | The Substrate agent on each node. It drives the workers of its node and moves snapshots to and from the bucket. | [2.4](#s-what-the-install-created) |
| `atenet-egress` | The egress gateway: the dataplane pod that every outbound connection of an actor passes | [6.2](#s-egresspolicy-and-default-deny) |
| `atenet-router` | The router: the dataplane pod that receives each request for an actor and forwards it to the worker | [6.1](#s-the-router-and-ingress) |
| Atespace | A name that groups actors, templates, and tags, and that carries one access policy. It is a Substrate record and has no link to a Kubernetes namespace. | [3.6](#s-atespaces) |
| Ballast actor | Our test actor. It holds a set number of MiB of random bytes and reads one byte of each MiB on a request. | [3.3](#s-suspendactor-and-resumeactor) |
| Binding | One role with the identities that hold it, inside an access policy | [5.2](#s-access-policies) |
| Bootstrap owner | A principal from the server flag `--authz-bootstrap-owners` that always holds the global owner role | [5.2](#s-access-policies) |
| Bucket | The object store location that holds durable snapshots. In our clusters it is `ate-snapshots` on rustfs. | [8.1](#s-postgres-and-the-object-store) |
| Crashed | The actor state after a sandbox or a worker is lost, or after a failed resume. Only a revert or a delete leaves it. | [3.5](#s-crashed-and-revertactor) |
| Credential injection | The egress gateway replaces a header of an outbound request with a secret that the actor never holds | [6.5](#s-credential-injection) |
| Credential provider | The service that returns that secret to the egress gateway | [6.5](#s-credential-injection) |
| Dataplane | The router and the egress gateway together, built on Envoy or on agentgateway | [6.6](#s-the-dataplane-choice) |
| Default deny | An actor with no matching egress rule reaches no host and resolves no name | [6.2](#s-egresspolicy-and-default-deny) |
| DNS relay | The resolver inside the sandbox network that answers only for names that the egress policy allows | [6.3](#s-the-dns-relay) |
| Durable snapshot | A snapshot whose files are in the bucket, with the storage state completed | [3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives) |
| EgressPolicy | The rules of one actor that name the hosts and ports it can reach and the headers that the gateway replaces | [6.2](#s-egresspolicy-and-default-deny) |
| Epoch | A number that a worker process gets when it starts. Actors from an older epoch of the same worker become crashed. | [the API reference](#s-ref-api-methods) |
| Files-only snapshot | A snapshot at volumes fidelity. It keeps the durable directories, and the processes start again at a resume. | [3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives) |
| First call | The first request to a new actor, which includes a resume from the golden snapshot | [3.1](#s-actortemplate-and-the-golden-snapshot) |
| Golden snapshot | The snapshot that Substrate takes of one started actor for each template, so that new actors resume from it | [3.1](#s-actortemplate-and-the-golden-snapshot) |
| Golden tag | The tag under which Substrate stores the golden snapshot of a template | [3.1](#s-actortemplate-and-the-golden-snapshot) |
| gVisor | The sandbox class that runs an actor under a user-space kernel. The default class. | [4.2](#s-sandbox-classes) |
| Harness | The runtime that executes an agent and decides when to suspend its actor. In kagent it is also the object that names the WorkerPool and the snapshot location. | [7.1](#s-kagent-on-substrate) |
| Ingress allowlist | The list of client identities that the router accepts | [5.1](#s-client-authentication) |
| Installer | The program `ate-setup`, which installs and removes Agent Substrate from a checkout of the tag | [2.1](#s-install-with-ate-setup) |
| Interception CA | The certificate authority whose key signs the certificates that the egress gateway shows to an actor for an `https` rule | [6.4](#s-tls-interception) |
| kagent | An open-source agent framework for Kubernetes. Version 1.0.0 installs its own distribution of Substrate. | [7.1](#s-kagent-on-substrate) |
| `kubectl ate` | The command-line plugin for the Substrate API | [2.2](#s-kubectl-ate) |
| Lease | A row in Postgres that gives one workflow the right to change one object for 30 seconds | [8.1](#s-postgres-and-the-object-store) |
| microVM | The sandbox class that runs an actor in a small virtual machine. It needs KVM on the node. | [4.2](#s-sandbox-classes) |
| Mock model | The server in our kagent cluster that answers model calls with a fixed reply, so that model time is near zero | [7.1](#s-kagent-on-substrate) |
| Model gateway | A mode of agentgateway that routes requests to model providers and applies budgets and failover. It is separate from the Substrate dataplane. | [7.2](#s-agentgateway) |
| Node-local snapshot | The copy of a snapshot on the node disk. After an asynchronous suspend it is the only copy until the upload. | [3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives) |
| Object store | The service that holds the bucket: rustfs in our clusters, Google Cloud Storage or S3 in the documentation | [8.1](#s-postgres-and-the-object-store) |
| Parked request | A request that the router holds open while it retries the resume of the actor | [4.4](#s-request-parking) |
| Parking budget | The time that the router holds a request with no worker before it returns a 503. The default is 5 s. | [4.4](#s-request-parking) |
| Placeholder header | The header that an actor sends with a value that is not a secret, which asks the gateway for the swap | [6.5](#s-credential-injection) |
| Placement | The choice of a worker for an actor that resumes | [4.3](#s-placement) |
| Plugin | The binary `kubectl-ate`, which `kubectl` runs for each command that starts with `kubectl ate` | [2.2](#s-kubectl-ate) |
| Preview feature | A feature that is off unless the server flag `--preview` and the client header both allow it | [the flags reference](#s-ref-flags-and-gates) |
| Principal | The identity that `ate-api-server` derives from a credential, and the name that access policies grant roles to | [5.1](#s-client-authentication) |
| Proxy | `kubectl ate proxy actor`: a local listener that forwards TCP to one actor through the router | [2.3](#s-your-first-actor-and-the-proxy) |
| Request parking | The router holds a request and tries again while no worker has room | [4.4](#s-request-parking) |
| Resume | Restore an actor from its latest snapshot on a worker. The router asks for it on every request. | [3.3](#s-suspendactor-and-resumeactor) |
| `ResumeActor` | The call that places a suspended actor on a worker and restores its newest snapshot | [3.3](#s-suspendactor-and-resumeactor) |
| Revert | Return an actor to its last durable snapshot and discard what came after it | [3.5](#s-crashed-and-revertactor) |
| `RevertActor` | The call that discards the current run of an actor and returns it to suspended at its last completed durable snapshot | [3.5](#s-crashed-and-revertactor) |
| Routing header | The HTTP header `ate-target-actor`, with the value `<atespace>/<actor>`, which tells the router where a request goes | [6.1](#s-the-router-and-ingress) |
| Sandbox | The isolated environment that a worker starts for one actor | [4.2](#s-sandbox-classes) |
| Sandbox class | The kind of sandbox: `gvisor` or `microvm` | [4.2](#s-sandbox-classes) |
| SandboxConfig | The Kubernetes object that names the runtime versions of one sandbox class and their files | [4.2](#s-sandbox-classes) |
| Session | In kagent, one conversation. kagent maps each session to one actor. | [7.1](#s-kagent-on-substrate) |
| Shared identity | The ServiceAccount `ate-client` in `ate-system`, which `kubectl ate` uses when you give no token | [5.1](#s-client-authentication) |
| Snapshot | The saved state of an actor at one suspend | [3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives) |
| Snapshot cache | A directory on the node that keeps downloaded snapshot files for later resumes | [8.1](#s-postgres-and-the-object-store) |
| Snapshot fidelity | How much a snapshot holds: volumes only, the root filesystem too, or process memory too | [3.4](#s-snapshot-fidelity-and-where-a-snapshot-lives) |
| SPIFFE ID | The identity in a client certificate, such as `spiffe://cluster.local/ns/ate-system/sa/atenet-client` | [5.1](#s-client-authentication) |
| Standing port-forward | One `kubectl port-forward` that you keep open, so that parallel CLI calls do not each open their own | [7.1](#s-kagent-on-substrate) |
| Suspend | Write a snapshot of a running actor and release its worker | [3.3](#s-suspendactor-and-resumeactor) |
| `SuspendActor` | The call that checkpoints a running actor, stops its sandbox, and frees its place on the worker | [3.3](#s-suspendactor-and-resumeactor) |
| Synchronous suspend | A suspend that returns after the snapshot is in the bucket | [3.3](#s-suspendactor-and-resumeactor) |
| Tag | A named copy of the snapshot of a suspended actor, from which new actors can start | [the API reference](#s-ref-api-methods) |
| TLS interception | The egress gateway ends the TLS connection of the actor and opens its own to the host, so that it can read the request | [6.4](#s-tls-interception) |
| TLS pass-through | The egress gateway forwards the TLS connection unread, after it checks the server name | [6.4](#s-tls-interception) |
| Trust bundle | The file in each sandbox that holds the interception CA certificate, so that the actor can verify intercepted connections | [6.4](#s-tls-interception) |
| Turn | In kagent, one user message and the reply to it. kagent resumes the actor before the turn and suspends it after. | [7.1](#s-kagent-on-substrate) |
| Wakeup probe | An HTTP check in a template that a resume waits for before the actor counts as running | [3.1](#s-actortemplate-and-the-golden-snapshot) |
| Warm call | A request to an actor that is already running | [3.3](#s-suspendactor-and-resumeactor) |
| Worker | One pod of a WorkerPool that registered with the API. It hosts actors up to its capacity. | [4.1](#s-workerpool) |
| Worker selector | The labels in a template or an actor that choose which pools can host it | [4.3](#s-placement) |
| WorkerPool | The Kubernetes object that asks for a number of worker pods with one image and one resource size | [4.1](#s-workerpool) |

Sources: api/ateapi/v1/ateapi.proto, api/infra/k8s/ate/v1/, docs/reference/glossary.md and docs/reference/api-guide.md at v1.0.0; the definitions in every file under sections/; capture/lab/C-resume-vs-size/main.go (the ballast actor), capture/lab/K-kagent/agent/ (the mock model).
