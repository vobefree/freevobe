#!/usr/bin/env bash
# Betalning i dev-läge, värvning och Stripe-webhookens idempotens.
# Kräver server med ADMIN_MFA_DISABLED=1, ADMIN_EMAILS=owner-audit@example.com
# och STRIPE_WEBHOOK_SECRET=whsec_test.
set -u
BASE="${BASE:-http://127.0.0.1:3114}"
OWNER="owner-audit@example.com"
PASS="Testlosen123"
STAMP="$(date +%s)"
BUYER="billing-$STAMP@example.com"
INVITER="inviter-$STAMP@example.com"
INVITEE="invitee-$STAMP@example.com"
JAR="$(mktemp)"; OJAR="$(mktemp)"; VJAR="$(mktemp)"; IJAR="$(mktemp)"
fail=0; pass=0
ok() { pass=$((pass + 1)); echo "ok   $1"; }
bad() { fail=$((fail + 1)); echo "FAIL $1"; }
req() { local m="$1" p="$2" d="${3:-}" j="${4:-$JAR}"
  if [ -n "$d" ]; then curl -s -b "$j" -c "$j" -X "$m" -H 'Content-Type: application/json' -d "$d" -w '\n%{http_code}' "$BASE$p"
  else curl -s -b "$j" -c "$j" -X "$m" -w '\n%{http_code}' "$BASE$p"; fi; }
code_of() { printf '%s' "$1" | tail -n1; }
body_of() { printf '%s' "$1" | sed '$d'; }
payments_for() { curl -s -b "$OJAR" "$BASE/api/admin/economy" | grep -o "{[^{]*\"email\":\"$1\"[^}]*}" | wc -l | tr -d ' '; }

echo "== 0. Sessioner =="
R=$(req POST /api/auth/signup "{\"name\":\"Buyer\",\"email\":\"$BUYER\",\"password\":\"$PASS\",\"locale\":\"sv\"}" "$JAR")
[ "$(code_of "$R")" = "200" ] && ok "köparkonto" || bad "köpare: $(code_of "$R") $(body_of "$R")"
R=$(req POST /api/auth/login "{\"email\":\"$OWNER\",\"password\":\"$PASS\"}" "$OJAR"); [ "$(code_of "$R")" = "200" ] && ok "ägarsession" || bad "ägare: $(code_of "$R")"

echo "== 1. Dev-betalning =="
BEFORE=$(payments_for "$BUYER")
R=$(req POST /api/billing/checkout '{"locale":"sv"}'); [ "$(code_of "$R")" = "200" ] && grep -q '"dev":true' <<<"$(body_of "$R")" && ok "dev-checkout" || bad "dev-checkout: $(code_of "$R") $(body_of "$R")"
AFTER=$(payments_for "$BUYER")
[ "$AFTER" -gt "$BEFORE" ] && ok "betalningsrad skapad ($BEFORE -> $AFTER)" || bad "ingen betalningsrad"
curl -s -b "$OJAR" "$BASE/api/admin/economy" | grep -o "\"amountCents\":2100[^}]*" | head -1 | grep -q "SEK\|sek" && ok "belopp i lokal valuta (2100 SEK)" || bad "belopp/valuta saknas"
R=$(req GET /api/projects); [ "$(code_of "$R")" = "200" ] && ok "prenumerationen påverkar inte åtkomsten negativt" || bad "åtkomst efter köp: $(code_of "$R")"

echo "== 2. Värvning =="
R=$(req POST /api/auth/signup "{\"name\":\"Inviter\",\"email\":\"$INVITER\",\"password\":\"$PASS\",\"locale\":\"sv\"}" "$VJAR")
[ "$(code_of "$R")" = "200" ] && ok "värvarkonto" || bad "värvare: $(code_of "$R")"
R=$(req GET "/api/admin/users?q=$INVITER" "" "$OJAR"); IB=$(body_of "$R")
INVITER_ID=$(grep -o '"id":"[^"]*"' <<<"$IB" | head -1 | cut -d'"' -f4)
R=$(req GET "/api/admin/users?id=$INVITER_ID" "" "$OJAR"); DETAIL=$(body_of "$R")
TRIAL_BEFORE=$(grep -o '"trial_ends_at":"[^"]*"' <<<"$DETAIL" | cut -d'"' -f4)
REAL_CODE=$(grep -o '"referral_code":"[^"]*"' <<<"$DETAIL" | cut -d'"' -f4)
if [ -n "${REAL_CODE:-}" ]; then
  ok "värvningskod finns ($REAL_CODE)"
  R=$(req POST /api/auth/signup "{\"name\":\"Invitee\",\"email\":\"$INVITEE\",\"password\":\"$PASS\",\"locale\":\"sv\",\"ref\":\"$REAL_CODE\"}" "$IJAR")
  [ "$(code_of "$R")" = "200" ] && grep -q '"bonusDays"' <<<"$(body_of "$R")" && ok "inbjuden får bonusdagar" || bad "inbjuden: $(code_of "$R") $(body_of "$R")"
  R=$(req POST /api/billing/checkout '{"locale":"sv"}' "$IJAR")
  [ "$(code_of "$R")" = "200" ] && ok "inbjuden betalar (dev)" || bad "inbjuden betalning: $(code_of "$R")"
  R=$(req GET "/api/admin/users?id=$INVITER_ID" "" "$OJAR"); DETAIL=$(body_of "$R")
  TRIAL_AFTER=$(grep -o '"trial_ends_at":"[^"]*"' <<<"$DETAIL" | cut -d'"' -f4)
  BEFORE_S=$(date -d "$TRIAL_BEFORE" +%s 2>/dev/null || echo 0)
  AFTER_S=$(date -d "$TRIAL_AFTER" +%s 2>/dev/null || echo 0)
  if [ "$AFTER_S" -gt "$BEFORE_S" ]; then ok "värvaren fick fler dagar ($TRIAL_BEFORE -> $TRIAL_AFTER)"; else bad "värvaren fick inga dagar"; fi
