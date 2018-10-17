export PCRE2_SYS_STATIC=1
cargo build --release --target=x86_64-unknown-linux-musl --features 'pcre2'
strip ./target/x86_64-unknown-linux-musl/release/rg
zip -j "ripgrep-$1-linux-x64.zip" ./target/x86_64-unknown-linux-musl/release/rg

CFLAGS=-m32 cargo build --release --target=i686-unknown-linux-musl --features 'pcre2'
strip ./target/i686-unknown-linux-musl/release/rg
zip -j "ripgrep-$1-linux-ia32.zip" ./target/i686-unknown-linux-musl/release/rg

cargo build --release --target=arm-unknown-linux-gnueabihf --features 'pcre2'
arm-linux-gnueabi-strip ./target/arm-unknown-linux-gnueabihf/release/rg
zip -j "ripgrep-$1-linux-arm.zip" ./target/arm-unknown-linux-gnueabihf/release/rg

cargo build --release --target=aarch64-unknown-linux-gnu --features 'pcre2'
aarch64-linux-gnu-strip ./target/aarch64-unknown-linux-gnu/release/rg
zip -j "ripgrep-$1-linux-arm64.zip" ./target/aarch64-unknown-linux-gnu/release/rg