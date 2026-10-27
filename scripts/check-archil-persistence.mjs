// Skriver en fil på Archil-disken i en exec och läser tillbaka den i en ny exec.
// Bevisar att filer ligger kvar mellan körningar (varje exec är en färsk container).
//
// Körs med:  npm run check:archil
// Kräver ARCHIL_API_KEY (API-nyckel, börjar med "key-") i .env.local.
// Använder disken i ARCHIL_DISK_ID, eller skapar en ny disk om variabeln är tom.
import { randomBytes } from "node:crypto";
import {
  archilRegion,
  createDisk,
  getDisk,
  readFile,
  runOnDisk,
  writeFile,
} from "../src/server/archil.ts";

if (!process.env.ARCHIL_API_KEY?.trim()) {
  console.error(
    "ARCHIL_API_KEY saknas.\n" +
      "Skapa en API-nyckel (börjar med \"key-\") på https://console.archil.com/api-keys\n" +
      "och lägg den i .env.local som ARCHIL_API_KEY=key-…",
  );
  process.exit(1);
}

const region = archilRegion();
console.log(`Region: ${region}`);

// 1. Disken: den som ARCHIL_DISK_ID pekar på, annars en ny (mount-token skrivs aldrig ut).
let diskId = process.env.ARCHIL_DISK_ID?.trim();
if (diskId) {
  console.log(`Använder disken ${diskId}`);
} else {
  const name = `forshems-gastgiveri-${new Date().toISOString().slice(0, 10)}-${randomBytes(3).toString("hex")}`;
  const disk = await createDisk(name);
  diskId = disk.id;
  console.log(`Skapade disken ${disk.name} (${disk.id})`);
  console.log(`Spara den som ARCHIL_DISK_ID=${disk.id} i .env.local för nästa körning.`);
}

const disk = await getDisk(diskId);
console.log(`Disk: ${disk.name} (${disk.id})`);

// 2. Unik rad i en egen katalog för just den här körningen (delad mount: nya kataloger
//    får dynamiskt ägande, så skrivningen går igenom utan "Read-only file system").
const jobDir = `check/${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(3).toString("hex")}`;
const line = `forshems-gastgiveri ${new Date().toISOString()} ${randomBytes(8).toString("hex")}`;
const quote = (value) => `'${value.replace(/'/g, `'\\''`)}'`;

const writeCommand = [
  "set -e",
  "[ -d /mnt/data ] && cd /mnt/data || true",
  `mkdir -p ${quote(jobDir)}`,
  // Skulle mounten vara låst: be om ägande av katalogen och försök igen.
  `if ! printf '%s\\n' ${quote(line)} > ${quote(`${jobDir}/nonce.txt`)} 2>/dev/null; then`,
  `  command -v archil >/dev/null 2>&1 && archil checkout ${quote(jobDir)} || true`,
  `  printf '%s\\n' ${quote(line)} > ${quote(`${jobDir}/nonce.txt`)}`,
  "fi",
  `echo "skrev ${jobDir}/nonce.txt"`,
].join("\n");

const readCommand = [
  "set -e",
  "[ -d /mnt/data ] && cd /mnt/data || true",
  `cat ${quote(`${jobDir}/nonce.txt`)}`,
].join("\n");

// 3. Exec 1: skriv till disken.
const wrote = await runOnDisk(writeCommand, diskId);
if (wrote.exitCode !== 0) {
  console.error(`Skrivningen misslyckades (exit ${wrote.exitCode}).\n${wrote.stderr || wrote.stdout}`);
  process.exit(1);
}
console.log(`Exec 1 (skriv): ${wrote.stdout.trim()}`);

// 4. Exec 2: ny container, läs tillbaka samma fil.
const read = await runOnDisk(readCommand, diskId);
if (read.exitCode !== 0) {
  console.error(`Läsningen misslyckades (exit ${read.exitCode}).\n${read.stderr || read.stdout}`);
  process.exit(1);
}
console.log(`Exec 2 (läs): ${read.stdout.trim()}`);

if (!read.stdout.includes(line)) {
  console.error("Filen gick inte att läsa tillbaka oförändrad – innehållet ligger inte kvar mellan körningarna.");
  process.exit(1);
}

// 5. Samma sak via objekt-API:t (putObject/getObject) i stället för exec.
const objectKey = `${jobDir}/via-objekt.json`;
const payload = JSON.stringify({ line, at: new Date().toISOString() });
await writeFile(objectKey, payload, diskId);
const back = await readFile(objectKey, diskId);
if (back !== payload) {
  console.error("putObject/getObject gav inte tillbaka samma innehåll.");
  process.exit(1);
}
console.log(`Objekt-API: ${objectKey} lästes tillbaka oförändrat.`);

console.log(`\nOK – disken ${disk.name} (${disk.id}) i ${region} behåller filer mellan körningar.`);
console.log(`Rad som skrevs och lästes tillbaka: ${line}`);
