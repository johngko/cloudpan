(function(){
	window.$BODY = $('body');// jquery 对象会重置;
	var drawURL = BASE_URL + 'methodDraw/';
	var langCurrent = appLang || 'zh';
	$BODY.bind('languageChange',function(){
		if(!window.drawLang) return;
		drawLang.change(langCurrent);
	});
	$BODY.bind('languageLoad',function(){
		$BODY.trigger('languageChange');
	});

	var editorClear = function(){
		var dims = state.get("canvasSize");
		state.set("canvasMode", "select")
    	svgCanvas.clear();
    	svgCanvas.setResolution(dims[0], dims[1]);
    	editor.canvas.update(true);
    	editor.zoom.reset();
    	editor.panel.updateContextPanel();
    	editor.paintBox.fill.prep();
    	editor.paintBox.stroke.prep();
    	svgCanvas.runExtensions('onNewDocument');
		editor.canvas.resize(600,400);
	}
	var initView = function(){
		$.dialog = artDialog;
		$('<div class="separator"></div><div id="tool_download" class="menu_item" style="">Download</div>').insertBefore('#tool_export');
		$('#tool_clear').remove();
		
		$('<div class="file-title"><span></span><i class="ri-folder-fill-3 folder"></i></div>').appendTo("#menu_bar");
		$('.file-title .folder').bind('click',function(){
			var filePath = $(this).attr('data-path');
			filePath && kodApi.folderView(filePath);
		});
		
		// 焦点快捷键处理(打开文件管理后,点击文件进入焦点); svg界面没有焦点问题处理;
		// document.addEventListener("keydown"
		$BODY.delegate('#workarea','mouseup',function(evt){
			$(evt.target).focus();$(':focus').blur();
			setTimeout(function(){
				$(evt.target).focus();$(':focus').blur();//确保焦点在当前页面;
			},600);
		});
		
		editor.saveSVG = editor.save;
		editor.save = function(){
			var content = svgCanvas.getSvgString(); //getSvgString svgCanvasToString
			fileSaveCreate(content);
		}
		$("#tool_download").bind('click',function(){
			editor.saveSVG();
		});
		var $title = $('#canvas_title');
		$title.bind('change blur',function(){
			FILE_INFO.fileName = $title.val()+'.svg';
			fileReloadInfo();
		});
		$('#tool_open').unbind('click').bind('click',fileSelectOpen);
	}	

	var fileOpen = function(url,name,filePath,canWrite){
		FILE_INFO = {
			fileUrl:url,
			fileName:name,
			savePath:filePath,
			canWrite:canWrite
		};
		fileReload();
	};
	var fileSelectOpen = function(){
		kodApi.fileSelect({
			title:"打开文件",
			allowExt:'svg',
			callback:function(result){  // 回调地址;
				if(FILE_INFO.fileUrl){
					var param = '&path='+urlEncode(result.path)+'&name='+urlEncode(result.name);
					return window.open(BASE_URL_API + param);
				}
				fileOpen(result.downloadPath,result.name,result.path,true);
			}
		});
	}
		
	var fileReloadInfo = function(){
		var fileInfo = FILE_INFO;
		fileInfo.fileName = fileInfo.fileName || '新建文件.svg';
		var name = fileInfo.fileName;
		if(!fileInfo.savePath){//未保存文件;
			if(!fileInfo.fileUrl){name = name ? '*' + name : '';}
			$('.file-title').removeClass('true-file');
		}else{
			$('.file-title').addClass('true-file');
			$('#canvas_title').attr('readonly','true').parent().addClass('disabled');
		}
				
		document.title = name + ' - SVG Editor';
		$('.file-title span').html(htmlEncode(name));
		$('.file-title .folder').attr('data-path',fileInfo.savePath||"");
		
		var beforeTitle = state.get('canvasTitle');
		var newTitle    = fileInfo.fileName.replace('.svg','');
		if(beforeTitle != newTitle){state.set("canvasTitle",newTitle);}
	}
	
	var fileReload = function(){
		editorClear();
		fileReloadInfo();
		if(!FILE_INFO.fileUrl) return false;
		var tipsLoading = Tips.loadingMask(false,false,0.5);
		$.ajax({
			type:'GET',
			dataType:'text',
			url:FILE_INFO.fileUrl,
			processDownload:function(percent){tipsLoading.title(Math.round(percent*100)+'%');},
			success:function(data){
				tipsLoading.close();
				if(!data) return
				var success = svgCanvas.setSvgString(data) !== false;
				if(success) {
					editor.saveCanvas();
					state.set("canvasTitle",svgCanvas.getDocumentTitle());
				}else{
					Tips.tips('Error: Unable to load SVG data',false,3000);
				}
				svgCanvas.undoMgr.resetUndoStack();
			}
		});
	};

	var fileSaveCreate = function(content,callback){
		if(FILE_INFO.savePath){
			return kodApi.fileSave(FILE_INFO.savePath,content,callback);
		}
		kodApi.fileCreate(FILE_INFO.fileName,content,function(data){
			FILE_INFO.fileUrl  = '---';
			FILE_INFO.fileName = data.name,
			FILE_INFO.savePath = data.path,
			FILE_INFO.canWrite = true;
			fileReloadInfo();
			callback && callback();
	   });
	}
	
	window.pageLoadBefore = function(){
		var _SvgCanvas = $.SvgCanvas;
		$.SvgCanvas = function(dom){
			return new _SvgCanvas(dom,{defaultFont:'Arial'});
		};		
		functionHook(svgedit.select,'init',function(config){
			config.imgPath = drawURL + 'images/';
		});
		functionHook($,'getJSON',function(){
			arguments[0] = drawURL + 'js/' + arguments[0];
			return arguments;
		});
		functionHook($,'getScript',function(){
			arguments[0] = drawURL + arguments[0];
			return arguments;
		});
		
		functionHook($.fn,'jGraduate',function(options){
			options.images.clientPath = drawURL + 'images/';
		},function(){
			setTimeout(function(){$BODY.trigger('languageChange');},5);
		});
		
		// 导入svg; 撤销报错处理; (添加历史记录,数据校验)
		functionHook(svgedit.history.BatchCommand.prototype,'addSubCommand',function(cmd){
			if(!cmd) return false;
		});
		functionHook(svgedit.history.BatchCommand.prototype,'unapply',function(handler){
			var selected = [];
			$.each(svgCanvas.getSelectedElems(),function(key,val){
				if(val){selected.push(val);}
			});
			if(handler){handler.handleHistoryEvent(svgedit.history.HistoryEventTypes.BEFORE_UNAPPLY,this);}
			for (var i = this.stack.length-1; i >= 0; i--) {this.stack[i] && this.stack[i].unapply();}//避免重复调用
			if(handler){handler.handleHistoryEvent(svgedit.history.HistoryEventTypes.AFTER_UNAPPLY,this);}
			
			// 撤销后; 保持之前选中元素;
			setTimeout(function(){
				if(!selected.length) return;
				// console.error(201,selected);
				svgCanvas.addToSelection(selected,true);
			},0);
			return false;
		});
	}
	var svgBackageSet = false;
	var resetBackground = function(){
		if(!svgBackageSet){
			var image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAQMAAABsu86kAAAAA3NCSVQICAjb4U/gAAAABlBMVEXu7u7///8o06qaAAAACXBIWXMAAAsSAAALEgHS3X78AAAAFXRFWHRDcmVhdGlvbiBUaW1lADcvMjIvMTL7FNdCAAAAHHRFWHRTb2Z0d2FyZQBBZG9iZSBGaXJld29ya3MgQ1M1cbXjNgAAABFJREFUCJljYP7AgIb+MKAhAM8/C5vWL6zSAAAAAElFTkSuQmCC';
			var html = '<pattern id="opacity_image_bg" patternUnits="userSpaceOnUse" width="12" height="12">\
				<image xlink:href="'+image+'" x="0" y="0" width="12" height="12" /></pattern>';
			$('#placeholder_defs').html(html);
			svgBackageSet = true;
		}		
		$("#canvasBackground rect").attr("fill","url(#opacity_image_bg)");
	}
	
	window.pageLoadAfter = function(){
		window.jQueryLoad();
		initView();
		fileReload();
		$BODY.trigger('languageChange');
		$('body').addClass('page-loaded');
		
		resetBackground();//默认设置为透明背景;
		functionHook(svgCanvas,'setBackground',false,function(res,args){
			if(args[0] === 'none'){resetBackground();}
		});
		
		
		// 贝塞尔路径调整; 锚点调整支持撤销;
		functionHook(svgCanvas.pathActions,'mouseUp',function(){
			if(!svgedit.path.path || !svgedit.path.path.dragging) return;
			var svgTarget = svgedit.path.path,objects = svgCanvas.getPrivateMethods();
			var cmd = new objects.ChangeElementCommand(svgTarget.elem,{d:svgTarget.last_d});
			svgCanvas.undoMgr.addCommandToHistory(cmd);
			// console.error(123,[svgTarget,cmd]);
		});
		
		// 贝塞尔曲线:支持点删除;
		var _oldPath = false;
		functionHook(svgCanvas.pathActions,'deletePathNode',function(){
			if(!svgedit.path.path || !svgCanvas.pathActions.canDeleteNodes) return;
			_oldPath = $(svgedit.path.path.elem).attr('d');
		},function(){
			if(!_oldPath) return;
			var svgTarget = svgedit.path.path,objects = svgCanvas.getPrivateMethods();
			var cmd = new objects.ChangeElementCommand(svgTarget.elem,{d:_oldPath});
			svgCanvas.undoMgr.addCommandToHistory(cmd);_oldPath = false;
			// console.error(123,[cmd,svgTarget]);
		});
		
		// 文字输入支持撤销;
		var _oldText = '';
		functionHook(svgCanvas,'setTextContent',function(text){
			if(window.event && window.event.isComposing) return; //中文正在输入中不记录;
			_oldText = svgCanvas.getSelectedElems()[0].textContent;
		},function(){
			if(!_oldText) return;
			var elem = svgCanvas.getSelectedElems()[0],objects = svgCanvas.getPrivateMethods();
			var cmd = new objects.ChangeElementCommand(elem,{'#text':_oldText});
			svgCanvas.undoMgr.addCommandToHistory(cmd);_oldText = false;
			// console.error(123,[cmd,arguments]);
		});
		
		var _fillPre = "#svgcanvas defs #";
		var _oldFillList = {},_fillList = {};
		var _oldFillMake = function(){
			_oldFillList = {};
			var selecteds = svgCanvas.getSelectedElems();
			var $fillList = $(selecteds).find('[fill]').add($(selecteds));
			$fillList.each(function(i){
				var fill = $(this).attr('fill') || '';
				if (!fill || fill.substr(0,5).toLowerCase() != 'url(#') return;
				var id  = fill.substr(5,fill.length - 5 - 1),elem = $(_fillPre+id).get(0);
				// console.log(777,id,fill,elem);
				if (elem){_oldFillList[id] = {elem:elem,parent:elem.parentNode};};
				if($(elem).attr('xlink:href')){
					var id = $(elem).attr('xlink:href').substr(1),elem = $(_fillPre+id).get(0);
					if (elem){_oldFillList[id] = {elem:elem,parent:elem.parentNode};};
				}
			});
			_.extend(_fillList,_oldFillList);
		}
		var _oldFillPush = function(){
			if(Object.keys(_oldFillList).length == 0) return;
			var objects = svgCanvas.getPrivateMethods();
			var lastCmd = svgCanvas.undoMgr.undoStack[svgCanvas.undoMgr.undoStack.length - 1];
			for (key in _oldFillList){
				// console.error(124,key,$("#svgcanvas #" + key),lastCmd,arguments);
				if($(_fillPre+key).length) continue; //存在则不加入;
				var item = _oldFillList[key];
				lastCmd.addSubCommand(new objects.RemoveElementCommand(item.elem,null,item.parent));
			};_oldFillList = {};
		}
		functionHook(svgCanvas,'cutSelectedElements',_oldFillMake,_oldFillPush);
		functionHook(svgCanvas,'deleteSelectedElements',_oldFillMake,_oldFillPush);
		
		// 剪切后粘贴, 保持渐变色; 追加defs节点下的linearGradient节点;
		functionHook(svgCanvas,'pasteElements',false,function(){
			var selecteds = svgCanvas.getSelectedElems();
			var $fillList = $(selecteds).find('[fill]').add($(selecteds));
			$fillList.each(function(i){
				var fill = $(this).attr('fill') || '';
				if (!fill || fill.substr(0,5).toLowerCase() != 'url(#') return;
				var id  = fill.substr(5,fill.length - 5 - 1),elem = $(_fillPre+id).get(0),item = _fillList[id];
				if(!elem && item){item.parent.insertBefore(item.elem,null);}
				if($(elem).attr('xlink:href')){
					var id = $(elem).attr('xlink:href').substr(1),elem = $(_fillPre+id).get(0),item = _fillList[id];
					if(!elem && item){item.parent.insertBefore(item.elem,null);}
				}
				// console.error(301,id,elem,item);
			});
		});
		
		// add by warlee; 避免过多历史记录;(设置元素x,y; 设置窗口大小)
		setTimeout(function(){
			var _add = svgCanvas.undoMgr.addCommandToHistory;
			var _addDebonce = _$.debounce(function(cmd){
				_add.apply(svgCanvas.undoMgr,[cmd]);
			},100);
			svgCanvas.undoMgr.addCommandToHistory = function(cmd) {
				var useDebonce = 'position,Change Image Dimensions,Change text'.split(',');
				var add = useDebonce.indexOf(cmd.text) === -1 ? _add:_addDebonce;
				// console.error(111,cmd);//限流添加的动作: x,y修改;画面尺寸调整;文字内容修改;
				add.apply(svgCanvas.undoMgr,[cmd]);
			}
		},10);
	};
	
	window.svgLoadFonts = function(fonts){
		var fontList = {
			"Arial":"Arial,helvetica,sans-serif",
			"monospace":"monospace",
			
			"微软雅黑":"Microsoft Yahei",
			"宋体":"STsong,SimSun,NSimSun,STFangsong,FangSong,FangSong_GB2312,STZhongsong",
			//STsong,SimSun,NSimSun,STFangsong,FangSong,FangSong_GB2312,STZhongsong
			"细黑":"STXihei,STHeiti,SimHei",
			"楷体":"STKaiti,KaiTi,KaiTi_GB2312,Kai",
			"华文行楷":"STXingkai",
			// "隶书":"隶书,SimLi,STLiti",
						
			"Comic Sans MS":"Comic Sans MS,cursive",
			"Courier New":"Courier New,Courier,monospace",
			"Impact":"Impact,chicago",
			"Lucida Sans Unicode":"Lucida Sans Unicode,Lucida Grande,sans-serif",
			"Tahoma":"Tahoma,Geneva,sans-serif",
			"Times New Roman":"Times New Roman,Times,serif",
			"Trebuchet MS":"Trebuchet MS",
			"Verdana":"Verdana,Geneva,sans-serif",
		};
		document.fonts = {onloading:$.noop,onloadingdone:$.noop};
		_.each(fonts,function(info,name){
			delete fonts[name];
		});
		
		var html = '';
		_.each(fontList,function(family,name){
			fonts[name] = {Bold:1,Italic:1,BoldItalic:1,name:name};
			fonts[family] = fonts[name];
			html += "<option value='"+family+"'>"+name+"</option>";
		});
		$("#font_family_dropdown").append(html);
	};
		
	$BODY.bind('pageLoad',pageLoadBefore);
})();
