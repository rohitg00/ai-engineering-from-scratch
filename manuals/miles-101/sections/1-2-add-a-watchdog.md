# Add a watchdog before you leave a run alone

> When the rollout engine dies, a Miles run does not fail, so a small script must stop it for you.

We left a run alone for an hour. When we came back, the GPU was idle and the log had grown to 147 MB. The rollout engine had died during startup, and the run had sent requests to it ever since.

When you finish this section, you can recognize a run whose engine died. You can also start a watchdog that stops that run within a few minutes.

**Our result:** a run whose engine died logged 200,533 HTTP 503 errors in 63 minutes and never failed. The watchdog stopped a test of the same error in 183 s. A replay of a healthy run showed that six checks in a row are too few, so the script waits for ten.

## What a dead engine looks like

The run below used a setting that this GPU cannot run. The rollout engine stopped during startup. The trainer did not stop, and it sent requests to the engine for 63 minutes:

```listing
title: an engine that died, and a run that did not notice
source: capture/gpu/out-gb10/engine-died-503.log
lang: text
note: The first three lines are the engine failure. The last two are the first and the last error from the trainer side, 63 minutes apart.
---
[2026-10-17 21:03:03] Enable deterministic inference because of legacy rl_on_policy_target.
AssertionError: FlashAttention v3 Backend requires SM>=80 and SM<=90. Please use `--attention-backend flashinfer`.
[2026-10-17 21:03:24] Received sigquit from a child process. It usually means the child failed.
[2026-10-17 21:03:30.637 rollout_executor] http_utils.py:241 - Error: Server error '503 Service Unavailable' for url 'http://172.17.0.3:20035/generate'
[2026-10-17 22:06:46.137 rollout_executor] http_utils.py:241 - Error: Server error '503 Service Unavailable' for url 'http://172.17.0.3:20035/generate'
```

```listing
title: how many errors the run wrote
source: capture/gpu/out-gb10/engine-died-count.txt
lang: text
note: One grep over the full log of that run.
---
$ grep -c "503 Service Unavailable" true-on-policy-fa3.log
200533
```

The run wrote 200,533 error lines and never reported a failure.

