(() => {
    const port = browser.runtime.connect()
    let lastSidebar = [""]

    const renderSidebar = (html) => {
        // Store the HTML for re-rendering if needed.
        lastSidebar[0] = html
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
                evt.stopImmediatePropagation()
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
                view.router.refreshPage()
            } else {
                view.router.navigate(msg.url, {ignoreCache: true})
            }
            break
        }
    })

    console.log("FarmRPG-Ext loaded!")
})();
