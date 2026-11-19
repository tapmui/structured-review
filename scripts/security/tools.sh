#!/usr/bin/env bash
# Sourced by the security scripts after they set REPO_ROOT: where the pinned
# scanners live. Under Git for Windows (MSYS) the scanner builds carry .exe and
# a Python venv keeps its programs in Scripts/ instead of bin/.

case "$(uname -s)" in
  Linux) readonly SECURITY_PLATFORM="linux" TOOL_EXE="" VENV_BIN="bin" ;;
  MINGW*|MSYS*|CYGWIN*) readonly SECURITY_PLATFORM="windows" TOOL_EXE=".exe" VENV_BIN="Scripts" ;;
  *) readonly SECURITY_PLATFORM="unsupported" TOOL_EXE="" VENV_BIN="bin" ;;
esac

readonly TOOLS_ROOT="$REPO_ROOT/.tools/security"
readonly BIN_DIR="$TOOLS_ROOT/bin"
readonly GITLEAKS="$BIN_DIR/gitleaks$TOOL_EXE"
readonly OSV_SCANNER="$BIN_DIR/osv-scanner$TOOL_EXE"
readonly SEMGREP_VENV="$TOOLS_ROOT/semgrep-venv"
# The launcher pip installs; its presence marks a completed Semgrep install.
readonly SEMGREP="$SEMGREP_VENV/$VENV_BIN/semgrep$TOOL_EXE"

# Windows application control can block the launcher programs pip generates
# per venv (semgrep.exe and the pysemgrep.exe it falls back to). The venv's
# python.exe is a stock interpreter, so on Windows Semgrep's entry point runs
# through it, with --legacy keeping the Python CLI in-process.
run_semgrep() {
  if [[ "$SECURITY_PLATFORM" == "windows" ]]; then
    "$SEMGREP_VENV/Scripts/python.exe" -c \
      'import sys; from semgrep.console_scripts.entrypoint import main; sys.argv[0] = "semgrep"; sys.exit(main())' \
      --legacy "$@"
  else
    "$SEMGREP" "$@"
  fi
}
