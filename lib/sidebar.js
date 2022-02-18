const baseSidebarConfig = [
    { item: "Wood" },
    { item: "Board" },
    { item: "Straw" },
    { item: "Stone" },
]

const extraSidebarItems = async state => {
    switch (state.lastView) {
    case "farm":
        // Add the items for each planted crop.
        const cropItems = {}
        let hasCrops = false
        for (const slot in state.player.cropImages) {
            for (const item of await state.items.getByImage(state.player.cropImages[slot])) {
                cropItems[item.name] = true
                hasCrops = true
            }
        }
        // For the case with no crops.
        if (!hasCrops) {
            return [
                {item: "Peppers", title: "Peppers (12s)"},
                {item: "Carrot"},
                {item: "Peas"},
                {item: "Cucumber"},
                {item: "Eggplant"},
                {item: "Radish"},
                {item: "Onion"},
                {item: "Hops", title: "Hops (4m)"},
                {item: "Potato"},
                {item: "Tomato"},
                {item: "Leek"},
                {item: "Watermelon"},
                {item: "Corn"},
                {item: "Cabbage", title: "Cabbage (1.5h)"},
                {item: "Pine Tree"},
                {item: "Pumpkin"},
                {item: "Wheat"},
                {item: "Mushroom"},
                {item: "Broccoli"},
                {item: "Cotton"},
                {item: "Sunflower"},
                {item: "Beet"},
            ]
        }
        // Map to the sidebar format.
        return Object.keys(cropItems).map(it => ({item: it, class: it.includes("Seeds") || it.includes("Spores") ? "seeds" : null}))
    case "location":
        const loc = await state.locations.get(state.lastLocationType, state.lastLocation)
        return loc.items.map(it => ({item: it}))
    case "pet":
        const pet = await state.pets.get(state.lastPet)
        return pet.itemsForLevel(state.player.pets[pet.name] || 0).map(it => ({item: it}))
    case "pets":
        const items = []
        const memo = {}
        for (const name in state.player.pets) {
            const pet = await state.pets.get(name)
            for (const item of pet.itemsForLevel(state.player.pets[name])) {
                if (!memo[item]) {
                    items.push({item: item})
                    memo[item] = true
                }
            }
        }
        items.sort((a, b) => a.item < b.item ? -1 : a.item > b.item ? 1 : 0)
        return items
    case "orchard":
        return [
            {item: "Apple"},
            {item: "Orange"},
            {item: "Lemon"},
            {image: "/img/items/orchard.png", value: Math.ceil(state.player.maxInventory / 1.3), title: "Target"},
            {item: "Apple Cider"},
            {item: "Orange Juice"},
            {item: "Lemonade"},
        ]
    case "coop":
        return [
            {item: "Eggs"},
            {item: "Feathers"},
        ]
    case "pasture":
        return [
            {item: "Steak"},
            {item: "Leather"},
            {item: "Hide"},
            {item: "Milk"},
        ]
    case "pigpen":
        return [
            {item: "Broccoli"},
            {item: "Feed"},
            {item: "Bacon"},
        ]
    case "raptors":
        return [
            {item: "Antler"},
            {item: "Fishing Net"},
            {item: "Steak Kabob"},
        ]
    case "hab":
        return [
            {item: "Worms"},
            {item: "Gummy Worms"},
        ]
    case "troutfarm":
        return [
            {item: "Trout"},
            {item: "Grubs"},
            {item: "Minnows"},
        ]
    case "spin":
        return [
            {item: "Apple"},
            {item: "Orange Juice"},
            {item: "Lemonade"},
            {item: "Fishing Net"},
            {item: "Ancient Coin"},
        ]
    case "nameAnimal":
        return [
            {image: state.lastAnimal.image, value: state.lastAnimal.progress, title: "Progress"},
            {image: "/img/items/hourglass.png", value: state.lastAnimal.pettable, title: "Pettable"},
        ]
    default:
        console.error(`Unknown lastView ${state.lastView}`)
    case "":
    case undefined:
    case null:
        return []
    }
}

