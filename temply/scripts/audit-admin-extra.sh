#!/usr/bin/env bash
# Kompletterande adminflöden: lösenordsåterställning, avstängning, frånkoppling,
# raderingsskydd och ny inbjudningslänk.
set -u
BASE="${BASE:-http://127.0.0.1:3114}"
OWNER="owner-audit@example.com"
PASS="Testlosen123"
STAMP="$(date +%s)"
TARGET="extra-$STAMP@example.com"
OJAR="$(mktemp)"; TJAR="$(mktemp)"; NEWJAR="$(mktemp)"
fail=0; pass=0
ok() { pass=$((pass + 1)); echo "ok   $1"; }
bad() { fail=$((fail + 1)); echo "FAIL $1"; }
req() { local m="$1" p="$2" d="${3:-}" j="${4:-$OJAR}"
  if [ -n "$d" ]; then curl -s -b "$j" -c "$j" -X "$m" -H 'Content-Type: application/json' -d "$d" -w '\n%{http_code}' "$BASE$p"
  else curl -s -b "$j" -c "$j" -X "$m" -w '\n%{http_code}' "$BASE$p"; fi; }
code_of() { printf '%s' "$1" | tail -n1; }
body_of() { printf '%s' "$1" | sed '$d'; }

R=$(req POST /api/auth/login "{\"email\":\"$OWNER\",\"password\":\"$PASS\"}"); [ "$(code_of "$R")" = "200" ] && ok "ägarsession" || bad "ägare: $(code_of "$R")"
R=$(req POST /api/auth/signup "{\"name\":\"Extra\",\"email\":\"$TARGET\",\"password\":\"$PASS\",\"locale\":\"sv\"}" "$TJAR"); [ "$(code_of "$R")" = "200" ] && ok "målkonto" || bad "målkonto: $(code_of "$R")"
R=$(req GET "/api/admin/users?q=$TARGET"); TID=$(grep -o '"id":"[^"]*"' <<<"$(body_of "$R")" | head -1 | cut -d'"' -f4)
[ -n "${TID:-}" ] && ok "mål-id" || bad "mål-id saknas"

R=$(req PATCH /api/admin/users "{\"id\":\"$TID\",\"resetPassword\":true}"); TEMP=$(grep -o '"temporaryPassword":"[^"]*"' <<<"$(body_of "$R")" | cut -d'"' -f4)
[ "$(code_of "$R")" = "200" ] && [ -n "${TEMP:-}" ] && ok "tillfälligt lösenord" || bad "lösenordsåterställning: $(code_of "$R") $(body_of "$R")"
R=$(req POST /api/auth/login "{\"email\":\"$TARGET\",\"password\":\"$TEMP\"}" "$NEWJAR")
[ "$(code_of "$R")" = "200" ] && ok "inloggning med nytt lösenord" || bad "nytt lösenord: $(code_of "$R")"

R=$(req PATCH /api/admin/users "{\"id\":\"$TID\",\"disabled\":true}")
[ "$(code_of "$R")" = "200" ] && ok "stäng av" || bad "stäng av: $(code_of "$R")"
R=$(req GET /api/projects "" "$NEWJAR"); [ "$(code_of "$R")" = "401" ] && ok "avstängd session nekas direkt" || bad "avstängd session: $(code_of "$R")"
R=$(req PATCH /api/admin/users "{\"id\":\"$TID\",\"disabled\":false}"); [ "$(code_of "$R")" = "200" ] && ok "öppna igen" || bad "öppna: $(code_of "$R")"
R=$(req PATCH /api/admin/users "{\"id\":\"$TID\",\"disconnectShopify\":true}"); [ "$(code_of "$R")" = "200" ] && grep -q "shopify_disconnected" <<<"$(body_of "$R")" && ok "koppla från Shopify" || bad "shopify: $(code_of "$R")"
R=$(req DELETE /api/admin/users "{\"id\":\"$TID\",\"confirm\":\"fel@example.com\"}"); [ "$(code_of "$R")" = "400" ] && ok "radering kräver rätt e-post" || bad "raderingsskydd: $(code_of "$R")"

R=$(req POST /api/admin/staff "{\"email\":\"reissue-$STAMP@example.com\",\"name\":\"Reissue\",\"role\":\"support\"}")
SID=$(body_of "$R" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ "$(code_of "$R")" = "200" ] && ok "inbjudan skapad" || bad "inbjudan: $(code_of "$R")"
R=$(req PATCH /api/admin/staff "{\"id\":\"$SID\",\"reissue\":true}"); grep -q "staff/join/" <<<"$(body_of "$R")" && ok "ny inbjudningslänk" || bad "reissue: $(code_of "$R") $(body_of "$R")"
curl -s -b "$OJAR" -X DELETE -H 'Content-Type: application/json' -d "{\"id\":\"$SID\"}" "$BASE/api/admin/staff" > /dev/null

R=$(req PATCH /api/admin/roles '{"slug":"support","description":"Tillfällig beskrivning"}')
[ "$(code_of "$R")" = "200" ] && ok "rollbeskrivning kan ändras" || bad "roll: $(code_of "$R") $(body_of "$R")"
R=$(req PATCH /api/admin/roles '{"slug":"owner","label":"Ägare"}'); [ "$(code_of "$R")" = "400" ] && ok "ägarrollen är låst" || bad "owner-roll: $(code_of "$R")"
req PATCH /api/admin/roles '{"slug":"support","description":"Användare, inkorg och projekt – utan ekonomi och nycklar."}' > /dev/null

R=$(req DELETE /api/admin/users "{\"id\":\"$TID\",\"confirm\":\"$TARGET\"}"); [ "$(code_of "$R")" = "200" ] && ok "radera målkonto" || bad "radera: $(code_of "$R") $(body_of "$R")"

echo ""
echo "RESULTAT: $pass ok, $fail misslyckade"
rm -f "$OJAR" "$TJAR" "$NEWJAR"
exit "$fail"
