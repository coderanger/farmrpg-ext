// https://farmrpg.com/worker.php?go=openitem&id=397&amt=1
// <img src='/img/items/rs8.png' style='width:16px'> Runestone 08 x1<br/>
//
// https://farmrpg.com/worker.php?go=openitem&id=346&amt=1
// <img src='/img/items/6019.PNG' style='width:16px'> Ancient Coin x100<br/><img src='/img/items/emerald.png' style='width:16px'> Emerald x50<br/><img src='/img/items/jade.png' style='width:16px'> Jade x50<br/><img src='/img/items/7876.PNG' style='width:16px'> Pearl x50<br/><img src='/img/items/6071.PNG' style='width:16px'> Ruby x50<br/><img src='/img/items/8055.png' style='width:16px'> Shimmer Topaz x50<br/>

const itemRE = /^\s*(.*?) x(\d+)\s*$/

const parseOpenItem = (page, url, parsedUrl) => {
    const results = {
        id: parsedUrl.searchParams.get("id"),
        quantity: parseInt(parsedUrl.searchParams.get("amt"), 10),
        items: []
    }
    // Parse the items and drop quantities from the HTML.
    const parser = new DOMParser()
    const dom = parser.parseFromString(page, "text/html")
    for (const elm of dom.querySelectorAll("img")) {
        const match = elm.nextSibling.nodeValue.match(itemRE)
        if (!match) {
            console.error("Unable to parse locksmith item from", elm)
        }
        results.items.push({
            item: match[1],
            image: elm.getAttribute("src"),
            quantity: parseInt(match[2], 10),
        })
    }
    return results
}

const visitOpenItem = async (state, page, url, parsedUrl) => {
    const results = parseOpenItem(page, url, parsedUrl)
    const item = await state.items.getByID(results.id)
    results.item = item.name
    console.debug("locksmith", results)
    state.log.locksmith(results)
}

const visitLocksmith = async (state, page, url) => {
    state.lastView = "locksmith"
}

export const setupLocksmith = state => {
    state.addWorkerHandler("openitem", visitOpenItem)
    state.addPageHandler("locksmith", visitLocksmith)
}
