#!/usr/bin/env bash
# 构建演示文稿并以全屏放映方式打开 Chrome
# 用法: ./present.sh [起始页序号，默认 0]

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START="${1:-0}"
URL="file://${ROOT}/index.html#/${START}"

cd "$ROOT"

# ───────────────────────── 视觉层 ─────────────────────────
if [ -n "${FORCE_COLOR:-}" ] || { [ -t 1 ] && [ -z "${NO_COLOR:-}" ] && [ "${TERM:-dumb}" != "dumb" ]; }; then
  ANIM=1
else
  ANIM=0
fi

ESC=$'\033'
RESET="${ESC}[0m"
DIM="${ESC}[2m"
CY_R=72; CY_G=214; CY_B=255
VI_R=174; VI_G=132; VI_B=255
GR_R=86; GR_G=232; GR_B=172
SL_R=126; SL_G=136; SL_B=152
SPIN="⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"

rule() {
  local width=${1:-70}
  [ "$ANIM" = 1 ] || { printf '%s\n' "--------------------------------------------------------------"; return; }
  local i r g b
  for ((i = 0; i < width; i++)); do
    r=$((VI_R + (SL_R - VI_R) * i / (width > 1 ? width - 1 : 1)))
    g=$((VI_G + (SL_G - VI_G) * i / (width > 1 ? width - 1 : 1)))
    b=$((VI_B + (SL_B - VI_B) * i / (width > 1 ? width - 1 : 1)))
    printf "${ESC}[38;2;%d;%d;%dm─" "$r" "$g" "$b"
  done
  printf '%s\n' "$RESET"
}

