/**
 * ブルーアーカイブWiki ランキング編成Wikiテキスト生成ツール
 * アプリケーション メインロジック
 * - アイコン上部番号行 (skill_row) 対応
 * - 入力自動保存 (LocalStorage永続化)
 * - リセット機能
 * - テーブル/キャラクター一覧 準拠
 */

(function () {
  'use strict';

  const STORAGE_STATE_KEY = 'ba_ranking_formation_state_v5';

  // 属性定義
  const ALL_ARMOR_TYPES = [
    { id: 'light', name: '軽装備', alias: '軽装備', color: '#e84118', bg: 'rgba(232, 65, 24, 0.1)', border: '#e84118' },
    { id: 'heavy', name: '重装甲', alias: '重装甲', color: '#fbc531', bg: 'rgba(251, 197, 49, 0.15)', border: '#e1b12c' },
    { id: 'special', name: '特殊装甲', alias: '特殊装甲', color: '#487eb0', bg: 'rgba(72, 126, 176, 0.15)', border: '#487eb0' },
    { id: 'elastic', name: '弾力装甲', alias: '弾力装甲', color: '#9c88ff', bg: 'rgba(156, 136, 255, 0.15)', border: '#9c88ff' }
  ];

  // スロットラベル（STRIKER 4人 + SPECIAL 2人）
  const SLOT_CONFIGS = [
    { type: 'STRIKER', num: 1, label: 'STRIKER 1' },
    { type: 'STRIKER', num: 2, label: 'STRIKER 2' },
    { type: 'STRIKER', num: 3, label: 'STRIKER 3' },
    { type: 'STRIKER', num: 4, label: 'STRIKER 4' },
    { type: 'SPECIAL', num: 1, label: 'SPECIAL 1' },
    { type: 'SPECIAL', num: 2, label: 'SPECIAL 2' }
  ];

  // 丸数字マップ
  const CIRCLE_NUMBERS = {
    1: '①',
    2: '②',
    3: '③',
    4: '④',
    5: '⑤'
  };

  const GAME_COLOR_YELLOW = '#ffee61'; // ゲーム画面の開始スキル1~3の黄色
  const GAME_COLOR_BLUE = '#5fd2fe';   // ゲーム画面の開始スキル4~5のシアンブルー

  // 制限時間別 スコアテーブル定義
  const SCORE_TABLES = {
    '3min': [
      { name: 'NORMAL', hp: 229000, diff: 250000, rate: 120, max: 911000 },
      { name: 'HARD', hp: 458000, diff: 500000, rate: 240, max: 1822000 },
      { name: 'VERYHARD', hp: 916000, diff: 1000000, rate: 480, max: 3644000 },
      { name: 'HARDCORE', hp: 1832000, diff: 2000000, rate: 960, max: 7288000 },
      { name: 'EXTREME', hp: 5392000, diff: 4000000, rate: 1440, max: 14576000 },
      { name: 'INSANE', hp: 12449600, diff: 6800000, rate: 1920, max: 26161600 },
      { name: 'TORMENT', hp: 18876000, diff: 12200000, rate: 2400, max: 39716000 },
      { name: 'LUNATIC', hp: 25525000, diff: 17710000, rate: 2880, max: 53603000 }
    ],
    '4min': [
      { name: 'NORMAL', hp: 277000, diff: 250000, rate: 120, max: 959000 },
      { name: 'HARD', hp: 554000, diff: 500000, rate: 240, max: 1918000 },
      { name: 'VERYHARD', hp: 1108000, diff: 1000000, rate: 480, max: 3836000 },
      { name: 'HARDCORE', hp: 2216000, diff: 2000000, rate: 960, max: 7672000 },
      { name: 'EXTREME', hp: 616000, diff: 4000000, rate: 1440, max: 15344000 },
      { name: 'INSANE', hp: 14216000, diff: 6800000, rate: 1920, max: 27928000 },
      { name: 'TORMENT', hp: 19508000, diff: 12200000, rate: 2400, max: 40348000 },
      { name: 'LUNATIC', hp: 26315000, diff: 17710000, rate: 2880, max: 54393000 }
    ],
    '4min30s': [
      { name: 'NORMAL', hp: 304700, diff: 250000, rate: 120, max: 986700 },
      { name: 'HARD', hp: 609400, diff: 500000, rate: 240, max: 1973400 },
      { name: 'VERYHARD', hp: 1218800, diff: 1000000, rate: 480, max: 3946800 },
      { name: 'HARDCORE', hp: 2437600, diff: 2000000, rate: 960, max: 7893600 },
      { name: 'EXTREME', hp: 6578880, diff: 4000000, rate: 1440, max: 15762880 },
      { name: 'INSANE', hp: 14941016, diff: 6800000, rate: 1920, max: 28653016 },
      { name: 'TORMENT', hp: 20302000, diff: 12200000, rate: 2400, max: 41142000 },
      { name: 'LUNATIC', hp: 26954000, diff: 17710000, rate: 2880, max: 55032000 }
    ]
  };

  /**
   * スコアから難易度と戦闘時間を逆算
   */
  function calculateBattleTime(scoreVal, timeLimitKey = '4min') {
    const table = SCORE_TABLES[timeLimitKey] || SCORE_TABLES['4min'];
    if (!scoreVal) return null;

    const raw = String(scoreVal).replace(/[^0-9]/g, '');
    if (!raw) return null;
    const score = parseInt(raw, 10);
    if (isNaN(score) || score <= 0) return null;

    let matchedDiff = null;
    for (let i = 0; i < table.length; i++) {
      const prevMax = i > 0 ? table[i - 1].max : 0;
      if (score > prevMax && score <= table[i].max) {
        matchedDiff = table[i];
        break;
      }
    }

    if (!matchedDiff) {
      if (score > table[table.length - 1].max) {
        matchedDiff = table[table.length - 1];
      } else {
        return null;
      }
    }

    const fixedScore = matchedDiff.hp + matchedDiff.diff;
    let timeScore = score - fixedScore;
    if (timeScore < 0) timeScore = 0;

    const seconds = 3600 - (timeScore / matchedDiff.rate);
    const finalSec = seconds < 0 ? 0 : seconds;
    const secRounded = Math.round(finalSec * 100) / 100;

    const m = Math.floor(finalSec / 60);
    const s = finalSec - (m * 60);
    const sRounded = Math.round(s * 100) / 100;

    const formattedSec = `${secRounded.toFixed(2)}秒`;
    const formattedMinSec = `（${m}分${sRounded.toFixed(2)}秒）`;

    return {
      difficulty: matchedDiff.name,
      seconds: secRounded,
      minutes: m,
      remainSeconds: sRounded,
      formatted_sec: formattedSec,
      formatted_min_sec: formattedMinSec
    };
  }

  const DEFAULT_HEADING_TITLE = 'ランキング上位で使用された生徒';
  const DEFAULT_HEADING_ANCHOR = 'v40a9c46';
  const DEFAULT_CUSTOM_NOTES = 'ランキング1位にて使用された生徒を記す。';

  // アプリケーション状態
  const state = {
    timeLimit: '4min', // '4min' (他: 4分・デフォルト) | '3min' (ビナー・カイテン) | '4min30s' (イェソド)
    mode: 'total_assault', // 'total_assault' (総力戦 - 初期フォーカス) | 'grand_assault' (大決戦)
    selectedArmorIds: [], // 大決戦の選択順 (初期値: 未選択)
    totalAssaultArmorId: 'heavy', // 総力戦の属性
    skillFormat: 'skill_row', // 'skill_row' (推奨・番号行2段構成) | 'bgcolor' | 'badge_top' | 'badge_bottom' | 'both' | 'none'
    headingTitle: DEFAULT_HEADING_TITLE,
    headingAnchor: DEFAULT_HEADING_ANCHOR,
    customNotes: DEFAULT_CUSTOM_NOTES,
    students: [], // 生徒マスターリスト
    // 編成データ: { [armorKey]: [ { rankText: '1位', score: '', units: [ { name: '', imgFile: '', iconUrl: '', startSkillOrder: 0 }, ... ] } ] }
    formations: {}
  };

  // DOM要素
  const dom = {};

  // 初期化
  document.addEventListener('DOMContentLoaded', () => {
    initDomReferences();
    loadStudentDatabase();
    loadSavedAppState(); // 保存データの復元
    bindEvents();
    syncUIWithState();
    updateStudentCountBadge();
  });

  function initDomReferences() {
    dom.btnGrandAssault = document.getElementById('btn-mode-grand');
    dom.btnTotalAssault = document.getElementById('btn-mode-total');
    dom.grandArmorContainer = document.getElementById('grand-armor-container');
    dom.totalArmorContainer = document.getElementById('total-armor-container');
    dom.armorOrderList = document.getElementById('armor-order-list');
    dom.armorButtons = document.getElementById('armor-buttons');
    dom.formationSections = document.getElementById('formation-sections');
    dom.btnGenerate = document.getElementById('btn-generate');
    dom.btnCopyTop = document.getElementById('btn-copy-top');
    dom.btnCopyBottom = document.getElementById('btn-copy-bottom');
    dom.outputWiki = document.getElementById('output-wiki');
    dom.previewContainer = document.getElementById('preview-container');
    dom.btnCrawl = document.getElementById('btn-crawl');
    dom.studentCountBadge = document.getElementById('student-count-badge');
    dom.lastUpdatedBadge = document.getElementById('last-updated-badge');
    dom.toast = document.getElementById('toast');
    dom.selectSkillFormat = document.getElementById('select-skill-format');
    dom.btnResetFormation = document.getElementById('btn-reset-formation');
    dom.saveStatusBadge = document.getElementById('save-status-badge');
    dom.inputHeadingTitle = document.getElementById('input-heading-title');
    dom.inputHeadingAnchor = document.getElementById('input-heading-anchor');
    dom.inputCustomNotes = document.getElementById('input-custom-notes');
    dom.btnResetNotes = document.getElementById('btn-reset-notes');
  }

  // 生徒データベース読み込み (JSONフェッチ ＆ フォールバック対応)
  async function loadStudentDatabase() {
    // 1. 初期内包データから即時反映
    state.students = window.DEFAULT_STUDENTS || [];
    state.lastUpdated = (window.STUDENTS_METADATA && window.STUDENTS_METADATA.lastUpdated) ? window.STUDENTS_METADATA.lastUpdated : '';
    updateStudentCountBadge();

    // 2. data/students-data.json があれば最新データを非同期取得
    try {
      const res = await fetch('data/students-data.json');
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.students) && json.students.length > 0) {
          state.students = json.students;
          state.lastUpdated = json.lastUpdated || state.lastUpdated;
          updateStudentCountBadge();
        }
      }
    } catch (e) {
      // ローカル file:// プロトコルやオフライン時は内包データを使用
      console.info('Using bundled students database.');
    }
  }

  // LocalStorageから状態の読み込み (過去バージョンキーからの自動マイグレーション付き)
  function loadSavedAppState() {
    try {
      const keysToCheck = [
        STORAGE_STATE_KEY,
        'ba_ranking_formation_state_v5',
        'ba_ranking_formation_state_v4',
        'ba_ranking_formation_state_v3',
        'ba_ranking_formation_state_v2',
        'ba_ranking_formation_state'
      ];

      let saved = null;
      for (const key of keysToCheck) {
        const item = localStorage.getItem(key);
        if (item) {
          saved = item;
          break;
        }
      }

      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          if (parsed.timeLimit) state.timeLimit = parsed.timeLimit;
          if (parsed.mode) state.mode = parsed.mode;
          if (Array.isArray(parsed.selectedArmorIds)) state.selectedArmorIds = parsed.selectedArmorIds;
          if (parsed.totalAssaultArmorId) state.totalAssaultArmorId = parsed.totalAssaultArmorId;
          if (parsed.skillFormat) state.skillFormat = parsed.skillFormat;
          if (parsed.headingTitle !== undefined) state.headingTitle = parsed.headingTitle;
          if (parsed.headingAnchor !== undefined) state.headingAnchor = parsed.headingAnchor;
          if (parsed.customNotes !== undefined) state.customNotes = parsed.customNotes;
          if (parsed.formations && typeof parsed.formations === 'object') {
            state.formations = parsed.formations;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load saved app state:', e);
    }

    initDefaultFormationsIfNeeded();
  }

  // LocalStorageへ状態の自動保存
  function saveAppState() {
    try {
      const dataToSave = {
        timeLimit: state.timeLimit,
        mode: state.mode,
        selectedArmorIds: state.selectedArmorIds,
        totalAssaultArmorId: state.totalAssaultArmorId,
        skillFormat: state.skillFormat,
        headingTitle: state.headingTitle,
        headingAnchor: state.headingAnchor,
        customNotes: state.customNotes,
        formations: state.formations
      };
      localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(dataToSave));
      flashSaveIndicator();
    } catch (e) {
      console.error('Failed to save app state:', e);
    }
  }

  // 保存インジケーターの一時点滅
  function flashSaveIndicator() {
    if (!dom.saveStatusBadge) return;
    dom.saveStatusBadge.textContent = '💾 保存しました';
    dom.saveStatusBadge.style.color = '#00b894';
    clearTimeout(dom.saveStatusBadge._timer);
    dom.saveStatusBadge._timer = setTimeout(() => {
      dom.saveStatusBadge.textContent = '💾 自動保存有効';
      dom.saveStatusBadge.style.color = '#2ed573';
    }, 1500);
  }

  // 初期編成データ補完
  function initDefaultFormationsIfNeeded() {
    ALL_ARMOR_TYPES.forEach(armor => {
      if (!state.formations[armor.id] || state.formations[armor.id].length === 0) {
        state.formations[armor.id] = [createDefaultTeam(1, 1)];
      }
    });
    if (!state.formations['total'] || state.formations['total'].length === 0) {
      state.formations['total'] = [createDefaultTeam(1, 1)];
    }
  }

  // デフォルト部隊データ作成
  function createDefaultTeam(teamIndex, totalTeams) {
    const isMulti = totalTeams > 1;
    const rankText = isMulti ? `1位${teamIndex}凸目` : `1位`;
    return {
      rankText: rankText,
      score: '',
      units: Array.from({ length: 6 }, () => ({
        name: '',
        imgFile: '',
        iconUrl: '',
        startSkillOrder: 0 // 0: なし, 1~5: 指定順
      }))
    };
  }

  // 状態とUIの完全同期
  function syncUIWithState() {
    // 制限時間ボタン
    document.querySelectorAll('.btn-time-limit').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.time === state.timeLimit);
    });

    // モードボタン
    if (state.mode === 'grand_assault') {
      dom.btnGrandAssault.classList.add('active');
      dom.btnTotalAssault.classList.remove('active');
      dom.grandArmorContainer.style.display = 'block';
      dom.totalArmorContainer.style.display = 'none';
    } else {
      dom.btnGrandAssault.classList.remove('active');
      dom.btnTotalAssault.classList.add('active');
      dom.grandArmorContainer.style.display = 'none';
      dom.totalArmorContainer.style.display = 'block';
    }

    // 出力形式セレクトボックス
    if (dom.selectSkillFormat && state.skillFormat) {
      dom.selectSkillFormat.value = state.skillFormat;
    }

    // 見出し・注釈テキスト
    if (dom.inputHeadingTitle) dom.inputHeadingTitle.value = state.headingTitle || '';
    if (dom.inputHeadingAnchor) dom.inputHeadingAnchor.value = state.headingAnchor || '';
    if (dom.inputCustomNotes) dom.inputCustomNotes.value = state.customNotes || '';

    renderArmorSelector();
    renderFormationForms();
  }

  // イベント設定
  function bindEvents() {
    // 制限時間ボタン切替
    document.querySelectorAll('.btn-time-limit').forEach(btn => {
      btn.addEventListener('click', () => {
        state.timeLimit = btn.dataset.time;
        document.querySelectorAll('.btn-time-limit').forEach(b => {
          b.classList.toggle('active', b.dataset.time === state.timeLimit);
        });
        saveAppState();
        renderFormationForms(); // 各部隊の戦闘時間を再計算
      });
    });

    // モード切替
    dom.btnGrandAssault.addEventListener('click', () => setMode('grand_assault'));
    dom.btnTotalAssault.addEventListener('click', () => setMode('total_assault'));

    // 生成ボタン
    dom.btnGenerate.addEventListener('click', () => generateAndCopyWiki());
    if (dom.btnCopyTop) dom.btnCopyTop.addEventListener('click', () => copyWikiText());
    if (dom.btnCopyBottom) dom.btnCopyBottom.addEventListener('click', () => copyWikiText());

    // 出力形式セレクター変更
    if (dom.selectSkillFormat) {
      dom.selectSkillFormat.addEventListener('change', (e) => {
        state.skillFormat = e.target.value;
        saveAppState();
        generateWikiText(false);
      });
    }

    // リセットボタン
    if (dom.btnResetFormation) {
      dom.btnResetFormation.addEventListener('click', () => handleResetAll());
    }

    // 見出し・注記文の入力イベント
    if (dom.inputHeadingTitle) {
      dom.inputHeadingTitle.addEventListener('input', (e) => {
        state.headingTitle = e.target.value;
        saveAppState();
      });
    }
    if (dom.inputHeadingAnchor) {
      dom.inputHeadingAnchor.addEventListener('input', (e) => {
        state.headingAnchor = e.target.value;
        saveAppState();
      });
    }
    if (dom.inputCustomNotes) {
      dom.inputCustomNotes.addEventListener('input', (e) => {
        state.customNotes = e.target.value;
        saveAppState();
      });
    }
    if (dom.btnResetNotes) {
      dom.btnResetNotes.addEventListener('click', () => {
        state.headingTitle = DEFAULT_HEADING_TITLE;
        state.headingAnchor = DEFAULT_HEADING_ANCHOR;
        state.customNotes = DEFAULT_CUSTOM_NOTES;
        if (dom.inputHeadingTitle) dom.inputHeadingTitle.value = state.headingTitle;
        if (dom.inputHeadingAnchor) dom.inputHeadingAnchor.value = state.headingAnchor;
        if (dom.inputCustomNotes) dom.inputCustomNotes.value = state.customNotes;
        saveAppState();
        showToast('見出し・注釈文を初期文言に戻しました', 'info');
      });
    }

    // 巡回ボタン
    if (dom.btnCrawl) dom.btnCrawl.addEventListener('click', handleCrawlWiki);

    // タブ切替（Wikiコード / プレビュー）
    const tabCode = document.getElementById('tab-code');
    const tabPreview = document.getElementById('tab-preview');
    if (tabCode && tabPreview) {
      tabCode.addEventListener('click', () => switchTab('code'));
      tabPreview.addEventListener('click', () => switchTab('preview'));
    }

    // ドキュメントクリックでサジェストドロップダウンを閉じる
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.student-input-container')) {
        closeAllSuggestions();
      }
    });
  }

  // 全体リセット処理
  function handleResetAll() {
    const ok = window.confirm('入力中の編成・スコア・選択属性データを初期状態に戻しますか？\n（この操作は取り消せません）');
    if (!ok) return;

    localStorage.removeItem(STORAGE_STATE_KEY);

    state.timeLimit = '4min';
    state.mode = 'total_assault';
    state.selectedArmorIds = [];
    state.totalAssaultArmorId = 'heavy';
    state.skillFormat = 'skill_row';
    state.headingTitle = DEFAULT_HEADING_TITLE;
    state.headingAnchor = DEFAULT_HEADING_ANCHOR;
    state.customNotes = DEFAULT_CUSTOM_NOTES;
    state.formations = {};
    initDefaultFormationsIfNeeded();

    syncUIWithState();
    dom.outputWiki.value = '';
    if (dom.previewContainer) dom.previewContainer.innerHTML = '';

    showToast('入力データを初期状態にリセットしました', 'info');
  }

  // モード変更
  function setMode(mode) {
    state.mode = mode;
    syncUIWithState();
    saveAppState();
  }

  // 属性セレクターの描画
  function renderArmorSelector() {
    if (state.mode === 'grand_assault') {
      renderGrandArmorButtons();
      renderGrandArmorOrderBadges();
    } else {
      renderTotalArmorButtons();
    }
  }

  // 大決戦の属性選択ボタン描画
  function renderGrandArmorButtons() {
    dom.armorButtons.innerHTML = '';
    ALL_ARMOR_TYPES.forEach(armor => {
      const isSelected = state.selectedArmorIds.includes(armor.id);
      const orderIndex = state.selectedArmorIds.indexOf(armor.id);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `armor-chip ${armor.id} ${isSelected ? 'selected' : ''}`;
      btn.innerHTML = `
        <span class="armor-chip-indicator" style="background-color: ${armor.color};"></span>
        <span class="armor-chip-name">${armor.name}</span>
        ${isSelected ? `<span class="armor-chip-badge">${orderIndex + 1}</span>` : ''}
      `;

      btn.addEventListener('click', () => {
        toggleGrandArmor(armor.id);
      });

      dom.armorButtons.appendChild(btn);
    });
  }

  // 選択順バッジと並べ替え表示
  function renderGrandArmorOrderBadges() {
    dom.armorOrderList.innerHTML = '';
    if (state.selectedArmorIds.length === 0) {
      dom.armorOrderList.innerHTML = '<span style="color: var(--text-muted); font-size: 13px;">属性が選択されていません。上のボタンから対象の属性を3つ選択してください。</span>';
      return;
    }
    state.selectedArmorIds.forEach((armorId, idx) => {
      const armor = ALL_ARMOR_TYPES.find(a => a.id === idx ? a : a.id === armorId);
      const targetArmor = ALL_ARMOR_TYPES.find(a => a.id === armorId);
      if (!targetArmor) return;

      const item = document.createElement('div');
      item.className = 'armor-order-item';
      item.style.borderColor = targetArmor.border;
      item.innerHTML = `
        <span class="order-num" style="background-color: ${targetArmor.color};">${idx + 1}</span>
        <span class="order-name">${targetArmor.name}</span>
        <div class="order-actions">
          <button type="button" class="btn-order-move" title="上へ移動" ${idx === 0 ? 'disabled' : ''} data-dir="-1" data-idx="${idx}">↑</button>
          <button type="button" class="btn-order-move" title="下へ移動" ${idx === state.selectedArmorIds.length - 1 ? 'disabled' : ''} data-dir="1" data-idx="${idx}">↓</button>
        </div>
      `;

      item.querySelectorAll('.btn-order-move').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const i = parseInt(btn.dataset.idx, 10);
          const dir = parseInt(btn.dataset.dir, 10);
          moveArmorOrder(i, i + dir);
        });
      });

      dom.armorOrderList.appendChild(item);
    });
  }

  // 総力戦の属性選択ボタン描画
  function renderTotalArmorButtons() {
    const container = document.getElementById('total-armor-buttons');
    if (!container) return;
    container.innerHTML = '';
    ALL_ARMOR_TYPES.forEach(armor => {
      const isSelected = state.totalAssaultArmorId === armor.id;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `armor-chip ${armor.id} ${isSelected ? 'selected' : ''}`;
      btn.innerHTML = `
        <span class="armor-chip-indicator" style="background-color: ${armor.color};"></span>
        <span class="armor-chip-name">${armor.name}</span>
      `;
      btn.addEventListener('click', () => {
        state.totalAssaultArmorId = armor.id;
        renderTotalArmorButtons();
        renderFormationForms();
        saveAppState();
      });
      container.appendChild(btn);
    });
  }

  // 大決戦の属性トグル（クリックで選択／解除、最大3つ）
  function toggleGrandArmor(armorId) {
    const idx = state.selectedArmorIds.indexOf(armorId);
    if (idx >= 0) {
      state.selectedArmorIds.splice(idx, 1);
    } else {
      if (state.selectedArmorIds.length >= 3) {
        showToast('大決戦の属性は最大3つまで選択できます。変更する場合は選択済みの属性をクリックして解除してください。', 'warning');
        return;
      }
      state.selectedArmorIds.push(armorId);
    }
    renderArmorSelector();
    renderFormationForms();
    saveAppState();
  }

  // 属性の順序入れ替え
  function moveArmorOrder(fromIdx, toIdx) {
    if (toIdx < 0 || toIdx >= state.selectedArmorIds.length) return;
    const temp = state.selectedArmorIds[fromIdx];
    state.selectedArmorIds[fromIdx] = state.selectedArmorIds[toIdx];
    state.selectedArmorIds[toIdx] = temp;
    renderArmorSelector();
    renderFormationForms();
    saveAppState();
  }

  // 編成フォーム全体の描画
  function renderFormationForms() {
    dom.formationSections.innerHTML = '';

    const totalArmorObj = ALL_ARMOR_TYPES.find(a => a.id === state.totalAssaultArmorId) || { id: 'heavy', name: '重装甲', color: '#fbc531', bg: 'rgba(251, 197, 49, 0.15)', border: '#e1b12c' };
    const currentSections = state.mode === 'grand_assault'
      ? state.selectedArmorIds.map(id => ALL_ARMOR_TYPES.find(a => a.id === id)).filter(Boolean)
      : [{ id: 'total', name: totalArmorObj.name, color: totalArmorObj.color, bg: totalArmorObj.bg, border: totalArmorObj.border }];

    if (state.mode === 'grand_assault' && currentSections.length === 0) {
      const emptyCard = document.createElement('div');
      emptyCard.className = 'formation-section-card empty-state-card';
      emptyCard.style.textAlign = 'center';
      emptyCard.style.padding = '40px 20px';
      emptyCard.style.color = 'var(--text-muted)';
      emptyCard.innerHTML = `
        <div style="font-size: 36px; margin-bottom: 12px;">👆</div>
        <div style="font-size: 16px; font-weight: bold; margin-bottom: 6px; color: var(--text-main);">大決戦の対象属性が選択されていません</div>
        <div style="font-size: 13px;">ステップ1のボタンから対象の3属性を選択してください。選択した順番で編成入力欄が表示されます。</div>
      `;
      dom.formationSections.appendChild(emptyCard);
      return;
    }

    currentSections.forEach((section, sIdx) => {
      const sectionEl = document.createElement('div');
      sectionEl.className = 'formation-section-card';
      sectionEl.dataset.sectionId = section.id;

      // セクションヘッダー
      const headerEl = document.createElement('div');
      headerEl.className = 'section-card-header';
      headerEl.style.borderLeftColor = section.color;
      headerEl.innerHTML = `
        <div class="section-title-wrap">
          ${state.mode === 'grand_assault' ? `<span class="section-order-badge" style="background-color: ${section.color};">${sIdx + 1}</span>` : ''}
          <h3 class="section-title">${section.name} 編成</h3>
          <span class="section-subtitle">#region(${section.name}) に出力</span>
        </div>
      `;
      sectionEl.appendChild(headerEl);

      // 部隊リストコンテナ
      const teamsContainer = document.createElement('div');
      teamsContainer.className = 'teams-container';
      sectionEl.appendChild(teamsContainer);

      // 部隊の描画
      renderTeams(section.id, teamsContainer);

      // 部隊追加ボタン
      const addTeamWrap = document.createElement('div');
      addTeamWrap.className = 'add-team-action-wrap';
      addTeamWrap.innerHTML = `
        <button type="button" class="btn-add-team">
          <span class="btn-icon">＋</span> 部隊を追加する (${(state.formations[section.id] || []).length + 1}凸目)
        </button>
      `;
      addTeamWrap.querySelector('.btn-add-team').addEventListener('click', () => {
        addTeam(section.id, teamsContainer);
      });
      sectionEl.appendChild(addTeamWrap);

      dom.formationSections.appendChild(sectionEl);
    });
  }

  // 各セクション内の部隊リスト描画
  function renderTeams(sectionId, container) {
    container.innerHTML = '';
    const teams = state.formations[sectionId] || [];

    teams.forEach((team, tIdx) => {
      const teamCard = document.createElement('div');
      teamCard.className = 'team-card';
      teamCard.dataset.teamIndex = tIdx;

      // 部隊ヘッダー（順位/凸表記 & 削除ボタン）
      const teamHeader = document.createElement('div');
      teamHeader.className = 'team-card-header';
      teamHeader.innerHTML = `
        <div class="team-label-wrap">
          <span class="team-badge">部隊 ${tIdx + 1}</span>
          <div class="rank-input-wrap">
            <label class="field-label">順位・凸表記:</label>
            <input type="text" class="input-rank-text" value="${escapeHtml(team.rankText)}" placeholder="例: 1位, 1位${tIdx + 1}凸目" />
          </div>
        </div>
        ${teams.length > 1 ? `<button type="button" class="btn-remove-team" title="この部隊を削除">ー 部隊を削除</button>` : ''}
      `;

      // 順位入力変更イベント
      const rankInput = teamHeader.querySelector('.input-rank-text');
      rankInput.addEventListener('input', (e) => {
        team.rankText = e.target.value;
        saveAppState();
      });

      // 部隊削除イベント
      const removeBtn = teamHeader.querySelector('.btn-remove-team');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          removeTeam(sectionId, tIdx, container);
        });
      }
      teamCard.appendChild(teamHeader);

      // 生徒スロットコンテナ（6枠）
      const slotsWrap = document.createElement('div');
      slotsWrap.className = 'slots-grid';

      SLOT_CONFIGS.forEach((slotCfg, slotIdx) => {
        const unit = team.units[slotIdx] || { name: '', imgFile: '', iconUrl: '', startSkillOrder: 0 };
        const slotEl = createStudentSlotElement(sectionId, tIdx, slotIdx, slotCfg, unit);
        slotsWrap.appendChild(slotEl);
      });
      teamCard.appendChild(slotsWrap);

      // スコア入力行
      const scoreRow = document.createElement('div');
      scoreRow.className = 'team-score-row';
      if (tIdx === 0) {
        const timeResult = calculateBattleTime(team.score, state.timeLimit);
        scoreRow.innerHTML = `
          <div class="score-input-wrap">
            <label class="field-label score-label">
              <span class="score-icon">★</span> スコア (ポイント):
            </label>
            <div class="score-field-box">
              <input type="text" class="input-score" value="${escapeHtml(team.score)}" placeholder="例: 39900000 (自動でカンマ整形)" />
              <span class="score-hint">※数字を入力すると自動でカンマ（39,900,000）が付きます</span>
            </div>
          </div>
          <div class="battle-time-calc-wrap">
            <label class="field-label time-label">
              <span class="time-icon">⏱️</span> 戦闘時間 (逆算):
            </label>
            <div class="battle-time-card ${timeResult ? 'has-value' : 'is-empty'}">
              <div class="time-sec-text">${timeResult ? escapeHtml(timeResult.formatted_sec) : '--.--秒'}</div>
              <div class="time-min-text">${timeResult ? escapeHtml(timeResult.formatted_min_sec) : '（-分--.--秒）'}</div>
              ${timeResult ? `<span class="diff-badge ${timeResult.difficulty.toLowerCase()}">${timeResult.difficulty}</span>` : ''}
            </div>
          </div>
        `;

        const scoreInput = scoreRow.querySelector('.input-score');
        const timeCard = scoreRow.querySelector('.battle-time-card');

        scoreInput.addEventListener('input', (e) => {
          const raw = e.target.value.replace(/[^0-9]/g, '');
          if (raw) {
            const formatted = Number(raw).toLocaleString('ja-JP');
            e.target.value = formatted;
            team.score = formatted;
          } else {
            team.score = '';
            e.target.value = '';
          }

          // リアルタイムで戦闘時間を更新
          const res = calculateBattleTime(team.score, state.timeLimit);
          if (res) {
            timeCard.className = 'battle-time-card has-value';
            timeCard.innerHTML = `
              <div class="time-sec-text">${escapeHtml(res.formatted_sec)}</div>
              <div class="time-min-text">${escapeHtml(res.formatted_min_sec)}</div>
              <span class="diff-badge ${res.difficulty.toLowerCase()}">${res.difficulty}</span>
            `;
          } else {
            timeCard.className = 'battle-time-card is-empty';
            timeCard.innerHTML = `
              <div class="time-sec-text">--.--秒</div>
              <div class="time-min-text">（-分--.--秒）</div>
            `;
          }

          saveAppState();
        });
      } else {
        scoreRow.innerHTML = `
          <div class="score-input-wrap multi-notice">
            <label class="field-label score-label">ポイント:</label>
            <div class="score-joined-badge">
              <span>2凸目以降のため、1凸目とセル結合（~）されます</span>
            </div>
          </div>
        `;
      }
      teamCard.appendChild(scoreRow);

      container.appendChild(teamCard);
    });
  }

  // 単一生徒スロット要素の作成
  function createStudentSlotElement(sectionId, teamIdx, slotIdx, slotCfg, unit) {
    const slotEl = document.createElement('div');
    const order = unit.startSkillOrder || 0;
    const isYellow = order >= 1 && order <= 3;
    const isBlue = order >= 4 && order <= 5;

    let skillClass = '';
    if (isYellow) skillClass = 'is-start-yellow';
    else if (isBlue) skillClass = 'is-start-blue';

    slotEl.className = `student-slot-card ${slotCfg.type.toLowerCase()}-slot ${skillClass}`;
    slotEl.dataset.slotIndex = slotIdx;

    const matchedStudent = findStudentByName(unit.name);
    const iconSrc = matchedStudent ? matchedStudent.iconUrl : (unit.iconUrl || '');

    slotEl.innerHTML = `
      <div class="slot-header">
        <span class="slot-type-badge ${slotCfg.type.toLowerCase()}">${slotCfg.label}</span>
        <!-- 開始スキル順セレクター (1~5) -->
        <div class="skill-order-selector" title="開始スキル順序を指定 (1~3:黄, 4~5:青)">
          <span class="skill-label">開始:</span>
          <div class="skill-btn-group">
            <button type="button" class="btn-skill-num ${order === 0 ? 'active' : ''}" data-num="0">無</button>
            <button type="button" class="btn-skill-num yellow ${order === 1 ? 'active' : ''}" data-num="1">1</button>
            <button type="button" class="btn-skill-num yellow ${order === 2 ? 'active' : ''}" data-num="2">2</button>
            <button type="button" class="btn-skill-num yellow ${order === 3 ? 'active' : ''}" data-num="3">3</button>
            <button type="button" class="btn-skill-num blue ${order === 4 ? 'active' : ''}" data-num="4">4</button>
            <button type="button" class="btn-skill-num blue ${order === 5 ? 'active' : ''}" data-num="5">5</button>
          </div>
        </div>
      </div>

      <div class="student-input-container">
        <input type="text" class="input-student-name" value="${escapeHtml(unit.name)}" placeholder="生徒名 (ひらがな可)" autocomplete="off" />
        ${unit.name ? `<button type="button" class="btn-clear-slot" title="クリア">×</button>` : ''}
        <div class="suggestion-dropdown" style="display: none;"></div>
      </div>

      <div class="slot-icon-preview">
        ${iconSrc ? `
          <div class="icon-img-wrap">
            <div class="thumb-container">
              <img src="${iconSrc}" alt="${escapeHtml(unit.name)}" class="student-thumb" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'80\\' height=\\'80\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%23e0e0e0\\'/><text x=\\'50%\\' y=\\'50%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' fill=\\'%23666\\' font-size=\\'12\\'>No Image</text></svg>'" />
              ${order > 0 ? `
                <div class="skill-badge-overlay ${isYellow ? 'badge-yellow' : 'badge-blue'}">
                  ${order}
                </div>
              ` : ''}
            </div>
            <span class="student-name-sub">${escapeHtml(unit.name)}</span>
          </div>
        ` : `
          <div class="icon-placeholder">
            <span class="placeholder-icon">👤</span>
            <span class="placeholder-text">生徒未選択</span>
          </div>
        `}
      </div>
    `;

    // インプット要素
    const input = slotEl.querySelector('.input-student-name');
    const dropdown = slotEl.querySelector('.suggestion-dropdown');
    const clearBtn = slotEl.querySelector('.btn-clear-slot');

    // フォーカス & 入力時のサジェスト
    input.addEventListener('focus', () => {
      showSuggestions(input.value, dropdown, (selected) => {
        applyStudentToSlot(sectionId, teamIdx, slotIdx, selected);
      });
    });

    input.addEventListener('input', (e) => {
      showSuggestions(e.target.value, dropdown, (selected) => {
        applyStudentToSlot(sectionId, teamIdx, slotIdx, selected);
      });
      const directMatch = findStudentByName(e.target.value);
      if (directMatch) {
        unit.name = directMatch.name;
        unit.imgFile = directMatch.imgFile;
        unit.iconUrl = directMatch.iconUrl;
      } else {
        unit.name = e.target.value;
      }
      saveAppState();
    });

    // キーボード操作（上下・Enter・ESC）
    input.addEventListener('keydown', (e) => {
      handleDropdownKeydown(e, dropdown, (selected) => {
        applyStudentToSlot(sectionId, teamIdx, slotIdx, selected);
      });
    });

    // クリアボタン
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        applyStudentToSlot(sectionId, teamIdx, slotIdx, null);
      });
    }

    // 開始スキル順ボタンのイベント
    slotEl.querySelectorAll('.btn-skill-num').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const num = parseInt(btn.dataset.num, 10);
        unit.startSkillOrder = (unit.startSkillOrder === num) ? 0 : num;
        saveAppState();

        const container = dom.formationSections.querySelector(`.formation-section-card[data-section-id="${sectionId}"] .teams-container`);
        if (container) {
          renderTeams(sectionId, container);
        }
      });
    });

    return slotEl;
  }

  // 生徒選択の反映
  function applyStudentToSlot(sectionId, teamIdx, slotIdx, student) {
    const team = state.formations[sectionId][teamIdx];
    if (!team) return;

    if (student) {
      team.units[slotIdx] = {
        ...team.units[slotIdx],
        name: student.name,
        imgFile: student.imgFile,
        iconUrl: student.iconUrl
      };
    } else {
      team.units[slotIdx] = {
        ...team.units[slotIdx],
        name: '',
        imgFile: '',
        iconUrl: '',
        startSkillOrder: 0
      };
    }

    saveAppState();

    const container = dom.formationSections.querySelector(`.formation-section-card[data-section-id="${sectionId}"] .teams-container`);
    if (container) {
      renderTeams(sectionId, container);
    }
  }

  // 部隊の追加
  function addTeam(sectionId, container) {
    const teams = state.formations[sectionId];
    const newTeamIndex = teams.length + 1;

    if (teams.length === 1 && teams[0].rankText === '1位') {
      teams[0].rankText = '1位1凸目';
    }

    teams.push(createDefaultTeam(newTeamIndex, newTeamIndex));
    renderTeams(sectionId, container);
    saveAppState();
    showToast(`${newTeamIndex}凸目を追加しました`, 'info');
  }

  // 部隊の削除
  function removeTeam(sectionId, teamIdx, container) {
    const teams = state.formations[sectionId];
    if (teams.length <= 1) return;

    teams.splice(teamIdx, 1);

    if (teams.length === 1 && teams[0].rankText === '1位1凸目') {
      teams[0].rankText = '1位';
    }

    renderTeams(sectionId, container);
    saveAppState();
    showToast('部隊を削除しました', 'info');
  }

  // 生徒名サジェスト表示（入力窓の上に展開）
  function showSuggestions(query, dropdown, onSelect) {
    closeAllSuggestions();

    const matches = window.BASearch
      ? window.BASearch.searchStudents(state.students, query, 15)
      : state.students.filter(s => s.name.includes(query)).slice(0, 15);

    if (matches.length === 0) {
      dropdown.innerHTML = '<div class="no-match">一致する生徒がいません</div>';
      dropdown.style.display = 'block';
      return;
    }

    dropdown.innerHTML = '<div class="suggestion-header">▼ 生徒候補（クリックまたは上下キーで選択）</div>';
    matches.forEach((s, idx) => {
      const item = document.createElement('div');
      item.className = `suggestion-item ${idx === 0 ? 'selected' : ''}`;
      item.dataset.index = idx;
      item.innerHTML = `
        <img src="${s.iconUrl}" class="sug-icon" onerror="this.style.display='none'" />
        <div class="sug-text">
          <div class="sug-name">${highlightMatch(s.name, query)}</div>
          <div class="sug-hira">${s.hiraName || ''}</div>
        </div>
      `;

      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        onSelect(s);
        dropdown.style.display = 'none';
      });

      dropdown.appendChild(item);
    });

    dropdown.style.display = 'block';
  }

  // キーボードでサジェスト選択
  function handleDropdownKeydown(e, dropdown, onSelect) {
    if (dropdown.style.display === 'none') return;

    const items = Array.from(dropdown.querySelectorAll('.suggestion-item'));
    if (items.length === 0) return;

    let currentIndex = items.findIndex(i => i.classList.contains('selected'));

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      currentIndex = (currentIndex + 1) % items.length;
      updateSelectedItem(items, currentIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      currentIndex = (currentIndex - 1 + items.length) % items.length;
      updateSelectedItem(items, currentIndex);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentIndex >= 0 && items[currentIndex]) {
        items[currentIndex].dispatchEvent(new MouseEvent('mousedown'));
      }
    } else if (e.key === 'Escape') {
      dropdown.style.display = 'none';
    }
  }

  function updateSelectedItem(items, newIndex) {
    items.forEach((item, idx) => {
      item.classList.toggle('selected', idx === newIndex);
      if (idx === newIndex) {
        item.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function closeAllSuggestions() {
    document.querySelectorAll('.suggestion-dropdown').forEach(d => {
      d.style.display = 'none';
    });
  }

  // 検索文字列のハイライト
  function highlightMatch(text, query) {
    if (!query) return escapeHtml(text);
    const q = query.trim();
    const regex = new RegExp(`(${escapeRegExp(q)})`, 'gi');
    return escapeHtml(text).replace(regex, '<span class="highlight">$1</span>');
  }

  // 名前から生徒オブジェクトを検索
  function findStudentByName(name) {
    if (!name) return null;
    return state.students.find(s => s.name === name || s.alt === `${name}_icon.png`) || null;
  }

  /**
   * Wikiテキストの生成ロジック
   */
  function buildWikiOutput() {
    const lines = [];

    // 見出し
    const title = state.headingTitle || 'ランキング上位で使用された生徒';
    const anchor = state.headingAnchor ? ` [#${state.headingAnchor}]` : '';
    lines.push(`*${title}${anchor}`);

    // 注釈文（テキストエリアの内容を行ごとに出力）
    if (state.customNotes) {
      const noteLines = state.customNotes.split('\n');
      noteLines.forEach(nl => {
        const trimmed = nl.trim();
        if (trimmed) {
          lines.push(trimmed.startsWith('-') ? trimmed : `-${trimmed}`);
        }
      });
    }
    lines.push('');

    const totalArmor = ALL_ARMOR_TYPES.find(a => a.id === state.totalAssaultArmorId) || { name: '重装甲' };
    const targetSections = state.mode === 'grand_assault'
      ? state.selectedArmorIds.map(id => ALL_ARMOR_TYPES.find(a => a.id === id)).filter(Boolean)
      : [{ id: 'total', name: totalArmor.name }];

    if (state.mode === 'grand_assault' && targetSections.length === 0) {
      lines.push('// ※大決戦の対象属性が選択されていません。ステップ1で属性を選択してください。');
      return lines.join('\n');
    }

    const KEYCAP_MAP = { 1: '1⃣', 2: '2⃣', 3: '3⃣', 4: '4⃣', 5: '5⃣' };

    // 各テーブルの1列目幅を揃えるための最大文字数を算出（最低5文字 "1位1凸目" 相当）
    let maxRankLen = 5;
    targetSections.forEach(section => {
      const teams = state.formations[section.id] || [];
      teams.forEach(team => {
        const rawRank = (team.rankText || '').replace(/^~/, '').trim();
        if (rawRank.length > maxRankLen) {
          maxRankLen = rawRank.length;
        }
      });
    });
    const headerFirstCell = `CENTER:${'　'.repeat(maxRankLen)}`;

    targetSections.forEach(section => {
      lines.push(`#region(${section.name})`);
      lines.push(section.name);

      // テーブルヘッダー（1列目に幅確保スペース、末尾にポイントと戦闘時間列）
      lines.push(`|${headerFirstCell}|CENTER:STRIKER1人目|CENTER:2人目|CENTER:3人目|CENTER:4人目|CENTER:SPECIAL1人目|CENTER:2人目|CENTER:ポイント|CENTER:戦闘時間|h`);

      const teams = state.formations[section.id] || [];
      const firstTeamScore = (teams.length > 0) ? (teams[0].score || '') : '';
      const timeResult = calculateBattleTime(firstTeamScore, state.timeLimit);
      const timeStr = timeResult ? `${timeResult.formatted_sec}&br;${timeResult.formatted_min_sec}` : '';

      teams.forEach((team, tIdx) => {
        const rankPrefix = team.rankText.startsWith('~') ? team.rankText : `~${team.rankText}`;

        if (state.skillFormat === 'skill_row') {
          // 【形式: skill_row】 アイコンの上に専用の番号行を配置（2段構成＆縦セル結合＆右寄せ1⃣2⃣3⃣4⃣5⃣）
          // 1行目: 番号セル行 (番号セルのみゲーム色、右寄せ)
          const skillRowCells = [];
          skillRowCells.push(rankPrefix); // 順位（1行目）

          for (let i = 0; i < 6; i++) {
            const unit = team.units[i] || { name: '', startSkillOrder: 0 };
            const order = unit.startSkillOrder || 0;
            const isYellow = order >= 1 && order <= 3;
            const isBlue = order >= 4 && order <= 5;
            const bgCode = isYellow ? GAME_COLOR_YELLOW : (isBlue ? GAME_COLOR_BLUE : '');
            const bgPrefix = bgCode ? `BGCOLOR(${bgCode}):` : '';

            if (order > 0) {
              const keycapChar = KEYCAP_MAP[order] || String(order);
              skillRowCells.push(`${bgPrefix}RIGHT:${keycapChar}`);
            } else {
              skillRowCells.push(`RIGHT:`);
            }
          }

          // ポイントセル & 戦闘時間セル（1凸目はスコア・時間、2凸目以降は結合）
          if (tIdx === 0) {
            skillRowCells.push(team.score || '');
            skillRowCells.push(timeStr);
          } else {
            skillRowCells.push('~');
            skillRowCells.push('~');
          }
          lines.push(`|${skillRowCells.join('|')}|`);

          // 2行目: 生徒アイコン行 (生徒アイコン枠はデフォルト無色背景)
          const iconRowCells = [];
          iconRowCells.push('~'); // 順位と縦結合

          for (let i = 0; i < 6; i++) {
            const unit = team.units[i] || { name: '', startSkillOrder: 0 };
            const student = findStudentByName(unit.name);

            if (unit.name) {
              let imgPath = unit.imgFile || (student ? student.imgFile : `img/${unit.name}_icon.png`);
              if (!imgPath.startsWith('img/')) imgPath = `img/${imgPath}`;
              const linkName = (student && student.wikiLink) ? student.wikiLink : unit.name;
              iconRowCells.push(`[[&ref(${imgPath},80x80);>${linkName}]]`);
            } else {
              iconRowCells.push('');
            }
          }

          iconRowCells.push('~'); // ポイントと縦結合
          iconRowCells.push('~'); // 戦闘時間と縦結合
          lines.push(`|${iconRowCells.join('|')}|`);

        } else {
          // 【その他の1行形式】
          const rowCells = [];
          rowCells.push(rankPrefix);

          for (let i = 0; i < 6; i++) {
            const unit = team.units[i] || { name: '', startSkillOrder: 0 };
            const student = findStudentByName(unit.name);
            const order = unit.startSkillOrder || 0;

            let cellContent = '';
            if (unit.name) {
              let imgPath = unit.imgFile || (student ? student.imgFile : `img/${unit.name}_icon.png`);
              if (!imgPath.startsWith('img/')) imgPath = `img/${imgPath}`;
              const linkName = (student && student.wikiLink) ? student.wikiLink : unit.name;

              const wikiLink = `[[&ref(${imgPath},80x80);>${linkName}]]`;
              const isYellow = order >= 1 && order <= 3;
              const isBlue = order >= 4 && order <= 5;
              const circleChar = CIRCLE_NUMBERS[order] || '';

              if (state.skillFormat === 'bgcolor') {
                if (isYellow) cellContent = `BGCOLOR(#ffff99):${wikiLink}`;
                else if (isBlue) cellContent = `BGCOLOR(#e1f5fe):${wikiLink}`;
                else cellContent = wikiLink;
              } else if (state.skillFormat === 'badge_top') {
                if (order > 0) {
                  const colorCode = isYellow ? '#d35400' : '#0984e3';
                  cellContent = `&color(${colorCode}){【${circleChar}】};&br;${wikiLink}`;
                } else {
                  cellContent = `&color(transparent){【　】};&br;${wikiLink}`;
                }
              } else if (state.skillFormat === 'badge_bottom') {
                if (order > 0) {
                  const colorCode = isYellow ? '#d35400' : '#0984e3';
                  cellContent = `${wikiLink}&br;&color(${colorCode}){${circleChar}};`;
                } else {
                  cellContent = `${wikiLink}&br;&color(transparent){　};`;
                }
              } else if (state.skillFormat === 'both') {
                const bgCode = isYellow ? '#ffff99' : (isBlue ? '#e1f5fe' : '');
                const bgPrefix = bgCode ? `BGCOLOR(${bgCode}):` : '';
                if (order > 0) {
                  const colorCode = isYellow ? '#d35400' : '#0984e3';
                  cellContent = `${bgPrefix}${wikiLink}&br;&color(${colorCode}){${circleChar}};`;
                } else {
                  cellContent = `${bgPrefix}${wikiLink}&br;&color(transparent){　};`;
                }
              } else {
                cellContent = wikiLink;
              }
            }

            rowCells.push(cellContent);
          }

          if (tIdx === 0) {
            rowCells.push(team.score || '');
            rowCells.push(timeStr);
          } else {
            rowCells.push('~');
            rowCells.push('~');
          }

          lines.push(`|${rowCells.join('|')}|`);
        }
      });

      lines.push('#endregion');
      lines.push('');
    });

    return lines.join('\n').trim();
  }

  // Wikiテキスト生成＆コピー実行
  function generateAndCopyWiki() {
    const wikiText = generateWikiText(true);
    copyToClipboard(wikiText, 'Wikiテキストを生成し、クリップボードにコピーしました！');
  }

  // テキスト生成＆画面反映
  function generateWikiText(shouldToast = false) {
    const text = buildWikiOutput();
    dom.outputWiki.value = text;
    renderHtmlPreview(text);

    if (shouldToast) {
      showToast('Wikiテキストを生成しました！', 'success');
    }
    return text;
  }

  // クリップボードへコピー
  function copyWikiText() {
    const text = dom.outputWiki.value || buildWikiOutput();
    dom.outputWiki.value = text;
    copyToClipboard(text, 'クリップボードにコピーしました！');
  }

  function copyToClipboard(text, msg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(msg, 'success');
      }).catch(() => {
        fallbackCopyText(text, msg);
      });
    } else {
      fallbackCopyText(text, msg);
    }
  }

  function fallbackCopyText(text, msg) {
    dom.outputWiki.select();
    try {
      document.execCommand('copy');
      showToast(msg, 'success');
    } catch (e) {
      showToast('コピーに失敗しました。枠内のテキストを手動でコピーしてください。', 'error');
    }
  }

  // HTMLプレビュー描画（Wiki風テーブル）
  function renderHtmlPreview(wikiText) {
    if (!dom.previewContainer) return;

    let html = '<div class="wiki-preview-content">';

    const totalArmorObj = ALL_ARMOR_TYPES.find(a => a.id === state.totalAssaultArmorId) || { name: '重装甲' };
    const sections = state.mode === 'grand_assault'
      ? state.selectedArmorIds.map(id => ALL_ARMOR_TYPES.find(a => a.id === id)).filter(Boolean)
      : [{ id: 'total', name: totalArmorObj.name }];

    if (state.mode === 'grand_assault' && sections.length === 0) {
      dom.previewContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted); font-size: 13px;">大決戦の対象属性が選択されていません。ステップ1で属性を選択してください。</div>';
      return;
    }

    sections.forEach(section => {
      html += `<div class="preview-region-badge">▼ ${escapeHtml(section.name)}</div>`;

      html += `
        <table class="preview-wiki-table">
          <thead>
            <tr>
              <th></th>
              <th>STRIKER 1人目</th>
              <th>2人目</th>
              <th>3人目</th>
              <th>4人目</th>
              <th>SPECIAL 1人目</th>
              <th>2人目</th>
              <th>ポイント</th>
              <th>戦闘時間</th>
            </tr>
          </thead>
          <tbody>
      `;

      const teams = state.formations[section.id] || [];
      const totalScore = teams.length > 0 ? (teams[0].score || '-') : '-';

      teams.forEach((team, tIdx) => {
        const isSkillRow = (state.skillFormat === 'skill_row');

        if (isSkillRow) {
          // 1行目: 番号行 (番号セルのみゲーム色、右寄せ)
          html += '<tr class="preview-skill-num-row">';
          html += `<th class="preview-rank-cell" rowspan="2">${escapeHtml(team.rankText)}</th>`;

          const KEYCAP_MAP = { 1: '1⃣', 2: '2⃣', 3: '3⃣', 4: '4⃣', 5: '5⃣' };

          for (let i = 0; i < 6; i++) {
            const unit = team.units[i];
            const order = unit.startSkillOrder || 0;
            const isYellow = order >= 1 && order <= 3;
            const isBlue = order >= 4 && order <= 5;
            let bgStyle = isYellow ? `background-color: ${GAME_COLOR_YELLOW};` : (isBlue ? `background-color: ${GAME_COLOR_BLUE};` : '');

            html += `<td class="preview-skill-num-cell" style="text-align: right; padding-right: 8px; ${bgStyle}">`;
            if (order > 0) {
              const keycapChar = KEYCAP_MAP[order] || String(order);
              html += `<span class="preview-keycap-emoji" style="font-size: 16px;">${keycapChar}</span>`;
            }
            html += '</td>';
          }

          if (tIdx === 0) {
            const timeRes = calculateBattleTime(totalScore, state.timeLimit);
            html += `<td class="preview-score-cell" rowspan="${teams.length * 2}">${escapeHtml(totalScore)}</td>`;
            html += `<td class="preview-time-cell" rowspan="${teams.length * 2}">`;
            if (timeRes) {
              html += `<div>${escapeHtml(timeRes.formatted_sec)}</div><div style="font-size: 11px; color: #0984e3;">${escapeHtml(timeRes.formatted_min_sec)}</div>`;
            } else {
              html += `-`;
            }
            html += `</td>`;
          }
          html += '</tr>';

          // 2行目: アイコン行 (アイコン背景はデフォルト無色)
          html += '<tr class="preview-icons-row">';
          for (let i = 0; i < 6; i++) {
            const unit = team.units[i];
            const student = findStudentByName(unit.name);
            const iconSrc = student ? student.iconUrl : (unit.iconUrl || '');

            html += `<td class="preview-unit-cell" style="background-color: transparent;">`;
            if (unit.name) {
              html += `
                <div class="preview-chara-box">
                  <div class="thumb-container">
                    ${iconSrc ? `<img src="${iconSrc}" class="preview-thumb" alt="${escapeHtml(unit.name)}" />` : ''}
                  </div>
                  <span class="preview-chara-name">${escapeHtml(unit.name)}</span>
                </div>
              `;
            }
            html += '</td>';
          }
          html += '</tr>';

        } else {
          // 従来の1行形式
          html += '<tr>';
          html += `<th class="preview-rank-cell">${escapeHtml(team.rankText)}</th>`;

          for (let i = 0; i < 6; i++) {
            const unit = team.units[i];
            const student = findStudentByName(unit.name);
            const iconSrc = student ? student.iconUrl : (unit.iconUrl || '');
            const order = unit.startSkillOrder || 0;
            const isYellow = order >= 1 && order <= 3;
            const isBlue = order >= 4 && order <= 5;

            let cellClass = '';
            if (state.skillFormat === 'bgcolor' || state.skillFormat === 'both') {
              if (isYellow) cellClass = 'cell-yellow';
              else if (isBlue) cellClass = 'cell-blue';
            }

            html += `<td class="preview-unit-cell ${cellClass}">`;
            if (unit.name) {
              html += `
                <div class="preview-chara-box">
                  <div class="thumb-container">
                    ${iconSrc ? `<img src="${iconSrc}" class="preview-thumb" alt="${escapeHtml(unit.name)}" />` : ''}
                    ${order > 0 ? `
                      <div class="skill-badge-overlay ${isYellow ? 'badge-yellow' : 'badge-blue'}">
                        ${order}
                      </div>
                    ` : ''}
                  </div>
                  <span class="preview-chara-name">${escapeHtml(unit.name)}</span>
                  ${order > 0 ? `<span class="preview-order-sub ${isYellow ? 'text-yellow' : 'text-blue'}">${CIRCLE_NUMBERS[order]} 開始${order}</span>` : ''}
                </div>
              `;
            }
            html += '</td>';
          }

          if (tIdx === 0) {
            const timeRes = calculateBattleTime(totalScore, state.timeLimit);
            html += `<td class="preview-score-cell" ${teams.length > 1 ? `rowspan="${teams.length}"` : ''}>${escapeHtml(totalScore)}</td>`;
            html += `<td class="preview-time-cell" ${teams.length > 1 ? `rowspan="${teams.length}"` : ''}>`;
            if (timeRes) {
              html += `<div>${escapeHtml(timeRes.formatted_sec)}</div><div style="font-size: 11px; color: #0984e3;">${escapeHtml(timeRes.formatted_min_sec)}</div>`;
            } else {
              html += `-`;
            }
            html += `</td>`;
          }
          html += '</tr>';
        }
      });

      html += `
          </tbody>
        </table>
      `;
    });

    html += '</div>';
    dom.previewContainer.innerHTML = html;
  }

  // タブ切り替え
  function switchTab(tabName) {
    const tabCode = document.getElementById('tab-code');
    const tabPreview = document.getElementById('tab-preview');
    const paneCode = document.getElementById('pane-code');
    const panePreview = document.getElementById('pane-preview');

    if (tabName === 'code') {
      tabCode.classList.add('active');
      tabPreview.classList.remove('active');
      paneCode.style.display = 'block';
      panePreview.style.display = 'none';
    } else {
      tabCode.classList.remove('active');
      tabPreview.classList.add('active');
      paneCode.style.display = 'none';
      panePreview.style.display = 'block';
      generateWikiText(false);
    }
  }

  // 生徒データ巡回ハンドラー
  async function handleCrawlWiki() {
    dom.btnCrawl.disabled = true;
    dom.btnCrawl.classList.add('loading');
    dom.btnCrawl.innerHTML = '<span class="spinner"></span> 巡回中...';

    showToast('Wiki「テーブル/キャラクター一覧」から生徒データを巡回・取得しています...', 'info');

    try {
      const result = await window.BACrawler.crawlWikiStudents((msg) => {
        showToast(msg, 'info', 2000);
      });

      if (result.success) {
        state.students = result.students;
        showToast(result.message, 'success', 5000);
      } else {
        showToast(result.message, 'warning', 5000);
      }
      updateStudentCountBadge();
    } catch (err) {
      showToast('巡回中にエラーが発生しました: ' + err.message, 'error');
    } finally {
      dom.btnCrawl.disabled = false;
      dom.btnCrawl.classList.remove('loading');
      dom.btnCrawl.innerHTML = '<span class="btn-icon">🔄</span> 生徒データを最新化 (巡回)';
    }
  }

  // バッジ更新
  function updateStudentCountBadge() {
    const count = state.students.length;
    if (dom.studentCountBadge) {
      dom.studentCountBadge.textContent = `${count} 名`;
    }
    if (dom.lastUpdatedBadge) {
      dom.lastUpdatedBadge.textContent = state.lastUpdated || '最新データ';
    }
  }

  // トースト通知
  function showToast(message, type = 'info', duration = 3000) {
    if (!dom.toast) return;
    dom.toast.className = `toast-notification ${type} show`;
    dom.toast.innerHTML = `
      <span class="toast-icon">${type === 'success' ? '✔' : type === 'warning' ? '⚠' : type === 'error' ? '✖' : 'ℹ'}</span>
      <span class="toast-message">${escapeHtml(message)}</span>
    `;

    clearTimeout(dom.toast._timer);
    dom.toast._timer = setTimeout(() => {
      dom.toast.classList.remove('show');
    }, duration);
  }

  // ユーティリティ
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

})();
