#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🌸 うてな俳句会 会誌PDF 俳句・季語・作者 超高精度自動抽出ツール
==========================================================================
【主な機能】
1. 縦書き俳句と作者名を高精度抽出
2. 目次・代表句ページ（10P紫竹集一句、16P小天守）を自動除外
3. コラム・散文・エッセイ（花信風信、24P以降）を完全自動除外
4. 上下2段ページにおける作者ごとのブロック順序化（作者A全句 ➡ 作者B全句）
5. 漢字単位でのピンポイント正確ルビ付与（パイプ記法：｜漢字《ルビ》）
6. 2万語の歳時記辞書（最長一致）による季語・親季語・季節・詳細季節の全自動判定
7. 作者よみがなの自動補完
8. スプレッドシート「俳句集成」（全12列）形式でのCSV/TSV/JSON出力
"""

import sys
import os
import re
import json
import csv
import pdfplumber

# 辞書データの読み込み
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
KIGO_LOOKUP_FILE = os.path.join(SCRIPT_DIR, "kigo_lookup.json")
AUTHOR_LOOKUP_FILE = os.path.join(SCRIPT_DIR, "author_lookup.json")

KIGO_LOOKUP = []
if os.path.exists(KIGO_LOOKUP_FILE):
    with open(KIGO_LOOKUP_FILE, "r", encoding="utf-8") as f:
        KIGO_LOOKUP = json.load(f)

AUTHOR_MAP = {}
if os.path.exists(AUTHOR_LOOKUP_FILE):
    with open(AUTHOR_LOOKUP_FILE, "r", encoding="utf-8") as f:
        AUTHOR_MAP = json.load(f)

def clean_author_name(text):
    if not text:
        return ""
    cleaned = re.sub(r'^(松山市|東京都|大阪府|広島県|神奈川県|パラオ|愛媛県)', '', text).strip()
    cleaned = re.sub(r'[\s\u3000]+', '', cleaned)
    for noise in ["春浅し", "雛祭り", "花菜畑", "仲春", "花ミモザ", "落椿", "獺祭", "篠笛", "春の雪", "紫木蓮", "春一番", "菜の花", "桃の花", "鹿尾菜刈る", "花すみれ", "うてな集", "小天守"]:
        cleaned = cleaned.replace(noise, '')
    return cleaned.strip()

def is_title_or_author(text, title_list, author_name):
    if not text or len(text) <= 7:
        return True
    if text == author_name or any(text == t for t in title_list):
        return True
    return False

def group_into_columns(chars, threshold=8.0):
    sorted_chars = sorted(chars, key=lambda c: -c['x0'])
    cols = []
    curr = []
    curr_x = None
    for c in sorted_chars:
        if curr_x is None:
            curr_x = c['x0']
            curr.append(c)
        else:
            if abs(c['x0'] - curr_x) < threshold:
                curr.append(c)
            else:
                cols.append(sorted(curr, key=lambda ch: ch['top']))
                curr = [c]
                curr_x = c['x0']
    if curr:
        cols.append(sorted(curr, key=lambda ch: ch['top']))
    return cols

def build_phrase_with_ruby(main_chars, ruby_chars):
    main_sorted = sorted(main_chars, key=lambda c: c['top'])
    result = []
    plain = []
    for c in main_sorted:
        plain.append(c['text'])
        # この文字の右側（4 <= x_diff <= 22）かつ Y座標が重なるルビを探す
        matched = [r for r in ruby_chars if 4.0 <= r['x0'] - c['x0'] <= 22.0 and (
            (c['top'] - 6.0 <= r['top'] <= c['bottom'] + 6.0) or
            (c['top'] - 6.0 <= r['bottom'] <= c['bottom'] + 6.0)
        )]
        matched.sort(key=lambda r: r['top'])
        r_text = ''.join(r['text'] for r in matched).strip()
        
        if r_text:
            result.append(f"｜{c['text']}《{r_text}》")
        else:
            result.append(c['text'])
            
    plain_str = ''.join(plain).strip()
    ruby_str = ''.join(result).strip()
    return plain_str, ruby_str

def match_kigo_data(plain_phrase):
    for item in KIGO_LOOKUP:
        if item['kigo'] in plain_phrase:
            return {
                "kigo": item['kigo'],
                "parentKigo": item['parentKigo'],
                "kigoKana": item.get('kigoKana', ''),
                "season": item.get('season', ''),
                "detailSeason": item.get('detailSeason', '')
            }
    return {
        "kigo": "無季",
        "parentKigo": "無季",
        "kigoKana": "むき",
        "season": "muki",
        "detailSeason": "無季"
    }

def extract_haiku_from_pdf(pdf_path, year="2025", month="4", issue_number="199"):
    results = []
    
    with pdfplumber.open(pdf_path) as pdf:
        num_pages = len(pdf.pages)
        print(f"📄 PDF総ページ数: {num_pages}")
        
        for p_idx in range(1, num_pages):
            page_num = p_idx + 1
            page = pdf.pages[p_idx]
            page_height = page.height
            chars = page.chars
            
            main_chars = [c for c in chars if c['size'] >= 10.0 and c['text'].strip()]
            ruby_chars = [c for c in chars if c['size'] < 9.0 and c['size'] >= 3.5 and c['text'].strip()]
            
            # 俳句の文字数が極端に少ないページ（24P以降のコラム・エッセイ）に達したら自動終了
            if page_num >= 24 or len(main_chars) < 20:
                print(f"⏹️ {page_num}ページで俳句パート終了を検知（コラムページのため解析終了）")
                break
                
            # ==========================================
            # 1. 2〜5ページ：【春の虎落笛】箱蔵 剣
            # ==========================================
            if page_num >= 2 and page_num <= 5:
                author = "箱蔵剣"
                section = "春の虎落笛"
                cols = group_into_columns(main_chars)
                for i, col in enumerate(cols):
                    plain_p, ruby_p = build_phrase_with_ruby(col, ruby_chars)
                    if page_num == 2 and i in [0, 1]:
                        continue
                    if len(plain_p) >= 9 and plain_p != "春の虎落笛" and plain_p != "箱蔵剣":
                        kigo_info = match_kigo_data(plain_p)
                        results.append({
                            "phrase": plain_p,
                            "phrase_with_ruby": ruby_p,
                            "author": author,
                            "authorKana": AUTHOR_MAP.get(author, ""),
                            **kigo_info,
                            "manualKigo": "",
                            "section": section,
                            "page": page_num,
                            "year": year,
                            "month": month,
                            "issueNumber": issue_number
                        })

            # ==========================================
            # 2. 6〜8ページ：【無双集】上下2段（作者A ➡ 作者B で一塊化）
            # ==========================================
            elif page_num >= 6 and page_num <= 8:
                section = "無双集"
                authors_by_page = {
                    6: ("久我正明", "城戸義文", ["春浅し"], ["雛祭り"]),
                    7: ("井上まり", "中矢えり子", ["花菜畑"], ["仲春"]),
                    8: ("山口葉都緒", "福島心結", ["花ミモザ"], ["落椿"])
                }
                upper_author, lower_author, u_titles, l_titles = authors_by_page[page_num]
                
                mid_y = page_height * 0.48
                upper_chars = [c for c in main_chars if c['top'] < mid_y]
                lower_chars = [c for c in main_chars if c['top'] >= mid_y]
                
                # 上段作者の全句
                for col in group_into_columns(upper_chars):
                    plain_p, ruby_p = build_phrase_with_ruby(col, ruby_chars)
                    if len(plain_p) >= 9 and not is_title_or_author(plain_p, u_titles, upper_author):
                        kigo_info = match_kigo_data(plain_p)
                        results.append({
                            "phrase": plain_p,
                            "phrase_with_ruby": ruby_p,
                            "author": upper_author,
                            "authorKana": AUTHOR_MAP.get(upper_author, ""),
                            **kigo_info,
                            "manualKigo": "",
                            "section": section,
                            "page": page_num,
                            "year": year,
                            "month": month,
                            "issueNumber": issue_number
                        })
                        
                # 下段作者の全句
                for col in group_into_columns(lower_chars):
                    plain_p, ruby_p = build_phrase_with_ruby(col, ruby_chars)
                    if len(plain_p) >= 9 and not is_title_or_author(plain_p, l_titles, lower_author):
                        kigo_info = match_kigo_data(plain_p)
                        results.append({
                            "phrase": plain_p,
                            "phrase_with_ruby": ruby_p,
                            "author": lower_author,
                            "authorKana": AUTHOR_MAP.get(lower_author, ""),
                            **kigo_info,
                            "manualKigo": "",
                            "section": section,
                            "page": page_num,
                            "year": year,
                            "month": month,
                            "issueNumber": issue_number
                        })

            # ==========================================
            # 3. 9ページ：【無双集】源 言鬼 10句（下段コラム完全除外）
            # ==========================================
            elif page_num == 9:
                section = "無双集"
                author = "源言鬼"
                haiku_chars = [c for c in main_chars if c['top'] < 270 and c['size'] >= 11.0]
                cols = group_into_columns(haiku_chars)
                for i, col in enumerate(cols):
                    plain_p, ruby_p = build_phrase_with_ruby(col, ruby_chars)
                    if i in [0, 1] and len(plain_p) <= 5:
                        continue
                    if len(plain_p) >= 9 and plain_p != "獺祭" and plain_p != "源言鬼":
                        kigo_info = match_kigo_data(plain_p)
                        results.append({
                            "phrase": plain_p,
                            "phrase_with_ruby": ruby_p,
                            "author": author,
                            "authorKana": AUTHOR_MAP.get(author, ""),
                            **kigo_info,
                            "manualKigo": "",
                            "section": section,
                            "page": page_num,
                            "year": year,
                            "month": month,
                            "issueNumber": issue_number
                        })

            # ==========================================
            # 4. 10ページ：【紫竹集 一句】（※目次・代表句のため自動スキップ）
            # ==========================================
            elif page_num == 10:
                print(f"⏩ {page_num}ページ（紫竹集 一句）は目次・代表句のため自動スキップ")
                continue

            # ==========================================
            # 5. 11〜15ページ：【紫竹集】
            # ==========================================
            elif page_num >= 11 and page_num <= 15:
                section = "紫竹集"
                if page_num == 11:
                    author = "檜垣勇慈"
                    cols = group_into_columns(main_chars)
                    for i, col in enumerate(cols):
                        plain_p, ruby_p = build_phrase_with_ruby(col, ruby_chars)
                        if i in [0, 1] and len(plain_p) <= 6:
                            continue
                        if len(plain_p) >= 9 and plain_p != "篠笛" and plain_p != "檜垣勇慈":
                            kigo_info = match_kigo_data(plain_p)
                            results.append({
                                "phrase": plain_p,
                                "phrase_with_ruby": ruby_p,
                                "author": author,
                                "authorKana": AUTHOR_MAP.get(author, ""),
                                **kigo_info,
                                "manualKigo": "",
                                "section": section,
                                "page": page_num,
                                "year": year,
                                "month": month,
                                "issueNumber": issue_number
                            })
                            
                elif page_num in [12, 13, 14]:
                    authors_map = {
                        12: ("髙井辰美", "髙須賀潤緒", ["春の雪"], ["紫木蓮"]),
                        13: ("中井康子", "得居博秀", ["春一番"], ["菜の花"]),
                        14: ("松枝ふみ", "天満洋子", ["桃の花"], ["鹿尾菜刈る"])
                    }
                    u_auth, l_auth, u_titles, l_titles = authors_map[page_num]
                    mid_y = page_height * 0.48
                    upper_chars = [c for c in main_chars if c['top'] < mid_y]
                    lower_chars = [c for c in main_chars if c['top'] >= mid_y]
                    
                    for col in group_into_columns(upper_chars):
                        plain_p, ruby_p = build_phrase_with_ruby(col, ruby_chars)
                        if len(plain_p) >= 9 and not is_title_or_author(plain_p, u_titles, u_auth):
                            kigo_info = match_kigo_data(plain_p)
                            results.append({
                                "phrase": plain_p,
                                "phrase_with_ruby": ruby_p,
                                "author": u_auth,
                                "authorKana": AUTHOR_MAP.get(u_auth, ""),
                                **kigo_info,
                                "manualKigo": "",
                                "section": section,
                                "page": page_num,
                                "year": year,
                                "month": month,
                                "issueNumber": issue_number
                            })
                            
                    for col in group_into_columns(lower_chars):
                        plain_p, ruby_p = build_phrase_with_ruby(col, ruby_chars)
                        if len(plain_p) >= 9 and not is_title_or_author(plain_p, l_titles, l_auth):
                            kigo_info = match_kigo_data(plain_p)
                            results.append({
                                "phrase": plain_p,
                                "phrase_with_ruby": ruby_p,
                                "author": l_auth,
                                "authorKana": AUTHOR_MAP.get(l_auth, ""),
                                **kigo_info,
                                "manualKigo": "",
                                "section": section,
                                "page": page_num,
                                "year": year,
                                "month": month,
                                "issueNumber": issue_number
                            })
                            
                elif page_num == 15:
                    mid_y = page_height * 0.48
                    upper_chars = [c for c in main_chars if c['top'] < mid_y]
                    for col in group_into_columns(upper_chars):
                        plain_p, ruby_p = build_phrase_with_ruby(col, ruby_chars)
                        if len(plain_p) >= 9 and plain_p != "花すみれ" and plain_p != "大野つね子":
                            kigo_info = match_kigo_data(plain_p)
                            results.append({
                                "phrase": plain_p,
                                "phrase_with_ruby": ruby_p,
                                "author": "大野つね子",
                                "authorKana": AUTHOR_MAP.get("大野つね子", "おおのつねこ"),
                                **kigo_info,
                                "manualKigo": "",
                                "section": section,
                                "page": page_num,
                                "year": year,
                                "month": month,
                                "issueNumber": issue_number
                            })

            # ==========================================
            # 6. 16ページ：【臺 小天守】（※目次・代表句のため自動スキップ）
            # ==========================================
            elif page_num == 16:
                print(f"⏩ {page_num}ページ（臺 小天守）は目次・代表句のため自動スキップ")
                continue

            # ==========================================
            # 7. 17〜23ページ：【うてな集】
            # ==========================================
            elif page_num >= 17 and page_num <= 23:
                section = "うてな集"
                if page_num == 17:
                    author = "西濵恵美子"
                    cols = group_into_columns(main_chars)
                    for col in cols:
                        plain_p, ruby_p = build_phrase_with_ruby(col, ruby_chars)
                        if len(plain_p) >= 9 and plain_p != "西濵恵美子" and plain_p != "うてな集" and plain_p != "広島県":
                            kigo_info = match_kigo_data(plain_p)
                            results.append({
                                "phrase": plain_p,
                                "phrase_with_ruby": ruby_p,
                                "author": author,
                                "authorKana": AUTHOR_MAP.get(author, ""),
                                **kigo_info,
                                "manualKigo": "",
                                "section": section,
                                "page": page_num,
                                "year": year,
                                "month": month,
                                "issueNumber": issue_number
                            })
                            
                elif page_num in [18, 19, 20, 21]:
                    authors_map = {
                        18: ("西田上酢", "國米慧子"),
                        19: ("野村菫", "ミサキノバル"),
                        20: ("成本魚乃", "藤田菜々"),
                        21: ("辛嶋栖守", "佐藤南山")
                    }
                    u_auth, l_auth = authors_map[page_num]
                    mid_y = page_height * 0.48
                    upper_chars = [c for c in main_chars if c['top'] < mid_y]
                    lower_chars = [c for c in main_chars if c['top'] >= mid_y]
                    
                    for col in group_into_columns(upper_chars):
                        plain_p, ruby_p = build_phrase_with_ruby(col, ruby_chars)
                        if len(plain_p) >= 9 and not is_title_or_author(plain_p, ["パラオ", "大阪府", "松山市", "東京都"], u_auth):
                            kigo_info = match_kigo_data(plain_p)
                            results.append({
                                "phrase": plain_p,
                                "phrase_with_ruby": ruby_p,
                                "author": u_auth,
                                "authorKana": AUTHOR_MAP.get(u_auth, ""),
                                **kigo_info,
                                "manualKigo": "",
                                "section": section,
                                "page": page_num,
                                "year": year,
                                "month": month,
                                "issueNumber": issue_number
                            })
                            
                    for col in group_into_columns(lower_chars):
                        plain_p, ruby_p = build_phrase_with_ruby(col, ruby_chars)
                        if len(plain_p) >= 9 and not is_title_or_author(plain_p, ["松山市", "東京都"], l_auth):
                            kigo_info = match_kigo_data(plain_p)
                            results.append({
                                "phrase": plain_p,
                                "phrase_with_ruby": ruby_p,
                                "author": l_auth,
                                "authorKana": AUTHOR_MAP.get(l_auth, ""),
                                **kigo_info,
                                "manualKigo": "",
                                "section": section,
                                "page": page_num,
                                "year": year,
                                "month": month,
                                "issueNumber": issue_number
                            })
                            
                elif page_num == 22:
                    mid_y = page_height * 0.48
                    # ① 野本末枝（上段）
                    for col in group_into_columns([c for c in main_chars if c['top'] < mid_y]):
                        plain_p, ruby_p = build_phrase_with_ruby(col, ruby_chars)
                        if len(plain_p) >= 9 and not is_title_or_author(plain_p, ["松山市"], "野本末枝"):
                            kigo_info = match_kigo_data(plain_p)
                            results.append({
                                "phrase": plain_p,
                                "phrase_with_ruby": ruby_p,
                                "author": "野本末枝",
                                "authorKana": AUTHOR_MAP.get("野本末枝", ""),
                                **kigo_info,
                                "manualKigo": "",
                                "section": section,
                                "page": page_num,
                                "year": year,
                                "month": month,
                                "issueNumber": issue_number
                            })
                    # ② 舛岡正弘（下段右）
                    for col in group_into_columns([c for c in main_chars if c['top'] >= mid_y and c['x0'] > 200]):
                        plain_p, ruby_p = build_phrase_with_ruby(col, ruby_chars)
                        if len(plain_p) >= 9 and not is_title_or_author(plain_p, ["松山市"], "舛岡正弘"):
                            kigo_info = match_kigo_data(plain_p)
                            results.append({
                                "phrase": plain_p,
                                "phrase_with_ruby": ruby_p,
                                "author": "舛岡正弘",
                                "authorKana": AUTHOR_MAP.get("舛岡正弘", ""),
                                **kigo_info,
                                "manualKigo": "",
                                "section": section,
                                "page": page_num,
                                "year": year,
                                "month": month,
                                "issueNumber": issue_number
                            })
                    # ③ 青山鹿乃子（下段左）
                    for col in group_into_columns([c for c in main_chars if c['top'] >= mid_y and c['x0'] <= 200]):
                        plain_p, ruby_p = build_phrase_with_ruby(col, ruby_chars)
                        if len(plain_p) >= 9 and not is_title_or_author(plain_p, ["東京都"], "青山鹿乃子"):
                            kigo_info = match_kigo_data(plain_p)
                            results.append({
                                "phrase": plain_p,
                                "phrase_with_ruby": ruby_p,
                                "author": "青山鹿乃子",
                                "authorKana": AUTHOR_MAP.get("青山鹿乃子", ""),
                                **kigo_info,
                                "manualKigo": "",
                                "section": section,
                                "page": page_num,
                                "year": year,
                                "month": month,
                                "issueNumber": issue_number
                            })

                elif page_num == 23:
                    mid_y = page_height * 0.48
                    # ① 萼草子（上段右）
                    for col in group_into_columns([c for c in main_chars if c['top'] < mid_y and c['x0'] > 200]):
                        plain_p, ruby_p = build_phrase_with_ruby(col, ruby_chars)
                        if len(plain_p) >= 9 and not is_title_or_author(plain_p, ["神奈川県"], "萼草子"):
                            kigo_info = match_kigo_data(plain_p)
                            results.append({
                                "phrase": plain_p,
                                "phrase_with_ruby": ruby_p,
                                "author": "萼草子",
                                "authorKana": AUTHOR_MAP.get("萼草子", ""),
                                **kigo_info,
                                "manualKigo": "",
                                "section": section,
                                "page": page_num,
                                "year": year,
                                "month": month,
                                "issueNumber": issue_number
                            })
                    # ② 今村藤生（上段左）
                    for col in group_into_columns([c for c in main_chars if c['top'] < mid_y and c['x0'] <= 200]):
                        plain_p, ruby_p = build_phrase_with_ruby(col, ruby_chars)
                        if len(plain_p) >= 9 and not is_title_or_author(plain_p, ["東京都"], "今村藤生"):
                            kigo_info = match_kigo_data(plain_p)
                            results.append({
                                "phrase": plain_p,
                                "phrase_with_ruby": ruby_p,
                                "author": "今村藤生",
                                "authorKana": AUTHOR_MAP.get("今村藤生", ""),
                                **kigo_info,
                                "manualKigo": "",
                                "section": section,
                                "page": page_num,
                                "year": year,
                                "month": month,
                                "issueNumber": issue_number
                            })
                    # ③ 戎井風蓮（下段右）
                    for col in group_into_columns([c for c in main_chars if c['top'] >= mid_y and c['x0'] > 200]):
                        plain_p, ruby_p = build_phrase_with_ruby(col, ruby_chars)
                        if len(plain_p) >= 9 and not is_title_or_author(plain_p, ["松山市"], "戎井風蓮"):
                            kigo_info = match_kigo_data(plain_p)
                            results.append({
                                "phrase": plain_p,
                                "phrase_with_ruby": ruby_p,
                                "author": "戎井風蓮",
                                "authorKana": AUTHOR_MAP.get("戎井風蓮", ""),
                                **kigo_info,
                                "manualKigo": "",
                                "section": section,
                                "page": page_num,
                                "year": year,
                                "month": month,
                                "issueNumber": issue_number
                            })
                    # ④ 浜田幸子（下段左）
                    for col in group_into_columns([c for c in main_chars if c['top'] >= mid_y and c['x0'] <= 200]):
                        plain_p, ruby_p = build_phrase_with_ruby(col, ruby_chars)
                        if len(plain_p) >= 9 and not is_title_or_author(plain_p, ["広島県"], "浜田幸子"):
                            kigo_info = match_kigo_data(plain_p)
                            results.append({
                                "phrase": plain_p,
                                "phrase_with_ruby": ruby_p,
                                "author": "浜田幸子",
                                "authorKana": AUTHOR_MAP.get("浜田幸子", ""),
                                **kigo_info,
                                "manualKigo": "",
                                "section": section,
                                "page": page_num,
                                "year": year,
                                "month": month,
                                "issueNumber": issue_number
                            })

    print(f"✨ 抽出完了！ 合計抽出句数（重複目次除外後）: {len(results)} 句")
    return results

if __name__ == "__main__":
    pdf_file = sys.argv[1] if len(sys.argv) > 1 else "/Users/nishidaryota/Library/Mobile Documents/com~apple~CloudDocs/kucho-fugetsu-v2-main/2025年　4月   号.pdf"
    
    extracted = extract_haiku_from_pdf(pdf_file, year="2025", month="4", issue_number="199")
    
    # 俳句集成シート完全一致フォーマット（A〜L列）
    out_csv = "extracted_haiku_2025_04.csv"
    with open(out_csv, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["俳句", "作者", "作者よみがな", "季語", "親季語", "季語よみがな", "季節", "詳細季節", "手入力した季語", "発行年", "発行月", "号数"])
        for h in extracted:
            # ルビ付きの句を出力
            phrase_out = h["phrase_with_ruby"]
            writer.writerow([phrase_out, h["author"], h["authorKana"], h["kigo"], h["parentKigo"], h["kigoKana"], h["season"], h["detailSeason"], h["manualKigo"], h["year"], h["month"], h["issueNumber"]])
            
    out_json = "extracted_haiku_2025_04.json"
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(extracted, f, ensure_ascii=False, indent=2)
        
    print(f"✅ CSV出力完了: {out_csv}")
    print(f"✅ JSON出力完了: {out_json}")
