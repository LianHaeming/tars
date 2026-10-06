# Sourced by bin/up and bin/whatsapp. Live checkout only (worktrees keep their own empty state):
#   live_only          exit unless this is the primary clone
#   link_state <app>   make apps/<app>/state a symlink to ~/tars/apps/<app>/state (the live data, outside git)
live_only() {
  [ "$(git -C "$TARS" rev-parse --git-dir)" = "$(git -C "$TARS" rev-parse --git-common-dir)" ] \
    || { echo "$(basename "$0") only runs from the live checkout, not a worktree" >&2; exit 1; }
}

link_state() {
  local dir="$TARS/apps/$1" live="${TARS_HOME:-$HOME/tars}/apps/$1/state"
  mkdir -p "$live" "$dir"
  if [ -L "$dir/state" ]; then
    [ "$(readlink "$dir/state")" = "$live" ] || { echo "$dir/state points somewhere else: $(readlink "$dir/state")" >&2; exit 1; }
  elif [ -e "$dir/state" ]; then
    echo "$dir/state is a real folder; move its files into $live and remove it first" >&2; exit 1
  else
    ln -s "$live" "$dir/state"
  fi
}
