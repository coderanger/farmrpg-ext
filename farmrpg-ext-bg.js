import ItemDB from './lib/itemdb.js'
import { renderSidebarFromGlobalState } from './lib/sidebar.js'
import { setupExplore } from './lib/explore.js'
import { setupPageFilter } from './lib/pageFilter.js'
import syncFixtures from './lib/fixtures/index.js'

const maxInventoryRE = /more than <strong>([0-9,]+)<\/strong> of any/
const itemLinkRE = /id=(\d+)/
const workshopTitleRE = /\s*(\S.*\S)\s+\((\d+)\)/
const workshopIngredientRE = /(\d+)\s*\/\s*\d+\s*(\S.*?\S)\s*$/mg

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

const getPerksetId = async () => {
    const resp = await fetch("https://farmrpg.com/perks.php")
    if (!resp.ok) {
        throw "Error getting perks"
    }
    const page = await resp.text()
    return getPerksetIdFromPerks(page)
}

const getPerksetIdFromPerks = page => {
    const parser = new DOMParser()
    const dom = parser.parseFromString(page, "text/html")
    const activeSet = dom.querySelector('div[style="color:teal;font-weight:bold"]')
    if (!activeSet) {
        return null
    }
    return activeSet.parentElement.querySelector(".activateperksetbtn").dataset.id
}

const handleSidbarClick = async target => {
    console.log("sidebar click", target)
    const [targetType, targetArg] = target.split(":", 2)
    switch (targetType) {
    case "item":
        if (targetArg === "Iron" || targetArg === "Nails") {
            globalState.inventory= await buyItem(globalState.inventory, targetArg)
            await renderSidebarFromGlobalState()
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
        await renderSidebarFromGlobalState()
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
        await renderSidebarFromGlobalState()
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
    window.globalState = globalState
    await connectToContentScript()

    // A debugging helper to quickly clear the idb state.
    window.resetdb = async () => {
        if (globalState.db) {
            globalState.db.close()
        }
        await idb.deleteDB("farmrpg-ext")
    }

    // Initialize the database.
    globalState.db = await idb.openDB("farmrpg-ext", 1, {
        upgrade(db) {
            console.log("Running DB migrations")
            db.createObjectStore("log", { keyPath: "id", autoIncrement: true })
            const items = db.createObjectStore("items", { keyPath: "name" })
            items.createIndex("byImage", "image", {unique: false})
            items.createIndex("byID", "id", {unique: true})
            const zones = db.createObjectStore("zones", { keyPath: "name" })
            zones.createIndex("byID", "id", {unique: true})
        },
    })
    await syncFixtures(globalState.db)
    globalState.items = new ItemDB(globalState.db)

    // Kick off some initial data population.
    getInventory().then(inv => {
        globalState.inventory = inv
        renderSidebarFromGlobalState()
    })
    getPerksetId().then(perksetId => {
        console.log("Found initial perksetId", perksetId)
        globalState.perksetId = perksetId
        renderSidebarFromGlobalState()
    })

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
    setupPageFilter("https://farmrpg.com/inventory.php", async page => {
        globalState.inventory = getInventoryFromInventoryHTML(page)
        for (const item in globalState.inventory.items) {
            await globalState.items.learn(globalState.inventory.items[item])
        }
        await renderSidebarFromGlobalState()
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
        globalState.crops.hasData = true
        renderSidebarFromGlobalState()
    })
    setupPageFilter("https://farmrpg.com/worker.php?go=activateperkset*", (page, url) => {
        const urlMatch = url.match(itemLinkRE)
        if (urlMatch) {
            globalState.perksetId = urlMatch[1]
            renderSidebarFromGlobalState()
        }
    })
    setupExplore(globalState)

    // Set up a periodic refresh of the inventory.
    browser.alarms.create("inventory-refresh", {periodInMinutes: 5})
    browser.alarms.create("perk-refresh", {periodInMinutes: 15})
    browser.alarms.create("render-sidebar", {periodInMinutes: 1})
    browser.alarms.onAlarm.addListener(async alarm => {
        switch (alarm.name) {
        case "inventory-refresh":
            globalState.inventory = await getInventory()
            await renderSidebarFromGlobalState()
            break
        case "perk-refresh":
            globalState.perksetId = await getPerksetId()
            await renderSidebarFromGlobalState()
            break
        case "render-sidebar":
            await renderSidebarFromGlobalState()
            break
        }
    })
}

main()
