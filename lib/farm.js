import { fetchInventory } from "./inventory.js"

const parsePanelCrops = (page, url) => {
    const parser = new DOMParser()
    const dom = parser.parseFromString(page, "text/html")
    const images = {}
    for (const elm of dom.querySelectorAll(".cropitem")) {
        images[elm.dataset.pb.substr(1)] = elm.getAttribute("src")
    }
    return images
}

const visitPanelCrops = async (state, page, url) => {
    state.player.cropImages = parsePanelCrops(page, url)
    await state.player.save(state.db)
    state.lastView = "farm"
}

const parseFarmStatus = (page, url) => {
    // Get the farm ID from the URL.
    const parsedUrl = new URL(url)
    const farmID = parsedUrl.searchParams.get("id")
    const now = Date.now()
    const times = {}
    // 11-39-147;12-39-147;13-39-147;14-39-147;21-39-147;
    for (const part of page.split(";")) {
        if (part === "") {
            continue
        }
        const segments = part.split("-", 3)
        const secondsLeft = segments[2] == "" ? 0 : parseInt(segments[2], 10)
        times[segments[0]] = now + (secondsLeft * 1000)
    }
    return {farmID, times}
}

const visitFarmStatus = async (state, page, url) => {
    const farmStatus = parseFarmStatus(page, url)
    state.player.farmID = farmStatus.farmID
    state.player.cropTimes = farmStatus.times
    await state.player.save(state.db)
}

const beforeHarvestAll = async (state, parsedUrl) => {
    if (state.player.settings.harvest_logging !== "1") {
        // Harvest logging disabled.
        state.preHarvestInventory = undefined
        return
    }
    const now = Date.now()
    if (!Object.values(state.player.cropTimes).some(t => t <= now)) {
        // No crops pending harvest.
        console.debug("Skipping pre-harvest data, no crops to harvest")
        state.preHarvestInventory = undefined
        return
    }
    // Update the inventory and store a copy so it can be diff'd after a harvest.
    await fetchInventory(state)
    // Copy the inventory because we mutate it in place sometimes.
    state.preHarvestInventory = {}
    for (const item in state.player.inventory) {
       state.preHarvestInventory[item] = state.player.inventory[item]
    }
}

const visitHarvestAll = async (state, page, url) => {
    if (state.player.settings.harvest_logging !== "1") {
        // Harvest logging disabled. Just fetch the new inventory.
        await fetchInventory(state)
        return
    }
    if (!state.preHarvestInventory) {
        // No inventory to diff against.
        return
    }
    // Get the new inventory. This should be first in the method so
    // we don't get any background stuff happening first, as much as possible.
    await fetchInventory(state)
    // Copy it out so we have a stable value for diff.
    const postHarvestInventory = {}
    for (const item in state.player.inventory) {
        postHarvestInventory[item] = state.player.inventory[item]
    }
    // Work out which crops were supposed to be harvested.
    const runecube = state.player.perks["Eagle Eye"] || false
    const results = {crops: [], items: [], runecube}
    const now = Date.now()
    const possibleDrops = {}
    for (const plot in state.player.cropTimes) {
        if (state.player.cropTimes[plot] > now) {
            // Not ready.
            continue
        }
        const image = state.player.cropImages[plot]
        const candidateItems = (await state.items.getByImage(image)).filter(it => it.name.includes("Seed") || it.name.includes("Spore"))
        const seed = candidateItems.length === 1 ? candidateItems[0] : null
        results.crops.push({plot, image, seed: seed ? seed.name : null})
        for (const possibleDrop of ((seed && seed.possibleDrops) || [])) {
            possibleDrops[possibleDrop] = true
        }
    }
    // Diff the two inventories to find what items changed.
    const allKeys = new Set([...Object.keys(state.preHarvestInventory), ...Object.keys(postHarvestInventory), ...Object.keys(possibleDrops)])
    for (const item of allKeys) {
        const quantity = (postHarvestInventory[item] || 0) - (state.preHarvestInventory[item] || 0)
        const overflow = (postHarvestInventory[item] || 0) >= state.player.maxInventory
        // console.log("for item", item, quantity, overflow)
        if(quantity > 0 || (possibleDrops[item] && overflow)) {
            results.items.push({item, quantity, overflow})
        }
    }
    // Log the results.
    console.log("harvestall", results)
    await state.log.harvestall(results)
    // Clear the pre-harvest data for next time.
    state.preHarvestInventory = undefined
}

const parseAnimalItems = (state, page) => {
    let itemNames = []
    switch(state.lastView) {
        case "coop":
            itemNames = ["Eggs", "Feathers"]
            break
        case "pasture":
            itemNames = ["Milk"]
            break
        case "raptors":
            itemNames = ["Antlers", "Bobs"]
            break
    }
    const animalItems = {}
    const parser = new DOMParser()
    const dom = parser.parseFromString(page, "text/html")
    const items = dom.querySelectorAll(".card-content-inner > strong")
    for (let i = 0; i < itemNames.length; i++) {
        animalItems[itemNames[i]] = items[i].textContent
    }
    return animalItems
}

const visitCoop = async (state, page, url) => {
    state.lastView = "coop"
    state.player.animalItems["Chickens"] = parseAnimalItems(state, page)
    await state.player.save(state.db)
}

const visitPasture = async (state, page, url) => {
    state.lastView = "pasture"
    state.player.animalItems["Cows"] = parseAnimalItems(state, page)
    await state.player.save(state.db)
}

const visitPigPen = async (state, page, url) => {
    state.lastView = "pigpen"
}

const visitPen = async (state, page, url) => {
    state.lastView = "raptors"
    state.player.animalItems["Raptors"] = parseAnimalItems(state, page)
    await state.player.save(state.db)
}

const visitHab = async (state, page, url) => {
    state.lastView = "hab"
}

const visitTroutFarm = async (state, page, url) => {
    state.lastView = "troutfarm"
}

export const setupFarm = state => {
    state.addPageHandler("panel_crops", visitPanelCrops)
    state.addWorkerHandler("farmstatus", visitFarmStatus)
    state.addPageHandler("coop", visitCoop)
    state.addPageHandler("pasture", visitPasture)
    state.addPageHandler("pigpen", visitPigPen)
    state.addPageHandler("pen", visitPen)
    state.addPageHandler("hab", visitHab)
    state.addPageHandler("troutfarm", visitTroutFarm)
    state.addBeforeWorkerHandler("harvestall", beforeHarvestAll)
    state.addWorkerHandler("harvestall", visitHarvestAll)
}
