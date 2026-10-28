import { afterEach, describe, expect, it } from "vitest";
import {
  assetUrlForTag,
  DOWNLOAD_LINKS,
  RELEASE_REPO,
  RELEASE_TAG,
} from "@/config/release";
import {
  CHECKSUMS_END,
  CHECKSUMS_START,
  assetUrlFor,
  checksumFor,
  detectPlatform,
  formatFileSize,
  normalizeRelease,
  parseChecksums,
  platformForFile,
  releaseBadge,
  releaseFiles,
  stripChecksums,
  type Platform,
  type Release,
} from "./release";

const release: Release = {
  tag: "v0.2.0",
  name: "v0.2.0",
  notes: "",
  publishedAt: "2026-10-01T10:00:00Z",
  htmlUrl: "https://github.com/acme/freevobe/releases/tag/v0.2.0",
  assets: [
    {
      name: "Freevobe_0.2.0_x64-setup.exe",
      url: "https://example.test/win.exe",
      sizeBytes: 1,
      downloads: 2,
    },
    {
      name: "Freevobe_0.2.0_aarch64.dmg",
      url: "https://example.test/arm.dmg",
      sizeBytes: 1,
      downloads: 3,
    },
    {
      name: "Freevobe_0.2.0_x64.dmg",
      url: "https://example.test/intel.dmg",
      sizeBytes: 1,
      downloads: 4,
    },
    {
      name: "Freevobe_0.2.0_amd64.AppImage",
      url: "https://example.test/linux.AppImage",
      sizeBytes: 1,
      downloads: 5,
    },
    {
      name: "Freevobe-Mobile_1.0.0.apk",
      url: "https://example.test/mobile.apk",
      sizeBytes: 1,
      downloads: 6,
    },
  ],
};

describe("normalizeRelease", () => {
  it("plockar ut tagg, anteckningar och tillgångar", () => {
    const normalized = normalizeRelease({
      tag_name: "v0.1.0",
      name: "First light",
      body: "## Added\n- everything",
      published_at: "2026-09-01T00:00:00Z",
      html_url: "https://github.com/acme/freevobe/releases/tag/v0.1.0",
      assets: [
        {
          name: "a.exe",
          browser_download_url: "https://example.test/a.exe",
          size: 10,
          download_count: 1,
        },
      ],
    });

    expect(normalized).not.toBeNull();
    expect(normalized?.tag).toBe("v0.1.0");
    expect(normalized?.name).toBe("First light");
    expect(normalized?.notes).toContain("everything");
    expect(normalized?.assets).toEqual([
      {
        name: "a.exe",
        url: "https://example.test/a.exe",
        sizeBytes: 10,
        downloads: 1,
      },
    ]);
  });

  it("faller tillbaka på taggen när namnet saknas och hoppar över trasiga tillgångar", () => {
    const normalized = normalizeRelease({
      tag_name: "v9",
      assets: [{ name: "utan-url" }, null, "skräp"],
    });
    expect(normalized?.name).toBe("v9");
    expect(normalized?.assets).toEqual([]);
    expect(normalized?.htmlUrl).toContain("/releases/tag/v9");
  });

  it("ger null när svaret inte innehåller en tagg", () => {
    expect(normalizeRelease({})).toBeNull();
    expect(normalizeRelease(null)).toBeNull();
  });
});

