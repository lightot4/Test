(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GGParser = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const STATUS_KEYWORDS = ["매각", "진행", "신건", "변경", "취하", "납부", "기각"];
  const USE_TYPES = [
    "아파트",
    "주상복합(아파트)",
    "오피스텔",
    "다세대",
    "연립",
    "근린",
    "상가",
    "토지",
    "공장",
    "창고",
    "단독주택",
    "다가구"
  ];
  const EXCLUDED_TEXT_HINTS = [
    "고객센터",
    "검색조건",
    "정렬방식",
    "특수조건",
    "테마검색",
    "페이지 이동",
    "footer",
    "20개로보기",
    "전체보기",
    "관심물건등록",
    "javascript:",
    "function ",
    "<script",
    "</script"
  ];
  const START_PATTERN = /(\d{4}\.\d{2}\.\d{2})(?:\s*\/\s*([0-9]+일전))?\s*\/\s*([^/\n]+?)\s*\/\s*([^/\n]+?계)\s*\/\s*((?:19|20)\d{2}-\d+(?:\[\d+\])?)/g;

  function cleanText(value) {
    return (value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function normalizeConditionToken(token) {
    const normalized = cleanText(token)
      .replace(/\s+/g, "")
      .replace(/^先임차권/, "선순위임차권")
      .replace(/인수조건변경|인수조건\s*변경/g, "인수조건변경")
      .replace(/선임차권/g, "선순위임차권");

    if (normalized.startsWith("선순위임차권") && normalized.includes("말소")) {
      return "선순위임차권(말소)";
    }
    return normalized;
  }

  function toNumberString(text) {
    const matched = cleanText(text).match(/[\d,]+(?:\.\d+)?/);
    return matched ? matched[0].replace(/,/g, "") : "";
  }

  function extractLabelValue(text, label) {
    const pattern = new RegExp(`${label}\\s*[:：]?\\s*([^\\n]+)`);
    const match = text.match(pattern);
    return match ? cleanText(match[1]) : "";
  }

  function findUsage(text) {
    return USE_TYPES.find((type) => text.includes(type)) || "";
  }

  function parseStartLine(text) {
    const slashMatch = text.match(
      /(\d{4}\.\d{2}\.\d{2})(?:\s*\/\s*([0-9]+일전))?\s*\/\s*([^/\n]+?)\s*\/\s*([^/\n]+?계)\s*\/\s*((?:19|20)\d{2}-\d+(?:\[\d+\])?)/
    );

    if (slashMatch) {
      return {
        매각기일: cleanText(slashMatch[1]),
        상대일자: cleanText(slashMatch[2] || ""),
        용도: cleanText(slashMatch[3]),
        법원계: cleanText(slashMatch[4]),
        사건번호: cleanText(slashMatch[5])
      };
    }

    const dateMatch = text.match(/\d{4}\.\d{2}\.\d{2}/);
    const relativeMatch = text.match(/[0-9]+일전/);
    const courtMatch = text.match(/[가-힣0-9]+계/);
    const caseMatch = text.match(/(?:19|20)\d{2}-\d+(?:\[\d+\])?/);

    if (!dateMatch || !courtMatch || !caseMatch) {
      return null;
    }

    return {
      매각기일: cleanText(dateMatch[0]),
      상대일자: cleanText((relativeMatch && relativeMatch[0]) || ""),
      용도: findUsage(text),
      법원계: cleanText(courtMatch[0]),
      사건번호: cleanText(caseMatch[0])
    };
  }

  function shouldExcludeText(rawText) {
    const text = cleanText(rawText);
    if (!text) {
      return true;
    }
    if (!/(?:19|20)\d{2}-\d+(?:\[\d+\])?/.test(text) || !/\d{4}\.\d{2}\.\d{2}/.test(text)) {
      return true;
    }

    const lowered = text.toLowerCase();
    return EXCLUDED_TEXT_HINTS.some((hint) => lowered.includes(hint.toLowerCase()));
  }

  function parseSpecialConditions(text) {
    const matches = Array.from(text.matchAll(/\[([^\]]+)\]/g)).map((m) => cleanText(m[1]));
    const filtered = matches
      .filter((token) => token)
      .filter((token) => !/(?:로|길|대로|번길|읍|면|동)\s*\d/.test(token))
      .filter((token) => !/\d+평형/.test(token))
      .filter((token) => !/^\d+$/.test(token))
      .map(normalizeConditionToken)
      .filter((token) => token && !/^(소재지|도로명주소)$/.test(token));

    return [...new Set(filtered)].join("|");
  }

  function parseAdditionalInfo(text) {
    const infoTokens = [];
    const bulletMatch = text.match(/·\s*([^\n]+)/);
    if (bulletMatch) {
      bulletMatch[1]
        .split("·")
        .map(cleanText)
        .filter(Boolean)
        .forEach((token) => infoTokens.push(token));
    }

    ["세대조사", "건축물대장", "GGTip", "평면도", "개발지역", "특수권리분석"].forEach((token) => {
      if (text.includes(token)) {
        infoTokens.push(token);
      }
    });

    return [...new Set(infoTokens)].join("|");
  }

  function parseRoadAddress(text) {
    const bracketTokens = Array.from(text.matchAll(/\[([^\]]+)\]/g)).map((m) => cleanText(m[1]));
    const road = bracketTokens.find((token) => /(로|길|대로|번길)/.test(token));
    return road || extractLabelValue(text, "도로명주소");
  }

  function parseListingBlock(rawText) {
    const text = cleanText(rawText);
    const head = parseStartLine(text);
    if (!head) {
      return null;
    }

    const moneyTokens = Array.from(text.matchAll(/\d{1,3}(?:,\d{3})+(?:원)?/g)).map((m) => m[0].replace(/원/g, ""));
    const 감정가 = toNumberString(extractLabelValue(text, "감정가"));
    const 최저가 = toNumberString(extractLabelValue(text, "최저가"));

    const extraPrices = moneyTokens
      .map((v) => v.replace(/,/g, ""))
      .filter((v) => v && v !== 감정가 && v !== 최저가);

    const ratios = Array.from(text.matchAll(/(\d{1,3})%/g)).map((m) => `${m[1]}%`);
    const status = STATUS_KEYWORDS.find((keyword) => new RegExp(`(?:^|\\s)${keyword}(?:\\s|$)`).test(text)) || "";

    const 평형표기Match = text.match(/(\d+\s*평형)/);
    const 응찰수Match = text.match(/응찰\s*수?\s*[:：]?\s*(\d+)|\((\d+)명\)/);
    const 조회수Match = text.match(/조회\s*수?\s*[:：]?\s*(\d+)/);
    const 유찰Match = text.match(/유찰\s*회수?\s*[:：]?\s*(\d+)\s*회?/);

    return {
      매각기일: head.매각기일,
      상대일자: head.상대일자,
      용도: head.용도,
      법원계: head.법원계,
      사건번호: head.사건번호,
      소재지: extractLabelValue(text, "소재지"),
      도로명주소: parseRoadAddress(text),
      물건요약: extractLabelValue(text, "물건요약"),
      특수조건: parseSpecialConditions(text),
      "건물㎡": toNumberString(extractLabelValue(text, "건물㎡") || extractLabelValue(text, "건물m2")),
      건물평: toNumberString(extractLabelValue(text, "건물평")),
      평형표기: 평형표기Match ? cleanText(평형표기Match[1]) : "",
      "토지㎡": toNumberString(extractLabelValue(text, "토지㎡") || extractLabelValue(text, "토지m2")),
      토지평: toNumberString(extractLabelValue(text, "토지평")),
      감정가,
      최저가,
      가격3: extraPrices[0] || "",
      가격4: extraPrices[1] || "",
      응찰수: cleanText((응찰수Match && (응찰수Match[1] || 응찰수Match[2])) || ""),
      상태: status,
      비율1: ratios[0] || "",
      비율2: ratios[1] || "",
      조회수: cleanText((조회수Match && 조회수Match[1]) || ""),
      유찰회수: cleanText((유찰Match && `${유찰Match[1]}회`) || ""),
      추가정보: parseAdditionalInfo(text)
    };
  }

  function splitListingBlocks(rawText) {
    const text = cleanText(rawText);
    if (!text) {
      return [];
    }

    const matches = Array.from(text.matchAll(START_PATTERN));
    if (!matches.length) {
      return [];
    }

    return matches
      .map((match, index) => {
        const start = match.index;
        const end = index + 1 < matches.length ? matches[index + 1].index : text.length;
        return cleanText(text.slice(start, end));
      })
      .filter(Boolean);
  }

  return {
    cleanText,
    shouldExcludeText,
    parseListingBlock,
    splitListingBlocks,
    parseStartLine
  };
});
