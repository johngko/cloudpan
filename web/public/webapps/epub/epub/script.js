"use strict";
function isRavenDisabled() {
    try {
        if (typeof disableRaven !== 'undefined' && disableRaven) return true;
        if (typeof window.disableRaven !== 'undefined' && window.disableRaven) return true;
        return false;
    } catch (ex) {
        return false;
    }
}

window.onerror = function (msg, url, line, column, err) {
    if (msg.indexOf("Permission denied") > -1) return;
    if (msg.indexOf("Object expected") > -1 && url.indexOf("epub") > -1) return;
    document.querySelector(".app .error").classList.remove("hidden");
    document.querySelector(".app .error .error-title").innerHTML = "Error";
    document.querySelector(".app .error .error-description").innerHTML = "Please try reloading the page or using a different browser (Chrome or Firefox), and if the error still persists, <a href=\"https://github.com/pgaskin/ePubViewer/issues\">report an issue</a>.";
    document.querySelector(".app .error .error-info").innerHTML = msg;
    document.querySelector(".app .error .error-dump").innerHTML = JSON.stringify({
        error: err.toString(),
        stack: err.stack,
        msg: msg,
        url: url,
        line: line,
        column: column,
    });
    try {
        if (!isRavenDisabled()) Raven.captureException(err);
    } catch (err) {}
};

let App = function (el) {
    this.ael = el;
    this.state = {};
    this.doReset();

    document.body.addEventListener("keyup", this.onKeyUp.bind(this));

    this.qsa(".tab-list .item").forEach(el => el.addEventListener("click", this.onTabClick.bind(this, el.dataset.tab)));
    this.qs(".sidebar .search-bar .search-box").addEventListener("keydown", event => {
        if (event.keyCode == 13) this.qs(".sidebar .search-bar .search-button").click();
    });
    this.qs(".sidebar .search-bar .search-button").addEventListener("click", this.onSearchClick.bind(this));
    this.qs(".sidebar-wrapper").addEventListener("click", event => {
        try {
            if (event.target.classList.contains("sidebar-wrapper")) event.target.classList.add("out");
        } catch (err) {
            this.fatal("error hiding sidebar", err);
        }
    });
    this.qsa(".chips[data-chips]").forEach(el => {
        Array.from(el.querySelectorAll(".chip[data-value]")).forEach(cel => cel.addEventListener("click", event => {
            this.setChipActive(el.dataset.chips, cel.dataset.value);
        }));
    });
    this.qs("button.prev").addEventListener("click", () => this.pageChange(false));
    this.qs("button.next").addEventListener("click", () => this.pageChange(true));
    this.qs("button.open").addEventListener("click", () => this.doOpenBook());

    try {
        this.qs(".bar .loc").style.cursor = "pointer";
        this.qs(".bar .loc").addEventListener("click", event => {
            try {
                let qanswer = confirm(`请在确定后输入要跳转的位置(最大${this.state.book.locations.length()-1})`);
                if (!qanswer) return;
                let answer = prompt(`跳转到位置 (最大${this.state.book.locations.length()-1})?`, this.state.rendition.currentLocation().start.location);
                if (!answer) return;
                answer = answer.trim();
                if (answer == "") return;

                let parsed = parseInt(answer, 10);
                if (isNaN(parsed) || parsed < 0) throw new Error("Invalid location: not a positive integer");
                if (parsed > this.state.book.locations.length()) throw new Error("Invalid location");

                let cfi = this.state.book.locations.cfiFromLocation(parsed);
                if (cfi === -1) throw new Error("Invalid location");

                this.state.rendition.display(cfi);
            } catch (err) {
                alert(err.toString());
            }
        });
    } catch (err) {
        this.fatal("error attaching event handlers for location go to", err);
        throw err;
    }

    this.doTab("toc");

    try {
        this.loadSettingsFromStorage();
    } catch (err) {
        this.fatal("error loading settings", err);
        throw err;
    }
    this.applyTheme();
};

