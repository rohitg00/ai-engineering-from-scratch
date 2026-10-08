# Capture output: Docker Sandboxes and Docker Agent 101

Recorded by `capture/run.py` with:

- sbx: v0.47.0 0411f50ee4700fe7bd37e6e7e3aced563e850ca9
- docker-agent: v1.149.0 Commit: Homebrew
- host: macOS 26.2 arm64
- tiers: ab

Values that change on every run are masked at write time: `$CAPTURE`, `$HOME`, `$USER`, `<docker-user>`, `<uuid>`, `<id>`, `<ts>`, `<port>`, `<session>`, `<rand>`, `<dur>`, `<n>`, `<layers>`, `<date>`, `<age>`, `<digest>`, `<sha256>`, `<base64>`. The rules are in `run.py`, `MASKS`.

| File | Produced by |
|---|---|
| `00-sbx-version.json` | `sbx version --json` |
| `00-versions.txt` | `sbx version`<br>`docker-agent version`<br>`sw_vers`<br>`uname -m`<br>`sysctl kern.hv_support`<br>`python3 --version` |
| `01-help-docker-agent.txt` | `docker-agent --help` |
| `01-help-sbx.txt` | `sbx --help` |
| `02-daemon-status.json` | `sbx daemon status --json` |
| `02-daemon-status.txt` | `sbx daemon status` |
| `02-diagnose.json` | `sbx diagnose --json` |
| `02-diagnose.txt` | `sbx diagnose` |
| `02-settings-experimental.json` | `sbx settings get --json platform.allowExperimentalFeatures` |
| `02-settings-get.txt` | `sbx settings get skills.defaultMode`<br>`sbx settings get --json kit.allowedSources` |
| `02-settings.json` | `sbx settings list --json` |
| `02-settings.txt` | `sbx settings list` |
| `03-policy-balanced.json` | `sbx policy ls --wide --json` |
| `03-policy-check-anthropic.json` | `sbx policy check network api.anthropic.com --verbose --json` |
| `03-policy-check-example.json` | `sbx policy check network example.com --verbose --json  [exit 1]` |
| `03-policy-init.txt` | `sbx policy init balanced (recorded once, by the run that initialized the global policy on the recording host; --check does not compare it)` |
| `03-policy-ls.txt` | `sbx policy ls` |
| `03-policy-org.txt` | `sbx policy ls --source org`<br>`sbx policy ls --include-inactive` |
| `03-policy-profile-ls.txt` | `sbx policy profile ls`<br>`sbx policy profile ls --json` |
| `04-auto-stop.txt` | `sbx ls`<br>`sbx ls  (after 45 s with no session)`<br>`grep auto-stop daemon.log (the daemon log named by sbx daemon status --json)` |
| `04-create.txt` | `sbx create shell $CAPTURE/fixtures/repo --name m101-demo` |
| `04-env.txt` | `sbx exec m101-demo sh -c 'env \| sort'` |
| `04-guest.txt` | `sbx exec m101-demo sh -c 'uname -a; echo; cat /etc/os-release; echo; id; getconf PAGESIZE; echo; docker version; echo; mount \| grep -E 'virtiofs\|/run/sandbox\|fixtures'; echo; df -h "$PWD" /; echo; cat /etc/hosts'` |
| `04-ls.json` | `sbx ls --json` |
| `04-ls.txt` | `sbx ls` |
| `04-prune-dry-run.json` | `sbx prune --dry-run --json` |
| `04-prune.txt` | `sbx stop m101-demo`<br>`sbx prune --force`<br>`sbx ls --json` |
| `04-second-sandbox.json` | `sbx ls --json` |
| `04-second-sandbox.txt` | `sbx create shell $CAPTURE/fixtures/repo --name m101-demo-2` |
| `04-stop.json` | `sbx ls --json` |
| `04-stop.txt` | `sbx stop m101-demo-2`<br>`sbx ls` |
| `04-workspace.txt` | `sbx exec m101-demo sh -c 'pwd; echo; ls -la; echo; cat README.md; echo; git log --oneline'` |
| `05-ports-curl.txt` | `curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18081/README.md`<br>`curl -sS -o /dev/null -w '%{http_code}\n' 'http://[::1]:18081/README.md'` |
| `05-ports-ls.txt` | `sbx ls` |
| `05-ports-tcp.txt` | `sbx ports m101-demo --publish 8080/tcp`<br>`sbx ports m101-demo --json` |
| `05-ports-unpublish.txt` | `sbx ports m101-demo --unpublish 18081:8080`<br>`sbx ports m101-demo --unpublish <port>:8080/tcp`<br>`sbx ports m101-demo --json` |
| `05-ports.json` | `sbx ports m101-demo --json` |
| `05-ports.txt` | `sbx ports m101-demo --publish 18081:8080`<br>`sbx ports m101-demo` |
| `06-cp.txt` | `sbx cp work/in.txt m101-demo:/tmp/in.txt`<br>`sbx exec m101-demo sh -c 'cat /tmp/in.txt; printf out > /tmp/out.txt'`<br>`sbx cp m101-demo:/tmp/out.txt work/out.txt`<br>`cat work/out.txt`<br>`sbx cp m101-demo:/tmp/out.txt m101-demo-2:/tmp/x` |
| `07-template-inspect.txt` | `sbx template inspect m101-tpl:v1` |
| `07-template-ls.json` | `sbx template ls --json` |
| `07-template-ls.txt` | `sbx template ls` |
| `07-template-rm.txt` | `sbx rm --force m101-from-tpl`<br>`sbx template rm m101-tpl:v1 --force`<br>`sbx template ls` |
| `07-template-run.txt` | `sbx create --pull never -t m101-tpl:v1 shell --name m101-from-tpl`<br>`sbx ls`<br>`sbx exec m101-from-tpl sh -c 'ls -l /opt/marker-from-demo'` |
| `07-template-save.txt` | `sbx exec -u root m101-demo sh -c 'touch /opt/marker-from-demo; ls -l /opt/marker-from-demo'`<br>`sbx template save m101-demo m101-tpl:v1 --output work/m101-tpl.tar  (while running)`<br>`sbx stop m101-demo`<br>`sbx template save m101-demo m101-tpl:v1 --output work/m101-tpl.tar` |
| `07-template-tar-head.txt` | `tar listing of work/m101-tpl.tar (python tarfile); the tar itself is not committed` |
| `08-clone-commit.txt` | `sbx exec m101-clone sh -c 'printf hi > from-sandbox.txt && git add from-sandbox.txt && printf '"'"'from sandbox\n'"'"' > /tmp/msg && GIT_AUTHOR_DATE=<ts> GIT_COMMITTER_DATE=<ts> git -c user.name=agent -c user.email=agent@example.test commit -q -F /tmp/msg; git log --oneline; echo; git push 2>&1; echo push-exit=$?'` |
| `08-clone-create.txt` | `sbx create --clone shell $CAPTURE/fixtures/repo-clone --name m101-clone`<br>`sbx ls` |
| `08-clone-host.txt` | `git -C $CAPTURE/fixtures/repo-clone remote -v`<br>`git -C $CAPTURE/fixtures/repo-clone config --local --list --show-origin`<br>`git -C $CAPTURE/fixtures/repo-clone ls-remote sandbox-m101-clone`<br>`git -C $CAPTURE/fixtures/repo-clone fetch sandbox-m101-clone`<br>`git -C $CAPTURE/fixtures/repo-clone for-each-ref`<br>`git -C $CAPTURE/fixtures/repo-clone log --oneline --all` |
| `08-clone-inside.txt` | `sbx exec m101-clone sh -c 'pwd; echo; git remote -v; echo; git log --oneline; echo; ls -la /run/sandbox/source; git -C /run/sandbox/source log --oneline -1; touch /run/sandbox/source/x; echo; mount \| grep -E 'virtiofs\|/run/sandbox\|repo-clone'; echo; git config --list --show-origin \| grep -E 'remote\|branch''` |
| `08-clone-rm.txt` | `sbx rm --force m101-clone`<br>`git -C $CAPTURE/fixtures/repo-clone remote -v`<br>`git -C $CAPTURE/fixtures/repo-clone for-each-ref refs/sandboxes/` |
| `09-allow.txt` | `sbx policy allow network --sandbox m101-policy example.com`<br>`sbx policy ls m101-policy` |
| `09-allowed.txt` | `sbx exec m101-policy sh -c 'curl -sS --max-time 10 -I https://example.com; echo exit=$?'` |
| `09-blocked-by-rule.txt` | `sbx exec m101-policy sh -c 'curl -sS --max-time 10 https://example.com; echo; echo exit=$?'` |
| `09-blocked.txt` | `sbx exec m101-policy sh -c 'curl -sS --max-time 10 -I https://example.com; echo exit=$?'`<br>`sbx exec m101-policy sh -c 'curl -sS --max-time 10 https://example.com; echo; echo exit=$?'` |
| `09-bypass-grep.txt` | `sbx policy --help \| grep -i bypass` |
| `09-check-allowed.json` | `sbx policy check network example.com --sandbox m101-policy --verbose --json` |
| `09-check-deny.json` | `sbx policy check network example.com --sandbox m101-policy --verbose --json  [exit 1]` |
| `09-check-verbose.json` | `sbx policy check network example.com --sandbox m101-policy --verbose --json  [exit 1]` |
| `09-create.txt` | `sbx create shell --name m101-policy` |
| `09-deny-conflict.txt` | `sbx policy deny network --sandbox m101-policy example.com` |
| `09-deny.txt` | `sbx policy deny network --sandbox m101-policy example.com` |
| `09-inspect-deny-rule.json` | `sbx policy inspect <uuid> --json` |
| `09-inspect-rule.json` | `sbx policy inspect <uuid> --json` |
| `09-inspect-rule.txt` | `sbx policy inspect <uuid>` |
| `09-ls-wide.json` | `sbx policy ls m101-policy --wide --created-via added --json` |
| `09-ls-wide.txt` | `sbx policy ls m101-policy --wide --created-via added` |
| `09-policy-log-after.json` | `sbx policy log m101-policy --json` |
| `09-policy-log-deny.json` | `sbx policy log m101-policy --json` |
| `09-policy-log.json` | `sbx policy log m101-policy --json` |
| `09-policy-log.txt` | `sbx policy log m101-policy` |
| `09-rm-allow.txt` | `sbx policy rm network --sandbox m101-policy --id <uuid> --force` |
| `09-rm-deny.txt` | `sbx policy rm network --sandbox m101-policy --id <uuid> --force`<br>`sbx policy ls m101-policy --wide --created-via added` |
| `10-env-existing.txt` | `sbx exec m101-demo sh -c 'env \| grep -c M101_RECV_KEY; echo exit=$?'` |
| `10-env-sentinel.txt` | `sbx exec m101-secret sh -c "env \| grep -E '^M101_\|^SBX_CRED\|proxy-managed' \| sort"` |
| `10-import-dry-run.txt` | `sbx secret import --dry-run` |
| `10-placeholder.txt` | `sbx secret set-custom --host api.example.test --env M101_NAMED --placeholder 'sk-{rand}' --value m101-dummy-1111`<br>`sbx secret ls --json` |
| `10-policy-log.json` | `sbx policy log m101-secret --json` |
| `10-receiver.log` | `requests received by the host receiver on 127.0.0.1:18080 (run.py, class Receiver)` |
| `10-secret-create.txt` | `sbx create shell --name m101-secret`<br>`sbx policy allow network --sandbox m101-secret localhost:18080` |
| `10-secret-ls.json` | `sbx secret ls --json` |
| `10-secret-ls.txt` | `sbx secret ls` |
| `10-secret-rm.txt` | `sbx rm --force m101-secret`<br>`sbx secret rm --placeholder sk-<rand> -f`<br>`sbx secret rm --placeholder sbx-cs-<rand> -f`<br>`sbx secret ls` |
| `10-set-custom.txt` | `sbx secret set-custom --host host.docker.internal --host localhost --env M101_RECV_KEY --value m101-dummy-receiver-0000` |
| `10-swap-curl.txt` | `sbx exec m101-secret sh -c 'curl -sS --max-time 10 -H "Authorization: Bearer $M101_RECV_KEY" -H "X-Demo: $M101_RECV_KEY" -o /dev/null -w '"'"'%{http_code}\n'"'"' http://host.docker.internal:18080/from-variable'`<br>`sbx exec m101-secret sh -c 'curl -sS --max-time 10 -H '"'"'Authorization: Bearer sbx-cs-<rand>'"'"' -H '"'"'X-Demo: sbx-cs-<rand>'"'"' -o /dev/null -w '"'"'%{http_code}\n'"'"' http://host.docker.internal:18080/from-literal'`<br>`sbx exec m101-secret sh -c 'curl -sS --max-time 10 -H '"'"'Authorization: sbx-cs-<rand>'"'"' -o /dev/null -w '"'"'%{http_code}\n'"'"' http://host.docker.internal:18080/no-scheme'`<br>`sbx exec m101-secret sh -c 'curl -sS --max-time 10 -H "Authorization: Bearer $M101_RECV_KEY" -o /dev/null -w '"'"'%{http_code}\n'"'"' http://gateway.docker.internal:18080/other-host; echo exit=$?'` |
| `11-dynamic-create.txt` | `sbx create shell --name m101-mcp-dyn` |
| `11-gateway-initialize.http` | `initialize headers and body of the gateway inside m101-mcp (/tmp/mcp-headers.txt and /tmp/mcp-init.txt)` |
| `11-gateway-probe-dynamic-after.txt` | `sbx exec m101-mcp-dyn sh /tmp/mcp-probe.sh  (fixtures/mcp-probe.sh: initialize, notifications/initialized, tools/list)` |
| `11-gateway-probe-dynamic-before.txt` | `sbx exec m101-mcp-dyn sh /tmp/mcp-probe.sh  (fixtures/mcp-probe.sh: initialize, notifications/initialized, tools/list)` |
| `11-gateway-probe-static.txt` | `sbx exec m101-mcp sh /tmp/mcp-probe.sh  (fixtures/mcp-probe.sh: initialize, notifications/initialized, tools/list)` |
| `11-gateway-tools-dynamic-after.json` | `tools/list answer of the gateway inside m101-mcp-dyn (the data: line of /tmp/mcp-tools.txt)` |
| `11-gateway-tools-dynamic-before.json` | `tools/list answer of the gateway inside m101-mcp-dyn (the data: line of /tmp/mcp-tools.txt)` |
| `11-gateway-tools-static.json` | `tools/list answer of the gateway inside m101-mcp (the data: line of /tmp/mcp-tools.txt)` |
| `11-load.txt` | `sbx mcp load m101-deepwiki --sandbox m101-mcp-dyn` |
| `11-mcp-add-registry.txt` | `sbx mcp add m101-fetch --url https://registry.modelcontextprotocol.io/v0/servers/fetch-mcp/versions/latest` |
| `11-mcp-add.txt` | `sbx mcp add m101-deepwiki --url https://mcp.deepwiki.com/mcp` |
| `11-mcp-auth-status.json` | `sbx mcp auth status --all --json` |
| `11-mcp-inspect.json` | `sbx mcp inspect m101-deepwiki --json` |
| `11-mcp-inspect.txt` | `sbx mcp inspect m101-deepwiki` |
| `11-mcp-ls.json` | `sbx mcp ls --json` |
| `11-mcp-ls.txt` | `sbx mcp ls` |
| `11-mcp-rm.txt` | `sbx rm --force m101-mcp m101-mcp-dyn`<br>`sbx mcp rm m101-deepwiki --force`<br>`sbx mcp ls` |
| `11-static-create.txt` | `sbx create shell --name m101-mcp --static-mcp m101-deepwiki` |
| `11-static-inside.txt` | `sbx exec m101-mcp sh -c 'env \| grep -i mcp \| sort'` |
| `12-check-kit.json` | `sbx policy check network example.com --sandbox m101-kit --json` |
| `12-inspect.json` | `sbx kit inspect ./fixtures/kits/hello-mixin --json` |
| `12-inspect.txt` | `sbx kit inspect ./fixtures/kits/hello-mixin` |
| `12-kit-add-files.txt` | `sbx kit add m101-demo ./fixtures/kits/hello-mixin` |
| `12-kit-add.txt` | `sbx kit add m101-demo ./fixtures/kits/env-mixin`<br>`sbx exec m101-demo sh -c 'env \| grep M101_FROM_KIT'`<br>`sbx policy ls m101-demo --source kit --wide` |
| `12-pack.txt` | `sbx kit pack ./fixtures/kits/hello-mixin -o work/hello-mixin.zip`<br>`zip listing of work/hello-mixin.zip (python zipfile)` |
| `12-policy-kit.json` | `sbx policy ls m101-kit --source kit --wide --json` |
| `12-policy-kit.txt` | `sbx policy ls m101-kit --source kit --wide` |
| `12-run-kit.txt` | `sbx create shell $CAPTURE/fixtures/repo-kit --name m101-kit --kit ./fixtures/kits/hello-mixin`<br>`sbx exec m101-kit sh -c 'command -v tree; tree --version \| head -1; echo; ls; echo; cat HELLO.md'` |
| `12-validate-zip.json` | `sbx kit validate $CAPTURE/work/hello-mixin.zip --json` |
| `12-validate.json` | `sbx kit validate ./fixtures/kits/hello-mixin --json` |
| `12-validate.txt` | `sbx kit validate ./fixtures/kits/hello-mixin` |
| `13-kit-builder-status.txt` | `sbx kit builder status` |
| `13-kit-v3-inspect.txt` | `sbx kit inspect ./fixtures/kits/hello-kit --json` |
| `13-kit-v3-pack.txt` | `sbx kit pack ./fixtures/kits/hello-kit -o $CAPTURE/work/hello-kit.zip` |
| `13-kit-v3-validate.txt` | `sbx kit validate ./fixtures/kits/hello-kit` |
| `14-env-plan-arg.txt` | `sbx env plan --env-arg greeting=servus ./fixtures/env` |
| `14-env-plan.txt` | `sbx env plan ./fixtures/env` |
| `15-skills-ls.json` | `sbx skills ls --json` |
| `15-skills-ls.txt` | `sbx skills ls` |
| `16-docker-agent-version.txt` | `docker-agent version` |
| `16-doctor.json` | `docker-agent doctor --json  [exit 1]` |
| `16-doctor.txt` | `docker-agent doctor` |
| `16-dry-run.txt` | `docker-agent run --dry-run --exec $CAPTURE/fixtures/agents/greeter.yaml hi` |
| `16-models.json` | `docker-agent models list --format json` |
| `16-models.txt` | `docker-agent models list` |
| `16-sandbox-list.txt` | `docker-agent sandbox list` |
| `16-share-pull-agent.yaml` | `cat work/agentcatalog_pirate.yaml (written by share pull)` |
| `16-share-pull.txt` | `docker-agent share pull agentcatalog/pirate --force` |
| `16-toolsets.json` | `docker-agent toolsets --format json` |
| `16-toolsets.txt` | `docker-agent toolsets` |
| `99-final-state.txt` | `sbx ls`<br>`sbx template ls`<br>`sbx mcp ls`<br>`sbx secret ls`<br>`sbx policy ls` |
