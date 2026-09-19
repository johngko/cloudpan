(function(){
	window.$BODY = $('body');// jquery 对象会重置;
	var langUI = {save:'保存',download:'下载',openFile:'打开文件',selectFile:'所在位置',localFile:'打开本地文件'};
	if(appLang && appLang.indexOf('zh') == -1){
		langUI = {save:'Save',download:'Download',openFile:'Open file',selectFile:'Position',localFile:'Open Local'};
	}
	
	var initView = function(){
		var tpl = '\
		<div class="file-info">\
			<i class="file-open font-icon ri-folder-line-3" title="'+langUI.openFile+'"></i>\
			<span class="name" title="'+langUI.selectFile+'"></span>\
		</div>\
		<div class="buttons-action">\
			<span class="kui-btn style-normal file-save font-icon ri-save-line-3">'+langUI.save+'</span>\
			<span class="kui-btn style-blue  file-download font-icon ri-download-line-2">'+langUI.download+'</span>\
		</div>\
		<div class="buttons-action is-empty">\
			<span class="kui-btn style-normal file-open-new font-icon ri-save-line-3">'+langUI.openFile+'</span>\
		</div>\
		<span class="kui-btn style-normal change-theme"></span>';
		var target = document.querySelector('.tui-image-editor-container');
		var wrap = document.createElement('div');
		wrap.innerHTML = tpl;
		while(target && wrap.firstChild){
			target.appendChild(wrap.firstChild);
		}
		
		var saveImage = function(){
			var imageData = imageEditor.toDataURL();
			var fileData  = imageData.replace(/data:(image\/.+);base64,/,'');
			var rawData   = atob(fileData);
			var uInt8Array = new Uint8Array(rawData.length);
			for (i = 0; i < rawData.length; i += 1) {
				uInt8Array[i] = rawData.charCodeAt(i);
			}
			var fileBlob  = new Blob([uInt8Array]);
			fileSaveCreate(fileBlob);
		}
		var stopPP = function(e){
			e.stopPropagation && e.stopPropagation();
			e.preventDefault && e.preventDefault();
			if(e.originalEvent && e.originalEvent.preventDefault){
				e.originalEvent.preventDefault();
			}
			return false;
		}
		fileReloadInfo();changeTheme();
		$('.tui-image-editor-wrap').bind('contextmenu',stopPP);
		$BODY.find('.file-download').bind('click',function(e){imageEditor.ui.eventHandler.download();});
		$BODY.find('.file-save').bind('click',function(e){saveImage();});
		$BODY.find('.file-open').bind('click',function(e){fileSelectOpen(true);});
		$BODY.find('.file-open-new').bind('click',function(e){fileSelectOpen();});
		$BODY.find('.change-theme').bind('click',function(e){changeTheme(true);});
		$BODY.find('.file-info').bind('click',function(e){
			if($(e.target).hasClass('file-open') || !FILE_INFO.savePath) return;
			kodApi.folderView(FILE_INFO.savePath);
		});
		
		$BODY.bind('keydown',function(e){
			// console.log(222,e);
			var isCtrl = e.metaKey || e.ctrlKey;
			if(isCtrl && e.key == 's'){ //ctrl+s;
				saveImage();
				return stopPP(e);
			}
			if(e.key == "Escape"){
				$(".tui-image-editor-menu .tui-image-editor-item.active").trigger('click');
				return;
			}
		});
	}

	var fileSelectOpen = function(openNewWindow){
		kodApi.fileSelect({
			title:langUI.openFile,
			allowExt:'jpg,jpeg,png,webp,ico',
			callback:function(result){  // 回调地址;
				if(FILE_INFO.fileUrl && openNewWindow){
					var param = '&path='+urlEncode(result.path)+'&name='+urlEncode(result.name);
					return window.open(BASE_URL_API + param);
				}
				FILE_INFO = {
					fileUrl:result.downloadPath,
					fileName:result.name,
					savePath:result.path,
					canWrite:true
				};
				fileReload();
			}
		});
	}
	var fileReloadInfo = function(){
		var $title = $('.file-info span');
		var $main  = $('.tui-image-editor-container');
		if(!FILE_INFO.fileUrl){
			$main.addClass('no-file');
			return;
		}
		$main.removeClass('no-file');
		$title.html(FILE_INFO.fileName);
		imageEditor.ui.activeMenuEvent();
	};
	
	var fileReload = function(){
		fileReloadInfo();
		imageEditor.loadImageFromURL(FILE_INFO.fileUrl,FILE_INFO.fileName);
	};
	var fileSaveCreate = function(content,callback){
		if(FILE_INFO.saveData){
			return kodApi.fileSave(FILE_INFO.saveData,content,callback);
		}
		if(FILE_INFO.savePath){
			return kodApi.fileSave(FILE_INFO.savePath,content,callback);
		}
		return kodApi.fileCreate(FILE_INFO.fileName,content,function(data){
			if(data){
				FILE_INFO.fileUrl  = FILE_INFO.fileUrl || '---';
				FILE_INFO.fileName = data.name || FILE_INFO.fileName;
				FILE_INFO.savePath = data.path || FILE_INFO.savePath;
				FILE_INFO.saveData = data.saveData || FILE_INFO.saveData;
				FILE_INFO.canWrite = true;
				fileReloadInfo();
			}
			callback && callback();
	   });
	}
	var localStorage = window.localStorage;
	var changeTheme = function(isSet){
		if(!localStorage) return;
		var theme = localStorage.getItem('kodbox-tui-image-theme') || 'black';
		if(isSet){
			theme = (theme == 'black') ? 'white':'black';
			localStorage.setItem('kodbox-tui-image-theme',theme);
		}
		var action  = (theme == 'black') ? 'removeClass':'addClass';
		$('html')[action]('theme-white');
	}
	
	var langCN =  {
		"Crop": "裁剪",
		"ZoomIn": "放大",
		"ZoomOut": "缩小",
		"Hand": "拖拽",
		"History": "历史记录",
		"DeleteAll": "全部删除",
		"Delete": "删除",
		"Undo": "撤销",
		"Redo": "反撤销",
		"Reset": "重置",
		"Flip": "镜像",
		"Rotate": "旋转",
		"Draw": "绘制",
		"Shape": "形状标注",
		"Icon": "图标标注",
		"Text": "文字标注",
		"Mask": "遮罩",
		"Filter": "滤镜",
		"Bold": "加粗",
		"Italic": "斜体",
		"Underline": "下划线",
		"Left": "左对齐",
		"Center": "居中",
		"Right": "右对齐",
		"Color": "颜色",
		"Text size": "字体大小",
		"Custom": "自定义",
		"Square": "正方形",
		"Apply": "应用",
		"Cancel": "取消",
		"Flip X": "X 轴",
		"Flip Y": "Y 轴",
		"Range": "区间",
		"Stroke": "描边",
		"Fill": "填充",
		"Circle": "圆",
		"Triangle": "三角",
		"Rectangle": "矩形",
		"Free": "曲线",
		"Straight": "直线",
		"Arrow": "箭头",
		"Arrow-2": "箭头2",
		"Arrow-3": "箭头3",
		"Star-1": "星星1",
		"Star-2": "星星2",
		"Polygon": "多边形",
		"Location": "定位",
		"Heart": "心形",
		"Bubble": "气泡",
		"Custom icon": "自定义图标",
		"Load Mask Image": "加载蒙层图片",
		"Grayscale": "灰度",
		"Blur": "模糊",
		"Sharpen": "锐化",
		"Emboss": "浮雕",
		"Remove White": "除去白色",
		"Distance": "距离",
		"Brightness": "亮度",
		"Noise": "噪音",
		"Color Filter": "彩色滤镜",
		"Sepia": "棕色",
		"Sepia2": "棕色2",
		"Invert": "负片",
		"Pixelate": "像素化",
		"Threshold": "阈值",
		"Tint": "色调",
		"Multiply": "正片叠底",
		"Blend": "混合色",
		"Load": "记录列表",
		
		 
		'Resize':'调整尺寸',
		'Lock Aspect Ratio':'锁定高宽比',
		'Width':"宽",
		'Height':'高&nbsp;'
	};
	if(appLang && appLang.indexOf('zh') == -1){langCN = {};}
	var imageEditor = new tui.ImageEditor('#tui-image-editor-container', {
		includeUI: {
			loadImage:{path:FILE_INFO.fileUrl,name:FILE_INFO.fileName},
			theme: blackTheme, // blackTheme whiteTheme
			initMenu: '',//filter,crop
			menuBarPosition: 'bottom',
			menu:'crop,rotate,flip,resize,draw,shape,icon,text,mask,filter'.split(','),
			locale: langCN,
		},
		// 画布上限随窗口自适应：写死 700x600 会让大图缩成小块、四周大片空白
		cssMaxWidth: Math.max(document.documentElement.clientWidth - 40, 320),
		cssMaxHeight: Math.max(document.documentElement.clientHeight - 170, 240),
		usageStatistics: false,
	});
	initView();imageEditor.ui.resizeEditor();
	window.onresize = function (){
		imageEditor.ui.resizeEditor();
	};
	window.imageEditor = imageEditor;
})();