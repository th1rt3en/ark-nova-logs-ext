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
            }).then(() => {});
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

function main(detail) {
    if (detail.url !== "https://boardgamearena.com/player" && !detail.url.startsWith("https://boardgamearena.com/gamereview")) {
        let getting = chrome.storage.local.get("currentUser");
        getting.then(result => {
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
}

function setCurrentUser(detail) {
    chrome.scripting.executeScript({
        target: { tabId: detail.tabId },
        func: () => {
            const element = document.querySelector("#real_player_name");
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
}

async function processLogs(detail) {
    console.log("Processing logs for URL:", detail.url);
    const match = detail.url.match(/=(\d+)/);
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

            chrome.scripting.executeScript({
                target: { tabId: detail.tabId },
                func: async () => {
                    const delay = ms => new Promise(res => setTimeout(res, ms));
                    while (!document.querySelector("#gamelogs")) {
                        await delay(1000);
                    }
                    let element = document.querySelector("#gamelogs");
                    while (element.innerText.length < 1000) {
                        await delay(1000);
                        element = document.querySelector("#gamelogs");
                    }
                    return element?.innerText || "Not found";
                }
            }).then(async results => {
                const log = results[0].result;
                console.log("Extracted log:", log);
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
                chrome.storage.local.get("openedUrls").then(result => {
                    if (result.openedUrls && result.openedUrls.includes(detail.url)) {
                        chrome.tabs.remove(detail.tabId);
                    }
                })
            });
        } catch (err) {
            console.error("API request failed:", err);
        }
    }
}

chrome.webNavigation.onCompleted.addListener(
    setCurrentUser,
    { url: [{ urlMatches: "https://boardgamearena.com/player" }] },
);

chrome.webNavigation.onCompleted.addListener(
    main,
    { url: [{ urlMatches: "https://boardgamearena.com/*" }] },
);

chrome.webNavigation.onDOMContentLoaded.addListener(
    processLogs,
    { url: [{ urlMatches: "https://boardgamearena.com/gamereview*" }] },
);