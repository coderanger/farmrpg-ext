const itemLinkRE = /id=(\d+)/
const workshopTitleRE = /\s*(\S.*\S)\s+\((\d+)\)/
const workshopIngredientRE = /(\d+)\s*\/\s*\d+\s*(\S.*?\S)\s*$/mg

const parseWorkshop = (page, url) => {
    const items = {}
    const quantities = {}
    const parser = new DOMParser()
    const dom = parser.parseFromString(page, "text/html")
    for (const itemElm of dom.querySelectorAll('.list-block li.close-panel')) {
        // Look at the title of each section for data.
        const titleStrong = itemElm.querySelector('.item-title strong')
        if (!titleStrong) {
            console.error("Unable to parse workshop title from ", itemElm)
            continue
        }
        const titleMatch = titleStrong.innerText.match(workshopTitleRE)
        if (!titleMatch) {
            console.error("Unable to parse workshop name/quantity from title ", titleStrong.innerText)
            continue
        }
        const mainName = titleMatch[1]
        quantities[mainName] = parseInt(titleMatch[2], 10)
        // Try to get the ID and image too.
        const link = itemElm.querySelector(".item-media a")
        const image = itemElm.querySelector(".item-media img")
        if (!link || !image) {
            console.error("Unable to parse workshop link or image from ", itemElm)
            continue
        }
        const linkMatch = link.getAttribute("href").match(itemLinkRE)
        if (!linkMatch) {
            console.log("Unable to parse item ID from workshop link ", link.getAttribute("href"))
            continue
        }
        if (items[mainName] === undefined) {
            items[mainName] = {name: mainName}
        }
        items[mainName].id = linkMatch[1]
        items[mainName].image = image.getAttribute("src")
        // Parse the ingredients to try and get at least some quantities.
        const title = itemElm.querySelector('.item-title')
        title.innerHTML = title.innerHTML.replaceAll("<br>", "\n")
        for (const ingMatch of title.innerText.matchAll(workshopIngredientRE)) {
            const ingName = ingMatch[2]
            quantities[ingName] = parseInt(ingMatch[1], 10)
        }
    }
    return {items, quantities}
}

const visitWorkshop = async (state, page, url) => {
    const workshop = parseWorkshop(page, url)
    for (const item in workshop.items) {
        await state.items.learn(workshop.items[item])
    }
    for (const item in workshop.quantities) {
        state.player.inventory[item] = workshop.quantities[item]
    }
    await state.player.save(state.db)
}

export const setupWorkshop = state => {
    state.addPageFilter("https://farmrpg.com/workshop.php", visitWorkshop)
}
