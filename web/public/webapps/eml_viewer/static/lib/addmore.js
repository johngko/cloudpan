window.URL = (window.URL || window.webkitURL);
var issafari = false;
var ua = navigator.userAgent.toLowerCase();
if (ua.indexOf('safari') != -1 && ua.indexOf('chrome') < 0) {
    issafari = true;
}

var g_mht_max = 10;
var g_eml_max = 30;
var g_content;
var g_bloblist = [];
var g_count = 0;

function clean(str) {
    if (!str) str = '';
    str = str.replace(/>/gi, "&gt;").replace(/</gi, "&lt;");
    return str;
}

function proc_print() {
    if (!g_content) {
        alert('No content to be printed.');
        return;
    }
    var win = window.open('', 'mhtviewer0124');
    if (win) var doc = win.document;
    if (!win || !doc) {
        alert('Error!!');
        return;
    }
    var title = g_content.filename || g_content.subject || 'No Name';
    if (_getid('c_prefertitle').value == 'subject') title = g_content.subject || g_content.filename || 'No Name';
    var s1 = '<title>' + clean(title) + '</title><table style="margin-bottom:10px;font-size:15px;font-family:Arial;">';
    s1 += '<tr><td valign=top>Subject:&nbsp;<td>' + clean(g_content.subject);
    s1 += '<tr><td valign=top>From:&nbsp;<td>' + clean(g_content.from);
    if (g_content.to) {
        s1 += '<tr><td valign=top>To:&nbsp;<td>' + clean(g_content.to);
        if (g_content.cc) s1 += '<tr><td valign=top>Cc:&nbsp;<td>' + clean(g_content.cc);
        if (g_content.date) s1 += '<tr><td valign=top>Date:&nbsp;<td>' + clean(g_content.date + '');
    }
    if (g_content.filename) s1 += '<tr><td valign=top>Filename:&nbsp;<td>' + clean(g_content.filename);
    if (g_content.attachments && g_content.attachments.length > 0) {
        s1 += '<tr><td valign=top>Attachment Files:&nbsp;<td>';
        for (var i = 0; i <= g_content.attachments.length - 1; i++) {
            s1 += g_content.attachments[i];
            if (i < g_content.attachments.length - 1) s1 += '<br>';
        }
    }
    s1 += '</table>';
    s1 += (g_content.content || '');
    doc.write(s1);
    doc.close();
}

function proc_more(more, less) {
    var headdtl = _getid("headdtl");
    if (headdtl.style.display == 'none') {
        // headdtl.style.display = '';
        $("#headdtl").slideDown();
        _getid("moredtl").innerHTML = less;

    } else {
        // headdtl.style.display = 'none';
        $("#headdtl").slideUp();
        _getid("moredtl").innerHTML = more;
    }
}

function _getfrmdoc(ifrm) {
    return (ifrm.contentWindow) ? ifrm.contentWindow : (ifrm.contentDocument.document) ? ifrm.contentDocument.document : ifrm.contentDocument;
}
function proc_gohome() {
    var a = _getid("viewer");
    a.style.display = '';
    a.src = 'viewer.php';
}