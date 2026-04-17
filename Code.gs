/**
 * Apps Script Web App endpoint.
 * 1) 스프레드시트에 RAW / NORMALIZED 시트가 없으면 자동 생성
 * 2) 익스텐션에서 전달한 payload를 적재
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
      JSON.stringify({
        ok: true,
        received: items.length,
        at: new Date().toISOString()
      })
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
  sheet.appendRow([
    "receivedAt",
    "source",
    "scopeMode",
    "totalCount",
    "uniqueCount",
    "payload"
  ]);
}

function ensureNormalizedHeader_(sheet) {
  if (sheet.getLastRow() > 0) {
    return;
  }
  sheet.appendRow([
    "collectedAt",
    "caseNumber",
    "address",
    "appraisalPrice",
    "minimumPrice",
    "status",
    "detailUrl"
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
      item.collectedAt || "",
      item.caseNumber || "",
      item.address || "",
      item.appraisalPrice || "",
      item.minimumPrice || "",
      item.status || "",
      item.detailUrl || ""
    ];
  });

  const startRow = sheet.getLastRow() + 1;
  const range = sheet.getRange(startRow, 1, values.length, values[0].length);
  range.setValues(values);
}
