"""用无头浏览器验证前端能否正常渲染。

会启动一个临时数据目录的服务，用 Edge / Chrome 的 --dump-dom 抓取渲染后的 HTML。
用法：.venv/Scripts/python.exe tests/test_ui_render.py
"""

from __future__ import annotations

import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

_TEMP_ROOT = Path(tempfile.mkdtemp(prefix="wardrobe-ui-"))
os.environ["WARDROBE_DATA_DIR"] = str(_TEMP_ROOT / "data")
os.environ["WARDROBE_LOG_DIR"] = str(_TEMP_ROOT / "logs")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PIL import Image, ImageDraw  # noqa: E402

from app.db import init_db  # noqa: E402
from app.server import start_server  # noqa: E402
from app.utils import ensure_dirs, setup_logging  # noqa: E402

BROWSERS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
]


def find_browser() -> str | None:
    for path in BROWSERS:
        if Path(path).is_file():
            return path
    return None


def dump_dom(browser: str, url: str, profile: Path) -> str:
    result = subprocess.run(
        [
            browser,
            "--headless=new",
            "--disable-gpu",
            "--no-first-run",
            "--disable-extensions",
            f"--user-data-dir={profile}",
            "--virtual-time-budget=6000",
            "--dump-dom",
            url,
        ],
        capture_output=True,
        timeout=90,
    )
    return result.stdout.decode("utf-8", "replace")


def call(method: str, url: str, data: bytes | None = None, ctype: str | None = None):
    request = urllib.request.Request(url, data=data, method=method)
    if ctype:
        request.add_header("Content-Type", ctype)
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read().decode("utf-8"))


def make_png(width: int = 600, height: int = 900) -> bytes:
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle([150, 150, width - 150, height - 100], radius=40,
                           fill=(210, 195, 175, 255))
    buffer = io.BytesIO()
    image.save(buffer, "PNG")
    return buffer.getvalue()


def main() -> int:
    setup_logging()
    ensure_dirs()
    init_db()

    browser = find_browser()
    if not browser:
        print("SKIP：没有找到 Edge 或 Chrome，跳过渲染测试")
        return 0

    httpd, port = start_server()
    base = f"http://127.0.0.1:{port}"
    profile = _TEMP_ROOT / "browser-profile"
    failures = 0

    try:
        # 1. 空衣柜
        html = dump_dom(browser, base + "/", profile)
        checks = [
            ("个人衣柜", "页面标题"),
            ("衣柜还是空的", "空状态文案"),
            ("添加衣服", "添加按钮"),
        ]
        for text, label in checks:
            ok = text in html
            failures += 0 if ok else 1
            print(f"[{'PASS' if ok else 'FAIL'}] {label}：{text}")

        # 2. 造一件衣服，再渲染
        body = json.dumps(
            {"name": "UI 测试白T", "category": "top", "color": "white"},
            ensure_ascii=False,
        ).encode("utf-8")
        _, payload = call("POST", base + "/api/garments", body, "application/json")
        garment_id = payload["data"]["id"]
        for angle in ("front", "side", "back"):
            call("POST", f"{base}/api/garments/{garment_id}/images?angle={angle}",
                 make_png(), "image/png")

        html = dump_dom(browser, base + "/", profile)
        for text, label in [
            ("UI 测试白T", "衣服名称出现在卡片里"),
            ("thumb.webp", "缩略图被引用"),
            ("1 件衣服", "数量显示正确"),
        ]:
            ok = text in html
            failures += 0 if ok else 1
            print(f"[{'PASS' if ok else 'FAIL'}] {label}：{text}")

        # 3. 筛选控件
        for needle, label in [
            ('id="filter-color"', "颜色筛选下拉框"),
            ('id="filter-season"', "季节筛选下拉框"),
            ('id="filter-scene"', "场合筛选下拉框"),
            ('id="category-filters"', "类别筛选行"),
            ('id="btn-clear-filters"', "清除筛选按钮"),
        ]:
            ok = needle in html
            failures += 0 if ok else 1
            print(f"[{'PASS' if ok else 'FAIL'}] {label}")

        # 4. 详情页（通过 hash 直接打开）
        detail_html = dump_dom(browser, f"{base}/#garment/{garment_id}", profile)
        for text, label in [
            ("UI 测试白T", "详情页显示衣服名称"),
            ("返回衣柜", "返回按钮"),
            ("角度图", "角度图区域"),
            ("替换", "替换按钮"),
            ("编辑信息", "编辑信息按钮"),
            ("添加时间", "信息表显示添加时间"),
        ]:
            ok = text in detail_html
            failures += 0 if ok else 1
            print(f"[{'PASS' if ok else 'FAIL'}] {label}")

        # 5. 旋转视图
        image_count = detail_html.count('class="rotate-view__img"')
        dot_count = detail_html.count('class="rotate-view__dot"') + detail_html.count(
            'class="rotate-view__dot is-active"'
        )
        check_rot = image_count == 3
        failures += 0 if check_rot else 1
        print(f"[{'PASS' if check_rot else 'FAIL'}] 旋转视图挂载了 3 张图（实际 {image_count}）")

        check_rot = dot_count == 3
        failures += 0 if check_rot else 1
        print(f"[{'PASS' if check_rot else 'FAIL'}] 角度指示点有 3 个（实际 {dot_count}）")

        check_rot = "rotateY(" in detail_html
        failures += 0 if check_rot else 1
        print(f"[{'PASS' if check_rot else 'FAIL'}] 旋转角度已写入样式")

        row_count = detail_html.count('class="angle-row"')
        check_rot = row_count == 5
        failures += 0 if check_rot else 1
        print(f"[{'PASS' if check_rot else 'FAIL'}] 角度图列表有 5 行（实际 {row_count}）")

        check_rot = "?v=" in detail_html
        failures += 0 if check_rot else 1
        print(f"[{'PASS' if check_rot else 'FAIL'}] 图片地址带缓存版本号")

        html = detail_html
        ok = "本地服务连接失败" not in html and "启动失败" not in html
        failures += 0 if ok else 1
        print(f"[{'PASS' if ok else 'FAIL'}] 页面没有启动错误提示")
    finally:
        httpd.shutdown()
        httpd.server_close()
        shutil.rmtree(_TEMP_ROOT, ignore_errors=True)

    print(f"\n结果：{'全部通过' if failures == 0 else f'{failures} 项失败'}")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