**Router:** the small service that forwards each rollout request to an engine. [Section 8.6](#s-which-router-to-use) explains it.

**503 Service Unavailable:** the HTTP status that the router returns when no rollout engine can take the request.

```figure
id: fig-1-2
kind: timeline
title: A dead engine does not stop the job
claim: Without a watchdog, a dead engine left the job running for 63 minutes with an idle GPU.
caption: The top track is our failed run. The bottom track is the watchdog test on a container that writes the same error.
```

## Why the watchdog waits for ten checks

In our 17 runs that ended normally, the log held no `503 Service Unavailable` line at all. Our 16-answer run of [section 3.1](#s-train-math-on-gsm8k) logged 22,357 of them. They came in bursts of up to about 60 s, with up to 2,209 in one minute. The client retried each request, and the run finished all its steps.

In the failed run, the errors never stopped. Every full minute held at least 2,669 of them, for 63 minutes.

A count alone cannot tell these two runs apart, but the time can. Every 30 s, the watchdog counts the errors of the last 60 s. It stops the run only when that count is above 100 in a set number of checks in a row.

```listing
title: the watchdog rule replayed on a healthy run
source: capture/gpu/out-gb10/503-bursts.txt
lang: text
note: The real error times of the 16-answer run, for each of the 30 start times of the checks. The last column is a dead engine that never stops writing the error.
---
$ python3 watchdog_replay.py out-gb10/e2-n16-503-per-second.txt
healthy run: 22357 errors from 2026-10-22 07:16:29, checks every 30 s over the last 60 s, limit 100
checks  healthy offsets stopped  most checks in a row  dead engine stopped after
     6  17 of 30                    6                     153 to 182 s
     8   0 of 30                    6                     213 to 242 s
    10   0 of 30                    6                     273 to 302 s
```

**We measured** the rule on the real error times of that healthy run. With 6 checks, it stopped the run in 17 of the 30 cases, because two bursts came 45 s apart. No case reached more than 6 checks in a row. With 10 checks, no case stopped the healthy run, and a dead engine is stopped in about five minutes.

## Start the watchdog

The script reads the last 60 seconds of the container log every 30 seconds. It stops the container when the count passes the limit in a set number of checks in a row.

If Docker itself fails, the script says so. It exits with 2 when it cannot list the containers. A failed log read does not count as a check. The script also exits with 2 for a bad limit or number of checks: a value that is not a whole number, or 0 checks.

The third value is the number of checks in a row. Its default is 10, which a healthy run did not reach in our replay:

```bash
#!/bin/sh
name=${1:-miles-plain}
limit=${2:-100}
checks=${3:-10}
for value in "$limit" "$checks"; do
  case $value in
    ''|*[!0-9]*|??????????*) echo "limit and checks must be whole numbers below one billion"; exit 2;;
  esac
done
if [ "$checks" -lt 1 ]; then
  echo "checks must be 1 or more"
  exit 2
fi
strikes=0
while :; do
  if ! running=$(docker ps -q --filter "name=^${name}$"); then
    echo "$(date -u +%FT%TZ) $name: docker ps failed, the watchdog cannot see the run and stops"
    exit 2
  fi
  [ -n "$running" ] || break
  if logs=$(docker logs --since 60s "$name" 2>&1); then
    errors=$(printf '%s\n' "$logs" | grep -c "503 Service Unavailable")
    if [ "$errors" -gt "$limit" ]; then
      strikes=$((strikes + 1))
    else
      strikes=0
    fi
  else
    echo "$(date -u +%FT%TZ) $name: docker logs failed, this check does not count"
  fi
  if [ "$strikes" -ge "$checks" ]; then
    echo "$(date -u +%FT%TZ) $name: more than $limit errors from the rollout engine in each of $checks checks, last $errors in 60 s, stopping the run"
    docker stop "$name"
    exit 1
  fi
  sleep 30
done
echo "$(date -u +%FT%TZ) $name: the run ended"
```

Save it as `~/miles-lab/watchdog.sh`, or download the same script:

```bash
curl -fsSL -o ~/miles-lab/watchdog.sh https://raw.githubusercontent.com/rohitg00/ai-engineering-from-scratch/main/manuals/miles-101/capture/gpu/watchdog.sh
```

Start it in a second terminal right after the run starts, with the container name from [section 1.1](#s-run-grpo-on-one-gpu):

```bash
sh ~/miles-lab/watchdog.sh miles-plain 100 10
```

## Test the watchdog first

Test it on two containers that print the error on purpose. They need no GPU. The first prints ten error lines each second and never stops, like a dead engine:

```listing
title: the watchdog stops a container that never stops printing the error
source: capture/gpu/out-gb10/watchdog-test.txt
lang: text
note: The container prints ten error lines each second.
---
$ sh capture/gpu/watchdog.sh wd-dead 100
2026-10-22T15:41:09Z wd-dead: more than 100 errors from the rollout engine in each of 6 checks, last 578 in 60 s, stopping the run
wd-dead
$ echo $?
1
```

The watchdog stopped the container 183 s after it started, and exited with 1. We ran this test before we raised the default to 10, so it used 6 checks. With 10 checks, the same rule needs four more checks, so it stops about two minutes later. A script that starts runs one after another can read that exit code and skip to the next run. An exit code of 2 means that the watchdog lost Docker, and the run has no guard.

The second container prints the error for 60 s and then stays quiet for two minutes. It does this three times, like the bursts of a busy engine. The watchdog let it run to its end after 541 s, and exited with 0. Its quiet gaps of two minutes are longer than the real gaps of 45 s, so test with the replay above too.

## Guard the GPU heat

Our GB10 reached 84 C again and again under hours of load. The heat guard from [the front matter](#s-front-how-we-tested-it) paused our runs 1,005 times in five days. Run it on a GB10, or on any GPU that gets hot when you leave a run alone for hours. A short run of a few steps does not need it.

Download the script that we ran, and start it in a third terminal on the host, not in the container. The `rm` part deletes a stop file that an earlier session can leave behind, because the script exits at once when that file exists. Delete it only when no queue of yours uses the file to stop the guard. The commands stop at the first failure, so a failed download does not start an old copy:

```bash
curl -fsSL -o ~/miles-lab/heat-guard.sh https://raw.githubusercontent.com/rohitg00/ai-engineering-from-scratch/main/manuals/miles-101/capture/gpu/heat-guard.sh \
  && rm -f ~/miles-lab/queue2.done \
  && sh ~/miles-lab/heat-guard.sh
```

Every 5 s, the script reads the GPU temperature with `nvidia-smi`. It pauses the first running container of the `radixark/miles:latest` image at 84 C. It resumes the container at 74 C or below after at least 45 s, or after 120 s at most. Each pause and resume goes to `~/miles-lab/runs/thermostat.log`.

Stop the script with Ctrl+C. It resumes the container that it paused before it exits, so no run stays paused. In our check, Ctrl+C during a pause resumed the run within 5 s. It also stops when the file `~/miles-lab/queue2.done` exists, which is how our run queue stopped it.

Read the pause log when you compare times. A step that overlapped a pause took longer for a reason that is not the work. [Section 5.3](#s-repeat-a-run) shows how to time only clean steps.

The watchdog only stops the run. To find out why the engine died, read the engine lines above the first error. [Section 7.1](#s-troubleshoot-by-symptom) lists the causes we met.

```takeaways
- Start the watchdog in a second terminal for every run you leave alone.
- Run the watchdog with 10 checks, because healthy bursts can come 45 s apart.
- Test the watchdog on a fake container before you trust it.
- Run the heat guard on a GPU that gets hot, and keep its pause log.
- Read the engine lines above the first 503 error to find the cause.
```

Sources: capture/gpu/watchdog.sh; capture/gpu/heat-guard.sh; capture/gpu/out-gb10/thermostat.log; capture/gpu/watchdog_replay.py; capture/gpu/out-gb10/503-bursts.txt; capture/gpu/out-gb10/e2-n16-503-per-second.txt; capture/gpu/out-gb10/engine-died-503.log; capture/gpu/out-gb10/engine-died-count.txt; capture/gpu/out-gb10/watchdog-test.txt; capture/gpu/summary/miles-gb10-lab.json (excluded runs); Miles rollout client at main 08752a12.
