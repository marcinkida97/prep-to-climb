#!/bin/bash
# PostToolUse hook (Write|Edit): runs `astro check` (project-wide, Astro can't check
# a single file) and reports back only the diagnostics that mention the edited file,
# so pre-existing unrelated errors elsewhere in the repo don't spam every edit.
# Exit 2 + stderr surfaces those diagnostics to Claude; exit 0 stays silent.

file_path=$(jq -r '.tool_input.file_path // empty')
[ -z "$file_path" ] && exit 0

case "$file_path" in
  *.ts|*.tsx|*.astro) ;;
  *) exit 0 ;;
esac

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$project_dir" || exit 0

[ -f "$file_path" ] || exit 0

rel_path="${file_path#"$project_dir"/}"

output=$(npx astro check 2>&1) || true
matches=$(printf '%s\n' "$output" | grep -F -A 4 -- "$rel_path" || true)

if [ -n "$matches" ]; then
  echo "$matches" >&2
  exit 2
fi

exit 0
