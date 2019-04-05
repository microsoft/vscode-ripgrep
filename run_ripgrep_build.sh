#!/bin/bash

cd ~
echo "git clone https://github.com/roblourens/ripgrep.git"
git clone https://github.com/roblourens/ripgrep.git
echo "cd ripgrep/"
cd ripgrep/
echo "cargo build --release --target=powerpc64le-unknown-linux-gnu --features 'pcre2'"
cargo build --release --target=powerpc64le-unknown-linux-gnu --features 'pcre2'
echo "strip ./target/powerpc64le-unknown-linux-gnu/release/rg"
strip ./target/powerpc64le-unknown-linux-gnu/release/rg
echo "zip -j "ripgrep-linux-ppc64le.zip" ./target/powerpc64le-unknown-linux-gnu/release/rg"
zip -j "ripgrep-linux-ppc64le.zip" ./target/powerpc64le-unknown-linux-gnu/release/rg
echo "target/powerpc64le-unknown-linux-gnu/release/rg --version"
target/powerpc64le-unknown-linux-gnu/release/rg --version

