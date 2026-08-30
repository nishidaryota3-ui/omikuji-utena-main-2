/**
 * ========================================================
 * 🛠️ utils.js - 共通ユーティリティ関数群
 * ========================================================
 */

/**
 * HTML特殊文字のエスケープ
 */
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * 算用数字文字列を漢数字に変換（例: "82" ➡ "八二", "5" ➡ "五"）
 */
function toKanjiNum(numStr) {
    const kanjiDigits = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
    const n = parseInt(numStr, 10);
    if (isNaN(n)) return numStr;
    if (n <= 10) return ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][n];
    if (n < 20) return "十" + kanjiDigits[n % 10];
    return String(numStr).split("").map(d => kanjiDigits[parseInt(d, 10)] || d).join("");
}

/**
 * 西暦年を和暦表記に変換（例: 2026 ➡ "令和八年"）
 */
function toJapaneseEra(year) {
    const y = parseInt(year, 10);
    if (isNaN(y)) return year;
    if (y >= 2019) {
        const reiwaYear = y - 2018;
        const kanjiYear = (reiwaYear === 1) ? "元" : toKanjiNum(String(reiwaYear));
        return `令和${kanjiYear}年`;
    }
    return `${toKanjiNum(String(y))}年`;
}

/**
 * 月の数値を和風月名に変換（例: "8" ➡ "八月"）
 */
function toKanjiMonth(month) {
    const m = parseInt(month, 10);
    if (isNaN(m)) return month;
    return `${toKanjiNum(String(m))}月`;
}

/**
 * 「漢字《よみ》」「漢字(よみ)」「漢字[よみ]」形式のテキストを <ruby> タグに整形
 */
function formatRubyText(text) {
    if (!text) return '';
    
    // 《よみがな》青空文庫形式（例: ｜逃散《ちようさん》 または 猿《ましら》）
    let formatted = text.replace(/｜(.+?)《(.+?)》/g, '<span class="ruby-wrap"><ruby>$1<rt>$2</rt></ruby></span>')
                        .replace(/([\u4E00-\u9FFF々〆ヵヶ]+)《(.+?)》/g, '<span class="ruby-wrap"><ruby>$1<rt>$2</rt></ruby></span>');

    // [よみがな] 形式
    formatted = formatted.replace(/([一-龠々〆ヵヶ]+)\[(.*?)\]/g, '<span class="ruby-wrap"><ruby>$1<rt>$2</rt></ruby></span>');
    // (よみがな) 形式
    formatted = formatted.replace(/([一-龠々〆ヵヶ]+)[（(]([ぁ-んァ-ヶー]+)[）)]/g, '<span class="ruby-wrap"><ruby>$1<rt>$2</rt></ruby></span>');
    
    return formatted;
}

/**
 * かな文字の先頭から五十音の行代表文字（あ/か/さ/た/な/は/ま/や/ら/わ）を判定
 */
function getGojuonRowChar(kana) {
    if (!kana) return "あ";
    const c = kana.charAt(0);
    if ("あいうえおぁぃぅぇぉ".includes(c)) return "あ";
    if ("かきくけこがぎぐげご".includes(c)) return "か";
    if ("さしすせそざじずぜぞ".includes(c)) return "さ";
    if ("たちつてとだぢづでどっ".includes(c)) return "た";
    if ("なにぬねの".includes(c)) return "な";
    if ("はひふへほばびぶべぼぱぴぷぺぽ".includes(c)) return "は";
    if ("まみむめも".includes(c)) return "ま";
    if ("やゆよゃゅょ".includes(c)) return "や";
    if ("らりるれろ".includes(c)) return "ら";
    if ("わをん".includes(c)) return "わ";
    return "あ";
}

/**
 * 配列の要素をランダムにシャッフル（Fisher-Yates法）
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
