/**
 * Chrome拡張機能 バックグラウンドスクリプト
 * ツールバーの拡張機能アイコンクリック時に新規タブでメイン画面を開く
 */

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('index.html')
  });
});
