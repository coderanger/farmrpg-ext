import { findSection } from "./utils.js"

const parseVineyard = dom => {
    const card = findSection(dom, "About the vineyard")
    const grapes = card.querySelector(".card-content-inner strong")
    return parseInt(grapes.innerText.replace(/,/g, ""), 10)
}

const visitVineyard = async (state, dom) => {
    state.player.vineyard = parseVineyard(dom)
    await state.player.save(state.db)
}

const parseCellar = dom => {
    const cellar = {bottles: []}
    // Find the maximum number of bottles.
    const headerCard = findSection(dom, "About the wine cellar")
    const headerElm = headerCard.querySelector(".card-content-inner")
    const match = headerElm.innerText.match(/Up to (\d+) bottles/)
    if (!match) {
        throw `Unable to parse max bottles from ${headerElm.innerText}`
    }
    cellar.maximum = parseInt(match[1], 10)

    // Parse all the bottle ages to a timestamp so it's not relative to today.
    const bottlesCard = findSection(dom, /In Cellar/)
    const startOfDay = luxon.DateTime.fromObject({}, {zone: "America/Chicago"}).startOf("day")
    for (const row of bottlesCard.querySelectorAll(".item-title")) {
        const match = row.innerText.match(/(\d+) Day(s)? Old/)
        if (!match) {
            console.error("Unable to parse wine age from ", row)
            continue
        }
        const age = parseInt(match[1], 10)
        const addedOn = startOfDay.minus({days: age})
        cellar.bottles.push(addedOn.toMillis())
    }
    return cellar
}

const visitCellar = async (state, dom) => {
    state.player.cellar = parseCellar(dom)
    await state.player.save(state.db)
}

export const setupVineyard = state => {
    state.addPageHandler("vineyard", visitVineyard, {parse: true})
    state.addPageHandler("cellar", visitCellar, {parse: true})
}
