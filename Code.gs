/**
 * Apps Script Web App endpoint.
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const sheet = SpreadsheetApp.getActiveSpreadsheet();
    const rawSheet = getOrCreateSheet_(sheet, "RAW");
    const normalizedSheet = getOrCreateSheet_(sheet, "NORMALIZED");

    ensureRawHeader_(rawSheet);
    ensureNormalizedHeader_(normalizedSheet);

    const items = Array.isArray(body.items) ? body.items : [];
    const rawItems = Array.isArray(body.rawItems) ? body.rawItems : [];

    appendRaw_(rawSheet, body, rawItems);
    appendNormalized_(normalizedSheet, items);

    return ContentService.createTextOutput(
      JSON.stringify({ ok: true, received: items.length, at: new Date().toISOString() })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: String(error) })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateSheet_(spreadsheet, name) {
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function ensureRawHeader_(sheet) {
  if (sheet.getLastRow() > 0) {
    return;
  }
  sheet.appendRow(["receivedAt", "source", "scopeMode", "totalCount", "uniqueCount", "payload"]);
}

function ensureNormalizedHeader_(sheet) {
  if (sheet.getLastRow() > 0) {
    return;
  }

  sheet.appendRow([
    "매각기일",
    "상대일자",
    "용도",
    "법원계",
    "사건번호",
    "소재지",
    "도로명주소",
    "물건요약",
    "특수조건",
    "건물㎡",
    "건물평",
    "평형표기",
    "토지㎡",
    "토지평",
    "감정가",
    "최저가",
    "가격3",
    "가격4",
    "응찰수",
    "상태",
    "비율1",
    "비율2",
    "조회수",
    "유찰회수",
    "추가정보"
  ]);
}

function appendRaw_(sheet, body, rawItems) {
  sheet.appendRow([
    new Date(),
    body.source || "",
    body.scopeMode || "",
    body.totalCount || 0,
    body.uniqueCount || 0,
    JSON.stringify(rawItems)
  ]);
}

function appendNormalized_(sheet, items) {
  if (!items.length) {
    return;
  }

  const values = items.map(function (item) {
    return [
      item.매각기일 || "",
      item.상대일자 || "",
      item.용도 || "",
      item.법원계 || "",
      item.사건번호 || "",
      item.소재지 || "",
      item.도로명주소 || "",
      item.물건요약 || "",
      item.특수조건 || "",
      item["건물㎡"] || "",
      item.건물평 || "",
      item.평형표기 || "",
      item["토지㎡"] || "",
      item.토지평 || "",
      item.감정가 || "",
      item.최저가 || "",
      item.가격3 || "",
      item.가격4 || "",
      item.응찰수 || "",
      item.상태 || "",
      item.비율1 || "",
      item.비율2 || "",
      item.조회수 || "",
      item.유찰회수 || "",
      item.추가정보 || ""
    ];
  });

  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, values[0].length).setValues(values);
}
