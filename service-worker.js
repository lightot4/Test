const PAGE_WAIT_MS = 1800;
const MAX_PAGES = 100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dedupe(items) {
  const map = new Map();
  for (const item of items) {
    const key = `${item.caseNumber}::${item.address}::${item.minimumPrice ?? ""}`;
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return Array.from(map.values());
}

function normalize(items) {
  return items.map((item) => ({
    caseNumber: item.caseNumber || "",
    address: item.address || "",
    appraisalPrice: item.appraisalPrice ?? "",
    minimumPrice: item.minimumPrice ?? "",
    status: item.status || "",
    detailUrl: item.detailUrl || "",
    collectedAt: item.collectedAt || new Date().toISOString()
  }));
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

async function collectVisible(tabId) {
  const response = await sendMessageToTab(tabId, { type: "EXTRACT_VISIBLE" });
  if (!response?.ok) {
    throw new Error("페이지 데이터 추출 실패");
  }
  return response.items || [];
}

async function collectAllPages(tabId) {
  const result = [];
  const seenUrls = new Set();

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const extraction = await sendMessageToTab(tabId, { type: "EXTRACT_VISIBLE" });
    if (!extraction?.ok) {
      throw new Error(`페이지 ${page} 추출 실패`);
    }

    const items = extraction.items || [];
    result.push(...items);

    const currentUrl = extraction.pageUrl;
    if (seenUrls.has(currentUrl)) {
      break;
    }
    seenUrls.add(currentUrl);

    const next = await sendMessageToTab(tabId, { type: "GO_NEXT_PAGE" });
    if (!next?.ok || !next.moved) {
      break;
    }

    await sleep(PAGE_WAIT_MS);
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
      const rawItems =
        scopeMode === "all" ? await collectAllPages(tabId) : await collectVisible(tabId);

      const uniqueItems = dedupe(rawItems);
      const normalizedItems = normalize(uniqueItems);

      await postToWebhook(webhookUrl, {
        source: "ggi-extension",
        scopeMode,
        sentAt: new Date().toISOString(),
        totalCount: rawItems.length,
        uniqueCount: uniqueItems.length,
        items: normalizedItems,
        rawItems
      });

      sendResponse({
        ok: true,
        totalCount: rawItems.length,
        uniqueCount: uniqueItems.length,
        sentCount: normalizedItems.length
      });
    } catch (error) {
      sendResponse({ ok: false, error: error.message });
    }
  })();

  return true;
});