App.prototype.doBook = function (url, opts) {
    this.qs(".book").innerHTML = "Loading";

    opts = opts || {
        encoding: "epub"
    };
    console.log("doBook", url, opts);
    this.doReset();

    try {
        this.state.book = ePub(url, opts);
        this.qs(".book").innerHTML = "";
        this.state.rendition = this.state.book.renderTo(this.qs(".book"), {});
    } catch (err) {
        this.fatal("error loading book", err);
        throw err;
    }

    this.state.book.ready.then(this.onBookReady.bind(this)).catch(this.fatal.bind(this, "error loading book"));

    this.state.book.loaded.navigation.then(this.onNavigationLoaded.bind(this)).catch(this.fatal.bind(this, "error loading toc"));
    this.state.book.loaded.metadata.then(this.onBookMetadataLoaded.bind(this)).catch(this.fatal.bind(this, "error loading metadata"));
    this.state.book.loaded.cover.then(this.onBookCoverLoaded.bind(this)).catch(this.fatal.bind(this, "error loading cover"));

    this.state.rendition.hooks.content.register(this.applyTheme.bind(this));
    this.state.rendition.hooks.content.register(this.loadFonts.bind(this));

    this.state.rendition.on("relocated", this.onRenditionRelocated.bind(this));
    this.state.rendition.on("click", this.onRenditionClick.bind(this));
    this.state.rendition.on("keyup", this.onKeyUp.bind(this));
    this.state.rendition.on("displayed", this.onRenditionDisplayedTouchSwipe.bind(this));
    this.state.rendition.on("relocated", this.onRenditionRelocatedUpdateIndicators.bind(this));
    this.state.rendition.on("relocated", this.onRenditionRelocatedSavePos.bind(this));
    this.state.rendition.on("started", this.onRenditionStartedRestorePos.bind(this));
    this.state.rendition.on("displayError", this.fatal.bind(this, "error rendering book"));

    this.state.rendition.display();

    if (this.state.dictInterval) window.clearInterval(this.state.dictInterval);
    this.state.dictInterval = window.setInterval(this.checkDictionary.bind(this), 50);
    this.doDictionary(null);
};

App.prototype.loadSettingsFromStorage = function () {
    ["theme", "font", "font-size", "line-spacing", "margin", "progress"].forEach(container => this.restoreChipActive(container));
};

App.prototype.restoreChipActive = function (container) {
    let v = localStorage.getItem(`ePubViewer:${container}`);
    if (v) return this.setChipActive(container, v);
    this.setDefaultChipActive(container);
};

App.prototype.setDefaultChipActive = function (container) {
    let el = this.qs(`.chips[data-chips='${container}']`).querySelector(".chip[data-default]");
    this.setChipActive(container, el.dataset.value);
    return el.dataset.value;
};

App.prototype.setChipActive = function (container, value) {
    Array.from(this.qs(`.chips[data-chips='${container}']`).querySelectorAll(".chip[data-value]")).forEach(el => {
        el.classList[el.dataset.value == value ? "add" : "remove"]("active");
    });
    localStorage.setItem(`ePubViewer:${container}`, value);
    this.applyTheme();
    if (this.state.rendition && this.state.rendition.location) this.onRenditionRelocatedUpdateIndicators(this.state.rendition.location);
    return value;
};

App.prototype.getChipActive = function (container) {
    let el = this.qs(`.chips[data-chips='${container}']`).querySelector(".chip.active[data-value]");
    if (!el) return this.qs(`.chips[data-chips='${container}']`).querySelector(".chip[data-default]");
    return el.dataset.value;
};
App.prototype.doOpenBookByUrl = function(url){
    var that = this;
    fetch(url).then(function(res){
        return res.arrayBuffer();
    }).then(function(buffer){
        that.doBook(buffer, {
            encoding: "binary"
        });
    });
}
App.prototype.doOpenBook = function () {
    if(window.urlReader){
        return;
    }
    var fi = document.createElement("input");
    fi.setAttribute("accept", "application/epub+zip");
    fi.style.display = "none";
    fi.type = "file";
    fi.onchange = event => {
        var reader = new FileReader();
        reader.addEventListener("load", () => {
            var arr = (new Uint8Array(reader.result)).subarray(0, 2);
            var header = "";
            for (var i = 0; i < arr.length; i++) {
                header += arr[i].toString(16);
            }
            if (header == "504b") {
                this.doBook(reader.result, {
                    encoding: "binary"
                });
            } else {
                this.fatal("invalid file", "not an epub book");
            }
        }, false);
        if (fi.files[0]) {
            reader.readAsArrayBuffer(fi.files[0]);
        }
    };
    document.body.appendChild(fi);
    fi.click();
};

App.prototype.fatal = function (msg, err, usersFault) {
    console.error(msg, err);
    document.querySelector(".app .error").classList.remove("hidden");
    document.querySelector(".app .error .error-title").innerHTML = "Error";
    document.querySelector(".app .error .error-description").innerHTML = usersFault ? "" : "Please try reloading the page or using a different browser, and if the error still persists, <a href=\"https://github.com/pgaskin/ePubViewer/issues\">report an issue</a>.";
    document.querySelector(".app .error .error-info").innerHTML = msg + ": " + err.toString();
    document.querySelector(".app .error .error-dump").innerHTML = JSON.stringify({
        error: err.toString(),
        stack: err.stack
    });
    try {
        if (!isRavenDisabled()) if (!usersFault) Raven.captureException(err);
    } catch (err) {}
};

