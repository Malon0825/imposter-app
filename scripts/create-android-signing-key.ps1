$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/env.ps1"
$imposterSigningDir = Join-Path $env:LOCALAPPDATA 'Imposter/signing'
$imposterKeyStore = Join-Path $imposterSigningDir 'imposter-release.jks'
$imposterCredentials = Join-Path $imposterSigningDir 'release.credential.xml'
if ((Test-Path -LiteralPath $imposterKeyStore) -or (Test-Path -LiteralPath $imposterCredentials)) {
    throw 'Signing material already exists. Reuse it for updates; never overwrite a published app signing key.'
}
New-Item -ItemType Directory -Path $imposterSigningDir -Force | Out-Null
$imposterRandom = [byte[]]::new(48)
$imposterRng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $imposterRng.GetBytes($imposterRandom) } finally { $imposterRng.Dispose() }
$env:IMPOSTER_SIGNING_PASSWORD = [Convert]::ToBase64String($imposterRandom)
try {
    & "$env:JAVA_HOME/bin/keytool.exe" -genkeypair -keystore $imposterKeyStore -storetype JKS -alias imposter -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Imposter' -storepass:env IMPOSTER_SIGNING_PASSWORD -keypass:env IMPOSTER_SIGNING_PASSWORD -noprompt
    if ($LASTEXITCODE -ne 0) { throw 'Android signing key creation failed.' }
    $imposterSecurePassword = ConvertTo-SecureString $env:IMPOSTER_SIGNING_PASSWORD -AsPlainText -Force
    [PSCredential]::new('imposter', $imposterSecurePassword) | Export-Clixml -LiteralPath $imposterCredentials
    Write-Output "Signing key saved outside the repository: $imposterKeyStore"
    Write-Output 'The password is encrypted for this Windows user. Back up the key and credentials securely before moving machines.'
} finally { Remove-Item Env:IMPOSTER_SIGNING_PASSWORD -ErrorAction SilentlyContinue }
