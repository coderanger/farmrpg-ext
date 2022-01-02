const maxInventoryRE = /more than <strong>([0-9,]+)<\/strong> of any/
const itemLinkRE = /id=(\d+)/
const workshopTitleRE = /\s*(\S.*\S)\s+\((\d+)\)/
const workshopIngredientRE = /(\d+)\s*\/\s*\d+\s*(\S.*?\S)\s*$/mg

const sidebarConfig = [
    { name: "Nails", buy: true, image: "/img/items/5860.png" },
    { name: "Iron", buy: true, image: "/img/items/5779.PNG" },
    { name: "Wood", image: "/img/items/6143.PNG" },
    { name: "Board", image: "/img/items/5885.png" },
    { name: "Straw", image: "/img/items/5908.png" },
    { name: "Stone", image: "/img/items/6174.PNG" },
]

const globalState = {
    inventory: {
        items: [],
    }
}

const buyItem = async (inventory, item, quantity = undefined, retry=0) => {
    // POST https://farmrpg.com/worker.php?go=buyitem&id=22&qty=1
    // success
    if (!inventory.items[item] || inventory.items[item].id == undefined) {
        throw `Unknown item ${item}`
    }
    if (quantity == undefined || (inventory.items[item].quantity + quantity) > inventory.max) {
        quantity = inventory.max - inventory.items[item].quantity
    }
    console.log("buying items", item, quantity)
    if (quantity <= 0) {
        // No need to buy anything, already maxed.
        return inventory
    }
    const resp = await fetch(`https://farmrpg.com/worker.php?go=buyitem&id=${inventory.items[item].id}&qty=${quantity}`, {method: "POST"})
    if (!resp.ok) {
        throw "Error buying items"
    }
    const respText = await resp.text()
    if (respText == "success") {
        const newInventory = JSON.parse(JSON.stringify(inventory))
        newInventory.items[item].quantity += quantity
        return newInventory
    } else if (respText.match(/^\s*\d+\s*$/)) {
        // Try again.
        if(retry >= 3) {
            throw "Too many retries on buying"
        }
        await new Promise(r => setTimeout(r, 1000))
        return await buyItem(inventory, item, quantity, retry+1)
    } else {
        console.error("error while buying items", respText)
        return inventory
    }
}

const getInventory = async () => {
    // Get the inventory HTML.
    const invResp = await fetch("https://farmrpg.com/inventory.php")
    if (!invResp.ok) {
        throw "Error getting inventory"
    }
    const invPage = await invResp.text()
    return getInventoryFromInventoryHTML(invPage)
}

const getInventoryFromInventoryHTML = (invPage) => {
    // Parse out the max inventory size.
    const maxInvMatch = invPage.match(maxInventoryRE)
    if (!maxInvMatch) {
        throw "Error parsing max inventory"
    }
    const maxInv = parseInt(maxInvMatch[1].replaceAll(",", ""), 10)
    // Parse out all the items.
    const parser = new DOMParser()
    const invDom = parser.parseFromString(invPage, "text/html")
    const items = {}
    for (const itemElm of invDom.querySelectorAll('.list-group li')) {
        // Ignore dividers.
        if (itemElm.classList.contains("item-divider")) {
            continue
        }

        const title = itemElm.querySelector(".item-title strong")
        if (!title) {
            console.log("Unable to parse item name from ", itemElm)
            continue
        }
        const after = itemElm.querySelector('.item-after')
        if (!after) {
            console.log("Unable to parse item quantity from ", itemElm)
            continue
        }
        const link = itemElm.querySelector("a.item-link")
        if (!link) {
            console.log("Unable to parse item ID from ", itemElm)
            continue
        }
        const linkMatch = link.getAttribute("href").match(itemLinkRE)
        if (!linkMatch) {
            console.log("Unable to parse item ID from link ", link.getAttribute("href"))
            continue
        }
        items[title.textContent] = {
            "name": title.textContent,
            "id": linkMatch[1],
            "quantity": parseInt(after.textContent, 10),
            "image": itemElm.querySelector(".item-media img").getAttribute("src"),
        }
    }
    return { "max": maxInv, "items": items }
}

const getInventoryFromWorkshopHTML = (workshopPage, existingInventory) => {
    // Don't mutate the old inventory.
    const inventory = JSON.parse(JSON.stringify(existingInventory))
    // Parse the page. Yeah it's a bit silly since it will get parsed again by the browser but this is easier.
    const parser = new DOMParser()
    const workshopDom = parser.parseFromString(workshopPage, "text/html")
    for (const itemElm of workshopDom.querySelectorAll('.list-block li.close-panel')) {
        // Look at the title of each section for data.
        const titleStrong = itemElm.querySelector('.item-title strong')
        if (!titleStrong) {
            console.error("Unable to parse workshop title from ", itemElm)
            continue
        }
        const titleMatch = titleStrong.innerText.match(workshopTitleRE)
        if (!titleMatch) {
            console.error("Unable to parse workshop name/quantity from title ", titleStrong.innerText)
            continue
        }
        const mainName = titleMatch[1]
        if (inventory.items[mainName] === undefined) {
            inventory.items[mainName] = {name: mainName}
        }
        inventory.items[mainName].quantity = parseInt(titleMatch[1], 10)
        // Try to get the ID and image too.
        const link = itemElm.querySelector(".item-media a")
        const image = itemElm.querySelector(".item-media img")
        if (!link || !image) {
            console.error("Unable to parse workshop link or image from ", itemElm)
            continue
        }
        const linkMatch = link.getAttribute("href").match(itemLinkRE)
        if (!linkMatch) {
            console.log("Unable to parse item ID from workshop link ", link.getAttribute("href"))
            continue
        }
        inventory.items[mainName].id = linkMatch[1]
        inventory.items[mainName].image = image.getAttribute("src")
        // Parse the ingredients to try and get at least some quantities.
        const title = itemElm.querySelector('.item-title')
        title.innerHTML = title.innerHTML.replaceAll("<br>", "\n")
        for (const ingMatch of title.innerText.matchAll(workshopIngredientRE)) {
            const ingName = ingMatch[2]
            if (inventory.items[ingName] === undefined) {
                inventory.items[ingName] = {name: ingName}
            }
            inventory.items[ingName].quantity = parseInt(ingMatch[1], 10)
        }
    }

    return inventory
}

