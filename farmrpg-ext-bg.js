import { renderSidebar, renderSidebarFromGlobalState } from './lib/sidebar.js'
import { setupExplore } from './lib/explore.js'
import { RequestInterceptor } from './lib/pageFilter.js'
import syncFixtures from './lib/fixtures.js'
import { setupLog } from './lib/log.js'
import { setupLocations } from './lib/locations.js'
import { setupFishing } from './lib/fishing.js'
import { setupItems } from './lib/item.js'
import { fetchInventory, setupInventory } from './lib/inventory.js'
import { setupPets } from './lib/pets.js'
import { setupPlayer } from './lib/player.js'
import { setupFarm } from './lib/farm.js'
import { setupPerks, fetchPerks } from './lib/perks.js'
import { setupOrchard } from './lib/orchard.js'
import { setupWheel } from './lib/wheel.js'
import { setupWorkshop } from './lib/workshop.js'
import { setupAnimals } from './lib/animals.js'
import { setupSettings } from './lib/settings.js'
import { setupLocksmith } from './lib/locksmith.js'
import { setupProduction } from './lib/production.js'
import { setupVineyard } from './lib/vineyard.js'
import { setupQuests } from './lib/quests.js'
import { fetchEmblems, setupEmblems } from './lib/emblems.js'
import { fetchCommunityCenter, setupCommunityCenter } from './lib/communityCenter.js'
import { setupBorgens } from './lib/borgen.js'
import { fetchExchangeCenter, setupExchangeCenter } from './lib/exchange.js'

/**
 * @typedef {{
 *  db: idb.DB
 * }} GlobalState
 */
class GlobalState {
    constructor() {
        this.requestInterceptor = new RequestInterceptor(this.logLatency.bind(this))
        this.ports = []
        this.clickHandlers = {}
        this.postMessageHandlers = {}
    }

    addPageHandler(pageName, handler, options = {}) {
        this.requestInterceptor.addPageHandler(pageName, async (page, url, parsedUrl) => {
            if (options.parse) {
                const parser = new DOMParser()
                page = parser.parseFromString(page, "text/html")
                url = parsedUrl
            }
            await handler(this, page, url, parsedUrl)
            await renderSidebar(this)
        })
    }

    addBeforePageHandler(pageName, handler) {
        this.requestInterceptor.addBeforePageHandler(pageName, parsedUrl => handler(this, parsedUrl))
    }

    addWorkerHandler(workerGo, handler, options = {}) {
        this.requestInterceptor.addWorkerHandler(workerGo, async (page, url, parsedUrl) => {
            if (options.parse) {
                const parser = new DOMParser()
                page = parser.parseFromString(page, "text/html")
                url = parsedUrl
            }
            await handler(this, page, url, parsedUrl)
            await renderSidebar(this)
        })
    }

    addBeforeWorkerHandler(workerGo, handler) {
        this.requestInterceptor.addBeforeWorkerHandler(workerGo, parsedUrl => handler(this, parsedUrl))
    }

    addClickHandler(type, handler) {
        this.clickHandlers[type] = handler
    }

    addPostMessageHandler(type, handler) {
        this.postMessageHandlers[type] = handler
    }

    postMessage(msg) {
        let lastError = null
        for (const port of [...this.ports]) {
            try {
                port.postMessage(msg)
            } catch(e) {
                console.error(e)
                lastError = e
                // Remove this port.
                port.disconnect() // Just in case?
                const i = this.ports.indexOf(port)
                if (i !== -1) {
                    this.ports.splice(i, 1)
                }
                // Keep trying the other ports.
            }
        }
        if (lastError !== null) {
            throw lastError
        }
    }

    /**
     * Log a latency recording.
     * @param {number} ts
     * @param {string} url
     * @param {number} latency
     */
    async logLatency(ts, url, latency) {
        if (this.db !== undefined) {
            await this.db.put("latency", {ts, url, latency})
        }
    }

    /**
     * Helper for other fetch* methods.
     * @param {string} url
     * @param {(state: GlobalState, page: string | Document, url: string | URL) => Promise<void>} handler
     * @param {{parse: boolean}} options
     */
    async fetchPage(url, handler, options = {}) {
        const resp = await fetch(url)
        if (!resp.ok) {
            throw `Error getting ${url}`
        }
        let page = await resp.text()
        if (options.parse) {
            const parser = new DOMParser()
            const dom = parser.parseFromString(page, "text/html")
            await handler(this, dom, new URL(url))
        } else {
            await handler(this, page, url)
        }
    }
}

const globalState = new GlobalState()

const handleSidebarClick = async msg => {
    console.log("sidebar click", msg)
    const [targetType, targetArg] = msg.target.split(":", 2)
    switch (targetType) {
    case "farm":
        if (globalState.player.farmID) {
            globalState.postMessage({ action: "RELOAD_VIEW", url: `xfarm.php?id=${globalState.player.farmID}`})
        } else {
            console.log("Can't navigate to farm without Farm ID")
        }
        break
    default:
        if (globalState.clickHandlers[targetType]) {
            await globalState.clickHandlers[targetType](globalState, targetType, targetArg, msg)
        }
        break
    }
}

