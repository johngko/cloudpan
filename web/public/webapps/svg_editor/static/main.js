kodReady.push(function(){
	Events.bind('explorer.kodApp.before',function(appList,parentView){
		appList.push({
			name:'{{package.id}}',
			title:'{{package.name}}',
			ext:"{{config.fileExt}}",
			sort:"{{config.fileSort}}",
			icon:'{{pluginHost}}static/images/icon.svg',
			appFileEdit:true,
			callback:function(){
				core.openFile('{{pluginApi}}',"{{config.openWith}}",_.toArray(arguments));
			}
		});
	});
	Events.bind('explorer.lightApp.load',function(listData){
		listData['{{package.id}}'] = {
			name:"{{package.name}}",
			desc:"{{package.description}}",
			category:"{{package.category}}",
			appUrl:'{{pluginApi}}',
			openWith:"{{config.openWith}}",
			icon:'{{pluginHost}}static/images/icon.svg'
		}
	});
	
	// 新建处理;
	Events.bind('rightMenu.newFileAdd',function(menuList){
		menuList.push({type:'svg',name:"{{LNG['svgEditor.fileNew']}}",createOpen:1,appName:'{{package.id}}'});
	});
	Router.mapIframe({page:'{{package.id}}',title:'{{package.name}}',url:'{{pluginApi}}',ignoreLogin:true});
	Events.bind('main.menu.loadBefore',function(listData){ //添加到左侧菜单栏
		listData['{{package.id}}'] = {
			name:"{{package.menu}}",
			url:'{{pluginApi}}',
			target:'{{config.openWith}}',
			subMenu:'{{config.menuSubMenu}}',
			menuAdd:'{{config.menuAdd}}',
			icon:'{{pluginHost}}static/images/icon.svg'
			// icon:'ri-pencil-ruler-line-2 bg-greey-6'
		}
	});
});