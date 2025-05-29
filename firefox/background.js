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
            browser.storage.local.set({
                openedUrls: body.urls
            }).then(() => {});
            body.urls.forEach(url => {
                browser.tabs.create({
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
    browser.storage.local.get("currentUser").then(result => {
        if (!result.currentUser) {
            browser.tabs.create({
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
    browser.storage.local.get("currentUser").then(result => {
        if (!result.currentUser) {
            browser.scripting.executeScript({
                target: { tabId: detail.tabId },
                func: () => {
                    const element = document.querySelector("#real_player_name");
                    return element?.innerText || "Not found";
                }
            }).then(results => {
                const text = results[0].result;
                browser.storage.local.set({
                    currentUser: text
                }).then(() => {
                    console.log("Current user set to: " + text);
                    browser.tabs.remove(detail.tabId);
                }).catch(error => {
                    console.error(`Error setting current user: ${error}`);
                    browser.tabs.remove(detail.tabId);
                })
            });
        } else {
            checkCooldown(result.currentUser);
        }
    })
}

async function processLogs(detail) {
    console.log("Processing logs for URL:", detail.url);
    const match = detail.url.match(/=(\d+)/);
    if (match) {
        const table_id = match[1];
        console.log("Extracted table_id:", table_id);
        const filter = browser.webRequest.filterResponseData(detail.requestId);
        let decoder = new TextDecoder("utf-8");
        let log = "";
        filter.ondata = event => {
            let str = decoder.decode(event.data, { stream: true });
            log += str;
            filter.write(event.data);
        };

        filter.onstop = async () => {
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
            filter.disconnect();
        };
    }
}

function startCollection(tab) {
    browser.storage.local.get("isRunning").then(result => {
        if (result.isRunning) {
            console.log("Stopping collection");
            browser.alarms.clear("main");
            browser.storage.local.set({ isRunning: false });
            browser.action.setBadgeText({ text: "OFF" });
        } else {
            console.log("Starting collection");
            browser.storage.local.set({ isRunning: true });
            browser.alarms.create("main", { periodInMinutes: 5 });
            browser.action.setBadgeText({ text: "ON" });
        }
    })
}

function closeTab(detail) {
    browser.storage.local.get("openedUrls").then(result => {
        if (result.openedUrls && result.openedUrls.includes(detail.url)) {
            console.log("Closing tab for URL:", detail.url);
            browser.tabs.remove(detail.tabId);
        }
    });
}


browser.webNavigation.onCompleted.addListener(
    setCurrentUser,
    { url: [{ urlMatches: "https://boardgamearena.com/player" }] },
);


browser.webRequest.onBeforeRequest.addListener(
    processLogs,
    { urls: ["https://boardgamearena.com/archive/archive/logs.html*"] },
    ["blocking"]
);

browser.webNavigation.onCompleted.addListener(
    closeTab,
    { url: [{ urlMatches: "https://boardgamearena.com/gamereview*" }] },
);

browser.action.onClicked.addListener(startCollection);
browser.alarms.onAlarm.addListener(main);