App.prototype.doReset = function () {
    if (this.state.dictInterval) window.clearInterval(this.state.dictInterval);
    if (this.state.rendition) this.state.rendition.destroy();
    if (this.state.book) this.state.book.destroy();
    this.state = {
        book: null,
        rendition: null
    };
    this.qs(".sidebar-wrapper").classList.add("out");
    this.qs(".bar .book-title").innerHTML = "";
    this.qs(".bar .book-author").innerHTML = "";
    this.qs(".bar .loc").innerHTML = "";
    this.qs(".search-results").innerHTML = "";
    this.qs(".search-box").value = "";
    this.qs(".toc-list").innerHTML = "";
    this.qs(".info .cover").src = "";
    this.qs(".info .title").innerHTML = "";
    this.qs(".info .series-info").classList.remove("hidden");
    this.qs(".info .series-name").innerHTML = "";
    this.qs(".info .series-index").innerHTML = "";
    this.qs(".info .author").innerHTML = "";
    this.qs(".info .description").innerHTML = "";
    this.qs(".book").innerHTML = '<div class="empty-wrapper"><div class="empty"><div class="app-name">电子书阅读器</div><div class="message"><a id="bookButton" href="javascript:ePubViewer.doOpenBook();" class="big-button">打开一本书</a></div></div></div>';
    this.qs(".sidebar-button").classList.add("hidden");
    this.qs(".bar button.prev").classList.add("hidden");
    this.qs(".bar button.next").classList.add("hidden");
    this.doDictionary(null);
};

App.prototype.qs = function (q) {
    return this.ael.querySelector(q);
};

App.prototype.qsa = function (q) {
    return Array.from(this.ael.querySelectorAll(q));
};

App.prototype.el = function (t, c) {
    let e = document.createElement(t);
    if (c) e.classList.add(c);
    return e;
};

App.prototype.onBookReady = function (event) {
    this.qs(".sidebar-button").classList.remove("hidden");
    this.qs(".bar button.prev").classList.remove("hidden");
    this.qs(".bar button.next").classList.remove("hidden");

    console.log("bookKey", this.state.book.key());

    let chars = 1650;
    let key = `${this.state.book.key()}:locations-${chars}`;
    let stored = localStorage.getItem(key);
    console.log("storedLocations", typeof stored == "string" ? stored.substr(0, 40) + "..." : stored);

    if (stored) return this.state.book.locations.load(stored);
    console.log("generating locations");
    return this.state.book.locations.generate(chars).then(() => {
        localStorage.setItem(key, this.state.book.locations.save());
        console.log("locations generated", this.state.book.locations);
    }).catch(err => console.error("error generating locations", err));
};

App.prototype.onZkSqItemClick = function (event) {
    var item = event.target;
    if(item.nodeName == "use"){
        item = item.parentElement;
    }
    if(item.nodeName == "svg"){
        item = item.parentElement;
    }
    var svg = '<svg style="height:14px;width:14px;"><use xlink:href="#arrow-'+(item.classList.contains("items-sq")?'b':'r')+'"></use></svg>';
    if(item.classList.contains("items-sq")){
        //展开
        item.className = "items-zk";
        item.innerHTML = svg;
        item.parentElement.querySelector("ul.items").hidden = false;
    }else{
        //收起
        item.className = "items-sq";
        item.innerHTML = svg;
        item.parentElement.querySelector("ul.items").hidden = true;
    }
};

App.prototype.onTocItemClick = function (href, event) {
    console.log("tocClick", href);
    document.querySelector(".sidebar-wrapper").click()
    this.state.rendition.display(href).catch(err => console.warn("error displaying page", err));
    event.stopPropagation();
    event.preventDefault();
};

App.prototype.getNavItem = function(loc, ignoreHash) {
    return (function flatten(arr) {
        return [].concat(...arr.map(v => [v, ...flatten(v.subitems)]));
    })(this.state.book.navigation.toc).filter(
        item => ignoreHash ?
            this.state.book.canonical(item.href).split("#")[0] == this.state.book.canonical(loc.start.href).split("#")[0] :
            this.state.book.canonical(item.href) == this.state.book.canonical(loc.start.href)
    )[0] || null;
};

