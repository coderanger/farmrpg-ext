import { fetchInventory } from './inventory.js'

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
        if (page === "") {
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
    await updateCrops(state)
    await state.player.save(state.db)
}

const logHarvestedCrops = async (state, page, url) => {

    // Prevents server lag from spamming the "Harvest All" button by checking if the crops are ready
    if (Object.values(state.player.cropTimes)[0] < Date.now()) {

        await fetchInventory(state)

        // Checks if the crops are actually being farmed
        const keys = Object.keys(state.player.crops)
        if (state.player.inventory[keys[0]] - state.player.crops[keys[0]].quantity > 0) {

            // Loops through the crops dictionary to log a valid harvest
            const cropsFarmed = []
            let total = 0
            let totalGiven = 0
            for (const cropName of keys) {
                const quantity = state.player.inventory[cropName] - state.player.crops[cropName].quantity
                const dict = {
                    item: cropName,
                    amount: state.player.crops[cropName].total,
                    amountGiven: quantity,
                    golden: 0
                }
                if (state.player.crops[cropName].hasGold[0] === true) {
                    dict.golden = state.player.inventory["Gold " + cropName] - state.player.crops[cropName].hasGold[1]
                }
                total += dict.amount
                totalGiven += dict.amountGiven
                cropsFarmed.push(dict)
            }
            await state.log["harvestall"]({total: total, totalGiven: totalGiven, cropsFarmed})
        }
    }
}

const updateCrops = async (state) => {
    state.player.crops = []

    // Gets the crops data based on their images and saves it to the state
    for (const img of Object.values(state.player.cropImages)) {
        const cropItem = await state.items.getByImage(img)
        const keys = Object.keys(state.player.crops)
        if (!keys.includes(cropItem[1].name)) {
            state.player.crops[cropItem[1].name] = {quantity: state.player.inventory[cropItem[1].name], total: 1, hasGold: [false, 0]}
            const items = await globalState.db.getAll("items")
            if (items.some(e => e.name === "Gold "+cropItem[1].name)) {
                state.player.crops[cropItem[1].name].hasGold = [true, state.player.inventory["Gold "+cropItem[1].name]]
            }
        }
        else {
            state.player.crops[cropItem[1].name].total++
        }
    }
}

const visitCoop = async (state, page, url) => {
    state.lastView = "coop"
}

const visitPasture = async (state, page, url) => {
    state.lastView = "pasture"
}

const visitPigPen = async (state, page, url) => {
    state.lastView = "pigpen"
}

const visitPen = async (state, page, url) => {
    state.lastView = "raptors"
}

const visitHab = async (state, page, url) => {
    state.lastView = "hab"
}

const visitTroutFarm = async (state, page, url) => {
    state.lastView = "troutfarm"
}

export const setupFarm = state => {
    state.addPageFilter("https://farmrpg.com/panel_crops.php?*", visitPanelCrops)
    state.addPageFilter("https://farmrpg.com/worker.php?*go=farmstatus*", visitFarmStatus)
    state.addPageFilter("https://farmrpg.com/worker.php?go=harvestall&id=*", logHarvestedCrops)
    state.addPageFilter("https://farmrpg.com/coop.php?*", visitCoop)
    state.addPageFilter("https://farmrpg.com/pasture.php?*", visitPasture)
    state.addPageFilter("https://farmrpg.com/pigpen.php?*", visitPigPen)
    state.addPageFilter("https://farmrpg.com/pen.php?*", visitPen)
    state.addPageFilter("https://farmrpg.com/hab.php?*", visitHab)
    state.addPageFilter("https://farmrpg.com/troutfarm.php?*", visitTroutFarm)
}
