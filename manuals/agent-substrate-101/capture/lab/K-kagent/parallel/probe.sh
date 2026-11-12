for url in http://atenet-router.ate-system.svc:80/ http://atenet-router.ate-system.svc:8081/ https://atenet-router.ate-system.svc:443/ https://atenet-router.ate-system.svc:8444/ http://atenet-router.ate-system.svc:15020/ https://api.ate-system.svc:443/ https://atenet-egress.ate-system.svc:443/; do
  curl -sk -m 5 -o /dev/null -H "ate-target-actor: kagent/session-01a1cf4e-5679-77ad-9913-f700c3e5ab70" -w "$url code=%{http_code} curl_exit=%{exitcode} %{errormsg}\n" "$url"
done