App.prototype.onNavigationLoaded = function (nav) {
    console.log("navigation", nav);
    let toc = this.qs(".toc-list");
    toc.innerHTML = "";
    let ul = toc.appendChild(this.el("ul", "top-items"));
    let handleItems = (items, ul) => {
        items.forEach(item => {
            let li = ul.appendChild(this.el("li", "item"));
            if(item.subitems && item.subitems.length>0){
                let span = li.appendChild(this.el("span", "items-sq"));
                var svg = '<svg style="height:14px;width:14px;"><use xlink:href="#arrow-r"></use></svg>';
                span.innerHTML = svg;
                span.addEventListener("click", this.onZkSqItemClick.bind(this));
            }else{
                let span = li.appendChild(this.el("span", "items-zw"));
            }
            let span2 = li.appendChild(this.el("span", "item"));
            span2.innerHTML = `${item.label.trim()}`;
            span2.setAttribute("data-value",item.href);
            span2.addEventListener("click", this.onTocItemClick.bind(this, item.href));
            if(item.subitems && item.subitems.length>0){
                let tmpUl = li.appendChild(this.el("ul", "items"));
                tmpUl.hidden = true;
                handleItems(item.subitems, tmpUl);
            }
        });
    };
    handleItems(nav.toc, ul);
    /*let handleItems = (items, indent) => {
        items.forEach(item => {
            let a = toc.appendChild(this.el("a", "item"));
            a.href = item.href;
            a.dataset.href = item.href;
            a.innerHTML = `${"&nbsp;".repeat(indent*4)}${item.label.trim()}`;
            a.addEventListener("click", this.onTocItemClick.bind(this, item.href));
            handleItems(item.subitems, indent + 1);
        });
    };
    handleItems(nav.toc, 0);*/
};

App.prototype.onRenditionRelocated = function (event) {
    try {this.doDictionary(null);} catch (err) {}
    try {
        let navItem = this.getNavItem(event, false) || this.getNavItem(event, true);
        this.qsa(".toc-list .item").forEach(el => el.classList[(navItem && el.dataset.href == navItem.href) ? "add" : "remove"]("active"));
    } catch (err) {
        this.fatal("error updating toc", err);
    }
};

App.prototype.onBookMetadataLoaded = function (metadata) {
    console.log("metadata", metadata);
    this.qs(".bar .book-title").innerText = metadata.title.trim();
    document.title = metadata.title;
    this.qs(".bar .book-author").innerText = metadata.creator.trim();
    this.qs(".info .title").innerText = metadata.title.trim();
    this.qs(".info .author").innerText = metadata.creator.trim();
    if (!metadata.series || metadata.series.trim() == "") this.qs(".info .series-info").classList.add("hidden");
    this.qs(".info .series-name").innerText = metadata.series.trim();
    this.qs(".info .series-index").innerText = metadata.seriesIndex.trim();
    this.qs(".info .description").innerText = metadata.description;
    if (sanitizeHtml) this.qs(".info .description").innerHTML = sanitizeHtml(metadata.description);
};

App.prototype.onBookCoverLoaded = function (url) {
    if (!url)
        return;
    if (!this.state.book.archived) {
        this.qs(".cover").src = url;
        return;
    }
    this.state.book.archive.createUrl(url).then(url => {
        this.qs(".cover").src = url;
    }).catch(console.warn.bind(console));
};
App.prototype.pageChange = function(flag){
    var val;
    try{
        if(flag){
            val = this.state.rendition.next();
        }else{
            val = this.state.rendition.prev();
        }
    }catch(e){
        
    }
    var that = this;
    setTimeout(function(){
        var current = that.state.rendition.location.start.href;
        if(that.lastHref != current){
            that.lastHref = current;
            var spans = document.querySelectorAll("span.item-current");
            if(spans.length>0){
                for(var i=0;i<spans.length;i++){
                    spans[i].className = "item";
                }
            }
            var span = document.querySelectorAll("span[data-value*='"+current +"']")[0];
            if(span){
                span.className = "item item-current";
                var zkbt = document.querySelector(".zk-sq");
                if(zkbt.getAttribute("data-value")=="1"){
                   zkbt.click(); 
                }
                var top = span.parentElement.parentElement.offsetTop;
                document.querySelector(".tab-container").scrollTo(0,top-120);
            }
        }
    },1000);
    return val;
}
App.prototype.onKeyUp = function (event) {
    let kc = event.keyCode || event.which;
    let b = null;
    if (kc == 37) {
        this.pageChange(false);
        b = this.qs(".app .bar button.prev");
    } else if (kc == 39) {
        this.pageChange(true);
        b = this.qs(".app .bar button.next");
    }
    if (b) {
        b.style.transform = "scale(1.15)";
        window.setTimeout(() => b.style.transform = "", 150);
    }
};

App.prototype.onRenditionClick = function (event) {
    try {
        if (event.target.tagName.toLowerCase() == "a" && event.target.href) return;
        if (event.target.parentNode.tagName.toLowerCase() == "a" && event.target.parentNode.href) return;
        if (window.getSelection().toString().length !== 0) return;
        if (this.state.rendition.manager.getContents()[0].window.getSelection().toString().length !== 0) return;
    } catch (err) {}

    let wrapper = this.state.rendition.manager.container;
    let third = wrapper.clientWidth / 3;
    let x = event.pageX - wrapper.scrollLeft;
    let b = null;
    if (x > wrapper.clientWidth - 20) {
        event.preventDefault();
        this.doSidebar();
    } else if (x < third) {
        event.preventDefault();
        this.pageChange(false);
        b = this.qs(".bar button.prev");
    } else if (x > (third * 2)) {
        event.preventDefault();
        this.pageChange(true);
        b = this.qs(".bar button.next");
    }
    if (b) {
        b.style.transform = "scale(1.15)";
        window.setTimeout(() => b.style.transform = "", 150);
    }
};

