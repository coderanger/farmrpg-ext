const baseSidebarConfig = [
    { name: "Wood" },
    { name: "Board" },
    { name: "Straw" },
    { name: "Stone" },
]

const extraSidebarItems = async state => {
    switch (state.lastView) {
    case "farm":
        // Add the items for each planted crop.
        const cropItems = {}
        for (const slot in state.crops.images) {
            for (const item of await state.items.getByImage(state.crops.images[slot])) {
                cropItems[item.name] = true
            }
        }
        // Map to the sidebar format.
        return Object.keys(cropItems).map(it => ({name: it, class: it.includes("Seeds") ? "seeds" : null}))
    case "location":
        const loc = await state.locations.get(state.lastLocationType, state.lastLocation)
        console.debug("loc", loc, state.lastLocationType, state.lastLocation)
        return loc.items.map(it => ({name: it}))
    case "pet":
        const pet = await state.pets.get(state.lastPet)
        return pet.itemsForLevel(state.player.pets[pet.name] || 0).map(it => ({name: it}))
    case "pets":
        const items = []
        const memo = {}
        for (const name in state.player.pets) {
            const pet = await state.pets.get(name)
            for (const item of pet.itemsForLevel(state.player.pets[name])) {
                if (!memo[item]) {
                    items.push({name: item})
                    memo[item] = true
                }
            }
        }
        return items
    default:
        console.error(`Unknown lastView ${state.lastView}`)
    case "":
    case undefined:
    case null:
        return []
    }
}

export const renderSidebar = async state => {
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
    if (!state.crops.hasData) {
        cropHtml = `
            <img class="farmrpg-ext-status-cropimg" src="/img/items/item.png">
            <span>Unknown</span>
        `
    } else if (soonestPosition === null) {
        cropHtml = `
            <img class="farmrpg-ext-status-cropimg" src="/img/items/farm2_sm.png">
            <span class="farmrpg-ext-crop-empty">Empty</span>
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
    const sidebarConfig = baseSidebarConfig.concat(await extraSidebarItems(state))
    const fragments = await Promise.all(sidebarConfig.map(async sidebarItem => {
        const item = await state.items.get(sidebarItem.name)
        const invItem = state.inventory.items[sidebarItem.name]
        const isMax = sidebarItem.buy ? (!invItem || invItem.quantity <= 10) : (invItem && invItem.quantity >= state.inventory.max)
        const isWarning = invItem && invItem.quantity >= (state.inventory.max * 0.85)
        const classes = ["farmrpg-ext-item"]
        if (isMax) {
            classes.push("farmrpg-ext-max")
        } else if (isWarning) {
            classes.push("farmrpg-ext-warning")
        }
        if (sidebarItem.class) {
            classes.push(`farmrpg-ext-${sidebarItem.class}`)
        }
        return `
            <div class="${classes.join(" ")}" data-farmrpgextsidebarclick="item:${sidebarItem.name}">
                <div class="farmrpg-ext-image">
                    <img src="${item ? item.image : "/img/items/item.png"}" title="${sidebarItem.name}" alt="${sidebarItem.name}" />
                </div>
                <div class="farmrpg-ext-quantity">
                    ${invItem ? invItem.quantity : 0}
                </div>
            </div>
        `
    }))
    // Make the overall HTML.
    const logHtml = `
        <div class="farmrpg-ext-log" data-farmrpgextsidebarclick="log">
            <img src="/img/items/6979.png">
        </div>
    `
    const html = `
        <div class="farmrpg-ext-status">${cropHtml}<div>${logHtml}${perkHtml}</div></div>
        <div class="farmrpg-ext-items">${fragments.join("")}</div>
    `
    // Ship it over to the content script for injection.
    globalState.port.postMessage({ action: "UPDATE_SIDEBAR", html })
}

export const renderSidebarFromGlobalState = async () => await renderSidebar(globalState)
