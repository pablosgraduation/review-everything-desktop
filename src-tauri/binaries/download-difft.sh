#!/usr/bin/env bash
# Downloads difftastic binaries for all supported platforms.
# Run this script from the src-tauri/binaries/ directory before building.
#
# Usage:
#   cd src-tauri/binaries
#   ./download-difft.sh [version]
#
# If no version is specified, fetches the latest release.

set -euo pipefail
cd "$(dirname "$0")"

VERSION="${1:-}"

if [ -z "$VERSION" ]; then
  echo "Fetching latest difftastic release tag..."
  VERSION=$(curl -sL "https://api.github.com/repos/Wilfred/difftastic/releases/latest" | grep '"tag_name"' | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')
  if [ -z "$VERSION" ]; then
    echo "Error: Could not determine latest version. Pass version manually, e.g.: ./download-difft.sh 0.63.0"
    exit 1
  fi
  echo "Latest version: $VERSION"
fi

BASE_URL="https://github.com/Wilfred/difftastic/releases/download/${VERSION}"

download() {
  local archive_name="$1"
  local binary_name="$2"
  local target_name="$3"
  local url="${BASE_URL}/${archive_name}"

  echo "Downloading ${archive_name}..."
  curl -sL "$url" -o "/tmp/${archive_name}"

  local tmpdir
  tmpdir=$(mktemp -d)

  if [[ "$archive_name" == *.zip ]]; then
    unzip -q "/tmp/${archive_name}" -d "$tmpdir"
  else
    tar xzf "/tmp/${archive_name}" -C "$tmpdir"
  fi

  # Find the difft binary in the extracted archive
  local found
  found=$(find "$tmpdir" -name "$binary_name" -type f | head -1)
  if [ -z "$found" ]; then
    echo "  Error: $binary_name not found in $archive_name"
    rm -rf "$tmpdir" "/tmp/${archive_name}"
    return 1
  fi

  cp "$found" "./${target_name}"
  chmod +x "./${target_name}"
  echo "  -> ${target_name}"

  rm -rf "$tmpdir" "/tmp/${archive_name}"
}

# macOS ARM (Apple Silicon)
download "difft-aarch64-apple-darwin.tar.gz" "difft" "difft-aarch64-apple-darwin"

# macOS Intel
download "difft-x86_64-apple-darwin.tar.gz" "difft" "difft-x86_64-apple-darwin"

# Linux x86_64
download "difft-x86_64-unknown-linux-gnu.tar.gz" "difft" "difft-x86_64-unknown-linux-gnu"

# Windows x86_64
download "difft-x86_64-pc-windows-msvc.zip" "difft.exe" "difft-x86_64-pc-windows-msvc.exe"

echo ""
echo "All binaries downloaded. You can now build with: cargo tauri build"
