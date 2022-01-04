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
    },
    crops: {
        images: {},
        times: {},
    },
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
        return await buyItem(inventory, item, parseInt(respText, 10), retry+1)
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

const getCropImagesFromPanelCrops = page => {
    const parser = new DOMParser()
    const dom = parser.parseFromString(page, "text/html")
    const images = {}
    for (const elm of dom.querySelectorAll(".cropitem")) {
        images[elm.dataset.pb.substr(1)] = elm.getAttribute("src")
    }
    return images
}

const getCropTimesFromFarmStatus = page => {
    const now = Date.now()
    const times = {}
    // 11-39-147;12-39-147;13-39-147;14-39-147;21-39-147;
    for (const part of page.split(";")) {
        if (page === "") {
            continue
        }
        const segments = part.split("-", 3)
        const secondsLeft = segments[2] == "" ? 0 : parseInt(segments[2], 10)
        times[segments[0]] = now + (secondsLeft * 1000)
    }
    return times
}

const renderSidebar = state => {
    // Generate the crop statusbar HTML.
    let soonestPosition = null
    let soonestTime = null
    for (const [pos, time] of Object.entries(state.crops.times)) {
        if (soonestTime === null || time < soonestTime) {
            soonestTime = time
            soonestPosition = pos
        }
    }
    let cropHtml = ""
    if (soonestPosition === null) {
        cropHtml = `
            <img class="farmrpg-ext-status-cropimg" src="/img/items/item.png">
            <span>Unknown</span>
        `
    } else {
        let timeLeft = Math.ceil((soonestTime - Date.now()) / 60000)
        let timeLeftUnits = "m"
        if (timeLeft >= 90) {
            timeLeft = Math.ceil(timeLeft / 60)
            timeLeftUnits = "h"
        }
        if (timeLeft <= 0) {
            timeLeft = "READY"
            timeLeftUnits = ""
        }
        cropHtml = `
            <img class="farmrpg-ext-status-cropimg" src="${state.crops.images[soonestPosition] || "/img/items/item.png"}">
            <span class="${timeLeft === "READY" ? "farmrpg-ext-crop-done" : ""}">${timeLeft}${timeLeftUnits}</span>
        `
    }
    cropHtml = `
        <div class="farmrpg-ext-crop" data-farmrpgextsidebarclick="farm">
            ${cropHtml}
        </div>
    `
    // Generate the perks statusbar HTML.
    let perkIcon = "/img/items/item.png"
    if (state.perksetLoading) {
        perkIcon = browser.runtime.getURL("images/spinner.png")
    } else if (state.perksetId === "2735") {
        perkIcon = "/img/items/5868.png"
    } else if (state.perksetId === "2734") {
        perkIcon = "/img/items/6137.png?1"
    }
    const perkHtml = `
        <div class="farmrpg-ext-perk" data-farmrpgextsidebarclick="perk">
            <img src="${perkIcon}">
        </div>
    `
    // Generate the items HTML.
    const fragments = sidebarConfig.map(sidebarItem => {
        const invItem = state.inventory.items[sidebarItem.name]
        const isMax = sidebarItem.buy ? (!invItem || invItem.quantity <= 10) : (invItem && invItem.quantity >= state.inventory.max)
        return `
            <div class="farmrpg-ext-item ${isMax ? "farmrpg-ext-max" : ""} ${sidebarItem.buy ? "farmrpg-ext-buy" : ""}" data-farmrpgextsidebarclick="item:${sidebarItem.name}">
                <div class="farmrpg-ext-image">
                    <img src="${invItem ? invItem.image || sidebarItem.image : sidebarItem.image}" />
                </div>
                <div class="farmrpg-ext-quantity">
                    ${invItem ? invItem.quantity : 0}
                </div>
            </div>
        `
    })
    // Make the overall HTML.
    const html = `
        <div class="farmrpg-ext-status">${cropHtml}${perkHtml}</div>
        <div class="farmrpg-ext-items">${fragments.join("")}</div>
    `
    // Ship it over to the content script for injection.
    globalState.port.postMessage({ action: "UPDATE_SIDEBAR", html })
}

const renderSidebarFromGlobalState = () => renderSidebar(globalState)

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

            callback(page, details.url)
        };
    }

    browser.webRequest.onBeforeRequest.addListener(
        listener,
        { urls: [url] },
        ["blocking"] // We aren't blocking anything but it's required for the filter API.
    )
}

const handleSidbarClick = async target => {
    console.log("sidebar click", target)
    const [targetType, targetArg] = target.split(":", 2)
    switch (targetType) {
    case "item":
        if (targetArg === "Iron" || targetArg === "Nails") {
            globalState.inventory= await buyItem(globalState.inventory, targetArg).
            renderSidebarFromGlobalState()
            globalState.port.postMessage({ action: "RELOAD_VIEW", url: "workshop.php"})
        }
        break
    case "farm":
        if (globalState.farmId) {
            globalState.port.postMessage({ action: "RELOAD_VIEW", url: `xfarm.php?id=${globalState.farmId}`})
        } else {
            console.log("Can't navigate to farm without Farm ID")
        }
        break
    case "perk":
        globalState.perksetLoading = true
        renderSidebarFromGlobalState()
        const nextPerksetId = globalState.perksetId === "2735" ? "2734" : "2735"
        let resp = await fetch("https://farmrpg.com/worker.php?go=resetperks", {method: "POST"})
        if (!resp.ok) {
            throw "Error reseting perks"
        }
        resp = await fetch(`https://farmrpg.com/worker.php?go=activateperkset&id=${nextPerksetId}`, {method: "POST"})
        if (!resp.ok) {
            throw "Error activating perkset"
        }
        globalState.perksetId = nextPerksetId
        globalState.perksetLoading = false
        renderSidebarFromGlobalState()
        break
    }
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
                    handleSidbarClick(msg.target)
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
    renderSidebarFromGlobalState()

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
        renderSidebarFromGlobalState()
    })
    setupPageFilter("https://farmrpg.com/workshop.php", page => {
        globalState.inventory = getInventoryFromWorkshopHTML(page, globalState.inventory)
        renderSidebarFromGlobalState()
    })
    setupPageFilter("https://farmrpg.com/panel_crops.php?*", page => {
        globalState.crops.images = getCropImagesFromPanelCrops(page)
        renderSidebarFromGlobalState()
    })
    setupPageFilter("https://farmrpg.com/worker.php?*go=farmstatus*", (page, url) => {
        // Parse the farm ID from the URL.
        const urlMatch = url.match(itemLinkRE)
        if (urlMatch) {
            globalState.farmId = urlMatch[1]
        }
        globalState.crops.times = getCropTimesFromFarmStatus(page)
        renderSidebarFromGlobalState()
    })

    // Set up a periodic refresh of the inventory.
    // browser.alarms.create("inventory-refresh", {periodInMinutes: 5})
    // browser.alarms.create("render-sidebar", {periodInMinutes: 1})
    browser.alarms.onAlarm.addListener(async alarm => {
        switch (alarm.name) {
        case "inventory-refresh":
            globalState.inventory = await getInventory()
            renderSidebarFromGlobalState()
            break
        case "render-sidebar":
            renderSidebarFromGlobalState()
            break
        }
    })
}

main()