App.prototype.onRenditionDisplayedTouchSwipe = function (event) {
    let start = null
    let end = null;
    let el = null;
    if(event && event.document && event.document.documentElement){
        el = event.document.documentElement;
    }
    if(!el){
        return;
    }
    el.addEventListener('touchstart', event => {
        start = event.changedTouches[0];
    });
    el.addEventListener('touchend', event => {
        end = event.changedTouches[0];

        let hr = (end.screenX - start.screenX) / el.getBoundingClientRect().width;
        let vr = (end.screenY - start.screenY) / el.getBoundingClientRect().height;

        if (hr > vr && hr > 0.25) return this.pageChange(false);
        if (hr < vr && hr < -0.25) return this.pageChange(true);
        if (vr > hr && vr > 0.25) return;
        if (vr < hr && vr < -0.25) return;
    });
};

App.prototype.applyTheme = function () {
    let theme = {
        bg: this.getChipActive("theme").split(";")[0],
        fg: this.getChipActive("theme").split(";")[1],
        l: "#1e83d2",
        ff: this.getChipActive("font"),
        fs: this.getChipActive("font-size"),
        lh: this.getChipActive("line-spacing"),
        ta: "justify",
        m: this.getChipActive("margin")
    };

    let rules = {
        "body": {
            "background": theme.bg,
            "color": theme.fg,
            "font-family": theme.ff != "" ? `${theme.ff} !important` : "!invalid-hack",
            "font-size": theme.fs != "" ? `${theme.fs} !important` : "!invalid-hack",
            "line-height": `${theme.lh} !important`,
            "text-align": `${theme.ta} !important`,
            "padding-top": theme.m,
            "padding-bottom": theme.m
        },
        "p": {
            "font-family": theme.ff != "" ? `${theme.ff} !important` : "!invalid-hack",
            "font-size": theme.fs != "" ? `${theme.fs} !important` : "!invalid-hack",
        },
        "a": {
            "color": "inherit !important",
            "text-decoration": "none !important",
            "-webkit-text-fill-color": "inherit !important"
        },
        "a:link": {
            "color": `${theme.l} !important`,
            "text-decoration": "none !important",
            "-webkit-text-fill-color": `${theme.l} !important`
        },
        "a:link:hover": {
            "background": "rgba(0, 0, 0, 0.1) !important"
        },
        "img": {
            "max-width": "100% !important"
        },
    };

    try {
        this.ael.style.background = theme.bg;
        this.ael.style.fontFamily = theme.ff;
        this.ael.style.color = theme.fg;
        if(this.state.rendition) this.state.rendition.getContents().forEach(c => c.addStylesheetRules(rules));
    } catch (err) {
        console.error("error applying theme", err);
    }
};

App.prototype.loadFonts = function() {
    // CloudPan 移植：原实现向每页注入 Google Fonts CDN 样式表（被 CSP style-src 阻断，
    // 且引入外部依赖）。改为注入自托管 fonts.css（绝对路径同源，style-src 'self' 放行）
    this.state.rendition.getContents().forEach(c => {
        let el = c.document.body.appendChild(c.document.createElement("link"));
        el.setAttribute("rel", "stylesheet");
        el.setAttribute("href", location.origin + "/webapps/epub/epub/fonts/fonts.css");
    });
};

