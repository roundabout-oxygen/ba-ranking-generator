/**
 * ブルアカWiki 生徒データ巡回・更新・ストレージ管理モジュール
 * テーブル/キャラクター一覧 から全生徒データを巡回・更新
 */

(function (window) {
  const STORAGE_KEY = 'ba_ranking_students_data_v4';
  const STORAGE_TIMESTAMP_KEY = 'ba_ranking_students_timestamp_v4';
  const WIKI_CHARA_URL = 'https://bluearchive.wikiru.jp/?cmd=read&page=%E3%83%86%E3%83%BC%E3%83%96%E3%83%AB%2F%E3%82%AD%E3%83%A3%E3%83%A9%E3%82%AF%E3%82%BF%E3%83%BC%E4%B8%80%E8%A6%A7';

  const KANJI_READINGS = {
    "御坂美琴": "みさかみこと",
    "食蜂操祈": "しょくほうみさき",
    "佐天涙子": "さてんるいこ",
    "初音ミク": "はつねみく",
    "美甘ネル": "みかもねる"
  };

  // カタカナ -> ひらがな
  function kataToHira(text) {
    if (!text) return '';
    return text.replace(/[\u30a1-\u30f6]/g, function (match) {
      return String.fromCharCode(match.charCodeAt(0) - 0x60);
    });
  }

  // HTML文字列から生徒データをパース
  function parseStudentsFromHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const table = doc.querySelector('#sortabletable1') || doc.querySelector('#body table.style_table');
    if (!table) return [];

    const rows = table.querySelectorAll('tbody tr');
    const list = [];
    const seen = new Set();

    rows.forEach(tr => {
      const tds = tr.querySelectorAll('td');
      if (tds.length < 2) return;

      let imgTd = null;
      let nameTd = null;

      if (tds.length >= 3) {
        imgTd = tds[1];
        nameTd = tds[2];
      } else {
        imgTd = tds[0];
        nameTd = tds[1];
      }

      if (!imgTd || !nameTd) return;

      const imgTag = imgTd.querySelector('img');
      let name = (nameTd.textContent || '').trim();
      name = name.replace(/[\r\n\t]/g, '').replace(/\s+/g, '');
      const aTag = nameTd.querySelector('a');
      if (aTag && aTag.getAttribute('title')) {
        name = aTag.getAttribute('title').trim();
      }

      if (!name || seen.has(name) || name === '画像' || name === '名前') return;

      let dataSrc = '';
      let altName = '';
      if (imgTag) {
        dataSrc = imgTag.getAttribute('data-src') || imgTag.getAttribute('src') || '';
        altName = imgTag.getAttribute('alt') || imgTag.getAttribute('title') || '';
      }

      let iconUrl = '';
      if (dataSrc && !dataSrc.startsWith('data:')) {
        iconUrl = dataSrc.startsWith('http') ? dataSrc : `https://bluearchive.wikiru.jp/${dataSrc.replace(/^\//, '')}`;
      }

      let imgFile = altName ? altName.replace(/_仮icon/g, "_icon") : `${name}_icon.png`;
      if (!imgFile.endsWith('.png') && !imgFile.endsWith('.jpg')) {
        imgFile += '.png';
      }

      // 特例: シュン（水着）の大人アイコン
      if (name === 'シュン（水着）') {
        imgFile = 'シュン（水着）_icon.png';
        iconUrl = 'https://bluearchive.wikiru.jp/attach2/696D67_E382B7E383A5E383B3EFBC88E6B0B4E79D80EFBC895F69636F6E2E706E67.png';
      }

      const hiraCustom = KANJI_READINGS[name] || '';
      const hiraName = hiraCustom || kataToHira(name);
      const baseName = name.replace(/[\(（].*?[\)）]/g, '').trim();
      const baseCustom = KANJI_READINGS[baseName] || '';
      const hiraBase = baseCustom || kataToHira(baseName);

      const role = tr.textContent.includes('SPECIAL') ? 'SPECIAL' : 'STRIKER';

      seen.add(name);
      list.push({
        name,
        baseName,
        hiraName,
        hiraBase,
        imgFile: `img/${imgFile}`,
        iconUrl,
        alt: altName,
        role,
        wikiLink: name
      });
    });

    // シュエリン（水着）を別エントリとして追加
    if (!seen.has('シュエリン（水着）')) {
      list.push({
        name: 'シュエリン（水着）',
        baseName: 'シュエリン',
        hiraName: 'しゅえりん（みずぎ）',
        hiraBase: 'しゅえりん',
        imgFile: 'img/シュエリン（水着）_icon.png',
        iconUrl: 'https://bluearchive.wikiru.jp/attach2/696D67_E382B7E383A5E382A8E383AAE383B3EFBC88E6B0B4E79D80EFBC895F69636F6E2E706E67.png',
        alt: 'シュエリン（水着）_icon.png',
        role: 'STRIKER',
        wikiLink: 'シュン（水着）'
      });
    }

    return list;
  }

  function getLoadedStudents() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load students from localStorage:', e);
    }
    return window.DEFAULT_STUDENTS || [];
  }

  function getLastUpdatedTime() {
    return localStorage.getItem(STORAGE_TIMESTAMP_KEY) || '初期データ (テーブル/キャラクター一覧 準拠)';
  }

  function saveStudents(studentsList) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(studentsList));
      const nowStr = new Date().toLocaleString('ja-JP');
      localStorage.setItem(STORAGE_TIMESTAMP_KEY, nowStr);
      return true;
    } catch (e) {
      console.error('Failed to save students to localStorage:', e);
      return false;
    }
  }

  async function crawlWikiStudents(onProgress = () => {}) {
    onProgress('Wikiへ接続中...');

    try {
      onProgress('ローカルAPIサーバーを確認中...');
      const localRes = await fetch('/api/crawl', { method: 'GET', cache: 'no-store' });
      if (localRes.ok) {
        const data = await localRes.json();
        if (data && data.students && data.students.length > 0) {
          saveStudents(data.students);
          return {
            success: true,
            count: data.students.length,
            message: `Wiki「テーブル/キャラクター一覧」より最新 ${data.students.length} 名の生徒データを取得・更新しました！`,
            students: data.students
          };
        }
      }
    } catch (e) {}

    const proxyUrls = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(WIKI_CHARA_URL)}`,
      `https://corsproxy.io/?${encodeURIComponent(WIKI_CHARA_URL)}`
    ];

    for (let i = 0; i < proxyUrls.length; i++) {
      const url = proxyUrls[i];
      try {
        onProgress(`Wikiデータを取得中 (プロキシ ${i + 1}/${proxyUrls.length})...`);
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const html = await res.text();
          const parsed = parseStudentsFromHtml(html);
          if (parsed.length >= 100) {
            saveStudents(parsed);
            return {
              success: true,
              count: parsed.length,
              message: `Wiki「テーブル/キャラクター一覧」より最新 ${parsed.length} 名の生徒データを取得・更新しました！`,
              students: parsed
            };
          }
        }
      } catch (err) {
        console.warn(`Proxy ${url} failed:`, err);
      }
    }

    return {
      success: false,
      count: getLoadedStudents().length,
      message: 'Wikiへの直接接続に失敗しました。内包生徒マスターデータを使用します。',
      students: getLoadedStudents()
    };
  }

  function resetToDefault() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_TIMESTAMP_KEY);
    } catch (e) {}
    return window.DEFAULT_STUDENTS || [];
  }

  window.BACrawler = {
    getLoadedStudents,
    getLastUpdatedTime,
    saveStudents,
    crawlWikiStudents,
    parseStudentsFromHtml,
    resetToDefault
  };
})(window);
