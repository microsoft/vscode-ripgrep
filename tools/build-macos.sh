PCRE2_SYS_STATIC=1 cargo build --release --features 'pcre2'
strip ./target/release/rg

zip -j "ripgrep-$1-darwin-x64.zip" ./target/release/rg