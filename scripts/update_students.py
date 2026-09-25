import os
import re
import json
import urllib.request
import urllib.parse
from html.parser import HTMLParser
from datetime import datetime, timezone, timedelta

KANJI_READINGS = {
    "御坂美琴": "みさかみこと",
    "食蜂操祈": "しょくほうみさき",
    "佐天涙子": "さてんるいこ",
    "初音ミク": "はつねみく",
    "美甘ネル": "みかもねる"
}

def kata_to_hira(text: str) -> str:
    res = []
    for ch in text:
        code = ord(ch)
        if 0x30A1 <= code <= 0x30F6:
            res.append(chr(code - 0x60))
        else:
            res.append(ch)
    return "".join(res)

def extract_reading(name: str) -> str:
    for k, v in KANJI_READINGS.items():
        if name.startswith(k):
            rest = name[len(k):]
            return v + kata_to_hira(rest)
    return kata_to_hira(name)

class CharaTableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_target_table = False
        self.in_tbody = False
        self.in_tr = False
        self.in_td = False
        self.current_tr_tds = []
        self.rows_data = []

    def handle_starttag(self, tag, attrs):
        attr_dict = dict(attrs)
        if tag == 'table':
            if attr_dict.get('id') == 'sortabletable1':
                self.in_target_table = True
        elif self.in_target_table:
            if tag == 'tbody':
                self.in_tbody = True
            elif tag == 'tr':
                self.in_tr = True
                self.current_tr_tds = []
            elif self.in_tr and tag == 'td':
                self.in_td = True
                self.current_tr_tds.append({
                    'text': '',
                    'images': [],
                    'links': []
                })
            elif self.in_td and tag == 'img':
                if self.current_tr_tds:
                    self.current_tr_tds[-1]['images'].append({
                        'src': attr_dict.get('src', ''),
                        'alt': attr_dict.get('alt', ''),
                        'title': attr_dict.get('title', '')
                    })
            elif self.in_td and tag == 'a':
                if self.current_tr_tds:
                    self.current_tr_tds[-1]['links'].append({
                        'href': attr_dict.get('href', ''),
                        'title': attr_dict.get('title', '')
                    })

    def handle_endtag(self, tag):
        if tag == 'table' and self.in_target_table:
            self.in_target_table = False
        elif self.in_target_table:
            if tag == 'td':
                self.in_td = False
            elif tag == 'tr':
                if self.in_tr and self.current_tr_tds:
                    self.rows_data.append(self.current_tr_tds)
                self.in_tr = False
            elif tag == 'tbody':
                self.in_tbody = False

    def handle_data(self, data):
        if self.in_target_table and self.in_td and self.current_tr_tds:
            self.current_tr_tds[-1]['text'] += data

def fetch_wiki_chara_page():
    urls = [
        'https://bluearchive.wikiru.jp/?cmd=read&page=%E3%83%86%E3%83%BC%E3%83%96%E3%83%AB%2F%E3%82%AD%E3%83%A3%E3%83%A9%E3%82%AF%E3%82%BF%E3%83%BC%E4%B8%80%E8%A6%A7',
        'https://bluearchive.wikiru.jp/?%E3%83%86%E3%83%BC%E3%83%96%E3%83%AB%2F%E3%82%AD%E3%83%A3%E3%83%A9%E3%82%AF%E3%82%BF%E3%83%BC%E4%B8%80%E8%A6%A7'
    ]
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
    }

    for url in urls:
        try:
            print(f"Fetching {url}...")
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=15) as res:
                return res.read().decode('utf-8', errors='replace')
        except Exception as e:
            print(f"Failed to fetch {url}: {e}")
    return None

