import * as archil from "disk";
import type { Disk, ExecResult } from "disk";

/**
 * Archil-lagring (server-side). Filerna på disken finns kvar mellan körningar,
 * till skillnad från databastabellerna som är tänkta för inklockningen.
 *
 * Används bara i serverkod (route handlers, RSC eller skript) – nyckeln är en
 * hemlighet och får aldrig nå webbläsaren.
 *
 * Miljövariabler:
 *   ARCHIL_API_KEY  API-nyckel från https://console.archil.com/api-keys (börjar med "key-")
 *   ARCHIL_REGION   regionen nyckeln är skapad i, standard aws-us-east-1
 *   ARCHIL_DISK_ID  disken som ska användas (dsk-…)
 */

/** Standardregion; exec finns i aws-us-east-1, aws-us-west-2 och aws-eu-west-1. */
export const DEFAULT_REGION = "aws-us-east-1";

export function archilRegion(): string {
  return process.env.ARCHIL_REGION?.trim() || DEFAULT_REGION;
}

function apiKey(): string {
  const key = process.env.ARCHIL_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "ARCHIL_API_KEY saknas. Skapa en API-nyckel (den börjar med \"key-\") på " +
        "https://console.archil.com/api-keys och lägg den i .env.local.",
    );
  }
  if (key.startsWith("adt_")) {
    throw new Error(
      "ARCHIL_API_KEY ser ut som en disk-/mount-token (adt_…), inte en API-nyckel. " +
        "API-nyckeln börjar med \"key-\" och hämtas på https://console.archil.com/api-keys.",
    );
  }
  return key;
}

let configured = false;

/** Pekar SDK:n mot nyckeln och regionen i miljövariablerna (görs en gång per process). */
export function configureArchil(): void {
  if (configured) return;
  archil.configure({ apiKey: apiKey(), region: archilRegion() });
  configured = true;
}

function diskId(override?: string): string {
  const id = (override ?? process.env.ARCHIL_DISK_ID ?? "").trim();
  if (!id) {
    throw new Error(
      "ARCHIL_DISK_ID saknas. Skapa en disk och sätt dess id (dsk-…) i .env.local, " +
        "t.ex. genom att köra npm run check:archil.",
    );
  }
  return id;
}

/** Skapar en ny disk och returnerar den. Mount-token (engångs) lämnas medvetet tillbaka till SDK:n. */
export async function createDisk(name: string): Promise<Disk> {
  configureArchil();
  const { disk } = await archil.createDisk({ name });
  return disk;
}

/** Hämtar disken som ARCHIL_DISK_ID pekar på (eller ett givet id). */
export async function getDisk(id?: string): Promise<Disk> {
  configureArchil();
  return archil.getDisk(diskId(id));
}

/** Kör ett skal kommando i en container med disken monterad (disken är arbetskatalog). */
export async function runOnDisk(command: string, id?: string): Promise<ExecResult> {
  const disk = await getDisk(id);
  return disk.exec(command);
}

/** Skriver en fil på disken (objektnyckel, t.ex. "rapporter/2026-10.json"). */
export async function writeFile(
  key: string,
  body: string | Uint8Array | ArrayBuffer,
  id?: string,
): Promise<void> {
  const disk = await getDisk(id);
  await disk.putObject(key, body);
}

/** Läser en fil från disken som text. */
export async function readFile(key: string, id?: string): Promise<string> {
  const disk = await getDisk(id);
  const bytes = await disk.getObject(key);
  return new TextDecoder().decode(bytes);
}
