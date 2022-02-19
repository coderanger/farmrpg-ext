export class RequestInterceptor {
    constructor() {
        this.pageHandlers = {}
        this.pageFilters = {}
        this.workerHandlers = {}
        this.installListener()
        this.addPageHandler("worker", this.workerDispatcher.bind(this))
    }

    installListener() {
        browser.webRequest.onBeforeRequest.addListener(
            this.listener.bind(this),
            { urls: ["https://farmrpg.com/*.php*"] },
            ["blocking"] // We aren't blocking anything but it's required for the filter API.
        )
    }

    listener(details) {
        if (details.originUrl.startsWith("moz-extension://")) {
            return
        }
        const parsedUrl = new URL(details.url)
        const pagePath = parsedUrl.pathname.substring(1)
        const callback = this.pageHandlers[pagePath]
        if (!callback) {
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

            callback(page, details.url, parsedUrl)
        }
    }

    addPageHandler(page, handler) {
        this.pageHandlers[page + ".php"] = handler
    }

    workerDispatcher(page, url, parsedUrl) {
        const callback = this.workerHandlers[parsedUrl.searchParams.get("go")]
        if (!callback) {
            return
        }
        return callback(page, url, parsedUrl)
    }

    addWorkerHandler(workerGo, handler) {
        this.workerHandlers[workerGo] = handler
    }
}
