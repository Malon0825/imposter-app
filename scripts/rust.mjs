import { existsSync, copyFileSync, writeFileSync } from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env };
let cargo = "cargo";
if (process.platform === "win32") {
  const cargoDir = path.join(env.USERPROFILE, ".cargo", "bin");
  cargo = path.join(cargoDir, "cargo.exe");
  env.Path = cargoDir + ";" + env.Path;
  env.ANDROID_HOME ||= path.join(env.LOCALAPPDATA, "Android", "Sdk");
  env.JAVA_HOME ||= "C:\\Program Files\\Android\\Android Studio\\jbr";
  env.NDK_HOME ||= path.join(env.ANDROID_HOME, "ndk", "29.0.13846066");
  const bin = path.join(
    env.NDK_HOME,
    "toolchains",
    "llvm",
    "prebuilt",
    "windows-x86_64",
    "bin",
  );
  env.Path = bin + ";" + path.join(env.JAVA_HOME, "bin") + ";" + env.Path;
  const sdk = path.join(root, ".tools", "windows-sdk");
  if (existsSync(path.join(sdk, "crt", "lib", "x86_64"))) {
    const tool = path.join(root, ".tools");
    const lld = path.join(tool, "lld-link.exe");
    if (!existsSync(lld)) {
      const sys = execFileSync(
        path.join(cargoDir, "rustc.exe"),
        ["--print", "sysroot"],
        { encoding: "utf8" },
      ).trim();
      copyFileSync(
        path.join(
          sys,
          "lib",
          "rustlib",
          "x86_64-pc-windows-msvc",
          "bin",
          "rust-lld.exe",
        ),
        lld,
      );
    }
    const link = path.join(tool, "link.cmd");
    writeFileSync(link, `@"${lld}" -flavor link %* runtimeobject.lib\r\n`);
    const cc = path.join(tool, "clang-cl.cmd");
    writeFileSync(
      cc,
      `@"${path.join(bin, "clang.exe")}" --driver-mode=cl --target=x86_64-pc-windows-msvc %*\r\n`,
    );
    const ar = path.join(tool, "llvm-lib.exe");
    if (!existsSync(ar)) copyFileSync(path.join(bin, "llvm-ar.exe"), ar);
    env.CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER = link;
    env.LIB = [
      path.join(tool, "import-libs"),
      path.join(sdk, "crt", "lib", "x86_64"),
      path.join(sdk, "sdk", "lib", "um", "x86_64"),
      path.join(sdk, "sdk", "lib", "ucrt", "x86_64"),
    ].join(";");
    env.INCLUDE = [
      "crt/include",
      "sdk/include/ucrt",
      "sdk/include/um",
      "sdk/include/shared",
    ]
      .map((p) => path.join(sdk, p))
      .join(";");
    env.CC_x86_64_pc_windows_msvc = cc;
    env.CXX_x86_64_pc_windows_msvc = cc;
    env.HOST_CC = cc;
    env.HOST_CXX = cc;
    env.AR_x86_64_pc_windows_msvc = ar;
  }
}
const args = process.argv.slice(2);
const tauri = args[0] === "tauri";
const command = tauri ? process.execPath : cargo;
const child = spawn(
  command,
  tauri
    ? [
        path.join(root, "node_modules", "@tauri-apps", "cli", "tauri.js"),
        ...args.slice(1),
      ]
    : args,
  { cwd: root, env, stdio: "inherit" },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
