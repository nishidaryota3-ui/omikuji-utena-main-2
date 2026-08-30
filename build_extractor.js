const fs = require("fs");

const kigoLookup = JSON.parse(fs.readFileSync("kigo_lookup.json", "utf8"));
const authorLookup = JSON.parse(fs.readFileSync("author_lookup.json", "utf8"));

kigoLookup.forEach(k => {
    const hasKanji = /[\u4E00-\u9FFF\u3005]/.test(k.kigo);
    k.matchScore = k.len + (hasKanji ? 10 : 0);
});
kigoLookup.sort((a, b) => b.matchScore - a.matchScore);

const htmlTemplate = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🌸 うてな俳句会 会誌PDF & CSV 俳句・季語・作者 完全自動抽出ツール</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
            background-color: #f7f6f2; color: #2b2b2b; padding: 25px 20px; line-height: 1.6;
        }
        .container { max-width: 1350px; margin: 0 auto; }
        header { text-align: center; margin-bottom: 20px; }
        h1 { font-size: 1.55rem; color: #2c2c2c; margin-bottom: 6px; }
        p.subtitle { font-size: 0.85rem; color: #666; }

        .card {
            background: #fff; border-radius: 12px; padding: 20px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.06); margin-bottom: 20px;
        }

        .drop-zone {
            border: 2px dashed #b5a895; border-radius: 8px; padding: 28px 20px;
            text-align: center; background: #faf9f6; cursor: pointer; transition: all 0.2s;
        }
        .drop-zone:hover, .drop-zone.dragover { background: #f0ede6; border-color: #7a6e5d; }
        .drop-icon { font-size: 2.2rem; margin-bottom: 6px; }
        .drop-text { font-size: 1.05rem; font-weight: 500; color: #444; }
        .drop-sub { font-size: 0.82rem; color: #888; margin-top: 4px; }

        .meta-inputs {
            display: flex; gap: 15px; margin-top: 14px; flex-wrap: wrap; align-items: center; justify-content: center;
        }
        .input-group { display: flex; align-items: center; gap: 6px; }
        .input-group label { font-size: 0.85rem; font-weight: bold; color: #555; }
        .input-group input {
            padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.9rem; width: 80px; text-align: center;
        }

        .action-bar {
            display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;
        }
        .btn {
            padding: 9px 16px; font-size: 0.88rem; font-weight: bold; border: none; border-radius: 6px; cursor: pointer;
            display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;
        }
        .btn-sm { padding: 4px 8px; font-size: 0.78rem; border-radius: 4px; }
        .btn-success { background: #10b981; color: white; box-shadow: 0 2px 6px rgba(16,185,129,0.3); }
        .btn-success:hover { background: #059669; }
        .btn-primary { background: #3b82f6; color: white; box-shadow: 0 2px 6px rgba(59,130,246,0.3); }
        .btn-primary:hover { background: #2563eb; }
        .btn-outline { background: white; border: 1px solid #ccc; color: #333; }
        .btn-outline:hover { background: #f3f4f6; }
        .btn-danger { background: #fee2e2; border: 1px solid #fca5a5; color: #b91c1c; }
        .btn-danger:hover { background: #fecaca; }
        .btn-gas { background: #e0f2fe; border: 1px solid #7dd3fc; color: #0369a1; }
        .btn-gas:hover { background: #bae6fd; }

        .count-badge {
            background: #e0e7ff; color: #3730a3; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 0.85rem;
        }

        .filter-input {
            padding: 6px 12px; border: 1px solid #ccc; border-radius: 6px; font-size: 0.85rem; width: 180px;
        }

        .guide-box {
            background: #fdf8f0; border: 1px solid #f3e5d0; border-radius: 6px; padding: 10px 14px;
            font-size: 0.82rem; color: #854d0e; margin-bottom: 12px; line-height: 1.5;
            display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;
        }

        .table-wrap {
            max-height: 540px; overflow: auto; border: 1px solid #e5e7eb; border-radius: 8px;
        }
        table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; min-width: 1100px; }
        th, td { padding: 8px 10px; border-bottom: 1px solid #eee; border-right: 1px solid #f0f0f0; }
        th { background: #f9fafb; font-weight: 600; color: #4b5563; position: sticky; top: 0; z-index: 10; font-size: 0.8rem; }
        tr:hover { background: #faf9f6; }
        td.phrase-cell { font-family: "游明朝", "Yu Mincho", serif; font-size: 0.95rem; }
        td[contenteditable="true"] { outline: none; cursor: text; }
        td[contenteditable="true"]:focus { background: #fffbe6; box-shadow: inset 0 0 0 2px #f59e0b; }
        
        .kigo-tag {
            background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.82rem; display: inline-block;
        }
        .muki-tag {
            background: #f3f4f6; color: #6b7280; padding: 2px 6px; border-radius: 4px; font-size: 0.82rem; display: inline-block;
        }
        .edited-tag {
            background: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.82rem; display: inline-block;
        }
        .learned-tag {
            background: #dcfce7; color: #15803d; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.82rem; display: inline-block;
        }

        .kigo-cell-content {
            display: flex; align-items: center; justify-content: space-between; gap: 4px;
        }

        .toast {
            position: fixed; bottom: 25px; right: 25px; background: #1f2937; color: white; padding: 12px 24px;
            border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: none; z-index: 100; font-size: 0.9rem;
        }
        .loading-spinner {
            display: none; align-items: center; justify-content: center; gap: 8px; font-size: 0.9rem; color: #3b82f6; font-weight: bold; margin-top: 10px;
        }

        .modal {
            display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); z-index: 200; align-items: center; justify-content: center;
        }
        .modal-content {
            background: white; border-radius: 12px; padding: 24px; width: 90%; max-width: 550px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        }
    </style>
    <!-- PDF.js CDN -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
</head>
<body>

<div class="container">
    <header>
        <h1>🌸 うてな俳句会 会誌PDF & CSV 俳句・季語・作者 完全自動抽出ツール</h1>
        <p class="subtitle">会誌PDF または CSVファイルをドロップするだけで、季語・親季語・季節を全自動判定し、スプレッドシートへ直貼りできます</p>
    </header>

    <div class="card">
        <div id="dropZone" class="drop-zone" onclick="document.getElementById('fileInput').click()">
            <div class="drop-icon">📑</div>
            <div class="drop-text" id="dropMainText">ここに 会誌PDF または CSV / TSV ファイルをドラッグ＆ドロップ</div>
            <div class="drop-sub" id="dropSubText">（PDF: 2025年 4月号.pdf / CSV: 俳句・作者リスト等）※空白の自動除去・季語の自動判定を一瞬で完了します</div>
            <input type="file" id="fileInput" accept=".pdf,.csv,.tsv,.txt" style="display: none;">
        </div>

        <div class="meta-inputs">
            <div class="input-group">
                <label>発行年:</label>
                <input type="number" id="inputYear" value="2025">
            </div>
            <div class="input-group">
                <label>発行月:</label>
                <input type="number" id="inputMonth" value="4">
            </div>
            <div class="input-group">
                <label>号数:</label>
                <input type="number" id="inputIssue" value="199">
            </div>
            <div class="input-group" style="margin-left: 10px;">
                <label><input type="checkbox" id="checkIncludeRuby" checked onchange="toggleRubyDisplay()"> ルビ（パイプ記法）を付与</label>
            </div>
            <button class="btn btn-outline btn-sm" onclick="openSettingsModal()" style="margin-left: auto;">
                ⚙️ スプレッドシート直接連携設定
            </button>
        </div>

        <div id="loadingSpinner" class="loading-spinner">
            <span>⏳ データを高速解析中...（2万件の歳時記辞書と照合中）</span>
        </div>
    </div>

    <div id="resultCard" class="card" style="display: none;">
        <div class="guide-box">
            <div>
                💡 <strong>1箇所直せば全句に自動波及:</strong> 1つの句で季語を手直し・登録すると、<strong>同じPDF内の他の句にある同じ言葉も自動で一括判定</strong>されます！
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="btn btn-outline btn-sm" onclick="syncWithOnlineSpreadsheet()">🔄 大元シートから最新辞書を同期</button>
            </div>
        </div>

        <div class="action-bar">
            <div style="display: flex; align-items: center; gap: 10px;">
                <span class="count-badge" id="countBadge">0 句</span>
                <span id="fileNameLabel" style="font-size: 0.85rem; color: #666;"></span>
                <input type="text" id="filterInput" class="filter-input" placeholder="🔍 作者や季語で絞り込み" oninput="filterTable()">
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <button class="btn btn-primary" onclick="copyForHaikuShusei(false)" title="A列〜H列（俳句〜詳細季節）のみコピー">📋 A〜H列のみコピー（CSV・古典用）</button>
                <button class="btn btn-success" onclick="copyForHaikuShusei(true)" title="A列〜L列（発行年月号を含む全12列）をコピー">📋 「俳句集成」用に全12列コピー</button>
                <button class="btn btn-outline" onclick="downloadCsv()">💾 CSV保存</button>
                <button class="btn btn-outline" onclick="downloadJson()">💾 JSON保存</button>
                <button class="btn btn-danger btn-sm" onclick="clearAllData()" title="画面をリセットして初期状態に戻します">🗑️ クリア</button>
            </div>
        </div>

        <div class="table-wrap">
            <table id="resultTable">
                <thead>
                    <tr>
                        <th style="width: 35px;">No.</th>
                        <th style="width: 270px;">A: 俳句（直接編集可能）</th>
                        <th style="width: 90px;">B: 作者</th>
                        <th style="width: 100px;">C: 作者かな</th>
                        <th style="width: 130px;">D: 確定季語（編集可）</th>
                        <th style="width: 100px;">E: 親季語（編集可）</th>
                        <th style="width: 90px;">F: 季語かな</th>
                        <th style="width: 55px;">G: 季節</th>
                        <th style="width: 65px;">H: 詳細季節</th>
                        <th style="width: 50px;">J: 年</th>
                        <th style="width: 40px;">K: 月</th>
                        <th style="width: 40px;">L: 号</th>
                    </tr>
                </thead>
                <tbody id="tableBody"></tbody>
            </table>
        </div>
    </div>
</div>

<!-- 設定モーダル -->
<div id="settingsModal" class="modal">
    <div class="modal-content">
        <h3 style="margin-bottom: 12px; font-size: 1.15rem;">⚙️ 大元スプレッドシート直接登録（GAS）設定</h3>
        <p style="font-size: 0.83rem; color: #666; margin-bottom: 15px; line-height: 1.5;">
            「歳時記データベース」スプレッドシートに配置した Google Apps Script の「ウェブアプリURL」を入力すると、画面上のボタンから親季語グループの中や、季節ブロックの末尾に直接自動挿入できるようになります。
        </p>
        <div style="margin-bottom: 15px;">
            <label style="display: block; font-size: 0.85rem; font-weight: bold; margin-bottom: 5px;">GAS ウェブアプリ URL:</label>
            <input type="text" id="gasApiUrlInput" placeholder="https://script.google.com/macros/s/.../exec" style="width: 100%; padding: 8px 12px; border: 1px solid #ccc; border-radius: 6px; font-size: 0.85rem;">
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button class="btn btn-outline" onclick="closeSettingsModal()">キャンセル</button>
            <button class="btn btn-primary" onclick="saveSettings()">保存する</button>
        </div>
    </div>
</div>

<div id="toast" class="toast">✔ コピーしました！ スプレッドシートの空き行で Cmd+V を押してください。</div>

<script>
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let kigoLookup = __KIGO_LOOKUP_JSON__;
const authorLookup = __AUTHOR_LOOKUP_JSON__;

const learnedKigoMap = JSON.parse(localStorage.getItem('utena_learned_kigos') || '{}');
let gasApiUrl = localStorage.getItem('utena_gas_api_url') || '';

Object.keys(learnedKigoMap).forEach(k => {
    const item = learnedKigoMap[k];
    kigoLookup.unshift({
        kigo: k,
        parentKigo: item.parentKigo,
        kigoKana: item.kigoKana || '',
        season: item.season || '',
        detailSeason: item.detailSeason || '',
        len: k.length,
        matchScore: 999,
        isLearned: true
    });
});

let selectedFile = null;
let extractedHaikus = [];

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFileSelect(e.target.files[0]);
});

function handleFileSelect(file) {
    selectedFile = file;
    document.getElementById('dropMainText').innerText = '📄 選択中: ' + file.name;

    const yearMatch = file.name.match(/(20\\d\\d)/);
    const monthMatch = file.name.match(/(\\d{1,2})月/);
    if (yearMatch) document.getElementById('inputYear').value = yearMatch[1];
    if (monthMatch) document.getElementById('inputMonth').value = monthMatch[1];

    if (file.name.endsWith('.pdf')) {
        processPdfFile();
    } else if (file.name.endsWith('.csv') || file.name.endsWith('.tsv') || file.name.endsWith('.txt')) {
        processCsvFile();
    } else {
        alert('PDF または CSV/TSV ファイルを選択してください。');
    }
}

async function processCsvFile() {
    document.getElementById('loadingSpinner').style.display = 'flex';
    const text = await selectedFile.text();
    const lines = text.split(/\\r?\\n/).map(l => l.trim()).filter(Boolean);

    extractedHaikus = [];
    const isTsv = selectedFile.name.endsWith('.tsv') || lines[0].includes('\\t');
    const separator = isTsv ? '\\t' : ',';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (i === 0 && (line.includes('俳句') || line.includes('作者'))) {
            continue;
        }

        const parts = parseCsvLine(line, separator);
        if (parts.length === 0) continue;

        const rawPhrase = (parts[0] || '').trim().replace(/[\\s\\u3000]+/g, '');
        const author = (parts[1] || '').trim();
        let authorKana = (parts[2] || '').trim();

        if (!authorKana && author) {
            authorKana = authorLookup[author] || '';
        }

        if (rawPhrase.length >= 5) {
            const kigoInfo = matchKigoInfo(rawPhrase);
            extractedHaikus.push({
                phrasePlain: rawPhrase,
                phraseWithRuby: rawPhrase,
                author: author,
                authorKana: authorKana,
                ...kigoInfo,
                manualKigo: parts[8] || '',
                section: 'CSVインポート',
                page: '',
                year: parts[9] || '',
                month: parts[10] || '',
                issueNumber: parts[11] || ''
            });
        }
    }

    document.getElementById('loadingSpinner').style.display = 'none';
    renderResultsTable();
}

function parseCsvLine(text, separator) {
    if (separator === '\\t') {
        return text.split('\\t');
    }
    const result = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') {
            inQuotes = !inQuotes;
        } else if (c === ',' && !inQuotes) {
            result.push(cur.replace(/^"|"$/g, '').trim());
            cur = "";
        } else {
            cur += c;
        }
    }
    result.push(cur.replace(/^"|"$/g, '').trim());
    return result;
}

function cleanAuthor(text) {
    if (!text) return "";
    let cleaned = text.replace(/^(松山市|東京都|大阪府|広島県|神奈川県|パラオ|愛媛県)/, '').replace(/[\\s\\u3000]+/g, '').trim();
    ["春浅し", "雛祭り", "花菜畑", "仲春", "花ミモザ", "落椿", "獺祭", "篠笛", "春の雪", "紫木蓮", "春一番", "菜の花", "桃の花", "鹿尾菜刈る", "花すみれ", "うてな集", "小天守"].forEach(w => {
        cleaned = cleaned.replace(w, '');
    });
    return cleaned.trim();
}

function isTitleOrAuthor(text, titles, author) {
    if (!text || text.length <= 7) return true;
    if (text === author || titles.includes(text)) return true;
    return false;
}

function groupCharsIntoColumns(charList, threshold = 8.0) {
    const sorted = [...charList].sort((a, b) => b.x - a.x);
    const cols = [];
    let curr = [];
    let currX = null;
    for (const c of sorted) {
        if (currX === null) {
            currX = c.x;
            curr.push(c);
        } else {
            if (Math.abs(c.x - currX) < threshold) {
                curr.push(c);
            } else {
                cols.push(curr.sort((a, b) => b.y - a.y));
                curr = [c];
                currX = c.x;
            }
        }
    }
    if (curr.length > 0) cols.push(curr.sort((a, b) => b.y - a.y));
    return cols;
}

function buildPhraseWithRuby(col, rubyChars) {
    const sorted = col.sort((a, b) => b.y - a.y);
    const plainArr = [];
    const rubyArr = [];

    if (sorted.length === 0) return { plain: '', withRuby: '' };

    const bounds = [];
    for (let i = 0; i < sorted.length; i++) {
        const c = sorted[i];
        const cMid = (c.y);
        const prevMid = i > 0 ? (sorted[i-1].y) : (c.y + 40.0);
        const nextMid = i < sorted.length - 1 ? (sorted[i+1].y) : (c.y - 40.0);
        
        const topBound = (prevMid + cMid) / 2.0;
        const btmBound = (cMid + nextMid) / 2.0;
        bounds.push({ top: topBound, btm: btmBound });
    }

    sorted.forEach((c, i) => {
        const cleanedStr = c.str.replace(/[\\s\\u3000]+/g, '');
        if (!cleanedStr) return;

        plainArr.push(cleanedStr);
        const b = bounds[i];

        const matched = rubyChars.filter(r => 
            4.0 <= (r.x - c.x) && (r.x - c.x) <= 22.0 &&
            (b.btm <= r.y && r.y < b.top)
        ).sort((a, b) => b.y - a.y);

        const rText = matched.map(r => r.str).join('').replace(/[\\s\\u3000]+/g, '').trim();
        const isKanji = /[\\u4E00-\\u9FFF\\u3005]/.test(cleanedStr);

        if (rText && isKanji) {
            rubyArr.push('｜' + cleanedStr + '《' + rText + '》');
        } else {
            rubyArr.push(cleanedStr);
        }
    });

    return {
        plain: plainArr.join('').trim(),
        withRuby: rubyArr.join('').trim()
    };
}

function matchKigoInfo(plainPhrase) {
    for (let i = 0; i < kigoLookup.length; i++) {
        const item = kigoLookup[i];
        if (plainPhrase.includes(item.kigo)) {
            return {
                kigo: item.kigo,
                parentKigo: item.parentKigo,
                kigoKana: item.kigoKana || '',
                season: item.season || '',
                detailSeason: item.detailSeason || '',
                isEdited: false,
                isLearned: !!item.isLearned,
                isOriginalInDb: !item.isLearned
            };
        }
    }
    return {
        kigo: '無季',
        parentKigo: '無季',
        kigoKana: 'むき',
        season: 'muki',
        detailSeason: '無季',
        isEdited: false,
        isLearned: false,
        isOriginalInDb: true
    };
}

async function processPdfFile() {
    if (!selectedFile) return;
    document.getElementById('loadingSpinner').style.display = 'flex';

    const year = document.getElementById('inputYear').value;
    const month = document.getElementById('inputMonth').value;
    const issueNumber = document.getElementById('inputIssue').value;

    const arrayBuffer = await selectedFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    extractedHaikus = [];
    const maxPage = Math.min(30, pdf.numPages);

    for (let pNum = 2; pNum <= maxPage; pNum++) {
        const page = await pdf.getPage(pNum);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1.0 });
        const pageHeight = viewport.height;

        const chars = textContent.items
            .filter(item => item.str.trim() !== '')
            .map(item => ({
                str: item.str,
                x: item.transform[4],
                y: item.transform[5],
                size: Math.hypot(item.transform[0], item.transform[1])
            }));

        const mainChars = chars.filter(c => c.size >= 9.5);
        const rubyChars = chars.filter(c => c.size < 9.0 && c.size >= 3.5);

        if (pNum >= 24 || mainChars.length < 15) {
            break;
        }

        const midY = pageHeight * 0.52;

        if (pNum >= 2 && pNum <= 5) {
            const cols = groupCharsIntoColumns(mainChars);
            cols.forEach((col, i) => {
                const res = buildPhraseWithRuby(col, rubyChars);
                if (pNum === 2 && i in [0, 1]) return;
                if (res.plain.length >= 9 && res.plain !== "春の虎落笛" && res.plain !== "箱蔵剣") {
                    addHaikuEntry(res, "箱蔵剣", "春の虎落笛", pNum, year, month, issueNumber);
                }
            });
        }
        else if (pNum >= 6 && pNum <= 8) {
            const map = { 6: ["久我正明", "城戸義文", ["春浅し"], ["雛祭り"]], 7: ["井上まり", "中矢えり子", ["花菜畑"], ["仲春"]], 8: ["山口葉都緒", "福島心結", ["花ミモザ"], ["落椿"]] };
            const [uAuth, lAuth, uTitles, lTitles] = map[pNum];

            const upperChars = mainChars.filter(c => c.y > midY);
            const lowerChars = mainChars.filter(c => c.y <= midY);

            groupCharsIntoColumns(upperChars).forEach(col => {
                const res = buildPhraseWithRuby(col, rubyChars);
                if (res.plain.length >= 9 && !isTitleOrAuthor(res.plain, uTitles, uAuth)) {
                    addHaikuEntry(res, uAuth, "無双集", pNum, year, month, issueNumber);
                }
            });
            groupCharsIntoColumns(lowerChars).forEach(col => {
                const res = buildPhraseWithRuby(col, rubyChars);
                if (res.plain.length >= 9 && !isTitleOrAuthor(res.plain, lTitles, lAuth)) {
                    addHaikuEntry(res, lAuth, "無双集", pNum, year, month, issueNumber);
                }
            });
        }
        else if (pNum === 9) {
            const haikuChars = mainChars.filter(c => c.y > midY && c.size >= 11.0);
            groupCharsIntoColumns(haikuChars).forEach((col, i) => {
                const res = buildPhraseWithRuby(col, rubyChars);
                if (i in [0, 1] && res.plain.length <= 5) return;
                if (res.plain.length >= 9 && res.plain !== "獺祭" && res.plain !== "源言鬼") {
                    addHaikuEntry(res, "源言鬼", "無双集", pNum, year, month, issueNumber);
                }
            });
        }
        else if (pNum === 10 || pNum === 16) {
            continue;
        }
        else if (pNum >= 11 && pNum <= 15) {
            if (pNum === 11) {
                groupCharsIntoColumns(mainChars).forEach((col, i) => {
                    const res = buildPhraseWithRuby(col, rubyChars);
                    if (i in [0, 1] && res.plain.length <= 6) return;
                    if (res.plain.length >= 9 && res.plain !== "篠笛" && res.plain !== "檜垣勇慈") {
                        addHaikuEntry(res, "檜垣勇慈", "紫竹集", pNum, year, month, issueNumber);
                    }
                });
            } else if (pNum in {12:1, 13:1, 14:1}) {
                const map = { 12: ["髙井辰美", "髙須賀潤緒", ["春の雪"], ["紫木蓮"]], 13: ["中井康子", "得居博秀", ["春一番"], ["菜の花"]], 14: ["松枝ふみ", "天満洋子", ["桃の花"], ["鹿尾菜刈る"]] };
                const [uAuth, lAuth, uTitles, lTitles] = map[pNum];
                const upperChars = mainChars.filter(c => c.y > midY);
                const lowerChars = mainChars.filter(c => c.y <= midY);

                groupCharsIntoColumns(upperChars).forEach(col => {
                    const res = buildPhraseWithRuby(col, rubyChars);
                    if (res.plain.length >= 9 && !isTitleOrAuthor(res.plain, uTitles, uAuth)) {
                        addHaikuEntry(res, uAuth, "紫竹集", pNum, year, month, issueNumber);
                    }
                });
                groupCharsIntoColumns(lowerChars).forEach(col => {
                    const res = buildPhraseWithRuby(col, rubyChars);
                    if (res.plain.length >= 9 && !isTitleOrAuthor(res.plain, lTitles, lAuth)) {
                        addHaikuEntry(res, lAuth, "紫竹集", pNum, year, month, issueNumber);
                    }
                });
            } else if (pNum === 15) {
                const upperChars = mainChars.filter(c => c.y > midY);
                groupCharsIntoColumns(upperChars).forEach(col => {
                    const res = buildPhraseWithRuby(col, rubyChars);
                    if (res.plain.length >= 9 && res.plain !== "花すみれ" && res.plain !== "大野つね子") {
                        addHaikuEntry(res, "大野つね子", "紫竹集", pNum, year, month, issueNumber);
                    }
                });
            }
        }
        else if (pNum >= 17 && pNum <= 23) {
            if (pNum === 17) {
                groupCharsIntoColumns(mainChars).forEach(col => {
                    const res = buildPhraseWithRuby(col, rubyChars);
                    if (res.plain.length >= 9 && res.plain !== "西濵恵美子" && res.plain !== "うてな集" && res.plain !== "広島県") {
                        addHaikuEntry(res, "西濵恵美子", "うてな集", pNum, year, month, issueNumber);
                    }
                });
            } else if (pNum in {18:1, 19:1, 20:1, 21:1}) {
                const map = { 18: ["西田上酢", "國米慧子"], 19: ["野村菫", "ミサキノバル"], 20: ["成本魚乃", "藤田菜々"], 21: ["辛嶋栖守", "佐藤南山"] };
                const [uAuth, lAuth] = map[pNum];
                const upperChars = mainChars.filter(c => c.y > midY);
                const lowerChars = mainChars.filter(c => c.y <= midY);

                groupCharsIntoColumns(upperChars).forEach(col => {
                    const res = buildPhraseWithRuby(col, rubyChars);
                    if (res.plain.length >= 9 && !isTitleOrAuthor(res.plain, ["パラオ", "大阪府", "松山市", "東京都"], uAuth)) {
                        addHaikuEntry(res, uAuth, "うてな集", pNum, year, month, issueNumber);
                    }
                });
                groupCharsIntoColumns(lowerChars).forEach(col => {
                    const res = buildPhraseWithRuby(col, rubyChars);
                    if (res.plain.length >= 9 && !isTitleOrAuthor(res.plain, ["松山市", "東京都"], lAuth)) {
                        addHaikuEntry(res, lAuth, "うてな集", pNum, year, month, issueNumber);
                    }
                });
            } else if (pNum === 22) {
                groupCharsIntoColumns(mainChars.filter(c => c.y > midY)).forEach(col => {
                    const res = buildPhraseWithRuby(col, rubyChars);
                    if (res.plain.length >= 9 && !isTitleOrAuthor(res.plain, ["松山市"], "野本末枝")) {
                        addHaikuEntry(res, "野本末枝", "うてな集", pNum, year, month, issueNumber);
                    }
                });
                groupCharsIntoColumns(mainChars.filter(c => c.y <= midY && c.x > 200)).forEach(col => {
                    const res = buildPhraseWithRuby(col, rubyChars);
                    if (res.plain.length >= 9 && !isTitleOrAuthor(res.plain, ["松山市"], "舛岡正弘")) {
                        addHaikuEntry(res, "舛岡正弘", "うてな集", pNum, year, month, issueNumber);
                    }
                });
                groupCharsIntoColumns(mainChars.filter(c => c.y <= midY && c.x <= 200)).forEach(col => {
                    const res = buildPhraseWithRuby(col, rubyChars);
                    if (res.plain.length >= 9 && !isTitleOrAuthor(res.plain, ["東京都"], "青山鹿乃子")) {
                        addHaikuEntry(res, "青山鹿乃子", "うてな集", pNum, year, month, issueNumber);
                    }
                });
            } else if (pNum === 23) {
                groupCharsIntoColumns(mainChars.filter(c => c.y > midY && c.x > 200)).forEach(col => {
                    const res = buildPhraseWithRuby(col, rubyChars);
                    if (res.plain.length >= 9 && !isTitleOrAuthor(res.plain, ["神奈川県"], "萼草子")) {
                        addHaikuEntry(res, "萼草子", "うてな集", pNum, year, month, issueNumber);
                    }
                });
                groupCharsIntoColumns(mainChars.filter(c => c.y > midY && c.x <= 200)).forEach(col => {
                    const res = buildPhraseWithRuby(col, rubyChars);
                    if (res.plain.length >= 9 && !isTitleOrAuthor(res.plain, ["東京都"], "今村藤生")) {
                        addHaikuEntry(res, "今村藤生", "うてな集", pNum, year, month, issueNumber);
                    }
                });
                groupCharsIntoColumns(mainChars.filter(c => c.y <= midY && c.x > 200)).forEach(col => {
                    const res = buildPhraseWithRuby(col, rubyChars);
                    if (res.plain.length >= 9 && !isTitleOrAuthor(res.plain, ["松山市"], "戎井風蓮")) {
                        addHaikuEntry(res, "戎井風蓮", "うてな集", pNum, year, month, issueNumber);
                    }
                });
                groupCharsIntoColumns(mainChars.filter(c => c.y <= midY && c.x <= 200)).forEach(col => {
                    const res = buildPhraseWithRuby(col, rubyChars);
                    if (res.plain.length >= 9 && !isTitleOrAuthor(res.plain, ["広島県"], "浜田幸子")) {
                        addHaikuEntry(res, "浜田幸子", "うてな集", pNum, year, month, issueNumber);
                    }
                });
            }
        }
    }

    document.getElementById('loadingSpinner').style.display = 'none';
    renderResultsTable();
}

function addHaikuEntry(res, author, section, page, year, month, issueNumber) {
    const kigoInfo = matchKigoInfo(res.plain);
    extractedHaikus.push({
        phrasePlain: res.plain,
        phraseWithRuby: res.withRuby,
        author: author,
        authorKana: authorLookup[author] || '',
        ...kigoInfo,
        manualKigo: '',
        section: section,
        page: page,
        year: year,
        month: month,
        issueNumber: issueNumber
    });
}

function toggleRubyDisplay() {
    renderResultsTable();
}

function renderResultsTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    const includeRuby = document.getElementById('checkIncludeRuby').checked;

    extractedHaikus.forEach((h, idx) => {
        const tr = document.createElement('tr');
        tr.dataset.idx = idx;
        const phrase = includeRuby ? h.phraseWithRuby : h.phrasePlain;
        
        let kigoClass = 'kigo-tag';
        if (h.kigo === '無季') kigoClass = 'muki-tag';
        else if (h.isLearned) kigoClass = 'learned-tag';
        else if (h.isEdited) kigoClass = 'edited-tag';

        const showAddBtn = h.kigo !== '無季' && h.parentKigo !== '無季' && !h.isOriginalInDb;
        const addBtnHtml = showAddBtn ? 
            \`<button class="btn btn-gas btn-sm" style="margin-left: 4px; padding: 1px 5px; font-size: 0.72rem;" onclick="addKigoToDatabaseDirectly(\${idx})" title="スプレッドシートに直接登録">🌸 登録</button>\` : '';

        tr.innerHTML = \`
            <td style="color: #999; text-align: center;">\${idx + 1}</td>
            <td class="phrase-cell" contenteditable="true" onblur="updateRowData(\${idx}, 'phrasePlain', this.innerText)">\${phrase}</td>
            <td contenteditable="true" onblur="updateRowData(\${idx}, 'author', this.innerText)">\${h.author}</td>
            <td contenteditable="true" onblur="updateRowData(\${idx}, 'authorKana', this.innerText)">\${h.authorKana}</td>
            <td>
                <div class="kigo-cell-content">
                    <span class="\${kigoClass}" contenteditable="true" onblur="updateKigoDirectly(\${idx}, this.innerText)" title="クリックして手入力・修正">\${h.kigo}</span>
                    \${addBtnHtml}
                </div>
            </td>
            <td contenteditable="true" onblur="updateParentKigoDirectly(\${idx}, this.innerText)" title="親季語を変更すると全列自動連動">\${h.parentKigo}</td>
            <td contenteditable="true" onblur="updateRowData(\${idx}, 'kigoKana', this.innerText)">\${h.kigoKana}</td>
            <td style="text-align: center;" contenteditable="true" onblur="updateRowData(\${idx}, 'season', this.innerText)">\${h.season}</td>
            <td style="text-align: center;" contenteditable="true" onblur="updateRowData(\${idx}, 'detailSeason', this.innerText)">\${h.detailSeason}</td>
            <td style="text-align: center;" contenteditable="true" onblur="updateRowData(\${idx}, 'year', this.innerText)">\${h.year}</td>
            <td style="text-align: center;" contenteditable="true" onblur="updateRowData(\${idx}, 'month', this.innerText)">\${h.month}</td>
            <td style="text-align: center;" contenteditable="true" onblur="updateRowData(\${idx}, 'issueNumber', this.innerText)">\${h.issueNumber}</td>
        \`;
        tbody.appendChild(tr);
    });

    document.getElementById('countBadge').innerText = '全 ' + extractedHaikus.length + ' 句 解析完了';
    document.getElementById('fileNameLabel').innerText = selectedFile ? selectedFile.name : '';
    document.getElementById('resultCard').style.display = 'block';
}

function updateRowData(idx, field, value) {
    if (extractedHaikus[idx]) {
        extractedHaikus[idx][field] = value.trim();
    }
}

// 🌟 1箇所の修正・登録を、同じPDF内の「他の句」にも自動で一括波及させる！
function cascadeKigoToOtherRows(learnedWord) {
    if (!learnedWord || learnedWord === '無季') return;
    let autoUpdatedCount = 0;

    extractedHaikus.forEach(h => {
        // 未編集かつその言葉を含む句を自動更新
        if (!h.isEdited && h.phrasePlain.includes(learnedWord)) {
            const newInfo = matchKigoInfo(h.phrasePlain);
            Object.assign(h, newInfo);
            autoUpdatedCount++;
        }
    });

    if (autoUpdatedCount > 1) {
        showToast('✨ 同じ言葉を含む他の ' + (autoUpdatedCount - 1) + ' 句も一括で自動判定しました！');
    }
}

function updateKigoDirectly(idx, newKigoText) {
    const raw = newKigoText.trim();
    if (!extractedHaikus[idx]) return;
    extractedHaikus[idx].kigo = raw;
    extractedHaikus[idx].isEdited = true;
    
    if (raw === '無季' || raw === '') {
        extractedHaikus[idx].kigo = '無季';
        extractedHaikus[idx].parentKigo = '無季';
        extractedHaikus[idx].kigoKana = 'むき';
        extractedHaikus[idx].season = 'muki';
        extractedHaikus[idx].detailSeason = '無季';
        extractedHaikus[idx].isOriginalInDb = true;
    } else {
        const matched = kigoLookup.find(k => k.kigo === raw) || kigoLookup.find(k => k.parentKigo === raw);
        if (matched) {
            extractedHaikus[idx].parentKigo = matched.parentKigo;
            extractedHaikus[idx].kigoKana = matched.kigoKana;
            extractedHaikus[idx].season = matched.season;
            extractedHaikus[idx].detailSeason = matched.detailSeason;
            extractedHaikus[idx].isOriginalInDb = !matched.isLearned;
            if (matched.isLearned) {
                saveLearnedKigo(raw, matched);
                cascadeKigoToOtherRows(raw);
            }
        } else {
            extractedHaikus[idx].isOriginalInDb = false;
        }
    }
    renderResultsTable();
}

function updateParentKigoDirectly(idx, newParentText) {
    const raw = newParentText.trim();
    if (!extractedHaikus[idx]) return;
    extractedHaikus[idx].parentKigo = raw;
    extractedHaikus[idx].isEdited = true;

    if (raw === '無季' || raw === '') {
        extractedHaikus[idx].parentKigo = '無季';
        extractedHaikus[idx].kigoKana = 'むき';
        extractedHaikus[idx].season = 'muki';
        extractedHaikus[idx].detailSeason = '無季';
        extractedHaikus[idx].isOriginalInDb = true;
    } else {
        const matched = kigoLookup.find(k => k.parentKigo === raw) || kigoLookup.find(k => k.kigo === raw);
        if (matched) {
            extractedHaikus[idx].parentKigo = matched.parentKigo;
            extractedHaikus[idx].kigoKana = matched.kigoKana;
            extractedHaikus[idx].season = matched.season;
            extractedHaikus[idx].detailSeason = matched.detailSeason;
            
            const isKigoInDb = kigoLookup.some(k => k.kigo === extractedHaikus[idx].kigo && !k.isLearned);
            extractedHaikus[idx].isOriginalInDb = isKigoInDb;

            saveLearnedKigo(extractedHaikus[idx].kigo, matched);
            cascadeKigoToOtherRows(extractedHaikus[idx].kigo);
        } else {
            extractedHaikus[idx].isOriginalInDb = false;
        }
    }
    renderResultsTable();
}

function saveLearnedKigo(kigo, matchedInfo) {
    if (!kigo || kigo === '無季' || !matchedInfo.parentKigo || matchedInfo.parentKigo === '無季') return;
    learnedKigoMap[kigo] = {
        parentKigo: matchedInfo.parentKigo,
        kigoKana: matchedInfo.kigoKana || '',
        season: matchedInfo.season || '',
        detailSeason: matchedInfo.detailSeason || ''
    };
    localStorage.setItem('utena_learned_kigos', JSON.stringify(learnedKigoMap));

    // 辞書リストの先頭にも追加して即座に判定可能にする
    if (!kigoLookup.some(k => k.kigo === kigo)) {
        kigoLookup.unshift({
            kigo: kigo,
            parentKigo: matchedInfo.parentKigo,
            kigoKana: matchedInfo.kigoKana || '',
            season: matchedInfo.season || '',
            detailSeason: matchedInfo.detailSeason || '',
            len: kigo.length,
            matchScore: 999,
            isLearned: true
        });
    }
}

async function addKigoToDatabaseDirectly(idx) {
    const h = extractedHaikus[idx];
    if (!h) return;

    if (!gasApiUrl) {
        openSettingsModal();
        alert('初回設定：スプレッドシートの「GAS ウェブアプリ URL」を設定してください。');
        return;
    }

    const confirmMsg = '大元の「歳時記データベース」スプレッドシートに登録しますか？\\n\\n・個別季語: ' + h.kigo + '\\n・親季語: 【' + h.parentKigo + '】\\n・季節: ' + h.season + ' (' + h.detailSeason + ')\\n・読み: ' + h.kigoKana;
    if (!confirm(confirmMsg)) return;

    showToast('⏳ スプレッドシートに送信中...');

    try {
        await fetch(gasApiUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: JSON.stringify({
                kigo: h.kigo,
                parentKigo: h.parentKigo,
                season: h.season,
                detailSeason: h.detailSeason,
                kigoKana: h.kigoKana
            })
        });

        showToast('✔ スプレッドシート【' + h.parentKigo + '】に登録完了しました！');
        saveLearnedKigo(h.kigo, h);
        h.isLearned = true;
        h.isOriginalInDb = true;

        // 🌟 同じPDF内にある他の同じ季語の句も一括で自動連動！
        cascadeKigoToOtherRows(h.kigo);
        renderResultsTable();

    } catch (err) {
        alert('⚠️ 通信エラー: GASのURLが正しいか確認してください。\\n' + err.message);
    }
}

async function syncWithOnlineSpreadsheet() {
    showToast('⏳ スプレッドシートから最新の歳時記を取得中...');
    try {
        const saijikiUrl = "https://docs.google.com/spreadsheets/d/1EOmZn53hFA8GpVdcn--aU-lj9uHjGQpnSZ1o9jbnsYs/gviz/tq?sheet=" + encodeURIComponent("歳時記データベース") + "&tqx=out:json";
        const res = await fetch(saijikiUrl);
        const text = await res.text();
        const jsonStr = text.replace(/^[^{]*/, "").replace(/[^}]*$/, "");
        const data = JSON.parse(jsonStr);
        const rows = data.table.rows;

        const getCellValue = (cells, idx) => {
            if (!cells || !cells[idx]) return "";
            let val = cells[idx].v !== undefined && cells[idx].v !== null ? cells[idx].v : cells[idx].f;
            return val !== undefined && val !== null ? String(val).trim() : "";
        };

        const map = new Map();
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i].c;
            if (!row) continue;
            let season = getCellValue(row, 0);
            let detailSeason = getCellValue(row, 1);
            let parentKigo = getCellValue(row, 2).replace(/[\\s\\u3000]+/g, "");
            let kigoKana = getCellValue(row, 3);
            let individualKigo = getCellValue(row, 4).replace(/[\\s\\u3000]+/g, "");

            if (!parentKigo || parentKigo === "親季語" || parentKigo === "無季") continue;

            if (!map.has(parentKigo)) {
                map.set(parentKigo, { kigo: parentKigo, parentKigo, kigoKana, season, detailSeason, len: parentKigo.length });
            }
            if (individualKigo && individualKigo !== "無季" && !map.has(individualKigo)) {
                map.set(individualKigo, { kigo: individualKigo, parentKigo, kigoKana, season, detailSeason, len: individualKigo.length });
            }
        }

        kigoLookup = Array.from(map.values()).sort((a, b) => b.len - a.len);
        showToast('✔ 最新の歳時記辞書（' + kigoLookup.length + '語）と同期完了！');

        if (extractedHaikus.length > 0) {
            extractedHaikus.forEach(h => {
                if (!h.isEdited) {
                    const info = matchKigoInfo(h.phrasePlain);
                    Object.assign(h, info);
                }
            });
            renderResultsTable();
        }
    } catch (e) {
        alert('⚠️ 同期エラー: ' + e.message);
    }
}

function filterTable() {
    const q = document.getElementById('filterInput').value.trim().toLowerCase();
    const rows = document.querySelectorAll('#tableBody tr');
    rows.forEach(tr => {
        const text = tr.innerText.toLowerCase();
        tr.style.display = text.includes(q) ? '' : 'none';
    });
}

function copyForHaikuShusei(includeYearMonth = false) {
    const includeRuby = document.getElementById('checkIncludeRuby').checked;
    let tsv = "";
    extractedHaikus.forEach(h => {
        const phrase = includeRuby ? h.phraseWithRuby : h.phrasePlain;
        if (includeYearMonth) {
            tsv += phrase + "\\t" + h.author + "\\t" + h.authorKana + "\\t" + h.kigo + "\\t" + h.parentKigo + "\\t" + h.kigoKana + "\\t" + h.season + "\\t" + h.detailSeason + "\\t\\t" + h.year + "\\t" + h.month + "\\t" + h.issueNumber + "\\n";
        } else {
            tsv += phrase + "\\t" + h.author + "\\t" + h.authorKana + "\\t" + h.kigo + "\\t" + h.parentKigo + "\\t" + h.kigoKana + "\\t" + h.season + "\\t" + h.detailSeason + "\\n";
        }
    });
    navigator.clipboard.writeText(tsv).then(() => {
        const msg = includeYearMonth ? '✔ 全12列（A〜L列）をコピーしました！' : '✔ A〜H列（俳句〜詳細季節）のみをコピーしました！';
        showToast(msg);
    });
}

function clearAllData() {
    selectedFile = null;
    extractedHaikus = [];
    document.getElementById('fileInput').value = '';
    document.getElementById('dropMainText').innerText = 'ここに 会誌PDF または CSV / TSV ファイルをドラッグ＆ドロップ';
    document.getElementById('resultCard').style.display = 'none';
    document.getElementById('tableBody').innerHTML = '';
    showToast('✔ データをクリアしました。次のファイルをドロップしてください。');
}

function downloadCsv() {
    const includeRuby = document.getElementById('checkIncludeRuby').checked;
    let csv = "俳句,作者,作者よみがな,季語,親季語,季語よみがな,季節,詳細季節,手入力した季語,発行年,発行月,号数\\n";
    extractedHaikus.forEach(h => {
        const phrase = includeRuby ? h.phraseWithRuby : h.phrasePlain;
        csv += '"' + phrase + '","' + h.author + '","' + h.authorKana + '","' + h.kigo + '","' + h.parentKigo + '","' + h.kigoKana + '","' + h.season + '","' + h.detailSeason + '","","' + h.year + '","' + h.month + '","' + h.issueNumber + '"\\n';
    });
    const blob = new Blob(["\\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'haiku_' + (document.getElementById('inputYear').value || 'data') + '.csv';
    a.click();
}

function downloadJson() {
    const includeRuby = document.getElementById('checkIncludeRuby').checked;
    const exportData = extractedHaikus.map(h => ({
        phrase: includeRuby ? h.phraseWithRuby : h.phrasePlain,
        author: h.author,
        authorKana: h.authorKana,
        kigo: h.kigo,
        parentKigo: h.parentKigo,
        kigoKana: h.kigoKana,
        season: h.season,
        detailSeason: h.detailSeason,
        issueYear: h.year,
        issueMonth: h.month,
        issueNumber: h.issueNumber
    }));
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'haiku_' + (document.getElementById('inputYear').value || 'data') + '.json';
    a.click();
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    if (msg) toast.innerText = msg;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 4000);
}

function openSettingsModal() {
    document.getElementById('gasApiUrlInput').value = gasApiUrl;
    document.getElementById('settingsModal').style.display = 'flex';
}
function closeSettingsModal() {
    document.getElementById('settingsModal').style.display = 'none';
}
function saveSettings() {
    gasApiUrl = document.getElementById('gasApiUrlInput').value.trim();
    localStorage.setItem('utena_gas_api_url', gasApiUrl);
    closeSettingsModal();
    showToast('✔ GAS連携URLを保存しました！');
}
</script>
</body>
</html>`;

const finalHtml = htmlTemplate
  .replace("__KIGO_LOOKUP_JSON__", JSON.stringify(kigoLookup))
  .replace("__AUTHOR_LOOKUP_JSON__", JSON.stringify(authorLookup));

fs.writeFileSync("extractor.html", finalHtml, "utf8");
console.log("Successfully added auto-cascade update to extractor.html! File size:", fs.statSync("extractor.html").size, "bytes");
