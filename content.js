const { cleanText, shouldExcludeText, parseListingBlock, splitListingBlocks } = GGParser;

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

function getScopedRoots() {
  const roots = [
    ".list_result",
    ".result_list",
    ".auction_list",
    ".contents",
    "#contents",
    "#frmSearch",
    "form[name='searchForm']"
  ]
    .map((selector) => document.querySelector(selector))
    .filter(Boolean);

  return roots.length ? roots : [document.body];
}

function parseFromElementCandidates(roots) {
  const selector = "tr, li, .list-item, .result-item, .card, .box, .list";
  const listings = [];
  const seen = new Set();
  let candidateCount = 0;

  roots.forEach((root) => {
    root.querySelectorAll(selector).forEach((el) => {
      candidateCount += 1;
      const text = cleanText(el.innerText || el.textContent || "");
      if (!text || shouldExcludeText(text)) {
        return;
      }

      const parsed = parseListingBlock(text);
      if (!parsed?.사건번호) {
        return;
      }

      const key = `${parsed.사건번호}|${parsed.소재지}|${parsed.물건요약}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      listings.push(parsed);
    });
  });

  return { listings, candidateCount };
}

function parseFromGroupedText(roots) {
  const listings = [];
  const seen = new Set();
  let blockCount = 0;

  roots.forEach((root) => {
    const blocks = splitListingBlocks(root.innerText || root.textContent || "");
    blockCount += blocks.length;

    blocks.forEach((block) => {
      const parsed = parseListingBlock(block);
      if (!parsed?.사건번호) {
        return;
      }

      const key = `${parsed.사건번호}|${parsed.소재지}|${parsed.물건요약}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      listings.push(parsed);
    });
  });

  return { listings, blockCount };
}

function extractVisibleListings() {
  const roots = getScopedRoots();
  const direct = parseFromElementCandidates(roots);

  if (direct.listings.length) {
    return {
      items: direct.listings,
      debug: {
        mode: "element",
        rootCount: roots.length,
        candidateCount: direct.candidateCount,
        blockCount: 0
      }
    };
  }

  const grouped = parseFromGroupedText(roots);
  return {
    items: grouped.listings,
    debug: {
      mode: "grouped",
      rootCount: roots.length,
      candidateCount: direct.candidateCount,
      blockCount: grouped.blockCount
    }
  };
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
    const extraction = extractVisibleListings();
    sendResponse({
      ok: true,
      items: extraction.items,
      debug: extraction.debug,
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
