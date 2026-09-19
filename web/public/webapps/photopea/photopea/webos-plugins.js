(function (){
    var dataMap = {}
    var currentFile = null;
    var checkInit = function (fn){
        if(window.appEditor){
            fn();
        }else{
            setTimeout(checkInit,100,fn);
        }
    }
    var fileGetContent = function(ext){
        var file  = appEditor.J1.PJ;
        var style = appEditor.fm;
        var width = file.Z,height= file.h;
        var option= [100,false];//PNG,JPG

        if(ext == 'PS'){ext = 'EPS';}
        if(ext == 'PSB'){ext = 'PSD';}
        if(ext == 'AI') {ext='PDF';option = ["", 100, true, false, false,["jpg"]];} // ai实际上为pdf;
        if(ext == 'JPEG') {ext='JPG';}
        if(ext == 'GIF') {option = [100];}
        if(ext == 'SVG') {option = [true, false, false, false, true, true];}
        if(ext == 'GIF' || ext == 'WEBP') {option = [100];}
        if(ext == 'EMF') {option = ["",false,false,false,[]];}
        if(ext == 'BMP' || ext == 'PPM' || ext == 'ICO' || ext == 'DDS' || ext == 'TGA') {option = [];}
        if(ext == 'TIFF' || ext == 'TIF') {ext == 'TIFF';option = [false];}
        // var rawFile   = 'raw,cr2,raf,dng,nef,srw,arw'.split(',');
        // if(rawFile.indexOf(ext.toLowerCase())) {option = [2,0,0];ext = 'RAW';}
        return appEditor.image.eX(file,ext,width,height,option,style);//
    }
    var resetViewToolbar = function(){
        var toolbarMenus  = appEditor.J1.cY;
        var toolbarMap    = 'file,edit,image,layer,select,filter,view,window,more'.split(',');
        if(!toolbarMenus) return;
        for (var i = 0; i < toolbarMenus.length; i++) {
            var menu = toolbarMenus[i].u;
            if(toolbarMap[i] == 'file'){
                menu.children[8].hidden = true;
                var div = document.createElement("div");
                div.className = "enab";
                div.innerHTML = "<span class=\"check\"></span><span class=\"label\">保存</span><span class=\"right\">⌘ + S</span>";
                menu.insertBefore(div,menu.children[9]);
                div.addEventListener("click",function (){
                    appEditor.lQ.Y3();
                    var name = appEditor.J1.PJ.name;
                    appEditor.file.save(fileGetContent("psd"),name);
                });
            }
        }
    }
    checkInit(function (){
        parent.postMessage({"action":"iframeInit"},"*");
        appEditor.setFileContent = function(name,buffer){
            if(buffer.byteLength == 0){
                var emptyPsd   = [56,66,80,83,0,1,0,0,0,0,0,0,0,3,0,0,2,-48,0,0,5,0,0,8,0,3,0,0,0,0,0,0,1,108,56,66,73,77];
                buffer = new Int8Array(emptyPsd).buffer;
            }
            appEditor.file.qt({name},buffer,appEditor.jM,null);
        };
        appEditor.file.save = function (buffer,name){
            var file = dataMap[name] || currentFile;
            parent.postMessage({"action":"saveFile",buffer,file,name},"*");
        }
        var isset = false;
        functionHook(appEditor.J1,'To',false,function(){
            if(isset) return;
            resetViewToolbar();isset = true;
        });
    });
    window.addEventListener("message",function (e){
        let data = e.data;
        if(data.action == "open"){
            currentFile = data.file;
            var name;
            if(!dataMap[data.file.name]){
                dataMap[data.file.name] = data.file;
                name = data.file.name;
            }else{
                var one = dataMap[data.file.name];
                if(one.path == data.file.path){
                    name = data.file.name;
                }else{
                    var count = 1;
                    while (true){
                        if(dataMap[count+"-"+data.file.name]){
                            count++;
                        }else{
                            break;
                        }
                    }
                    name = count+"-"+data.file.name;
                    dataMap[name] = data.file;
                }
            }
            appEditor.setFileContent(name,data.buffer);
            if(data.file.expAction == "open"){
                const canvas = document.querySelector(".pbody canvas");
            }
        }
    });
    window.functionHook = function(target, method, beforeFunc, afterFunc) {
        var context = target || window
            , _theMethod = context[method];
        if (!context || !_theMethod)
            return console.error("method error!", method);
        beforeFunc || afterFunc || (beforeFunc = function() {
                console.error("hook:" + method, arguments)
            }
        ),
            context[method] = function() {
                var args = arguments;
                if (beforeFunc) {
                    var newArgs = beforeFunc.apply(this, args);
                    if (!1 === newArgs)
                        return newArgs;
                    args = newArgs === undefined ? args : newArgs
                }
                newArgs = _theMethod.apply(this, args);
                return newArgs = afterFunc ? (args = afterFunc.apply(this, [newArgs, args])) === undefined ? newArgs : args : newArgs
            }
        ;
        var hookKey = "__hookBefore";
        target[hookKey] || (target[hookKey] = {}),
        target[hookKey][method] || (target[hookKey][method] = _theMethod),
        target["_unhook"] || (target["_unhook"] = function(methodName) {
                var beforeFunc;
                if (target[hookKey])
                    if (methodName)
                        (beforeFunc = target[hookKey][methodName]) && (target[hookKey][methodName] = null,
                            target[methodName] = beforeFunc);
                    else
                        for (var key in target[hookKey])
                            (beforeFunc = target[hookKey][key]) && (target[hookKey][key] = null,
                                target[key] = beforeFunc)
            }
        )
    }
})()