/**
 * 🌸 うてな歳時記データベース自動連携スクリプト（Google Apps Script）
 * 
 * 【機能】
 * 1. 既存の親季語がある場合 ➡ 親季語グループのすぐ下に挿入
 * 2. 全く新しい親季語（例: 「春の虎落笛」等）の場合 ➡ 該当する季節・詳細季節グループの末尾に「新規親季語」として自動挿入！
 * 3. H列の説明文・親季語かな・季節コードも完全連動
 */

function doPost(e) {
  try {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000); // 同時実行制御

    const data = JSON.parse(e.postData.contents);
    const kigo = (data.kigo || '').trim().replace(/[\s\u3000]+/g, '');
    const parentKigo = (data.parentKigo || kigo).trim().replace(/[\s\u3000]+/g, '');
    const season = (data.season || 'muki').trim();
    const detailSeason = (data.detailSeason || '無季').trim();
    const kigoKana = (data.kigoKana || '').trim();
    const description = (data.description || '').trim();

    if (!kigo) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: '季語が空です。'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('歳時記データベース');
    if (!sheet) sheet = ss.getSheets()[0];

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'データ行がありません。' })).setMimeType(ContentService.MimeType.JSON);
    }

    // A〜H列（8列分）を一括取得
    const values = sheet.getRange(2, 1, lastRow - 1, 8).getValues();

    let alreadyExists = false;
    let targetRowIndex = -1; // 既存親季語の最後の行
    let parentInfo = null;

    let sameSeasonLastRow = -1;       // 同じ季節の最後の行
    let sameDetailSeasonLastRow = -1; // 同じ詳細季節の最後の行

    for (let i = 0; i < values.length; i++) {
      const rowSeason = String(values[i][0]).trim();
      const rowDetailSeason = String(values[i][1]).trim();
      const rowParent = String(values[i][2]).trim();
      const rowParentKana = values[i][3];
      const rowIndividual = String(values[i][4]).trim();
      const rowChildKigos = values[i][6] || '';
      const rowDescription = values[i][7] || '';

      const currentRowNum = i + 2;

      // 季節・詳細季節の末尾位置を追跡
      if (rowSeason === season) {
        sameSeasonLastRow = currentRowNum;
        if (rowDetailSeason === detailSeason) {
          sameDetailSeasonLastRow = currentRowNum;
        }
      }

      // 既存の親季語と一致するか
      if (rowParent === parentKigo) {
        if (!parentInfo) {
          parentInfo = {
            season: rowSeason,
            detailSeason: rowDetailSeason,
            parentKigo: rowParent,
            parentKana: rowParentKana,
            childKigos: rowChildKigos,
            description: rowDescription
          };
        }
        targetRowIndex = currentRowNum;

        if (rowIndividual === kigo) {
          alreadyExists = true;
          break;
        }
      }
    }

    if (alreadyExists) {
      lock.releaseLock();
      return ContentService.createTextOutput(JSON.stringify({
        status: 'already_exists',
        message: 'この季語（' + kigo + '）は既に【' + parentKigo + '】に登録されています。'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // ケースA: 既存の親季語グループの中に挿入
    // ==========================================
    if (parentInfo && targetRowIndex !== -1) {
      const insertRowNum = targetRowIndex + 1;
      sheet.insertRowAfter(targetRowIndex);

      const newRowData = [
        parentInfo.season,
        parentInfo.detailSeason,
        parentInfo.parentKigo,
        parentInfo.parentKana,
        kigo,
        kigo.length,
        parentInfo.childKigos,
        parentInfo.description
      ];

      sheet.getRange(insertRowNum, 1, 1, 8).setValues([newRowData]);
      lock.releaseLock();

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        insertedRow: insertRowNum,
        message: '既存の親季語【' + parentKigo + '】（' + insertRowNum + '行目）に子季語『' + kigo + '』を追加しました！'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // ケースB: 完全新規の親季語として新設！
    // ==========================================
    // 挿入位置の決定：詳細季節の末尾 ➡ 季節の末尾 ➡ シートの一番下
    let insertAt = sameDetailSeasonLastRow !== -1 ? sameDetailSeasonLastRow : 
                   (sameSeasonLastRow !== -1 ? sameSeasonLastRow : lastRow);

    sheet.insertRowAfter(insertAt);
    const newRowNum = insertAt + 1;

    const newRowData = [
      season,
      detailSeason,
      parentKigo,
      kigoKana,
      kigo,
      kigo.length,
      kigo, // 子季語一覧初期値
      description
    ];

    sheet.getRange(newRowNum, 1, 1, 8).setValues([newRowData]);
    lock.releaseLock();

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      insertedRow: newRowNum,
      message: '✨ 完全新規の親季語【' + parentKigo + '】を季節『' + season + ' (' + detailSeason + ')』のグループ（' + newRowNum + '行目）に新設・登録しました！'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * シートメニューの追加
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🌸 歳時記データベース連携')
    .addItem('✨ 季語データベースを整頓（季節・親季語順にソート）', 'sortSaijikiDatabase')
    .addToUi();
}

/**
 * データベースの整頓
 */
function sortSaijikiDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('歳時記データベース');
  if (!sheet) sheet = ss.getSheets()[0];

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 3) return;

  const range = sheet.getRange(2, 1, lastRow - 1, lastCol);
  range.sort([
    { column: 1, ascending: true },
    { column: 2, ascending: true },
    { column: 3, ascending: true },
    { column: 6, ascending: false }
  ]);

  SpreadsheetApp.getUi().alert('✨ 歳時記データベースを季節・詳細季節・親季語順に綺麗に整頓しました！');
}
