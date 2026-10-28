#!/usr/bin/env bash
# SHA-256-summan för filerna i en release.
#
# Tre lägen, alla används av workflowen:
#
#   release-checksums.sh compute <katalog>          # skriver <katalog>/SHA256SUMS.txt för alla filer där
#   release-checksums.sh add <tagg> <fil> [utdata]  # lägger till/uppdaterar en fil i releasefilen
#   release-checksums.sh body <tagg> <summefil>     # skriver in summorna i releaseanteckningarna
#
# Summorna skrivs in i anteckningarna eftersom GitHub-API:et svarar med CORS men själva
# filnedladdningen inte gör det – nedladdningssidan kan alltså läsa summorna ur releasens text men
# inte hämta SHA256SUMS.txt i webbläsaren.
set -euo pipefail

START='<!-- sha256sums:start -->'
END='<!-- sha256sums:end -->'
FILE_NAME='SHA256SUMS.txt'
# Anteckningarna skrivs på engelska: de publiceras på GitHub och läses av alla som laddar ner.
SUMMARY='Checksums for every file in this release. Compare the hash of your download before installing: `sha256sum -c SHA256SUMS.txt` on macOS and Linux, `Get-FileHash` on Windows. A mismatch means the file was altered in transit and must not be installed. The same list is attached to the release as `SHA256SUMS.txt`.'

die() {
  printf 'fel: %s\n' "$*" >&2
  exit 1
}

# sha256sum finns inte på macOS som standard; shasum gör det. Runner-OS:en skiftar mellan jobben.
hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

# Summerar varje fil i katalogen. Summefilen själv hoppas över, annars skulle den summera sig själv.
compute() {
  local dir=${1:-} file
  [ -n "$dir" ] || die 'compute behöver en katalog.'
  [ -d "$dir" ] || die "katalogen $dir finns inte."

  local files=()
  for file in "$dir"/*; do
    if [ ! -f "$file" ] || [ "$(basename "$file")" = "$FILE_NAME" ]; then
      continue
    fi
    files+=("$file")
  done
  [ "${#files[@]}" -gt 0 ] || die "inga filer att beräkna kontrollsummor för i $dir."

  local lines=() path
  for path in "${files[@]}"; do
    lines+=("$(hash_file "$path")  $(basename "$path")")
  done
  # Sorterat på filnamn: samma ordning varje gång, oavsett i vilken ordning artefakterna kom in.
  printf '%s\n' "${lines[@]}" | LC_ALL=C sort -k2 > "$dir/$FILE_NAME"
  cat "$dir/$FILE_NAME"
}

# Lägger till (eller ersätter) en fil i releasefilen. Används av macOS Intel-workflowen, som bara
# bygger en enda fil och lägger den i en release som redan är publicerad.
add() {
  local tag=${1:-} source=${2:-} output=${3:-} work name hash
  [ -n "$tag" ] && [ -n "$source" ] || die 'add behöver en tagg och en fil.'
  [ -f "$source" ] || die "filen $source finns inte."

  work=$(mktemp -d)
  if ! gh release download "$tag" --repo "$GITHUB_REPOSITORY" --pattern "$FILE_NAME" \
    --dir "$work" >/dev/null 2>&1; then
    : > "$work/$FILE_NAME"
  fi

  name=$(basename "$source")
  hash=$(hash_file "$source")
  {
    # En rad för samma fil ersätts, så en omkörning inte lämnar kvar ett gammalt värde.
    grep -vF -- "$name" "$work/$FILE_NAME" || true
    printf '%s  %s\n' "$hash" "$name"
  } | LC_ALL=C sort -k2 > "$work/merged.txt"
  mv "$work/merged.txt" "$work/$FILE_NAME"

  gh release upload "$tag" "$work/$FILE_NAME" --repo "$GITHUB_REPOSITORY" --clobber
  cat "$work/$FILE_NAME"
  # Skriver workflowen också om anteckningarna behövs filen kvar efter städningen.
  if [ -n "$output" ]; then cp "$work/$FILE_NAME" "$output"; fi
  rm -rf "$work"
}

# Skriver om kontrollsummesektionen i anteckningarna. Markörerna gör att en omkörning ersätter
# sektionen i stället för att lägga till en till, och låter nedladdningssidan skilja summorna från
# resten av anteckningarna.
body() {
  local tag=${1:-} sums=${2:-} work
  [ -n "$tag" ] && [ -n "$sums" ] || die 'body behöver en tagg och en summefil.'
  [ -s "$sums" ] || die "summefilen $sums är tom."
  grep -Eq '^[0-9a-f]{64}  .+' "$sums" || die "hittade inga kontrollsummor i $sums."

  work=$(mktemp -d)
  gh release view "$tag" --repo "$GITHUB_REPOSITORY" --json body --jq '.body // ""' > "$work/body.md"

  awk -v start="$START" -v end="$END" '
    $0 == start { skip = 1; next }
    $0 == end { skip = 0; next }
    !skip
  ' "$work/body.md" > "$work/clean.md"

  {
    cat "$work/clean.md"
    printf '\n%s\n' "$START"
    printf '## SHA-256\n\n%s\n\n' "$SUMMARY"
    printf '```\n'
    # Endast rader av rätt form: en trasig rad ska inte hamna i en kodblock som ser giltig ut.
    grep -E '^[0-9a-f]{64}  .+' "$sums"
    printf '```\n\n%s\n' "$END"
  } > "$work/new-body.md"

  gh release edit "$tag" --repo "$GITHUB_REPOSITORY" --notes-file "$work/new-body.md"
  tail -n 14 "$work/new-body.md"
  rm -rf "$work"
}

case "${1:-}" in
  compute) shift; compute "$@" ;;
  add) shift; add "$@" ;;
  body) shift; body "$@" ;;
  *) die 'användning: release-checksums.sh compute <katalog> | add <tagg> <fil> | body <tagg> <summefil>' ;;
esac
