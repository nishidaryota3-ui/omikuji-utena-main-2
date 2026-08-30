/**
 * ========================================================
 * 🖨️ print_engine.js - 句集の小冊子印刷・PDF組版専用エンジン
 * ========================================================
 */

// ========================================================
// 🖨️ 句集の小冊子印刷・PDF出力（A4横・片面手折り ＆ 両面小冊子面付け）
// ========================================================

let currentPrintMode = 'single'; // 'single' | 'booklet'
let printIncludeYearMonth = true; // true: 年月挿入する | false: 挿入しない

function openPrintModal() {
    const modal = document.getElementById('printSettingModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
}

function closePrintModal(event) {
    if (event) event.stopPropagation();
    const modal = document.getElementById('printSettingModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

function setPrintMode(mode) {
    currentPrintMode = mode;
    const singleBtn = document.getElementById('printModeSingleBtn');
    const bookletBtn = document.getElementById('printModeBookletBtn');
    const noteEl = document.getElementById('printSubNote');

    if (singleBtn) singleBtn.classList.toggle('active', mode === 'single');
    if (bookletBtn) bookletBtn.classList.toggle('active', mode === 'booklet');

    if (noteEl) {
        if (mode === 'single') {
            noteEl.innerText = '※片面印刷：A4横に2ページ並べて印刷し、半分に折って重ねるだけの簡単製本';
        } else {
            noteEl.innerText = '※両面小冊子：コンビニやプリンターの両面印刷（短辺とじ）で二つ折り中綴じ製本';
        }
    }
}

function setPrintYearMonth(include) {
    printIncludeYearMonth = include;
    const onBtn = document.getElementById('printYearMonthOnBtn');
    const offBtn = document.getElementById('printYearMonthOffBtn');
    if (onBtn) onBtn.classList.toggle('active', include === true);
    if (offBtn) offBtn.classList.toggle('active', include === false);
}

function onPrintOptionChanged() {
    // 句数変更時のフック
}

// 🖨️ 印刷実行（独立iframeによる高精度PDF出力）
function executeKushuPrint() {
    if (!currentKushuAuthor) {
        alert('作者が選択されていません。');
        return;
    }

    const selectEl = document.getElementById('printLinesPerPage');
    const linesPerPage = selectEl ? (parseInt(selectEl.value, 10) || 5) : 5;

    // 当該作者の全句を時系列順に抽出
    let authorHaikus = haikuDatabase.filter(h => h.author === currentKushuAuthor);
    if (authorHaikus.length === 0) {
        alert('印刷できる作品がありません。');
        return;
    }

    // 時系列ソート
    authorHaikus.sort((a, b) => {
        const yearA = parseInt(a.issueYear, 10) || 0;
        const yearB = parseInt(b.issueYear, 10) || 0;
        if (yearA !== yearB) return yearA - yearB;
        const monthA = parseInt(a.issueMonth, 10) || 0;
        const monthB = parseInt(b.issueMonth, 10) || 0;
        if (monthA !== monthB) return monthA - monthB;
        return (a.orderInIssue || 0) - (b.orderInIssue || 0);
    });

    const bookletTitle = `${currentKushuAuthor} 句集`;

    // 🌟 ページ分割（Pagination）ロジック：
    // 年月見出しも俳句と同じ「1列」としてカウントし、1ページ最大列数（例: 5句+日付=6列）で均等分割
    const maxColumnsPerPage = printIncludeYearMonth ? (linesPerPage + 1) : linesPerPage;
    const haikuPages = [];
    let currentPageItems = [];
    let currentColumnCountInPage = 0;
    let lastIssueKey = '';

    authorHaikus.forEach(h => {
        if (printIncludeYearMonth) {
            const eraStr = h.issueYear ? toJapaneseEra(h.issueYear) : '';
            const monthStr = h.issueMonth ? toKanjiMonth(h.issueMonth) : '';
            const currentIssueKey = `${eraStr}${monthStr}`;
            
            // 号が変わったら年月見出しを1列として挿入
            if (currentIssueKey && currentIssueKey !== lastIssueKey) {
                lastIssueKey = currentIssueKey;
                
                // もしページがいっぱいなら次ページへ
                if (currentColumnCountInPage >= maxColumnsPerPage) {
                    haikuPages.push({ type: 'body', items: currentPageItems });
                    currentPageItems = [];
                    currentColumnCountInPage = 0;
                }
                
                currentPageItems.push({ type: 'header', text: currentIssueKey });
                currentColumnCountInPage++;
            }
        }

        // もしページがいっぱいなら次ページへ
        if (currentColumnCountInPage >= maxColumnsPerPage) {
            haikuPages.push({ type: 'body', items: currentPageItems });
            currentPageItems = [];
            currentColumnCountInPage = 0;
        }

        currentPageItems.push({ type: 'haiku', data: h });
        currentColumnCountInPage++;
    });

    // 残りの句があれば最後のページとして追加
    if (currentPageItems.length > 0) {
        haikuPages.push({ type: 'body', items: currentPageItems });
    }

    // 既存の印刷用iframeがあれば完全削除
    let printIframe = document.getElementById('utena_print_iframe');
    if (printIframe) printIframe.remove();

    printIframe = document.createElement('iframe');
    printIframe.id = 'utena_print_iframe';
    printIframe.style.position = 'fixed';
    printIframe.style.top = '0px';
    printIframe.style.left = '0px';
    printIframe.style.width = '0px';
    printIframe.style.height = '0px';
    printIframe.style.opacity = '0';
    printIframe.style.pointerEvents = 'none';
    printIframe.style.zIndex = '-9999';
    printIframe.style.border = 'none';
    document.body.appendChild(printIframe);

    const doc = printIframe.contentWindow.document;
    doc.open();

    let sheetsHtml = '';

    // 半面ページ（A5縦相当）のHTMLレンダリングヘルパー
    function renderHalfPageHtml(pageObj) {
        if (!pageObj || pageObj.type === 'blank') {
            return `
                <div class="sheet-half">
                    <div class="sheet-half-content"></div>
                    <div class="print-nombre"></div>
                </div>
            `;
        }
        if (pageObj.type === 'cover') {
            return `
                <div class="sheet-half">
                    <div class="sheet-half-content cover-page-content">
                        <div class="print-cover-title">${escapeHtml(currentKushuAuthor)}　句集</div>
                    </div>
                    <div class="print-nombre"></div>
                </div>
            `;
        }
        if (pageObj.type === 'tobira') {
            return `
                <div class="sheet-half">
                    <div class="sheet-half-content cover-page-content">
                        <div class="print-tobira-title">${escapeHtml(currentKushuAuthor)}　句集</div>
                    </div>
                    <div class="print-nombre"></div>
                </div>
            `;
        }
        if (pageObj.type === 'colophon') {
            return `
                <div class="sheet-half">
                    <div class="sheet-half-content colophon-page-content">
                        <div class="colophon-left-block">
                            <div class="print-colophon-brand">うてな俳句会</div>
                            <img src="./stamp_utena.png?v=2" class="print-colophon-stamp" alt="うてな">
                        </div>
                    </div>
                    <div class="print-nombre"></div>
                </div>
            `;
        }

        // 本文ページ：アイテム（年月見出し／俳句）を右端から固定ピッチで展開
        let innerHtml = '';
        (pageObj.items || []).forEach(item => {
            if (item.type === 'header') {
                innerHtml += `<div class="print-issue-header">${escapeHtml(item.text)}</div>`;
            } else if (item.type === 'haiku') {
                innerHtml += `<div class="print-phrase-line">${formatPrintRubyText(item.data.phrase)}</div>`;
            }
        });

        const nombreHtml = pageObj.pageNumber ? `- ${pageObj.pageNumber} -` : '';

        return `
            <div class="sheet-half">
                <div class="sheet-half-content">
                    ${innerHtml}
                </div>
                <div class="print-nombre">${nombreHtml}</div>
            </div>
        `;
    }

    if (currentPrintMode === 'single') {
        // ==========================================
        // 🅰️ 片面手折り（A4横に2面配置、右から左へ流れる）
        // ==========================================
        // Sheet 1: 表紙シート（右面: 表紙、左面: 余白）
        sheetsHtml += `
            <div class="print-sheet">
                <div class="sheet-half">
                    <div class="sheet-half-content"></div>
                    <div class="print-nombre"></div>
                </div>
                <div class="sheet-divider"></div>
                ${renderHalfPageHtml({ type: 'cover' })}
            </div>
        `;

        // Sheet 2以降: 本文見開き
        let pageNumCounter = 1;
        for (let i = 0; i < haikuPages.length; i += 2) {
            const rightPageObj = { ...haikuPages[i], pageNumber: pageNumCounter++ };
            const leftPageObj = haikuPages[i + 1] ? { ...haikuPages[i + 1], pageNumber: pageNumCounter++ } : { type: 'blank' };

            sheetsHtml += `
                <div class="print-sheet">
                    ${renderHalfPageHtml(leftPageObj)}
                    <div class="sheet-divider"></div>
                    ${renderHalfPageHtml(rightPageObj)}
                </div>
            `;
        }

        // 最終奥付シート
        sheetsHtml += `
            <div class="print-sheet">
                ${renderHalfPageHtml({ type: 'colophon' })}
                <div class="sheet-divider"></div>
                <div class="sheet-half"><div class="sheet-half-content"></div><div class="print-nombre"></div></div>
            </div>
        `;
    } else {
        // ==========================================
        // 🅱️ 両面小冊子（コンビニ中綴じ面付け・右綴じ）
        // ==========================================
        const logicalPages = [];
        logicalPages.push({ type: 'cover' });
        logicalPages.push({ type: 'tobira' });

        haikuPages.forEach((p, idx) => {
            logicalPages.push({ ...p, pageNumber: idx + 1 });
        });

        logicalPages.push({ type: 'colophon' });

        // 4の倍数になるよう白紙パディング
        while (logicalPages.length % 4 !== 0) {
            logicalPages.splice(logicalPages.length - 1, 0, { type: 'blank' });
        }

        const totalPages = logicalPages.length;
        const totalSheets = totalPages / 4;

        // 面付けループ
        for (let s = 1; s <= totalSheets; s++) {
            // 表面（オモテ）: [ 左: Page 2s - 1 | 右: Page N - 2s + 2 ]
            const leftIdxFront = (2 * s - 1) - 1;
            const rightIdxFront = (totalPages - 2 * s + 2) - 1;

            sheetsHtml += `
                <div class="print-sheet">
                    ${renderHalfPageHtml(logicalPages[leftIdxFront])}
                    <div class="sheet-divider"></div>
                    ${renderHalfPageHtml(logicalPages[rightIdxFront])}
                </div>
            `;

            // 裏面（ウラ）: [ 左: Page N - 2s + 1 | 右: Page 2s ]
            const leftIdxBack = (totalPages - 2 * s + 1) - 1;
            const rightIdxBack = (2 * s) - 1;

            sheetsHtml += `
                <div class="print-sheet">
                    ${renderHalfPageHtml(logicalPages[leftIdxBack])}
                    <div class="sheet-divider"></div>
                    ${renderHalfPageHtml(logicalPages[rightIdxBack])}
                </div>
            `;
        }
    }

    // 🌟 全ページで統一される列間隔（ピッチ）の計算
    const columnGap = maxColumnsPerPage >= 6 ? '18.0mm' : (maxColumnsPerPage === 5 ? '23.5mm' : (maxColumnsPerPage === 4 ? '32.0mm' : (maxColumnsPerPage === 3 ? '45.0mm' : (maxColumnsPerPage === 2 ? '70.0mm' : '0mm'))));

    // 独立iframe内の完全な印刷用HTMLドキュメント
    const fullPrintHtml = `
        <!DOCTYPE html>
        <html lang="ja">
        <head>
            <meta charset="UTF-8">
            <title>${escapeHtml(bookletTitle)}</title>
            <style>
                @page {
                    size: 297mm 210mm;
                    margin: 0;
                }
                @media print {
                    @page {
                        size: landscape;
                        margin: 0;
                    }
                    html, body {
                        width: 297mm !important;
                        height: 210mm !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                }
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                body, html {
                    width: 297mm;
                    height: 210mm;
                    background: #ffffff;
                    color: #111111;
                    font-family: "游明朝", "Yu Mincho", "ヒラギノ明朝 ProN", "Hiragino Mincho ProN", "Shippori Mincho", "MS P明朝", serif;
                }
                .print-sheet {
                    width: 297mm;
                    height: 210mm;
                    page-break-after: always;
                    break-after: page;
                    display: flex;
                    flex-direction: row;
                    position: relative;
                    overflow: hidden;
                    background: #ffffff;
                }
                .sheet-divider {
                    position: absolute;
                    top: 0;
                    left: 148.5mm;
                    width: 0;
                    height: 210mm;
                    border-left: 0.5px dashed rgba(0, 0, 0, 0.12);
                }
                .sheet-half {
                    width: 148.5mm;
                    height: 210mm;
                    position: relative;
                    overflow: hidden;
                    background: #ffffff;
                }
                /* 🌟 コンテンツエリア：左右マージン 16mm、上下マージン 20mm */
                .sheet-half-content {
                    position: absolute;
                    top: 20mm;
                    bottom: 22mm;
                    left: 16mm;
                    right: 16mm;
                    display: flex;
                    flex-direction: row-reverse; /* 🌟 右から左へ並べる */
                    justify-content: flex-start; /* 🌟 右端から順に詰めて並べる！（最終ページは左に余白が残る） */
                    align-items: center;         /* 🌟 上下方向完全中央揃え！ */
                    gap: ${columnGap};           /* 🌟 全ページで統一された列間隔！ */
                }

                /* 🌟 各句：縦書きで独立した1列 */
                .print-phrase-line {
                    writing-mode: vertical-rl;
                    -webkit-writing-mode: vertical-rl;
                    display: block;
                    font-size: 11.5pt;
                    letter-spacing: 0.28em;
                    line-height: 1.0;
                    color: #111111;
                    white-space: nowrap;
                    height: fit-content;
                    margin: 0;
                    padding: 0;
                }
                .print-phrase-line ruby {
                    ruby-position: over;
                    -webkit-ruby-position: over;
                }
                .print-phrase-line rt {
                    font-size: 0.45em;
                    color: #444444;
                    letter-spacing: 0.05em;
                }

                /* 🌟 年月見出し：縦書き独立行（横線なしの美しい文字組み） */
                .print-issue-header {
                    writing-mode: vertical-rl;
                    -webkit-writing-mode: vertical-rl;
                    display: block;
                    font-size: 11pt;
                    font-weight: 600;
                    letter-spacing: 0.28em;
                    color: #222222;
                    margin: 0;
                    padding: 0;
                    white-space: nowrap;
                    height: fit-content;
                }

                /* 🌟 ノンブル（ページ番号）：用紙の最下部中央に配置 */
                .print-nombre {
                    position: absolute;
                    bottom: 9mm;
                    left: 0;
                    width: 148.5mm;
                    text-align: center;
                    font-size: 8.5pt;
                    color: #888888;
                    font-family: serif;
                    letter-spacing: 0.1em;
                }

                /* 表紙・扉 */
                .sheet-half-content.cover-page-content {
                    justify-content: center;
                    align-items: center;
                }
                .print-cover-title, .print-tobira-title {
                    writing-mode: vertical-rl;
                    -webkit-writing-mode: vertical-rl;
                    font-size: 26pt;
                    font-weight: 600;
                    letter-spacing: 0.35em;
                    color: #111111;
                    white-space: nowrap;
                }

                /* 裏表紙（奥付）：左端にうてな俳句会＋文字の真下にスタンプ */
                .sheet-half-content.colophon-page-content {
                    justify-content: flex-end; /* 🌟 ページの左端に配置！ */
                    align-items: center;
                }
                .colophon-left-block {
                    writing-mode: vertical-rl;
                    -webkit-writing-mode: vertical-rl;
                    display: block;
                    height: fit-content;
                }
                .print-colophon-brand {
                    writing-mode: vertical-rl;
                    -webkit-writing-mode: vertical-rl;
                    font-size: 11.5pt;
                    font-weight: 500;
                    letter-spacing: 0.32em;
                    color: #222222;
                    white-space: nowrap;
                    display: block;
                }
                .print-colophon-stamp {
                    display: block;
                    width: 14mm;
                    height: 14mm;
                    object-fit: contain;
                    margin-top: 6mm; /* 🌟 「うてな俳句会」の文字の真下に配置！ */
                }
            </style>
        </head>
        <body>
            ${sheetsHtml}
        </body>
        </html>
    `;

    doc.write(fullPrintHtml);
    doc.close();

    closePrintModal();

    // 印刷ダイアログを起動（起動後にiframeを安全に削除してUIのクリック阻害を防止）
    setTimeout(() => {
        printIframe.contentWindow.focus();
        printIframe.contentWindow.print();
        
        // 印刷ダイアログ終了後にiframeを安全にクリーンアップ
        printIframe.contentWindow.onafterprint = () => {
            if (printIframe) printIframe.remove();
        };
    }, 400);
}

// 印刷用ルビ変換ヘルパー
function formatPrintRubyText(text) {
    if (!text) return '';
    return text.replace(/｜(.+?)《(.+?)》/g, '<ruby>$1<rt>$2</rt></ruby>')
               .replace(/([\u4E00-\u9FFF々〆ヵヶ]+)《(.+?)》/g, '<ruby>$1<rt>$2</rt></ruby>');
}
