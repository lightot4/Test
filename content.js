const { cleanText, shouldExcludeText, parseListingBlock } = GGParser;

function getCurrentPageNumber() {
  const selected = document.querySelector(".pagenation .selecPg");
  if (!selected) {
    return null;
  }

  const page = Number(cleanText(selected.textContent));
  return Number.isFinite(page) ? page : null;
}

function parseOnclickPage(el) {
  const onclick = el.getAttribute("onclick") || "";
  const matched = onclick.match(/(?:submit_page|wait_submit_page)\('?(\d+)'?\)/);
  return matched ? Number(matched[1]) : null;
}

function clickElement(el) {
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function findListingCandidates() {
  const scopedRoots = [
    ".list_result",
    ".result_list",
    ".auction_list",
    ".contents",
    "#contents"
  ]
    .map((selector) => document.querySelector(selector))
    .filter(Boolean);

  const roots = scopedRoots.length ? scopedRoots : [document.body];
  const selector = "tr, li, .list-item, .result-item, .card, .box";

  const candidates = [];
  roots.forEach((root) => {
    root.querySelectorAll(selector).forEach((el) => {
      const text = cleanText(el.innerText || el.textContent || "");
      if (text) {
        candidates.push({ el, text });
      }
    });
  });

  return candidates;
}

function extractVisibleListings() {
  const listings = [];
  const seen = new Set();

  findListingCandidates().forEach(({ text }) => {
    if (shouldExcludeText(text)) {
      return;
    }

    const parsed = parseListingBlock(text);
    if (!parsed || !parsed.사건번호) {
      return;
    }

    const key = `${parsed.사건번호}|${parsed.소재지}|${parsed.물건요약}`;
    if (seen.has(key)) {
      return;
    }

    listings.push(parsed);
    seen.add(key);
  });

  return listings;
}

function tryMoveNextPage() {
  const currentPage = getCurrentPageNumber();
  const pagenavItems = Array.from(document.querySelectorAll(".pagenation .pagenav"));

  const nextNumbered = pagenavItems.find((el) => parseOnclickPage(el) === currentPage + 1);
  if (nextNumbered) {
    clickElement(nextNumbered);
    return { moved: true, fromPage: currentPage, toPage: currentPage + 1, strategy: "numbered" };
  }

  const arrowTarget = pagenavItems.find((el) => cleanText(el.textContent) === ">");
  if (arrowTarget) {
    const toPage = parseOnclickPage(arrowTarget);
    clickElement(arrowTarget);
    return { moved: true, fromPage: currentPage, toPage, strategy: "arrow" };
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
    sendResponse({
      ok: true,
      items: extractVisibleListings(),
      pageNumber: getCurrentPageNumber(),
      pageUrl: location.href
    });
    return true;
  }

  if (message?.type === "GO_NEXT_PAGE") {
    sendResponse({ ok: true, ...tryMoveNextPage() });
    return true;
  }

  return false;
});
