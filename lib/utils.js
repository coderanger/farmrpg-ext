export const findSection = (dom, title) => {
    const test = title instanceof RegExp ? val => title.test(val) : val => title === val
    for (const row of dom.querySelectorAll(".content-block-title")) {
        if (test(row.textContent.trim())) {
            return row.nextElementSibling
        }
    }
    return null
}
