cargo build --release --target=x86_64-unknown-linux-musl
strip ./target/x86_64-unknown-linux-musl/release/rg
zip -j "ripgrep-$1-linux-x64.zip" ./target/x86_64-unknown-linux-musl/release/rg

export CFLAGS=-m32
cargo build --release --target=i686-unknown-linux-musl
strip ./target/i686-unknown-linux-musl/release/rg
zip -j "ripgrep-$1-linux-ia32.zip" ./target/i686-unknown-linux-musl/release/rg

cargo build --release --target=arm-unknown-linux-gnueabihf
arm-linux-gnueabi-strip ./target/arm-unknown-linux-gnueabihf/release/rg
zip -j "ripgrep-$1-linux-arm.zip" ./target/arm-unknown-linux-gnueabihf/release/rg