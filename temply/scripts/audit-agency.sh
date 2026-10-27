#!/usr/bin/env bash
# Byråns arbetsyta: projekt, bibliotek, team och kundgranskning.
set -u
BASE="${BASE:-http://127.0.0.1:3110}"
STAMP="$(date +%s)"
EMAIL="agency-$STAMP@example.com"
PASS="Testlosen123"
JAR="$(mktemp)"
CJAR="$(mktemp)"
fail=0; pass=0
ok() { pass=$((pass + 1)); echo "ok   $1"; }
bad() { fail=$((fail + 1)); echo "FAIL $1"; }
req() { local m="$1" p="$2" d="${3:-}" j="${4:-$JAR}"
  if [ -n "$d" ]; then curl -s -b "$j" -c "$j" -X "$m" -H 'Content-Type: application/json' -d "$d" -w '\n%{http_code}' "$BASE$p"
  else curl -s -b "$j" -c "$j" -X "$m" -w '\n%{http_code}' "$BASE$p"; fi; }
code_of() { printf '%s' "$1" | tail -n1; }
body_of() { printf '%s' "$1" | sed '$d'; }
id_of() { grep -o '"id":"[^"]*"' <<<"$1" | head -1 | cut -d'"' -f4; }

echo "== 0. Konto och arbetsyta =="
R=$(req POST /api/auth/signup "{\"name\":\"Agency Audit\",\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"locale\":\"sv\"}")
[ "$(code_of "$R")" = "200" ] && ok "konto" || bad "konto: $(code_of "$R") $(body_of "$R")"
R=$(req GET /api/agency); [ "$(code_of "$R")" = "200" ] && grep -q '"agency"' <<<"$(body_of "$R")" && ok "arbetsytan skapas" || bad "agency: $(code_of "$R") $(body_of "$R")"
CODE=$(curl -s -b "$JAR" -o /tmp/agw.html -w '%{http_code}' "$BASE/sv/agency/workspace")
[ "$CODE" = "200" ] && ok "arbetsytan renderar" || bad "arbetsyta: $CODE"

echo "== 1. Projekt =="
R=$(req POST /api/agency/projects '{"name":"Kundtema","clientName":"Keramik AB","shopDomain":"keramik.myshopify.com","contactEmail":"kund@example.com","prompt":"varm keramikbutik"}')
PC=$(code_of "$R"); P1=$(grep -o '"projectId":"[^"]*"' <<<"$(body_of "$R")" | head -1 | cut -d'"' -f4)
[ "$PC" = "201" ] && [ -n "${P1:-}" ] && ok "projekt skapat" || bad "projekt: $PC $(body_of "$R")"
R=$(req GET /api/agency); AB=$(body_of "$R")
grep -q "Kundtema" <<<"$AB" && ok "projektet syns i arbetsytan" || bad "projektet saknas i arbetsytan"
grep -q "Keramik AB" <<<"$AB" && ok "kunden kopplas" || bad "kund saknas"
CODE=$(curl -s -b "$JAR" -o /dev/null -w '%{http_code}' "$BASE/sv/studio/$P1")
[ "$CODE" = "200" ] && ok "projektet öppnas i studion" || bad "studio: $CODE"

echo "== 2. Plan och granskning =="
R=$(req POST /api/agency/reviews "{\"projectId\":\"$P1\",\"clientName\":\"Keramik AB\"}")
[ "$(code_of "$R")" = "403" ] && ok "granskning kräver Pro (403)" || bad "granskning på starter: $(code_of "$R") $(body_of "$R")"
R=$(req PATCH /api/agency '{"plan":"pro"}'); [ "$(code_of "$R")" = "200" ] && ok "byla plan" || bad "planbyte: $(code_of "$R") $(body_of "$R")"
R=$(req POST /api/agency/reviews "{\"projectId\":\"$P1\",\"clientName\":\"Keramik AB\"}")
TOKEN=$(grep -o '"token":"[^"]*"' <<<"$(body_of "$R")" | cut -d'"' -f4)
[ "$(code_of "$R")" = "201" ] && [ -n "${TOKEN:-}" ] && ok "granskningslänk skapad" || bad "granskning: $(code_of "$R") $(body_of "$R")"

