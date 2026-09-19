(function (){
    var src = document.currentScript.src;
    var srcSz = src.split("/");
    srcSz.length = srcSz.length - 1;
    var host = srcSz.join("/");
    window.webHost = host;
})()