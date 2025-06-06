async function checkCooldown(user) {
    try {
        const response = await fetch("https://ark-nova-725889947830.us-central1.run.app", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                type: "check_cooldown",
                user: user,
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.result) {
            const url_response = await fetch("https://ark-nova-725889947830.us-central1.run.app", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    type: "get_urls",
                    user: user,
                })
            });

            if (!url_response.ok) {
                throw new Error(`HTTP ${url_response.status}: ${url_response.statusText}`);
            }

            const body = await url_response.json();
            console.log("URLs to open:", body.urls);
            chrome.storage.local.set({
                openedUrls: body.urls
            }).then(() => { });
            body.urls.forEach(url => {
                chrome.tabs.create({
                    "url": url,
                    "active": false
                });
            })
        }
    } catch (err) {
        console.error("API request failed:", err);
    }
}

function main(alarmInfo) {
    if (alarmInfo.name !== "main") {
        return;
    }
    chrome.storage.local.get("currentUser").then(result => {
        if (!result.currentUser) {
            chrome.tabs.create({
                "url": "https://boardgamearena.com/player",
                "active": false
            });
        } else {
            checkCooldown(result.currentUser);
        }
    })
}

function setCurrentUser(detail) {
    if (detail.url !== "https://boardgamearena.com/player") {
        return;
    }
    chrome.storage.local.get("currentUser").then(result => {
        if (!result.currentUser) {
            console.log("Setting current user for URL:", detail.url);
            chrome.scripting.executeScript({
                target: { tabId: detail.tabId },
                func: () => {
                    element = document.querySelector("#real_player_name");
                    return element?.innerText || "Not found";
                }
            }).then(results => {
                const text = results[0].result;
                chrome.storage.local.set({
                    currentUser: text
                }).then(() => {
                    console.log("Current user set to: " + text);
                    chrome.tabs.remove(detail.tabId);
                }).catch(error => {
                    console.error(`Error setting current user: ${error}`);
                    chrome.tabs.remove(detail.tabId);
                })
            });
        } else {
            return;
        }
    })
}

async function processLogs(detail) {
    console.log("Processing logs for URL:", detail.url);
    const match = detail.url.match(/=(\d+)/);
    let headers = {}
    detail.requestHeaders.forEach(header => {
        headers[header.name.toLowerCase()] = header.value;
    });
    if (headers["stop"] == "true") {
        return;
    }
    headers["stop"] = "true";
    console.log(headers);
    
    const response = await fetch(detail.url, {
        method: "GET",
        headers: headers,
        credentials: "include" // helps ensure cookies are used if possible
    });

    const log = await response.text();
    if (match) {
        const table_id = match[1];
        console.log("Extracted table_id:", table_id);
        try {
            const response = await fetch("https://ark-nova-725889947830.us-central1.run.app", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    type: "generate_upload_url",
                    table_id: table_id,
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            if (log.length > 1000) {
                const res = await fetch(data.url, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "text/plain"
                    },
                    body: log
                });

                if (res.ok) {
                    console.log("File uploaded successfully");
                } else {
                    console.error("Upload failed:", res.status, await res.text());
                }
            }
        } catch (err) {
            console.error("API request failed:", err);
        }
    }
}

function startCollection(tab) {
    chrome.storage.local.get("isRunning").then(result => {
        if (result.isRunning) {
            console.log("Stopping collection");
            chrome.alarms.clear("main");
            chrome.storage.local.set({ isRunning: false });
            chrome.action.setBadgeText({ text: "OFF" });
        } else {
            console.log("Starting collection");
            chrome.storage.local.set({ isRunning: true });
            chrome.alarms.create("main", { periodInMinutes: 5 });
            chrome.action.setBadgeText({ text: "ON" });
        }
    })
}

async function closeTab(detail) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    chrome.storage.local.get("openedUrls").then(result => {
        if (result.openedUrls && result.openedUrls.includes(detail.url)) {
            console.log("Closing tab for URL:", detail.url);
            chrome.tabs.remove(detail.tabId);
        }
    });
}

chrome.webNavigation.onCompleted.addListener(
    setCurrentUser,
    { url: [{ urlMatches: "https://boardgamearena.com/player" }] },
);

chrome.webNavigation.onCompleted.addListener(
    main,
    { url: [{ urlMatches: "https://boardgamearena.com/*" }] },
);

chrome.webRequest.onSendHeaders.addListener(
    processLogs,
    { urls: ["https://boardgamearena.com/archive/archive*"] },
    ["requestHeaders"]
);

chrome.webNavigation.onCompleted.addListener(
    closeTab,
    { url: [{ urlMatches: "https://boardgamearena.com/gamereview*" }] },
)

chrome.action.onClicked.addListener(startCollection);
chrome.alarms.onAlarm.addListener(main);
