/**
 * ========================================================
 * ⚙️ settings.js - ユーザー環境設定管理モジュール
 * ========================================================
 */

// 🌸 ユーザー環境設定
const appSettings = {
    fontSize: localStorage.getItem("utena_setting_fontsize") || "standard", // "standard" | "large"
    fontFamily: localStorage.getItem("utena_setting_fontfamily") || "mincho", // "mincho" | "gothic"
    catVisible: localStorage.getItem("utena_setting_cat") !== "false", // true | false (default true)
    autoOmikuji: localStorage.getItem("utena_setting_auto_omikuji") === "true" // true | false (default false)
};

/**
 * 全設定をUIおよびbodyクラスへ一括適用
 */
function applyAllSettings() {
    // 1. フォント切り替え
    document.body.classList.toggle("font-gothic", appSettings.fontFamily === "gothic");
    const fontMinchoBtn = document.getElementById("setFontFamilyMinchoBtn");
    const fontGothicBtn = document.getElementById("setFontFamilyGothicBtn");
    if (fontMinchoBtn && fontGothicBtn) {
        fontMinchoBtn.classList.toggle("active", appSettings.fontFamily !== "gothic");
        fontGothicBtn.classList.toggle("active", appSettings.fontFamily === "gothic");
    }

    // 2. 文字サイズ切り替え
    document.body.classList.toggle("font-large", appSettings.fontSize === "large");
    const sizeStdBtn = document.getElementById("setFontSizeStandardBtn");
    const sizeLargeBtn = document.getElementById("setFontSizeLargeBtn");
    if (sizeStdBtn && sizeLargeBtn) {
        sizeStdBtn.classList.toggle("active", appSettings.fontSize !== "large");
        sizeLargeBtn.classList.toggle("active", appSettings.fontSize === "large");
    }

    // 3. おみ句じ猫 ON/OFF
    const catOnBtn = document.getElementById("setCatOnBtn");
    const catOffBtn = document.getElementById("setCatOffBtn");
    if (catOnBtn && catOffBtn) {
        catOnBtn.classList.toggle("active", appSettings.catVisible);
        catOffBtn.classList.toggle("active", !appSettings.catVisible);
    }
    const catBtn = document.getElementById("fixedCatBtn");
    if (catBtn) {
        if (!appSettings.catVisible) {
            catBtn.classList.add("hidden");
        } else if (navState.category === "saijiki" || navState.category === "kushu" || (navState.category === "utena_archive" && !isRoomOpen)) {
            catBtn.classList.remove("hidden");
        }
    }

    // 4. 起動時おみ句じ ON/OFF
    const autoOnBtn = document.getElementById("setAutoOmikujiOnBtn");
    const autoOffBtn = document.getElementById("setAutoOmikujiOffBtn");
    if (autoOnBtn && autoOffBtn) {
        autoOnBtn.classList.toggle("active", appSettings.autoOmikuji);
        autoOffBtn.classList.toggle("active", !appSettings.autoOmikuji);
    }

    // 鑑賞画面が開いていれば再描画
    if (typeof isRoomOpen !== "undefined" && isRoomOpen && typeof updateHaikuDisplay === "function") {
        updateHaikuDisplay();
    }
}

function setAppFontSize(size) {
    appSettings.fontSize = size;
    localStorage.setItem("utena_setting_fontsize", size);
    applyAllSettings();
}

function setAppFontFamily(family) {
    appSettings.fontFamily = family;
    localStorage.setItem("utena_setting_fontfamily", family);
    applyAllSettings();
}

function setAppCatVisible(visible) {
    appSettings.catVisible = visible;
    localStorage.setItem("utena_setting_cat", visible ? "true" : "false");
    applyAllSettings();
}

function setAppAutoOmikuji(auto) {
    appSettings.autoOmikuji = auto;
    localStorage.setItem("utena_setting_auto_omikuji", auto ? "true" : "false");
    applyAllSettings();
}

function openSettingsModal() {
    applyAllSettings();
    const modal = document.getElementById("settingsModal");
    if (modal) modal.classList.remove("hidden");
}

function closeSettingsModal(event) {
    if (event) event.stopPropagation();
    const modal = document.getElementById("settingsModal");
    if (modal) modal.classList.add("hidden");
}
