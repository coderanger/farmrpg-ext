import { renderSidebar } from "./sidebar.js"

const fruits = {
    Apple: "/img/items/8297.png",
    Orange: "/img/items/orange.png",
    Lemon: "/img/items/8251.PNG",
}

const parseOrchard = (page, url) => {
    const parser = new DOMParser()
    const dom = parser.parseFromString(page, "text/html")
    const orchard = {}
    for (const fruit in fruits) {
        const fruitElm = dom.querySelector(`img[src='${fruits[fruit]}']`)
        if (!fruitElm) {
            throw `Unable to find orchard fruit ${fruit}`
        }
        orchard[fruit] = parseInt(fruitElm.nextElementSibling.nextElementSibling.textContent, 10)
    }
    return orchard
}

const visitOrchard = async (state, page, url) => {
    const orchard = parseOrchard(page, url)
    state.player.orchard = orchard
    await state.player.save(state.db)
    state.lastView = "orchard"
    await renderSidebar(state)
}

export const setupOrchard = state => {
    state.addPageFilter("https://farmrpg.com/orchard.php?*", visitOrchard)
}
