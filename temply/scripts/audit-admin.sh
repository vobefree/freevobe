#!/usr/bin/env bash
# Adminpanelens API:er och personalflödet. Kräver server med ADMIN_MFA_DISABLED=1
# och ADMIN_EMAILS=owner-audit@example.com.
set -u
BASE="${BASE:-http://127.0.0.1:3111}"
OWNER="owner-audit@example.com"
STAFF="staff-audit-$RANDOM@example.com"
PASS="Testlosen123"
JAR="$(mktemp)"
SJAR="$(mktemp)"
fail=0; pass=0

ok() { pass=$((pass + 1)); echo "ok   $1"; }
bad() { fail=$((fail + 1)); echo "FAIL $1"; }

req() { local m="$1" p="$2" d="${3:-}" j="${4:-$JAR}"
  if [ -n "$d" ]; then curl -s -b "$j" -c "$j" -X "$m" -H 'Content-Type: application/json' -d "$d" -w '\n%{http_code}' "$BASE$p"
  else curl -s -b "$j" -c "$j" -X "$m" -w '\n%{http_code}' "$BASE$p"; fi; }
code_of() { printf '%s' "$1" | tail -n1; }
body_of() { printf '%s' "$1" | sed '$d'; }

echo "== 0. Konto för ägaren =="
R=$(req POST /api/auth/signup "{\"name\":\"Owner\",\"email\":\"$OWNER\",\"password\":\"$PASS\",\"locale\":\"sv\"}" "$JAR")
C=$(code_of "$R")
if [ "$C" = "409" ]; then
  R=$(req POST /api/auth/login "{\"email\":\"$OWNER\",\"password\":\"$PASS\"}" "$JAR")
  C=$(code_of "$R")
fi
[ "$C" = "200" ] && ok "ägarsession ($C)" || bad "ägarsession: $C $(body_of "$R")"

echo "== 1. Panel och översikt =="
CODE=$(curl -s -b "$JAR" -o /tmp/adm.html -w '%{http_code}' "$BASE/sv/admin")
[ "$CODE" = "200" ] && grep -q "Control" /tmp/adm.html && ok "panelen renderar" || bad "panel: $CODE"
R=$(req GET /api/admin/overview); [ "$(code_of "$R")" = "200" ] && ok "overview" || bad "overview: $(code_of "$R") $(body_of "$R")"
R=$(req GET /api/admin/system); SY=$(code_of "$R"); [ "$SY" = "200" ] && ok "systemstatus" || bad "system: $SY $(body_of "$R")"
R=$(req GET /api/admin/projects); [ "$(code_of "$R")" = "200" ] && ok "projektlista" || bad "projekt: $(code_of "$R")"
R=$(req GET /api/admin/audit); [ "$(code_of "$R")" = "200" ] && grep -q "admin.login\|signup\|staff" <<<"$(body_of "$R")" && ok "granskningslogg har poster" || bad "audit: $(code_of "$R")"

echo "== 2. Ekonomi och bokföring =="
R=$(req GET /api/admin/economy); [ "$(code_of "$R")" = "200" ] && grep -q '"report"' <<<"$(body_of "$R")" && ok "ekonomirapport" || bad "ekonomi: $(code_of "$R")"
curl -s -b "$JAR" -o /tmp/eco.csv -w '%{http_code} %{content_type}\n' "$BASE/api/admin/economy?format=csv" > /tmp/eco.txt
[ "$(cut -d' ' -f1 /tmp/eco.txt)" = "200" ] && [ "$(wc -l < /tmp/eco.csv)" -ge 1 ] && ok "betalnings-CSV" || bad "betalnings-CSV: $(cat /tmp/eco.txt)"
for f in sie4 verifikat underlag moms; do
  curl -s -b "$JAR" -o "/tmp/acc-$f" -w '%{http_code}\n' "$BASE/api/admin/economy/accounting?format=$f" > /tmp/acc-code
  [ "$(cat /tmp/acc-code)" = "200" ] && [ -s "/tmp/acc-$f" ] && ok "bokföring $f ($(wc -c <"/tmp/acc-$f" | tr -d ' ') byte)" || bad "bokföring $f"
