<#
.SYNOPSIS
Skapar ett eget kodsigneringscertifikat för lokal testning av Windows-installeraren.

.DESCRIPTION
Ett self-signed certifikat tar bort varningen på den dator där certifikatet är betrott, men det
gör INTE att andra användare slipper SmartScreen: deras datorer litar inte på din egen nyckel.
För en publik release krävs ett riktigt OV/EV-kodsigneringscertifikat (eller en signeringstjänst)
och, för nya certifikat, lite nedladdningshistorik innan SmartScreen slutar varna.

Skriptet skriver en .pfx och kan med -TrustLocal lägga certifikatet i datorns betrodda rot
(kräver administratörsrättigheter).

.EXAMPLE
./scripts/new-windows-cert.ps1 -TrustLocal
./scripts/windows-sign.ps1 -Path ./Freevobe_0.4.0_x64-setup.exe -PfxPath ./freevobe-selfsigned.pfx -PfxPassword freevobe
#>
param(
  [string]$Subject = 'CN=Freevobe (egen signering)',
  [string]$PfxOut = (Join-Path (Get-Location) 'freevobe-selfsigned.pfx'),
  [string]$Password = 'freevobe',
  [switch]$TrustLocal
)

$ErrorActionPreference = 'Stop'

$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject $Subject `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -KeyUsage DigitalSignature `
  -KeyExportPolicy Exportable `
  -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3', '2.5.29.19={text}')

$secure = ConvertTo-SecureString -String $Password -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath $PfxOut -Password $secure | Out-Null

Write-Host "Certifikat skapat: $($cert.Thumbprint)"
Write-Host "PFX: $PfxOut (lösenord: $Password)"
Write-Host "Signera med: ./scripts/windows-sign.ps1 -Path <fil> -PfxPath '$PfxOut' -PfxPassword '$Password'"

if ($TrustLocal) {
  Import-Certificate -FilePath (Join-Path $env:TEMP 'freevobe-selfsigned.cer') -CertStoreLocation 'Cert:\LocalMachine\Root' -ErrorAction SilentlyContinue | Out-Null
  $cer = Join-Path $env:TEMP 'freevobe-selfsigned.cer'
  Export-Certificate -Cert $cert -FilePath $cer | Out-Null
  Import-Certificate -FilePath $cer -CertStoreLocation 'Cert:\LocalMachine\Root' | Out-Null
  Write-Host 'Certifikatet är betrott på den här datorn. Andra datorer varnar fortfarande.'
}