App.prototype.onRenditionRelocatedUpdateIndicators = function (event) {
    try {
        if (this.getChipActive("progress") == "bar") {
            // TODO: don't recreate every time the location changes.
            this.qs(".bar .loc").innerHTML = "";
            
            let bar = this.qs(".bar .loc").appendChild(document.createElement("div"));
            bar.style.position = "relative";
            bar.style.width = "60vw";
            bar.style.cursor = "default";
            bar.addEventListener("click", ev => ev.stopImmediatePropagation(), false);

            let range = bar.appendChild(document.createElement("input"));
            range.type = "range";
            range.style.width = "100%";
            range.min = 0;
            range.max = this.state.book.locations.length();
            range.value = event.start.location;
            range.addEventListener("change", () => this.state.rendition.display(this.state.book.locations.cfiFromLocation(range.value)), false);

            let markers = bar.appendChild(document.createElement("div"));
            markers.style.position = "absolute";
            markers.style.width = "100%";
            markers.style.height = "50%";
            markers.style.bottom = "0";
            markers.style.left = "0";
            markers.style.right = "0";

            for (let i = 0, last = -1; i < this.state.book.locations.length(); i++) {
                try {
                    let parsed = new ePub.CFI().parse(this.state.book.locations.cfiFromLocation(i));
                    if (parsed.spinePos < 0 || parsed.spinePos == last)
                        continue;
                    last = parsed.spinePos;

                    let marker = markers.appendChild(document.createElement("div"));
                    marker.style.position = "absolute";
                    marker.style.left = `${this.state.book.locations.percentageFromLocation(i) * 100}%`;
                    marker.style.width = "4px";
                    marker.style.height = "30%";
                    marker.style.cursor = "pointer";
                    marker.style.opacity = "0.5";
                    marker.addEventListener("click", this.onTocItemClick.bind(this, this.state.book.locations.cfiFromLocation(i)), false);

                    let tick = marker.appendChild(document.createElement("div"));
                    tick.style.width = "1px";
                    tick.style.height = "100%";
                    tick.style.backgroundColor = "currentColor";
                } catch (ex) {
                    console.warn("Error adding marker for location", i, ex);
                }
            }

            return;
        }

        let stxt = "Loading";
        if (this.getChipActive("progress") == "none") {
            stxt = "";
        } else if (this.getChipActive("progress") == "location" && event.start.location > 0) {
            stxt = `${event.start.location}/${this.state.book.locations.length()}`
        } else if (this.getChipActive("progress") == "chapter") {
            let navItem = this.getNavItem(event, false) || this.getNavItem(event, true);
            stxt = navItem ? navItem.label.trim() : (event.start.percentage > 0 && event.start.percentage < 1) ? `${Math.round(event.start.percentage * 100)}%` : "";
        } else {
            stxt = (event.start.percentage > 0 && event.start.percentage < 1) ? `${Math.round(event.start.percentage * 1000)/10}%` : "";
        }
        this.qs(".bar .loc").innerHTML = stxt;
    } catch (err) {
        console.error("error updating indicators");
    }
};

App.prototype.onRenditionRelocatedSavePos = function (event) {
    localStorage.setItem(`${this.state.book.key()}:pos`, event.start.cfi);
};

App.prototype.onRenditionStartedRestorePos = function (event) {
    try {
        let stored = localStorage.getItem(`${this.state.book.key()}:pos`);
        console.log("storedPos", stored);
        if (stored) this.state.rendition.display(stored);
    } catch (err) {
        this.fatal("error restoring position", err);
    }
};

App.prototype.checkDictionary = function () {
    try {
        let selection = (this.state.rendition.manager && this.state.rendition.manager.getContents().length > 0) ? this.state.rendition.manager.getContents()[0].window.getSelection().toString().trim() : "";
        if (selection.length < 2 || selection.indexOf(" ") > -1) {
            if (this.state.showDictTimeout) window.clearTimeout(this.state.showDictTimeout);
            this.doDictionary(null);
            return;
        }
        this.state.showDictTimeout = window.setTimeout(() => {
            try {
                let newSelection = this.state.rendition.manager.getContents()[0].window.getSelection().toString().trim();
                if (newSelection == selection) this.doDictionary(newSelection);
            } catch (err) {console.error(`showDictTimeout: ${err.toString()}`)}
        }, 300);
    } catch (err) {console.error(`checkDictionary: ${err.toString()}`)}
};