describe("assetUrlFor", () => {
  it("väljer rätt fil per plattform ur releasen", () => {
    expect(assetUrlFor("windows", release)).toBe(
      "https://example.test/win.exe",
    );
    expect(assetUrlFor("macAppleSilicon", release)).toBe(
      "https://example.test/arm.dmg",
    );
    expect(assetUrlFor("macIntel", release)).toBe(
      "https://example.test/intel.dmg",
    );
    expect(assetUrlFor("linux", release)).toBe(
      "https://example.test/linux.AppImage",
    );
    expect(assetUrlFor("android", release)).toBe(
      "https://example.test/mobile.apk",
    );
  });

  it("hittar APK:n även när appversionen skiljer sig från releasetaggen", () => {
    // Filen döps efter mobilappens version, inte efter taggen – mönstret får inte låsa på taggen.
    const otherVersion: Release = {
      ...release,
      assets: [
        {
          name: "Freevobe-Mobile_2.4.1.apk",
          url: "https://example.test/newer.apk",
          sizeBytes: 1,
          downloads: 0,
        },
      ],
    };
    expect(assetUrlFor("android", otherVersion)).toBe(
      "https://example.test/newer.apk",
    );
  });

  it("väljer inte Intel-dmg:n till Apple Silicon (och tvärtom)", () => {
    const onlyIntel: Release = {
      ...release,
      assets: release.assets.filter((a) => a.name.includes("x64.dmg")),
    };
    expect(assetUrlFor("macIntel", onlyIntel)).toBe(
      "https://example.test/intel.dmg",
    );
    expect(assetUrlFor("macAppleSilicon", onlyIntel)).toBe(onlyIntel.htmlUrl);
  });

  it("föredrar x86_64-AppImage när releasen även har arm64", () => {
    const bothArches: Release = {
      ...release,
      assets: [
        {
          name: "Freevobe_0.2.0_arm64.AppImage",
          url: "https://example.test/arm.AppImage",
          sizeBytes: 1,
          downloads: 9,
        },
        {
          name: "Freevobe_0.2.0_amd64.AppImage",
          url: "https://example.test/x86.AppImage",
          sizeBytes: 1,
          downloads: 1,
        },
      ],
    };

    expect(assetUrlFor("linux", bothArches)).toBe(
      "https://example.test/x86.AppImage",
    );
    // Saknas x86_64 helt får arm64-filen duga i stället för att knappen pekar fel.
    const armOnly: Release = {
      ...bothArches,
      assets: bothArches.assets.slice(0, 1),
    };
    expect(assetUrlFor("linux", armOnly)).toBe(
      "https://example.test/arm.AppImage",
    );
  });

  it("använder den förväntade adressen när releasen är helt okänd", () => {
    expect(assetUrlFor("windows", null)).toBe(DOWNLOAD_LINKS.windows);
    // Känd release utan filer: releasens egen tagg används i stället för den konfigurerade.
    expect(assetUrlFor("linux", { ...release, assets: [] })).toBe(
      assetUrlForTag("linux", release.tag),
    );
  });

  it("använder en universal-dmg när releasen inte skiljer på arkitekturerna", () => {
    const universal: Release = {
      ...release,
      assets: [
        {
          name: "Freevobe-0.3.0.dmg",
          url: "https://example.test/universal.dmg",
          sizeBytes: 1,
          downloads: 0,
        },
        {
          name: "Freevobe-0.3.0.exe",
          url: "https://example.test/win.exe",
          sizeBytes: 1,
          downloads: 0,
        },
      ],
    };
    expect(assetUrlFor("macAppleSilicon", universal)).toBe(
      "https://example.test/universal.dmg",
    );
    expect(assetUrlFor("macIntel", universal)).toBe(
      "https://example.test/universal.dmg",
    );
    expect(assetUrlFor("windows", universal)).toBe(
      "https://example.test/win.exe",
    );
  });

  it("skickar till releasen i stället för en gissad fil när plattformen saknas i releasen", () => {
    const onlyArm: Release = {
      ...release,
      assets: [
        {
          name: "Freevobe_aarch64.dmg",
          url: "https://example.test/arm.dmg",
          sizeBytes: 1,
          downloads: 0,
        },
      ],
    };
    expect(assetUrlFor("macAppleSilicon", onlyArm)).toBe(
      "https://example.test/arm.dmg",
    );
    expect(assetUrlFor("macIntel", onlyArm)).toBe(onlyArm.htmlUrl);
  });

  it("använder releasens tagg i den förväntade adressen när releasen saknar tillgångar", () => {
    const tagless: Release = { ...release, tag: "v0.9.0", assets: [] };
    expect(assetUrlFor("linux", tagless)).toBe(
      assetUrlForTag("linux", "v0.9.0"),
    );
    expect(assetUrlFor("linux", tagless)).toContain("/download/v0.9.0/");
    expect(assetUrlFor("linux", tagless)).not.toContain(RELEASE_TAG + "_amd64");
  });

  it("bygger adresser från den centrala konfigurationen", () => {
    expect(DOWNLOAD_LINKS.windows).toContain(RELEASE_REPO);
    expect(DOWNLOAD_LINKS.windows).toContain(RELEASE_TAG);
    expect(DOWNLOAD_LINKS.latest.endsWith("/releases/latest")).toBe(true);
    expect(DOWNLOAD_LINKS.android).toContain(RELEASE_REPO);
    expect(DOWNLOAD_LINKS.android.endsWith(".apk")).toBe(true);
  });
});

