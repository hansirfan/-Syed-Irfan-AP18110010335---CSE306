#!/usr/bin/env bash
# Turn a Samsung screen recording of Spotify's Mix editor into a 9:16 Reel.
# Usage: make_reel.sh <input.mp4> <start_sec> <duration_sec> "<TITLE LINE>" "<hook line>" <output.mp4>
# Crop values assume a 1080x2340 recording with the "bars" picker closed or open;
# they keep both track headers and the waveforms and drop every other control.
set -euo pipefail
[ $# -eq 6 ] || { echo "usage: $0 input start duration title hook output" >&2; exit 1; }
in=$1; start=$2; dur=$3; title=$4; hook=$5; out=$6
font=${REEL_FONT:-/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf}
hook_secs=${REEL_HOOK_SECS:-11}   # how long the hook line stays on screen
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
printf '%s' "$title" > "$tmp/title.txt"
printf '%s' "$hook"  > "$tmp/hook.txt"
fade_out=$(awk -v d="$dur" 'BEGIN{print d-0.8}')

ffmpeg -v error -y -ss "$start" -t "$dur" -i "$in" -filter_complex "
[0:v]crop=1080:1440:0:240,scale=918:1224,fps=30[v];
color=c=0x121212:s=1080x1920:r=30[bg];
[bg][v]overlay=81:330:shortest=1,
drawtext=fontfile=$font:textfile=$tmp/title.txt:fontcolor=white:fontsize=50:x=(w-text_w)/2:y=205,
drawtext=fontfile=$font:textfile=$tmp/hook.txt:fontcolor=0x1ED760:fontsize=42:x=(w-text_w)/2:y=272:enable='lt(t,$hook_secs)',
format=yuv420p[out];
[0:a]loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=in:d=0.3,afade=t=out:st=$fade_out:d=0.8[a]" \
  -map "[out]" -map "[a]" -c:v libx264 -preset medium -crf 18 -c:a aac -b:a 192k -movflags +faststart "$out"
echo "wrote $out"
