const parseNameAnimal = (page, url) => {
    const animal = {}
    // Parse the ID out of the URL.
    const parsedUrl = new URL(url)
    animal.id = parsedUrl.searchParams.get("id")
    switch(parsedUrl.pathname) {
    case "/namechicken.php":
        animal.type = "chicken"
        break
    case "/namecow.php":
        animal.type = "cow"
        break
    case "/namepig.php":
        animal.type = "pig"
        break
    case "/nameraptor.php":
        animal.type = "raptor"
        break
    default:
        console.debug("unknown animal name page", parsedUrl.pathname)
        break
    }
    // Parse the progress out of the HTML.
    const parser = new DOMParser()
    const dom = parser.parseFromString(page, "text/html")
    animal.progress = dom.querySelector(".progressbar").dataset.progress
    const img = dom.querySelector(".itemimg") || dom.querySelector(".exploreimg")
    animal.image = img.getAttribute("src")
    const name = img.nextElementSibling.nextElementSibling
    animal.pettable = !!name.querySelector("span[style='color:red']")
    return animal
}

const visitNameAnimal = async (state, page, url) => {
    const animal = parseNameAnimal(page, url)
    state.lastView = "nameAnimal"
    state.lastAnimal = animal
}

export const setupAnimals = state => {
    state.addPageHandler("namechicken", visitNameAnimal)
    state.addPageHandler("namecow", visitNameAnimal)
    state.addPageHandler("namepig", visitNameAnimal)
    state.addPageHandler("nameraptor", visitNameAnimal)
}
