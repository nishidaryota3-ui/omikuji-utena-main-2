/**
 * ========================================================
 * 🌸 saijiki.js - 季寄せ・歳時記大画面モジュール
 * ========================================================
 */


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


// 🌸 季寄せ季語一覧の描画（右から左へ並ぶ縦書きリスト ＋ 句数バッジ ＋ 五十音/時候順切り替え）
function renderSaijikiKigoList() {
    const container = document.getElementById('saijikiKigoList');
    if (!container) return;
    container.innerHTML = '';

    const query = document.getElementById('saijikiSearchInput') ? document.getElementById('saijikiSearchInput').value.trim().toLowerCase() : '';

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

    const renderItem = (pData, timingText, catText) => {
        const works = kigoWorkMap.get(pData.parentKigo) || [];
        const workCount = works.length;
        const rowChar = getGojuonRowChar(pData.parentKana || pData.parentKigo);

        const itemEl = document.createElement('div');
        itemEl.className = 'saijiki-kigo-item';
        itemEl.setAttribute('data-row', rowChar);
        itemEl.setAttribute('data-timing', timingText || pData.detailSeason || '');
        itemEl.setAttribute('data-cat', catText || pData.category || '');
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

    const renderHeadingSet = (timingText, catText, activeTiming) => {
        const sep = document.createElement('div');
        sep.className = 'saijiki-heading-set';
        sep.setAttribute('data-timing', activeTiming || timingText || '');
        sep.setAttribute('data-cat', catText || '');
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
        sorted.forEach(p => renderItem(p, '', p.category || ''));
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
                        renderHeadingSet(tKey, bKey, tKey);
                        isFirstTimingHeader = false;
                    } else {
                        renderHeadingSet('', bKey, tKey);
                    }
                    sortKana(group).forEach(p => renderItem(p, tKey, bKey));
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

        // 画面の透かし文字（左側）に近い要素をターゲットにする
        const targetX = window.innerWidth * 0.35;
        let activeEl = null;
        let minDiff = Infinity;

        items.forEach(el => {
            const rect = el.getBoundingClientRect();
            // 画面内にある要素を優先
            if (rect.right > 0 && rect.left < window.innerWidth) {
                const center = rect.left + rect.width / 2;
                const diff = Math.abs(center - targetX);
                if (diff < minDiff) {
                    minDiff = diff;
                    activeEl = el;
                }
            }
        });

        // 画面内要素が見つからなければ全体から探索
        if (!activeEl) {
            items.forEach(el => {
                const rect = el.getBoundingClientRect();
                const center = rect.left + rect.width / 2;
                const diff = Math.abs(center - targetX);
                if (diff < minDiff) {
                    minDiff = diff;
                    activeEl = el;
                }
            });
        }

        if (activeEl) {
            const t = activeEl.getAttribute('data-timing') || '';
            const c = activeEl.getAttribute('data-cat') || '';
            if (t && wmTiming && wmTiming.innerText !== t) wmTiming.innerText = t;
            if (c && wmCat && wmCat.innerText !== c) wmCat.innerText = c;
        }
    };

    container.onscroll = updateWatermark;
    // 初回・レンダリング直後に反映
    setTimeout(updateWatermark, 50);
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
