#!/usr/bin/env python3
"""
build.py — 模块化 HTML 演示文稿一键编译与实时预览工具（零第三方依赖）

用法：
  python3 build.py                 # 静态编译生成纯净的 index.html 并校验本地资源
  python3 build.py --serve         # 编译 + 启动本地预览服务（保存任意文件自动刷新页面，完美支持 S 键演讲者视图）
  python3 build.py --serve -p 8800 # 指定端口启动预览服务
  python3 build.py --plain         # 关闭彩色动画，输出纯文本日志（便于重定向 / CI）
"""

from __future__ import annotations

import argparse
import hashlib
import os
import re
import shutil
import sys
import threading
import time
import unicodedata
from functools import partial
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TEMPLATE_FILE = ROOT / "template.html"
SLIDES_DIR = ROOT / "slides"
CSS_FILE = ROOT / "styles" / "custom.css"
JS_FILE = ROOT / "scripts" / "custom.js"
OUTPUT_FILE = ROOT / "index.html"

BUILD_VERSION = str(int(time.time() * 1000))
LAST_BUILD: dict[str, object] = {}

LIVE_RELOAD_SNIPPET = """
<script>
(function() {
  let ver = null;
  setInterval(async () => {
    try {
      const r = await fetch('/__build_version__', { cache: 'no-store' });
      const v = (await r.text()).trim();
      if (ver === null) ver = v;
      else if (v && v !== ver) location.reload();
    } catch (_) {}
  }, 800);
})();
</script>
"""


# ───────────────────────────── 终端视觉层 ──────────────────────────────

RESET = "\x1b[0m"
DIM = "\x1b[2m"

CYAN = (72, 214, 255)
MINT = (86, 232, 172)
VIOLET = (174, 132, 255)
AMBER = (255, 198, 92)
ROSE = (255, 116, 132)
SLATE = (126, 136, 152)
WHITE = (246, 249, 255)
NOTE = (148, 158, 172)

SPIN = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"


def _detect_color() -> bool:
    if os.environ.get("FORCE_COLOR"):
        return True
    if os.environ.get("NO_COLOR"):
        return False
    return sys.stdout.isatty() and os.environ.get("TERM", "") != "dumb"


ANIM = _detect_color()
SILENT = False


def tw() -> int:
    return shutil.get_terminal_size((92, 24)).columns


def _fg(rgb: tuple[int, int, int]) -> str:
    return f"\x1b[38;2;{rgb[0]};{rgb[1]};{rgb[2]}m"