# 逐字符渐变：grad <text> <r1 g1 b1> <r2 g2 b2>
grad() {
  local s=$1 r1=$2 g1=$3 b1=$4 r2=$5 g2=$6 b2=$7
  local n=${#s} last=$(( ${#s} > 1 ? ${#s} - 1 : 1 )) i r g b
  for ((i = 0; i < n; i++)); do
    r=$((r1 + (r2 - r1) * i / last))
    g=$((g1 + (g2 - g1) * i / last))
    b=$((b1 + (b2 - b1) * i / last))
    printf "${ESC}[38;2;%d;%d;%dm%s" "$r" "$g" "$b" "${s:i:1}"
  done
  printf '%s' "$RESET"
}

# 高光带扫过：band <text> <frame> <frames>（纯 bash 整数运算，不派生子进程）
band() {
  local s=$1 f=$2 total=$3
  local n=${#s} last=$(( ${#s} > 1 ? ${#s} - 1 : 1 )) i r g b dist hit pos
  pos=$(( -22 + f * 144 / (total > 1 ? total - 1 : 1) ))
  for ((i = 0; i < n; i++)); do
    r=$((CY_R + (VI_R - CY_R) * i / last))
    g=$((CY_G + (VI_G - CY_G) * i / last))
    b=$((CY_B + (VI_B - CY_B) * i / last))
    dist=$(( i * 100 / last - pos ))
    ((dist < 0)) && dist=$(( -dist ))
    hit=$(( 17 - dist ))
    ((hit < 0)) && hit=0
    hit=$(( hit * 90 / 17 ))
    r=$(( r + (255 - r) * hit / 100 ))
    g=$(( g + (255 - g) * hit / 100 ))
    b=$(( b + (255 - b) * hit / 100 ))
    printf "${ESC}[38;2;%d;%d;%dm%s" "$r" "$g" "$b" "${s:i:1}"
  done
  printf '%s' "$RESET"
}

shimmer() {
  local s=$1 frames=30 f
  if [ "$ANIM" = 0 ]; then printf '  %s\n' "$s"; return; fi
  for ((f = 0; f < frames; f++)); do
    printf '\r%s[K  ' "$ESC"
    band "$s" "$f" "$frames"
    sleep 0.024
  done
  printf '\r%s[K  %s\n' "$ESC" "$(grad "$s" $CY_R $CY_G $CY_B $VI_R $VI_G $VI_B)"
}

note() { printf "${ESC}[38;2;148;158;172m%s%s" "$1" "$RESET"; }

stage_ok() { # label, note, ms
  if [ "$ANIM" = 1 ]; then
    printf '\r%s[K  %s %s  %s  %s%5d ms%s\n' "$ESC" \
      "$(grad "✓" $GR_R $GR_G $GR_B $GR_R $GR_G $GR_B)" "$1" \
      "$(note "$2")" "$DIM" "${3:-0}" "$RESET"
  else
    printf '  [ok] %s  %s  (%s ms)\n' "$1" "$2" "${3:-0}"
  fi
}

stage_live() { # label, note, tick
  [ "$ANIM" = 1 ] || return 0
  printf '\r%s[K  %s %s  %s' "$ESC" \
    "$(grad "${SPIN:$(( $3 % 10 )):1}" $CY_R $CY_G $CY_B $CY_R $CY_G $CY_B)" "$1" "$(note "$2")"
}

# 生成一条带移动光点的进度条：loader <比例 0-100> <宽度>
loader() {
  local pct=$1 width=${2:-44} i filled
  filled=$((width * pct / 100))
  if [ "$ANIM" = 0 ]; then
    local bar=""
    for ((i = 0; i < width; i++)); do ((i < filled)) && bar+="#" || bar+="-"; done
    printf '[%s] %3d%%' "$bar" "$pct"
    return
  fi
  for ((i = 0; i < width; i++)); do
    if ((i < filled)); then
      local r g b
      r=$((CY_R + (VI_R - CY_R) * i / width))
      g=$((CY_G + (VI_G - CY_G) * i / width))
      b=$((CY_B + (VI_B - CY_B) * i / width))
      if ((i >= filled - 3)); then r=255; g=255; b=255; fi
      printf "${ESC}[38;2;%d;%d;%dm█" "$r" "$g" "$b"
    else
      printf '%s░%s' "$DIM" "$RESET"
    fi
  done
  printf " ${DIM}%3d%%%s" "$pct" "$RESET"
}

pause_bar() { # 放映前的停顿：进度条走满后才唤起浏览器
  local label=$1 total=${2:-1.1} steps=44 i pct
  if [ "$ANIM" = 0 ]; then sleep "$total"; return; fi
  local step
  step=$(awk -v t="$total" -v s="$steps" 'BEGIN{printf "%.4f", t/s}')
  for ((i = 0; i <= steps; i++)); do
    pct=$((100 * i / steps))
    printf '\r%s[K  %s  ' "$ESC" "$(note "$label")"
    loader "$pct" 44
    sleep "$step"
  done
  printf '\n'
}

# ───────────────────────── 流程 ─────────────────────────

printf '\n'
shimmer "◆  HTML DECK   ·   全屏放映准备"
printf '  '
rule 72
printf '\n'

echo_content_kb() { awk -v b="$1" 'BEGIN{printf "%.1f KB", b/1024}'; }

t0=$(date +%s%N)
DECK_BANNER=0 python3 "$ROOT/build.py" || { printf "  ${ESC}[38;2;255;116;132m✗${RESET} 构建失败，已中止放映\n" >&2; exit 1; }
build_ms=$(( ($(date +%s%N) - t0) / 1000000 ))
stage_ok "编译演示文稿" "单文件已就绪" "$build_ms"

# 定位浏览器
for ((i = 0; i < 5; i++)); do stage_live "定位浏览器" "查找 chrome 可执行文件" "$i"; sleep 0.085; done
if ! command -v google-chrome >/dev/null 2>&1 && ! command -v google-chrome-stable >/dev/null 2>&1; then
  printf '\r%s[K  %s 未找到 google-chrome，请先安装 Chrome\n' "$ESC" \
    "$(grad "✗" 255 116 132 255 116 132)" >&2
  exit 1
fi
CHROME="$(command -v google-chrome || command -v google-chrome-stable)"
stage_ok "定位浏览器" "$(basename "$CHROME") · $(dirname "$CHROME")" 12

# 预热放映窗口
for ((i = 0; i < 6; i++)); do stage_live "预热放映窗口" "app 模式 · 独立用户目录" "$i"; sleep 0.085; done
stage_ok "预热放映窗口" "deck-chrome-profile · 无首启引导" 9
printf '\n'

if [ "$ANIM" = 1 ]; then
  printf '  %s%s%s  %s\n' "$(grad "▸" $CY_R $CY_G $CY_B $VI_R $VI_G $VI_B)" "" "" "$(note "起始页 #/${START}")"
  printf '  %s\n\n' "$(note "F11 全屏 · S 演讲者视图 · Esc 退出放映")"
else
  printf '  起始页 #/%s\n' "$START"
fi

pause_bar "唤起浏览器" 1.3
printf '\n'

exec "$CHROME" \
  --user-data-dir="$HOME/.cache/deck-chrome-profile" \
  --no-first-run \
  --no-default-browser-check \
  --disable-features=Translate \
  --autoplay-policy=no-user-gesture-required \
  --start-fullscreen \
  --app="$URL" >/dev/null 2>&1
