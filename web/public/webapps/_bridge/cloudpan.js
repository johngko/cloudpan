/* CloudPan 宿主桥（iframe 侧）—— 移植的 v9os 商店 webapps 契约实现。
   替换各应用 index.html 里的 <script src=".../sdk.js..."> 标签。
   应用自带的 js/v9os-webos-compat.js 会把 window.webos.* 映射到这里的 window.$v9os；
   无 compat 层的应用（如 picasa）也直接用 $v9os||parent.$v9os。
   父窗口侧实现：web/src/webapp/bridge.ts（installHostBridge）。 */
(function () {
  var q = new URLSearchParams(location.search);
  window.__winId = q.get('winId') || '';
  var code = (location.pathname.match(/\/webapps\/([^\/]+)/) || [])[1] || '';
  // 会话文件上下文（?action=open 打开时）：saveFileNoSelect 回传用
  window.__cpFile = (q.get('action') === 'open' && q.get('path'))
    ? { policyId: Number(q.get('pid') || 0), path: q.get('path') || '', name: q.get('name') || '', ext: q.get('ext') || '', url: q.get('url') || '' }
    : null;

  var bus = {};
  function on(n, cb) { (bus[n] = bus[n] || []).push(cb); }
  function emit(n, d) { (bus[n] || []).slice().forEach(function (cb) { try { cb(d); } catch (e) { console.error(e); } }); }
  var parent = null;
  try { parent = window.parent && window.parent.$v9os; } catch (e) { /* 顶层直开：无宿主 */ }

  window.$v9os = {
    host: location.origin,
    event: { on: on, emit: emit, off: function (n) { bus[n] = []; } },
    file: {
      selectFile: function () {
        if (!parent || !parent.file) return Promise.reject(new Error('CloudPan 宿主桥未就绪'));
        return parent.file.selectFile.apply(parent.file, arguments);
      },
      saveFile: function () {
        if (!parent || !parent.file) return Promise.reject(new Error('CloudPan 宿主桥未就绪'));
        return parent.file.saveFile.apply(parent.file, arguments);
      },
      saveFileNoSelect: function (path, blob) {
        if (!parent || !parent.file) return Promise.reject(new Error('CloudPan 宿主桥未就绪'));
        return parent.file.saveFileNoSelect(path, blob, window.__cpFile);
      }
    },
    api: {
      webDataPost: function () {
        if (!parent || !parent.api) return Promise.resolve(null);
        return parent.api.webDataPost.apply(parent.api, arguments);
      }
    },
    msg: {
      success: function (t) { try { parent && parent.msg && parent.msg.success && parent.msg.success(String(t)); } catch (e) {} },
      error: function (t) { try { parent && parent.msg && parent.msg.error && parent.msg.error(String(t)); } catch (e) {} }
    },
    invoke: function () {
      if (!parent || !parent.invoke) return Promise.resolve(false);
      return parent.invoke.apply(parent, arguments);
    }
  };

  // fileOpenEdit 握手：pdfjs/picasa/excalidraw 等以 ?action=open 启动时先
  // emit('initFileOpenEdit') 再等宿主回文件信息；文件信息已在 URL 里，直接应答
  if (window.__cpFile) {
    var payload = { target: code, data: window.__cpFile };
    on('initFileOpenEdit', function () { emit('fileOpenEdit', payload); });
    setTimeout(function () { emit('fileOpenEdit', payload); }, 0);
  }
})();
