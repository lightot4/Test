(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GGParser = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const STATUS_KEYWORDS = ["매각", "진행", "신건", "변경", "취하", "납부", "기각"];
  const USE_TYPES = ["아파트", "주상복합(아파트)", "오피스텔", "다세대", "연립", "근린", "상가", "토지", "공장"];
  const EXCLUDED_TEXT_HINTS = [
    "고객센터",
    "검색조건",
    "정렬방식",
    "테마검색",
    "페이지 이동",
    "20개로보기",
    "전체보기",
    "관심물건등록",
    "javascript:",
    "function ",
    "<script"
  ];
  const START_PATTERN = /(\d{4}\.\d{2}\.\d{2})(?:\s*\/\s*([0-9]+일전))?\s*\/\s*([^/\n]+?)\s*\/\s*([^/\n]+?계)\s*\/\s*((?:19|20)\d{2}-\d+(?:\[\d+\])?)/g;
  const START_PATTERN_FALLBACK = /(\d{4}\.\d{2}\.\d{2}).{0,120}?([가-힣0-9]+계).{0,60}?((?:19|20)\d{2}-\d+(?:\[\d+\])?)/g;

  const cleanText = (v) => (v || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  const toNumberString = (text) => ((cleanText(text).match(/[\d,]+(?:\.\d+)?/) || [""])[0] || "").replace(/,/g, "");

  function extractLabelValue(text, label) {
    const m = text.match(new RegExp(`${label}\\s*[:：]?\\s*([^\\n]+)`));
    return m ? cleanText(m[1]) : "";
  }

  function parseStartLine(text) {
    const slashMatch = text.match(
      /(\d{4}\.\d{2}\.\d{2})(?:\s*\/\s*([0-9]+일전))?\s*\/\s*([^/\n]+?)\s*\/\s*([^/\n]+?계)\s*\/\s*((?:19|20)\d{2}-\d+(?:\[\d+\])?)/
    );
    if (slashMatch) {
      return { 매각기일: cleanText(slashMatch[1]), 상대일자: cleanText(slashMatch[2] || ""), 용도: cleanText(slashMatch[3]), 법원계: cleanText(slashMatch[4]), 사건번호: cleanText(slashMatch[5]) };
    }

    const date = (text.match(/\d{4}\.\d{2}\.\d{2}/) || [""])[0];
    const relative = (text.match(/[0-9]+일전/) || [""])[0];
    const court = (text.match(/[가-힣0-9]+계/) || [""])[0];
    const caseNo = (text.match(/(?:19|20)\d{2}-\d+(?:\[\d+\])?/) || [""])[0];
    const use = USE_TYPES.find((u) => text.includes(u)) || "";
    if (!date || !court || !caseNo) return null;
    return { 매각기일: date, 상대일자: relative, 용도: use, 법원계: court, 사건번호: caseNo };
  }

  function shouldExcludeText(rawText) {
    const text = cleanText(rawText).toLowerCase();
    if (!text) return true;
    if (!/(?:19|20)\d{2}-\d+(?:\[\d+\])?/.test(text) || !/\d{4}\.\d{2}\.\d{2}/.test(text)) return true;
    return EXCLUDED_TEXT_HINTS.some((hint) => text.includes(hint.toLowerCase()));
  }

  function normalizeConditionToken(token) {
    return cleanText(token)
      .replace(/\s+/g, "")
      .replace(/^先임차권/, "선순위임차권")
      .replace(/인수조건\s*변경/g, "인수조건변경");
  }

  function parseSpecialConditions(text) {
    return [...new Set(Array.from(text.matchAll(/\[([^\]]+)\]/g)).map((m) => cleanText(m[1]))
      .filter((t) => t && !/(?:로|길|대로|번길)\s*\d/.test(t) && !/^\d+$/.test(t))
      .map(normalizeConditionToken))].join("|");
  }

  function parseAdditionalInfo(text) {
    const tokens = [];
    const bullet = text.match(/·\s*([^\n]+)/);
    if (bullet) bullet[1].split("·").map(cleanText).filter(Boolean).forEach((t) => tokens.push(t));
    ["세대조사", "건축물대장", "GGTip", "평면도", "답사사진", "특수권리분석"].forEach((t) => text.includes(t) && tokens.push(t));
    return [...new Set(tokens)].join("|");
  }

  function parseListingBlock(rawText) {
    const text = cleanText(rawText);
    const lines = (rawText || "").split(/\n+/).map(cleanText).filter(Boolean);
    const head = parseStartLine(text);
    if (!head) return null;

    const addressLine = lines.find((line) => /(시|군|구).+\[.+(로|길|대로)/.test(line)) || "";
    const buildingLine = lines.find((line) => /건물\s*\d+/.test(line) && /토지\s*\d+/.test(line)) || "";

    const road = ((addressLine.match(/\[([^\]]+)\]/) || ["", ""])[1]) || ((text.match(/\[([^\]]*(?:로|길|대로|번길)[^\]]*)\]/) || ["", ""])[1]) || "";
    const 소재지 = cleanText(addressLine.replace(/\[[^\]]+\]/g, ""));
    const 물건기본내역 = [소재지, buildingLine].filter(Boolean).join(" | ");

    const buildingSqm = ((buildingLine.match(/건물\s*([\d.]+)㎡/) || ["", ""])[1]);
    const buildingPyeong = ((buildingLine.match(/건물\s*[\d.]+㎡\s*\((\d+)평\)/) || ["", ""])[1]);
    const landSqm = ((buildingLine.match(/토지\s*([\d.]+)㎡/) || ["", ""])[1]);
    const landPyeong = ((buildingLine.match(/토지\s*[\d.]+㎡\s*\((\d+)평\)/) || ["", ""])[1]);
    const ptype = ((buildingLine.match(/\[(\d+\s*평형)\]/) || ["", ""])[1]);

    const moneyTokens = Array.from(text.matchAll(/\d{1,3}(?:,\d{3})+(?:원)?/g)).map((m) => m[0].replace(/원/g, "").replace(/,/g, ""));
    const 감정가 = toNumberString(extractLabelValue(text, "감정가") || moneyTokens[0] || "");
    const 최저가 = toNumberString(extractLabelValue(text, "최저가") || moneyTokens[1] || "");
    const extraPrices = moneyTokens.filter((v) => v && v !== 감정가 && v !== 최저가);

    const status = STATUS_KEYWORDS.find((k) => new RegExp(`(?:^|\\s)${k}(?:\\s|$)`).test(text)) || "";
    const ratio = ((text.match(/\((\d{1,3})%\)/) || text.match(/(\d{1,3})%/) || ["", ""])[1]);

    const statusLineIndex = lines.findIndex((line) => STATUS_KEYWORDS.some((k) => line.includes(k)));
    const afterStatus = statusLineIndex >= 0 ? lines.slice(statusLineIndex + 1) : lines;
    const viewLine = afterStatus.find((line) => /^\d{1,4}$/.test(line)) || ((text.match(/조회\s*수?\s*[:：]?\s*(\d+)/) || ["", ""])[1]);
    const failLine = afterStatus.find((line) => /^\(\d+회\)$/.test(line)) || ((text.match(/\((\d+회)\)/) || ["", ""])[1]);

    return {
      매각기일: head.매각기일,
      상대일자: head.상대일자,
      용도: head.용도,
      법원계: head.법원계,
      사건번호: head.사건번호,
      물건기본내역,
      소재지,
      도로명주소: road,
      "건물㎡": buildingSqm,
      건물평: buildingPyeong,
      평형표기: ptype,
      "토지㎡": landSqm,
      토지평: landPyeong,
      특수조건: parseSpecialConditions(text),
      감정가,
      최저가,
      가격3: extraPrices[0] || "",
      가격4: extraPrices[1] || "",
      상태: status,
      비율: ratio ? `${ratio}%` : "",
      조회수: cleanText(viewLine),
      유찰회수: cleanText(failLine).replace(/[()]/g, ""),
      추가정보: parseAdditionalInfo(text)
    };
  }

  function splitListingBlocks(rawText) {
    const text = cleanText(rawText);
    if (!text) return [];

    let matches = Array.from(text.matchAll(START_PATTERN));
    if (!matches.length) {
      matches = Array.from(text.matchAll(START_PATTERN_FALLBACK));
    }
    if (!matches.length) return [];

    return matches
      .map((m, i) => cleanText(text.slice(m.index, i + 1 < matches.length ? matches[i + 1].index : text.length)))
      .filter(Boolean)
      .filter((block) => /(?:19|20)\d{2}-\d+(?:\[\d+\])?/.test(block));
  }

  return { cleanText, shouldExcludeText, parseListingBlock, splitListingBlocks, parseStartLine };
});