def _mix(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    t = min(max(t, 0.0), 1.0)
    return (round(a[0] + (b[0] - a[0]) * t),
            round(a[1] + (b[1] - a[1]) * t),
            round(a[2] + (b[2] - a[2]) * t))


def dwidth(text: str) -> int:
    return sum(2 if unicodedata.east_asian_width(ch) in "WF" else 1 for ch in text)


def paint(text: str, base=(CYAN, VIOLET), band: float | None = None, glow: float = 0.9) -> str:
    """按字符做双色渐变；band 给定时叠加一条流动的高光带。"""
    if not ANIM or not text:
        return text
    span = max(len(text) - 1, 1)
    out = []
    for i, ch in enumerate(text):
        color = _mix(base[0], base[1], i / span)
        if band is not None:
            hit = 1.0 - abs(i / span - band) / 0.17
            if hit > 0:
                color = _mix(color, WHITE, hit * glow)
        out.append(_fg(color) + ch)
    return "".join(out) + RESET


def note(text: str) -> str:
    return f"{_fg(NOTE)}{text}{RESET}" if ANIM else text


def sweep(text: str, frames: int = 34, delay: float = 0.022, base=(CYAN, VIOLET)) -> None:
    """单行高光扫过，收尾定格为静态渐变。"""
    if not ANIM:
        print(text)
        return
    for f in range(frames):
        band = -0.22 + (f / max(frames - 1, 1)) * 1.44
        sys.stdout.write("\r\x1b[K" + paint(text, base, band))
        sys.stdout.flush()
        time.sleep(delay)
    sys.stdout.write("\r\x1b[K" + paint(text, base) + "\n")
    sys.stdout.flush()


def banner() -> None:
    if os.environ.get("DECK_BANNER", "1") == "0":
        return
    if not ANIM:
        print("== HTML DECK · 编译流水线 ==")
        return
    print()
    sweep("  ◆  HTML DECK   ·   多章节合成 · 离线校验 · 实时预览", base=(CYAN, VIOLET))
    width = min(tw() - 4, 74)
    print("  " + paint("─" * (width + 2), base=(VIOLET, SLATE)))
    print()


def fail(msg: str) -> None:
    if ANIM:
        print(f"  {_fg(ROSE)}✗{RESET} {msg}")
    else:
        print(f"[error] {msg}", file=sys.stderr)


def framed(title: str, rows: list[tuple[str, str]], accent=(VIOLET, CYAN)) -> None:
    """圆角信息卡：左键右值 + 点线引导。rows 为 (键, 值) 纯文本对。"""
    width = min(tw() - 4, 74)
    if not ANIM:
        print(f"[{title}]")
        for key, value in rows:
            print(f"   {key:<24} {value}")
        print()
        return
    pad = max(width - dwidth(title) - 3, 3)
    print("  " + paint("╭─ ", base=accent) + paint(title, base=accent)
          + " " + paint("─" * pad, base=(accent[1], SLATE)) + paint("╮", base=accent))
    inner = width - 2
    for key, value in rows:
        dots = max(inner - dwidth(key) - dwidth(value) - 1, 1)
        body = (paint(key, base=(SLATE, NOTE), glow=0.0)
                + f"{DIM}{'·' * dots}{RESET} "
                + paint(value, base=accent))
        print(f"  {_fg(SLATE)}│{RESET} {body} {_fg(SLATE)}│{RESET}")
    print("  " + paint("╰" + "─" * width + "╯", base=accent))
    print()


class Stage:
    """带缓冲动画的构建阶段：spinner → ✓ 标签 + 备注 + 耗时。"""

    def __init__(self, label: str) -> None:
        self.label = label
        self.note_text = ""
        self.elapsed = 0.0
        self._bar: tuple[int, int] | None = None
        self._stop = threading.Event()
        self._lock = threading.Lock()
        self._thread: threading.Thread | None = None

    def __enter__(self) -> "Stage":
        self._t0 = time.perf_counter()
        if SILENT:
            return self
        if ANIM:
            self._thread = threading.Thread(target=self._spin, daemon=True)
            self._thread.start()
        else:
            print(f"[..] {self.label}", end="", flush=True)
        return self

    def note_set(self, text: str) -> None:
        with self._lock:
            self.note_text = text

    def bar(self, current: int, total: int) -> None:
        with self._lock:
            self._bar = (current, total)

    def fill(self, total: int, duration: float = 0.62, steps: int = 18) -> None:
        if not ANIM:
            self.bar(total, total)
            return
        for k in range(steps + 1):
            self.bar(round(total * k / steps), total)
            time.sleep(duration / steps)

    def _bar_text(self, bar: tuple[int, int]) -> str:
        current, total = bar
        total = max(total, 1)
        cells = 22
        filled = round(cells * min(current, total) / total)
        if not ANIM:
            return f"[{'#' * filled}{'-' * (cells - filled)}] {current}/{total}"
        chunks = [paint("█", base=(CYAN, VIOLET)) for _ in range(filled)]
        chunks += [f"{DIM}░{RESET}" for _ in range(cells - filled)]
        percent = 100 * current / total
        return "".join(chunks) + f" {DIM}{percent:5.1f}%{RESET}"

    def _spin(self) -> None:
        idx = 0
        while not self._stop.is_set():
            with self._lock:
                label, note_text, bar = self.label, self.note_text, self._bar
            line = f"  {paint(SPIN[idx % len(SPIN)], base=(CYAN, CYAN))} {label}"
            if note_text:
                line += f"  {note(note_text)}"
            if bar:
                line += "  " + self._bar_text(bar)
            sys.stdout.write("\r\x1b[K" + line)
            sys.stdout.flush()
            idx += 1
            time.sleep(0.085)

    def __exit__(self, exc_type, exc, tb) -> bool:
        self.elapsed = time.perf_counter() - self._t0
        remaining = 0.30 - self.elapsed
        if remaining > 0:
            time.sleep(remaining)
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=0.4)
        if SILENT:
            return False
        ok = exc_type is None
        if ANIM:
            mark = paint("✓", base=(MINT, MINT)) if ok else paint("✗", base=(ROSE, ROSE))
            line = f"  {mark} {self.label}"
            if self.note_text:
                line += f"  {note(self.note_text)}"
            line += f"  {DIM}{self.elapsed * 1000:5.0f} ms{RESET}"
            sys.stdout.write("\r\x1b[K" + line + "\n")
            sys.stdout.flush()
        else:
            print(f" {'ok' if ok else 'FAIL'} ({self.elapsed * 1000:.0f} ms)")
        return False


