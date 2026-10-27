#!/usr/bin/env bash
# End-to-end: konto -> tema -> versioner -> export -> health -> AI -> städning.
set -u
BASE="${BASE:-http://127.0.0.1:3110}"
JAR="$(mktemp)"
EMAIL="audit-$(date +%s)@example.com"
PASS="Testlosen123"
fail=0
pass=0

say() { printf '%s\n' "$*"; }
ok() { pass=$((pass + 1)); say "ok   $1"; }
bad() { fail=$((fail + 1)); say "FAIL $1"; }

req() { # method path data
  local method="$1" path="$2" data="${3:-}"
  if [ -n "$data" ]; then
    curl -s -b "$JAR" -c "$JAR" -X "$method" -H 'Content-Type: application/json' -d "$data" -w '\n%{http_code}' "$BASE$path"
  else
    curl -s -b "$JAR" -c "$JAR" -X "$method" -w '\n%{http_code}' "$BASE$path"
  fi
}

code_of() { printf '%s' "$1" | tail -n1; }
body_of() { printf '%s' "$1" | sed '$d'; }

say "== 1. Registrering =="
R=$(req POST /api/auth/signup "{\"name\":\"Audit\",\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"locale\":\"sv\"}")
[ "$(code_of "$R")" = "200" ] && ok "signup" || bad "signup: $(code_of "$R") $(body_of "$R")"

