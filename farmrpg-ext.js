(() => {
    // A kill switch to allow Firestream to disable the whole extension if needed.
    // This will force the background script to wait forever until the port connects.
    if (window.wrappedJSObject.disableFarmRPGExt) {
        return
    }

    let currentPort = null
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
                console.log("farmrpg-ext sidebar click", target)
                if (!target) {
                    return true
                }
                currentPort.postMessage({
                    action: "SIDEBAR_CLICK",
                    target: target.dataset.farmrpgextsidebarclick,
                    shift: evt.getModifierState("Shift"),
                    alt: evt.getModifierState("Alt"),
                    control: evt.getModifierState("Control"),
                    meta: evt.getModifierState("Meta"),
                })
                evt.stopImmediatePropagation()
                return false
            })
        }
        // Insert the rendered HTML.
        sidebarElm.innerHTML = html
    }

    const messageHandler = msg => {
        switch (msg.action) {
        case "UPDATE_SIDEBAR":
            if (window.wrappedJSObject.__pause_sidebar__) {
                return
            }
            renderSidebar(msg.html)
            break
        case "LOAD_CONTENT":
            window.wrappedJSObject.mainView.router.load(cloneInto({content: msg.html, pushState: false, url: "#"+msg.pageName}, window))
            if (msg.changeAction) {
                // Because the page is actually still animating, we can't depend on there being on one
                // form present. So just by convention any extension content that wants change data
                // must have pageName-form as the element ID. Sigh. In normal code this would be solved
                // by using R7 post-animation callbacks but calling those from here is a total pain.
                const formElm = document.getElementById(`${msg.pageName}-form`)
                formElm.addEventListener("change", evt => {
                    // Serialize the state of all form input and send them back.
                    const data = {}
                    for (const [key, value] of new URLSearchParams(new FormData(formElm))) {
                        // We're just going to pretend there are no overlapping inputs for now.
                        data[key] = value
                    }
                    currentPort.postMessage({
                        action: msg.changeAction,
                        data,
                    })

                    evt.stopImmediatePropagation()
                    return false
                })
            }
            break
        case "RELOAD_VIEW":
            const view = window.wrappedJSObject.mainView
            if (view.url == msg.url) {
                // FS already has code in place to restore the scroll position, just use that.
                const scrollTop = view.container.querySelector('.page-on-center .page-content').scrollTop
                window.wrappedJSObject.currentScroll = scrollTop
                view.router.refreshPage()
            } else {
                view.router.loadPage(msg.url, {ignoreCache: true})
            }
            break
        }
    }

    const connect = () => {
        const port = browser.runtime.connect()
        console.debug("FarmRPG-Ext: Port connected")
        port.onMessage.addListener(messageHandler)
        port.onDisconnect.addListener(disPort => {
            console.debug("FarmRPG-Ext: Port disconnected")
            if (port === disPort) {
                connect()
            }
        })
        currentPort = port
    }
    connect()

    console.log("FarmRPG-Ext loaded!")
})();
