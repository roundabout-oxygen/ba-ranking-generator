"""
ブルーアーカイブ Wiki ランキング編成生成ツール - ローカル開発・実行サーバー
- 静的ファイル配信 (http://localhost:8080)
- Wiki巡回API (/api/crawl) : テーブル/キャラクター一覧 から取得
- ブラウザ自動起動
"""

import http.server
import socketserver
import urllib.request
import urllib.parse
import json
import re
import os
import sys
import webbrowser
import threading
import time

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
# 巡回先URL: テーブル/キャラクター一覧
WIKI_URL = "https://bluearchive.wikiru.jp/?cmd=read&page=%E3%83%86%E3%83%BC%E3%83%96%E3%83%AB%2F%E3%82%AD%E3%83%A3%E3%83%A9%E3%82%AF%E3%82%BF%E3%83%BC%E4%B8%80%E8%A6%A7"

KANJI_READINGS = {
    "御坂美琴": "みさかみこと",
    "食蜂操祈": "しょくほうみさき",
    "佐天涙子": "さてんるいこ",
    "初音ミク": "はつねみく",
    "美甘ネル": "みかもねる"
}

def kata_to_hira(text):
    if not text:
        return ""
    result = []
    for ch in text:
        code = ord(ch)
        if 0x30A1 <= code <= 0x30F6:
            result.append(chr(code - 0x60))
        else:
            result.append(ch)
    return "".join(result)

def crawl_wiki_data():
    """Wikiの「テーブル/キャラクター一覧」から全生徒データを取得してパース"""
    req = urllib.request.Request(
        WIKI_URL,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            html = response.read().decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"[Error] Failed to fetch wiki character table: {e}")
        return []

    pos_table = html.find('id="sortabletable1"')
    if pos_table == -1:
        pos_table = html.find('id="body"')

    table_html = html[pos_table:]
    pos_start = table_html.find('<tbody>')
    pos_end = table_html.find('</tbody>', pos_start)
    tbody = table_html[pos_start:pos_end] if pos_start != -1 and pos_end != -1 else table_html

    rows = tbody.split('<tr>')
    students = []
    seen = set()

    for r in rows:
        if not r.strip():
            continue

        img_match = re.search(r'<img[^>]*alt="([^"]*)"[^>]*data-src="([^"]*)"', r)
        if not img_match:
            img_match = re.search(r'<img[^>]*data-src="([^"]*)"[^>]*alt="([^"]*)"', r)
            if img_match:
                data_src, alt = img_match.group(1), img_match.group(2)
            else:
                data_src, alt = "", ""
        else:
            alt, data_src = img_match.group(1), img_match.group(2)

        tds = re.findall(r'<td[^>]*>(.*?)</td>', r, re.DOTALL)
        if len(tds) < 3:
            continue
        name_td = tds[2]

        clean_name = re.sub(r'<[^>]+>', '', name_td).strip()
        clean_name = clean_name.replace('\n', '').replace('\r', '').replace(' ', '').replace('　', '')

        a_match = re.search(r'<a[^>]*title="([^"]*)"', name_td)
        if a_match:
            clean_name = a_match.group(1).strip()

        if not clean_name or clean_name in seen or clean_name in ["画像", "名前"]:
            continue
        seen.add(clean_name)

        img_file = alt if alt else f"{clean_name}_icon.png"
        if "_仮icon" in img_file:
            img_file = img_file.replace("_仮icon", "_icon")
        if not img_file.endswith('.png') and not img_file.endswith('.jpg'):
            img_file += '.png'

        icon_url = f"https://bluearchive.wikiru.jp/{data_src.lstrip('/')}" if not data_src.startswith('http') else data_src

        hira_custom = KANJI_READINGS.get(clean_name, "")
        hira_name = hira_custom if hira_custom else kata_to_hira(clean_name)

        base_name = re.sub(r'[\(（].*?[\)）]', '', clean_name).strip()
        base_custom = KANJI_READINGS.get(base_name, "")
        hira_base = base_custom if base_custom else kata_to_hira(base_name)

        role = 'SPECIAL' if 'SPECIAL' in r else 'STRIKER'

        students.append({
            "name": clean_name,
            "baseName": base_name,
            "hiraName": hira_name,
            "hiraBase": hira_base,
            "imgFile": f"img/{img_file}",
            "iconUrl": icon_url,
            "alt": alt,
            "role": role
        })

    print(f"[Crawl] Successfully extracted {len(students)} students from character table.")
    return students


class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        if self.path == "/api/crawl":
            students = crawl_wiki_data()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            response_data = {
                "success": len(students) > 0,
                "count": len(students),
                "students": students
            }
            self.wfile.write(json.dumps(response_data, ensure_ascii=False).encode("utf-8"))
            return

        return super().do_GET()


def run_server():
    os.chdir(DIRECTORY)
    with socketserver.TCPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
        print(f"==================================================")
        print(f"  ブルーアーカイブ Wiki ランキング編成生成ツール")
        print(f"  ローカルサーバー起動中: http://localhost:{PORT}")
        print(f"  (終了するには Ctrl+C を押してください)")
        print(f"==================================================")

        def open_browser():
            time.sleep(1)
            webbrowser.open(f"http://localhost:{PORT}")

        threading.Thread(target=open_browser, daemon=True).start()

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nサーバーを停止しました。")


if __name__ == "__main__":
    run_server()
