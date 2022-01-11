class ActionLog {
    constructor(db) {
        this.db = db
    }

    async log(data) {
        data.ts = Date.now()
        await this.db.put("log", data)
        return data
    }

    async explore(results) {
        return await this.log({type: "explore", results})
    }

    async lemonade(results) {
        return await this.log({type: "lemonade", results})
    }
}

const downloadInner = opts =>
    new Promise((resolve, reject) => {
        const downloadID = [null]
        const listener = downloadDelta => {
            if (downloadDelta.id === downloadID[0] && downloadDelta.state.current == "complete") {
                browser.downloads.onChanged.removeListener(listener)
                resolve(downloadDelta)
            }
        }
        browser.downloads.onChanged.addListener(listener)
        browser.downloads.download(opts).then(id => { downloadID[0] = id }).catch(reject)
    })


export const downloadLog = async state => {
    const log = await state.db.getAll("log")
    const blob = new Blob([JSON.stringify(log, null, 2)], {type : 'application/json'})
    const url = URL.createObjectURL(blob)
    await downloadInner({url, filename: "log.json"})
    URL.revokeObjectURL(url)

}

export const setupLog = state => {
    state.log = new ActionLog(state.db)
}
