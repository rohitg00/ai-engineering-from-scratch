set -u
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
export GOWORK=off
E=~/evidence/S-ax-model/50-ax-v031; mkdir -p $E
cd ~/ax-v031
el() { echo "$(date +%s.%N) - $1" | bc -l | xargs printf '%.3f'; }
s=$(date +%s.%N); mkdir -p bin; CGO_ENABLED=0 go build -o bin/ ./cmd/... > $E/10-go-build.log 2>&1; echo "go build rc=$? seconds=$(el $s)" | tee $E/11-go-build-result.txt
ls -la bin | tee -a $E/11-go-build-result.txt
OLD=$(go list -m -f '{{.Dir}}' github.com/agent-substrate/substrate 2>/dev/null); echo "old module dir: $OLD" > $E/12-proto-compare.txt
NEW=$(cd ~/ax && go list -m -f '{{.Dir}}' go.ate.dev/substrate 2>/dev/null); echo "new module dir: $NEW" >> $E/12-proto-compare.txt
for d in "$OLD" "$NEW"; do
  echo "## $d" >> $E/12-proto-compare.txt
  grep -rh -E "^package |^service |^  rpc " $d/pkg/proto/ateapipb/*.proto $d/proto/ateapi/*.proto $d/api/proto/*.proto 2>/dev/null | cut -c1-150 >> $E/12-proto-compare.txt
  find $d -name "*.proto" -path "*ateapi*" | head -5 >> $E/12-proto-compare.txt
  grep -rh -o -E 'ServiceName: +"[^"]+"|FullMethodName += "[^"]+"' $d/pkg/proto/ateapipb/*_grpc.pb.go 2>/dev/null | sort -u | head -40 >> $E/12-proto-compare.txt
done
cat $E/12-proto-compare.txt | cut -c1-160 | head -110
bin/ax --help 2>&1 | head -30 > $E/13-ax-help-v031.txt; head -30 $E/13-ax-help-v031.txt
grep -n -E "flag\.(String|Bool)\(" cmd/ax-controller/main.go cmd/ax-server/main.go | cut -c1-220 | head -30 | tee $E/14-flags.txt
