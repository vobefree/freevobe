#!/usr/bin/env node
/**
 * Skriver latest.json – filen Tauri-uppdateringen läser för att avgöra om det finns en ny version.
 *
 *   node .github/scripts/updater-json.mjs <katalog> <version> <tagg> <repo> [--merge <fil>]
 *
 * Tauri bygger de signerade filerna men inte den här listan; den måste skrivas av den som
 * publicerar releasen. Varje uppdateringsfil har en `.sig` bredvid sig, och det är *innehållet* i
 * signaturen som ska in i listan – inte en sökväg till den.
 *
 * `--merge` används när en enskild plattform byggs i efterhand (`macos-arm.yml`): då behålls de
 * andra plattformarnas poster och bara den nya skrivs om, så en efterhandsfil inte raderar
 * uppdateringarna för de andra operativsystemen.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

/**
 * Nyckel i latest.json och filnamnet den hör till, i prioritetsordning: första träffen vinner, så
 * en plattform som råkar ha två varianter i releasen får en post och inte två. Namnen sätts av
 * release-workflowen.
 */
const PLATFORMS = [
  { key: "windows-x86_64", file: /-setup\.exe$/ },
  { key: "windows-x86_64", file: /-setup\.nsis\.zip$/ },
  { key: "darwin-aarch64", file: /_aarch64\.app\.tar\.gz$/ },
  { key: "darwin-x86_64", file: /_x64\.app\.tar\.gz$/ },
  { key: "linux-x86_64", file: /_amd64\.AppImage$/ },
  { key: "linux-x86_64", file: /_amd64\.AppImage\.tar\.gz$/ },
];

function fail(message) {
  console.error(`fel: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const mergeIndex = args.indexOf("--merge");
const mergeFile = mergeIndex === -1 ? null : args[mergeIndex + 1];
const positional =
  mergeIndex === -1
    ? args
    : args.filter(
        (_, index) => index !== mergeIndex && index !== mergeIndex + 1,
      );
const [dir, version, tag, repo] = positional;

if (!dir || !version || !tag || !repo) {
  fail(
    "användning: updater-json.mjs <katalog> <version> <tagg> <repo> [--merge <fil>]",
  );
}
if (!existsSync(dir)) fail(`katalogen ${dir} finns inte.`);
if (!/^v?\d+\.\d+\.\d+/.test(version))
  fail(`versionen "${version}" ser inte ut som en version.`);

const signatures = readdirSync(dir).filter((file) => file.endsWith(".sig"));
const platforms = {};

for (const platform of PLATFORMS) {
  const sigFile = signatures.find((file) =>
    platform.file.test(file.slice(0, -".sig".length)),
  );
  if (!sigFile) continue;
  const artifact = sigFile.slice(0, -".sig".length);

  const signature = readFileSync(join(dir, sigFile), "utf8").trim();
  if (!signature) fail(`signaturen i ${sigFile} är tom.`);

  platforms[platform.key] = {
    signature,
    // Nedladdningssidan och uppdateringen hämtar samma fil; namnet är det som ligger i releasen.
    url: `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(artifact)}`,
  };
}

// Plattformar som redan finns i releasen behålls när bara en av dem byggs om.
if (mergeFile && existsSync(mergeFile)) {
  const previous = JSON.parse(readFileSync(mergeFile, "utf8"));
  for (const [key, entry] of Object.entries(previous.platforms ?? {})) {
    if (
      !platforms[key] &&
      entry &&
      typeof entry.signature === "string" &&
      typeof entry.url === "string"
    ) {
      platforms[key] = { signature: entry.signature, url: entry.url };
    }
  }
}

const keys = Object.keys(platforms).sort();
if (keys.length === 0) {
  console.warn(
    "Varning: inga signerade uppdateringsfiler hittades – latest.json skrivs inte. " +
      "Sätt TAURI_SIGNING_PRIVATE_KEY så att uppdateringen kan slås på.",
  );
  process.exit(0);
}

const upToDate = {
  version: version.replace(/^v/, ""),
  pub_date: new Date().toISOString(),
  platforms,
};
const outFile = join(dir, "latest.json");
writeFileSync(outFile, `${JSON.stringify(upToDate, null, 2)}\n`);
console.log(
  `Skrev ${resolve(outFile)} för ${upToDate.version}: ${keys.join(", ")}`,
);
