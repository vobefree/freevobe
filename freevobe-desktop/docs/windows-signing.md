# Signering av Windows-installeraren

En osignerad `.exe` visar **"Windows protected your PC"** (SmartScreen) och "Unknown publisher".
Det går inte att designa bort – det är signaturen och certifikatets rykte som avgör. Det här
dokumentet beskriver hur du signerar, och vad ett eget certifikat faktiskt löser.

## Vad som krävs för en publik release

1. Ett **kodsigneringscertifikat** (OV eller EV) från en betrodd utfärdare.
2. Att certifikatet används för att signera *installeraren* och helst även `Freevobe.exe` och
   sidobinären.
3. Tålamod: ett nytt certifikat har inget rykte ännu, så SmartScreen kan varna de första
   nedladdningarna även när signaturen är giltig. EV-certifikat slipper i praktiken den
   uppbyggnadsperioden.

Release-workflowen gör redan detta när hemligheterna finns – se
[releasing.md](releasing.md#windows-authenticode). Inga kodändringar behövs:

| Hemlighet | Innehåll |
| --- | --- |
| `WINDOWS_CERTIFICATE` | `.pfx` som base64 |
| `WINDOWS_CERTIFICATE_PASSWORD` | lösenordet |

## Signera lokalt

```powershell
# Med PFX
./scripts/windows-sign.ps1 -Path .\Freevobe_0.4.0_x64-setup.exe `
  -PfxPath .\freevobe.pfx -PfxPassword (Get-Content .\pfx-password.txt)

# Med certifikat i arkivet
./scripts/windows-sign.ps1 -Path .\Freevobe_0.4.0_x64-setup.exe -Thumbprint <tumavtryck>
```

Skriptet kräver Windows SDK (`signtool.exe`), tidsstämplar med SHA-256 och avbryter om signaturen
inte blir giltig.

## Eget certifikat medan du väntar på ett riktigt

```powershell
./scripts/new-windows-cert.ps1 -TrustLocal
./scripts/windows-sign.ps1 -Path .\Freevobe_0.4.0_x64-setup.exe `
  -PfxPath .\freevobe-selfsigned.pfx -PfxPassword freevobe
```

Det tar bort varningen **på din egen dator** när certifikatet är betrott där. Andra datorer litar
inte på din nyckel och varnar fortfarande. Använd det för att testa installationsflödet, inte för
en release.

## Om användaren möter varningen

Skriv i release-anteckningarna:

> Klicka **More info → Run anyway**. Installeraren är inte signerad med ett betrott certifikat ännu,
> så Windows visar en varning första gången. Kontrollera gärna filens SHA-256 mot `SHA256SUMS.txt`
> innan du kör den.

Verifiera checksumman:

```powershell
Get-FileHash .\Freevobe_0.4.0_x64-setup.exe -Algorithm SHA256
```

## Installationsprogrammets utseende

Installeraren använder mörka, varumärkta bilder som genereras av
`scripts/generate-installer-art.py`:

- `apps/desktop/src-tauri/installer/sidebar.bmp` (164×314, NSIS-sidopanel)
- `apps/desktop/src-tauri/installer/header.bmp` (150×57, NSIS-rubrik)
- `apps/desktop/src-tauri/installer/dmg-background.png` (660×400, macOS-diskbild)

De är inkopplade i `tauri.conf.json` under `bundle.windows.nsis` och `bundle.macOS.dmg`. Kör om
skriptet och committa bilderna när profilen ändras:

```bash
python3 scripts/generate-installer-art.py
```

Sidopanelen syns på välkomst- och slutskärmen, rubrikbilden högst upp på varje sida. Stegen är
desamma som förut – Välkommen, Välj plats, Installerar, Klart – men i Freevobes mörka profil.
