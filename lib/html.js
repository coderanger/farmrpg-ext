export const renderRowText = (text) => {
    return `
    <li class="farmrpg-ext-row">
        <div class="item-content">
            <div class="item-inner">
                ${text}
            <div>
        </div>
    </li>
    `
}

export const renderRowCheckbox = (label, name, checked, value = "1") => {
    const checkedAttr = checked ? 'checked="checked"' : ""
    return `
    <li class="farmrpg-ext-row">
        <div class="item-content">
            <div class="item-inner">
                <div class="item-title label" style="width:60%">${label}</div>
                <label class="label-switch">
                    <input type="checkbox" name="${name}" value="${value}" ${checkedAttr}>
                    <div class="checkbox"></div>
                </label>
            </div>
        </div>
    </li>
    `
}

export const renderListBlock = (label, options, rows) => {
    return `
    <div class="content-block-title">${label}</div>
    <div class="list-block ${options.inset ? 'inset' : ''}">
        <ul>
            ${rows.join("\n")}
        </ul>
    </div>
    `
}

export const renderPage = (title, name, content) => {
    if (!Array.isArray(content)) {
        content = [content]
    }
    return `
    <div class="navbar">
        <div class="navbar-inner">
            <div class="left"><a href="x" class="back link"> <i class="icon icon-back"></i><span>Back</span></a></div>
            <div class="center sliding">${title}</div>
            <div class="right"><a href="x" data-panel="left" class="link open-panel icon-only"><i class="icon icon-bars"></i></a></div>
        </div>
    </div>
    <div class="pages">
        <div data-page="farmrpg-ext-${name}" class="page">
            <div class="page-content">
                <div class="content-block">
                    <form id="farmrpg-ext-${name}-form">
                    ${content.join("\n")}
                    </form>
                </div>
            </div>
        </div>
    </div>
    `
}
