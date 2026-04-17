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

function emitProgress(progress) {
  chrome.runtime.sendMessage({ type: "CRAWL_PROGRESS", ...progress }).catch(() => {});
}

async function injectContentScripts(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["parser.js", "content.js"]
  });
}

function sendMessage(tabId, message) {
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

async function sendMessageToTab(tabId, message) {
  try {
    return await sendMessage(tabId, message);
  } catch (error) {
    if (!/Receiving end does not exist/i.test(error.message)) {
      throw error;
    }

    await injectContentScripts(tabId);
    return sendMessage(tabId, message);
  }
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
  emitProgress({
    pageNumber: extraction.pageNumber,
    validCount: extraction.items.length,
    uniqueCount: extraction.items.length,
    status: "수집"
  });
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

    const uniqueCount = dedupe(result).length;
    emitProgress({
      pageNumber: extraction.pageNumber || page,
      validCount: extraction.items.length,
      uniqueCount,
      status: "수집"
    });

    const next = await sendMessageToTab(tabId, { type: "GO_NEXT_PAGE" });
    if (!next?.ok || !next.moved) {
      emitProgress({
        pageNumber: extraction.pageNumber || page,
        validCount: extraction.items.length,
        uniqueCount,
        status: "완료"
      });
      break;
    }

    const movedExtraction = await waitForPageChange(tabId, extraction);
    if (getPageSignature(movedExtraction) === signature) {
      emitProgress({
        pageNumber: extraction.pageNumber || page,
        validCount: extraction.items.length,
        uniqueCount,
        status: "페이지 이동 실패"
      });
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

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) {
    return;
  }

  await chrome.sidePanel.open({ tabId: tab.id });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "START_CRAWL") {
    return false;
  }

  const { tabId, webhookUrl, scopeMode } = message;

  (async () => {
    try {
      const rawItems = scopeMode === "all" ? await collectAllPages(tabId) : await collectVisible(tabId);
      const uniqueItems = dedupe(rawItems);

      emitProgress({
        pageNumber: null,
        validCount: rawItems.length,
        uniqueCount: uniqueItems.length,
        status: "전송중"
      });

      await postToWebhook(webhookUrl, {
        source: "ggi-extension",
        scopeMode,
        sentAt: new Date().toISOString(),
        totalCount: rawItems.length,
        uniqueCount: uniqueItems.length,
        items: uniqueItems,
        rawItems
      });

      emitProgress({
        pageNumber: null,
        validCount: rawItems.length,
        uniqueCount: uniqueItems.length,
        status: "완료"
      });

      sendResponse({
        ok: true,
        totalCount: rawItems.length,
        uniqueCount: uniqueItems.length,
        sentCount: uniqueItems.length
      });
    } catch (error) {
      emitProgress({ pageNumber: null, validCount: 0, uniqueCount: 0, status: `실패: ${error.message}` });
      sendResponse({ ok: false, error: error.message });
    }
  })();

  return true;
});
