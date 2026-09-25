/**
 * ブルアカ生徒名スマート検索エンジン
 * ひらがな・カタカナ・全角半角正規化、前方一致優先サジェスト
 */

(function (window) {
  // カタカナ -> ひらがな
  function kataToHira(str) {
    if (!str) return '';
    return str.replace(/[\u30a1-\u30f6]/g, function (match) {
      const chr = match.charCodeAt(0) - 0x60;
      return String.fromCharCode(chr);
    });
  }

  // ひらがな -> カタカナ
  function hiraToKata(str) {
    if (!str) return '';
    return str.replace(/[\u3041-\u3096]/g, function (match) {
      const chr = match.charCodeAt(0) + 0x60;
      return String.fromCharCode(chr);
    });
  }

  // 全角英数・記号 -> 半角
  function normalizeText(str) {
    if (!str) return '';
    return str
      .replace(/[！-～]/g, function (s) {
        return String.fromCharCode(s.charCodeAt(0) - 0xfee0);
      })
      .replace(/　/g, ' ')
      .replace(/（/g, '(')
      .replace(/）/g, ')')
      .toLowerCase();
  }

  // 検索用の正規化文字列ペア（ひらがな版・カタカナ版）を生成
  function normalizeQuery(str) {
    const raw = (str || '').trim();
    const hira = kataToHira(raw).toLowerCase();
    const kata = hiraToKata(raw);
    return { raw, hira, kata };
  }

  /**
   * 生徒リストからクエリで検索
   * @param {Array} studentList 生徒配列
   * @param {string} query 検索文字列
   * @param {number} maxResults 最大件数 (デフォルト: 15)
   * @returns {Array} マッチした生徒リスト
   */
  function searchStudents(studentList, query, maxResults = 20) {
    if (!studentList || !Array.isArray(studentList)) return [];
    const q = (query || '').trim();
    if (!q) {
      return studentList.slice(0, maxResults);
    }

    const { hira: qHira, kata: qKata } = normalizeQuery(q);

    // スコアリング
    // 1: 完全一致 (Score 200)
    // 2: 生徒名全体の前方一致 (Score 100)
    // 3: ベース名（衣装なし）前方一致 (Score 90)
    // 4: カッコ内（衣装）の前方一致 (Score 70)
    // 5: 部分一致 (Score 50)
    const matches = [];

    for (const student of studentList) {
      const name = student.name || '';
      const hiraName = student.hiraName || kataToHira(name);
      const hiraBase = student.hiraBase || kataToHira(student.baseName || name);

      let score = 0;
      let matchType = 'none';

      // 1. 完全一致
      if (name === q || hiraName === qHira || name === qKata) {
        score = 200;
        matchType = 'exact';
      }
      // 2. 生徒名全体の前方一致 (例: "しゅん" -> "シュン", "シュン（水着）")
      else if (name.startsWith(qKata) || hiraName.startsWith(qHira) || name.startsWith(q)) {
        score = 100;
        matchType = 'prefix';
      }
      // 3. ベース名の前方一致
      else if (hiraBase.startsWith(qHira) || (student.baseName && student.baseName.startsWith(qKata))) {
        score = 90;
        matchType = 'base-prefix';
      }
      // 4. カッコ内（衣装）の前方一致 (例: "みずぎ" -> "シュン（水着）", "シュエリン（水着）")
      else if (hiraName.includes('(' + qHira) || hiraName.includes('（' + qHira) || name.includes('(' + qKata) || name.includes('（' + qKata)) {
        score = 70;
        matchType = 'variant-prefix';
      }
      // 5. 部分一致
      else if (name.includes(qKata) || hiraName.includes(qHira) || name.toLowerCase().includes(q.toLowerCase())) {
        score = 50;
        matchType = 'partial';
      }

      if (score > 0) {
        matches.push({
          student,
          score,
          matchType
        });
      }
    }

    // スコア降順、同スコアなら名前順
    matches.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.student.name.localeCompare(b.student.name, 'ja');
    });

    return matches.slice(0, maxResults).map(m => m.student);
  }

  // グローバル公開
  window.BASearch = {
    kataToHira,
    hiraToKata,
    normalizeText,
    normalizeQuery,
    searchStudents
  };
})(window);
