/**
 * ========================================================
 * 🏡 app.js - うてな俳句 アプリケーションコア & ルーティング
 * ========================================================
 */

// 🌸 アプリケーション状態管理
let haikuDatabase = (typeof window !== 'undefined' && window.__UTENA_HAIKU_DATA__) ? window.__UTENA_HAIKU_DATA__ : [];
let saijikiDict = (typeof window !== 'undefined' && window.__UTENA_SAIJIKI_DATA__) ? window.__UTENA_SAIJIKI_DATA__ : {}; 
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
    if (typeof applyAllSettings === 'function') applyAllSettings();
    renderPage('topPage');
    await loadAppData();

    // 起動時おみ句じがONの場合は自動でおみ句じを開始
    if (typeof appSettings !== 'undefined' && appSettings.autoOmikuji) {
        launchOmikuji();
    }
};

/**
 * データ読み込み処理
 * 1. window.__UTENA_...（バンドルデータ）があれば即座に初期化（0秒・CORS無制限）
 * 2. localStorage キャッシュがあれば初期化
 * 3. fetch で最新の saijiki.json と haiku.json を並列取得して更新
 */
async function loadAppData() {
    let hasData = false;

    // ① バンドルスクリプトデータのチェック（ローカル環境でも100%確実に即時起動）
    if (window.__UTENA_SAIJIKI_DATA__ && window.__UTENA_HAIKU_DATA__) {
        saijikiDict = window.__UTENA_SAIJIKI_DATA__;
        haikuDatabase = window.__UTENA_HAIKU_DATA__;
        if (haikuDatabase.length > 0) {
            hasData = true;
            hideLoadingOverlay();
        }
    }

    // ② ローカルキャッシュのチェック
    if (!hasData) {
        try {
            const cachedSaijiki = localStorage.getItem('utena_saijiki_data');
            const cachedHaiku = localStorage.getItem('utena_haiku_data');
            if (cachedSaijiki && cachedHaiku) {
                saijikiDict = JSON.parse(cachedSaijiki);
                haikuDatabase = JSON.parse(cachedHaiku);
                if (haikuDatabase.length > 0) {
                    hasData = true;
                    hideLoadingOverlay();
                }
            }
        } catch (e) {
            console.warn('キャッシュ読み込み失敗:', e);
        }
    }

    // ③ 最新 JSON データのフェッチ（Webサーバー経由時の更新）
    try {
        const [resSaijiki, resHaiku] = await Promise.all([
            fetch('./saijiki.json', { cache: 'no-cache' }),
            fetch('./haiku.json', { cache: 'no-cache' })
        ]);

        if (resSaijiki.ok && resHaiku.ok) {
            const freshSaijiki = await resSaijiki.json();
            const freshHaiku = await resHaiku.json();

            saijikiDict = freshSaijiki;
            haikuDatabase = freshHaiku;

            try {
                localStorage.setItem('utena_saijiki_data', JSON.stringify(freshSaijiki));
                localStorage.setItem('utena_haiku_data', JSON.stringify(freshHaiku));
            } catch (storageErr) {
                console.warn('localStorage 保存容量オーバー等の警告:', storageErr);
            }
            hasData = true;
            hideLoadingOverlay();
        }
    } catch (err) {
        // fetchが失敗してもバンドルデータがあれば問題なし
        if (hasData) {
            hideLoadingOverlay();
        } else {
            console.error('最新データ取得エラー:', err);
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
    
    const infoTrigger = document.getElementById('infoTrigger');
    const mainTag = document.getElementById('roomMainTag');

    if (pageId !== 'roomPage') {
        if (infoTrigger) {
            infoTrigger.style.display = 'none';
            infoTrigger.onclick = revealHiddenInfo; // 🌟 本来の動作に確実にリセット
        }
        if (mainTag) mainTag.innerText = '';
    } else {
        if (infoTrigger) {
            infoTrigger.onclick = revealHiddenInfo; // 🌟 一句部屋では必ずrevealHiddenInfoに設定
        }
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
        if (!appSettings.catVisible) {
            catBtn.classList.add('hidden');
        } else if (navState.category === 'saijiki' || navState.category === 'kushu' || (navState.category === 'utena_archive' && !isRoomOpen)) {
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

// 🌸 横スクロールコンテナの配置調整（要素数が少なく収まる時は中央揃えクラスを付与）
function adjustScrollAlignment(container) {
    if (!container) return;
    requestAnimationFrame(() => {
        if (container.scrollWidth > container.clientWidth) {
            container.classList.remove('is-centered');
        } else {
            container.classList.add('is-centered');
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
    if (phraseEl) {
        phraseEl.innerHTML = formatRubyText(currentHaiku.phrase);

        // 🌟 文字数に応じた動的文字サイズ調整
        // ルビ（《...》、[... ]、（...）、<rt>...</rt>）を完全に除外して純粋な本体の文字数のみを正確にカウント！
        const plainText = (currentHaiku.phrase || '')
            .replace(/｜/g, '')
            .replace(/《[^》]*?》/g, '')
            .replace(/\[[^\]]*?\]/g, '')
            .replace(/[（(][^）)]*?[）)]/g, '')
            .replace(/<rt>.*?<\/rt>/g, '')
            .replace(/<[^>]+>/g, '')
            .replace(/[\s　]/g, '');
        const charCount = plainText.length || 17;

        const isLarge = (typeof appSettings !== 'undefined' && appSettings.fontSize === 'large');
        if (charCount > 17) {
            // 17文字超（最大20文字超）の場合は縦幅に合わせて文字サイズと文字間隔を自動最適化
            const maxVh = isLarge ? 64 : 60;
            const dynamicVh = Math.min(isLarge ? 3.4 : 2.9, (maxVh / (charCount * 1.16)));
            phraseEl.style.fontSize = `min(${dynamicVh.toFixed(2)}vh, ${isLarge ? 28 : 24}px)`;
            phraseEl.style.letterSpacing = isLarge ? '0.12em' : '0.15em';
        } else {
            // 通常（17文字以内）はCSSのデフォルトクラス（または設定サイズ）を適用
            phraseEl.style.fontSize = '';
            phraseEl.style.letterSpacing = '';
        }
    }

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
