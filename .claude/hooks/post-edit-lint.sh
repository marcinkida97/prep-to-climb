#!/bin/bash
# PostToolUse hook (Write|Edit): lints the file that was just written/edited.
# Exit 2 + stderr surfaces lint errors/warnings back to Claude; exit 0 stays silent.

file_path=$(jq -r '.tool_input.file_path // empty')
[ -z "$file_path" ] && exit 0

case "$file_path" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.astro) ;;
  *) exit 0 ;;
esac

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$project_dir" || exit 0

[ -f "$file_path" ] || exit 0

if ! output=$(npx eslint --max-warnings=0 "$file_path" 2>&1); then
  echo "$output" >&2
  exit 2
fi

exit 0