done
R=$(req GET /api/admin/economy/accounting); [ "$(code_of "$R")" = "200" ] && grep -q '"period"' <<<"$(body_of "$R")" && ok "bokföring JSON" || bad "bokföring JSON: $(code_of "$R")"

echo "== 3. Innehållseditorn =="
R=$(req GET /api/admin/content?locale=sv); CB=$(body_of "$R")
KEY=$(grep -o '"key":"[^"]*"' <<<"$CB" | head -1 | cut -d'"' -f4)
if [ -n "${KEY:-}" ] && [ "$(code_of "$R")" = "200" ]; then
  ok "innehållsposter listas (första nyckel: $KEY)"
  R=$(req POST /api/admin/content "{\"action\":\"save\",\"locale\":\"sv\",\"values\":{\"$KEY\":\"AUDIT-TEXT-4711\"}}")
  [ "$(code_of "$R")" = "200" ] && ok "spara text" || bad "spara text: $(code_of "$R") $(body_of "$R")"
  CODE=$(curl -s -b "$JAR" -o /tmp/home-override.html -w '%{http_code}' "$BASE/sv")
  if grep -q "AUDIT-TEXT-4711" /tmp/home-override.html; then ok "texten syns på sajten"; else bad "texten syns inte på sajten"; fi
  R=$(req POST /api/admin/content "{\"action\":\"reset\",\"locale\":\"sv\",\"key\":\"$KEY\"}")
  [ "$(code_of "$R")" = "200" ] && ok "återställ text" || bad "återställ text: $(code_of "$R")"
  CODE=$(curl -s -b "$JAR" -o /tmp/home-reset.html -w '%{http_code}' "$BASE/sv")
  grep -q "AUDIT-TEXT-4711" /tmp/home-reset.html && bad "texten ligger kvar efter återställning" || ok "texten borta efter återställning"
  R=$(req POST /api/admin/content "{\"action\":\"copy\",\"locale\":\"en\",\"from\":\"sv\"}")
  [ "$(code_of "$R")" = "200" ] && ok "kopiera texter mellan språk" || bad "kopiera: $(code_of "$R") $(body_of "$R")"
  # Kopieringen rör bara overrides; rensa de nycklar vi skapade i engelska.
  curl -s -b "$JAR" -X POST -H 'Content-Type: application/json' -d "{\"action\":\"reset\",\"locale\":\"en\",\"key\":\"$KEY\"}" "$BASE/api/admin/content" > /dev/null
else
  bad "innehållslista: $(code_of "$R")"
fi

echo "== 4. Sajtregler =="
R=$(req POST /api/admin/system '{"flags":{"SITE_ANNOUNCEMENT":"AUDIT-ANNOUNCEMENT-92"}}')
[ "$(code_of "$R")" = "200" ] && ok "spara meddelande" || bad "spara meddelande: $(code_of "$R") $(body_of "$R")"
CODE=$(curl -s -b "$JAR" -o /tmp/ann.html -w '%{http_code}' "$BASE/sv/dashboard")
grep -q "AUDIT-ANNOUNCEMENT-92" /tmp/ann.html && ok "meddelandet syns i dashboarden" || bad "meddelandet syns inte i dashboarden"
R=$(req POST /api/admin/system '{"flags":{"SITE_ANNOUNCEMENT":""}}'); [ "$(code_of "$R")" = "200" ] && ok "ta bort meddelande" || bad "ta bort meddelande: $(code_of "$R")"
R=$(req POST /api/admin/system '{"flags":{"SITE_SIGNUPS":"0"}}'); [ "$(code_of "$R")" = "200" ] && ok "stäng registrering" || bad "stäng registrering: $(code_of "$R")"
R=$(req POST /api/auth/signup '{"name":"Stangd","email":"closed-audit@example.com","password":"Testlosen123"}' "$SJAR")
[ "$(code_of "$R")" = "403" ] && ok "registrering blockeras" || bad "registrering borde blockeras: $(code_of "$R")"
R=$(req POST /api/admin/system '{"flags":{"SITE_SIGNUPS":"1"}}'); [ "$(code_of "$R")" = "200" ] && ok "öppna registrering igen" || bad "öppna registrering: $(code_of "$R")"

