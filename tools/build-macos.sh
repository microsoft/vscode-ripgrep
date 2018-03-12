cargo build --release
strip ./target/release/rg

zip -j "ripgrep-$1-darwin-x64.zip" ./target/release/rg