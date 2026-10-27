#!/usr/bin/env bash
# Tvåfaktorsflödet: gate -> registrering -> verifiering -> engångskod.
set -u
BASE="${BASE:-http://127.0.0.1:3112}"
OWNER="${OWNER:-mfa-audit@example.com}"
PASS="Testlosen123"
JAR="$(mktemp)"
fail=0; pass=0
ok() { pass=$((pass + 1)); echo "ok   $1"; }
bad() { fail=$((fail + 1)); echo "FAIL $1"; }
req() { local m="$1" p="$2" d="${3:-}"
  if [ -n "$d" ]; then curl -s -b "$JAR" -c "$JAR" -X "$m" -H 'Content-Type: application/json' -d "$d" -w '\n%{http_code}' "$BASE$p"
  else curl -s -b "$JAR" -c "$JAR" -X "$m" -w '\n%{http_code}' "$BASE$p"; fi; }
code_of() { printf '%s' "$1" | tail -n1; }
body_of() { printf '%s' "$1" | sed '$d'; }
totp() { node scripts/audit-totp.mjs "$1"; }

echo "== 0. Konto =="
R=$(req POST /api/auth/signup "{\"name\":\"MFA\",\"email\":\"$OWNER\",\"password\":\"$PASS\",\"locale\":\"sv\"}")
C=$(code_of "$R")
if [ "$C" = "409" ]; then R=$(req POST /api/auth/login "{\"email\":\"$OWNER\",\"password\":\"$PASS\"}"); C=$(code_of "$R"); fi
[ "$C" = "200" ] && ok "konto och session" || bad "konto: $C $(body_of "$R")"

echo "== 1. Grinden kräver kod =="
CODE=$(curl -s -b "$JAR" -c "$JAR" -o /tmp/mfa-gate.html -w '%{http_code}' "$BASE/sv/admin")
[ "$CODE" = "200" ] && grep -qiE "kod|authenticator|two-factor|tvåfaktor" /tmp/mfa-gate.html && ok "grinden renderar kodsteget" || bad "grind: $CODE"
R=$(req GET /api/admin/overview); [ "$(code_of "$R")" = "403" ] && grep -q "mfa_required" <<<"$(body_of "$R")" && ok "API nekas före kod" || bad "API före kod: $(code_of "$R") $(body_of "$R")"
R=$(req GET /api/admin/mfa); [ "$(code_of "$R")" = "200" ] && grep -q '"enrolled":false' <<<"$(body_of "$R")" && ok "status: ej registrerad" || bad "mfa-status: $(code_of "$R") $(body_of "$R")"

echo "== 2. Registrera autentiserare =="
R=$(req POST /api/admin/mfa '{"action":"enrol"}'); EB=$(body_of "$R")
[ "$(code_of "$R")" = "200" ] && grep -q '"secret"' <<<"$EB" && ok "hemlighet skapad" || bad "enrol: $(code_of "$R") $EB"
SECRET=$(grep -o '"secret":"[^"]*"' <<<"$EB" | cut -d'"' -f4)
grep -q '"uri":"otpauth://totp/' <<<"$EB" && ok "otpauth-uri finns" || bad "otpauth-uri saknas"
CODE_TOTP=$(totp "$SECRET")
R=$(req POST /api/admin/mfa "{\"action\":\"confirm\",\"code\":\"$CODE_TOTP\"}"); CB=$(body_of "$R")
[ "$(code_of "$R")" = "200" ] && ok "kod bekräftad" || bad "confirm: $(code_of "$R") $CB"
RECOVERY=$(grep -o '"recoveryCodes":\[[^]]*\]' <<<"$CB" | grep -o '"[A-Z0-9]\{5\}-[A-Z0-9]\{5\}"' | tr -d '"' | head -1)
[ -n "${RECOVERY:-}" ] && ok "engångskoder utfärdade" || bad "engångskoder saknas"
R=$(req GET /api/admin/overview); [ "$(code_of "$R")" = "200" ] && ok "API öppet efter kod" || bad "API efter kod: $(code_of "$R")"

