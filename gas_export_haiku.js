/**
 * ==========================================================================
 * うてな俳句会：俳句データ JSONエクスポート用 Google Apps Script (GAS)
 * ==========================================================================
 * 
 * 【使い方】
 * 1. スプレッドシート（俳句集成）を開きます。
 * 2. 画面上部メニューの「拡張機能」>「Apps Script」をクリックします。
 * 3. このスクリプトの内容をエディタに貼り付けて保存（フロッピーアイコン）します。
 * 4. スプレッドシートを再読み込み（リロード）すると、上部メニューの右端に
 *    「🌸 俳句アプリ連携」というメニューが表示されます。
 * 5. 「📋 最新の haiku.json を書き出す」をクリックすると、JSONが画面に表示され、
 *    ワンクリックでクリップボードにコピー または ファイル保存できます。
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🌸 俳句アプリ連携')
    .addItem('📋 最新の haiku.json を書き出す', 'exportHaikuJson')
    .addToUi();
}

function exportHaikuJson() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('俳句集成');
  if (!sheet) {
    sheet = ss.getActiveSheet();
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    SpreadsheetApp.getUi().alert('データが見つかりませんでした。');
    return;
  }

  let haikus = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    let phraseStr = row[0] ? String(row[0]).trim() : '';
    if (!phraseStr || phraseStr === '俳句' || phraseStr === '句') continue;

    let cleanSeason = row[6] ? String(row[6]).trim().toLowerCase() : '';
    if (cleanSeason === 'sinnen') cleanSeason = 'shinnen';
    if (cleanSeason === 'fuyu') cleanSeason = 'huyu';
    if (cleanSeason === 'season' || cleanSeason === '季節') continue;

    let customKigo = row[8] ? String(row[8]).trim() : '';
    let rawKigo = row[3] ? String(row[3]).trim() : '';
    let finalKigo = customKigo || rawKigo;

    haikus.push({
      phrase: phraseStr,
      author: row[1] ? String(row[1]).trim() : '作者不詳',
      authorKana: row[2] ? String(row[2]).trim() : '',
      kigo: finalKigo,
      parentKigo: row[4] ? String(row[4]).trim() : '',
      kigoKana: row[5] ? String(row[5]).trim() : '',
      season: cleanSeason,
      detailSeason: row[7] ? String(row[7]).trim() : '',
      issueYear: row[9] ? String(row[9]).trim() : '',
      issueMonth: row[10] ? String(row[10]).trim() : '',
      issueNumber: row[11] ? String(row[11]).trim() : ''
    });
  }

  const jsonString = JSON.stringify(haikus, null, 2);
  const count = haikus.length;

  const htmlOutput = HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body { font-family: sans-serif; padding: 15px; margin: 0; background: #faf9f6; }
          h3 { margin-top: 0; color: #2b2b2b; }
          .desc { font-size: 13px; color: #555; margin-bottom: 12px; }
          textarea { width: 100%; height: 260px; font-family: monospace; font-size: 11px; box-sizing: border-box; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
          .btn-row { margin-top: 12px; display: flex; gap: 10px; }
          button { padding: 8px 16px; font-size: 13px; border: none; border-radius: 4px; cursor: pointer; }
          .btn-copy { background: #4285f4; color: white; }
          .btn-download { background: #34a853; color: white; }
          .copied-msg { color: #0d8a2e; font-size: 12px; display: none; align-items: center; }
        </style>
      </head>
      <body>
        <h3>🌸 haiku.json 書き出し完了（合計 ${count} 句）</h3>
        <div class="desc">以下の内容をコピーして GitHub の <code>haiku.json</code> を上書きするか、ダウンロードしてファイルを置き換えてください。</div>
        <textarea id="jsonArea" readonly>${escapeHtml(jsonString)}</textarea>
        <div class="btn-row">
          <button class="btn-copy" onclick="copyJson()">📋 内容をコピー</button>
          <button class="btn-download" onclick="downloadJson()">💾 haiku.json をダウンロード</button>
          <span id="copyMsg" class="copied-msg">✔ コピーしました！</span>
        </div>
        <script>
          function copyJson() {
            const copyText = document.getElementById("jsonArea");
            copyText.select();
            document.execCommand("copy");
            document.getElementById("copyMsg").style.display = "inline";
            setTimeout(() => { document.getElementById("copyMsg").style.display = "none"; }, 3000);
          }
          function downloadJson() {
            const data = document.getElementById("jsonArea").value;
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'haiku.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        </script>
      </body>
    </html>
  `)
  .setWidth(650)
  .setHeight(420);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'haiku.json のエクスポート');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
