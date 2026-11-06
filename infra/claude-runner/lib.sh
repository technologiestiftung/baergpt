# Helpers shared by build-golden.sh and rebuild-if-needed.sh. Requires config.sh.
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FINGERPRINT_FILE="$HOME/.config/baergpt-runner/golden.fingerprint"

# A file from $WARM_BRANCH on GitHub. Falls back to the local checkout
# (e.g. claude.yml before it is merged into $WARM_BRANCH).
repo_file() {
  curl -fsSL "https://raw.githubusercontent.com/$REPO/$WARM_BRANCH/$1" 2>/dev/null \
    || cat "$LIB_DIR/../../$1"
}

# Hash of everything that goes into the golden image.
fingerprint() {
  {
    for f in package-lock.json package.json .nvmrc .tool-versions .github/workflows/claude.yml; do
      repo_file "$f"
    done
    cat "$LIB_DIR/config.sh" "$LIB_DIR/build-golden.sh" "$LIB_DIR/golden/provision.sh"
  } | shasum -a 256 | cut -d' ' -f1
}
