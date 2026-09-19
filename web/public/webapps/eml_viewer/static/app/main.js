kodReady.push(function(){
	Events.bind('explorer.kodApp.before',function(appList){
		appList.push({
			name:'{{package.id}}',
			title:'{{package.name}}',
			ext:"{{config.fileExt}}",
			sort:"{{config.fileSort}}",
			icon:'{{pluginHost}}static/images/icon.png',
			callback:function(){
				core.openFile('{{pluginApi}}',"{{config.openWith}}",_.toArray(arguments));
			}
		});		
	});
	
	if($.hasKey('plugin.emlViewer.style')) return; //只有首次处理,避免重复调用
	var style = 
		".x-item-icon.x-eml,.x-item-icon.x-emlx{\
			background-image:url('{{pluginHost}}static/images/icon.png');\
		}\
		.x-item-icon.x-mht,.x-item-icon.x-mhtml{\
			background-image:url('{{staticPath}}images/file_icon/icon_file/mht.png');\
		}"
	$.addStyle(style);
});
