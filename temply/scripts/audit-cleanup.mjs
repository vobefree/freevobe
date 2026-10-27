// Rensar konton, personalrader, meddelanden och loggposter som granskningens
// testskript skapade. Körs manuellt: node scripts/audit-cleanup.mjs
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(".data/temply.db");
const patterns = [
  "audit-%@example.com",
  "owner-audit%",
  "mfa%@example.com",
  "billing-%@example.com",
  "inviter-%@example.com",
  "invitee-%@example.com",
  "agency-%@example.com",
  "brand-%@example.com",
  "extra-%@example.com",
  "staff-audit-%@example.com",
  "reissue-%@example.com",
  "closed-audit%",
  "ui-audit@example.com",
  "inbox-audit@example.com",
  "kund@example.com",
  "designer-%@example.com",
];

function where(column) {
  return `(${patterns.map(() => `${column} LIKE ?`).join(" OR ")})`;
}

const count = (table, column) =>
  Number(db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE ${where(column)}`).get(...patterns).c);

console.log("Före:");
console.log("  users:", count("users", "email"));
console.log("  staff:", count("staff", "email"));
console.log("  contact_messages:", count("contact_messages", "email"));
console.log("  admin_audit:", count("admin_audit", "actor_email"));

db.exec("PRAGMA foreign_keys = ON");
const before = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
db.prepare(`DELETE FROM users WHERE ${where("email")}`).run(...patterns);
db.prepare(`DELETE FROM staff WHERE ${where("email")}`).run(...patterns);
db.prepare(`DELETE FROM contact_messages WHERE ${where("email")}`).run(...patterns);
db.prepare(`DELETE FROM admin_audit WHERE ${where("actor_email")}`).run(...patterns);

const after = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
console.log(`Rensat. users ${before} -> ${after}.`);
db.close();
