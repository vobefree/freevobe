<#
.SYNOPSIS
Signerar Freevobe-installeraren med Authenticode.

.DESCRIPTION
Används när bygget sker utanför release-workflowen, eller för att signera om en fil lokalt.
Certifikatet kan anges som en .pfx (med lösenord) eller som tumavtrycket för ett certifikat som
redan finns i certifikatarkivet. Skriptet vägrar lämna en osignerad fil utan att säga till.

.EXAMPLE
./scripts/windows-sign.ps1 -Path target/release/bundle/nsis/Freevobe_0.4.0_x64-setup.exe `
  -PfxPath ./freevobe.pfx -PfxPassword (Get-Content ./pfx-password.txt)

.EXAMPLE
./scripts/windows-sign.ps1 -Path ./Freevobe_0.4.0_x64-setup.exe -Thumbprint ABC123...
#>
param(
  [Parameter(Mandatory = $true)][string[]]$Path,
  [string]$PfxPath = $env:FREEVOBE_WINDOWS_PFX,
  [string]$PfxPassword = $env:FREEVOBE_WINDOWS_PFX_PASSWORD,
  [string]$Thumbprint = $env:FREEVOBE_WINDOWS_CERT_THUMBPRINT,
  [string]$TimestampUrl = 'http://timestamp.digicert.com'
)

$ErrorActionPreference = 'Stop'

function Find-SignTool {
  $candidates = @(
    Get-Command signtool.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
    Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe" -ErrorAction SilentlyContinue |
      Sort-Object FullName -Descending | Select-Object -ExpandProperty FullName
  ) | Where-Object { $_ }
  if (-not $candidates) {
    throw 'signtool.exe hittades inte. Installera Windows SDK (Signing Tools) och kör igen.'
  }
  return $candidates[0]
}

$signtool = Find-SignTool
$missing = @($Path | Where-Object { -not (Test-Path $_) })
if ($missing.Count -gt 0) { throw "Filen finns inte: $($missing -join ', ')" }

$common = @('sign', '/fd', 'SHA256', '/tr', $TimestampUrl, '/td', 'SHA256')

if (-not [string]::IsNullOrWhiteSpace($PfxPath)) {
  if (-not (Test-Path $PfxPath)) { throw "PFX-filen finns inte: $PfxPath" }
  if ([string]::IsNullOrWhiteSpace($PfxPassword)) {
    throw 'PfxPassword saknas. Ett PFX utan lösenord får inte användas i ett releasebygge.'
  }
  & $signtool @common /f $PfxPath /p $PfxPassword @Path
} elseif (-not [string]::IsNullOrWhiteSpace($Thumbprint)) {
  & $signtool @common /sha1 $Thumbprint @Path
} else {
  throw 'Ange -PfxPath (med -PfxPassword) eller -Thumbprint. Skapa ett eget certifikat med scripts/new-windows-cert.ps1 om du saknar ett.'
}

if ($LASTEXITCODE -ne 0) { throw "signtool misslyckades med kod $LASTEXITCODE." }

foreach ($file in $Path) {
  $signature = Get-AuthenticodeSignature $file
  if ($signature.Status -ne 'Valid') {
    throw "Signaturen för $file är inte giltig: $($signature.Status) – $($signature.StatusMessage)"
  }
  Write-Host "$(Split-Path -Leaf $file): giltig signatur av $($signature.SignerCertificate.Subject)"
}
