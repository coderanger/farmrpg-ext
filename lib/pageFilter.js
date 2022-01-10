export const setupPageFilter = (url, callback) => {
    const listener = details => {
        if (details.originUrl.startsWith("moz-extension://")) {
            return
        }
        const filter = browser.webRequest.filterResponseData(details.requestId)
        const decoder = new TextDecoder("utf-8")

        // Capture the page XHRs for processing.
        const data = []
        filter.ondata = event => {
            data.push(event.data)
            filter.write(event.data)
        }

        // Request is done, let it complete and then run the callback
        filter.onstop = () => {
            let page = ""
            for (const buffer of data) {
                page += decoder.decode(buffer, { stream: true })
            }
            page += decoder.decode() // end-of-stream
            filter.close()

            callback(page, details.url)
        };
    }

    browser.webRequest.onBeforeRequest.addListener(
        listener,
        { urls: [url] },
        ["blocking"] // We aren't blocking anything but it's required for the filter API.
    )
}
