$env:RUSTFLAGS='-C target-feature=+crt-static'
$env:PCRE2_SYS_STATIC=1
cargo build --release --target=i686-pc-windows-msvc --features 'pcre2'
Compress-Archive -Update -Path .\target\i686-pc-windows-msvc\release\rg.exe -DestinationPath "ripgrep-$($args[0])-win32-ia32.zip"

cargo build --release --target=x86_64-pc-windows-msvc --features 'pcre2'
Compress-Archive -Update -Path .\target\x86_64-pc-windows-msvc\release\rg.exe -DestinationPath "ripgrep-$($args[0])-win32-x64.zip"