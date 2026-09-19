var volume = 0.8;
// 获取地址栏参数
// 创建URLSearchParams对象并传入URL中的查询字符串
const params = new URLSearchParams(window.location.search);

// 安全的值提取函数
function extractValue(input) {
  try {
    if (!input) return '';
    
    // 支持多种格式的URL提取
    const patterns = [
      /\("([^\s]+)"\)/g,       // ("url")
      /url\("?(.+?)"?\)/i,     // url("url") 或 url(url)
      /^"?(.+?)"?$/            // "url" 或 url
    ];
    
    for (const pattern of patterns) {
      const match = pattern.exec(input);
      if (match && match[1]) {
        return match[1].replace(/['"]/g, ''); // 移除可能存在的引号
      }
    }
    
    // 如果都没匹配到，返回清理过的输入
    return input.replace(/['"]/g, '').trim();
  } catch (e) {
    console.warn('提取背景图片地址时发生错误，但不影响使用');
    return '';
  }
}

var heo = {
  changeMusicBg: function (isChangeBg = true) {
    try {
      const heoMusicBg = document.getElementById("music_bg");
      if (!heoMusicBg) return;

      if (isChangeBg) {
        const musiccover = document.querySelector("#heoMusic-page .aplayer-pic");
        if (!musiccover || !musiccover.style || !musiccover.style.backgroundImage) return;
        
        const imgUrl = extractValue(musiccover.style.backgroundImage);
        if (!imgUrl) return;
        
        var img = new Image();
        img.onerror = () => console.warn('图片加载失败，但不影响播放');
        img.src = imgUrl;
        img.onload = function() {
          if (heoMusicBg) {
            heoMusicBg.style.backgroundImage = musiccover.style.backgroundImage;
          }
        };
      } else {
        // 第一次进入，绑定事件，改背景
        let timer = setInterval(() => {
          try {
            const musiccover = document.querySelector("#heoMusic-page .aplayer-pic");
            if (musiccover) {
              clearInterval(timer);
              //初始化音量
              const aplayer = document.querySelector('meting-js')?.aplayer;
              if (aplayer) {
                aplayer.volume(0.8, true);
                aplayer.play();
              }
              // 绑定事件
              heo.addEventListenerChangeMusicBg();
              let lis = document.querySelectorAll(".aplayer-list ol li").length;
              if(lis == 1){
                 document.querySelector(".aplayer-body").style.width = "100%";
              }
            }
          } catch (e) {
            console.warn('初始化音乐播放器时发生错误，但不影响使用');
            clearInterval(timer);
          }
        }, 100);
        
        // 防止定时器无限运行
        setTimeout(() => {
          clearInterval(timer);
        }, 5000);
      }
    } catch (e) {
      console.warn('修改音乐背景时发生错误，但不影响使用');
    }
  },

  addEventListenerChangeMusicBg: function () {
    try {
      const heoMusicPage = document.getElementById("heoMusic-page");
      const aplayer = heoMusicPage?.querySelector("meting-js")?.aplayer;
      if (aplayer) {
        aplayer.on('loadeddata', () => {
          heo.changeMusicBg();
        });
      }
    } catch (e) {
      console.warn('添加音乐背景监听器时发生错误，但不影响使用');
    }
  },

  getCustomPlayList: function() {
    try {
      const heoMusicPage = document.getElementById("heoMusic-page");
      if (!heoMusicPage) return;

      const playlistType = params.get("type") || "playlist";
      
      if (params.get("id") && params.get("server")) {
        console.log("获取到自定义内容");
        var id = params.get("id");
        var server = params.get("server");
        heoMusicPage.innerHTML = `<meting-js id="${id}" server="${server}" type="${playlistType}" mutex="true" preload="auto" order="list"></meting-js>`;
      } else {
        console.log("无自定义内容");
        heoMusicPage.innerHTML = `<meting-js id="${userId}" server="${userServer}" type="${userType}" mutex="true" preload="auto" order="list"></meting-js>`;
      }
      heo.changeMusicBg(false);
    } catch (e) {
      console.warn('获取播放列表时发生错误，但不影响使用');
    }
  }
};

// 调用
heo.getCustomPlayList();

// 改进vh
const vh = window.innerHeight * 1;
document.documentElement.style.setProperty('--vh', `${vh}px`);

window.addEventListener('resize', () => {
  let vh = window.innerHeight * 1;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
});

//空格控制音乐
document.addEventListener("keydown", function(event) {
  try {
    const aplayer = document.querySelector('meting-js')?.aplayer;
    if (!aplayer) return;

    //暂停开启音乐
    if (event.code === "Space") {
      event.preventDefault();
      aplayer.toggle();
    }

    //切换下一曲
    if (event.keyCode === 39) {
      event.preventDefault();
      aplayer.skipForward();
    }

    //切换上一曲
    if (event.keyCode === 37) {
      event.preventDefault();
      aplayer.skipBack();
    }

    //增加音量
    if (event.keyCode === 38) {
      event.preventDefault();
      if (volume <= 1) {
        volume = Math.min(1, volume + 0.1);
        aplayer.volume(volume, true);
      }
    }

    //减小音量
    if (event.keyCode === 40) {
      event.preventDefault();
      if (volume >= 0) {
        volume = Math.max(0, volume - 0.1);
        aplayer.volume(volume, true);
      }
    }
  } catch (e) {
    console.warn('键盘控制音乐时发生错误，但不影响使用');
  }
});
