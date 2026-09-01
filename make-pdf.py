"""
Пересборка PDF-презентации из presentation.html.

Нужен один раз:  pip install playwright && playwright install chromium
Запуск:          python make-pdf.py

Скрипт сам поднимает локальный сервер на свободном порту, поэтому
предварительно ничего запускать не надо. Правки вносятся в
presentation.html, потом достаточно перезапустить этот файл.
"""

import http.server
import os
import socket
import socketserver
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.abspath(__file__))
SOURCE = "presentation.html"
OUTPUT = "Асэна-Групп-презентация.pdf"

# формат совпадает с презентацией заказчика: 1440x810, то есть 16:9
SLIDE_W = "1440px"
SLIDE_H = "810px"


def serve(directory):
    """Поднимает http-сервер на свободном порту, возвращает его номер."""
    handler = lambda *a, **kw: http.server.SimpleHTTPRequestHandler(
        *a, directory=directory, **kw
    )
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]

    httpd = socketserver.TCPServer(("127.0.0.1", port), handler)
    httpd.allow_reuse_address = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return port


def main():
    port = serve(ROOT)
    out = os.path.join(ROOT, OUTPUT)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 810})
        page.goto("http://127.0.0.1:%d/%s" % (port, SOURCE), wait_until="networkidle")
        page.wait_for_timeout(1500)          # ждём шрифт и фоновые слои
        page.evaluate("document.fonts.ready")
        page.wait_for_timeout(800)

        broken = page.evaluate(
            "[...document.images].filter(i => !i.complete || i.naturalWidth === 0)"
            ".map(i => i.getAttribute('src'))"
        )
        if broken:
            print("ВНИМАНИЕ, не загрузились картинки:", broken)

        slides = page.evaluate("document.querySelectorAll('.slide').length")

        page.pdf(
            path=out,
            width=SLIDE_W,
            height=SLIDE_H,
            print_background=True,
            margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
        )
        browser.close()

    print("Готово: %s (%d слайдов, %d КБ)" % (OUTPUT, slides, os.path.getsize(out) // 1024))


if __name__ == "__main__":
    main()