def parse_students(html: str):
    parser = CharaTableParser()
    parser.feed(html)

    students = []
    seen = set()

    for row in parser.rows_data:
        if len(row) < 2:
            continue
        
        if len(row) >= 3:
            img_td = row[1]
            name_td = row[2]
        else:
            img_td = row[0]
            name_td = row[1]

        # Extract name
        name = name_td['text'].strip().replace('\r', '').replace('\n', '').replace('\t', '').replace(' ', '')
        if name_td['links']:
            link_title = name_td['links'][0].get('title', '').strip()
            if link_title:
                name = link_title.split(' ')[0]

        if not name or name in ['名前', 'アイコン', 'キャラクター名']:
            continue

        # Extract img
        img_info = img_td['images'][0] if img_td['images'] else None
        img_file = f"{name}_icon.png"
        icon_url = ""
        alt = f"{name}_icon.png"

        if img_info:
            src = img_info.get('src', '')
            if src.startswith('//'):
                icon_url = f"https:{src}"
            elif src.startswith('/'):
                icon_url = f"https://bluearchive.wikiru.jp{src}"
            else:
                icon_url = src

            alt_val = img_info.get('alt', '')
            if alt_val:
                alt = alt_val
                match = re.search(r'([^\/\\]+\.(?:png|jpg|webp))', alt_val, re.IGNORECASE)
                if match:
                    img_file = match.group(1)

        if not icon_url:
            encoded_img = urllib.parse.quote(img_file)
            icon_url = f"https://bluearchive.wikiru.jp/image/{encoded_img}"

        reading = extract_reading(name)

        student_obj = {
            "name": name,
            "imgFile": img_file,
            "iconUrl": icon_url,
            "alt": alt,
            "reading": reading,
            "wikiLink": name
        }

        if name not in seen:
            seen.add(name)
            students.append(student_obj)

    # Ensure Shun (Swimsuit) and Shuren (Swimsuit) distinction
    has_shun_swimsuit = any(s['name'] == 'シュン（水着）' for s in students)
    has_shuren_swimsuit = any(s['name'] == 'シュエリン（水着）' for s in students)

    if has_shun_swimsuit and not has_shuren_swimsuit:
        students.append({
            "name": "シュエリン（水着）",
            "imgFile": "シュエリン（水着）_icon.png",
            "iconUrl": "https://bluearchive.wikiru.jp/image/%E3%82%B7%E3%83%A5%E3%82%A8%E3%83%AA%E3%83%B3%EF%BC%88%E6%B0%B4%E7%9D%80%EF%BC%89_icon.png",
            "alt": "シュエリン（水着）_icon.png",
            "reading": "しゅえりんみずぎ",
            "wikiLink": "シュン（水着）"
        })

    # Sort by reading
    students.sort(key=lambda s: s['reading'])
    return students

def main():
    html = fetch_wiki_chara_page()
    if not html:
        print("Error: Could not retrieve HTML from Blue Archive Wiki.")
        return

    students = parse_students(html)
    print(f"Successfully parsed {len(students)} students from Wiki.")

    # Save to data/students-data.json
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    target_data_dir = os.path.join(project_root, 'data')
    os.makedirs(target_data_dir, exist_ok=True)

    jst = timezone(timedelta(hours=9))
    now_str = datetime.now(jst).strftime('%Y-%m-%d %H:%M:%S (JST)')

    json_payload = {
        "version": "1.0",
        "lastUpdated": now_str,
        "count": len(students),
        "students": students
    }

    json_path = os.path.join(target_data_dir, 'students-data.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(json_payload, f, ensure_ascii=False, indent=2)
    print(f"Saved: {json_path}")

    # Also update js/students-data.js
    js_dir = os.path.join(project_root, 'js')
    os.makedirs(js_dir, exist_ok=True)
    js_path = os.path.join(js_dir, 'students-data.js')

    js_content = f"""/**
 * ブルーアーカイブ 全生徒マスターデータ
 * 自動生成日時: {now_str}
 * 登録生徒数: {len(students)} 名
 */

window.DEFAULT_STUDENTS = {json.dumps(students, ensure_ascii=False, indent=2)};
window.STUDENTS_METADATA = {{
  lastUpdated: "{now_str}",
  count: {len(students)}
}};
"""
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(js_content)
    print(f"Saved: {js_path}")

if __name__ == '__main__':
    main()
