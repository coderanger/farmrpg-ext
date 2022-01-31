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
    await state.player.save(state.db)
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
    state.addPageFilter("https://farmrpg.com/coop.php?*", visitCoop)
    state.addPageFilter("https://farmrpg.com/pasture.php?*", visitPasture)
    state.addPageFilter("https://farmrpg.com/pigpen.php?*", visitPigPen)
    state.addPageFilter("https://farmrpg.com/pen.php?*", visitPen)
    state.addPageFilter("https://farmrpg.com/hab.php?*", visitHab)
    state.addPageFilter("https://farmrpg.com/troutfarm.php?*", visitTroutFarm)
}
