function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function toNumber(value) {
  const numeric = cleanText(value).replace(/[^\d.-]/g, "");
  return numeric ? Number(numeric) : null;
}

function parseOnclickPage(el) {
  const onclick = el.getAttribute("onclick") || "";
  const matched = onclick.match(/(?:submit_page|wait_submit_page)\('?(\d+)'?\)/);
  return matched ? Number(matched[1]) : null;
}

function getCurrentPageNumber() {
  const selected = document.querySelector(".pagenation .selecPg");
  if (!selected) {
    return null;
  }

  const page = Number(cleanText(selected.textContent));
  return Number.isFinite(page) ? page : null;
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

  const prices = cells.filter((cell) => cell.includes("원"));
  const appraisalRaw =
    row.querySelector("[class*='appraisal'], [data-col='appraisal']")?.textContent || prices[0] || "";

  const minimumRaw =
    row.querySelector("[class*='minimum'], [data-col='minimum']")?.textContent || prices[1] || "";

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
  const rows = rowCandidates.filter((row) => row.querySelector("td") && cleanText(row.textContent));

  return rows.map((row, index) => extractItemFromRow(row, index));
}

function clickElement(el) {
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function tryMoveNextPage() {
  const currentPage = getCurrentPageNumber();
  const pagenavItems = Array.from(document.querySelectorAll(".pagenation .pagenav"));

  const numberedTargets = pagenavItems
    .map((el) => ({ el, page: parseOnclickPage(el) }))
    .filter((item) => Number.isFinite(item.page));

  if (Number.isFinite(currentPage)) {
    const nextNumbered = numberedTargets
      .filter((item) => item.page === currentPage + 1)
      .map((item) => item.el)[0];

    if (nextNumbered) {
      clickElement(nextNumbered);
      return { moved: true, fromPage: currentPage, toPage: currentPage + 1, strategy: "numbered" };
    }
  }

  const arrowTarget = pagenavItems.find(
    (el) => cleanText(el.textContent) === ">" || cleanText(el.textContent) === "›"
  );
  if (arrowTarget) {
    const target = parseOnclickPage(arrowTarget);
    clickElement(arrowTarget);
    return {
      moved: true,
      fromPage: currentPage,
      toPage: Number.isFinite(target) ? target : null,
      strategy: "arrow"
    };
  }

  const directInput = document.querySelector(".pagenation input.page-direct");
  const directButton = Array.from(document.querySelectorAll(".pagenation button")).find(
    (button) => cleanText(button.textContent) === "이동"
  );
  if (directInput && directButton && Number.isFinite(currentPage)) {
    directInput.value = String(currentPage + 1);
    directInput.dispatchEvent(new Event("input", { bubbles: true }));
    clickElement(directButton);
    return { moved: true, fromPage: currentPage, toPage: currentPage + 1, strategy: "direct-input" };
  }

  return { moved: false, fromPage: currentPage, toPage: null, strategy: "none" };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "EXTRACT_VISIBLE") {
    const items = extractVisibleListings();
    sendResponse({
      ok: true,
      items,
      pageUrl: location.href,
      pageNumber: getCurrentPageNumber()
    });
    return true;
  }

  if (message?.type === "GO_NEXT_PAGE") {
    const next = tryMoveNextPage();
    sendResponse({ ok: true, ...next });
    return true;
  }

  return false;
});