R=$(req POST /api/auth/signup "{\"name\":\"Audit\",\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
[ "$(code_of "$R")" = "409" ] && ok "dubbelregistrering avvisas" || bad "dubbelregistrering: $(code_of "$R")"

R=$(req POST /api/auth/signup '{"name":"X","email":"inte-en-epost","password":"12345678"}')
[ "$(code_of "$R")" = "400" ] && ok "ogiltig e-post avvisas" || bad "ogiltig e-post: $(code_of "$R")"

R=$(req POST /api/auth/signup '{"name":"X","email":"kort@example.com","password":"123"}')
[ "$(code_of "$R")" = "400" ] && ok "svagt lösenord avvisas" || bad "svagt lösenord: $(code_of "$R")"

say "== 2. Session och dashboard =="
R=$(req GET /api/projects)
[ "$(code_of "$R")" = "200" ] && ok "projects kräver session och svarar" || bad "projects: $(code_of "$R")"
CODE=$(curl -s -b "$JAR" -o /tmp/audit-dash.html -w '%{http_code}' "$BASE/sv/dashboard")
[ "$CODE" = "200" ] && grep -q "Audit" /tmp/audit-dash.html && ok "dashboard renderar användaren" || bad "dashboard: $CODE"

say "== 3. Skapa tema =="
R=$(req POST /api/projects '{"name":"Keramik","prompt":"varm keramikbutik med handgjorda skålar","mood":"warm","locale":"sv"}')
PID=$(body_of "$R" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ "$(code_of "$R")" = "201" ] && [ -n "$PID" ]; then ok "projekt skapat $PID"; else bad "skapa projekt: $(code_of "$R") $(body_of "$R")"; fi

R=$(req GET "/api/projects/$PID")
[ "$(code_of "$R")" = "200" ] && ok "hämta projekt" || bad "hämta projekt: $(code_of "$R")"

# PATCH med config: hämta config och skicka tillbaka med nytt namn
CFG=$(body_of "$R" | grep -o '"config":{.*' | sed 's/}}$/}/')
R=$(req PATCH "/api/projects/$PID" "{\"name\":\"Keramik AB\",\"versionLabel\":\"Första versionen\"}")
[ "$(code_of "$R")" = "200" ] && ok "byt namn" || bad "byt namn: $(code_of "$R") $(body_of "$R")"

R=$(req PATCH "/api/projects/$PID" '{"config":{"foo":1}}')
[ "$(code_of "$R")" = "400" ] && ok "ogiltig config avvisas" || bad "ogiltig config: $(code_of "$R")"

say "== 4. Versioner =="
R=$(req POST "/api/projects/$PID/versions" '{"action":"save","label":"Manuell"}')
[ "$(code_of "$R")" = "200" ] && ok "spara version" || bad "spara version: $(code_of "$R") $(body_of "$R")"
VID=$(body_of "$R" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
R=$(req GET "/api/projects/$PID/versions")
[ "$(code_of "$R")" = "200" ] && grep -q '"versions"' <<<"$(body_of "$R")" && ok "lista versioner" || bad "lista versioner: $(code_of "$R")"
if [ -n "${VID:-}" ]; then
  R=$(req POST "/api/projects/$PID/versions" "{\"action\":\"restore\",\"versionId\":\"$VID\"}")
  [ "$(code_of "$R")" = "200" ] && ok "återställ version" || bad "återställ version: $(code_of "$R") $(body_of "$R")"
fi

say "== 5. Export =="
curl -s -b "$JAR" -o /tmp/audit-theme.zip -w '%{http_code} %{content_type}\n' "$BASE/api/projects/$PID/export" > /tmp/audit-export.txt
EXPORT_CODE=$(cut -d' ' -f1 /tmp/audit-export.txt)
EXPORT_TYPE=$(cut -d' ' -f2 /tmp/audit-export.txt)
[ "$EXPORT_CODE" = "200" ] && ok "export svarar 200" || bad "export: $EXPORT_CODE"
[[ "$EXPORT_TYPE" == application/zip* ]] && ok "content-type zip" || bad "content-type: $EXPORT_TYPE"
if command -v unzip >/dev/null; then
  if unzip -tqq /tmp/audit-theme.zip >/dev/null 2>&1; then ok "zip integritet"; else bad "zip korrupt"; fi
  LIST=$(unzip -Z1 /tmp/audit-theme.zip 2>/dev/null)
  for f in layout/theme.liquid config/settings_schema.json config/settings_data.json templates/index.json sections/hero.liquid; do
    grep -qx "$f" <<<"$LIST" && ok "zip innehåller $f" || bad "zip saknar $f"
  done
  say "   filer i zip: $(grep -c . <<<"$LIST")"
  say "   locale-filer: $(grep -c '^locales/' <<<"$LIST")"
else
  bad "unzip saknas – kan inte verifiera arkivet"
fi

say "== 6. Theme Health =="
R=$(req POST /api/health/audit "{\"projectId\":\"$PID\"}")
HCODE=$(code_of "$R"); HBODY=$(body_of "$R")
if [ "$HCODE" = "200" ] && grep -q '"score"' <<<"$HBODY"; then
  SCORE=$(grep -o '"score":[0-9]*' <<<"$HBODY" | head -1 | cut -d: -f2)
  COUNT=$(grep -o '"id":"[^"]*"' <<<"$HBODY" | wc -l | tr -d ' ')
  ok "audit score=$SCORE, id:n=$COUNT"
  FIRST_IDS=$(grep -o '"id":"[^"]*"' <<<"$HBODY" | head -3 | cut -d'"' -f4 | paste -sd, -)
  R=$(req POST /api/health/fix "{\"projectId\":\"$PID\",\"issueIds\":[\"$FIRST_IDS\"]}")
  FC=$(code_of "$R")
  if [ "$FC" = "200" ] || [ "$FC" = "422" ]; then ok "fix svarar $FC"; else bad "fix: $FC $(body_of "$R")"; fi
  R=$(req GET "/api/health/audit?projectId=$PID")
  [ "$(code_of "$R")" = "200" ] && ok "senaste rapport sparas" || bad "hämta rapport: $(code_of "$R")"
else
  bad "audit: $HCODE $HBODY"
fi

say "== 7. AI (offline-fallback utan nycklar) =="
R=$(req POST /api/ai/theme '{"prompt":"lyxig smyckesbutik i guld","locale":"sv"}')
[ "$(code_of "$R")" = "200" ] && ok "ai/theme" || bad "ai/theme: $(code_of "$R") $(body_of "$R")"
R=$(req POST /api/ai/copy '{"kind":"hero","shop":"Keramik","industry":"home","tone":"varm","locale":"sv"}')
[ "$(code_of "$R")" = "200" ] && ok "ai/copy" || bad "ai/copy: $(code_of "$R") $(body_of "$R")"
R=$(req POST /api/ai/insights "{\"projectId\":\"$PID\"}")
IC=$(code_of "$R")
if [ "$IC" = "200" ] || [ "$IC" = "503" ]; then ok "ai/insights svarar $IC"; else bad "ai/insights: $IC $(body_of "$R")"; fi
R=$(req POST /api/brand/extract '{"url":"https://example.com"}')
BC=$(code_of "$R")
if [ "$BC" = "200" ] || [ "$BC" = "422" ] || [ "$BC" = "502" ]; then ok "brand/extract svarar $BC"; else bad "brand/extract: $BC $(body_of "$R")"; fi
R=$(req POST /api/ai/image '{"prompt":"keramikskål på träbord","kind":"hero"}')
[ "$(code_of "$R")" = "501" ] || [ "$(code_of "$R")" = "200" ] || [ "$(code_of "$R")" = "503" ] && ok "ai/image svarar $(code_of "$R")" || bad "ai/image: $(code_of "$R") $(body_of "$R")"

say "== 8. Statistik och Shopify utan koppling =="
R=$(req GET "/api/analytics/shopify?projectId=$PID")
AC=$(code_of "$R")
[ "$AC" = "409" ] || [ "$AC" = "200" ] && ok "analytics svarar $AC" || bad "analytics: $AC $(body_of "$R")"
R=$(req GET "/api/projects/$PID/publish")
[ "$(code_of "$R")" = "501" ] || [ "$(code_of "$R")" = "409" ] && ok "publish-status svarar $(code_of "$R")" || bad "publish GET: $(code_of "$R") $(body_of "$R")"
R=$(req POST "/api/projects/$PID/publish" '{}')
[ "$(code_of "$R")" = "501" ] || [ "$(code_of "$R")" = "409" ] && ok "publish POST svarar $(code_of "$R")" || bad "publish POST: $(code_of "$R") $(body_of "$R")"

say "== 9. Kontakt och värvning =="
R=$(req POST /api/contact '{"name":"Audit","email":"audit@example.com","subject":"Hej","message":"Detta är ett testmeddelande från granskningen.","locale":"sv"}')
[ "$(code_of "$R")" = "200" ] && ok "kontaktformulär" || bad "kontakt: $(code_of "$R") $(body_of "$R")"
R=$(req GET "/api/referral/check?code=NOPE")
[ "$(code_of "$R")" = "200" ] && ok "värvningskod kontrolleras" || bad "referral: $(code_of "$R")"

say "== 10. Städning =="
R=$(req DELETE "/api/projects/$PID")
[ "$(code_of "$R")" = "200" ] && ok "radera projekt" || bad "radera: $(code_of "$R")"
R=$(req GET "/api/projects/$PID")
[ "$(code_of "$R")" = "404" ] && ok "projektet är borta" || bad "raderat projekt svarar $(code_of "$R")"
R=$(req POST /api/auth/logout)
[ "$(code_of "$R")" = "200" ] && ok "logga ut" || bad "logout: $(code_of "$R")"
R=$(req GET /api/projects)
[ "$(code_of "$R")" = "401" ] && ok "sessionen är stängd" || bad "efter logout: $(code_of "$R")"

say ""
say "RESULTAT: $pass ok, $fail misslyckade   (konto: $EMAIL)"
rm -f "$JAR"
exit "$fail"
