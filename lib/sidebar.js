const sidebarConfig = [
    { name: "Nails", buy: true },
    { name: "Iron", buy: true },
    { name: "Wood" },
    { name: "Board" },
    { name: "Straw" },
    { name: "Stone" },
]

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
    const fragments = await Promise.all(sidebarConfig.map(async sidebarItem => {
        const item = await state.items.get(sidebarItem.name)
        const invItem = state.inventory.items[sidebarItem.name]
        const isMax = sidebarItem.buy ? (!invItem || invItem.quantity <= 10) : (invItem && invItem.quantity >= state.inventory.max)
        return `
            <div class="farmrpg-ext-item ${isMax ? "farmrpg-ext-max" : ""} ${sidebarItem.buy ? "farmrpg-ext-buy" : ""}" data-farmrpgextsidebarclick="item:${sidebarItem.name}">
                <div class="farmrpg-ext-image">
                    <img src="${item ? item.image : "/img/items/item.png"}" />
                </div>
                <div class="farmrpg-ext-quantity">
                    ${invItem ? invItem.quantity : 0}
                </div>
            </div>
        `
    }))
    // Make the overall HTML.
    const html = `
        <div class="farmrpg-ext-status">${cropHtml}${perkHtml}</div>
        <div class="farmrpg-ext-items">${fragments.join("")}</div>
    `
    // Ship it over to the content script for injection.
    globalState.port.postMessage({ action: "UPDATE_SIDEBAR", html })
}

export const renderSidebarFromGlobalState = async () => await renderSidebar(globalState)
