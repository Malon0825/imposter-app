param([Parameter(Mandatory)][string]$UnsignedApk, [Parameter(Mandatory)][string]$Version)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/env.ps1"
$imposterBuildTools = Get-ChildItem "$env:ANDROID_HOME/build-tools" -Directory | Sort-Object Name -Descending | Where-Object { Test-Path (Join-Path $_.FullName 'apksigner.bat') } | Select-Object -First 1
if (-not $imposterBuildTools) { throw 'Install Android SDK build tools before signing.' }
$imposterRoot = Split-Path -Parent $PSScriptRoot
$imposterSigningDir = Join-Path $env:LOCALAPPDATA 'Imposter/signing'
$imposterKeyStore = $env:IMPOSTER_KEYSTORE
$imposterAlias = $env:IMPOSTER_KEY_ALIAS
$imposterPassword = $env:IMPOSTER_KEYSTORE_PASSWORD
if (-not $imposterKeyStore) { $imposterKeyStore = Join-Path $imposterSigningDir 'imposter-release.jks' }
if (-not $imposterPassword) {
    $imposterCredentialsPath = Join-Path $imposterSigningDir 'release.credential.xml'
    if (-not (Test-Path -LiteralPath $imposterCredentialsPath)) { throw 'No signing credentials. Run scripts/create-android-signing-key.ps1 once, or supply IMPOSTER_KEYSTORE, IMPOSTER_KEY_ALIAS, and IMPOSTER_KEYSTORE_PASSWORD.' }
    $imposterCredentials = Import-Clixml -LiteralPath $imposterCredentialsPath
    $imposterPassword = $imposterCredentials.GetNetworkCredential().Password
    if (-not $imposterAlias) { $imposterAlias = $imposterCredentials.UserName }
}
if (-not $imposterAlias) { $imposterAlias = 'imposter' }
if (-not (Test-Path -LiteralPath $imposterKeyStore)) { throw 'Android signing keystore is missing.' }
$imposterAligned = Join-Path (Split-Path -Parent $UnsignedApk) 'imposter-aligned.apk'
$imposterDestination = Join-Path $imposterRoot "releases/imposter-$Version-android.apk"
New-Item -ItemType Directory -Path (Split-Path -Parent $imposterDestination) -Force | Out-Null
& (Join-Path $imposterBuildTools.FullName 'zipalign.exe') -P 16 -f 4 $UnsignedApk $imposterAligned
if ($LASTEXITCODE -ne 0) { throw 'APK alignment failed.' }
$env:IMPOSTER_SIGNING_PASSWORD = $imposterPassword
try {
    & (Join-Path $imposterBuildTools.FullName 'apksigner.bat') sign --ks $imposterKeyStore --ks-key-alias $imposterAlias --ks-pass env:IMPOSTER_SIGNING_PASSWORD --key-pass env:IMPOSTER_SIGNING_PASSWORD --out $imposterDestination $imposterAligned
    if ($LASTEXITCODE -ne 0) { throw 'APK signing failed.' }
    & (Join-Path $imposterBuildTools.FullName 'apksigner.bat') verify --verbose --print-certs $imposterDestination
    if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
    & (Join-Path $imposterBuildTools.FullName 'zipalign.exe') -c -P 16 4 $imposterDestination
    if ($LASTEXITCODE -ne 0) { throw 'Signed APK alignment verification failed.' }
    $imposterHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $imposterDestination).Hash.ToLowerInvariant()
    [IO.File]::WriteAllText("$imposterDestination.sha256", "$imposterHash  $([IO.Path]::GetFileName($imposterDestination))`n")
    Write-Output "Ready: $imposterDestination"
} finally { Remove-Item Env:IMPOSTER_SIGNING_PASSWORD -ErrorAction SilentlyContinue }
