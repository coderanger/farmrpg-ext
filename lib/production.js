import { renderPage, renderListBlock, renderRowCheckbox, renderRowText } from "./html.js"

const renderProductionRow = async (state, itemName, quantity, link) => {
    // Grab the item details.
    const item = await state.items.get(itemName)
    // Nothing can make more than max inv at once.
    quantity = Math.min(Math.round(quantity), state.player.maxInventory)
    // Calculate how much of quantity will disappear into the void.
    const overflow = Math.max(state.player.inventory[itemName] + quantity - state.player.maxInventory, 0)

    return `
    <li class="farmrpg-ext-production-row">
        <a class="item-link close-panel" href="${link}" data-view=".view-main">
            <div class="item-content">
                <div class="item-media">
                    <img class="itemimg" src="${item.image}" />
                </div>
                <div class="item-inner">
                    <div class="item-title">
                        <strong>${item.name}</strong>
                    </div>
                    <div class="item-after">
                        <span class="farmrpg-ext-production-overflow">${overflow}</span>
                        ${quantity - overflow}
                    </div>
                </div>
            </div>
        </a>
    </li>
    `
}

const renderDaily = async state => {
    const rollover = luxon.DateTime.fromObject({}, {zone: "America/Chicago"}).startOf("day").plus({day: 1})
    let delta = rollover.diffNow().shiftTo("hours", "minutes").normalize()
    if (delta.hours == 0) {
        delta = delta.shiftTo("minutes").normalize()
    }

    const rows = []
    // Orchard production.
    if (state.player.orchard !== null) {
        let multiplier = 1 + state.player.perkValue({
            "Forester I": 0.05,
            "Forester II": 0.1,
            "Forester III": 0.05,
            "Forester IV": 0.1,
        })

        const orchardLink = `orchard.php?id=${state.player.farmID}`
        rows.push(await renderProductionRow(state, "Apple", state.player.orchard.Apple * multiplier, orchardLink))
        rows.push(await renderProductionRow(state, "Orange", state.player.orchard.Orange * multiplier, orchardLink))
        rows.push(await renderProductionRow(state, "Lemon", state.player.orchard.Lemon * multiplier, orchardLink))
    }

    return renderListBlock("Daily Production", {}, [
        renderRowText(`In ${delta.toHuman({maximumFractionDigits: 0})}, you will generate:`),
        ...rows
    ])
}

const renderProduction = async state => {
    const html = renderPage("Production", "production", [
        await renderDaily(state),
    ])
    state.postMessage({action: "LOAD_CONTENT", pageName: "farmrpg-ext-production", html})
}

export const setupProduction = state => {
    state.addClickHandler("production", renderProduction)
}