class LiveStatus:
    """预览服务底部常驻状态行：脉冲指示灯 + 运行时长 + 重建计数。"""

    def __init__(self, url: str) -> None:
        self.url = url
        self.rebuilds = 0
        self._t0 = time.perf_counter()
        self._stop = threading.Event()
        self._lock = threading.Lock()
        self._thread: threading.Thread | None = None

    def _render(self) -> str:
        t = time.perf_counter() - self._t0
        pulse = 0.35 + 0.65 * (0.5 + 0.5 * __import__("math").sin(t * 3.4))
        dot = _fg(_mix((40, 90, 70), MINT, pulse)) + "●" + RESET
        clock = f"{int(t) // 60:02d}:{int(t) % 60:02d}"
        return (f"  {dot} {paint('LIVE', base=(MINT, CYAN))}  {self.url}"
                f"  {DIM}·  运行 {clock}  ·  重建 {self.rebuilds} 次  ·  Ctrl+C 停止{RESET}")

    def start(self) -> None:
        if not ANIM:
            return
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=0.4)
            sys.stdout.write("\r\x1b[K")
            sys.stdout.flush()

    def _loop(self) -> None:
        while not self._stop.is_set():
            with self._lock:
                sys.stdout.write("\r\x1b[K" + self._render())
                sys.stdout.flush()
            time.sleep(0.09)

    def log(self, message: str) -> None:
        with self._lock:
            sys.stdout.write("\r\x1b[K" + message + "\n")
            sys.stdout.flush()


# ───────────────────────────── 构建流程 ──────────────────────────────


def collect_slide_files() -> list[Path]:
    if not SLIDES_DIR.is_dir():
        raise FileNotFoundError(f"未找到章节目录: {SLIDES_DIR}")
    files = sorted(p for p in SLIDES_DIR.glob("*.html") if not p.name.startswith("_"))
    if not files:
        raise FileNotFoundError(f"{SLIDES_DIR} 下没有任何 .html 章节文件")
    return files


def verify_local_assets(html_text: str) -> tuple[int, list[str]]:
    refs = set(re.findall(r"""(?:src|href|poster|url)\s*(?:=|\()\s*['"]?(assets/[^'")\s?#]+)""", html_text))
    missing = [ref for ref in sorted(refs) if not (ROOT / ref).exists()]
    return len(refs), missing


def _kb(path: Path) -> str:
    return f"{path.stat().st_size / 1024:.1f} KB"


