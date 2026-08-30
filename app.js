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
            if (navState.currentLayer === 'kushuDetailPage') {
                html += ` <span class="separator">&lt;</span> <span class="current">${escapeHtml(navState.authorName)}</span>`;
            } else if (navState.currentLayer === 'roomPage') {
                html += ` <span class="separator">&lt;</span> <span class="link" onclick="showKushuAuthorDetail('${escapeHtml(navState.authorName)}')">${escapeHtml(navState.authorName)}</span>`;
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
    else if (pageId === 'kushuAuthorPage' || pageId === 'kushuDetailPage') navState.category = 'kushu';
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
// 👥 句集（俳人別アーカイブ ＆ 時系列スクロール）
// ========================================================

let currentKushuAuthor = '';
let currentKushuMode = 'chrono'; // 'chrono' | 'omikuji'

// 🌸 句集：俳人一覧の表示
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
        
        let rubyHtml = escapeHtml(item.name);
        if (item.kana && item.kana !== item.name) {
            rubyHtml = `<ruby>${escapeHtml(item.name)}<rt>${escapeHtml(item.kana)}</rt></ruby>`;
        }
        
        const countStr = toKanjiNum(String(item.count)) + '句';

        el.innerHTML = `
            <div class="kushu-author-name">${rubyHtml}</div>
            <span class="kushu-count-badge">${countStr}</span>
        `;
        el.onclick = () => showKushuAuthorDetail(item.name);
        container.appendChild(el);
    });

    renderPage('kushuAuthorPage');
    adjustScrollAlignment(container);
}

// 🌸 句集：俳人詳細（時系列スクロール画面）
function showKushuAuthorDetail(authorName) {
    currentKushuAuthor = authorName;
    navState.category = 'kushu';
    navState.authorName = authorName;
    switchKushuMode('chrono');
}

// 🌸 句集モード切替（時系列 ｜ おみ句じ）
function switchKushuMode(mode) {
    currentKushuMode = mode;
    const tabChrono = document.getElementById('kmodeChrono');
    const tabOmikuji = document.getElementById('kmodeOmikuji');
    const toggleGroup = document.querySelector('.kushu-toggle-group');

    if (tabChrono) tabChrono.classList.toggle('active', mode === 'chrono');
    if (tabOmikuji) tabOmikuji.classList.toggle('active', mode === 'omikuji');

    if (mode === 'chrono') {
        if (toggleGroup) toggleGroup.style.display = 'flex';
        renderKushuChronoList();
    } else {
        // おみ句じモード（当該作者の全句をランダム一句鑑賞）
        if (toggleGroup) toggleGroup.style.display = 'none';
        openRoom('author', currentKushuAuthor, currentKushuAuthor);
    }
}

// 🌸 句集：時系列スクロールの描画（発行年月セパレーター挿入）
function renderKushuChronoList() {
    const container = document.getElementById('kushuHaikuList');
    if (!container) return;
    container.innerHTML = '';

    let authorHaikus = haikuDatabase.filter(h => h.author === currentKushuAuthor);
    if (authorHaikus.length === 0) {
        container.innerHTML = '<div style="writing-mode: vertical-rl; -webkit-writing-mode: vertical-rl; color: #888; margin: auto;">作品が登録されていません</div>';
        renderPage('kushuDetailPage');
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

        // 句カード
        const card = document.createElement('div');
        card.className = 'kushu-haiku-card';
        
        const kigoText = item.kigo ? escapeHtml(item.kigo) : '';
        const seasonJa = SEASON_NAMES_JA[item.season] || '';
        const tagText = kigoText ? `${kigoText}（${seasonJa}）` : seasonJa;

        card.innerHTML = `
            <div class="kushu-phrase">${formatRubyText(item.phrase)}</div>
            ${tagText ? `<div class="kushu-kigo-tag">${tagText}</div>` : ''}
        `;
        container.appendChild(card);
    });

    renderPage('kushuDetailPage');
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

    if (['omikuji_all', 'haiku'].includes(navState.category) || (navState.category === 'utena_archive' && currentDisplayType === 'issue_all')) {
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
