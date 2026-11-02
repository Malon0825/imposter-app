fn main() {
    let root =
        std::path::PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap()).join("../dist");
    let mut entries = Vec::new();
    fn visit(root: &std::path::Path, path: &std::path::Path, entries: &mut Vec<String>) {
        if !path.exists() {
            return;
        }
        for entry in std::fs::read_dir(path).expect("Read browser bundle") {
            let entry = entry.expect("Read browser asset");
            if entry.file_type().unwrap().is_dir() {
                visit(root, &entry.path(), entries);
            } else if entry.file_type().unwrap().is_file() {
                let asset = entry.path().canonicalize().unwrap();
                let name = format!(
                    "/{}",
                    entry
                        .path()
                        .strip_prefix(root)
                        .unwrap()
                        .to_string_lossy()
                        .replace('\\', "/")
                );
                entries.push(format!("({name:?}.into(), party_core::network::WebAsset::from_static(include_bytes!({asset:?})))"));
            }
        }
    }
    visit(&root, &root, &mut entries);
    entries.sort();
    let code = format!("fn bundled_web_assets() -> party_core::network::WebAssets {{ party_core::network::WebAssets::from([{}]) }}", entries.join(",\n"));
    std::fs::write(
        std::path::PathBuf::from(std::env::var("OUT_DIR").unwrap()).join("web_assets.rs"),
        code,
    )
    .unwrap();
    println!("cargo:rerun-if-changed={}", root.display());
    tauri_build::build()
}
