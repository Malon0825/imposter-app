# Optional local toolchain setup. Does not modify system-wide environment variables.
$imposterRoot = Split-Path -Parent $PSScriptRoot
$env:Path = "$env:USERPROFILE\.cargo\bin;" + $env:Path
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk" }
if (-not $env:JAVA_HOME -and (Test-Path 'C:\Program Files\Android\Android Studio\jbr')) { $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr' }
if (-not $env:NDK_HOME -and (Test-Path "$env:ANDROID_HOME\ndk")) { $env:NDK_HOME = (Get-ChildItem "$env:ANDROID_HOME\ndk" -Directory | Sort-Object Name -Descending | Select-Object -First 1).FullName }
if ($env:JAVA_HOME) { $env:Path = "$env:JAVA_HOME\bin;" + $env:Path }
if ($env:NDK_HOME) { $env:Path = "$env:NDK_HOME\toolchains\llvm\prebuilt\windows-x86_64\bin;" + $env:Path }
$imposterSdk = Join-Path $imposterRoot '.tools\windows-sdk'
if (Test-Path "$imposterSdk\crt\lib\x86_64") {
    $imposterLld = Join-Path $imposterRoot '.tools\lld-link.exe'
    if (-not (Test-Path $imposterLld)) {
        $imposterRustRoot = (& rustc --print sysroot).Trim()
        Copy-Item -LiteralPath "$imposterRustRoot\lib\rustlib\x86_64-pc-windows-msvc\bin\rust-lld.exe" -Destination $imposterLld
    }
    $imposterLinker = Join-Path $imposterRoot '.tools\link.cmd'
    Set-Content -LiteralPath $imposterLinker -Value ('@"' + $imposterLld + '" -flavor link %* runtimeobject.lib')
    $env:CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER = $imposterLinker
    $env:LIB = "$imposterRoot\.tools\import-libs;$imposterSdk\crt\lib\x86_64;$imposterSdk\sdk\lib\um\x86_64;$imposterSdk\sdk\lib\ucrt\x86_64"
    $env:INCLUDE = "$imposterSdk\crt\include;$imposterSdk\sdk\include\ucrt;$imposterSdk\sdk\include\um;$imposterSdk\sdk\include\shared"
    $imposterCompiler = Join-Path $imposterRoot '.tools\clang-cl.cmd'
    $imposterClang = "$env:NDK_HOME\toolchains\llvm\prebuilt\windows-x86_64\bin\clang.exe"
    Set-Content -LiteralPath $imposterCompiler -Value ('@"' + $imposterClang + '" --driver-mode=cl --target=x86_64-pc-windows-msvc %*')
    $env:CC_x86_64_pc_windows_msvc = $imposterCompiler
    $env:HOST_CC = $imposterCompiler
    $env:CXX_x86_64_pc_windows_msvc = $imposterCompiler
    $env:HOST_CXX = $imposterCompiler
    $imposterLib = Join-Path $imposterRoot '.tools\llvm-lib.exe'
    if (-not (Test-Path $imposterLib)) { Copy-Item -LiteralPath "$env:NDK_HOME\toolchains\llvm\prebuilt\windows-x86_64\bin\llvm-ar.exe" -Destination $imposterLib }
    $env:AR_x86_64_pc_windows_msvc = $imposterLib
}
