$env:RUSTFLAGS='-C target-feature=+crt-static -Z unstable-options'
cargo build --release --target=i686-pc-windows-msvc
Compress-Archive -Path .\target\i686-pc-windows-msvc\release\rg.exe -DestinationPath "ripgrep-$($args[0])-win32-ia32.zip"

cargo build --release --target=x86_64-pc-windows-msvc
Compress-Archive -Path .\target\x86_64-pc-windows-msvc\release\rg.exe -DestinationPath "ripgrep-$($args[0])-win32-x64.zip"