/** 64 hextecken, som en riktig SHA-256-summa men läsbar i testet. */
const hash = (seed: string) => seed.repeat(64);

/** Exakt formen workflowen skriver: summa, två mellanslag, filnamn. */
const sumsText = [
  `${hash("a")}  Freevobe-Mobile_1.0.0.apk`,
  `${hash("b")}  Freevobe_v0.2.0_aarch64.dmg`,
  `${hash("c")}  Freevobe_v0.2.0_amd64.AppImage`,
  `${hash("d")}  Freevobe_v0.2.0_x64-setup.exe`,
].join("\n");

function notesWithChecksums(text = sumsText) {
  return [
    "## What's Changed",
    "* Sign the installers in https://example.test/pull/12",
    "",
    CHECKSUMS_START,
    "## SHA-256",
    "",
    "Checksums for every file in this release.",
    "",
    "```",
    text,
    "```",
    "",
    CHECKSUMS_END,
  ].join("\n");
}

describe("parseChecksums", () => {
  it("läser summorna ur sektionen release-workflowen skriver", () => {
    expect(parseChecksums(notesWithChecksums())).toEqual([
      { name: "Freevobe-Mobile_1.0.0.apk", sha256: hash("a") },
      { name: "Freevobe_v0.2.0_aarch64.dmg", sha256: hash("b") },
      { name: "Freevobe_v0.2.0_amd64.AppImage", sha256: hash("c") },
      { name: "Freevobe_v0.2.0_x64-setup.exe", sha256: hash("d") },
    ]);
  });

  it("hoppar över rader som inte är kontrollsummor", () => {
    const notes = [
      "* Sign the installers in https://example.test/pull/12",
      "* `sha256sum -c SHA256SUMS.txt` on macOS and Linux",
      `${"z".repeat(64)}  inte-hex.apk`,
      `${hash("e")}  Freevobe_v0.2.0_x64.dmg`,
    ].join("\n");
    expect(parseChecksums(notes)).toEqual([
      { name: "Freevobe_v0.2.0_x64.dmg", sha256: hash("e") },
    ]);
  });

  it("tolkar listrader och backticks, och sista värdet vinner", () => {
    const notes = [
      `- \`${hash("1")}  Freevobe_v0.2.0_x64.dmg\``,
      `- ${hash("2")}  Freevobe_v0.2.0_x64.dmg`,
      `${hash("3")}  *Freevobe-Mobile_1.0.0.apk`,
    ].join("\n");

    expect(parseChecksums(notes)).toEqual([
      { name: "Freevobe_v0.2.0_x64.dmg", sha256: hash("2") },
      { name: "Freevobe-Mobile_1.0.0.apk", sha256: hash("3") },
    ]);
  });

  it("ger tom lista när releasen inte har några summor", () => {
    expect(parseChecksums("")).toEqual([]);
    expect(parseChecksums("## What's Changed\n* nothing")).toEqual([]);
  });
});

describe("stripChecksums", () => {
  it("tar bort kontrollsummesektionen men behåller anteckningarna", () => {
    const stripped = stripChecksums(notesWithChecksums());
    expect(stripped).toContain("## What's Changed");
    expect(stripped).not.toContain("SHA-256");
    expect(stripped).not.toContain(hash("a"));
    expect(stripped).not.toContain(CHECKSUMS_START);
  });

  it("lämnar anteckningarna orörda när markörerna saknas", () => {
    expect(stripChecksums("## What's Changed\n* nothing")).toBe(
      "## What's Changed\n* nothing",
    );
  });
});