else
  bad "värvningskod saknas i kontodetaljen"
fi

echo "== 3. Webhook =="
R=$(req GET "/api/admin/users?q=$BUYER" "" "$OJAR"); BB=$(body_of "$R")
BUYER_ID=$(grep -o '"id":"[^"]*"' <<<"$BB" | head -1 | cut -d'"' -f4)
[ -n "${BUYER_ID:-}" ] && ok "köpar-id hittat" || bad "köpar-id saknas"

send_event() { # json
  local payload="$1"
  node -e '
    const { createHmac } = require("node:crypto");
    const payload = process.argv[1];
    const t = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", "whsec_test").update(`${t}.${payload}`).digest("hex");
    process.stdout.write(`${t}.${sig}`);
  ' "$payload" > /tmp/stripe-sig
  curl -s -o /tmp/wh.json -w '%{http_code}' -X POST -H 'Content-Type: application/json' -H "stripe-signature: t=$(cut -d. -f1 /tmp/stripe-sig),v1=$(cut -d. -f2 /tmp/stripe-sig)" -d "$payload" "$BASE/api/billing/webhook"
}

P_BEFORE=$(payments_for "$BUYER")
C=$(send_event "{\"type\":\"checkout.session.completed\",\"data\":{\"object\":{\"id\":\"cs_test_$STAMP\",\"amount_total\":2100,\"currency\":\"sek\",\"metadata\":{\"userId\":\"$BUYER_ID\"}}}}")
[ "$C" = "200" ] && ok "checkout-event accepteras" || bad "checkout-event: $C $(cat /tmp/wh.json)"
P_AFTER=$(payments_for "$BUYER")
[ "$P_AFTER" = "$P_BEFORE" ] && ok "checkout-event bokför ingen extra rad" || bad "checkout-event skapade en rad ($P_BEFORE -> $P_AFTER)"

C=$(send_event "{\"type\":\"invoice.paid\",\"data\":{\"object\":{\"id\":\"in_test_$STAMP\",\"amount_paid\":24900,\"currency\":\"eur\",\"subscription_details\":{\"metadata\":{\"userId\":\"$BUYER_ID\"}}}}}")
[ "$C" = "200" ] && ok "faktura-event accepteras" || bad "faktura-event: $C $(cat /tmp/wh.json)"
P1=$(payments_for "$BUYER")
[ "$P1" -gt "$P_AFTER" ] && ok "fakturan bokförs ($P_AFTER -> $P1)" || bad "fakturan bokfördes inte"
C=$(send_event "{\"type\":\"invoice.paid\",\"data\":{\"object\":{\"id\":\"in_test_$STAMP\",\"amount_paid\":24900,\"currency\":\"eur\",\"subscription_details\":{\"metadata\":{\"userId\":\"$BUYER_ID\"}}}}}")
P2=$(payments_for "$BUYER")
[ "$P2" = "$P1" ] && ok "samma faktura bokförs bara en gång" || bad "dublettbokning ($P1 -> $P2)"

C=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -H 'stripe-signature: t=1,v1=deadbeef' -d '{}' "$BASE/api/billing/webhook")
[ "$C" = "400" ] && ok "ogiltig signatur avvisas" || bad "ogiltig signatur: $C"

echo "== 4. Uppsägning via webhook =="
C=$(send_event "{\"type\":\"customer.subscription.deleted\",\"data\":{\"object\":{\"id\":\"sub_$STAMP\",\"metadata\":{\"userId\":\"$BUYER_ID\"}}}}")
[ "$C" = "200" ] && ok "subscription.deleted accepteras" || bad "deleted: $C $(cat /tmp/wh.json)"

echo ""
echo "RESULTAT: $pass ok, $fail misslyckade"
rm -f "$JAR" "$OJAR" "$VJAR" "$IJAR"
exit "$fail"