echo "== 3. Ny inloggning kräver ny kod =="
R=$(req POST /api/auth/logout); [ "$(code_of "$R")" = "200" ] && ok "utloggad" || bad "logout: $(code_of "$R")"
R=$(req POST /api/admin/mfa "{\"action\":\"password\",\"email\":\"$OWNER\",\"password\":\"$PASS\"}")
[ "$(code_of "$R")" = "200" ] && grep -q '"needsEnrolment":false' <<<"$(body_of "$R")" && ok "lösenordssteg" || bad "lösenordssteg: $(code_of "$R") $(body_of "$R")"
R=$(req GET /api/admin/overview); [ "$(code_of "$R")" = "403" ] && ok "ny session är overifierad" || bad "overifierad session: $(code_of "$R")"
CODE_TOTP=$(totp "$SECRET")
R=$(req POST /api/admin/mfa "{\"action\":\"verify\",\"code\":\"$CODE_TOTP\"}"); [ "$(code_of "$R")" = "200" ] && ok "kod verifierad" || bad "verify: $(code_of "$R") $(body_of "$R")"
R=$(req GET /api/admin/overview); [ "$(code_of "$R")" = "200" ] && ok "panelen öppen" || bad "panel efter verify: $(code_of "$R")"

echo "== 4. Engångskod =="
R=$(req POST /api/auth/logout) > /dev/null
R=$(req POST /api/admin/mfa "{\"action\":\"password\",\"email\":\"$OWNER\",\"password\":\"$PASS\"}") > /dev/null
R=$(req POST /api/admin/mfa "{\"action\":\"verify\",\"code\":\"$RECOVERY\"}")
[ "$(code_of "$R")" = "200" ] && grep -q '"recoveryUsed":true' <<<"$(body_of "$R")" && ok "engångskod fungerar" || bad "engångskod: $(code_of "$R") $(body_of "$R")"
R=$(req GET /api/admin/mfa); grep -o '"recoveryLeft":[0-9]*' <<<"$(body_of "$R")" | head -1

echo "== 5. Fel kod avvisas =="
R=$(req POST /api/auth/logout) > /dev/null
R=$(req POST /api/admin/mfa "{\"action\":\"password\",\"email\":\"$OWNER\",\"password\":\"$PASS\"}") > /dev/null
R=$(req POST /api/admin/mfa '{"action":"verify","code":"000000"}')
[ "$(code_of "$R")" = "401" ] && ok "fel kod ger 401" || bad "fel kod: $(code_of "$R") $(body_of "$R")"

echo "== 6. Återställning av faktorn =="
R=$(req POST /api/admin/mfa "{\"action\":\"password\",\"email\":\"$OWNER\",\"password\":\"$PASS\"}") > /dev/null
CODE_TOTP=$(totp "$SECRET")
R=$(req POST /api/admin/mfa "{\"action\":\"verify\",\"code\":\"$CODE_TOTP\"}"); [ "$(code_of "$R")" = "200" ] && ok "verifierad igen" || bad "verify igen: $(code_of "$R")"
R=$(req POST /api/admin/mfa '{"action":"reset"}'); [ "$(code_of "$R")" = "200" ] && ok "faktorn återställs" || bad "reset: $(code_of "$R") $(body_of "$R")"
R=$(req GET /api/admin/overview); [ "$(code_of "$R")" = "403" ] && grep -q "mfa_required" <<<"$(body_of "$R")" && ok "panelen kräver ny registrering" || bad "efter reset: $(code_of "$R")"
R=$(req GET /api/admin/mfa); grep -q '"enrolled":false' <<<"$(body_of "$R")" && ok "status: ej registrerad" || bad "status efter reset: $(body_of "$R")"

echo ""
echo "RESULTAT: $pass ok, $fail misslyckade"
rm -f "$JAR"
exit "$fail"