App.prototype.doDictionary = function (word) {
    return;
    if (this.state.lastWord) if (this.state.lastWord == word) return;
    this.state.lastWord = word;

    if (!this.qs(".dictionary-wrapper").classList.contains("hidden")) console.log("hide dictionary");
    this.qs(".dictionary-wrapper").classList.add("hidden");
    this.qs(".dictionary").innerHTML = "";
    if (!word) return;

    console.log(`define ${word}`);
    this.qs(".dictionary-wrapper").classList.remove("hidden");
    this.qs(".dictionary").innerHTML = "";

    let ldefinitionEl = this.qs(".dictionary").appendChild(document.createElement("div"));
    ldefinitionEl.classList.add("definition");

    let lwordEl = ldefinitionEl.appendChild(document.createElement("div"));
    lwordEl.classList.add("word");
    lwordEl.innerText = word;

    let lmeaningsEl = ldefinitionEl.appendChild(document.createElement("div"));
    lmeaningsEl.classList.add("meanings");
    lmeaningsEl.innerHTML = "Loading";

    fetch(`https://dict.api.pgaskin.net/word/${encodeURIComponent(word)}`).then(resp => {
        if (resp.status >= 500) throw new Error(`Dictionary not available`);
        if (resp.status == 404) throw new Error(`Word not found`);
        return resp.json();
    }).then(obj => {
        if (obj.status == "error") throw new Error(`ApiError: ${obj.result}`);
        return obj.result;
    }).then(obj => {
        console.log("dictLookup", obj);

        ldefinitionEl.parentElement.removeChild(ldefinitionEl);

        [obj].concat(obj.additional_words || []).concat(obj.referenced_words || []).map(word => {
            let definitionEl = this.qs(".dictionary").appendChild(document.createElement("div"));
            definitionEl.classList.add("definition");

            let wordEl = definitionEl.appendChild(document.createElement("div"));
            wordEl.classList.add("word");
            wordEl.innerText = [word.word].concat(word.alternates || []).join(", ").toLowerCase();

            let meaningsEl = definitionEl.appendChild(document.createElement("div"));
            meaningsEl.classList.add("meanings");

            if (word.info && word.info.trim() != "") {
                let infoEl = meaningsEl.appendChild(document.createElement("div"));
                infoEl.classList.add("info");
                infoEl.innerText = word.info;
            }

            (word.meanings || []).map((meaning, i) => {
                let meaningEl = meaningsEl.appendChild(document.createElement("div"));
                meaningEl.classList.add("meaning");

                let meaningTextEl = meaningEl.appendChild(document.createElement("div"));
                meaningTextEl.classList.add("text");
                meaningTextEl.innerText = `${i + 1}. ${meaning.text}`;

                if (meaning.example && meaning.example.trim() != "") {
                    let meaningExampleEl = meaningEl.appendChild(document.createElement("div"));
                    meaningExampleEl.classList.add("example");
                    meaningExampleEl.innerText = meaning.example;
                }
            });

            (word.notes || []).map(note => {
                let noteEl = meaningsEl.appendChild(document.createElement("div"));
                noteEl.classList.add("note");
                noteEl.innerText = note;
            });
        
            if (word.credit && word.credit.trim() != "") {
                let creditEl = meaningsEl.appendChild(document.createElement("div"));
                creditEl.classList.add("credit");
                creditEl.innerText = word.credit;
            }
        });
    }).catch(err => {
        try {
            console.error("dictLookup", err);
            lmeaningsEl.innerText = err.toString();
        } catch (err) {}
    });
};
App.prototype.doFullOrCloseScreen = () => {
    
    if(!document.fullscreenElement){
        //全屏
        var de = document.documentElement;
        var full = de.requestFullscreen||de.msRequestFullscreen||de.mozRequestFullScreen||de.webkitRequestFullscreen;
        full.apply(de);
    }else{
        //退出全屏
        var exitFull = document.exitFullscreen||document.msExitFullscreen||document.mozCancelFullScreen||document.webkitExitFullscreen;
        exitFull.apply(document);
    }
}

App.prototype.doFullscreen = () => {
    document.fullscreenEnabled = document.fullscreenEnabled || document.mozFullScreenEnabled || document.documentElement.webkitRequestFullScreen;

    let requestFullscreen = element => {
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
        } else if (element.webkitRequestFullScreen) {
            element.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
        }
    };

    if (document.fullscreenEnabled) {
        requestFullscreen(document.documentElement);
    }
};

App.prototype.doSearch = function (q) {
    return Promise.all(this.state.book.spine.spineItems.map(item => {
        return item.load(this.state.book.load.bind(this.state.book)).then(doc => {
            let results = item.find(q);
            item.unload();
            return Promise.resolve(results);
        });
    })).then(results => Promise.resolve([].concat.apply([], results)));
};
if(!String.prototype.replaceAll){
    String.prototype.replaceAll = function(a,b){
        var r = new RegExp(a,"gi");
        return this.replace(r,b);
    }
}

function actionSearchWords(keywords){
    (function(){
        var win = document.querySelectorAll("iframe")[0].contentWindow;
        if(win.hasSetStartInit){
            return;
        }else{
            win.hasSetStartInit = true;
            var setStart = win.Range.prototype.setStart;
            win.Range.prototype.setStart = function(...args){
                if(args[1] > args[0].length - 1){
                    args[1] = args[0].length - 1;
                }
                if(args[1] < 0){
                    args[1] = 0;
                }
                return setStart.apply(this,args);
            }
        }
        if(win.hasSetEndInit){
            return;
        }else{
            win.hasSetEndInit = true;
            var setEnd = win.Range.prototype.setEnd;
            win.Range.prototype.setEnd = function(...args){
                if(args[1] > args[0].length - 1){
                    args[1] = args[0].length - 1;
                }
                if(args[1] < 0){
                    args[1] = 0;
                }
                return setEnd.apply(this,args);
            }
        }
    })()
    var doc = document.querySelectorAll("iframe")[0].contentWindow.document;
    var list = doc.body.querySelectorAll("p");
    var left = "<span class=\"gaoliang\" style=\"background: yellow;\">";
    var right = "</span>";
    for(var i=0;i<list.length;i++){
        var p = list[i];
        var spans = p.querySelectorAll("span.gaoliang");
        if(spans.length>0){
            var oldWords = spans[0].innerHTML;
            var tmp = p.innerHTML.replaceAll(left+oldWords+right,oldWords);
            p.innerHTML = tmp;
        }
        if(!keywords){
            continue;
        }
        if(p.innerHTML.indexOf(keywords) !=-1){
            var tmp = p.innerHTML.replaceAll(keywords,left+keywords+right);
            p.innerHTML = tmp;
        }
    }
    
}

