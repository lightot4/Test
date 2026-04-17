const PAGE_WAIT_MS = 1600;
const MAX_PAGES = 200;
const PAGE_POLL_RETRY = 6;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dedupe(items) {
  const map = new Map();
  for (const item of items) {
    const key = `${item.사건번호 || ""}::${item.소재지 || ""}::${item.물건요약 || ""}`;
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return Array.from(map.values());
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

async function extractPage(tabId) {
  const response = await sendMessageToTab(tabId, { type: "EXTRACT_VISIBLE" });
  if (!response?.ok) {
    throw new Error("페이지 데이터 추출 실패");
  }

  return {
    items: response.items || [],
    pageNumber: Number.isFinite(response.pageNumber) ? response.pageNumber : null,
    pageUrl: response.pageUrl || ""
  };
}

function getPageSignature(extraction) {
  const firstItem = extraction.items[0];
  const firstKey = firstItem
    ? `${firstItem.사건번호 || ""}|${firstItem.소재지 || ""}|${firstItem.최저가 || ""}`
    : "empty";
  return `${extraction.pageNumber ?? "np"}|${firstKey}|${extraction.items.length}`;
}

async function waitForPageChange(tabId, beforeExtraction) {
  const beforeSignature = getPageSignature(beforeExtraction);

  for (let attempt = 0; attempt < PAGE_POLL_RETRY; attempt += 1) {
    await sleep(PAGE_WAIT_MS);
    const afterExtraction = await extractPage(tabId);
    if (getPageSignature(afterExtraction) !== beforeSignature) {
      return afterExtraction;
    }
  }

  return beforeExtraction;
}

async function collectVisible(tabId) {
  const extraction = await extractPage(tabId);
  return extraction.items;
}

async function collectAllPages(tabId) {
  const result = [];
  const visitedSignatures = new Set();
  let extraction = await extractPage(tabId);

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const signature = getPageSignature(extraction);
    if (visitedSignatures.has(signature)) {
      break;
    }

    visitedSignatures.add(signature);
    result.push(...extraction.items);

    const next = await sendMessageToTab(tabId, { type: "GO_NEXT_PAGE" });
    if (!next?.ok || !next.moved) {
      break;
    }

    const movedExtraction = await waitForPageChange(tabId, extraction);
    if (getPageSignature(movedExtraction) === signature) {
      break;
    }

    extraction = movedExtraction;
  }

  return result;
}

async function postToWebhook(webhookUrl, payload) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`전송 실패: ${response.status} ${text}`);
  }

  return response.json().catch(() => ({}));
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "START_CRAWL") {
    return false;
  }

  const { tabId, webhookUrl, scopeMode } = message;

  (async () => {
    try {
      const rawItems = scopeMode === "all" ? await collectAllPages(tabId) : await collectVisible(tabId);
      const uniqueItems = dedupe(rawItems);

      await postToWebhook(webhookUrl, {
        source: "ggi-extension",
        scopeMode,
        sentAt: new Date().toISOString(),
        totalCount: rawItems.length,
        uniqueCount: uniqueItems.length,
        items: uniqueItems,
        rawItems
      });

      sendResponse({
        ok: true,
        totalCount: rawItems.length,
        uniqueCount: uniqueItems.length,
        sentCount: uniqueItems.length
      });
    } catch (error) {
      sendResponse({ ok: false, error: error.message });
    }
  })();

  return true;
});