def build_deck(quiet: bool = False) -> bool:
    global BUILD_VERSION, SILENT
    SILENT = quiet
    if not quiet:
        banner()

    with Stage("扫描章节源文件") as stage:
        slide_files = collect_slide_files()
        stage.note_set(f"{len(slide_files)} 个章节 · {', '.join(p.stem for p in slide_files)}")

    with Stage("载入模板与静态资源") as stage:
        template = TEMPLATE_FILE.read_text(encoding="utf-8")
        css_code = CSS_FILE.read_text(encoding="utf-8")
        js_code = JS_FILE.read_text(encoding="utf-8")
        stage.note_set(f"template {_kb(TEMPLATE_FILE)} · css {_kb(CSS_FILE)} · js {_kb(JS_FILE)}")

    with Stage("合并章节并注入资源") as stage:
        slides_merged = "\n\n".join(
            f"<!-- === Source: slides/{p.name} === -->\n{p.read_text(encoding='utf-8').strip()}"
            for p in slide_files
        )
        output = (
            template
            .replace("/* __INJECT_CUSTOM_CSS__ */", css_code)
            .replace("<!-- __INJECT_SLIDES__ -->", slides_merged)
            .replace("/* __INJECT_CUSTOM_JS__ */", js_code)
            .replace("<!-- __LIVE_RELOAD_HOOK__ -->", "")
        )
        stage.note_set(f"{len(slide_files)} 段章节 → 单文件")

    with Stage("写出 index.html") as stage:
        OUTPUT_FILE.write_text(output, encoding="utf-8")
        BUILD_VERSION = str(int(time.time() * 1000))
        digest = hashlib.sha256(output.encode("utf-8")).hexdigest()[:10]
        stage.note_set(f"{_kb(OUTPUT_FILE)} · sha256 {digest}")

    with Stage("校验离线资源") as stage:
        checked, missing = verify_local_assets(output)
        ready = checked - len(missing)
        stage.note_set(f"{checked} 项本地引用")
        stage.fill(checked)
        stage.note_set(f"{ready}/{checked} 就绪")

    if not quiet:
        size_kb = _kb(OUTPUT_FILE)
        framed(
            "构建完成",
            [
                ("输出文件", f"index.html · {size_kb}"),
                ("章节模块", f"{len(slide_files)} slides + custom.css + custom.js"),
                ("离线校验", f"{checked - len(missing)}/{checked} 就绪" if not missing else f"缺失 {len(missing)} 项"),
            ],
            accent=(MINT, CYAN) if not missing else (AMBER, ROSE),
        )
        for ref in missing:
            fail(f"缺失本地资源: {ref}")
        if missing or os.environ.get("DECK_BANNER", "1") == "0":
            pass
        else:
            sep = f"   {DIM}·{RESET}   " if ANIM else "   ·   "
            print("  " + paint("▸", base=(CYAN, CYAN)) + " " + note("下一步")
                  + "  python3 build.py --serve  热更新预览" + sep
                  + note("./present.sh  全屏放映"))
            print()

    LAST_BUILD.clear()
    LAST_BUILD.update({"size": OUTPUT_FILE.stat().st_size, "slides": len(slide_files),
                       "checked": checked, "missing": len(missing)})
    return len(missing) == 0


def snapshot_mtimes() -> dict[Path, float]:
    watched: list[Path] = [TEMPLATE_FILE, CSS_FILE, JS_FILE]
    if SLIDES_DIR.is_dir():
        watched.extend(SLIDES_DIR.glob("*.html"))
    result: dict[Path, float] = {}
    for p in watched:
        if p.exists():
            result[p] = p.stat().st_mtime
    return result


