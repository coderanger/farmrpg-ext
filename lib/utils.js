export const findSection = (dom, title) => {
    for (const row of dom.querySelectorAll(".content-block-title")) {
        if (row.textContent.trim() === title) {
            return row.nextElementSibling
        }
    }
    return null
}
