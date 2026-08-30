// 🌸 アプリケーション状態管理
let haikuDatabase = [];
let saijikiDict = {}; 
let currentRoomHaikus = []; 
let currentIndex = 0;
let isRoomOpen = false;
let currentDisplayType = ''; 
let infoRevealed = false;
let currentTargetKigo = '';

let navState = { 
    currentLayer: 'topPage', 
    category: '', 
    seasonName: '', 
    kigoName: '', 
    authorName: '', 
    issueYear: '', 
    issueMonth: '', 
    issueNumber: '',
    isDetarame: false 
};

let touchStartX = 0;
let touchStartY = 0;

// 🚀 初期ロード処理（高速キャッシュ＆オフライン対応）
window.onload = async function() {
    initSwipeEvents();
    await loadAppData();
};

/**
 * データ読み込み処理
 * 1. localStorage キャッシュがあれば即座に初期化（0秒起動）
 * 2. fetch で最新の saijiki.json と haiku.json を並列取得して更新
 */
async function loadAppData() {
    let hasCachedData = false;

    // ① ローカルキャッシュのチェックと即時展開
    try {
        const cachedSaijiki = localStorage.getItem('utena_saijiki_data');
        const cachedHaiku = localStorage.getItem('utena_haiku_data');
        if (cachedSaijiki && cachedHaiku) {
            saijikiDict = JSON.parse(cachedSaijiki);
            haikuDatabase = JSON.parse(cachedHaiku);
            if (haikuDatabase.length > 0) {
                hasCachedData = true;
                hideLoadingOverlay();
            }
        }
    } catch (e) {
        console.warn('キャッシュ読み込み失敗:', e);
    }

    // ② 最新 JSON データのフェッチ（並列取得）
    try {
        const [resSaijiki, resHaiku] = await Promise.all([
            fetch('./saijiki.json', { cache: 'no-cache' }),
            fetch('./haiku.json', { cache: 'no-cache' })
        ]);

        if (!resSaijiki.ok || !resHaiku.ok) {
            throw new Error(`データ取得エラー: saijiki=${resSaijiki.status}, haiku=${resHaiku.status}`);
        }

        const freshSaijiki = await resSaijiki.json();
        const freshHaiku = await resHaiku.json();

        saijikiDict = freshSaijiki;
        haikuDatabase = freshHaiku;

        // キャッシュの更新
        try {
            localStorage.setItem('utena_saijiki_data', JSON.stringify(freshSaijiki));
            localStorage.setItem('utena_haiku_data', JSON.stringify(freshHaiku));
        } catch (storageErr) {
            console.warn('localStorage 保存容量オーバー等の警告:', storageErr);
        }

        hideLoadingOverlay();
    } catch (err) {
        console.error('最新データ取得エラー:', err);
        if (!hasCachedData) {
            showLoadingError();
        }
    }
}

function hideLoadingOverlay() {
    const el = document.getElementById('loadingOverlay');
    if (el) el.style.display = 'none';
}

function showLoadingError() {
    const el = document.getElementById('loadingOverlay');
    if (el) {
        el.innerHTML = `
            <div style="text-align: center; line-height: 1.8;">
                <p>データの読み込みに失敗しました。</p>
                <p style="font-size: 12px; color: #999;">電波状況をご確認ください。</p>
                <button onclick="location.reload()" style="margin-top: 15px; padding: 8px 18px; font-size: 14px; border: 1px solid #8c8476; background: #fff; border-radius: 4px; cursor: pointer; color: #2b2b2b;">再読み込み</button>
            </div>
        `;
    }
}

// 🌸 年代の和暦変換（令和・平成に対応）
function toJapaneseEra(yearNum) {
    let y = Number(yearNum);
    if (!y) return `${yearNum}年`;
    if (y >= 2019) {
        let rYear = y - 2018;
        const kanjiNums = ['元', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
        return `令和${kanjiNums[rYear - 1] || rYear}年`;
    } else if (y >= 1989) {
        let hYear = y - 1988;
        return `平成${hYear === 1 ? '元' : hYear}年`;
    }
    return `${y}年`;
}

function toKanjiMonth(monthNum) {
    const map = {'1':'一', '2':'二', '3':'三', '4':'四', '5':'五', '6':'六', '7':'七', '8':'八', '9':'九', '10':'十', '11':'十一', '12':'十二'};
    let m = String(monthNum).trim();
    return map[m] ? `${map[m]}月` : `${m}月`;
}

// 🌸 ルビ変換処理（|漢字(ルビ) または 漢字(ルビ) の両記法に対応）
function formatRubyText(text) {
    if (!text) return '';
    let str = String(text).replace(/｜/g, '|');

    // 1. パイプ記法 |漢字《ルビ》
    str = str.replace(/\|([^《（(]+)[《（(]([^》）)]+)[》）)]/g, (_, target, ruby) => {
        return `<span class="ruby-block"><ruby>${target}<rt>${ruby}</rt></ruby></span>`;
    });

    // 2. 自動漢字検出 漢字《ルビ》
    str = str.replace(/([\u4E00-\u9FFF\u3005]+)[《（(]([^》）)]+)[》）)]/g, (_, target, ruby) => {
        return `<span class="ruby-block"><ruby>${target}<rt>${ruby}</rt></ruby></span>`;
    });

    return str;
}

// 🎲 おみ句じ起動処理
// 🎲 おみ句じ直接起動（いっしょくた）
function launchOmikuji() {
    navState.category = 'omikuji_all';
    openRoom('detarame', 'all', 'おみ句じ');
}