const renderSidebar = (inventory) => {
    // Generate the HTML.
    const fragments = sidebarConfig.map(sidebarItem => {
        const invItem = inventory.items[sidebarItem.name]
        const isMax = sidebarItem.buy ? (!invItem || invItem.quantity <= 10) : (invItem && invItem.quantity >= inventory.max)
        return `
            <div class="farmrpg-ext-item ${isMax ? "farmrpg-ext-max" : ""} ${sidebarItem.buy ? "farmrpg-ext-buy" : ""}" data-farmrpgextsidebarclick="item:${sidebarItem.name}">
                <div class="farmrpg-ext-image">
                    <img src="${invItem ? invItem.image : sidebarItem.image}" />
                </div>
                <div class="farmrpg-ext-quantity">
                    ${invItem ? invItem.quantity : 0}
                </div>
            </div>
        `
    })
    // Ship it over to the content script for injection.
    globalState.port.postMessage({ action: "UPDATE_SIDEBAR", html: fragments.join("") })
}

const setupPageFilter = (url, callback) => {
    const listener = details => {
        if (details.originUrl.startsWith("moz-extension://")) {
            return
        }
        const filter = browser.webRequest.filterResponseData(details.requestId)
        const decoder = new TextDecoder("utf-8")

        // Capture the page XHRs for processing.
        const data = []
        filter.ondata = event => {
            data.push(event.data)
            filter.write(event.data)
        }

        // Request is done, let it complete and then run the callback
        filter.onstop = () => {
            let page = ""
            for (const buffer of data) {
                page += decoder.decode(buffer, { stream: true })
            }
            page += decoder.decode() // end-of-stream
            filter.close()

            callback(page)
        };
    }

    browser.webRequest.onBeforeRequest.addListener(
        listener,
        { urls: [url] },
        ["blocking"] // We aren't blocking anything but it's required for the filter API.
    )
}

const connectToContentScript = () =>
    new Promise(resolve =>
        browser.runtime.onConnect.addListener(port => {
            globalState.port = port
            globalState.port.onDisconnect.addListener(disPort => {
                if (globalState.port === disPort) {
                    globalState.port = null
                }
            })
            globalState.port.onMessage.addListener(msg => {
                switch (msg.action) {
                case "SIDEBAR_CLICK":
                    console.log("sidebar click", msg.target)
                    if (msg.target.startsWith("item:")) {
                        const item = msg.target.substr(5)
                        if (item === "Iron" || item === "Nails") {
                            buyItem(globalState.inventory, item).then(inv => {
                                globalState.inventory = inv
                                renderSidebar(globalState.inventory)
                                globalState.port.postMessage({ action: "RELOAD_VIEW", url: "workshop.php"})
                            })
                        }
                    }
                    break
                }
            })
            if (resolve) {
                resolve(port)
                resolve = null
            }
        })
    )

const main = async () => {
    console.log("FarmRPG-Ext loaded (background)!")
    await connectToContentScript()
    globalState.inventory = await getInventory()
    renderSidebar(globalState.inventory)

    // Munge outgoing requests to fix the origin and referer headers.
    browser.webRequest.onBeforeSendHeaders.addListener(
        details => {
            if (!details.originUrl.startsWith(`moz-extension://`)) {
                return
            }
            let sawReferer = false
            for(const header of details.requestHeaders) {
                if (header.name.toLowerCase() === "origin") {
                    header.value = "https://farmrpg.com"
                } else if (header.name.toLowerCase() === "referer") {
                    header.value = "https://farmrpg.com/index.php"
                    sawReferer = true
                }
            }
            if (!sawReferer) {
                details.requestHeaders.push({name: "Referer", value: "https://farmrpg.com/index.php"})
            }
            return {requestHeaders: details.requestHeaders}
        },
        { urls: ["*://*.farmrpg.com/*"] },
        ["blocking", "requestHeaders"]
    )

    // Setup page filters for data capture.
    setupPageFilter("https://farmrpg.com/inventory.php", page => {
        globalState.inventory = getInventoryFromInventoryHTML(page)
        renderSidebar(globalState.inventory)
    })
    setupPageFilter("https://farmrpg.com/workshop.php", page => {
        globalState.inventory = getInventoryFromWorkshopHTML(page, globalState.inventory)
        renderSidebar(globalState.inventory)
    })

    // Set up a periodic refresh of the inventory.
    browser.alarms.create("inventory-refresh", {periodInMinutes: 1})
    browser.alarms.onAlarm.addListener(async alarm => {
        switch (alarm.name) {
        case "inventory-refresh":
            globalState.inventory = await getInventory()
            renderSidebar(globalState.inventory)
            break
        }
    })
}

main()
