function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function toNumber(value) {
  const numeric = cleanText(value).replace(/[^\d.-]/g, "");
  return numeric ? Number(numeric) : null;
}

function extractItemFromRow(row, index) {
  const cells = Array.from(row.querySelectorAll("td,th")).map((el) => cleanText(el.textContent));
  const link = row.querySelector("a");

  const address =
    row.querySelector("[class*='addr'], [data-col='address']")?.textContent ||
    cells.find((cell) => /[가-힣]+(시|군|구)/.test(cell)) ||
    "";

  const caseNumber =
    row.querySelector("[class*='case'], [data-col='case']")?.textContent ||
    cells.find((cell) => /^\d{4}/.test(cell)) ||
    "";

  const appraisalRaw =
    row.querySelector("[class*='appraisal'], [data-col='appraisal']")?.textContent ||
    cells.find((cell) => cell.includes("원")) ||
    "";

  const minimumRaw =
    row.querySelector("[class*='minimum'], [data-col='minimum']")?.textContent ||
    cells.filter((cell) => cell.includes("원"))[1] ||
    "";

  return {
    sourceSite: "ggi",
    collectedAt: new Date().toISOString(),
    rowIndex: index + 1,
    caseNumber: cleanText(caseNumber),
    address: cleanText(address),
    appraisalPrice: toNumber(appraisalRaw),
    minimumPrice: toNumber(minimumRaw),
    status: cleanText(cells.find((cell) => /진행|유찰|매각|변경/.test(cell)) || ""),
    detailUrl: link ? new URL(link.getAttribute("href"), location.href).toString() : location.href,
    rawCells: cells
  };
}

function extractVisibleListings() {
  const rowCandidates = Array.from(document.querySelectorAll("table tbody tr"));
  const rows = rowCandidates.filter((row) => row.querySelector("td"));

  return rows.map((row, index) => extractItemFromRow(row, index));
}

function findNextButton() {
  const candidates = Array.from(document.querySelectorAll("a,button"));
  return candidates.find((el) => {
    const text = cleanText(el.textContent);
    return /다음|next|>|›/.test(text) && !el.hasAttribute("disabled") && !el.classList.contains("disabled");
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "EXTRACT_VISIBLE") {
    const items = extractVisibleListings();
    sendResponse({ ok: true, items, pageUrl: location.href });
    return true;
  }

  if (message?.type === "GO_NEXT_PAGE") {
    const nextButton = findNextButton();
    if (!nextButton) {
      sendResponse({ ok: true, moved: false });
      return true;
    }

    nextButton.click();
    sendResponse({ ok: true, moved: true });
    return true;
  }

  return false;
});
