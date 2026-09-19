var g_mht_max = 10;
var g_eml_max = 30;
var g_content;
var g_bloblist = [];
var g_count = 0;

function _getid(id) {
    return document.getElementById(id);
}

function setstorage(name, value) {
    if (window.localStorage) {
        localStorage[name] = value + '';
    } else {
        //setCookie(name, value, 1000*60*60*24*365*10); 
    }
}

function getsize(fileSize) {
    if (!fileSize) return '';

    function humanFileSize(bytes) {
        var thresh = 1024;
        if (bytes < thresh) return bytes + ' B';
        var units = ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        var u = -1;
        do {
            bytes /= thresh;
            ++u;
        } while (bytes >= thresh);
        return bytes.toFixed(1) + ' ' + units[u];
    }
    // return ' (' + humanFileSize(fileSize) + ')';
    return humanFileSize(fileSize);
}

function getstorage(name) {
    var s;
    if (window.localStorage) {
        s = localStorage[name];
    } else {
        //s=getCookie(name);
    }
    return s;
}

function issupportfile(filename) {
    var arr = (filename || '').split('.');
    var s = arr[arr.length - 1].toLowerCase();
    if (s == 'mht' || s == 'mhtml' || s == 'eml') return true;
    else if (arr[arr.length - 2]) {
        s = arr[arr.length - 2].toLowerCase();
        if (s == 'mht' || s == 'mhtml' || s == 'eml') return true;
    }
}

function isMHTfile(filename) {
    var arr = (filename || '').split('.');
    if (arr[arr.length - 1].toLowerCase() == 'mht' || (arr[arr.length - 2] && arr[arr.length - 2].toLowerCase() ==
        'mht'))
        return true;
    else
        return false;
}

function getmaxlimit(filename) {
    var arr = (filename || '').split('.');
    if (arr[arr.length - 1].toLowerCase() == 'eml' || (arr[arr.length - 2] && arr[arr.length - 2].toLowerCase() ==
        'eml')) return g_eml_max;
    else return g_mht_max;
}


var mhtParseMore = function(mailObject,mailparser){
    function attachToBlob(item){
        var bytes = item.content,
            n=bytes.length,
            u8arr=new Uint8Array(n);
        
        if(item.transferEncoding == 'base64'){
            bytes = base64Decode(bytes.replace(/[\n\r]/g,''));
        }
        while(n--){
            u8arr[n]=bytes.charCodeAt(n);
        }
        return new Blob([u8arr],{type:item.contentType});
    }
    function attachmentList(items){
        for (var index = 0; index < items.length; index++) {
            var item = items[index];
            if(!item.content){
                continue;
            }
            item.blobURL = URL.createObjectURL(attachToBlob(item));
        }
    }
    
    var findBlob = function(items,url){
        for (var index = 0; index < items.length; index++) {
            var item = items[index];
            if( item.contentId.indexOf(url) != -1){
                return item.blobURL;
            }
        }
        return false;
    }
    var parseImage = function(mailObject){
        if( !mailObject.attachments || 
            !mailObject.html ||
            mailObject.attachments.length == 0
        ){
            return;
        }        
        attachmentList(mailObject.attachments);
        var reg = /\s+href|src="(.*?)"/ig;
        mailObject.html = mailObject.html.replace(reg,function(match,url){
            var blobURL = findBlob(mailObject.attachments,url);
            if(blobURL){
                match = match.replace(url,blobURL);
                match += ' data-src="'+url+'" ';
            }
            //console.log(2222,match,url,blobURL);
            return match;
        });
    }

    var parseCharset = function(mailObject){
    	//中文兼容
    	if( mailObject.headers && 
    		mailObject.headers['content-type'] &&
    		mailObject.headers['content-transfer-encoding'] && 
    		mailObject.headers['content-transfer-encoding'] == '8bit' &&
    		mailObject.headers['content-type'].toLowerCase().indexOf('utf-8') != -1 ){
            mailObject.html = mailparser._convertStringToUTF8(mailObject.html);
        }
        
        if(getExt(DEFAULT_FILE_URL) == 'eml') return;
        if(!!mailObject.html && mailObject.html.indexOf('"urn:schemas-microsoft-com:office:office"') != -1){
            mailObject.html = mailparser._convertStringToUTF8(mailObject.html);
        }
    }
	mailObject.html = DOMPurify.sanitize(mailObject.html,{
		ADD_TAGS:['iframe','style','foreignObject'],
		USE_PROFILES:{html:true,mathMl:true,svg:true,svgFilters: true}
	});
    parseCharset(mailObject);
    parseImage(mailObject);
};