// 🧭 パンくずリスト更新処理
function updateBreadcrumb() {
    const container = document.getElementById('globalBreadcrumb');
    if (!container) return;

    if (navState.currentLayer === 'topPage') {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'flex';
    let html = `<span class="link" onclick="renderPage('topPage')">home</span>`;
    
    if (navState.category === 'omikuji_all') {
        html += ` <span class="separator">&lt;</span> <span class="current">おみ句じ</span>`;
    } else if (navState.category === 'kushu') {
        html += ` <span class="separator">&lt;</span> <span class="${navState.currentLayer === 'kushuAuthorPage' ? 'current' : 'link'}" onclick="showKushuAuthorList()">句集</span>`;
        if (navState.authorName) {
            if (navState.currentLayer === 'kushuAuthorHubPage') {
                html += ` <span class="separator">&lt;</span> <span class="current">${escapeHtml(navState.authorName)}</span>`;
            } else if (navState.currentLayer === 'kushuChronoPage') {
                html += ` <span class="separator">&lt;</span> <span class="link" onclick="showKushuAuthorHub('${escapeHtml(navState.authorName)}')">${escapeHtml(navState.authorName)}</span>`;
                html += ` <span class="separator">&lt;</span> <span class="current">時系列</span>`;
            } else if (navState.currentLayer === 'roomPage' && currentDisplayType === 'kushu_author') {
                html += ` <span class="separator">&lt;</span> <span class="link" onclick="showKushuAuthorHub('${escapeHtml(navState.authorName)}')">${escapeHtml(navState.authorName)}</span>`;
                html += ` <span class="separator">&lt;</span> <span class="current">おみ句じ</span>`;
            }
        }
    } else if (navState.category === 'saijiki') {
        html += ` <span class="separator">&lt;</span> <span class="${navState.currentLayer === 'saijikiPage' ? 'current' : 'link'}" onclick="renderPage('saijikiPage')">季寄せ</span>`;
        if (navState.currentLayer === 'saijikiListRoomPage' && navState.kigoName) {
            html += ` <span class="separator">&lt;</span> <span class="current">${escapeHtml(navState.kigoName)}</span>`;
        }
    } else if (navState.category === 'utena_archive') {
        html += ` <span class="separator">&lt;</span> <span class="link" onclick="showIssueYearList()">うてな俳句</span>`;
        if (navState.issueYear) {
            if (['issueMonthPage', 'issueDetailPage', 'utenaAuthorListPage', 'roomPage', 'saijikiListRoomPage'].includes(navState.currentLayer)) {
                html += ` <span class="separator">&lt;</span> <span class="link" onclick="showIssueMonthList('${navState.issueYear}')">${toJapaneseEra(navState.issueYear)}</span>`;
            }
        }
        if (navState.issueMonth) {
            let monthLabel = `${toKanjiMonth(navState.issueMonth)}`;
            if (navState.currentLayer === 'issueDetailPage') {
                html += ` <span class="separator">&lt;</span> <span class="current">${monthLabel}</span>`;
            } else if (['utenaAuthorListPage', 'roomPage', 'saijikiListRoomPage'].includes(navState.currentLayer)) {
                html += ` <span class="separator">&lt;</span> <span class="link" onclick="showIssueDetailPage('${navState.issueYear}', '${navState.issueMonth}')">${monthLabel}</span>`;
            }
        }
        if (navState.currentLayer === 'utenaAuthorListPage') {
            html += ` <span class="separator">&lt;</span> <span class="current">俳人別</span>`;
        }
        if (navState.currentLayer === 'roomPage' && currentDisplayType === 'issue_all') {
            html += ` <span class="separator">&lt;</span> <span class="current">全句</span>`;
        }
        if (navState.currentLayer === 'saijikiListRoomPage' && navState.authorName) {
            html += ` <span class="separator">&lt;</span> <span class="link" onclick="showUtenaAuthorListPage()">俳人別</span>`;
            html += ` <span class="separator">&lt;</span> <span class="current">${navState.authorName}</span>`;
        }
    }
    container.innerHTML = html;
}

// 📄 画面切り替え共通処理
function renderPage(pageId) {
    document.querySelectorAll('.layer-page').forEach(page => page.style.display = 'none');
    const target = document.getElementById(pageId);
    if (target) target.style.display = 'flex';
    
    if (pageId !== 'roomPage') {
        const infoTrigger = document.getElementById('infoTrigger');
        const mainTag = document.getElementById('roomMainTag');
        if (infoTrigger) infoTrigger.style.display = 'none';
        if (mainTag) mainTag.innerText = '';
    }
    
    navState.currentLayer = pageId;
    if (pageId === 'topPage') { 
        navState.category = ''; 
        navState.isDetarame = false; 
        navState.authorName = '';
        navState.kigoName = '';
    }
    else if (pageId === 'kushuAuthorPage' || pageId === 'kushuAuthorHubPage' || pageId === 'kushuChronoPage') navState.category = 'kushu';
    else if (pageId === 'saijikiPage') {
        navState.category = 'saijiki';
        renderSaijikiKigoList();
    }
    
    isRoomOpen = (pageId === 'roomPage');

    const catBtn = document.getElementById('fixedCatBtn');
    if (catBtn) {
        if (navState.category === 'saijiki' || navState.category === 'kushu' || (navState.category === 'utena_archive' && !isRoomOpen)) {
            catBtn.classList.remove('hidden');
        } else {
            catBtn.classList.add('hidden');
        }
    }

    updateBreadcrumb();
}

function getSeasonCode(name) { 
    const map = {'春':'haru', '夏':'natsu', '秋':'aki', '冬':'huyu', '新年':'shinnen', '無季':'muki'}; 
    return map[name] || ''; 
}

// 🌸 横スクロールコンテナの配置調整（要素数に応じて中央揃え／先頭固定を切り替え）
function adjustScrollAlignment(container) {
    if (!container) return;
    requestAnimationFrame(() => {
        if (container.scrollWidth > container.clientWidth) {
            container.style.justifyContent = 'flex-start';
            container.scrollLeft = 0;
        } else {
            container.style.justifyContent = 'center';
        }
    });
}

// ========================================================
// 👥 句集（俳人別アーカイブ ＆ 作者ハブ ＆ 時系列スクロール）
// ========================================================

let currentKushuAuthor = '';

// 🌸 句集：俳人一覧の表示（ルビなし）
function showKushuAuthorList() {
    navState.category = 'kushu';
    navState.authorName = '';
    const container = document.getElementById('kushuAuthorList'); 
    if (!container) return;
    container.innerHTML = '';

    // 1. 作品データベースから俳人ごとの句数を集計
    let authorMap = {};
    haikuDatabase.forEach(item => { 
        if (item.author && item.author !== '作者不詳') {
            if (!authorMap[item.author]) {
                authorMap[item.author] = {
                    name: item.author,
                    kana: item.authorKana || item.author,
                    count: 0
                };
            }
            authorMap[item.author].count++;
        }
    });

    let authors = Object.values(authorMap);
    if (authors.length === 0) {
        container.innerHTML = '<div style="writing-mode: vertical-rl; -webkit-writing-mode: vertical-rl; color: #888; margin: auto;">まだ俳人が登録されていません</div>';
        renderPage('kushuAuthorPage');
        return;
    }

    // 五十音順ソート
    authors.sort((a, b) => a.kana.localeCompare(b.kana, 'ja'));

    authors.forEach(item => {
        const el = document.createElement('div'); 
        el.className = 'kushu-author-item'; 
        
        const countStr = toKanjiNum(String(item.count)) + '句';

        // 🌟 よみがなは不要のため排除
        el.innerHTML = `
            <div class="kushu-author-name">${escapeHtml(item.name)}</div>
            <span class="kushu-count-badge">${countStr}</span>
        `;
        el.onclick = () => showKushuAuthorHub(item.name);
        container.appendChild(el);
    });

    renderPage('kushuAuthorPage');
    adjustScrollAlignment(container);
}

// 🌸 句集：作者選択ハブ画面（時系列 ｜ おみ句じ）
function showKushuAuthorHub(authorName) {
    currentKushuAuthor = authorName;
    navState.category = 'kushu';
    navState.authorName = authorName;
    renderPage('kushuAuthorHubPage');
}

// 🌸 句集：時系列スクロール画面を開く
function openKushuAuthorChrono() {
    renderKushuChronoList();
    renderPage('kushuChronoPage');
}

// 🌸 句集：作者おみ句じを開く
function openKushuAuthorOmikuji() {
    navState.category = 'kushu';
    currentDisplayType = 'kushu_author';
    navState.isDetarame = false;
    currentRoomHaikus = haikuDatabase.filter(item => item.author === currentKushuAuthor);
    if (currentRoomHaikus.length === 0) {
        alert('この作者の作品はまだ登録されていません。');
        return;
    }
    shuffleArray(currentRoomHaikus);
    currentIndex = 0;
    renderPage('roomPage');
    updateHaikuDisplay();
}

// 🌸 句集：時系列スクロールの描画（季語タグ排除、発行年月セパレーター挿入）
function renderKushuChronoList() {
    const container = document.getElementById('kushuHaikuList');
    if (!container) return;
    container.innerHTML = '';

    let authorHaikus = haikuDatabase.filter(h => h.author === currentKushuAuthor);
    if (authorHaikus.length === 0) {
        container.innerHTML = '<div style="writing-mode: vertical-rl; -webkit-writing-mode: vertical-rl; color: #888; margin: auto;">作品が登録されていません</div>';
        return;
    }

    // 時系列ソート（発行年 ➡ 発行月 ➡ 号内順）
    authorHaikus.sort((a, b) => {
        const yearA = parseInt(a.issueYear, 10) || 0;
        const yearB = parseInt(b.issueYear, 10) || 0;
        if (yearA !== yearB) return yearA - yearB;
        
        const monthA = parseInt(a.issueMonth, 10) || 0;
        const monthB = parseInt(b.issueMonth, 10) || 0;
        if (monthA !== monthB) return monthA - monthB;

        return (a.orderInIssue || 0) - (b.orderInIssue || 0);
    });

    const isDividerVisible = document.getElementById('kushuIssueDividerToggle') ? document.getElementById('kushuIssueDividerToggle').checked : true;

    let lastIssueKey = '';
    authorHaikus.forEach(item => {
        const currentIssueKey = `${item.issueYear || ''}_${item.issueMonth || ''}`;
        
        // 号が変わったら発行年月セパレーターを挿入
        if (currentIssueKey !== lastIssueKey && (item.issueYear || item.issueMonth)) {
            lastIssueKey = currentIssueKey;
            
            const divider = document.createElement('div');
            divider.className = 'kushu-issue-divider' + (isDividerVisible ? '' : ' hidden');
            
            const eraStr = item.issueYear ? toJapaneseEra(item.issueYear) : '';
            const monthStr = item.issueMonth ? toKanjiMonth(item.issueMonth) : '';
            const issueLabel = `${eraStr}${monthStr}`;

            divider.innerHTML = `<span class="kushu-issue-tag">${escapeHtml(issueLabel)}</span>`;
            container.appendChild(divider);
        }

        // 句カード（🌟 季語タグは排除し、純粋な句のみを表示）
        const card = document.createElement('div');
        card.className = 'kushu-haiku-card';
        card.innerHTML = `
            <div class="kushu-phrase">${formatRubyText(item.phrase)}</div>
        `;
        container.appendChild(card);
    });

    adjustScrollAlignment(container);
}

// 🌸 年月表示 ON/OFF 切り替え
function toggleKushuIssueDividers() {
    const isChecked = document.getElementById('kushuIssueDividerToggle') ? document.getElementById('kushuIssueDividerToggle').checked : true;
    const dividers = document.querySelectorAll('.kushu-issue-divider');
    dividers.forEach(el => {
        el.classList.toggle('hidden', !isChecked);
    });
}

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
    // 年月が変わっても無駄に改ページせず、1ページあたり linesPerPage 句ずつ連続してストリーム配置
    const haikuPages = [];
    let currentPageItems = [];
    let currentHaikuCountInPage = 0;
    let lastIssueKey = '';

    authorHaikus.forEach(h => {
        if (printIncludeYearMonth) {
            const eraStr = h.issueYear ? toJapaneseEra(h.issueYear) : '';
            const monthStr = h.issueMonth ? toKanjiMonth(h.issueMonth) : '';
            const currentIssueKey = `${eraStr}${monthStr}`;
            
            // 号が変わったら年月見出しを挿入
            if (currentIssueKey && currentIssueKey !== lastIssueKey) {
                lastIssueKey = currentIssueKey;
                currentPageItems.push({ type: 'header', text: currentIssueKey });
            }
        }

        currentPageItems.push({ type: 'haiku', data: h });
        currentHaikuCountInPage++;

        // 1ページの句数上限に達したら次ページへ
        if (currentHaikuCountInPage >= linesPerPage) {
            haikuPages.push({ type: 'body', items: currentPageItems });
            currentPageItems = [];
            currentHaikuCountInPage = 0;
        }
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
                    <div class="sheet-half-content">
                        <div class="cover-box">
                            <div class="print-cover-title">${escapeHtml(bookletTitle)}</div>
                            <div class="print-cover-author">${escapeHtml(currentKushuAuthor)}</div>
                        </div>
                    </div>
                    <div class="print-nombre"></div>
                </div>
            `;
        }
        if (pageObj.type === 'tobira') {
            return `
                <div class="sheet-half">
                    <div class="sheet-half-content">
                        <div class="tobira-box">
                            <div class="print-tobira-title">${escapeHtml(bookletTitle)}</div>
                        </div>
                    </div>
                    <div class="print-nombre"></div>
                </div>
            `;
        }
        if (pageObj.type === 'colophon') {
            return `
                <div class="sheet-half">
                    <div class="sheet-half-content">
                        <div class="print-colophon-box">
                            <div class="print-colophon-title">${escapeHtml(bookletTitle)}</div>
                            <div class="print-colophon-author">著者　${escapeHtml(currentKushuAuthor)}</div>
                            <div class="print-colophon-brand">うてな俳句 謹製</div>
                        </div>
                    </div>
                    <div class="print-nombre"></div>
                </div>
            `;
        }

        // 本文ページ：アイテム（年月見出し／俳句）を縦書き中央グループ内に展開
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
                    <div class="haiku-columns-group">
                        ${innerHtml}
                    </div>
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

    // 独立iframe内の完全な印刷用HTMLドキュメント
    const fullPrintHtml = `
        <!DOCTYPE html>
        <html lang="ja">
        <head>
            <meta charset="UTF-8">
            <title>${escapeHtml(bookletTitle)}</title>
            <style>
                @page {
                    size: landscape;
                    margin: 0;
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
                    padding: 16mm 14mm 14mm;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    align-items: center;
                    position: relative;
                }
                /* 🌟 上下左右完全中央寄せコンテナ（横書きFlexboxで中の縦書きブロックを中央配置） */
                .sheet-half-content {
                    flex: 1;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    width: 100%;
                    height: 165mm;
                }
                /* 🌟 縦書きブロック（Flexboxを排除し、純粋なvertical-rlで右から左へ並べる） */
                .haiku-columns-group {
                    writing-mode: vertical-rl;
                    -webkit-writing-mode: vertical-rl;
                    display: block;
                    height: fit-content;
                    max-height: 155mm;
                    width: fit-content;
                    text-align: start;
                }

                /* 🌟 全ページ・全句で文字サイズを一定（12pt）に統一し、インラインブロックで横に並べる */
                .print-phrase-line {
                    writing-mode: vertical-rl;
                    -webkit-writing-mode: vertical-rl;
                    display: inline-block;
                    vertical-align: top;
                    font-size: 12pt;
                    letter-spacing: 0.28em;
                    line-height: 1.0;
                    color: #111111;
                    white-space: nowrap;
                    height: fit-content;
                    margin-left: ${linesPerPage >= 5 ? '7.5mm' : (linesPerPage === 4 ? '9.0mm' : (linesPerPage === 3 ? '12.0mm' : (linesPerPage === 2 ? '16.0mm' : '0mm')))};
                    margin-right: 0;
                    padding: 0;
                }
                .print-phrase-line:last-child {
                    margin-left: 0;
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

                /* 🌟 年月の右側の線は文字と同じ長さ（height: fit-content） */
                .print-issue-header {
                    writing-mode: vertical-rl;
                    -webkit-writing-mode: vertical-rl;
                    display: inline-block;
                    vertical-align: top;
                    font-size: 10.5pt;
                    font-weight: 600;
                    letter-spacing: 0.28em;
                    color: #222222;
                    border-right: 1.2pt solid #222222;
                    padding-right: 2.8mm;
                    margin-left: ${linesPerPage >= 5 ? '5.5mm' : '8.0mm'};
                    margin-right: 0;
                    white-space: nowrap;
                    height: fit-content;
                }

                .print-nombre {
                    font-size: 8.5pt;
                    color: #888888;
                    font-family: serif;
                    letter-spacing: 0.1em;
                    text-align: center;
                    margin-top: 2mm;
                }

                /* 表紙 */
                .cover-box {
                    writing-mode: vertical-rl;
                    -webkit-writing-mode: vertical-rl;
                    display: inline-flex;
                    flex-direction: row;
                    justify-content: center;
                    align-items: center;
                    gap: 12mm;
                    height: fit-content;
                }
                .print-cover-title {
                    font-size: 26pt;
                    font-weight: 600;
                    letter-spacing: 0.35em;
                    color: #111111;
                    white-space: nowrap;
                }
                .print-cover-author {
                    font-size: 14pt;
                    letter-spacing: 0.3em;
                    color: #333333;
                    white-space: nowrap;
                    align-self: flex-end;
                    margin-top: 15mm;
                }

                /* 扉 */
                .tobira-box {
                    writing-mode: vertical-rl;
                    -webkit-writing-mode: vertical-rl;
                    display: inline-block;
                    height: fit-content;
                }
                .print-tobira-title {
                    font-size: 20pt;
                    font-weight: 500;
                    letter-spacing: 0.3em;
                    color: #333333;
                    white-space: nowrap;
                }

                /* 奥付 */
                .print-colophon-box {
                    writing-mode: vertical-rl;
                    -webkit-writing-mode: vertical-rl;
                    border: 0.8pt solid #555555;
                    padding: 8mm 6mm;
                    display: inline-flex;
                    flex-direction: row;
                    align-items: flex-start;
                    gap: 5mm;
                    height: 105mm;
                }
                .print-colophon-title {
                    font-size: 13pt;
                    font-weight: 600;
                    letter-spacing: 0.25em;
                    white-space: nowrap;
                }
                .print-colophon-author {
                    font-size: 10pt;
                    letter-spacing: 0.2em;
                    color: #333333;
                    white-space: nowrap;
                }
                .print-colophon-brand {
                    font-size: 8.5pt;
                    letter-spacing: 0.2em;
                    color: #555555;
                    margin-top: 12mm;
                    white-space: nowrap;
                    align-self: flex-end;
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

// 🔍 季語インクリメンタル検索
// ========================================================
// 🌸 季寄せ・歳時記 大画面（風月スタイル ＋ 例句大画面スクロール）
// ========================================================

let currentSaijikiSeason = 'haru';
let currentSaijikiMode = 'gojuon'; // 'gojuon' | 'jikou'

const JIKI_ORDER = {
    'haru': ['三春', '初春', '仲春', '晩春'],
    'natsu': ['三夏', '初夏', '仲夏', '晩夏'],
    'aki': ['三秋', '初秋', '仲秋', '晩秋'],
    'huyu': ['三冬', '初冬', '仲冬', '晩冬', '暮'],
    'shinnen': ['新年'],
    'muki': ['無季']
};

const BUNRUI_ORDER = ['時候', '天文', '地理', '生活', '行事', '動物', '植物', '無季'];

const SEASON_NAMES_JA = {
    'haru': '春',
    'natsu': '夏',
    'aki': '秋',
    'huyu': '冬',
    'shinnen': '新年',
    'muki': '無季'
};

function switchSaijikiSeason(season) {
    currentSaijikiSeason = season;
    ['Haru', 'Natsu', 'Aki', 'Huyu', 'Shinnen', 'Muki'].forEach(s => {
        const tab = document.getElementById(`stab${s}`);
        if (tab) tab.classList.toggle('active', s.toLowerCase() === season);
    });
    renderSaijikiKigoList();
}

function switchSaijikiMode(mode) {
    currentSaijikiMode = mode;
    ['Gojuon', 'Jikou'].forEach(m => {
        const tab = document.getElementById(`smode${m}`);
        if (tab) tab.classList.toggle('active', m.toLowerCase() === mode);
    });
    renderSaijikiKigoList();
}

function expandSaijikiSearchInput() {
    const wrapper = document.getElementById('saijikiSearchWrapper');
    const input = document.getElementById('saijikiSearchInput');
    if (wrapper && input) { wrapper.classList.add('expanded'); input.focus(); }
}

function collapseSaijikiSearchIfEmpty() {
    const wrapper = document.getElementById('saijikiSearchWrapper');
    const input = document.getElementById('saijikiSearchInput');
    if (wrapper && input && input.value.trim() === '') wrapper.classList.remove('expanded');
}

function onSaijikiSearchChanged() {
    const input = document.getElementById('saijikiSearchInput');
    const clearBtn = document.getElementById('clearSaijikiSearchBtn');
    if (clearBtn && input) clearBtn.classList.toggle('hidden', input.value.trim() === '');
    renderSaijikiKigoList();
}

function clearSaijikiSearch(event) {
    if (event) event.stopPropagation();
    const input = document.getElementById('saijikiSearchInput');
    if (input) input.value = '';
    const clearBtn = document.getElementById('clearSaijikiSearchBtn');
    if (clearBtn) clearBtn.classList.add('hidden');
    collapseSaijikiSearchIfEmpty();
    renderSaijikiKigoList();
}

function getGojuonRowChar(kana) {
    if (!kana) return 'あ';
    const c = kana.charAt(0);
    if ('あいうえおぁぃぅぇぉ'.includes(c)) return 'あ';
    if ('かきくけこがぎぐげご'.includes(c)) return 'か';
    if ('さしすせそざじずぜぞ'.includes(c)) return 'さ';
    if ('たちつてとだぢづでどっ'.includes(c)) return 'た';
    if ('なにぬねの'.includes(c)) return 'な';
    if ('はひふへほばびぶべぼぱぴぷぺぽ'.includes(c)) return 'は';
    if ('まみむめも'.includes(c)) return 'ま';
    if ('やゆよゃゅょ'.includes(c)) return 'や';
    if ('らりるれろ'.includes(c)) return 'ら';
    if ('わをん'.includes(c)) return 'わ';
    return 'あ';
}

function toKanjiNum(numStr) {
    const kanjiDigits = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    const n = parseInt(numStr, 10);
    if (isNaN(n)) return numStr;
    if (n <= 10) return ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][n];
    if (n < 20) return '十' + kanjiDigits[n % 10];
    return String(numStr).split('').map(d => kanjiDigits[parseInt(d, 10)] || d).join('');
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// 🌸 季寄せ季語一覧の描画（右から左へ並ぶ縦書きリスト ＋ 句数バッジ ＋ 五十音/時候順切り替え）
function renderSaijikiKigoList() {
    const container = document.getElementById('saijikiKigoList');
    if (!container) return;
    container.innerHTML = '';

    const query = document.getElementById('saijikiSearchInput') ? document.getElementById('saijikiSearchInput').value.trim().toLowerCase() : '';

    // 五十音ジャンプバーの表示制御
    const jumpBar = document.getElementById('saijikiGojuonBar');
    if (jumpBar) {
        jumpBar.classList.toggle('hidden', currentSaijikiMode !== 'gojuon' || query !== '');
    }

    // 1. 作品データベースから季語ごとの句数を集計
    const kigoWorkMap = new Map();
    haikuDatabase.forEach(h => {
        const p = h.parentKigo || h.kigo;
        if (p) {
            if (!kigoWorkMap.has(p)) kigoWorkMap.set(p, []);
            kigoWorkMap.get(p).push(h);
        }
    });

    // 2. 季語辞書から該当する季節の親季語を抽出
    const parentMap = new Map();
    Object.keys(saijikiDict).forEach(k => {
        const item = saijikiDict[k];
        const s = (item.season || '').toLowerCase();
        const isSeasonMatch = (query !== '') ? true : (s === currentSaijikiSeason);

        if (isSeasonMatch) {
            const p = item.parentKigo || k;
            if (p && !parentMap.has(p)) {
                parentMap.set(p, {
                    parentKigo: p,
                    parentKana: item.kigoKana || item.parentKana || '',
                    season: item.season || '',
                    detailSeason: item.detailSeason || '',
                    category: item.category || '生活',
                    desc: item.desc || '',
                    children: new Set()
                });
            }
            if (p && parentMap.has(p) && item.childKigos) {
                item.childKigos.split(/[、,]/).forEach(c => {
                    const ct = c.trim();
                    if (ct) parentMap.get(p).children.add(ct);
                });
            }
        }
    });

    // 3. 検索クエリによるフィルタリング
    let parents = Array.from(parentMap.values());
    if (query !== '') {
        parents = parents.filter(p => {
            if (p.parentKigo.toLowerCase().includes(query)) return true;
            if (p.parentKana.toLowerCase().includes(query)) return true;
            for (const child of p.children) {
                if (child.toLowerCase().includes(query)) return true;
            }
            return false;
        });
    }

    if (parents.length === 0) {
        container.innerHTML = '<div style="writing-mode: vertical-rl; -webkit-writing-mode: vertical-rl; color: #888; font-size: 0.95rem; margin: auto; letter-spacing: 0.2em;">該当する季語がありません</div>';
        return;
    }

    const sortKana = (arr) => [...arr].sort((a, b) => (a.parentKana || a.parentKigo).localeCompare(b.parentKana || b.parentKigo, 'ja'));

    const renderItem = (pData) => {
        const works = kigoWorkMap.get(pData.parentKigo) || [];
        const workCount = works.length;
        const rowChar = getGojuonRowChar(pData.parentKana || pData.parentKigo);

        const itemEl = document.createElement('div');
        itemEl.className = 'saijiki-kigo-item';
        itemEl.setAttribute('data-row', rowChar);
        itemEl.setAttribute('data-timing', pData.detailSeason || '');
        // 🌟 季語クリックでまず季語解説フロートパネルを表示！
        itemEl.onclick = () => openKigoCard(pData.parentKigo);

        let rubyHtml = escapeHtml(pData.parentKigo);
        if (pData.parentKana && pData.parentKana !== pData.parentKigo) {
            rubyHtml = `<ruby>${escapeHtml(pData.parentKigo)}<rt>${escapeHtml(pData.parentKana)}</rt></ruby>`;
        }

        let badgeHtml = '';
        if (workCount > 0) {
            const countStr = toKanjiNum(String(workCount)) + '句';
            badgeHtml = `<span class="kigo-count-badge">${countStr}</span>`;
        }

        itemEl.innerHTML = `
            <div class="saijiki-kigo-text">${rubyHtml}</div>
            ${badgeHtml}
        `;
        container.appendChild(itemEl);
    };

    const renderHeadingSet = (timingText, catText) => {
        const sep = document.createElement('div');
        sep.className = 'saijiki-heading-set';
        if (timingText) {
            sep.classList.add('with-timing');
            sep.innerHTML = `
                <span class="saijiki-hb-timing">${escapeHtml(timingText)}</span>
                <span class="saijiki-hb-cat">${escapeHtml(catText)}</span>
            `;
        } else {
            sep.classList.add('only-cat');
            sep.innerHTML = `
                <span class="saijiki-hb-cat">${escapeHtml(catText)}</span>
            `;
        }
        container.appendChild(sep);
    };

    // 4. モード別レンダリング
    if (currentSaijikiMode === 'gojuon' || query !== '') {
        const sorted = sortKana(parents);
        sorted.forEach(renderItem);
    } else {
        // 時候順（時期 ➡ 分類 ➡ かな順）
        const timingKeys = JIKI_ORDER[currentSaijikiSeason] || ['三春'];
        timingKeys.forEach(tKey => {
            let isFirstTimingHeader = true;
            BUNRUI_ORDER.forEach(bKey => {
                const group = parents.filter(p => {
                    const pt = p.detailSeason || '';
                    const pc = p.category || '生活';
                    const isTimingMatch = (pt === tKey) || (tKey.startsWith('三') && !pt);
                    return isTimingMatch && (pc === bKey);
                });

                if (group.length > 0) {
                    if (isFirstTimingHeader) {
                        renderHeadingSet(tKey, bKey);
                        isFirstTimingHeader = false;
                    } else {
                        renderHeadingSet('', bKey);
                    }
                    sortKana(group).forEach(renderItem);
                }
            });
        });
    }

    setupSaijikiScrollObserver();
    adjustScrollAlignment(container);
}

// 🌸 五十音ジャンプバーのスクロール処理
function jumpToGojuon(targetRow) {
    const container = document.getElementById('saijikiKigoList');
    if (!container) return;
    const items = container.querySelectorAll('.saijiki-kigo-item');
    for (const el of items) {
        if (el.getAttribute('data-row') === targetRow) {
            el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            break;
        }
    }
}

// 🌸 透かしフロート見出し（ウォーターマーク）のスクロール連動
function setupSaijikiScrollObserver() {
    const container = document.getElementById('saijikiKigoList');
    const watermark = document.getElementById('saijikiWatermark');
    const wmTiming = document.getElementById('wmTiming');
    const wmCat = document.getElementById('wmCat');
    if (!container || !watermark) return;

    if (currentSaijikiMode !== 'jikou') {
        watermark.classList.add('hidden');
        return;
    }

    watermark.classList.remove('hidden');

    const updateWatermark = () => {
        const items = container.querySelectorAll('.saijiki-kigo-item, .saijiki-heading-set');
        if (items.length === 0) return;

        const targetX = window.innerWidth * 0.35;
        let activeEl = null;
        let minDiff = Infinity;

        items.forEach(el => {
            const rect = el.getBoundingClientRect();
            const center = rect.left + rect.width / 2;
            const diff = Math.abs(center - targetX);
            if (diff < minDiff) {
                minDiff = diff;
                activeEl = el;
            }
        });

        if (activeEl) {
            const t = activeEl.getAttribute('data-timing') || '';
            const c = activeEl.getAttribute('data-cat') || '';
            if (t && wmTiming) wmTiming.innerText = t;
            if (c && wmCat) wmCat.innerText = c;
        }
    };

    container.onscroll = updateWatermark;
    updateWatermark();
}

// 🌸 奥の階層：例句大画面横スクロール鑑賞ルームへ遷移！
function openSaijikiRoom(kigoName) {
    currentTargetKigo = kigoName;
    navState.category = 'saijiki';
    navState.kigoName = kigoName;
    
    let matchingHaikus = haikuDatabase.filter(item => (item.parentKigo === kigoName || item.kigo === kigoName));
    const container = document.getElementById('saijikiHaikuList');
    if (!container) return;
    container.innerHTML = '';

    if (matchingHaikus.length === 0) {
        // 例句が0件の場合は季語解説カードを優しく案内
        openKigoCard(kigoName);
        return;
    }

    // 句の短冊カードを右から左へ並べて描画
    matchingHaikus.forEach(item => {
        const card = document.createElement('div');
        card.className = 'saijiki-haiku-card';
        card.innerHTML = `
            <div class="saijiki-phrase">${formatRubyText(item.phrase)}</div>
            <div class="saijiki-author">${item.author}</div>
        `;
        container.appendChild(card);
    });

    // 右上に季語名と「ℹ️」ボタンを設置して解説カードもいつでも確認可能に
    const mainTag = document.getElementById('roomMainTag');
    const infoTrigger = document.getElementById('infoTrigger');
    if (mainTag) {
        mainTag.innerHTML = `<span style="font-size: 0.95rem; cursor: pointer;" onclick="openKigoCard('${escapeHtml(kigoName)}')">${escapeHtml(kigoName)}</span>`;
    }
    if (infoTrigger) {
        infoTrigger.style.display = 'block';
        infoTrigger.onclick = () => openKigoCard(kigoName);
    }

    renderPage('saijikiListRoomPage');
    adjustScrollAlignment(container);
}

// 🌸 季語解説カードの表示（ポップアップ）
function openKigoCard(kigoName) {
    currentTargetKigo = kigoName;

    let cleanKey = String(kigoName).replace(/[\s\u3000]+/g, '').trim();
    let saijikiInfo = saijikiDict[cleanKey] || saijikiDict[kigoName];

    const parentEl = document.getElementById('cardParentKigo');
    const childEl = document.getElementById('cardChildKigo');
    const descEl = document.getElementById('cardDesc');
    const countNumEl = document.getElementById('cardWorkCountNum');
    const actionBtn = document.getElementById('cardViewWorksBtn');

    if (!saijikiInfo) {
        if (parentEl) parentEl.innerText = kigoName;
        if (childEl) childEl.innerText = '';
        if (descEl) descEl.innerText = '解説データ準備中';
    } else {
        if (parentEl) {
            if (saijikiInfo.kigoKana) {
                parentEl.innerHTML = `<ruby>${escapeHtml(saijikiInfo.parentKigo)}<rt>${escapeHtml(saijikiInfo.kigoKana)}</rt></ruby>`;
            } else {
                parentEl.innerText = saijikiInfo.parentKigo;
            }
        }
        if (childEl) childEl.innerText = saijikiInfo.childKigos ? `子季語：${saijikiInfo.childKigos}` : '';
        if (descEl) descEl.innerText = saijikiInfo.desc ? saijikiInfo.desc : '解説データ準備中';
    }

    // 作品数の集計
    let matchingHaikus = haikuDatabase.filter(item => (item.parentKigo === kigoName || item.kigo === kigoName));
    const workCount = matchingHaikus.length;

    if (countNumEl) countNumEl.innerText = workCount;
    if (actionBtn) {
        if (workCount > 0) {
            actionBtn.classList.remove('disabled');
            actionBtn.innerHTML = `例句を見る（${workCount}句） →`;
        } else {
            actionBtn.classList.add('disabled');
            actionBtn.innerHTML = `例句はまだありません`;
        }
    }

    const overlay = document.getElementById('kigoCardOverlay');
    if (overlay) overlay.classList.remove('hidden');
}

// 🌸 季語解説カードをクリックした時の処理（例句があれば奥の例句画面へ遷移）
function onKigoCardClicked() {
    if (!currentTargetKigo) return;
    let matchingHaikus = haikuDatabase.filter(item => (item.parentKigo === currentTargetKigo || item.kigo === currentTargetKigo));
    if (matchingHaikus.length > 0) {
        closeKigoCard();
        openSaijikiRoom(currentTargetKigo);
    }
}

function closeKigoCard(event) {
    if (event) event.stopPropagation();
    const overlay = document.getElementById('kigoCardOverlay');
    if (overlay) overlay.classList.add('hidden');
}

// 🌸 年選択一覧
function showIssueYearList() {
    navState.category = 'utena_archive';
    navState.issueYear = ''; 
    navState.issueMonth = '';
    
    const container = document.getElementById('issueYearList');
    if (!container) return;
    container.innerHTML = '';

    let years = [...new Set(haikuDatabase.map(item => item.issueYear).filter(Boolean))];
    years.sort((a, b) => Number(b) - Number(a));

    if (years.length === 0) {
        alert('うてな俳句のデータがまだ登録されていません。');
        return;
    }

    years.forEach(year => {
        const el = document.createElement('div');
        el.className = 'vertical-link';
        el.innerText = toJapaneseEra(year);
        el.onclick = function() { showIssueMonthList(year); };
        container.appendChild(el);
    });
    
    renderPage('issueYearPage');
    adjustScrollAlignment(container);
}

// 🌸 月選択一覧
function showIssueMonthList(year) {
    navState.category = 'utena_archive';
    navState.issueYear = year; 
    navState.issueMonth = '';

    const container = document.getElementById('issueMonthList');
    if (!container) return;
    container.innerHTML = '';

    let issueHaikus = haikuDatabase.filter(item => item.issueYear === year);
    let monthMap = {};
    issueHaikus.forEach(item => {
        if (item.issueMonth && !monthMap[item.issueMonth]) {
            monthMap[item.issueMonth] = item.issueNumber || '';
        }
    });

    let months = Object.keys(monthMap).sort((a, b) => Number(b) - Number(a));

    months.forEach(month => {
        let issueNo = monthMap[month];
        let kanjiMonth = toKanjiMonth(month);
        let label = issueNo ? `${kanjiMonth}（第${issueNo}号）` : `${kanjiMonth}`;
        
        const el = document.createElement('div');
        el.className = 'vertical-link';
        el.innerText = label;
        el.onclick = function() { showIssueDetailPage(year, month); };
        container.appendChild(el);
    });

    renderPage('issueMonthPage');
    adjustScrollAlignment(container);
}

// 🌸 号内モード選択画面
function showIssueDetailPage(year, month) {
    navState.category = 'utena_archive';
    navState.issueYear = year; 
    navState.issueMonth = month;

    const container = document.getElementById('issueDetailContent');
    if (!container) return;
    container.innerHTML = '';

    let issueHaikus = haikuDatabase.filter(item => item.issueYear === year && item.issueMonth === month);
    let monthLabel = toKanjiMonth(month);

    const allBtn = document.createElement('div');
    allBtn.className = 'vertical-link utena-mode-btn';
    allBtn.innerText = `おみ句じ（${monthLabel}号）`;
    allBtn.onclick = function() {
        navState.authorName = '';
        currentDisplayType = 'issue_all';
        currentRoomHaikus = [...issueHaikus];
        shuffleArray(currentRoomHaikus);
        currentIndex = 0;
        renderPage('roomPage');
        updateHaikuDisplay();
    };
    container.appendChild(allBtn);

    const haijinBtn = document.createElement('div');
    haijinBtn.className = 'vertical-link utena-mode-btn';
    haijinBtn.innerText = '俳人別';
    haijinBtn.onclick = function() {
        showUtenaAuthorListPage();
    };
    container.appendChild(haijinBtn);

    container.style.justifyContent = 'center';
    renderPage('issueDetailPage');
}

// 🌸 号内・俳人一覧
function showUtenaAuthorListPage() {
    const container = document.getElementById('utenaAuthorList');
    if (!container) return;
    container.innerHTML = '';

    let issueHaikus = haikuDatabase.filter(item => item.issueYear === navState.issueYear && item.issueMonth === navState.issueMonth);
    let orderedAuthors = [];
    issueHaikus.forEach(item => {
        if (item.author && !orderedAuthors.includes(item.author)) {
            orderedAuthors.push(item.author);
        }
    });

    orderedAuthors.forEach(author => {
        const el = document.createElement('div');
        el.className = 'vertical-link';
        el.innerText = author;
        el.onclick = function() {
            showUtenaAuthorWorks(author);
        };
        container.appendChild(el);
    });

    renderPage('utenaAuthorListPage');
    adjustScrollAlignment(container);
}

// 🌸 号内・俳人作品一覧
function showUtenaAuthorWorks(author) {
    navState.authorName = author;
    let issueHaikus = haikuDatabase.filter(item => item.issueYear === navState.issueYear && item.issueMonth === navState.issueMonth && item.author === author);

    const container = document.getElementById('saijikiHaikuList');
    if (!container) return;
    container.innerHTML = '';

    if (issueHaikus.length === 0) {
        alert('作品が見つかりませんでした。');
        return;
    }

    issueHaikus.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'saijiki-haiku-card utena-work-card';
        card.innerHTML = `
            <div class="saijiki-phrase utena-phrase">${formatRubyText(item.phrase)}</div>
        `;
        container.appendChild(card);
    });

    renderPage('saijikiListRoomPage');
    adjustScrollAlignment(container);
}

// 🚪 一句鑑賞ルームの開始
function openRoom(type, targetValue, displayName) {
    currentDisplayType = type; 
    if (type === 'author') { 
        navState.category = 'haijin'; 
        navState.isDetarame = false; 
        currentRoomHaikus = haikuDatabase.filter(item => item.author === targetValue); 
        shuffleArray(currentRoomHaikus); 
    }
    else if (type === 'haiku_season') { 
        navState.category = 'haiku'; 
        navState.seasonName = displayName; 
        navState.isDetarame = false; 
        currentRoomHaikus = haikuDatabase.filter(item => item.season === targetValue); 
        shuffleArray(currentRoomHaikus); 
    }
    else if (type === 'detarame') { 
        navState.category = 'omikuji_all'; 
        navState.isDetarame = true; 
        currentRoomHaikus = [...haikuDatabase]; 
        shuffleArray(currentRoomHaikus); 
    }
    else if (type === 'kigo_muki') { 
        navState.category = 'saijiki'; 
        navState.seasonName = '無季'; 
        navState.kigoName = '無季'; 
        navState.isDetarame = false; 
        currentRoomHaikus = haikuDatabase.filter(item => item.season === 'muki'); 
        shuffleArray(currentRoomHaikus); 
    }
    
    if (currentRoomHaikus.length === 0) { 
        alert('まだ条件に合う俳句が登録されていません。'); 
        return; 
    }
    currentIndex = 0; 
    renderPage('roomPage'); 
    updateHaikuDisplay();
}

function shuffleArray(array) { 
    for (let i = array.length - 1; i > 0; i--) { 
        const j = Math.floor(Math.random() * (i + 1)); 
        [array[i], array[j]] = [array[j], array[i]]; 
    } 
}

function changeHaiku(direction) { 
    if (currentIndex + direction >= 0 && currentIndex + direction < currentRoomHaikus.length) { 
        currentIndex += direction; 
        updateHaikuDisplay(); 
    } 
}

// 🌸 iマークタップ時の作者名／季語表示制御
function revealHiddenInfo() {
    infoRevealed = true; 
    const infoTrigger = document.getElementById('infoTrigger');
    if (infoTrigger) infoTrigger.style.display = 'none';
    
    const currentHaiku = currentRoomHaikus[currentIndex];
    if (!currentHaiku) return;

    let kigoStr = (currentHaiku.season === 'muki') ? '無季' : (currentHaiku.parentKigo || currentHaiku.kigo);
    if (currentHaiku.detailSeason) {
        kigoStr = `${kigoStr}（${currentHaiku.detailSeason}）`;
    }

    const mainTag = document.getElementById('roomMainTag');
    if (mainTag) {
        mainTag.className = 'info-upper-tag';
        if (navState.category === 'haiku') {
            mainTag.innerHTML = `<div><a href="javascript:void(0);" onclick="jumpToAuthorRoom('${currentHaiku.author}')">${currentHaiku.author}</a></div>`;
        } else {
            mainTag.innerHTML = `<div class="info-kigo-sub">${kigoStr}</div><div><a href="javascript:void(0);" onclick="jumpToAuthorRoom('${currentHaiku.author}')">${currentHaiku.author}</a></div>`;
        }
    }
    updateBreadcrumb();
}

// 🌸 作品鑑賞画面の表示更新
function updateHaikuDisplay() {
    const currentHaiku = currentRoomHaikus[currentIndex];
    if (!currentHaiku) return;

    const phraseEl = document.getElementById('haikuPhrase');
    if (phraseEl) phraseEl.innerHTML = formatRubyText(currentHaiku.phrase);

    let kigoString = (currentHaiku.season === 'muki') ? '無季' : (currentHaiku.parentKigo || currentHaiku.kigo);
    if (currentHaiku.detailSeason) {
        kigoString = `${kigoString}（${currentHaiku.detailSeason}）`;
    }

    const infoTrigger = document.getElementById('infoTrigger');
    const mainTag = document.getElementById('roomMainTag');

    if (navState.category === 'kushu' && currentDisplayType === 'kushu_author') {
        // 🌟 句集のおみ句じ：右上は作者名のみを表示
        if (infoTrigger) infoTrigger.style.display = 'none';
        if (mainTag) {
            mainTag.className = 'info-upper-tag';
            mainTag.innerText = currentKushuAuthor || currentHaiku.author;
        }
    }
    else if (['omikuji_all', 'haiku'].includes(navState.category) || (navState.category === 'utena_archive' && currentDisplayType === 'issue_all')) {
        infoRevealed = false; 
        if (mainTag) mainTag.innerText = ''; 
        if (infoTrigger) infoTrigger.style.display = 'inline-block';
    } 
    else if (['haijin', 'utena_archive'].includes(navState.category)) {
        if (infoTrigger) infoTrigger.style.display = 'none'; 
        if (mainTag) { mainTag.className = 'info-upper-tag'; mainTag.innerText = kigoString; }
    }
    else {
        if (infoTrigger) infoTrigger.style.display = 'none'; 
        if (mainTag) { mainTag.className = 'info-upper-tag'; mainTag.innerText = currentHaiku.author; }
    }

    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    if (prevBtn) prevBtn.classList.toggle('disabled', currentIndex === 0);
    if (nextBtn) nextBtn.classList.toggle('disabled', currentIndex === currentRoomHaikus.length - 1);
    
    updateBreadcrumb();
}

// 📱 スワイプ操作の初期化
function initSwipeEvents() {
    const room = document.getElementById('roomPage');
    if (!room) return;

    room.addEventListener('touchstart', function(e) {
        if (!isRoomOpen) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    room.addEventListener('touchend', function(e) {
        if (!isRoomOpen) return;
        const diffX = e.changedTouches[0].clientX - touchStartX;
        const diffY = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > 0) changeHaiku(1);
            else changeHaiku(-1);
        }
    }, { passive: true });
}

// ⌨️ キーボード操作
document.addEventListener('keydown', function(event) {
    const activeEl = document.activeElement;
    if (activeEl && activeEl.tagName === 'INPUT') return;

    if (event.key === 'o' || event.key === 'O') { 
        launchOmikuji(); 
        return; 
    }
    if (!isRoomOpen) return;
    if (event.key === 'ArrowLeft') changeHaiku(1); 
    if (event.key === 'ArrowRight') changeHaiku(-1); 
    if (event.key === 'i' || event.key === 'I') {
        if (!infoRevealed) revealHiddenInfo();
    }
});
