#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/tools.sh"
readonly DOWNLOAD_DIR="$TOOLS_ROOT/downloads"
readonly SEMGREP_CONSTRAINTS="$REPO_ROOT/security/semgrep-constraints.txt"

readonly GITLEAKS_VERSION="8.30.1"
readonly OSV_SCANNER_VERSION="2.4.0"
readonly SEMGREP_VERSION="1.177.0"

die() {
  printf 'security tool setup: %s\n' "$1" >&2
  exit 2
}

download_verified() {
  local url="$1"
  local destination="$2"
  local expected_sha256="$3"
  local temporary="$destination.download"

  curl --fail --location --silent --show-error "$url" --output "$temporary"
  printf '%s  %s\n' "$expected_sha256" "$temporary" | sha256sum --check --status || {
    rm -f -- "$temporary"
    die "checksum verification failed for $url"
  }
  mv -- "$temporary" "$destination"
}

install_gitleaks() {
  local target="$1"
  local asset sha256
  case "$target" in
    linux-x86_64)
      asset="gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz"
      sha256="551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb"
      ;;
    linux-aarch64|linux-arm64)
      asset="gitleaks_${GITLEAKS_VERSION}_linux_arm64.tar.gz"
      sha256="e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080"
      ;;
    windows-x86_64)
      asset="gitleaks_${GITLEAKS_VERSION}_windows_x64.zip"
      sha256="d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e"
      ;;
    *) die "unsupported platform for Gitleaks: $target" ;;
  esac

  local archive="$DOWNLOAD_DIR/$asset"
  download_verified \
    "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/$asset" \
    "$archive" \
    "$sha256"
  if [[ "$asset" == *.zip ]]; then
    # Git for Windows' tar cannot read zip archives; Python's zipfile can.
    "$PYTHON" -c 'import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extract("gitleaks.exe", sys.argv[2])' \
      "$archive" "$BIN_DIR"
  else
    tar -xzf "$archive" -C "$BIN_DIR" gitleaks
  fi
  chmod 0755 "$GITLEAKS"
  grep -Fq "$GITLEAKS_VERSION" <<<"$("$GITLEAKS" version)" || die "Gitleaks version verification failed"
}

install_osv_scanner() {
  local target="$1"
  local asset sha256
  case "$target" in
    linux-x86_64)
      asset="osv-scanner_linux_amd64"
      sha256="15314940c10d26af9c6649f150b8a47c1262e8fc7e17b1d1029b0e479e8ed8a0"
      ;;
    linux-aarch64|linux-arm64)
      asset="osv-scanner_linux_arm64"
      sha256="44e580752910f0ff36ec99aff59af20f65df1e859aa31e5605a8f0d055b496e9"
      ;;
    windows-x86_64)
      asset="osv-scanner_windows_amd64.exe"
      sha256="0cdd113610126d5dfd5e12ad0e0b4f3e879291ff19bb43b0c52ed2f2c2df1a37"
      ;;
    *) die "unsupported platform for OSV-Scanner: $target" ;;
  esac

  download_verified \
    "https://github.com/google/osv-scanner/releases/download/v${OSV_SCANNER_VERSION}/$asset" \
    "$OSV_SCANNER" \
    "$sha256"
  chmod 0755 "$OSV_SCANNER"
  grep -Fq "osv-scanner version: $OSV_SCANNER_VERSION" <<<"$("$OSV_SCANNER" --version)" || die "OSV-Scanner version verification failed"
}

install_semgrep() {
  local target="$1"
  local wheel sha256
  case "$target" in
    linux-x86_64)
      wheel="semgrep-${SEMGREP_VERSION}-cp310.cp311.cp312.cp313.cp314.py310.py311.py312.py313.py314-none-manylinux_2_34_x86_64.whl"
      sha256="32d92d0cd2e18a1495b32abfef926be0ed3c972d8cd169bffe6cbb8418e3bb5e"
      ;;
    linux-aarch64|linux-arm64)
      wheel="semgrep-${SEMGREP_VERSION}-cp310.cp311.cp312.cp313.cp314.py310.py311.py312.py313.py314-none-manylinux_2_34_aarch64.whl"
      sha256="f27725632d468fb1a0d740ce5a98e406376a88de91fc6f902fb9fb3b1d6ed4d9"
      ;;
    windows-x86_64)
      wheel="semgrep-${SEMGREP_VERSION}-cp310.cp311.cp312.cp313.cp314.py310.py311.py312.py313.py314-none-win_amd64.whl"
      sha256="7778456167ed8a46d6f8aeee1ef95ec6ca1666e3c07503cc45d49d00cd4e817c"
      ;;
    *) die "unsupported platform for Semgrep: $target" ;;
  esac

  "$PYTHON" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)' || \
    die "Semgrep requires Python 3.10 or newer"
  "$PYTHON" -m venv "$SEMGREP_VENV"
  # `python -m pip` rather than a pip executable: Windows application control
  # may block pip.exe while allowing python.exe.
  local venv_python="$SEMGREP_VENV/$VENV_BIN/python$TOOL_EXE"
  PIP_CACHE_DIR="$TOOLS_ROOT/pip-cache" "$venv_python" -m pip download \
    --disable-pip-version-check \
    --no-deps \
    --only-binary=:all: \
    --dest "$DOWNLOAD_DIR" \
    "semgrep==$SEMGREP_VERSION"
  printf '%s  %s\n' "$sha256" "$DOWNLOAD_DIR/$wheel" | sha256sum --check --status || \
    die "checksum verification failed for the Semgrep wheel"
  PIP_CACHE_DIR="$TOOLS_ROOT/pip-cache" "$venv_python" -m pip install \
    --disable-pip-version-check \
    --no-input \
    --constraint "$SEMGREP_CONSTRAINTS" \
    "$DOWNLOAD_DIR/$wheel"
  grep -Fxq "$SEMGREP_VERSION" <<<"$(run_semgrep --version)" || die "Semgrep version verification failed"
}

case "$SECURITY_PLATFORM" in
  linux) readonly PYTHON="python3" ;;
  # Git for Windows: `python3` may be the Microsoft Store alias rather than an interpreter.
  windows) readonly PYTHON="python" ;;
  *) die "the pinned binary setup supports Linux and Git for Windows only" ;;
esac
command -v curl >/dev/null || die "curl is required"
command -v sha256sum >/dev/null || die "sha256sum is required"
command -v tar >/dev/null || die "tar is required"
command -v "$PYTHON" >/dev/null || die "$PYTHON is required"

readonly TARGET="$SECURITY_PLATFORM-$(uname -m)"
mkdir -p -- "$BIN_DIR" "$DOWNLOAD_DIR"
install_gitleaks "$TARGET"
install_osv_scanner "$TARGET"
install_semgrep "$TARGET"

printf 'Installed Gitleaks %s, OSV-Scanner %s, and Semgrep %s under %s\n' \
  "$GITLEAKS_VERSION" "$OSV_SCANNER_VERSION" "$SEMGREP_VERSION" "$TOOLS_ROOT"