describe("checksumFor", () => {
  const withChecksums: Release = {
    ...release,
    notes: notesWithChecksums(),
    assets: [
      {
        name: "Freevobe_v0.2.0_x64-setup.exe",
        url: "https://example.test/Freevobe_v0.2.0_x64-setup.exe",
        sizeBytes: 1,
        downloads: 0,
      },
      {
        name: "Freevobe_v0.2.0_aarch64.dmg",
        url: "https://example.test/Freevobe_v0.2.0_aarch64.dmg",
        sizeBytes: 1,
        downloads: 0,
      },
      {
        name: "Freevobe_v0.2.0_amd64.AppImage",
        url: "https://example.test/Freevobe_v0.2.0_amd64.AppImage",
        sizeBytes: 1,
        downloads: 0,
      },
      {
        name: "Freevobe-Mobile_1.0.0.apk",
        url: "https://example.test/Freevobe-Mobile_1.0.0.apk",
        sizeBytes: 1,
        downloads: 0,
      },
    ],
  };
  const checksums = parseChecksums(withChecksums.notes);

  it("kopplar plattformens fil till rätt summa", () => {
    expect(checksumFor("windows", withChecksums, checksums)).toEqual({
      name: "Freevobe_v0.2.0_x64-setup.exe",
      sha256: hash("d"),
    });
    expect(
      checksumFor("macAppleSilicon", withChecksums, checksums)?.sha256,
    ).toBe(hash("b"));
    expect(checksumFor("linux", withChecksums, checksums)?.sha256).toBe(
      hash("c"),
    );
    expect(checksumFor("android", withChecksums, checksums)?.sha256).toBe(
      hash("a"),
    );
  });

  it("avkodar filnamn som GitHub procentkodar i adressen", () => {
    const encoded: Release = {
      ...withChecksums,
      assets: [
        {
          name: "Freevobe Mobile_1.0.0.apk",
          url: "https://example.test/Freevobe%20Mobile_1.0.0.apk",
          sizeBytes: 1,
          downloads: 0,
        },
      ],
    };
    const sums = parseChecksums(`${hash("f")}  Freevobe Mobile_1.0.0.apk`);
    expect(checksumFor("android", encoded, sums)?.sha256).toBe(hash("f"));
  });

  it("ger null när filen eller summan saknas", () => {
    // Releasen saknar Intel-dmg:n.
    expect(checksumFor("macIntel", withChecksums, checksums)).toBeNull();
    // Releasen finns, men kontrollsummorna är inte publicerade ännu.
    expect(
      checksumFor(
        "windows",
        withChecksums,
        parseChecksums("## What's Changed"),
      ),
    ).toBeNull();
    expect(checksumFor("windows", null, checksums)).toBeNull();
  });
});

describe("releaseFiles", () => {
  const withChecksums: Release = {
    ...release,
    notes: notesWithChecksums(),
    assets: [
      // Avsiktligt i "fel" ordning: listan ska sorteras efter plattform, inte efter API-svaret.
      {
        name: "SHA256SUMS.txt",
        url: "https://example.test/SHA256SUMS.txt",
        sizeBytes: 640,
        downloads: 0,
      },
      {
        name: "Freevobe-Mobile_1.0.0.apk",
        url: "https://example.test/Freevobe-Mobile_1.0.0.apk",
        sizeBytes: 2048,
        downloads: 0,
      },
      {
        name: "Freevobe_v0.2.0_amd64.AppImage",
        url: "https://example.test/Freevobe_v0.2.0_amd64.AppImage",
        sizeBytes: 4096,
        downloads: 0,
      },
      {
        name: "Freevobe_v0.2.0_x64.dmg",
        url: "https://example.test/Freevobe_v0.2.0_x64.dmg",
        sizeBytes: 1024,
        downloads: 0,
      },
      {
        name: "Freevobe_v0.2.0_aarch64.dmg",
        url: "https://example.test/Freevobe_v0.2.0_aarch64.dmg",
        sizeBytes: 1024,
        downloads: 0,
      },
      {
        name: "Freevobe_v0.2.0_x64-setup.exe",
        url: "https://example.test/Freevobe_v0.2.0_x64-setup.exe",
        sizeBytes: 512,
        downloads: 0,
      },
    ],
  };

  it("listar varje fil i releasen, även den utan plattformsknapp", () => {
    const files = releaseFiles(withChecksums);
    expect(files.map((file) => file.name)).toEqual([
      "Freevobe_v0.2.0_x64-setup.exe",
      "Freevobe_v0.2.0_aarch64.dmg",
      "Freevobe_v0.2.0_x64.dmg",
      "Freevobe_v0.2.0_amd64.AppImage",
      "Freevobe-Mobile_1.0.0.apk",
      "SHA256SUMS.txt",
    ]);
    expect(files.at(-1)?.platform).toBeNull();
    expect(files.at(-1)?.sizeBytes).toBe(640);
  });

  it("kopplar rätt summa till varje fil och lämnar luckor tomma", () => {
    const files = releaseFiles(withChecksums);
    expect(
      files.find((file) => file.name.endsWith("x64-setup.exe"))?.sha256,
    ).toBe(hash("d"));
    expect(
      files.find((file) => file.name.endsWith("aarch64.dmg"))?.sha256,
    ).toBe(hash("b"));
    expect(files.find((file) => file.name.endsWith("AppImage"))?.sha256).toBe(
      hash("c"),
    );
    expect(files.find((file) => file.name.endsWith(".apk"))?.sha256).toBe(
      hash("a"),
    );
    // Intel-dmg:n och summafilen fanns inte när kontrollsummorna skrevs.
    expect(
      files.find((file) => file.name.endsWith("x64.dmg"))?.sha256,
    ).toBeNull();
    expect(
      files.find((file) => file.name === "SHA256SUMS.txt")?.sha256,
    ).toBeNull();
  });

  it("är tom när releasen saknas och behåller filer utan summor", () => {
    expect(releaseFiles(null)).toEqual([]);
    const noSums = releaseFiles({ ...release, notes: "## What's Changed" });
    expect(noSums).toHaveLength(5);
    expect(noSums.every((file) => file.sha256 === null)).toBe(true);
  });
});

