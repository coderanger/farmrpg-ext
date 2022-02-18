const renderCheckboxSetting = (state, label, name, value = "1") => {
    const checked = state.player.settings[name] === value ? 'checked="checked"' : ""
    return `
    <li>
        <div class="item-content">
            <div class="item-inner">
                <div class="item-title label" style="width:60%">${label}</div>
                <label class="label-switch">
                    <input type="checkbox" name="${name}" value="${value}" ${checked}>
                    <div class="checkbox"></div>
                </label>
            </div>
        </div>
    </li>
    `
}

const renderPerksetSettings = state => {
    if (state.player.perksets === undefined || Object.keys(state.player.perksets).length <= 1) {
        // Perksets not available or none defined or only one defined, no need for switcher.
        return ""
    }
    const perksets = Object.entries(state.player.perksets)
    perksets.sort((a, b) => a[1] - b[1])
    const perksetRows = perksets.map(([perksetName, perksetID]) =>
        renderCheckboxSetting(state, perksetName, `perkset_${perksetID}`)
    )

    return `
    <div class="content-block-title">Perksets</div>
    <div class="list-block inset">
        <ul>
            ${perksetRows.join("\n")}
        </ul>
    </div>
    `
}

const renderSettings = state => {
    const html = `
    <div class="navbar">
        <div class="navbar-inner">
            <div class="left"><a href="x" class="back link"> <i class="icon icon-back"></i><span>Back</span></a></div>
            <div class="center sliding">FarmRPG-Ext Settings</div>
            <div class="right"><a href="x" data-panel="left" class="link open-panel icon-only"><i class="icon icon-bars"></i></a></div>
        </div>
    </div>
    <div class="pages">
        <div data-page="farmrpg-ext-settings" class="page">
            <div class="page-content">
                <div class="content-block">
                    <form id="farmrpg-ext-settings-form">
                    ${renderPerksetSettings(state)}
                    </form>
                </div>
            </div>
        </div>
    </div>
    `
    state.postMessage({action: "LOAD_CONTENT", changeAction: "SETTINGS", pageName: "farmrpg-ext-settings", html})
}

const updateSettings = async (state, msg) => {
    console.log(msg.data)
    state.player.settings = msg.data
    await state.player.save(state.db)
}

export const setupSettings = state => {
    state.addClickHandler("settings", renderSettings)
    state.addPostMessageHandler("SETTINGS", updateSettings)
}
