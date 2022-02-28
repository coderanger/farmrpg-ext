import { renderPage, renderListBlock, renderRowCheckbox, renderRowText } from "./html.js"

const renderProductionRow = async (state, itemName, quantity, overflow, link) => {
    const item = await state.items.get(itemName)
    return `
    <li class="farmrpg-ext-production-row">
        <div class="item-content">
            <div class="item-media">
                <a href="item.php?id=${item.id}">
                    <img class="itemimg" src="${item.image}">
                </a>
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

        const appleProduction = Math.min(Math.round(state.player.orchard.Apple * multiplier), state.player.maxInventory)
        const appleOverflow = Math.max(state.player.inventory.Apple + appleProduction - state.player.maxInventory, 0)
        rows.push(await renderProductionRow(state, "Apple", appleProduction, appleOverflow, "orchard.php"))

        const orangeProduction = Math.min(Math.round(state.player.orchard.Orange * multiplier), state.player.maxInventory)
        const orangeOverflow = Math.max(state.player.inventory.Orange + orangeProduction - state.player.maxInventory, 0)
        rows.push(await renderProductionRow(state, "Orange", orangeProduction, orangeOverflow, "orchard.php"))

        const lemonProduction = Math.min(Math.round(state.player.orchard.Lemon * multiplier), state.player.maxInventory)
        const lemonOverflow = Math.max(state.player.inventory.Lemon + lemonProduction - state.player.maxInventory, 0)
        rows.push(await renderProductionRow(state, "Lemon", lemonProduction, lemonOverflow, "orchard.php"))
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
