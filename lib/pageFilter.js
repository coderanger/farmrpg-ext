export class RequestInterceptor {
    constructor() {
        this.pageHandlers = {}
        this.beforePageHandlers = {}
        this.pageFilters = {}
        this.workerHandlers = {}
        this.beforeWorkerHandlers = {}
        this.installListener()
        this.addPageHandler("worker", this.workerDispatcher.bind(this))
        this.addBeforePageHandler("worker", this.beforeWorkerDispatcher.bind(this))
    }

    installListener() {
        browser.webRequest.onBeforeRequest.addListener(
            this.listener.bind(this),
            { urls: ["https://farmrpg.com/*.php*"] },
            ["blocking"] // We aren't blocking anything but it's required for the filter API.
        )
    }

    async listener(details) {
        if (details.originUrl.startsWith("moz-extension://")) {
            return
        }
        const parsedUrl = new URL(details.url)
        const pagePath = parsedUrl.pathname.substring(1)
        const beforeCallback = this.beforePageHandlers[pagePath]
        if (beforeCallback) {
            await beforeCallback(parsedUrl)
        }
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

    addBeforePageHandler(page, handler) {
        this.beforePageHandlers[page + ".php"] = handler
    }

    workerDispatcher(page, url, parsedUrl) {
        const callback = this.workerHandlers[parsedUrl.searchParams.get("go")]
        if (!callback) {
            return
        }
        return callback(page, url, parsedUrl)
    }

    beforeWorkerDispatcher(parsedUrl) {
        const callback = this.beforeWorkerHandlers[parsedUrl.searchParams.get("go")]
        if (!callback) {
            return
        }
        return callback(parsedUrl)
    }

    addWorkerHandler(workerGo, handler) {
        this.workerHandlers[workerGo] = handler
    }

    addBeforeWorkerHandler(workerGo, handler) {
        this.beforeWorkerHandlers[workerGo] = handler
    }
}
