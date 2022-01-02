(() => {
    const port = browser.runtime.connect()

    const renderSidebar = (html) => {
        // Find or create the sidebar holder.
        let sidebarElm = document.getElementById("farmrpg-ext-sidebar")
        if (!sidebarElm) {
            const menuElm = document.querySelector(".panel-left .list-block")
            menuElm.insertAdjacentHTML("afterend", "<div id=\"farmrpg-ext-sidebar\" class=\"farmrpg-ext-sidebar\"></div>")
            sidebarElm = document.getElementById("farmrpg-ext-sidebar")
            sidebarElm.addEventListener("click", evt => {
                let target = evt.target
                while (target && !target.dataset.farmrpgextsidebarclick) {
                    target = target.parentElement
                }
                if (!target) {
                    return true
                }
                port.postMessage({action: "SIDEBAR_CLICK", target: target.dataset.farmrpgextsidebarclick})
                return false
            })
        }
        // Insert the rendered HTML.
        sidebarElm.innerHTML = html
    }

    port.onMessage.addListener(msg => {
        switch (msg.action) {
        case "UPDATE_SIDEBAR":
            renderSidebar(msg.html)
            break
        case "RELOAD_VIEW":
            const view = window.wrappedJSObject.mainView
            if (view.url == msg.url) {
                // FS already has code in place to restore the scroll position, just use that.
                const scrollTop = view.container.querySelector('.page-on-center .page-content').scrollTop
                window.wrappedJSObject.currentScroll = scrollTop
                // const handler = () => {
                //     view.container.querySelector('.page-on-center .page-content').scrollTop = scrollTop
                //     view.router.off("pageAfterIn", handler)
                //     return true
                // }
                // view.router.on("pageAfterIn", handler)
                view.router.refreshPage()
            }
            break
        }
    })

    console.log("FarmRPG-Ext loaded!")
})();