function proc_parse(bstring, filename) {
    function escapeRegExp(string) {
        return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    }

    function replaceAll(string, find, replace) {
        return string.replace(new RegExp(escapeRegExp(find), 'g'), replace);
    }

    if (!window.FileReader || !window.XMLHttpRequest) {
        alert("This browser does not support.");
        return;
    }
    if (bstring.length > getmaxlimit(filename) * 1000 * 1000) {
        alert('The file size is too large to view. (around ' + getmaxlimit(filename) + ' MB limit)');
        return;
    }

    for (var i = 0; i <= g_bloblist.length - 1; i++) {
        if (window.URL) window.URL.revokeObjectURL(g_bloblist[i]);
    }
    g_bloblist = [];
    g_mht = isMHTfile(filename);
    g_iserror = false;
    var mailparser = new g_MailParser();
    var ofilename = filename;
    mailparser.on("end", function(mailObject) {
        mhtParseMore(mailObject,mailparser);
        if (g_iserror) {
            alert('Error in decoding. Please check your file. Supports only EML, MHT file type.');
            return;
        }
        g_content = {};
        g_content.filename = ofilename;
        g_content.ismht = g_mht;
        g_content.subject = mailObject.subject || '';
        var s = '';

        function _address(arr) {
            var s = '';
            if (!arr) return s;
            for (var i = 0; i <= arr.length - 1; i++) {
                if (s) s += ', ';
                if (arr[i].name) s += arr[i].name + ' ';
                if (arr[i].address) s += '<' + arr[i].address + '>';
            }
            return s;
        }
        g_content.from = _address(mailObject.from) || '';
        if (g_mht) {
            s = g_content.from.replace(/[^\x00-\x7F]/g, "");
            if (s.length != g_content.from.length && s.length > (g_content.from.length * 0.6)) g_content.from =
                    trim(s);
        }
        g_content.to = _address(mailObject.to);
        g_content.cc = _address(mailObject.cc);
        g_content.date = mailObject.date;

        var s, s1, s2, s3;
        var attach = _getid("attach");
        attach.innerHTML = '';

        var ishtml = false;
        if (mailObject.html) ishtml = true;
        g_content.ishtml = ishtml;
        s = mailObject.html || mailObject.text || '';
        g_content.attachments = [];

        if (mailObject.attachments) {
            var k = 0;
            var attachsize = 0;
            var attachname = [];
            for (var i = 0; i <= mailObject.attachments.length - 1; i++) {
                var a = mailObject.attachments[i];
                if (!a.contentId || !a.content || !a.contentType || !a.transferEncoding) continue;
                s1 = a.contentType.toLowerCase();
                s2 = a.transferEncoding.toLowerCase();
                if (g_mht && ishtml) {
                    if (s1.indexOf("image/") == 0 && s2 == "base64") {
                        s = replaceAll(s, a.contentId, 'data:' + a.contentType + ';base64,' + a.content);
                    } else if (s1 == "text/css" && s2 == "quoted-printable") {
                        if (a.charset) s1 = 'data:text/css;charset=' + a.charset;
                        else s1 = 'data:text/css';
                        s = replaceAll(s, a.contentId, s1 + ',' + encodeURIComponent(a.content));
                    }
                } else {
                    if (a.contentDisposition == "attachment") {
                        if (s2 != "base64" && s2 != "uuencode") continue;
                        if (a.content instanceof Uint8Array) {
                            var u8 = new Uint8Array(a.content);
                            a.content = btoa(String.fromCharCode.apply(null, u8));
                        }
                        a.content = a.content.replace(/(\r\n|\r|\n)/g, '');



                        var link = document.createElement("A");
                        var filename = a.generatedFileName || 'No Name';
                        k++;
                        s3 = html_entity_encode(filename);
                        var tmpsize = '';
                        var s3_str = s3;
                        if (a.length) {
                            var tmp_file_size = parseInt(a.length * 0.73);
                            tmpsize = getsize(tmp_file_size);
                            s3_str += tmpsize;
                            attachsize += tmp_file_size;
                        }
                        attachname.push(filename);
                        g_content.attachments.push(s3_str);
                        g_count++;
                        link.id = 'attachlink_' + g_count;
                        // link.innerHTML = s3;
                        link.download = filename;
                        // link.title = 'Save this attachment file to computer';
                        link.setAttribute("class", "attachbox");

                        if (navigator.msSaveBlob) {
                            link.href = "#";
                            link.contentType = a.contentType;
                            link.content = a.content;
                            link.onclick = function() {
                                var blob = b64toBlob(this.content, this.contentType);
                                navigator.msSaveBlob(blob, this.download);
                                return false;
                            }
                        } else {
                            link.href = "#";
                            link.contentType = a.contentType;
                            link.content = a.content;
                            link.onclick = function() {
                                if (!window.URL) {
                                    //window.open('data:'+this.contentType+';base64,'+this.content);
                                    alert('This browser does not support.');
                                    return false;
                                } else {
                                    var blob = b64toBlob(this.content, this.contentType);
                                    var s = window.URL.createObjectURL(blob);
                                    g_bloblist.push(s);
                                    this.target = "_blank";
                                    this.href = s;
                                    this.onclick = function() {
                                        return true;
                                    };
                                    // var a = _getid((this.id || '') + 'C');
                                    // if (a) a.innerHTML = 'N';
                                    return true;
                                }
                            }
                        }
                        //link.style.display='block';	
                        attach.appendChild(link);

                        var attachdtl = document.createElement("DIV");
                        var ext = getExt(filename);
                        attachdtl.innerHTML = '<div class="icon"><i class="x-item-icon x-' + ext + '"></i></div><div class="attachinfo"><span title="' + filename + '">' + filename + '</span><br><span>' + tmpsize + '</span></div>';
                        attachdtl.setAttribute("class", "attachdtl");
                        link.appendChild(attachdtl);
                    } else {
                        if (s2 != "base64") continue;
                        if (s1.indexOf("image/") != 0) continue;
                        if (ishtml) s = replaceAll(s, 'cid:' + a.contentId, 'data:' + a.contentType + ';base64,' + a.content);
                    }
                }
            }

            // 附件个数、大小
            if (k) {
                _getid("attachbox").style.display = "";
                _getid("attachcntbox").style.display = "";
                _getid("attachcnt").innerHTML = k + '（<eml class="font-7f">' + attachname.join("; ") + '</eml>）';
                _getid("attachsizebox").style.display = "";
                _getid("attachsize").innerHTML = getsize(attachsize);
                _getid("attachicon").innerHTML = '<img class="w20" src="data:image/png;base64,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"><cnt class="head-attach-cnt">' + k + '</cnt>';
                var footattachcnt = _getid("footattachcnt").innerHTML + '（' + k + '）';
                _getid("footattachcnt").innerHTML = footattachcnt;
            }

        }
        if (ishtml) {
            s = s.replace(/top.location/gi, 'location').replace(/('|")wyciwyg:\/\/(.*?)('|")/gi, '""');
            s = '<meta name="referrer" content="no-referrer">' + s;
        }

        g_content.content = s;
        if (g_mht) {
            var match = s.match(/<title>(.*?)<\/title>/i);
            if (match && match.length > 1) {
                g_content.subject = html_entity_decode(match[1]).replace(/\s{2,}/g, ' ');
            }
        }
        if (window.JSON && s.length < 3 * 1000 * 1000) setstorage("c_g_content", JSON.stringify(g_content));
        putContent();
    });

    mailparser.write(bstring);
    mailparser.end();
}

function putContent() {
    var a = g_content;
    var date = new Date(a.date);
    var date_value = date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate() + ' ' + date.getHours() + ':' + date.getMinutes();
    var date_value2 = date_value.replace(/\//g, '-');

    var from = a.from.replace(/</g, '<eml class="font-7f">&lt;').replace(/>/g, '&gt;</eml>');
    var to = a.to.replace(/</g, '<eml class="font-7f">&lt;').replace(/>/g, '&gt;</eml>');

    _getid("headdate").innerHTML = date_value;
    _getid("from").innerHTML = from;
    if (_getid("to")) {
        _getid("to").innerHTML = to || '';
        if (a.cc) {
            var cc = a.cc.replace(/</g, '<eml class="font-7f">&lt;').replace(/>/g, '&gt;</eml>');
            _getid("cc").innerHTML = cc;
        }
        var b = _getid("date");
        if (b) b.innerHTML = date_value2 || '';
    }
    // to=“”，不是邮件
    if (to) {
        _getid("subject").innerHTML = a.subject;
        _getid("headfrom").innerHTML = from;
        _getid("headto").innerHTML = to;
        _getid("headsimple").style.display = "";
    }
    document.getElementById('relust').innerHTML = a.content;
    _getid("relust").style.borderBottom = "solid #B5C4DF 1.0pt";
    $('body').find('#waitting').remove();
}

function html_entity_decode(str) {
    str = str.replace(/&gt;/gi, ">");
    str = str.replace(/&lt;/gi, "<");
    str = str.replace(/&quot;/gi, "\"");
    str = str.replace(/&#039;/gi, "'");
    str = str.replace(/&amp;/gi, "&");
    return str;
}

function b64toBlob(b64Data, contentType, sliceSize) {
    contentType = contentType || '';
    sliceSize = sliceSize || 512;
    var byteCharacters = atob(b64Data);
    var byteArrays = [];
    for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        var slice = byteCharacters.slice(offset, offset + sliceSize);
        var byteNumbers = new Array(slice.length);
        for (var i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        var byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }
    var blob = new Blob(byteArrays, {
        type: contentType
    });
    return blob;
}


var gfiles;
function handleFileSelect(files) {
    if (!window.FileReader || !window.XMLHttpRequest) {
        alert("This browser does not support.");
        return;
    }
    if (files) gfiles = files;
    if (!gfiles || gfiles.length == 0) return;
    var tot = 0;
    for (var i = 0, f; f = gfiles[i]; i++) {
        var usearray = false;
        var f = gfiles[i];
        //console.log(f);
        if (!issupportfile(f.name)) {
            alert('Not supported. Supports only EML, MHT file type.');
            return;
        }
        var reader = new FileReader();
        reader.onload = function(e) {
            if (usearray) {
                var b = new Uint8Array(e.target.result);
                var s = '';
                var len = b.byteLength;
                for (var i = 0; i < len; i++) {
                    s += String.fromCharCode(b[i]);
                }
                proc_parse(s, this.name);
            } else {
                proc_parse(e.target.result, this.name);
            }
        };
        reader.onerror = function() {
            alert('Read Error: ' + this.name);
        };
        reader.id = i;
        reader.name = f.name;
        if (!reader.readAsBinaryString) {
            if (!reader.readAsArrayBuffer) {
                alert("This browser does not support.");
                return;
            }
            usearray = true;
            reader.readAsArrayBuffer(f);
        } else {
            //reader.readAsText(f,'ISO-8859-1');
            reader.readAsBinaryString(f);
        }
        break;
    }
}

function init2() {
    _getid('fileload').onchange = function(e) {
        if (!e || !e.target) {
            alert("This browser does not support.");
            return;
        }
        handleFileSelect(e.target.files);
    }
    if (navigator.userAgent && navigator.userAgent.toLowerCase().indexOf("windows") >= 0) {
        var a = _getid('fileload');
        a.setAttribute("accept", ".mht,.eml");
    }
    var s = getstorage('c_filetype');
    if (s) _getid('c_filetype').value = s;
}


function getExt(filename) {
    var index = filename.lastIndexOf(".");
    var ext = filename.substr(index + 1);
    return ext;
}

// 获取文件二进制流
function getemlcontent() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', DEFAULT_FILE_URL, true); // 也可以使用POST方式，根据接口
    xhr.responseType = "blob"; // 返回类型blob
    xhr.onload = function() {
        if (this.status === 200) {
            var blob = this.response;
            var reader = new FileReader();
            reader.readAsBinaryString(blob);
            reader.onload = function(e) {
                proc_parse(e.target.result, DEFAULT_FILE_NAME);
            }
        }
    };
    xhr.send()
}
getemlcontent();