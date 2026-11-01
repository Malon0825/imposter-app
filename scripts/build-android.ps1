param([switch]$Release)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/env.ps1"
$imposterRoot = Split-Path -Parent $PSScriptRoot
Push-Location $imposterRoot
try {
    $env:TAURI_ANDROID_PROJECT_PATH = Join-Path $imposterRoot 'src-tauri\gen\android'
    $env:WRY_ANDROID_PACKAGE = 'com.imposter.party'
    $env:TAURI_ANDROID_PACKAGE_UNESCAPED = 'com.imposter.party'
    $env:WRY_ANDROID_LIBRARY = 'imposter_app_lib'
    npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
    $imposterProfile = if ($Release) { 'release' } else { 'debug' }
    $imposterTargets = @(
        @{ Rust = 'aarch64-linux-android'; Abi = 'arm64-v8a'; Clang = 'aarch64-linux-android26-clang.cmd' },
        @{ Rust = 'x86_64-linux-android'; Abi = 'x86_64'; Clang = 'x86_64-linux-android26-clang.cmd' }
    )
    foreach ($imposterTarget in $imposterTargets) {
        $imposterEnvSuffix = $imposterTarget.Rust.Replace('-','_')
        $imposterLinker = Join-Path $env:NDK_HOME ("toolchains\llvm\prebuilt\windows-x86_64\bin\" + $imposterTarget.Clang)
        Set-Item -Path ("Env:CARGO_TARGET_" + $imposterEnvSuffix.ToUpper() + '_LINKER') -Value $imposterLinker
        Set-Item -Path ("Env:CC_" + $imposterEnvSuffix) -Value $imposterLinker
        Set-Item -Path ("Env:AR_" + $imposterEnvSuffix) -Value "$env:NDK_HOME\toolchains\llvm\prebuilt\windows-x86_64\bin\llvm-ar.exe"
        $imposterBuildArgs = @('build','-p','imposter-app','--lib','--target',$imposterTarget.Rust,'--features','tauri/custom-protocol')
        if ($Release) { $imposterBuildArgs += '--release' }
        & cargo @imposterBuildArgs
        if ($LASTEXITCODE -ne 0) { throw "Native build failed for $($imposterTarget.Rust)." }
        # A normal copy avoids requiring Windows developer-mode symbolic links.
        $imposterJni = Join-Path $imposterRoot ("src-tauri\gen\android\app\src\main\jniLibs\" + $imposterTarget.Abi)
        New-Item -ItemType Directory -Path $imposterJni -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $imposterRoot ("target\" + $imposterTarget.Rust + "\$imposterProfile\libimposter_app_lib.so")) -Destination (Join-Path $imposterJni 'libimposter_app_lib.so')
        # Keep full Rust symbols in target/, but don't distribute them in the APK.
        & "$env:NDK_HOME\toolchains\llvm\prebuilt\windows-x86_64\bin\llvm-strip.exe" --strip-unneeded (Join-Path $imposterJni 'libimposter_app_lib.so')
        if ($LASTEXITCODE -ne 0) { throw 'Could not prepare the packaged native library.' }
    }
    Set-Content -LiteralPath src-tauri/gen/android/local.properties -Value ('sdk.dir=' + $env:ANDROID_HOME.Replace('\','/'))
    $imposterPackage = Get-Content package.json -Raw | ConvertFrom-Json
    $imposterVersion = [version]$imposterPackage.version
    $imposterVersionCode = $imposterVersion.Major * 1000000 + $imposterVersion.Minor * 1000 + $imposterVersion.Build
    Set-Content -LiteralPath src-tauri/gen/android/app/tauri.properties -Value @("tauri.android.versionName=$($imposterPackage.version)","tauri.android.versionCode=$imposterVersionCode")
    $imposterVariant = if ($Release) { 'Release' } else { 'Debug' }
    # Clean the package so incremental APK archives don't retain space from old
    # unstripped development libraries. Rust's compilation cache stays intact.
    & ./src-tauri/gen/android/gradlew.bat -p src-tauri/gen/android ':app:clean' "assembleUniversal$imposterVariant" -x "rustBuildUniversal$imposterVariant" '-PabiList=arm64-v8a,x86_64' '-ParchList=arm64,x86_64' '-PtargetList=aarch64,x86_64'
    if ($LASTEXITCODE -ne 0) { throw 'Android packaging failed.' }
    New-Item -ItemType Directory -Path releases -Force | Out-Null
    if ($Release) {
        & "$PSScriptRoot/sign-android.ps1" -UnsignedApk (Join-Path $imposterRoot 'src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk') -Version $imposterPackage.version
    } else {
        $imposterApk = "releases/imposter-$($imposterPackage.version)-android-debug.apk"
        Copy-Item -LiteralPath src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk -Destination $imposterApk
        Write-Output "Ready: $imposterApk"
    }
} finally { Pop-Location }
