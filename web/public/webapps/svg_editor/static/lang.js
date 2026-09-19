(function(){
	window.drawLang = {support:['zh','en'],current:'en'};
	drawLang.en = {
		'#menu_bar .menu:eq(1) .menu_title':"File",
		'#menu_bar .menu:eq(2) .menu_title':"Edit",
		'#menu_bar .menu:eq(3) .menu_title':"Object",
		'#menu_bar .menu:eq(4) .menu_title':"View",
	
		"#align_tools h4": "Align to canvas",
		"#canvas_panel h4": "Canvas",
		"#circle_panel h4": "Circle",
		"#ellipse_panel h4": "Ellipse",
		"#g_panel h4": "Group",
		"#image_panel h4": "Image",
		"#line_panel h4": "Line",
		"#multiselected_panel h4": "Multiple Elements",
		"#path_node_panel h4": "Edit Path",
		"#path_panel h4": "Path",
		"#rect_panel h4": "Rectangle",
		"#stroke_panel h4": "Stroke",
		"#svg_panel h4": "SVG",
		"#text_panel h4": "Text",
		"#textpath-panel h4": "Text Path",
		"#use_panel h4": "Use",
		
		"#tool_download":"Download",
		"#modal_shortcuts": "Keyboard Shortcuts...",
		"#tool_clear": "New Document",
		"#tool_open": "Open SVG...",
		"#tool_import": "Place Image...",
		"#tool_save": "Save Image...",
		"#tool_export": "Export as PNG",
		"#tool_undo": "Undo",
		"#tool_redo": "Redo",
		"#tool_cut": "Cut",
		"#tool_copy": "Copy",
		"#tool_paste": "Paste",
		"#tool_clone": "Duplicate",
		"#tool_delete": "Delete",
		"#tool_move_top": "Bring to Front",
		"#tool_move_up": "Bring Forward",
		"#tool_move_down": "Send Backward",
		"#tool_move_bottom": "Send to Back",
		"#tool_group": "Group Elements",
		"#tool_ungroup": "Ungroup Elements",
		"#tool_topath": "Convert to Path",
		"#tool_reorient": "Reorient path",
		"#tool_rulers": "View Rulers",
		"#tool_wireframe": "View Wireframe",
		"#tool_source": "Source...",
		"[title='Switch to lightmode']": "Switch to lightmode",
		"#selectedPredefined": "Custom",
		"#fitToContent": "Fit to Content",
		"#resolution_label": "Custom",
		"#tool_release_text_on_path": "Remove path",
		"#font_sizeLabel": "Font Size",
		"#tool_unlink_use": "Break use ref",
		"[title='Ungroup Elements']": "Ungroup Elements",
		"#straight_segments": "Straight",
		"#curve_segments": "Curve",
		"#seg_type_label": "Straight",
		"[title='Adds a node']": "Adds a node",
		"[title='Delete Node']": "Delete Node",
		"[title='Open/close sub-path']": "Open/close sub-path",
		"#group_opacityLabel": "Opacity",
		"[title='Align Left']": "Align Left",
		"[title='Align Center']": "Align Center",
		"[title='Align Right']": "Align Right",
		"[title='Align Top']": "Align Top",
		"[title='Align Middle']": "Align Middle",
		"[title='Align Bottom']": "Align Bottom",
		"#selected_objects": "Align to objects",
		"#page": "Align to page",
		"#button_group": "Group Elements",
		"[title='Place text on path']": "Place text on path",
		"[title='Select Tool [V]']": "Select Tool [V]",
		"[title='Pencil Tool [P]']": "Pencil Tool [P]",
		"[title='Line Tool [L]']": "Line Tool [L]",
		"[title='Square/Rect Tool [R]']": "Square/Rect Tool [R]",
		"[title='Ellipse/Circle Tool [C]']": "Ellipse/Circle Tool [C]",
		"[title='Path Tool [P]']": "Path Tool [P]",
		"[title='Text Tool [T]']": "Text Tool [T]",
		"[title='Zoom Tool [Z]']": "Zoom Tool [Z]",
		"[title='Eyedropper Tool [E]']": "Eyedropper Tool [E]",
		"[title='Switch stroke and fill colors [X]']": "Switch stroke and fill colors [X]",
		"[title='Change fill color']": "Change fill color",
		"[title='Change stroke color']": "Change stroke color",
		"[title='Change zoom level']": "Change zoom level",
		"[href='#cut']": "Cut",
		"[href='#copy']": "Copy",
		"[href='#paste']": "Paste",
		"[href='#delete']": "Delete",
		"[href='#group']": "Group",
		"[href='#ungroup']": "Ungroup",
		"[href='#move_front']": "Bring to Front",
		"[href='#move_up']": "Bring Forward",
		"[href='#move_down']": "Send Backward",
		"[href='#move_back']": "Send to Back",
		"[title='star_points_5']": "star_points_5",
		"[title='donut']": "donut",
		"[title='triangle']": "triangle",
		"[title='right_triangle']": "right_triangle",
		"[title='diamond']": "diamond",
		"[title='pentagon']": "pentagon",
		"[title='hexagon']": "hexagon",
		"[title='septagon1']": "septagon1",
		"[title='heptagon']": "heptagon",
		"[title='decagon']": "decagon",
		"[title='dodecagon']": "dodecagon",
		"[title='trapezoid']": "trapezoid",
		"[title='heart']": "heart",
		"[title='cylinder']": "cylinder",
		"[title='plaque']": "plaque",
		"[title='page']": "page",
		"[title='cross']": "cross",
		"[title='divide']": "divide",
		"[title='minus']": "minus",
		"[title='times']": "times",
		"#tool_source_cancel": "Cancel",
		"#tool_source_save": "Apply Changes",
		
		"#shape_cats [data-cat=basic]": "Basic",
		"#shape_cats [data-cat=object]": "Objects",
		"#shape_cats [data-cat=symbol]": "Symbols",
		"#shape_cats [data-cat=arrow]": "Arrows",
		"#shape_cats [data-cat=flowchart]": "Flowchart",
		"#shape_cats [data-cat=nature]": "Nature",
		"#shape_cats [data-cat=game]": "Cards & Chess",
		"#shape_cats [data-cat=dialog_balloon]": "Dialog baloons",
		"#shape_cats [data-cat=music]": "Music",
		"#shape_cats [data-cat=weather]": "Weather & Time",
		"#shape_cats [data-cat=ui]": "User Interface",
		"#shape_cats [data-cat=social]": "Social We",
		
		// 操作工具
		"#button_ungroup":"Ungroup",
		"#canvas_title + span": "Title",
		"#canvas_width + span": "Width",
		"#canvas_height + span": "Height",
		"#canvas_panel .draginput:eq(3) span": "Color",
		"#canvas_panel .draginput:eq(4) span": "Sizes",
		"#rect_width + span": "Width",
		"#rect_height + span": "Height",
		"#image_width + span": "Width",
		"#image_height + span": "Height",
		"#circle_panel .draginput:eq(0) span": "Center X",
		"#circle_panel .draginput:eq(1) span": "Center Y",
		"#circle_panel .draginput:eq(2) span": "Radius",
		"#ellipse_rx + span": "Radius X",
		"#ellipse_ry + span": "Radius Y",
		"#line_x1 + span": "Start X",
		"#line_y1 + span": "Start Y",
		"#line_x2 + span": "End X",
		"#line_y2 + span": "End Y",
		"#textPath_offset + span": "Offset",
		"#text + span": "Content",
		"#text_panel .draginput:eq(3) span": "Font",
		"#text_panel .draginput:eq(4) span": "Font Style",
		"#font_size + span": "Font size",
		"#path_node_panel .draginput:eq(2) span": "Seg Type",
		"#angle + span": "Rotation",
		"#group_opacity + span": "Opacity",
		"#blur + span": "Blur",
		"#rect_rx + span": "Roundness",
		"#stroke_width + span": "Width",
		"#stroke_panel .draginput:eq(1) span": "Dash",
		
		"#color_picker .jGraduate_tab_color":"Solid Color",
		"#color_picker .jGraduate_tab_lingrad":"Linear Gradient",
		"#color_picker .jGraduate_tab_radgrad":"Radial Gradient",
		"#color_picker .jGraduate_Form:eq(0) > .jGraduate_StopSection:eq(0) > label":"Begin Point",
		"#color_picker .jGraduate_Form:eq(0) > .jGraduate_StopSection:eq(1) > label":"End Point",
		"#color_picker .jGraduate_Form:eq(1) > .jGraduate_StopSection:eq(0) > label":"Center Point",
		"#color_picker .jGraduate_Form:eq(01) > .jGraduate_StopSection:eq(1) > label":"Focal Point",
		"#color_picker .jGraduate_OpacField .prelabel":"Opac:",
		"#color_picker .jGraduate_RadiusField .prelabel":"Radius:",
		"#color_picker .jGraduate_EllipField .prelabel":"Ellip:",
		"#color_picker .jGraduate_AngleField .prelabel":"Angle:",		
		"#color_picker input[type='button'].Cancel":"Cancel",
		"#color_picker input[type='button'].Ok":"Ok",	
	};
	drawLang.zh = {
		'#menu_bar .menu:eq(1) .menu_title':"文件",
		'#menu_bar .menu:eq(2) .menu_title':"编辑",
		'#menu_bar .menu:eq(3) .menu_title':"选项",
		'#menu_bar .menu:eq(4) .menu_title':"视图",
	
		"#align_tools h4": "对齐方式",
		"#canvas_panel h4": "画布",
		"#circle_panel h4": "圆圈",
		"#ellipse_panel h4": "椭圆",
		"#g_panel h4": "组合",
		"#image_panel h4": "图像",
		"#line_panel h4": "线条",
		"#multiselected_panel h4": "多种元素",
		"#path_node_panel h4": "编辑路径",
		"#path_panel h4": "路径",
		"#rect_panel h4": "矩形",
		"#stroke_panel h4": "线条样式",
		"#svg_panel h4": "SVG",
		"#text_panel h4": "文本",
		"#textpath-panel h4": "文本路径",
		"#use_panel h4": "使用",
		
		
		"#tool_download":"下载文件",
		"#modal_shortcuts": "快捷键...",
		"#tool_clear": "新建文件",
		"#tool_open": "打开SVG...",
		"#tool_import": "导入图像",
		"#tool_save": "保存图像",
		"#tool_export": "导出PNG",
		"#tool_undo": "撤消",
		"#tool_redo": "重做",
		"#tool_cut": "剪切",
		"#tool_copy": "复制",
		"#tool_paste": "粘贴",
		"#tool_clone": "复制",
		"#tool_delete": "删除",
		"#tool_move_top": "移置顶层",
		"#tool_move_up": "移置上层",
		"#tool_move_down": "移置下层",
		"#tool_move_bottom": "移置底层",
		"#tool_group": "组合",
		"#tool_ungroup": "取消组合",
		"#tool_topath": "转换为路径",
		"#tool_reorient": "调整路径",
		"#tool_rulers": "显示标尺",
		"#tool_wireframe": "显示网格",
		"#tool_source": "源文件...",
		"[title='Switch to lightmode']": "切换到lightmode",
		"#selectedPredefined": "自定义",
		"#fitToContent": "适应内容",
		"#resolution_label": "自定义",
		"#tool_release_text_on_path": "删除路径",
		"#font_sizeLabel": "字体大小",
		"#tool_unlink_use": "断开链接引用",
		"[title='Ungroup Elements']": "取消组合",
		"#straight_segments": "直",
		"#curve_segments": "曲线",
		"#seg_type_label": "直行",
		"[title='Adds a node']": "添加节点",
		"[title='Delete Node']": "删除节点",
		"[title='Open/close sub-path']": "打开/关闭子路径",
		"#group_opacityLabel": "透明度",
		"[title='Align Left']": "左对齐",
		"[title='Align Center']": "居中对齐",
		"[title='Align Right']": "右对齐",
		"[title='Align Top']": "顶端对齐",
		"[title='Align Middle']": "居中对齐",
		"[title='Align Bottom']": "底端对齐",
		"#selected_objects": "对齐到对象",
		"#page": "对齐页面",
		"#button_group": "组合元素",
		"[title='Place text on path']": "添加文本",
		"[title='Select Tool [V]']": "选择工具[V]",
		"[title='Pencil Tool [P]']": "铅笔工具",
		"[title='Line Tool [L]']": "直线工具",
		"[title='Square/Rect Tool [R]']": "方形/矩形",
		"[title='Ellipse/Circle Tool [C]']": "椭圆/圆",
		"[title='Path Tool [P]']": "轨迹工具",
		"[title='Text Tool [T]']": "文本工具",
		"[title='Zoom Tool [Z]']": "缩放工具",
		"[title='Eyedropper Tool [E]']": "滴管工具",
		"[title='Switch stroke and fill colors [X]']": "切换笔划和填充颜色[X]",
		"[title='Change fill color']": "更改填充颜色",
		"[title='Change stroke color']": "更改笔划颜色",
		"[title='Change zoom level']": "更改缩放级别",
		"[href='#cut']": "剪切",
		"[href='#copy']": "复制",
		"[href='#paste']": "粘贴",
		"[href='#delete']": "删除",
		"[href='#group']": "组合",
		"[href='#ungroup']": "取消组合",
		"[href='#move_front']": "移置顶层",
		"[href='#move_up']": "移置上层",
		"[href='#move_down']": "移置下层",
		"[href='#move_back']": "移置底层",
		"[title='star_points_5']": "五角星",
		"[title='donut']": "甜甜圈",
		"[title='triangle']": "三角形",
		"[title='right_triangle']": "直角三角形",
		"[title='diamond']": "钻石",
		"[title='pentagon']": "五角形",
		"[title='hexagon']": "六角形",
		"[title='septagon1']": "隔膜1",
		"[title='heptagon']": "七边形",
		"[title='decagon']": "十边形",
		"[title='dodecagon']": "十二边形",
		"[title='trapezoid']": "梯形",
		"[title='heart']": "心形",
		"[title='cylinder']": "圆柱",
		"[title='plaque']": "斑块",
		"[title='page']": "页码",
		"[title='cross']": "交叉",
		"[title='divide']": "分",
		"[title='minus']": "减",
		"[title='times']": "次",
		"#tool_source_cancel": "取消",
		"#tool_source_save": "保存",
		
		// 图形
		"#shape_cats [data-cat=basic]": "基本",
		"#shape_cats [data-cat=object]": "物体",
		"#shape_cats [data-cat=symbol]": "符号",
		"#shape_cats [data-cat=arrow]": "箭头",
		"#shape_cats [data-cat=flowchart]": "流程图",
		"#shape_cats [data-cat=nature]": "自然",
		"#shape_cats [data-cat=game]": "棋牌",
		"#shape_cats [data-cat=dialog_balloon]": "对话框",
		"#shape_cats [data-cat=music]": "音乐",
		"#shape_cats [data-cat=weather]": "天气/时间",
		"#shape_cats [data-cat=ui]": "用户界面",
		"#shape_cats [data-cat=social]": "社交网络",
		
		"#button_ungroup":"取消组合",
		"#canvas_title + span": "标题",
		"#canvas_width + span": "宽度",
		"#canvas_height + span": "高度",
		"#canvas_panel .draginput:eq(3) span": "颜色",
		"#canvas_panel .draginput:eq(4) span": "尺寸",
		"#rect_width + span": "宽度",
		"#rect_height + span": "高度",
		"#image_width + span": "宽度",
		"#image_height span": "高度",
		"#circle_panel .draginput:eq(0) span": "半径 X",
		"#circle_panel .draginput:eq(1) span": "半径 Y",
		"#circle_panel .draginput:eq(2) span": "旋转",
		"#ellipse_rx + span": "半径 X",
		"#ellipse_ry + span": "半径 Y",
		"#line_x1 + span": "开始 X",
		"#line_y1 + span": "开始 Y",
		"#line_x2 + span": "结束 X",
		"#line_y2 + span": "结束 Y",
		"#textPath_offset + span": "偏移",
		"#text + span": "内容",
		"#text_panel .draginput:eq(3) span": "字体",
		"#text_panel .draginput:eq(4) span": "字体样式",
		"#font_size + span": "字体大小",
		"#path_node_panel .draginput:eq(2) span": "分割类型",
		"#angle + span": "旋转",
		"#group_opacity + span": "透明度",
		"#blur + span": "模糊",
		"#rect_rx + span": "Roundness",
		"#stroke_width + span": "宽度",
		"#stroke_panel .draginput:eq(1) span": "线条样式",
		
		"#color_picker .jGraduate_tab_color":"纯色",		//Solid Color
		"#color_picker .jGraduate_tab_lingrad":"线性渐变",	//Linear Gradient
		"#color_picker .jGraduate_tab_radgrad":"径向渐变",	//Radial Gradient
		"#color_picker .jGraduate_Form:eq(0) > .jGraduate_StopSection:eq(0) > label":"开始点",
		"#color_picker .jGraduate_Form:eq(0) > .jGraduate_StopSection:eq(1) > label":"结束点",
		"#color_picker .jGraduate_Form:eq(1) > .jGraduate_StopSection:eq(0) > label":"中心点",
		"#color_picker .jGraduate_Form:eq(01) > .jGraduate_StopSection:eq(1) > label":"焦点",
		"#color_picker .jGraduate_OpacField .prelabel":"透明",
		"#color_picker .jGraduate_RadiusField .prelabel":"半径",
		"#color_picker .jGraduate_EllipField .prelabel":"椭圆",
		"#color_picker .jGraduate_AngleField .prelabel":"角度",
		"#color_picker input[type='button'].Cancel":"取消",
		"#color_picker input[type='button'].Ok":"确定",		
	};
	
	var setText = function(selector,text){
		var $dom = $(selector);
		if($dom.length != 1) return;
		if(selector.indexOf("input[type='button']") != -1){
			return $dom.val(text);
		}
		if(selector.indexOf('[title=') != -1){
			return $dom.attr('title',text);
		}
		
		var nodes = $dom.get(0).childNodes;
		for (var i = 0; i < nodes.length; i++){
			if(nodes[i].nodeType != 3) continue;
			nodes[i].textContent = text;
			break;
		}
	};
	/*
	// 文本
	var textMap = {};
	$("[id],a[href],[title]").each(function(){
		var $item = $(this).clone();
		var $children = $item.children();
		if($children.length > 1) return;
		$item.children().remove();
		if($item.attr('title')){textMap["[title='"+$item.attr('title')+"']"] = $item.attr('title');return;}
	
		var text = $item.text().trim();
		if(!text || text.indexOf('\n') != '-1' || text.length <= 1) return;    
		if($item.attr('id')){textMap['#'+$item.attr('id')] = text;}
		if($item.attr('href')){textMap["[href='"+$item.attr('href')+"']"] = text;}
	});
	console.log(textMap,JSON.stringify(textMap,null,"    "))
	
	// 工具栏
	var aa = {};
	$("#panels .context_panel h4").each(function(){
		var $item = $(this);
		aa['#'+$item.parent().attr('id')+" h4"] = $item.text();
	});console.log(JSON.stringify(aa,null,"    "))
	
	var aa = {};
	$(".draginputs .draginput span").each(function(){
		var $item = $(this);
		var text  = $item.text().trim();
		if(!text || text.indexOf('\n') != '-1' || text.length <= 1) return;
		var prevID = $item.prev().attr('id');
		var textKey = '#'+prevID+" + span";
		if(!prevID){
			var panelID = $item.parents('.context_panel').attr('id');
			var $input = $item.parent();
			var index  = $input.parent().children('.draginput').index($input);
			if(index == -1 || !panelID) return;
			aa['#'+panelID+" .draginput:eq("+index+")"] = text;			
		}
	});console.log(JSON.stringify(aa,null,"    "));
	*/
	drawLang.change = function(lang){
		if(lang.indexOf('zh') != -1){lang = 'zh'};
		if(!drawLang[lang]){lang = 'en'};
		// if(lang == drawLang.current) return;
		drawLang.current = lang;
				
		var langMap = drawLang[lang];
		for (var key in langMap) {
			setText(key,langMap[key]);
		}
	}
})();