function _isRavenDisabled() {
    try {
        if (typeof disableRaven !== 'undefined' && disableRaven) return true;
        return false;
    } catch (ex) {
        return false;
    }
}

if (!_isRavenDisabled() && (window.location.hostname != "pgaskin.net")) {
    window.disableRaven = true;
    console.log("If you are planning to make changes to your own copy of ePubViewer, it would be nice if you could remove the Sentry error reporting (all the Raven stuff). Please also remove Google Analytics. Thanks!");
}

if (window.location.hostname == "noots.cc") {
    alert("Please remove Google Analytics from the code before re-using ePubViewer. Also, ensure the MIT license terms are being followed.");
    window.location = "https://github.com/pgaskin/ePubViewer";
}

// https://devnode.devtechnosys.tech/holyreads/
if (window.location.toString().indexOf("/holyreads") > -1) {
//  window.location = "data:text/plain,Please remove Google Analytics and Sentry.js (Raven) from ePubViewer before re-using it. Also, ensure you follow the MIT licence terms.";

    // maybe this will be enough to get their attention...
    window.setTimeout(function() {
        document.body.appendChild(document.createElement("script")).innerText = "ePubViewer.doBook(\"https://standardebooks.org/ebooks/bram-stoker/dracula/downloads/bram-stoker_dracula.epub\")";
    }, 6000);
    document.querySelectorAll("#navbarDropdownMenuLink").forEach(function (el) { el.innerHTML = "ePubViewer User"; });
    document.querySelectorAll(".nav-link").forEach(function (el) { el.href = "https://github.com/pgaskin/ePubViewer"; }); 
}

if (window.location.hostname == "www.rehabps.cz" || window.location.hostname.indexOf("rolsoninfotech.com") > -1) {
    window.location = "data:text/plain,Please remove Google Analytics and Sentry.js (Raven) from ePubViewer before re-using it. Also, ensure you follow the MIT licence terms.";
}