const connectToContentScript = () =>
    new Promise(resolve =>
        browser.runtime.onConnect.addListener(port => {
            port.onDisconnect.addListener(disPort => {
                const i = globalState.ports.indexOf(disPort)
                if (i !== -1) {
                    globalState.ports.splice(i, 1)
                }
            })
            port.onMessage.addListener(msg => {
                switch (msg.action) {
                case "SIDEBAR_CLICK":
                    handleSidebarClick(msg)
                    break
                default:
                    if (globalState.postMessageHandlers[msg.action]) {
                        globalState.postMessageHandlers[msg.action](globalState, msg)
                    }
                    break
                }
            })
            globalState.ports.push(port)
            // Get something rendered at least.
            renderSidebar(globalState)
            // The first time we get a connection, let the promise resolve.
            // This means we can block until we get at least one connection.
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

    // Make sure the DB is persisted.
    const persist = await navigator.storage.persist()
    if (!persist) {
        throw "Unable to set persist mode for storage"
    }

    // Initialize the database.
    globalState.db = await idb.openDB("farmrpg-ext", 7, {
        upgrade(db, oldVer) {
            switch(oldVer) {
            case 0:
                console.log("Running DB migrations for version 1")
                db.createObjectStore("log", { keyPath: "id", autoIncrement: true })
                const items = db.createObjectStore("items", { keyPath: "name" })
                items.createIndex("byImage", "image", {unique: false})
                items.createIndex("byID", "id", {unique: true})
                const locations = db.createObjectStore("locations", { keyPath: ["type", "name"] })
                locations.createIndex("byID", ["type", "id"], {unique: true})
            case 1:
                console.log("Running DB migrations for version 2")
                const pets = db.createObjectStore("pets", { keyPath: "name" })
                pets.createIndex("byID", "id", {unique: true})
                db.createObjectStore("player", { keyPath: "id", autoIncrement: true })
            case 2:
                console.log("Running DB migrations for version 3")
                db.createObjectStore("quests", { keyPath: "id" })
            case 3:
                console.log("Running DB migrations for version 4")
                db.createObjectStore("latency", { keyPath: ["ts", "url"] })
            case 4:
                console.log("Running DB migrations for version 5")
                db.createObjectStore("communityCenter", { keyPath: "date" })
                db.createObjectStore("emblems", { keyPath: "id" })
            case 5:
                console.log("Running DB migrations for version 6")
                db.createObjectStore("borgens", { keyPath: "date" })
            case 6:
                console.log("Running DB migrations for version 7")
                db.createObjectStore("exchangeCenter", { keyPath: ["date", "giveItem", "receiveItem"] })
            }
        },
    })
    setupLog(globalState)
    await syncFixtures(globalState.db)
    const itemCount = await globalState.db.count("items")
    const locationCount = await globalState.db.count("locations")
    const logCount = await globalState.db.count("log")
    const petsCount = await globalState.db.count("pets")
    const questsCount = await globalState.db.count("quests")
    console.log(`Database loaded, items ${itemCount} locations ${locationCount} pets ${petsCount} quests ${questsCount} log ${logCount}`)

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
    await setupPlayer(globalState)
    setupItems(globalState)
    setupLocations(globalState)
    setupInventory(globalState)
    setupPets(globalState)
    setupExplore(globalState)
    setupFishing(globalState)
    setupFarm(globalState)
    setupPerks(globalState)
    setupOrchard(globalState)
    setupWheel(globalState)
    setupWorkshop(globalState)
    setupAnimals(globalState)
    setupSettings(globalState)
    setupLocksmith(globalState)
    setupProduction(globalState)
    setupVineyard(globalState)
    setupQuests(globalState)
    setupEmblems(globalState)
    setupCommunityCenter(globalState)
    setupBorgens(globalState)
    setupExchangeCenter(globalState)

    // Kick off some initial data population.
    renderSidebarFromGlobalState()
    fetchInventory(globalState).then(renderSidebarFromGlobalState)
    fetchPerks(globalState).then(() => {
        console.log("Found initial perkset", globalState.player.currentPerkset)
        renderSidebarFromGlobalState()
    })

    // Set up a periodic refresh of the inventory.
    browser.alarms.create("inventory-refresh", {periodInMinutes: 5})
    browser.alarms.create("perk-refresh", {periodInMinutes: 15})
    browser.alarms.create("render-sidebar", {periodInMinutes: 1})
    browser.alarms.create("clear-latency", {periodInMinutes: 60})
    browser.alarms.create("community-center-refresh", {
        periodInMinutes: 60*24,
        when: luxon.DateTime.fromObject({}, {zone: "America/Chicago"}).startOf("day").plus({day: 1}).minus({minutes: 30}).toMillis(),
    })
    browser.alarms.onAlarm.addListener(async alarm => {
        switch (alarm.name) {
        case "inventory-refresh":
            await fetchInventory(globalState)
            await renderSidebarFromGlobalState()
            break
        case "perk-refresh":
            await fetchPerks(globalState)
            await renderSidebarFromGlobalState()
            break
        case "render-sidebar":
            await renderSidebarFromGlobalState()
            break
        case "clear-latency":
            // Delete all but the last 24 hours of data.
            // await globalState.db.delete("latency", IDBKeyRange.upperBound(Date.now() - 24*60*60*1000))
            await fetchCommunityCenter(globalState)
            await fetchExchangeCenter(globalState)
            await fetchEmblems(globalState)
            break
        case "community-center-refresh":
            await fetchCommunityCenter(globalState)
            await fetchExchangeCenter(globalState)
            await fetchEmblems(globalState)
            break
        }
    })
}

main()