const renderPerksetSwitcher = async state => {
    // Check if we have perksets available and if any are enabled.
    if (state.player.perksets === undefined || Object.keys(state.player.perksets).length <= 1) {
        return ""
    }
    let perksetsEnabled = 0
    for (const key in state.player.settings) {
        if (key.startsWith("perkset_") && state.player.settings[key] === "1") {
            perksetsEnabled += 1
        }
    }
    if (perksetsEnabled <= 1) {
        return ""
    }

    // Try to pick an icon.
    let perkIcon = "/img/items/item.png"
    if (state.perksetLoading) {
        perkIcon = browser.runtime.getURL("images/spinner.png")
    } else if (state.player.currentPerkset === "Crafting") {
        perkIcon = "/img/items/5868.png"
    } else if (state.player.currentPerkset === "Farming") {
        perkIcon = "/img/items/6137.png?1"
    } else if (state.player.currentPerkset === "Fishing") {
        perkIcon = "/img/items/7783.png"
    } else if (state.player.currentPerkset === "Exploring") {
        perkIcon = "/img/items/6075.png"
    } else {
        const item = await state.items.get(state.player.currentPerkset)
        if (item) {
            perkIcon = item.image
        }
    }

    // Generate the perks statusbar HTML.
    return `
        <div class="farmrpg-ext-perk" data-farmrpgextsidebarclick="perk">
            <img src="${perkIcon}">
        </div>
    `
}

export const renderSidebar = async state => {
    // Early out if we aren't fully set up yet.
    if (!state.player) {
        return
    }
    // Generate the crop statusbar HTML.
    let soonestPosition = null
    let soonestTime = null
    for (const [pos, time] of Object.entries(state.player.cropTimes)) {
        if (soonestTime === null || time < soonestTime) {
            soonestTime = time
            soonestPosition = pos
        }
    }
    let cropHtml = ""
    if (soonestPosition === null) {
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
            <img class="farmrpg-ext-status-cropimg" src="${state.player.cropImages[soonestPosition] || "/img/items/item.png"}">
            <span class="${timeLeft === "READY" ? "farmrpg-ext-crop-done" : ""}">${timeLeft}${timeLeftUnits}</span>
        `
    }
    cropHtml = `
        <div class="farmrpg-ext-crop" data-farmrpgextsidebarclick="farm">
            ${cropHtml}
        </div>
    `
    // Generate the perks statusbar HTML.
    const perkHtml = await renderPerksetSwitcher(state)

    // Generate the items HTML.
    const sidebarConfig = baseSidebarConfig.concat(await extraSidebarItems(state))
    const fragments = await Promise.all(sidebarConfig.map(async sidebarItem => {
        let image = sidebarItem.image
        let value = sidebarItem.value
        let title = sidebarItem.title
        let click = sidebarItem.click
        const classes = ["farmrpg-ext-item"]
        // Item mode since that's so common.
        if (sidebarItem.item) {
            const item = await state.items.get(sidebarItem.item)
            const quantity = state.player.inventory[sidebarItem.item] || 0
            if (quantity >= state.player.maxInventory) {
                classes.push("farmrpg-ext-max")
            } else if (quantity >= (state.player.maxInventory * 0.85)) {
                classes.push("farmrpg-ext-warning")
            }
            image = image || (item ? item.image : "/img/items/item.png")
            value = value || quantity.toString()
            title = title || sidebarItem.item
            click = click || `item:${sidebarItem.item}`
        }
        if (sidebarItem.class) {
            classes.push(`farmrpg-ext-${sidebarItem.class}`)
        }
        let clickAttr = ""
        if (click) {
            clickAttr = `data-farmrpgextsidebarclick="${click}"`
            classes.push("farmrpg-ext-click")
        }
        return `
            <div class="${classes.join(" ")}" ${clickAttr}>
                <div class="farmrpg-ext-image">
                    <img src="${image}" title="${title}" alt="${title}" />
                </div>
                <div class="farmrpg-ext-quantity">
                    ${value}
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
    const settingsHtml = `
        <div class="farmrpg-ext-settings" data-farmrpgextsidebarclick="settings">
            <img src="/img/items/7211.png">
        </div>
    `
    const html = `
        <div class="farmrpg-ext-status">
            ${cropHtml}
            <div>${state.player.maxInventory}</div>
            <div>${logHtml}${settingsHtml}${perkHtml}</div>
        </div>
        <div class="farmrpg-ext-items">${fragments.join("")}</div>
    `
    // Ship it over to the content script for injection.
    state.postMessage({ action: "UPDATE_SIDEBAR", html })
}

export const renderSidebarFromGlobalState = async () => await renderSidebar(globalState)