def watch_loop(status: LiveStatus | None = None) -> None:
    last = snapshot_mtimes()
    while True:
        time.sleep(0.6)
        curr = snapshot_mtimes()
        if curr == last:
            continue
        changed = ", ".join(sorted(p.name for p in curr if last.get(p) != curr.get(p))) or "源码"
        last = curr
        started = time.perf_counter()
        try:
            build_deck(quiet=True)
            cost = (time.perf_counter() - started) * 1000
            size_kb = LAST_BUILD.get("size", 0) / 1024  # type: ignore[operator]
            line = (f"  {paint('↻', base=(AMBER, AMBER))} {note(changed)}  {DIM}→{RESET}  "
                    f"{paint(f'{size_kb:.1f} KB', base=(CYAN, VIOLET))}  {DIM}{cost:.0f} ms{RESET}")
            if status is not None:
                status.rebuilds += 1
                status.log(line)
            else:
                print(line)
        except Exception as exc:  # noqa: BLE001
            if status is not None:
                status.log(f"  {_fg(ROSE)}✗{RESET} 构建出错: {exc}")
            else:
                print(f"[watch] 构建出错: {exc}", file=sys.stderr)


class RangeAndLiveReloadHandler(SimpleHTTPRequestHandler):
    """支持 MP4 Range 拖动播放 + 首页热更新注入的轻量开发处理器"""

    def log_message(self, format: str, *args) -> None:
        pass

    def do_GET(self) -> None:
        clean_path = self.path.split("?", 1)[0].split("#", 1)[0]
        if clean_path == "/__build_version__":
            payload = BUILD_VERSION.encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        if clean_path in ("/", "/index.html"):
            html = OUTPUT_FILE.read_text(encoding="utf-8")
            injected = html.replace("</body>", f"{LIVE_RELOAD_SNIPPET}\n</body>").encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Content-Length", str(len(injected)))
            self.end_headers()
            self.wfile.write(injected)
            return

        # Support HTTP Range requests for smooth <video> playback
        file_path = Path(self.translate_path(self.path))
        range_header = self.headers.get("Range")
        if range_header and file_path.is_file():
            m = re.match(r"bytes=(\d+)-(\d*)", range_header)
            if m:
                total = file_path.stat().st_size
                start = int(m.group(1))
                end = int(m.group(2)) if m.group(2) else total - 1
                end = min(end, total - 1)
                if start <= end:
                    length = end - start + 1
                    ctype = self.guess_type(str(file_path))
                    self.send_response(HTTPStatus.PARTIAL_CONTENT)
                    self.send_header("Content-Type", ctype)
                    self.send_header("Accept-Ranges", "bytes")
                    self.send_header("Content-Range", f"bytes {start}-{end}/{total}")
                    self.send_header("Content-Length", str(length))
                    self.end_headers()
                    with file_path.open("rb") as fp:
                        fp.seek(start)
                        self.wfile.write(fp.read(length))
                    return

        super().do_GET()


def main() -> None:
    global ANIM
    parser = argparse.ArgumentParser(description="构建并预览 HTML 演示文稿")
    parser.add_argument("--serve", action="store_true", help="启动本地实时预览服务器并监听源码改动")
    parser.add_argument("-p", "--port", type=int, default=8080, help="本地预览端口 (默认 8080)")
    parser.add_argument("--plain", action="store_true", help="关闭彩色动画，输出纯文本日志")
    args = parser.parse_args()

    if args.plain:
        ANIM = False

    try:
        build_deck()
    except FileNotFoundError as exc:
        fail(str(exc))
        sys.exit(1)

    if args.serve:
        with Stage("挂载预览服务") as stage:
            handler = partial(RangeAndLiveReloadHandler, directory=str(ROOT))
            server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
            stage.note_set(f"127.0.0.1:{args.port}")

        url = f"http://127.0.0.1:{args.port}"
        framed(
            "LIVE 预览服务",
            [
                ("地址", url),
                ("播放", "F11 全屏 · S 键双屏演讲者视图"),
                ("热更新", "保存 slides/*.html · custom.css · custom.js 即自动刷新"),
            ],
            accent=(MINT, CYAN),
        )
        status = LiveStatus(url)
        status.start()
        watcher = threading.Thread(target=watch_loop, args=(status,), daemon=True)
        watcher.start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            status.stop()
            print(paint("  ■ 已停止预览服务", base=(SLATE, CYAN)))
            print()


if __name__ == "__main__":
    main()