describe("platformForFile", () => {
  it.each([
    ["Freevobe_v0.1.0_x64-setup.exe", "windows"],
    ["Freevobe_v0.1.0_aarch64.dmg", "macAppleSilicon"],
    ["Freevobe_v0.1.0_x64.dmg", "macIntel"],
    ["Freevobe_v0.1.0_amd64.AppImage", "linux"],
    ["Freevobe-Mobile_1.0.0.apk", "android"],
  ])("%s → %s", (name, platform) => {
    expect(platformForFile(name)).toBe(platform);
  });

  it("ger null för filer som inte hör till en plattform", () => {
    expect(platformForFile("SHA256SUMS.txt")).toBeNull();
    expect(platformForFile("freevobe_0.1.0_amd64.deb")).toBeNull();
  });
});

describe("formatFileSize", () => {
  it("skriver storleken med läsbar enhet", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(35_659_731)).toBe("34.0 MB");
    // Över 100 avrundas till heltal – "125 MB" är lättare att läsa än "125.0 MB".
    expect(formatFileSize(131_123_704)).toBe("125 MB");
  });

  it("visar streck när storleken är okänd", () => {
    expect(formatFileSize(0)).toBe("—");
    expect(formatFileSize(-1)).toBe("—");
    expect(formatFileSize(Number.NaN)).toBe("—");
  });
});

describe("releaseBadge", () => {
  it("visar version och releaselänk när GitHub svarar", () => {
    expect(releaseBadge({ status: "ready", release })).toEqual({
      label: "Latest release v0.2.0",
      href: release.htmlUrl,
    });
  });

  it('visar "View releases" när repot inte har några releaser', () => {
    expect(releaseBadge({ status: "missing", release: null })).toEqual({
      label: "View releases",
      href: DOWNLOAD_LINKS.all,
    });
  });

  it('visar "Latest release" utan versionsnummer när API:t inte kan nås', () => {
    expect(releaseBadge({ status: "error", release: null })).toEqual({
      label: "Latest release",
      href: DOWNLOAD_LINKS.latest,
    });
  });
});

describe("detectPlatform", () => {
  const original = globalThis.navigator;

  function stub(userAgent: string) {
    Object.defineProperty(globalThis, "navigator", {
      value: { userAgent, platform: "" },
      configurable: true,
    });
  }

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: original,
      configurable: true,
    });
  });

  const cases: Array<[string, Platform]> = [
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "windows"],
    ["Mozilla/5.0 (X11; Linux x86_64)", "linux"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "macAppleSilicon"],
    // iPhone får inget bygge (kräver Apple-konto) – släppsidan får ta över.
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", "unknown"],
    ["Mozilla/5.0 (Linux; Android 14; Pixel 8)", "android"],
    ["curl/8.0", "unknown"],
  ];

  it.each(cases)("%s → %s", (userAgent, expected) => {
    stub(userAgent);
    expect(detectPlatform()).toBe(expected);
  });
});