echo "== 5. Nycklar =="
R=$(req GET /api/admin/keys); [ "$(code_of "$R")" = "200" ] && grep -q '"settings"' <<<"$(body_of "$R")" && ok "nyckellista" || bad "nycklar: $(code_of "$R")"
R=$(req POST /api/admin/keys '{"values":{"SITE_SUPPORT_EMAIL":"audit@example.com"}}')
[ "$(code_of "$R")" = "200" ] && ok "spara inställning" || bad "spara inställning: $(code_of "$R") $(body_of "$R")"
R=$(req POST /api/admin/keys '{"values":{}}'); [ "$(code_of "$R")" = "400" ] && ok "tom sparning avvisas" || bad "tom sparning: $(code_of "$R")"

echo "== 6. Personal och roller =="
R=$(req POST /api/admin/roles '{"label":"Auditroll","description":"Test","permissions":["overview.view","projects.view"]}')
RC=$(code_of "$R"); SLUG=$(body_of "$R" | grep -o '"slug":"[^"]*"' | head -1 | cut -d'"' -f4)
[ "$RC" = "200" ] && [ -n "${SLUG:-}" ] && ok "skapa roll $SLUG" || bad "skapa roll: $RC $(body_of "$R")"
R=$(req POST /api/admin/roles '{"label":"Tomroll","permissions":[]}')
EMPTY_SLUG=$(body_of "$R" | grep -o '"slug":"[^"]*"' | head -1 | cut -d'"' -f4)
[ "$(code_of "$R")" = "200" ] && ok "roll utan behörigheter kan skapas" || bad "tom roll: $(code_of "$R")"

R=$(req POST /api/admin/staff "{\"email\":\"$STAFF\",\"name\":\"Staff Audit\",\"role\":\"support\"}")
SC=$(code_of "$R"); INVITE=$(body_of "$R" | grep -o 'http[^"]*staff/join/[a-f0-9]*' | head -1)
[ "$SC" = "200" ] && [ -n "${INVITE:-}" ] && ok "bjud in personal" || bad "bjud in: $SC $(body_of "$R")"
if [ -n "${INVITE:-}" ]; then
  TOKEN="${INVITE##*/}"
  CODE=$(curl -s -o /tmp/join.html -w '%{http_code}' "$BASE/sv/staff/join/$TOKEN")
  [ "$CODE" = "200" ] && ok "inbjudningssidan renderar" || bad "inbjudningssida: $CODE"
  R=$(req GET "/api/staff/accept?token=$TOKEN"); [ "$(code_of "$R")" = "200" ] && ok "inbjudan läses" || bad "inbjudan: $(code_of "$R")"
  R=$(req POST /api/staff/accept "{\"token\":\"$TOKEN\",\"name\":\"Staff Audit\",\"password\":\"$PASS\"}" "$SJAR")
  [ "$(code_of "$R")" = "200" ] && ok "personalen aktiverar konto" || bad "aktivera: $(code_of "$R") $(body_of "$R")"
  R=$(req GET /api/admin/overview "" "$SJAR"); [ "$(code_of "$R")" = "200" ] && ok "support ser översikten" || bad "support översikt: $(code_of "$R")"
  R=$(req GET /api/admin/keys "" "$SJAR"); [ "$(code_of "$R")" = "403" ] && ok "support nekas nycklar (403)" || bad "support nycklar: $(code_of "$R")"
  R=$(req GET /api/admin/staff "" "$SJAR"); [ "$(code_of "$R")" = "403" ] && ok "support nekas personal (403)" || bad "support personal: $(code_of "$R")"
fi

