#!/usr/bin/env bash
# Rök-test: begär varje sida och API-rutt och rapporterar status.
# Används vid systemgranskning; kräver en körande server.
BASE="${BASE:-http://127.0.0.1:3110}"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

fail=0

check_page() {
  local path="$1"
  local body code
  body="$(curl -s -b "$JAR" -c "$JAR" -w '\n%{http_code}' "$BASE$path")"
  code="${body##*$'\n'}"
  body="${body%$'\n'*}"
  if [ "$code" != "200" ]; then
    echo "FAIL $code  $path"
    fail=$((fail + 1))
    return
  fi
  if grep -qE "Application error|Internal Server Error|__next_error" <<<"$body"; then
    echo "FAIL marker $path"
    fail=$((fail + 1))
    return
  fi
  echo "ok   $code  $path  ($(wc -c <<<"$body" | tr -d ' ') bytes)"
}

check_api() {
  local method="$1" path="$2" expect="$3" data="${4:-}"
  local code
  if [ -n "$data" ]; then
    code="$(curl -s -b "$JAR" -c "$JAR" -o /dev/null -w '%{http_code}' -X "$method" -H 'Content-Type: application/json' -d "$data" "$BASE$path")"
  else
    code="$(curl -s -b "$JAR" -c "$JAR" -o /dev/null -w '%{http_code}' -X "$method" "$BASE$path")"
  fi
  if [ "$code" = "$expect" ]; then
    echo "ok   $code  $method $path"
  else
    echo "FAIL $code (want $expect)  $method $path"
    fail=$((fail + 1))
  fi
}

echo "=== SIDOR ==="
for locale in sv en de; do
  check_page "/$locale"
  check_page "/$locale/pricing"
  check_page "/$locale/contact"
  check_page "/$locale/privacy"
  check_page "/$locale/terms"
  check_page "/$locale/agency"
  check_page "/$locale/agency/pricing"
done
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/")
[ "$CODE" = "307" ] && echo "ok   307  / (omdirigeras till språk)" || { echo "FAIL $CODE  /"; fail=$((fail + 1)); }
check_page "/sv/login"
check_page "/sv/signup"
check_page "/sv/admin"

echo
echo "=== API UTAN INLOGGNING (förväntat 401/400/405) ==="
check_api GET /api/projects 401
check_api POST /api/projects 401 '{"name":"x"}'
check_api GET /api/admin/overview 403
check_api GET /api/admin/users 403
check_api GET /api/admin/staff 403
check_api GET /api/admin/economy 403
check_api GET /api/admin/keys 403
check_api GET /api/admin/system 403
check_api GET /api/admin/audit 403
check_api GET /api/admin/inbox 403
check_api GET /api/admin/content 403
check_api GET /api/admin/roles 403
check_api GET /api/admin/projects 403
check_api GET /api/agency 401
check_api POST /api/ai/theme 401 '{"prompt":"test"}'
check_api POST /api/ai/copy 401 '{"kind":"hero"}'
check_api POST /api/ai/image 401 '{"prompt":"test"}'
check_api POST /api/brand/extract 401 '{"url":"https://example.com"}'
check_api GET /api/referral/check 200
check_api POST /api/contact 400 '{}'
check_api GET /api/review/invalidtoken 404
check_api POST /api/staff/accept 404 '{}'

echo
echo "=== OKÄNDA RUTTER ==="
check_api GET /api/does-not-exist 404
check_api GET /sv/does-not-exist 404

echo
if [ "$fail" -eq 0 ]; then echo "ALLA OK"; else echo "MISSLYCKANDEN: $fail"; fi
exit "$fail"