App.prototype.onResultClick = function (href, event) {
    var that = this;
    document.querySelector(".sidebar-wrapper").click();
    var searchWords = this.searchWords;
    that.state.rendition.display(href);
    if(searchWords){
        setTimeout(function(){
            that.state.rendition.display(href);
            actionSearchWords(searchWords);
        },300);
    };
    event.stopPropagation();
    event.preventDefault();
};

App.prototype.doTab = function (tab) {
    try {
        this.qsa(".tab-list .item").forEach(el => el.classList[(el.dataset.tab == tab) ? "add" : "remove"]("active"));
        this.qsa(".tab-container .tab").forEach(el => el.classList[(el.dataset.tab != tab) ? "add" : "remove"]("hidden"));
        try {
            this.qs(".tab-container").scrollTop = 0;
        } catch (err) {}
    } catch (err) {
        this.fatal("error showing tab", err);
    }
};

App.prototype.onTabClick = function (tab, event) {
    console.log("tabClick", tab);
    this.doTab(tab);
    event.stopPropagation();
    event.preventDefault();
};

App.prototype.onSearchClick = function (event) {
    var keywords = this.qs(".sidebar .search-bar .search-box").value.trim();
    document.querySelector("#qp-mask").style.display = "block";
    this.doSearch(keywords).then(results => {
        this.qs(".sidebar .search-results").innerHTML = "";
        let resultsEl = document.createDocumentFragment();
        if(results.length == 0){
            let resultEl = resultsEl.appendChild(this.el("div", "item"));
            resultEl.innerHTML = "本电子书没有您搜索的关键字，请精简或更换关键字试试";
        }else{
            this.searchWords = keywords;
            results.slice(0, 200).forEach(result => {
                let resultEl = resultsEl.appendChild(this.el("a", "item"));
                resultEl.href = result.cfi;
                resultEl.addEventListener("click", this.onResultClick.bind(this, result.cfi));
    
                let textEl = resultEl.appendChild(this.el("div", "text"));
                var rKeywords = new RegExp(keywords,"gi");
                textEl.innerHTML = result.excerpt.trim().replace(rKeywords,"<span style=\"color:red;\">"+keywords+"</span>");
    
                resultEl.appendChild(this.el("div", "pbar")).appendChild(this.el("div", "pbar-inner")).style.width = (this.state.book.locations.percentageFromCfi(result.cfi)*100).toFixed(3) + "%";
            });
        }
        this.qs(".app .sidebar .search-results").appendChild(resultsEl);
        document.querySelector("#qp-mask").style.display = "none";
    }).catch(err => document.querySelector("#qp-mask").style.display = "none");
};

App.prototype.doSidebar = function () {
    this.qs(".sidebar-wrapper").classList.toggle('out');
};
App.prototype.allZkSq = function(that){
    var ans;
    if(that.getAttribute("data-value") == "1"){
        that.setAttribute("data-value","2");
        that.innerHTML = "收起";
        ans = document.querySelectorAll(".items-sq");
    }else{
        that.setAttribute("data-value","1");
        that.innerHTML = "展开";
        ans = document.querySelectorAll(".items-zk");
    }
    for(var i=0;i<ans.length;i++){
        ans[i].click();
    }
}

let ePubViewer = null;

try {
    ePubViewer = new App(document.querySelector(".app"));
} catch (err) {
    document.querySelector(".app .error").classList.remove("hidden");
    document.querySelector(".app .error .error-title").innerHTML = "Error";
    document.querySelector(".app .error .error-description").innerHTML = "Please try reloading the page or using a different browser (Chrome or Firefox), and if the error still persists, <a href=\"https://github.com/pgaskin/ePubViewer/issues\">report an issue</a>.";
    document.querySelector(".app .error .error-dump").innerHTML = JSON.stringify({
        error: err.toString(),
        stack: err.stack
    });
    try {
        if (!isRavenDisabled) Raven.captureException(err);
    } catch (err) {}
}
(function(){
    var url = new URL(window.location.href);
    var bookUrl = url.searchParams.get("url");
    if(bookUrl){
        var ua = navigator.userAgent.toLowerCase();
        var isWx = ua.indexOf("micromessenger")!=-1;
        var isIos = ua.indexOf("ipad")!=-1 || ua.indexOf("ios")!=-1;
        if(isWx&&isIos){
            alert("当前不支持苹果微信浏览器,请右上角三个点选择'在默认浏览器中打开'");
        }
        window.urlReader = true;
        bookButton.innerHTML = "正在打开...请稍后";
        ePubViewer.doOpenBookByUrl(bookUrl);
    }
})()