R=$(req GET "/api/review/$TOKEN"); [ "$(code_of "$R")" = "200" ] && grep -q '"project"' <<<"$(body_of "$R")" && ok "publik granskningsdata" || bad "review API: $(code_of "$R")"
CODE=$(curl -s -o /tmp/review.html -w '%{http_code}' "$BASE/sv/review/$TOKEN")
[ "$CODE" = "200" ] && grep -q "Keramik AB" /tmp/review.html && ok "granskningssidan renderar" || bad "granskningssida: $CODE"
R=$(req POST "/api/review/$TOKEN" '{"action":"comment","author":"Kund","body":"Snyggt, men byt hero-bild."}' "$CJAR")
[ "$(code_of "$R")" = "200" ] && grep -q "byt hero-bild" <<<"$(body_of "$R")" && ok "kommentar sparas" || bad "kommentar: $(code_of "$R") $(body_of "$R")"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/review/$TOKEN/download")
[ "$CODE" = "403" ] && ok "nedladdning kräver godkännande" || bad "nedladdning före godkännande: $CODE"
R=$(req POST "/api/review/$TOKEN" '{"action":"approve"}' "$CJAR")
[ "$(code_of "$R")" = "200" ] && grep -q '"status":"approved"' <<<"$(body_of "$R")" && ok "kunden godkänner" || bad "godkännande: $(code_of "$R") $(body_of "$R")"
curl -s -b "$JAR" -o /tmp/review.zip -w '%{http_code}\n' "$BASE/api/review/$TOKEN/download" > /tmp/dl.txt
if [ "$(cat /tmp/dl.txt)" = "200" ] && unzip -tqq /tmp/review.zip >/dev/null 2>&1; then ok "nedladdning efter godkännande ($(wc -c </tmp/review.zip | tr -d ' ') byte)"; else bad "nedladdning: $(cat /tmp/dl.txt)"; fi

echo "== 3. Bibliotek =="
R=$(req POST /api/agency/library "{\"action\":\"save\",\"projectId\":\"$P1\",\"kind\":\"theme\",\"name\":\"Keramikbas\"}")
ITEM=$(grep -o '"itemId":"[^"]*"' <<<"$(body_of "$R")" | cut -d'"' -f4)
[ "$(code_of "$R")" = "201" ] && [ -n "${ITEM:-}" ] && ok "tema sparas i biblioteket" || bad "bibliotek save: $(code_of "$R") $(body_of "$R")"
R=$(req POST /api/agency/library "{\"action\":\"apply\",\"itemId\":\"$ITEM\",\"clientName\":\"Ny kund\"}")
P2=$(grep -o '"projectId":"[^"]*"' <<<"$(body_of "$R")" | cut -d'"' -f4)
[ "$(code_of "$R")" = "201" ] && [ -n "${P2:-}" ] && ok "tema appliceras som nytt projekt" || bad "bibliotek apply: $(code_of "$R") $(body_of "$R")"
R=$(req GET /api/agency); grep -q 'Keramikbas' <<<"$(body_of "$R")" && ok "biblioteket listas" || bad "biblioteket listas inte"

echo "== 4. Team =="
R=$(req POST /api/agency/members "{\"email\":\"designer-$STAMP@example.com\",\"name\":\"Designer\",\"role\":\"designer\"}")
MID=$(id_of "$(body_of "$R")")
[ "$(code_of "$R")" = "201" ] && ok "medlem bjuds in" || bad "medlem: $(code_of "$R") $(body_of "$R")"
R=$(req POST /api/agency/members "{\"email\":\"designer-$STAMP@example.com\",\"name\":\"Designer\",\"role\":\"designer\"}")
[ "$(code_of "$R")" = "409" ] && ok "dublett avvisas" || bad "dublett: $(code_of "$R")"
R=$(req POST /api/agency/members '{"email":"inte-en-adress"}')
[ "$(code_of "$R")" = "400" ] && ok "ogiltig adress avvisas" || bad "ogiltig adress: $(code_of "$R")"

echo "== 5. Städning =="
for p in "$P1" "$P2"; do [ -n "${p:-}" ] && curl -s -b "$JAR" -X DELETE "$BASE/api/agency/projects/$p" > /dev/null; done
[ -n "${ITEM:-}" ] && curl -s -b "$JAR" -X POST -H 'Content-Type: application/json' -d "{\"action\":\"delete\",\"itemId\":\"$ITEM\"}" "$BASE/api/agency/library" > /dev/null
[ -n "${MID:-}" ] && curl -s -b "$JAR" -X DELETE "$BASE/api/agency/members?id=$MID" > /dev/null
R=$(req GET /api/agency); [ "$(code_of "$R")" = "200" ] && ok "städning klar" || bad "städning: $(code_of "$R")"

echo ""
echo "RESULTAT: $pass ok, $fail misslyckade ($EMAIL)"
rm -f "$JAR" "$CJAR"
exit "$fail"