echo "== 7. Användaradministration =="
R=$(req GET "/api/admin/users?q=$STAFF"); UB=$(body_of "$R")
[ "$(code_of "$R")" = "200" ] && grep -q "$STAFF" <<<"$UB" && ok "sök användare" || bad "sök användare: $(code_of "$R")"
TARGET_ID=$(grep -o '"id":"[^"]*"' <<<"$UB" | head -1 | cut -d'"' -f4)
if [ -n "${TARGET_ID:-}" ]; then
  R=$(req PATCH /api/admin/users "{\"id\":\"$TARGET_ID\",\"extendTrialDays\":5}"); [ "$(code_of "$R")" = "200" ] && ok "förläng provperiod" || bad "förläng prov: $(code_of "$R") $(body_of "$R")"
  R=$(req PATCH /api/admin/users "{\"id\":\"$TARGET_ID\",\"disabled\":true}"); [ "$(code_of "$R")" = "200" ] && ok "stäng av konto" || bad "stäng av: $(code_of "$R")"
  R=$(req PATCH /api/admin/users "{\"id\":\"$TARGET_ID\",\"disabled\":false}"); [ "$(code_of "$R")" = "200" ] && ok "öppna konto" || bad "öppna: $(code_of "$R")"
  R=$(req PATCH /api/admin/users "{\"id\":\"$TARGET_ID\",\"staffRole\":null}"); [ "$(code_of "$R")" = "200" ] && ok "ta bort personalroll" || bad "ta bort roll: $(code_of "$R") $(body_of "$R")"
  R=$(req PATCH "/api/admin/users" "{\"id\":\"$TARGET_ID\",\"plan\":\"nonsense\"}"); [ "$(code_of "$R")" = "400" ] && ok "ogiltig plan avvisas" || bad "ogiltig plan: $(code_of "$R")"
fi

echo "== 8. Inkorg =="
curl -s -X POST -H 'Content-Type: application/json' -d '{"name":"Inbox","email":"inbox-audit@example.com","subject":"Test","message":"Meddelande för granskningen.","locale":"sv"}' "$BASE/api/contact" > /dev/null
R=$(req GET /api/admin/inbox); IB=$(body_of "$R")
[ "$(code_of "$R")" = "200" ] && grep -q "inbox-audit@example.com" <<<"$IB" && ok "inkorgen visar meddelandet" || bad "inkorg: $(code_of "$R")"
MID=$(grep -o '"id":"[^"]*"' <<<"$IB" | head -1 | cut -d'"' -f4)
if [ -n "${MID:-}" ]; then
  R=$(req PATCH /api/admin/inbox "{\"id\":\"$MID\",\"handled\":true}"); [ "$(code_of "$R")" = "200" ] && ok "markera hanterad" || bad "hanterad: $(code_of "$R")"
  R=$(req DELETE /api/admin/inbox "{\"id\":\"$MID\"}"); [ "$(code_of "$R")" = "200" ] && ok "radera meddelande" || bad "radera meddelande: $(code_of "$R")"
fi

echo "== 9. Städning =="
if [ -n "${SLUG:-}" ]; then R=$(req DELETE /api/admin/roles "{\"slug\":\"$SLUG\"}"); [ "$(code_of "$R")" = "200" ] && ok "radera testroll" || bad "radera roll: $(code_of "$R")"; fi
if [ -n "${EMPTY_SLUG:-}" ]; then R=$(req DELETE /api/admin/roles "{\"slug\":\"$EMPTY_SLUG\"}"); [ "$(code_of "$R")" = "200" ] && ok "radera tom roll" || bad "radera tom roll: $(code_of "$R")"; fi
if [ -n "${TARGET_ID:-}" ]; then R=$(req DELETE /api/admin/users "{\"id\":\"$TARGET_ID\",\"confirm\":\"$STAFF\"}"); [ "$(code_of "$R")" = "200" ] && ok "radera testkonto" || bad "radera konto: $(code_of "$R") $(body_of "$R")"; fi
R=$(req POST /api/admin/system '{"flags":{"SITE_SUPPORT_EMAIL":""}}'); [ "$(code_of "$R")" = "200" ] && ok "återställ supportadress" || bad "supportadress: $(code_of "$R")"

echo ""
echo "RESULTAT: $pass ok, $fail misslyckade"
rm -f "$JAR" "$SJAR"
exit "$fail"
