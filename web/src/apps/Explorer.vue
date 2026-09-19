<template>
  <div class="app-root" ref="rootEl" @dragover.prevent @drop.prevent="onDrop" @contextmenu.stop.prevent="onBlankCtx">
    <!-- 标签页 -->
    <div class="exp-tabs">
      <div v-for="(t, i) in tabs" :key="i" class="exp-tab" :class="{ active: i === activeIdx }"
        :title="tabTitle(t)" @mousedown.middle="closeTab(i)" @click="switchTab(i)">
        <AppIcon :name="t.policyId ? 'drive' : 'thispc'" :size="13" />
        <span class="t-label">{{ tabTitle(t) }}</span>
        <span class="t-close" @click.stop="closeTab(i)"><AppIcon name="close" :size="9" /></span>
      </div>
      <div class="exp-tab-add" title="新建标签页" @click="addTab(null, '/')"><AppIcon name="plus" :size="13" /></div>
    </div>
    <!-- 游客临时空间提示：上传的文件 24 小时后自动清除（后端 sweepGuestWorkspace 执行清理） -->
    <div v-if="session.isGuest && !onSharedDrive" class="guest-ttl-bar">
      <AppIcon name="info" :size="13" />
      <span>游客临时空间：文件在上传 24 小时后自动清除，重要内容请及时下载</span>
    </div>
    <!-- 工具栏 -->
    <div class="app-toolbar">
      <button class="tool-btn" :disabled="!canBack" @click="back" title="后退"><AppIcon name="back" :size="16" /></button>
      <button class="tool-btn" :disabled="!fwdStack.length" @click="fwd" title="前进"><AppIcon name="fwd" :size="16" /></button>
      <button class="tool-btn" :disabled="!currentPolicy || path === '/'" @click="goUp" title="上级"><AppIcon name="up" :size="16" /></button>
      <button class="tool-btn" @click="refresh" title="刷新"><AppIcon name="refresh" :size="16" /></button>
      <div class="crumb" style="flex: 1; margin: 0 8px">
        <span v-if="!currentPolicy">此电脑</span>
        <template v-else-if="onSharedDrive">
          <span @click="goto('/')">共享</span>
          <template v-if="currentShare">
            <AppIcon name="fwd" :size="11" style="opacity: 0.5" />
            <span @click="goto('/s' + currentShare.id)">{{ currentShare.name }}</span>
            <template v-for="(seg, i) in sharedSegs">
              <AppIcon name="fwd" :size="11" style="opacity: 0.5" />
              <span @click="goto('/s' + currentShare.id + '/' + sharedSegs.slice(0, i + 1).join('/'))">{{ seg }}</span>
            </template>
          </template>
        </template>
        <template v-else>
          <span @click="openPolicy(currentPolicy)">{{ currentPolicy.name }}</span>
          <template v-for="(seg, i) in segs">
            <AppIcon name="fwd" :size="11" style="opacity: 0.5" />
            <span @click="goto('/' + segs.slice(0, i + 1).join('/'))">{{ seg }}</span>
          </template>
        </template>
      </div>
      <div style="position: relative; display: flex; align-items: center; gap: 6px">
        <div style="position: relative; display: flex; align-items: center">
          <AppIcon name="search" :size="14" style="position: absolute; left: 9px; opacity: 0.6" />
          <input class="input" ref="searchInput" placeholder="搜索" v-model="keyword" @keyup.enter="doSearch"
            style="width: 170px; padding: 5px 10px 5px 28px; border-radius: 16px" />
        </div>
        <button class="tool-btn" :class="{ 'global-on': globalMode }" :title="globalMode ? '当前：全局搜索（点击切回本盘）' : '当前：本盘搜索（点击切换全局）'"
          @click="toggleGlobal">
          <AppIcon :name="globalMode ? 'cloud' : 'drive'" :size="15" />
        </button>
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="app-toolbar" style="padding: 4px 10px">
      <button class="tool-btn" :disabled="!canWriteHere" @click.stop="onSharedDrive ? sharedNewMenu($event) : newMenu($event)"><AppIcon name="plus" :size="15" />新建</button>
      <button class="tool-btn" :disabled="!canWriteHere" @click.stop="onSharedDrive ? sharedPickFiles() : uploadMenu($event)"><AppIcon name="upload" :size="15" />上传</button>
      <button class="tool-btn" :disabled="!selPaths.length" @click="downloadSel"><AppIcon name="download" :size="15" />下载</button>
      <button v-if="canSharePub" class="tool-btn" :disabled="!selPaths.length || onSharedDrive" @click="shareSel"><AppIcon name="share2" :size="15" />分享</button>
      <div class="tool-sep"></div>
      <button class="tool-btn" :disabled="!selPaths.length || onSharedDrive || readOnly" @click="cutSel"><AppIcon name="cut" :size="15" />剪切</button>
      <button class="tool-btn" :disabled="!selPaths.length || onSharedDrive || readOnly" @click="copySel"><AppIcon name="copy" :size="15" />复制</button>
      <button class="tool-btn" :disabled="!clip.mode || !currentPolicy || onSharedDrive || readOnly" @click="pasteSel"><AppIcon name="paste" :size="15" />粘贴</button>
      <div class="tool-sep"></div>
      <button class="tool-btn" :disabled="selPaths.length !== 1 || onSharedDrive || readOnly" @click="renameSel"><AppIcon name="rename" :size="15" />重命名</button>
      <button class="tool-btn" :disabled="selPaths.length < 2 || onSharedDrive || readOnly" @click="batchRenameOpen" title="对选中项批量重命名"><AppIcon name="rename" :size="15" />批量重命名</button>
      <button class="tool-btn" :disabled="!selPaths.length || readOnly || (onSharedDrive && !inWritableShare)" @click="deleteSel"><AppIcon name="trash" :size="15" />删除</button>
      <button class="tool-btn" v-if="group.allowArchive && selPaths.length && !onSharedDrive && !readOnly" @click="archiveSel"><AppIcon name="archive" :size="15" />压缩</button>
      <button class="tool-btn" v-if="singleZipSelected && !onSharedDrive" @click="extractSel"><AppIcon name="archive" :size="15" />解压</button>
      <div style="flex: 1"></div>
      <button class="tool-btn" :class="{ 'global-on': previewMode }" title="预览窗格（Alt+P）" @click="togglePreview">
        <AppIcon name="preview" :size="15" />
      </button>
      <button class="tool-btn" @click="viewMode = viewMode === 'grid' ? 'list' : 'grid'">
        <AppIcon :name="viewMode === 'grid' ? 'list' : 'grid'" :size="15" />
      </button>
    </div>

    <div style="flex: 1; display: flex; overflow: hidden">
      <!-- 侧栏 -->
      <div style="width: 210px; flex: none; border-right: 1px solid var(--stroke); overflow: auto; padding: 8px 6px">
        <div class="side-title">快速访问</div>
        <div v-for="s in stars" :key="s.id" class="side-item" :title="s.name"
          @click="openPolicyId(s.policyId, s.path)">
          <AppIcon name="starFill" :size="15" /><span>{{ s.name }}</span>
        </div>
        <div v-if="!stars.length" class="side-item" style="color: var(--text-3)">收藏的目录会显示在这里</div>
        <div class="side-title" style="margin-top: 10px">此电脑</div>
        <div v-for="p in realPolicies" :key="p.id" class="side-item" :class="{ active: currentPolicy && currentPolicy.id === p.id }"
          @click="openPolicy(p)">
          <AppIcon :name="p.type === 'local' ? 'drive' : 'cloud'" :size="16" />
          <span style="flex: 1">{{ p.name }}</span>
          <span style="font-size: 10.5px; color: var(--text-3)">{{ p.letter }}</span>
        </div>
        <div class="side-item" :class="{ active: onSharedDrive }" @click="openSharedDrive">
          <AppIcon name="share2" :size="16" />
          <span style="flex: 1">共享</span>
          <span style="font-size: 10.5px; color: var(--text-3)">{{ sharedWithMe.length }}</span>
        </div>
        <template v-if="sharedWithMe.length">
          <div class="side-title" style="margin-top: 10px">来自他人的共享</div>
          <div v-for="s in sharedWithMe" :key="s.id" class="side-item" :title="s.name"
            @click="store.open('shared', { shareId: s.id }, { title: s.name, icon: 'share' })">
            <AppIcon name="share2" :size="16" />
            <span style="flex: 1">{{ s.name }}</span>
            <span style="font-size: 10px; color: var(--text-3)">{{ s.perm === 'rw' ? '可写' : '只读' }}</span>
          </div>
        </template>
      </div>

      <!-- 主区：此电脑视图 -->
      <div v-if="!currentPolicy" style="flex: 1; overflow: auto; padding: 14px 22px">
        <div class="sec-title">共享 ({{ sharedWithMe.length }})</div>
        <div class="drive-grid">
          <div class="drive-card" :class="{ sel: selectedDrive === -1 }" @click="selectedDrive = -1"
            @dblclick="openSharedDrive">
            <AppIcon name="share2" :size="54" />
            <div style="flex: 1; min-width: 0">
              <div class="drive-name">共享</div>
              <div class="drive-bar"><div class="drive-bar-fill" style="width: 3%"></div></div>
              <div class="drive-sub">{{ sharedWithMe.length ? `来自他人的共享 ${sharedWithMe.length} 项` : '暂无来自他人的共享' }}</div>
            </div>
          </div>
        </div>
        <template v-if="localPolicies.length">
          <div class="sec-title">设备和驱动器 ({{ localPolicies.length }})</div>
          <div class="drive-grid">
            <div v-for="p in localPolicies" :key="p.id" class="drive-card" :class="{ sel: selectedDrive === p.id }"
              @click="selectedDrive = p.id" @dblclick="openPolicy(p)"
              @contextmenu.stop.prevent="onPolicyCtx(p, $event)">
              <AppIcon :name="p.type === 'local' ? 'drive' : 'cloud'" :size="54" />
              <div style="flex: 1; min-width: 0">
                <div class="drive-name" :title="p.name">{{ p.name }} ({{ p.letter }})</div>
                <div class="drive-bar" :title="driveRemain(p)">
                  <div class="drive-bar-fill" :class="{ full: usagePct(p) > 88 }" :style="driveBarStyle(p)"></div>
                </div>
                <div class="drive-sub">{{ driveSub(p) }}</div>
              </div>
            </div>
          </div>
        </template>
        <template v-if="cloudPolicies.length">
          <div class="sec-title" style="margin-top: 18px">云盘 ({{ cloudPolicies.length }})</div>
          <div class="drive-grid">
            <div v-for="p in cloudPolicies" :key="p.id" class="drive-card" :class="{ sel: selectedDrive === p.id }"
              @click="selectedDrive = p.id" @dblclick="openPolicy(p)"
              @contextmenu.stop.prevent="onPolicyCtx(p, $event)">
              <AppIcon name="cloud" :size="48" />
              <div style="flex: 1; min-width: 0">
                <div class="drive-name" :title="p.name">{{ p.name }} ({{ p.letter }})</div>
                <div class="drive-bar" :title="driveRemain(p)">
                  <div class="drive-bar-fill" :class="{ full: usagePct(p) > 88 }" :style="driveBarStyle(p)"></div>
                </div>
                <div class="drive-sub">{{ driveSub(p) }}</div>
              </div>
            </div>
          </div>
        </template>
        <div v-if="!realPolicies.length" class="empty-hint" style="position: static; margin-top: 80px">
          <AppIcon name="drive" :size="52" />
          <div>暂未挂载任何存储，请联系管理员在管理控制台挂载</div>
        </div>
      </div>

      <!-- 主区：文件列表视图 -->
      <div v-else ref="fileArea" style="flex: 1; position: relative; overflow: hidden; display: flex; flex-direction: column" @mousedown="onAreaMouseDown">
        <div v-if="viewMode === 'grid'" class="file-grid">
          <div v-for="f in sortedItems" :key="f.path + (f.letter || '')" class="file-item" :class="{ selected: selSet.has(f.path) }" :data-path="f.path"
            draggable="true"
            @mousedown="onItemDown(f, $event)" @dblclick="openItem(f)" @contextmenu.stop.prevent="onItemCtx(f, $event)"
            @dragstart="onItemDrag(f, $event)" @dragover.prevent @drop.prevent.stop="onDropTo(f, $event)">
            <input type="checkbox" class="f-check" :checked="selSet.has(f.path)" @mousedown.stop.prevent @click.stop="toggleCheck(f)" :title="selSet.has(f.path) ? '取消选择' : '选择'" />
            <span v-if="(f as any).letter" class="g-badge">{{ (f as any).letter }}</span>
            <div class="f-ico">
              <img v-if="isThumb(f)" :src="thumbUrl(f)" class="f-thumb" draggable="false" />
              <AppIcon v-else :name="iconOf(f)" :size="46" />
            </div>
            <div class="f-name"><span v-if="editing[f.path]" class="editing-dot" :title="'正在编辑：' + editing[f.path]"></span>{{ f.name }}</div>
          </div>
        </div>
        <div v-else class="file-list">
          <table>
            <thead>
              <tr>
                <th style="width: 34px; text-align: center; cursor: default"><input type="checkbox" :checked="allSelected" @mousedown.stop.prevent @click.stop="toggleAll" title="全选" /></th>
                <th style="width: 45%; cursor: pointer" :class="{ 'sort-active': sortMode === 'name' }" @click="setSort('name')">名称<span class="sort-arrow" v-if="sortMode === 'name'">{{ sortDir === 'asc' ? ' ▲' : ' ▼' }}</span></th>
                <th style="cursor: pointer" :class="{ 'sort-active': sortMode === 'modTime' }" @click="setSort('modTime')">修改时间<span class="sort-arrow" v-if="sortMode === 'modTime'">{{ sortDir === 'asc' ? ' ▲' : ' ▼' }}</span></th>
                <th style="cursor: pointer" :class="{ 'sort-active': sortMode === 'type' }" @click="setSort('type')">类型<span class="sort-arrow" v-if="sortMode === 'type'">{{ sortDir === 'asc' ? ' ▲' : ' ▼' }}</span></th>
                <th style="text-align: right; cursor: pointer" :class="{ 'sort-active': sortMode === 'size' }" @click="setSort('size')">大小<span class="sort-arrow" v-if="sortMode === 'size'">{{ sortDir === 'asc' ? ' ▲' : ' ▼' }}</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="f in sortedItems" :key="f.path" :data-path="f.path" :class="{ selected: selSet.has(f.path) }" draggable="true"
                @mousedown="onItemDown(f, $event)" @dblclick="openItem(f)" @contextmenu.stop.prevent="onItemCtx(f, $event)"
                @dragstart="onItemDrag(f, $event)" @dragover.prevent @drop.prevent.stop="onDropTo(f, $event)">
                <td style="width: 34px; text-align: center"><input type="checkbox" :checked="selSet.has(f.path)" @mousedown.stop.prevent @click.stop="toggleCheck(f)" /></td>
                <td><div style="display: flex; align-items: center; gap: 10px">
                  <AppIcon :name="iconOf(f)" :size="19" /><span>{{ f.name }}</span>
                  <span v-if="editing[f.path]" class="editing-badge" :title="'正在编辑：' + editing[f.path]"><span class="editing-dot"></span>编辑中</span>
                  <AppIcon v-if="f.starred" name="starFill" :size="13" />
                </div></td>
                <td style="color: var(--text-3)">{{ fmtTime(f.modTime) }}</td>
                <td style="color: var(--text-3)">{{ f.isDir ? '文件夹' : (f.ext ? f.ext.toUpperCase() + ' 文件' : '文件') }}</td>
                <td style="text-align: right; color: var(--text-3)">{{ f.isDir ? '' : fmt(f.size) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="!sortedItems.length && !loading" class="empty-hint">
          <AppIcon :name="keyword ? 'search' : 'folderPlain'" :size="48" />
          <div>{{ keyword ? '无搜索结果' : '此文件夹为空，拖入文件即可上传' }}</div>
        </div>
        <!-- 橡皮筋框选 -->
        <div v-if="boxSel" class="rubber-band" :style="{ left: boxSel.x + 'px', top: boxSel.y + 'px', width: boxSel.w + 'px', height: boxSel.h + 'px' }"></div>
      </div>

      <!-- 预览窗格（cloudreve / 可道云风格） -->
      <div v-if="previewMode && currentPolicy && selItem" class="preview-pane">
        <div class="pp-head">预览</div>
        <div class="pp-thumb">
          <img v-if="isThumb(selItem)" :src="thumbUrl(selItem)" class="pp-img" />
          <AppIcon v-else :name="iconOf(selItem)" :size="64" />
        </div>
        <div class="pp-name" :title="selItem.name">{{ selItem.name }}</div>
        <div class="pp-row"><span>类型</span><b>{{ selItem.isDir ? '文件夹' : (selItem.ext ? selItem.ext.toUpperCase() + ' 文件' : '文件') }}</b></div>
        <div class="pp-row"><span>大小</span><b>{{ selItem.isDir ? '—' : fmt(selItem.size) }}</b></div>
        <div class="pp-row"><span>修改时间</span><b>{{ fmtTime(selItem.modTime) }}</b></div>
        <div class="pp-row"><span>位置</span><b :title="path">{{ path }}</b></div>
        <div class="pp-actions">
          <button class="btn" @click="openItem(selItem)">打开</button>
          <button class="btn" @click="downloadSel">下载</button>
        </div>
        <div class="pp-actions" v-if="!onSharedDrive">
          <button class="btn" @click="renameSel" :disabled="readOnly">重命名</button>
          <button v-if="canSharePub" class="btn" @click="shareSel">分享</button>
        </div>
        <div class="pp-actions" v-if="!onSharedDrive && !session.isGuest">
          <button class="btn" @click="toggleStar(selItem)">{{ selItem.starred ? '取消收藏' : '收藏' }}</button>
        </div>
        <div class="pp-actions" v-if="onSharedDrive && currentShare">
          <span style="font-size: 12px; color: var(--text-3)">来自 {{ currentShare.owner }}（{{ currentShare.ownerName }}）· {{ currentShare.perm === 'rw' ? '可写共享' : '只读共享' }}</span>
        </div>
      </div>
    </div>

    <div class="statusbar">
      <span>{{ currentPolicy ? (onSharedDrive ? sharedStatusPath : currentPolicy.name + path) : '此电脑' }}</span>
      <span v-if="currentPolicy">{{ items.length }} 个项目</span>
      <span v-if="selPaths.length">已选中 {{ selPaths.length }} 项</span>
      <span style="flex: 1"></span>
      <span v-if="clip.mode">{{ clip.mode === 'cut' ? '已剪切' : '已复制' }} {{ clip.items.length }} 项</span>
    </div>

    <input ref="fileInput" type="file" multiple style="display: none" @change="onFilePicked" />
    <input ref="folderInput" type="file" webkitdirectory style="display: none" @change="onFilePicked" />
    <input ref="sharedFileInput" type="file" multiple style="display: none" @change="onSharedFilePicked" />

    <!-- 分享对话框 -->
    <div class="dialog-mask" v-if="shareShow" @click.self="shareShow = false">
      <div class="dialog">
        <h3>分享「{{ shareTarget?.name }}」</h3>
        <div class="row">
          <label>提取码{{ shareEnc ? '（必填，兼作解密密钥）' : '（留空则公开）' }}</label>
          <input class="input" v-model="sharePwd" :placeholder="shareEnc ? '至少 4 位' : '4-6 位'" style="width: 100%" />
        </div>
        <div class="row">
          <label>有效期</label>
          <select class="input" v-model.number="shareExpire" style="width: 100%">
            <option :value="0">永久有效</option>
            <option :value="1">1 天</option>
            <option :value="7">7 天</option>
            <option :value="30">30 天</option>
          </select>
        </div>
        <div class="row" style="display: flex; gap: 18px">
          <label style="display: flex; align-items: center; gap: 6px"><input type="checkbox" v-model="shareAllowDl" />允许下载</label>
          <label style="display: flex; align-items: center; gap: 6px"><input type="checkbox" v-model="sharePreview" />允许预览</label>
          <label style="display: flex; align-items: center; gap: 6px"><input type="checkbox" v-model="shareEdit" :disabled="shareEnc" />允许在线编辑</label>
        </div>
        <div class="row">
          <label style="display: flex; align-items: center; gap: 6px">
            <input type="checkbox" v-model="shareEnc" :disabled="encBusy" />端到端加密（E2E）
          </label>
        </div>
        <div class="row" style="font-size: 12px; color: var(--text-3)">
          {{ shareEnc
            ? '端到端加密：文件在本浏览器内用提取码加密后再上传，服务端与管理员均无法查看内容；接收方需提取码才能解密（不支持在线编辑/转存）'
            : '允许在线编辑：任何人打开分享链接即可进入 ONLYOFFICE 完整编辑器在线修改，保存自动归档旧版本（需已配置 Document Server）' }}
        </div>
        <div class="row">
          <label>下载次数限制（留空不限）</label>
          <input class="input" v-model.number="shareMaxDl" type="number" min="1" placeholder="不限" style="width: 100%" />
        </div>
        <div v-if="encBusy" class="row" style="font-size: 12.5px; color: var(--text-2)">
          <AppIcon name="refresh" :size="13" style="vertical-align: -2px" /> {{ encProgress || '正在准备…' }}
        </div>
        <div v-if="shareLink" class="row" style="background: #3b91d818; border-radius: 6px; padding: 10px; font-size: 12.5px; word-break: break-all; user-select: text; cursor: text" title="点选后可手动复制">
          {{ shareLink }}
        </div>
        <div class="actions">
          <button class="btn" :disabled="encBusy" @click="shareShow = false">关闭</button>
          <button v-if="!shareLink" class="btn primary" :disabled="encBusy" @click="doShare">{{ encBusy ? '加密上传中…' : '创建链接' }}</button>
          <button v-else class="btn primary" @click="copyLink">复制链接</button>
        </div>
      </div>
    </div>

    <!-- 属性对话框 -->
    <div class="dialog-mask" v-if="propShow" @click.self="propShow = false">
      <div class="dialog" style="width: 480px; max-height: 80vh; overflow: auto">
        <h3>属性</h3>
        <div v-if="propData" style="font-size: 13px; line-height: 2">
          <div>名称：{{ (propData.entry && propData.entry.name) || '' }}</div>
          <div>类型：{{ propData.entry && propData.entry.isDir ? '文件夹' : (propData.entry.ext ? propData.entry.ext.toUpperCase() + ' 文件' : '文件') }}</div>
          <div>位置：{{ propData.path }}</div>
          <div v-if="propData.entry && propData.entry.isDir">包含：{{ propData.count }} 个文件，{{ propData.dirCount }} 个文件夹</div>
          <div>大小：{{ fmt(propData.size) }}</div>
          <div v-if="propData.entry && !propData.entry.isDir">修改时间：{{ fmtTime(propData.entry.modTime) }}</div>
          <div v-if="propData.entry && !propData.entry.isDir && propData.sha256" style="word-break: break-all">
            SHA-256：<span style="font-family: Consolas, monospace; font-size: 11.5px; color: var(--text-2)">{{ propData.sha256 }}</span>
          </div>
          <div v-if="propData.entry && !propData.entry.isDir && propData.sha256Note" style="font-size: 12px; color: var(--text-3)">{{ propData.sha256Note }}</div>
        </div>
        <!-- 版本历史（仅文件；「版本管理」功能被禁用/无权限时整体隐藏） -->
        <div v-if="propData && propData.entry && !propData.entry.isDir && canVersion" style="margin-top: 16px; border-top: 1px solid var(--stroke); padding-top: 12px">
          <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px">版本历史</div>
          <div v-if="versionLoading" style="font-size: 12px; color: var(--text-3)">加载中...</div>
          <div v-else-if="!versions.length" style="font-size: 12px; color: var(--text-3)">暂无历史版本</div>
          <div v-else>
            <div v-for="v in versions" :key="v.id" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; background: var(--bg50); border-radius: 6px; margin-bottom: 6px; font-size: 12px">
              <div>
                <span style="font-weight: 500; color: var(--theme-2)">版本 {{ v.version }}</span>
                <span style="margin-left: 8px; color: var(--text-3)">{{ fmtSize(v.size) }}</span>
                <span style="margin-left: 8px; color: var(--text-3)">{{ fmtVersionDate(v.createdAt) }}</span>
                <span v-if="v.operator" style="margin-left: 8px; color: var(--text-3)">by {{ v.operator }}</span>
              </div>
              <div style="display: flex; gap: 4px">
                <button class="btn" style="padding: 3px 8px; font-size: 11px" @click="downloadVersion(v.version)">下载</button>
                <button class="btn" style="padding: 3px 8px; font-size: 11px" @click="restoreVersion(propData.path, v.version)">恢复</button>
              </div>
            </div>
          </div>
        </div>
        <div class="actions">
          <button class="btn primary" @click="propShow = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 直链对话框 -->
    <div class="dialog-mask" v-if="dlShow" @click.self="dlShow = false">
      <div class="dialog">
        <h3>提取直链 - {{ dlData?.name }}</h3>
        <div class="row">
          <label>有效期</label>
          <select class="input" v-model.number="dlHours" style="width: 100%">
            <option :value="1">1 小时</option>
            <option :value="24">24 小时</option>
            <option :value="168">7 天</option>
            <option :value="720">30 天</option>
            <option :value="0">永久</option>
          </select>
        </div>
        <div v-if="dlUrl" class="row" style="background: #3b91d818; border-radius: 6px; padding: 10px; font-size: 12px; word-break: break-all; user-select: text">
          {{ dlUrl }}
        </div>
        <div v-if="dlUrl" style="font-size: 11.5px; color: var(--text-3); margin-top: -6px">
          直链免登录可直接访问/下载（浏览器、下载工具、第三方链引用均可，到期自动失效）
        </div>
        <div class="actions">
          <button class="btn" @click="dlShow = false">关闭</button>
          <button v-if="!dlUrl" class="btn primary" @click="genDl">生成直链</button>
          <template v-else>
            <button class="btn" @click="testDl">打开测试</button>
            <button class="btn primary" @click="copyDl">复制直链</button>
          </template>
        </div>
      </div>
    </div>

    <!-- 站内共享对话框：可选 指定用户 / 用户组 / 所有人 -->
    <div class="dialog-mask" v-if="usShow" @click.self="usShow = false">
      <div class="dialog">
        <h3>共享「{{ usTarget?.name }}」</h3>
        <div class="row">
          <label>共享范围</label>
          <div style="display: flex; gap: 18px">
            <label style="display: flex; align-items: center; gap: 6px"><input type="radio" value="user" v-model="usTargetType" />指定用户</label>
            <label style="display: flex; align-items: center; gap: 6px"><input type="radio" value="group" v-model="usTargetType" />用户组</label>
            <label style="display: flex; align-items: center; gap: 6px"><input type="radio" value="all" v-model="usTargetType" />所有人</label>
          </div>
        </div>
        <div class="row" v-if="usTargetType === 'user'">
          <label>选择用户</label>
          <select class="input" v-model.number="usTargetUser" style="width: 100%">
            <option v-for="u in usUsers" :key="u.id" :value="u.id">{{ u.nickname }}（{{ u.username }}）</option>
          </select>
        </div>
        <div class="row" v-if="usTargetType === 'group'">
          <label>选择用户组</label>
          <select class="input" v-model.number="usTargetGroup" style="width: 100%">
            <option v-for="g in usGroups" :key="g.id" :value="g.id">{{ g.name }}</option>
          </select>
        </div>
        <div class="row" v-if="usTargetType === 'all'">
          <label style="font-size: 12px; color: var(--text-3)">所有注册账号（含以后注册者）都能在「共享」中看到该目录</label>
        </div>
        <div class="row">
          <label>权限</label>
          <div style="display: flex; gap: 18px">
            <label style="display: flex; align-items: center; gap: 6px"><input type="radio" value="ro" v-model="usPerm" />只读</label>
            <label style="display: flex; align-items: center; gap: 6px"><input type="radio" value="rw" v-model="usPerm" />可写（上传/新建/删除）</label>
          </div>
        </div>
        <div class="actions">
          <button class="btn" @click="usShow = false">取消</button>
          <button class="btn primary" @click="doUserShare">共享</button>
        </div>
      </div>
    </div>

    <!-- 离线下载对话框 -->
    <div class="dialog-mask" v-if="odShow" @click.self="odShow = false">
      <div class="dialog" style="width: 480px">
        <h3>离线下载到「{{ currentPolicy?.name }}{{ path === '/' ? '' : path }}」</h3>
        <div class="row">
          <label>下载链接（HTTP 直链 / 磁力 magnet: / .torrent 种子）</label>
          <input class="input" v-model="odUrl" placeholder="https://... 或 magnet:?xt=..." style="width: 100%; user-select: text"
            @keyup.enter="addOffline" />
        </div>
        <div class="row">
          <label>文件名（可选，磁力链获取到种子信息后自动命名）</label>
          <input class="input" v-model="odName" placeholder="默认自动命名" style="width: 100%" @keyup.enter="addOffline" />
        </div>
        <div class="actions" style="margin-top: 10px">
          <button class="btn" @click="odShow = false">关闭</button>
          <button class="btn primary" :disabled="!odUrl" @click="addOffline">添加任务</button>
        </div>
        <template v-if="odTasks.length">
          <div class="od-sep"></div>
          <div class="od-list">
            <div v-for="t in odTasks" :key="t.id" class="od-item">
              <div style="display: flex; justify-content: space-between; gap: 8px; margin-bottom: 5px">
                <span class="od-name" :title="odTaskName(t)">{{ odTaskName(t) }}</span>
                <span class="od-status" :style="t.status === 'error' ? 'color: var(--danger)' : t.status === 'finished' ? 'color: #2e9e5b' : ''">
                  {{ odStatus(t.status) }}{{ t.status === 'processing' ? ' ' + t.progress + '%' : '' }}
                </span>
              </div>
              <div class="progress-track"><div class="progress-fill" :style="{ width: t.progress + '%' }"></div></div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- 重命名对话框 -->
    <div class="dialog-mask" v-if="renameShow" @click.self="renameShow = false">
      <div class="dialog">
        <h3>重命名</h3>
        <input class="input" v-model="renameVal" style="width: 100%" @keyup.enter="doRename" />
        <div class="actions">
          <button class="btn" @click="renameShow = false">取消</button>
          <button class="btn primary" @click="doRename">确定</button>
        </div>
      </div>
    </div>

    <!-- 批量重命名对话框 -->
    <div class="dialog-mask" v-if="brShow" @click.self="brShow = false">
      <div class="dialog" style="width: 640px; max-width: 92vw">
        <h3>批量重命名（{{ brItems.length }} 个文件）</h3>
        <div style="display: grid; grid-template-columns: 92px 1fr; gap: 8px 12px; align-items: center; font-size: 13px">
          <label style="text-align: right; color: var(--text-2)">模式</label>
          <select class="input" v-model="brMode">
            <option value="replace">查找替换</option>
            <option value="prefix">添加前缀</option>
            <option value="suffix">添加后缀（不含扩展名）</option>
            <option value="seq">添加序号</option>
            <option value="case">更改大小写</option>
          </select>
          <template v-if="brMode === 'replace'">
            <label style="text-align: right; color: var(--text-2)">查找</label>
            <input class="input" v-model="brFind" placeholder="要替换的文本" />
            <label style="text-align: right; color: var(--text-2)">替换为</label>
            <input class="input" v-model="brRepl" placeholder="留空则删除" />
          </template>
          <template v-else-if="brMode === 'prefix' || brMode === 'suffix'">
            <label style="text-align: right; color: var(--text-2)">文本</label>
            <input class="input" v-model="brText" :placeholder="brMode === 'prefix' ? '如 img_' : '如 _copy'" />
          </template>
          <template v-else-if="brMode === 'seq'">
            <label style="text-align: right; color: var(--text-2)">格式</label>
            <input class="input" v-model="brSeqFmt" placeholder="如 _{n:2}（2 位补零），支持 {n} / {n:3}" />
          </template>
          <template v-else>
            <label style="text-align: right; color: var(--text-2)">目标</label>
            <select class="input" v-model="brCase">
              <option value="lower">全部小写（含扩展名）</option>
              <option value="upper">全部大写（含扩展名）</option>
              <option value="lowername">仅文件名小写</option>
              <option value="uppername">仅文件名大写</option>
            </select>
          </template>
        </div>
        <div style="margin-top: 12px; border-top: 1px solid var(--stroke); padding-top: 10px">
          <div style="font-size: 12px; color: var(--text-3); margin-bottom: 6px">预览（前 8 项）</div>
          <div style="max-height: 200px; overflow: auto; font-size: 12.5px; font-family: Consolas, monospace; line-height: 1.9">
            <div v-for="(p, i) in brPreview" :key="i">
              <span :style="{ color: p.err ? 'var(--danger, #e84c3d)' : 'var(--text-2)' }">{{ p.old }}</span>
              <span style="color: var(--text-3); margin: 0 8px">→</span>
              <span :style="{ color: p.err ? 'var(--danger, #e84c3d)' : 'var(--theme-2)' }">{{ p.err || p.new }}</span>
            </div>
          </div>
        </div>
        <div class="actions">
          <button class="btn" @click="brShow = false">取消</button>
          <button class="btn primary" :disabled="brBusy || brPreview.length === 0 || brPreview.some(p => p.err)" @click="doBatchRename">
            {{ brBusy ? '执行中 ' + brDone + '/' + brPreview.length : '应用重命名' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useWindows } from '../stores/windows'
import { useSession } from '../stores/session'
import { useAppState } from '../stores/appstate'
import { canUseOffline } from '../stores/apps'
import { useClipboard } from '../stores/ui'
import { useTransfer } from '../stores/transfer'
import { fsApi, shareApi, officeApi, type Policy, type FileItem } from '../api/modules'
import { rawUrl, downloadUrl } from '../api/modules'
import { get as aget, post as apost, del as adel } from '../api/http'
import { useContextMenu } from '../stores/ui'
import { useUiDialog, useToast } from '../stores/dialog'
import { userShareApi } from '../api/modules'
import { collectDropFiles } from '../utils/drop'
import { createEncryptedShare } from '../utils/shareEncrypt'
import { copyText } from '../utils/clipboard'
import AppIcon from '../components/AppIcon.vue'

const props = defineProps<{ winId: number; props: any }>()
const store = useWindows()
const session = useSession()
const apps = useAppState()
const router = useRouter()
// 离线下载/终端等无权限功能：入口整体隐藏（不显示禁用态），与「无权限功能完全隐藏」原则一致
const canOffline = computed(() => canUseOffline())
// 在终端中打开 = 本地终端（服务器 shell），仅管理员；普通用户的终端仅限 SSH 连自己的服务器
const canTerminal = computed(() => session.user?.role === 'admin' && apps.isAvailable('terminal'))
const clip = useClipboard()
const transfer = useTransfer()
const ctx = useContextMenu()
const uiDlg = useUiDialog()
const toast = useToast()

const group = computed(() => session.group || ({} as any))

const policies = ref<Policy[]>([])
const stars = ref<any[]>([])
const items = ref<FileItem[]>([])
const loading = ref(false)
const selSet = ref(new Set<string>())
const selectedDrive = ref(0)

// ---- 多标签（每个标签页保存：盘符路径/搜索/视图/前进后退历史） ----
interface Tab {
  policyId: number | null
  path: string
  keyword: string
  globalMode: boolean
  viewMode: 'grid' | 'list'
  history: string[]
  fwdStack: string[]
}
const tabs = ref<Tab[]>([])
const activeIdx = ref(0)
const activeTab = computed<Tab>(() => tabs.value[activeIdx.value] || tabs.value[0])
const currentPolicy = computed<Policy | null>(() => policies.value.find(p => p.id === activeTab.value?.policyId) || null)
const path = computed<string>({
  get: () => activeTab.value?.path ?? '/',
  set: v => { if (activeTab.value) activeTab.value.path = v }
})
const keyword = computed<string>({
  get: () => activeTab.value?.keyword ?? '',
  set: v => { if (activeTab.value) activeTab.value.keyword = v }
})
const globalMode = computed<boolean>({
  get: () => activeTab.value?.globalMode ?? false,
  set: v => { if (activeTab.value) activeTab.value.globalMode = v }
})
const viewMode = computed<'grid' | 'list'>({
  get: () => activeTab.value?.viewMode ?? 'grid',
  set: v => { if (activeTab.value) activeTab.value.viewMode = v }
})
const history = computed<string[]>(() => activeTab.value?.history ?? [])
const fwdStack = computed<string[]>(() => activeTab.value?.fwdStack ?? [])

function addTab(policyId: number | null = null, p = '/') {
  tabs.value.push({ policyId, path: p, keyword: '', globalMode: false, viewMode: 'grid', history: [], fwdStack: [] })
  activeIdx.value = tabs.value.length - 1
  selSet.value = new Set()
  load()
}
function switchTab(i: number) {
  if (i === activeIdx.value) return
  activeIdx.value = i
  selSet.value = new Set()
  load()
}
function closeTab(i: number) {
  tabs.value.splice(i, 1)
  if (!tabs.value.length) { store.close(props.winId); return }
  if (i < activeIdx.value) activeIdx.value--
  else if (i === activeIdx.value && activeIdx.value >= tabs.value.length) activeIdx.value = tabs.value.length - 1
  load()
}
function tabTitle(t: Tab): string {
  const p = policies.value.find(x => x.id === t.policyId)
  if (!p) return '此电脑'
  if (p.id === SHARED_POLICY) {
    if (t.path === '/') return '共享'
    const sp = sharedPathParse(t.path)
    if (sp) {
      const s = sharedWithMe.value.find((x: any) => x.id === sp.shareId)
      return s?.name || '共享'
    }
    return '共享'
  }
  if (t.path === '/') return `${p.name} (${p.letter})`
  return t.path.slice(t.path.lastIndexOf('/') + 1) || p.letter
}
// 排序（Windows 逻辑：文件夹永远在前，列头可点击切换方向）
const sortMode = ref<'name' | 'size' | 'modTime' | 'type'>('name')
const sortDir = ref<'asc' | 'desc'>('asc')
function setSort(m: 'name' | 'size' | 'modTime' | 'type') {
  if (sortMode.value === m) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else { sortMode.value = m; sortDir.value = 'asc' }
}
const sortedItems = computed(() => {
  const arr = [...items.value]
  const dir = sortDir.value === 'asc' ? 1 : -1
  arr.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
    let r = 0
    switch (sortMode.value) {
      case 'size': r = a.size - b.size; break
      case 'modTime': r = a.modTime - b.modTime; break
      case 'type': r = (a.ext || '').localeCompare(b.ext || '') || a.name.localeCompare(b.name, 'zh-CN'); break
      default: r = a.name.localeCompare(b.name, 'zh-CN')
    }
    return r * dir
  })
  return arr
})

const localPolicies = computed(() => policies.value.filter(p => p.type === 'local'))
// 共享虚拟盘已在「此电脑」顶部独立成区（+ 侧栏固定项），不能再混进云盘分组，
// 否则会以"共享 ()"（空盘符）的幽灵卡重复出现
const cloudPolicies = computed(() => policies.value.filter(p => p.type !== 'local' && p.id !== SHARED_POLICY))

const fileInput = ref<HTMLInputElement>()
const folderInput = ref<HTMLInputElement>()
const rootEl = ref<HTMLElement>()
const searchInput = ref<HTMLInputElement>()

const segs = computed(() => path.value.split('/').filter(Boolean))
const selPaths = computed(() => Array.from(selSet.value))
const singleZipSelected = computed(() =>
  group.value.allowArchive && selPaths.value.length === 1 &&
  /\.(zip|tar|tar\.gz|tgz|tar\.bz2|tbz2)$/i.test(selPaths.value[0]))
const canBack = computed(() => history.value.some(p => p !== path.value))

onMounted(async () => {
  await loadPolicies()
  await loadStars()
  // 优先恢复持久化在窗口 store 的标签页状态：整页编辑器（#/office）会卸载桌面外壳，
  // 关闭返回后本组件重建，本地 tabs 若不持久化就会退回默认「此电脑」视图
  const saved: any[] = Array.isArray(props.props?.tabs) ? props.props.tabs : []
  const valid = saved.filter(t => t && (t.policyId == null || policies.value.some(p => p.id === t.policyId)))
  if (valid.length) {
    tabs.value = valid.map(t => ({
      policyId: t.policyId ?? null,
      path: typeof t.path === 'string' && t.path ? t.path : '/',
      keyword: t.keyword || '',
      globalMode: !!t.globalMode,
      viewMode: t.viewMode === 'list' ? 'list' : 'grid',
      history: Array.isArray(t.history) ? t.history.filter((x: any) => typeof x === 'string') : [],
      fwdStack: Array.isArray(t.fwdStack) ? t.fwdStack.filter((x: any) => typeof x === 'string') : []
    }))
    activeIdx.value = Math.min(Math.max(0, Number(props.props?.activeIdx) || 0), tabs.value.length - 1)
    load()
  } else if (props.props && props.props.policyId) {
    addTab(props.props.policyId, props.props.path || '/')
  } else if (props.props && props.props.path) {
    // { path: 'C:/docs' } 形式
    const letter = props.props.path.split(':')[0]
    const rest = props.props.path.slice(letter.length + 1) || '/'
    const p = policies.value.find(x => x.letter === letter)
    addTab(p ? p.id : null, p ? rest : '/')
    if (p) load()
  } else {
    addTab(null, '/')
  }
  window.addEventListener('cp-refresh-explorer', onRefreshEvent)
  window.addEventListener('keydown', onKey)
  startEditPoll()
})
onBeforeUnmount(() => {
  window.removeEventListener('cp-refresh-explorer', onRefreshEvent)
  window.removeEventListener('keydown', onKey)
  if (editTimer) window.clearInterval(editTimer)
})

// 标签页状态（打开的盘/路径/视图/搜索词/前进后退栈）持久化到窗口 store，
// 桌面外壳重建（整页编辑器往返、锁屏解锁、主题切换）后按原状恢复
watch([() => tabs.value, activeIdx], () => {
  if (!tabs.value.length) return
  store.updateProps(props.winId, { tabs: tabs.value.map(t => ({ ...t })), activeIdx: activeIdx.value })
}, { deep: true })

function onRefreshEvent(e: any) {
  if (!currentPolicy.value) return
  const d = e.detail || {}
  if (!d.policyId || d.policyId === currentPolicy.value.id) {
    // 当前目录或其子目录有变化都要刷新（文件夹上传落在子目录时，当前目录需显示新文件夹）
    const cur = path.value
    const isChild = d.path && d.path !== cur && (d.path.startsWith(cur === '/' ? '/' : cur + '/'))
    if (!d.path || d.path === cur || isChild) refresh()
  }
}

// ---- 预览窗格（cloudreve / 可道云风格） ----
const previewMode = ref(false)
function togglePreview() { previewMode.value = !previewMode.value }
const selItem = computed<FileItem | null>(() => {
  if (selPaths.value.length !== 1) return null
  return items.value.find(i => i.path === selPaths.value[0]) || null
})

// 是否有对话框打开（打开时屏蔽快捷键，避免误触）
const anyDialogOpen = computed(() =>
  renameShow.value || brShow.value || shareShow.value || propShow.value || dlShow.value || usShow.value || odShow.value)

// 当前焦点是否在“文本输入类”控件上（此时应放行浏览器原生快捷键，如搜索框内 Ctrl+A 选中文本）
function isTextEntry(el: Element | null): boolean {
  if (!el) return false
  const he = el as HTMLElement
  if (he.tagName === 'TEXTAREA' || he.isContentEditable) return true
  if (he.tagName === 'INPUT') {
    const ty = (el as HTMLInputElement).type
    // 复选框/单选等“选择类”控件不应拦截快捷键：选中文件后焦点常停在这些控件上，
    // 否则 Ctrl+A/C/V/X/D、Delete、F2 等会全部失效
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color', 'hidden', 'image'].includes(ty)
  }
  return false
}

// ---- 键盘快捷键（仅当前激活的资源管理器窗口响应） ----
function onKey(e: KeyboardEvent) {
  const ae = document.activeElement as HTMLElement | null
  if (isTextEntry(ae)) {
    if (e.key === 'Escape') (ae as HTMLElement).blur()
    return
  }
  if (anyDialogOpen.value) return
  if (!rootEl.value || store.activeId !== props.winId) return
  const ctrl = e.ctrlKey || e.metaKey
  const k = e.key
  if (k === 'F2') { e.preventDefault(); renameSel(); return }
  // Delete 键或 Ctrl+D 均可删除（满足 Windows 风格习惯）
  if (k === 'Delete' || (ctrl && (k === 'd' || k === 'D'))) { e.preventDefault(); deleteSel(); return }
  if (k === 'F5') { e.preventDefault(); refresh(); return }
  if (k === 'Escape') { selSet.value = new Set(); return }
  if (ctrl && (k === 'a' || k === 'A')) { e.preventDefault(); selSet.value = new Set(items.value.map(x => x.path)); return }
  if (ctrl && (k === 'c' || k === 'C')) { e.preventDefault(); copySel(); return }
  if (ctrl && (k === 'x' || k === 'X')) { e.preventDefault(); cutSel(); return }
  if (ctrl && (k === 'v' || k === 'V')) { e.preventDefault(); pasteSel(); return }
  if (ctrl && (k === 'f' || k === 'F')) { e.preventDefault(); searchInput.value?.focus(); return }
  if (e.altKey && (k === 'p' || k === 'P')) { e.preventDefault(); togglePreview(); return }
  if (k === 'Enter' && selPaths.value.length) {
    e.preventDefault()
    const f = items.value.find(i => i.path === selPaths.value[selPaths.value.length - 1])
    if (f) openItem(f)
    return
  }
  if (k === 'Backspace') { e.preventDefault(); goUp(); return }
  if (e.altKey && k === 'ArrowLeft') { e.preventDefault(); back(); return }
  if (e.altKey && k === 'ArrowRight') { e.preventDefault(); fwd(); return }
}

// 共享虚拟盘：policyId=-1。根目录 = 共享给我列表；进入某共享后走 /shared/:id/* 端点。
// 路径编码：'/' = 共享根；'/s{id}' = 某共享根；'/s{id}/rel' = 共享内
const SHARED_POLICY = -1
const sharedPolicyDef: Policy = { id: SHARED_POLICY, name: '共享', letter: '', type: 'shared', rootPath: '', status: 'active', usageBytes: 0 }

async function loadPolicies() {
  try {
    const list = await fsApi.policies()
    policies.value = [...list, sharedPolicyDef]
  } catch { policies.value = [sharedPolicyDef] }
}
// 真实存储盘（不含共享虚拟盘）
const realPolicies = computed(() => policies.value.filter(p => p.id !== SHARED_POLICY))

const sharedWithMe = ref<any[]>([])
// 当前所在共享（共享盘内导航时有效）
const sharedCtx = computed(() => {
  if (currentPolicy.value?.id !== SHARED_POLICY) return null
  const m = /^\/s(\d+)(?:\/(.*))?$/.exec(path.value)
  if (!m) return null
  return { shareId: Number(m[1]), rel: m[2] || '' }
})
const currentShare = computed(() => {
  if (!sharedCtx.value) return null
  return sharedWithMe.value.find((s: any) => s.id === sharedCtx.value!.shareId) || null
})
const sharedSegs = computed(() => sharedCtx.value?.rel ? sharedCtx.value.rel.split('/').filter(Boolean) : [])
const onSharedDrive = computed(() => currentPolicy.value?.id === SHARED_POLICY)
// 只读用户组（访客）：自己的盘禁止写；管理员豁免
const readOnly = computed(() => !!group.value.readOnly && session.user?.role !== 'admin')
// 共享盘内：仅可写共享（rw）且未处于共享根目录时可写
const inWritableShare = computed(() => onSharedDrive.value && !!sharedCtx.value && currentShare.value?.perm === 'rw')
const canWriteHere = computed(() => {
  if (!currentPolicy.value) return false
  if (onSharedDrive.value) return inWritableShare.value
  return !readOnly.value
})
// 发起共享的资格：组允许 或 管理员（管理员豁免组限制）
// 分享入口可见性：无权限时整体隐藏（公开分享=share 功能，站内共享=usershare 功能，另需管理员或组允许）
const canSharePub = computed(() => (session.user?.role === 'admin' || !!group.value.allowShare) && apps.isAvailable('share'))
const canShareUser = computed(() => (session.user?.role === 'admin' || !!group.value.allowShare) && apps.isAvailable('usershare'))
const canVersion = computed(() => apps.isAvailable('version'))
// 共享盘状态栏位置（人类可读）
const sharedStatusPath = computed(() => {
  if (!onSharedDrive.value) return ''
  if (path.value === '/') return '共享'
  const s = currentShare.value
  const base = s ? `共享 › ${s.name}` : '共享'
  return sharedCtx.value?.rel ? `${base} › ${sharedCtx.value.rel}` : base
})

async function loadStars() {
  try { stars.value = await fsApi.starList() } catch { stars.value = [] }
  try { sharedWithMe.value = await userShareApi.withMe() } catch { sharedWithMe.value = [] }
}

function sharedPathParse(p: string): { shareId: number; rel: string } | null {
  const m = /^\/s(\d+)(?:\/(.*))?$/.exec(p)
  return m ? { shareId: Number(m[1]), rel: m[2] || '' } : null
}

function openSharedDrive() {
  if (!activeTab.value) addTab(SHARED_POLICY, '/')
  activeTab.value.policyId = SHARED_POLICY
  pushHistory('/')
  path.value = '/'
  keyword.value = ''
  load()
}

function openPolicy(p: Policy) { openPolicyId(p.id, '/') }
function openPolicyId(pid: number, p: string) {
  const pol = policies.value.find(x => x.id === pid)
  if (!pol) return
  if (!activeTab.value) addTab(pid, p)
  activeTab.value.policyId = pid
  pushHistory(p)
  path.value = p
  keyword.value = ''
  load()
}
function pushHistory(p: string) {
  const t = activeTab.value
  t.history.push(p)
  if (t.history.length > 60) t.history.shift()
  t.fwdStack.length = 0
}
function back() {
  // 栈里存的是“到达过的路径”（含当前），栈顶可能就是当前路径——先跳过，
  // 否则第一次按后退会原地不动（弹出当前路径后 path 不变）
  while (history.value.length && history.value[history.value.length - 1] === path.value) history.value.pop()
  if (!history.value.length) return
  const cur = history.value.pop()!
  fwdStack.value.push(path.value)
  path.value = cur
  load()
}
function fwd() {
  if (!fwdStack.value.length) return
  const next = fwdStack.value.pop()!
  history.value.push(path.value)
  path.value = next
  load()
}
function goUp() {
  if (path.value === '/') return
  const up = path.value.slice(0, path.value.lastIndexOf('/')) || '/'
  goto(up)
}
function goto(p: string) {
  if (!currentPolicy.value) return
  pushHistory(p)
  path.value = p
  load()
}

async function load() {
  if (!currentPolicy.value) return
  loading.value = true
  searching.value = false
  selSet.value = new Set()
  try {
    if (currentPolicy.value.id === SHARED_POLICY) {
      await loadShared()
      return
    }
    const d = await fsApi.list(currentPolicy.value.id, path.value)
    items.value = d.items
    store.setTitle(props.winId, `${currentPolicy.value.name} (${currentPolicy.value.letter})${path.value === '/' ? '' : ' - ' + path.value}`)
  } catch (e: any) {
    items.value = []
    store.setTitle(props.winId, '文件资源管理器')
    if (path.value !== '/') { path.value = '/'; load() }
  } finally { loading.value = false }
}

// 共享虚拟盘加载：根 = 共享给我列表（重名附创建者区分）；内部走 /shared/:id/list
async function loadShared() {
  if (path.value === '/') {
    const dup = new Map<string, number>()
    sharedWithMe.value.forEach((s: any) => dup.set(s.name, (dup.get(s.name) || 0) + 1))
    items.value = sharedWithMe.value.map((s: any) => ({
      name: (dup.get(s.name) || 0) > 1 ? `${s.name}（${s.ownerName}）` : s.name,
      path: '/s' + s.id,
      isDir: true,
      size: 0,
      modTime: s.createdAt ? new Date(s.createdAt).getTime() : 0,
      ext: '',
      shareId: s.id,
      shareOwner: s.owner,
      sharePerm: s.perm
    }))
    store.setTitle(props.winId, '共享')
    return
  }
  const c = sharedCtx.value
  if (!c) { items.value = []; return }
  try {
    const d = await userShareApi.list(c.shareId, c.rel)
    items.value = d.items.map((it: any) => ({
      name: it.name,
      path: `/s${c.shareId}/${it.relPath}`,
      isDir: it.isDir,
      size: it.size,
      modTime: it.modTime,
      ext: it.ext,
      shareId: c.shareId,
      shareOwner: currentShare.value?.owner,
      sharePerm: d.perm
    }))
    store.setTitle(props.winId, `共享 - ${currentShare.value?.name || ''}${c.rel ? ' - ' + c.rel : ''}`)
  } catch {
    // 共享被取消/失效：回落到共享根
    items.value = []
    path.value = '/'
    loadShared()
  }
}

function refresh() {
  if (globalMode.value && keyword.value) { doSearch(); return }
  if (keyword.value) doSearch()
  else load()
  loadStars()
}

// 当前列表是否来自搜索结果（用于清空关键词时恢复目录列表）
const searching = ref(false)

// 搜索竞态防护：快速输入时丢弃过期响应
let searchSeq = 0
async function doSearch() {
  if (onSharedDrive.value) { toast.error('共享盘暂不支持搜索'); keyword.value = ''; return }
  if (!keyword.value) { load(); return }
  const seq = ++searchSeq
  loading.value = true
  searching.value = true
  selSet.value = new Set()
  try {
    if (globalMode.value) {
      // 全局跨盘搜索：遍历所有可见存储
      const hits = await fsApi.globalSearch(keyword.value)
      if (seq !== searchSeq) return
      items.value = hits.map((h: any) => ({
        name: h.name, isDir: h.isDir, size: h.size, modTime: h.modTime, ext: h.ext,
        path: h.path, policyId: h.policyId, letter: h.letter, policyName: h.policyName
      }))
    } else {
      if (!currentPolicy.value) { items.value = []; return }
      const hits = await fsApi.search(currentPolicy.value.id, keyword.value, path.value)
      if (seq !== searchSeq) return
      // 后端返回的是完整虚拟路径（含子目录），不可用“当前路径+文件名”覆盖
      items.value = hits.map(h => ({ ...h, policyId: currentPolicy.value!.id, letter: currentPolicy.value!.letter, policyName: currentPolicy.value!.name }))
    }
  } catch { if (seq === searchSeq) items.value = [] } finally { if (seq === searchSeq) loading.value = false }
}

// 实时搜索：输入停止 300ms 后自动触发（Windows 资源管理器同款体验，无需按回车）
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(keyword, v => {
  clearTimeout(searchTimer)
  if (v) {
    searchTimer = setTimeout(doSearch, 300)
  } else if (searching.value) {
    // 清空关键词：恢复当前目录列表
    load()
  }
})

function toggleGlobal() {
  globalMode.value = !globalMode.value
  doSearch()
}

// ---- 选择 ----
function onItemDown(f: FileItem, e: MouseEvent) {
  if (e.button === 2) {
    if (!selSet.value.has(f.path)) { selSet.value = new Set([f.path]) }
    return
  }
  if (e.ctrlKey) {
    const s = new Set(selSet.value)
    s.has(f.path) ? s.delete(f.path) : s.add(f.path)
    selSet.value = s
  } else if (e.shiftKey && selPaths.value.length) {
    const last = selPaths.value[selPaths.value.length - 1]
    const i1 = sortedItems.value.findIndex(x => x.path === last)
    const i2 = sortedItems.value.findIndex(x => x.path === f.path)
    const [a, b] = i1 < i2 ? [i1, i2] : [i2, i1]
    selSet.value = new Set(sortedItems.value.slice(a, b + 1).map(x => x.path))
  } else {
    selSet.value = new Set([f.path])
  }
}

// ---- 复选框多选（Windows 11 资源管理器同款叠加勾选） ----
function toggleCheck(f: FileItem) {
  const s = new Set(selSet.value)
  s.has(f.path) ? s.delete(f.path) : s.add(f.path)
  selSet.value = s
}
const allSelected = computed(() =>
  sortedItems.value.length > 0 && sortedItems.value.every(f => selSet.value.has(f.path)))
function toggleAll() {
  selSet.value = allSelected.value
    ? new Set()
    : new Set(sortedItems.value.map(f => f.path))
}

// ---- 打开 ----
// 共享盘内打开：目录=进入；Office=内置编辑器（共享源）；图片/媒体/PDF=raw 内嵌；其余=下载
function openSharedItem(f: any) {
  if (f.isDir) { goto(f.path); return }
  const sp = sharedPathParse(f.path)
  if (!sp) return
  const ext = (f.ext || '').toLowerCase()
  if (OFFICE_EXTS.includes(ext)) {
    // 配置了 Document Server：整页编辑器（Cloudreve 模式，完整功能区）；PDF 走内嵌查看；未配置回退桌面窗口
    if (session.site.officeConfigured && ext !== 'pdf') {
      router.push(`/office?shareId=${sp.shareId}&rel=${encodeURIComponent(sp.rel)}`)
    } else {
      store.open('officeeditor', {
        shareId: sp.shareId, rel: sp.rel, name: f.name, size: f.size, ext,
        perm: currentShare.value?.perm || 'ro'
      }, { title: f.name + ' - Office', icon: 'office', w: 1100, h: 720 })
    }
    return
  }
  const previewExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'mp4', 'webm', 'mkv', 'mov', 'mp3', 'wav', 'ogg', 'flac', 'm4a', 'pdf']
  if (previewExts.includes(ext)) window.open(userShareApi.rawUrl(sp.shareId, sp.rel))
  else window.open(userShareApi.dlUrl(sp.shareId, sp.rel))
}

async function openItem(f: FileItem) {
  if (onSharedDrive.value) { openSharedItem(f); return }
  const ext = (f.ext || '').toLowerCase()
  const pid = (f as any).policyId || currentPolicy.value?.id || 0
  if (!pid) return
  // 跨盘打开：开新窗口定位
  if (f.isDir) {
    if (currentPolicy.value && pid === currentPolicy.value.id) { goto(f.path); return }
    store.open('explorer', { policyId: pid, path: f.path }, { title: f.name, w: 1000, h: 640 })
    return
  }
  const p = { policyId: pid, path: f.path, name: f.name, size: f.size, ext }
  const siblings = sortedItems.value
    .filter((x: any) => !x.isDir)
    .map((x: any) => ({ policyId: (x as any).policyId || pid, path: x.path, name: x.name, size: x.size, ext: (x.ext || '').toLowerCase() }))
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
    // 默认图片打开统一走 Picasa（图片查看器已下线）；list 供左右翻页
    store.open('picasa', { ...p, list: siblings.filter(x => ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(x.ext)) }, { title: f.name + ' - Picasa 图片预览', icon: 'image', w: 980, h: 660 })
  } else if (['mp4', 'webm', 'mkv', 'mov', 'mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) {
    store.open('mediaviewer', { ...p, list: siblings.filter(x => ['mp4', 'webm', 'mkv', 'mov', 'mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(x.ext)) }, { title: f.name + ' - 媒体播放器', icon: 'media', w: 900, h: 620 })
  } else if (ext === 'pdf' && apps.isAvailable('pdf_reader')) {
    // PDF 阅读器（pdf.js vendored）；功能停用回落到下方 officeeditor 静态预览
    store.open('pdfreader', p, { title: f.name + ' - PDF 阅读器', icon: 'pdfreader', w: 1080, h: 700 })
  } else if (['smm', 'xmind'].includes(ext) && apps.isAvailable('mindmap')) {
    store.open('mindmap', p, { title: f.name + ' - 思维导图', icon: 'mindmap', w: 1080, h: 700 })
  } else if (ext === 'excalidraw' && apps.isAvailable('whiteboard')) {
    store.open('whiteboard', p, { title: f.name + ' - 白板', icon: 'whiteboard', w: 1080, h: 700 })
  } else if (ext === 'drawio' && apps.isAvailable('flowchart')) {
    store.open('flowchart', p, { title: f.name + ' - 流程图', icon: 'flowchart', w: 1080, h: 700 })
  } else if (OFFICE_EXTS.includes(ext)) {
    // 配置了 Document Server：整页 ONLYOFFICE 编辑器（Cloudreve 模式：撑满整页 + 完整功能区，
    // 自己账号打开与分享链接打开同一形态）；PDF 走内嵌查看；未配置回退桌面窗口静态预览
    if (session.site.officeConfigured && ext !== 'pdf') {
      router.push(`/office?policyId=${pid}&path=${encodeURIComponent(f.path)}`)
    } else {
      store.open('officeeditor', p, { title: f.name + ' - Office', icon: 'office', w: 1100, h: 720 })
    }
  } else if (TEXT_EXTS.includes(ext) || !ext) {
    store.open('notepad', p, { title: f.name + ' - 记事本', icon: 'notepad', w: 780, h: 560 })
  } else if (['dxf', 'dwg'].includes(ext) && apps.isAvailable('cad_viewer')) {
    // CAD 图纸：默认走 CAD 看图（DXF/DWG，纯浏览器端离线渲染）
    store.open('cadviewer', p, { title: f.name + ' - CAD 看图', icon: 'cad', w: 1200, h: 780 })
  } else if (ARCHIVE_EXTS.includes(ext) && apps.isAvailable('archive_view')) {
    store.open('archiveviewer', p, { title: f.name + ' - 压缩包浏览器', icon: 'archive', w: 1000, h: 620 })
  } else {
    window.open(downloadUrl(pid, [f.path]))
  }
}
const TEXT_EXTS = ['txt', 'md', 'json', 'js', 'ts', 'vue', 'go', 'py', 'java', 'c', 'cpp', 'h', 'css', 'html', 'xml', 'yml', 'yaml', 'sh', 'bat', 'ini', 'conf', 'log', 'csv', 'sql', 'php', 'rb', 'rs', 'toml']
// Office 文档（含 OpenDocument/RTF，与 ONLYOFFICE Document Server 支持范围对齐；csv 默认仍走记事本）
const OFFICE_EXTS = ['docx', 'doc', 'odt', 'rtf', 'xlsx', 'xls', 'ods', 'pptx', 'ppt', 'odp', 'pdf']
// 压缩包（压缩包浏览器在线查看/解压；功能未开启时回落下载）。
// 单独 .gz/.bz2/.xz（非 tar 族）无目录表不可浏览，仍走下载/解压
const ARCHIVE_EXTS = ['zip', '7z', 'rar', 'tar', 'tgz', 'tbz2', 'txz']
// 新建创意文档模板（思维导图/白板/流程图，写入即带最小可编辑骨架）
const MINDMAP_TEMPLATE = JSON.stringify({ root: { data: { text: '中心主题' }, children: [] }, theme: { template: 'avocado', config: {} }, layout: 'logicalStructure', config: {}, view: null }, null, 2)
const WHITEBOARD_TEMPLATE = JSON.stringify({ type: 'excalidraw', version: 2, source: 'cloudpan', elements: [], appState: { viewBackgroundColor: '#ffffff', gridSize: null }, files: {} })
const DRAWIO_TEMPLATE = '<mxfile host="CloudPan" agent="CloudPan" version="24.7.7" type="device">\n  <diagram id="page1" name="第 1 页">\n    <mxGraphModel dx="800" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0">\n      <root>\n        <mxCell id="0"/>\n        <mxCell id="1" parent="0"/>\n      </root>\n    </mxGraphModel>\n  </diagram>\n</mxfile>'

// ---- 实时协作「正在编辑」徽章：30s 批量只读查询当前目录 Office 文件的协作状态 ----
// 只读查询不把自己登记为编辑者；编辑者由整页编辑器的 20s 心跳维护（90s 无心跳视为离开）
const editing = ref<Record<string, string>>({}) // path -> "张三、李四"
let editTimer: number | undefined
const EDIT_EXTS = OFFICE_EXTS.filter(x => x !== 'pdf') // pdf 不进 DS 协作
async function pollEditing() {
  if (!apps.isAvailable('office')) { editing.value = {}; return }
  const files = sortedItems.value.filter(f => !f.isDir && EDIT_EXTS.includes(f.ext || ''))
  if (!files.length) { editing.value = {}; return }
  try {
    const items = files.map(f => {
      const sp = onSharedDrive.value ? sharedPathParse(f.path) : null
      return sp
        ? { key: f.path, shareId: sp.shareId, rel: sp.rel }
        : { key: f.path, policyId: currentPolicy.value?.id, path: f.path }
    })
    const r = await officeApi.statusBatch(items)
    const out: Record<string, string> = {}
    for (const f of files) {
      const names = r[f.path]?.editors?.map(e => e.name).filter(Boolean)
      if (names?.length) out[f.path] = names.join('、')
    }
    editing.value = out
  } catch { editing.value = {} }
}
function startEditPoll() {
  pollEditing()
  editTimer = window.setInterval(pollEditing, 30000)
}

// ---- 打开方式：强制用指定应用打开（覆盖默认路由） ----
function openWith(f: FileItem, app: 'mediaviewer' | 'notepad' | 'officeeditor' | 'archiveviewer' | 'mindmap' | 'whiteboard' | 'flowchart' | 'imageeditor' | 'pdfreader' | 'picasa' | 'musicplayer' | 'epubreader' | 'codeeditor' | 'svgeditor' | 'emlviewer' | 'photopea' | 'cadviewer') {
  const pid = (f as any).policyId || currentPolicy.value?.id || 0
  if (!pid) return
  const ext = (f.ext || '').toLowerCase()
  const siblings = sortedItems.value
    .filter((x: any) => !x.isDir)
    .map((x: any) => ({ policyId: (x as any).policyId || pid, path: x.path, name: x.name, size: x.size, ext: (x.ext || '').toLowerCase() }))
  // 列表项自身不带 policyId（f 来自 fs/list，仅含 path）；补齐当前盘，
  // 否则记事本等应用拿到 policyId=undefined 会退化为只读空文档
  const withList: any = { ...f, ext, policyId: pid }
  // 图片/媒体：传入同类文件列表（图片为全部图片，音视频为全部音视频）
  if (app === 'picasa') withList.list = siblings.filter(x => ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(x.ext))
  else if (app === 'mediaviewer') withList.list = siblings.filter(x => ['mp4', 'webm', 'mkv', 'mov', 'mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(x.ext))
  else if (app === 'officeeditor') {
    // 列表项自身不带 policyId/shareId（双击走 openItem 会用当前盘回退，这里直接展开 f 会丢字段
    // → 编辑器 rawUrl(policyId=undefined) 报错「无法在线预览」），统一补齐
    if (onSharedDrive.value) {
      const sp = sharedPathParse(f.path)
      if (sp) { withList.shareId = sp.shareId; withList.rel = sp.rel; withList.perm = currentShare.value?.perm || 'ro' }
    } else if (!withList.policyId) {
      withList.policyId = pid
    }
    // 配置了 Document Server：与双击一致进整页 ONLYOFFICE 编辑器（Cloudreve 模式）；
    // 桌面窗口静态兜底仅在未配置 DS 时使用
    if (session.site.officeConfigured && ext !== 'pdf') {
      if (onSharedDrive.value) {
        const sp = sharedPathParse(f.path)
        if (sp) { router.push(`/office?shareId=${sp.shareId}&rel=${encodeURIComponent(sp.rel)}`); return }
      }
      if (pid) { router.push(`/office?policyId=${pid}&path=${encodeURIComponent(f.path)}`); return }
    }
  }
  const p = withList
  const map: Record<string, { title: string; icon: string; w: number; h: number }> = {
    mediaviewer: { title: f.name + ' - 媒体播放器', icon: 'media', w: 880, h: 580 },
    notepad: { title: f.name + ' - 记事本', icon: 'notepad', w: 780, h: 560 },
    officeeditor: { title: f.name + ' - Office', icon: 'office', w: 1100, h: 720 },
    archiveviewer: { title: f.name + ' - 压缩包浏览器', icon: 'archive', w: 1000, h: 620 },
    mindmap: { title: f.name + ' - 思维导图', icon: 'mindmap', w: 1080, h: 700 },
    whiteboard: { title: f.name + ' - 白板', icon: 'whiteboard', w: 1080, h: 700 },
    flowchart: { title: f.name + ' - 流程图', icon: 'flowchart', w: 1080, h: 700 },
    imageeditor: { title: f.name + ' - 图片编辑器', icon: 'imageedit', w: 980, h: 660 },
    pdfreader: { title: f.name + ' - PDF 阅读器', icon: 'pdfreader', w: 1080, h: 700 },
    picasa: { title: f.name + ' - Picasa 图片预览', icon: 'image', w: 980, h: 660 },
    musicplayer: { title: f.name + ' - 音乐播放器', icon: 'media', w: 920, h: 620 },
    epubreader: { title: f.name + ' - Epub 阅读器', icon: 'book', w: 1000, h: 700 },
    codeeditor: { title: f.name + ' - 多功能编辑器', icon: 'code', w: 1100, h: 720 },
    svgeditor: { title: f.name + ' - SVG 编辑器', icon: 'vector', w: 1100, h: 720 },
    emlviewer: { title: f.name + ' - EML 查看器', icon: 'mail', w: 1000, h: 700 },
    photopea: { title: f.name + ' - 在线PS', icon: 'ps', w: 1240, h: 780 },
    cadviewer: { title: f.name + ' - CAD 看图', icon: 'cad', w: 1200, h: 780 }
  }
  store.open(app, p, { title: map[app].title, icon: map[app].icon, w: map[app].w, h: map[app].h })
}
function buildOpenWith(f: FileItem) {
  const ext = (f.ext || '').toLowerCase()
  const items: any[] = [{ label: '默认程序', icon: iconOf(f), onClick: () => openItem(f) }]
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext)) {
    if (apps.isAvailable('picasa'))
      items.push({ label: 'Picasa 图片预览', icon: 'image', onClick: () => openWith(f, 'picasa') })
    if (apps.isAvailable('image_editor'))
      items.push({ label: '图片编辑器', icon: 'imageedit', onClick: () => openWith(f, 'imageeditor') })
    if (apps.isAvailable('photopea'))
      items.push({ label: '在线PS', icon: 'ps', onClick: () => openWith(f, 'photopea') })
  }
  if (['mp4', 'webm', 'mkv', 'mov', 'mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext))
    items.push({ label: '媒体播放器', icon: 'media', onClick: () => openWith(f, 'mediaviewer') })
  if (['dxf', 'dwg'].includes(ext) && apps.isAvailable('cad_viewer'))
    items.push({ label: 'CAD 看图', icon: 'cad', onClick: () => openWith(f, 'cadviewer') })
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext) && apps.isAvailable('music_player'))
    items.push({ label: '音乐播放器', icon: 'media', onClick: () => openWith(f, 'musicplayer') })
  if (TEXT_EXTS.includes(ext) || !ext)
    items.push({ label: '记事本', icon: 'notepad', onClick: () => openWith(f, 'notepad') })
  if (TEXT_EXTS.includes(ext) && apps.isAvailable('code_editor'))
    items.push({ label: '多功能编辑器', icon: 'code', onClick: () => openWith(f, 'codeeditor') })
  if (ext === 'epub' && apps.isAvailable('epub_reader'))
    items.push({ label: 'Epub 阅读器', icon: 'book', onClick: () => openWith(f, 'epubreader') })
  if (ext === 'svg' && apps.isAvailable('svg_editor'))
    items.push({ label: 'SVG 编辑器', icon: 'vector', onClick: () => openWith(f, 'svgeditor') })
  if (['eml', 'mht', 'mhtml'].includes(ext) && apps.isAvailable('eml_viewer'))
    items.push({ label: 'EML 查看器', icon: 'mail', onClick: () => openWith(f, 'emlviewer') })
  if (OFFICE_EXTS.includes(ext) && apps.isAvailable('office'))
    items.push({ label: 'Office 编辑器', icon: 'office', onClick: () => openWith(f, 'officeeditor') })
  if (ARCHIVE_EXTS.includes(ext) && apps.isAvailable('archive_view'))
    items.push({ label: '压缩包浏览器', icon: 'archive', onClick: () => openWith(f, 'archiveviewer') })
  if (ext === 'pdf' && apps.isAvailable('pdf_reader'))
    items.push({ label: 'PDF 阅读器', icon: 'pdfreader', onClick: () => openWith(f, 'pdfreader') })
  if (['smm', 'xmind'].includes(ext) && apps.isAvailable('mindmap'))
    items.push({ label: '思维导图', icon: 'mindmap', onClick: () => openWith(f, 'mindmap') })
  if (ext === 'excalidraw' && apps.isAvailable('whiteboard'))
    items.push({ label: '白板', icon: 'whiteboard', onClick: () => openWith(f, 'whiteboard') })
  if (ext === 'drawio' && apps.isAvailable('flowchart'))
    items.push({ label: '流程图', icon: 'flowchart', onClick: () => openWith(f, 'flowchart') })
  return items
}

function iconOf(f: FileItem) {
  // Win12 主题：按扩展名用 Windows 标准文件图标
  if (session.osTheme === 'win12') {
    if (f.isDir) return 'fileFolder'
    const e = (f.ext || '').toLowerCase()
    if (['docx', 'doc'].includes(e)) return 'fileWord'
    if (['xlsx', 'xls'].includes(e)) return 'fileExcel'
    if (['pptx', 'ppt'].includes(e)) return 'filePpt'
    if (e === 'pdf') return 'filePdf'
    if (['smm', 'xmind'].includes(e)) return 'fileMindmap'
    if (e === 'excalidraw') return 'fileWhiteboard'
    if (e === 'drawio') return 'fileFlowchart'
    if (ARCHIVE_EXTS.includes(e)) return 'fileZip'
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(e)) return 'fileImg'
    if (['dxf', 'dwg'].includes(e)) return 'cad'
    if (['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(e)) return 'fileVidio'
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(e)) return 'fileMusic'
    if (['exe', 'msi', 'bat', 'ps1'].includes(e)) return 'fileExe'
    if (['txt', 'md', 'log', 'ini', 'json', 'xml', 'js', 'ts', 'go', 'py', 'c', 'cpp', 'h', 'sh', 'css', 'html', 'yml', 'yaml', 'toml'].includes(e)) return 'fileTxt'
    return 'file'
  }
  if (f.isDir) return 'folder'
  const e = (f.ext || '').toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(e)) return 'image'
  if (['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(e)) return 'media'
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(e)) return 'media'
  if (['dxf', 'dwg'].includes(e)) return 'cad'
  if (['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'pdf'].includes(e)) return 'office'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) return 'archive'
  if (['smm', 'xmind'].includes(e)) return 'mindmap'
  if (e === 'excalidraw') return 'whiteboard'
  if (e === 'drawio') return 'flowchart'
  return 'file'
}
// ---- 内部拖拽移动 + 图片缩略图 ----
const IMG_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']
function onItemDrag(f: FileItem, e: DragEvent) {
  if (!e.dataTransfer) return
  // Windows 习惯：拖动多选中的某一项时，整组选中项一起移动
  const paths = selPaths.value.includes(f.path) && selPaths.value.length > 1 ? selPaths.value : [f.path]
  e.dataTransfer.setData('application/x-cp-path', paths.join('\n'))
  e.dataTransfer.effectAllowed = 'move'
}
function isThumb(f: FileItem) {
  // 共享虚拟盘无真实 policyId，缩略图走 /shared/:id/raw 由 onerror 兜底，这里直接回退图标
  if (currentPolicy.value?.id === SHARED_POLICY) return false
  return !f.isDir && !!currentPolicy.value && IMG_EXTS.includes((f.ext || '').toLowerCase())
}
function thumbUrl(f: FileItem) {
  // ?thumb=1 服务端生成小图（480px，磁盘缓存），避免网格/预览窗格加载原图
  return rawUrl((f as any).policyId || currentPolicy.value!.id, f.path) + '&thumb=1'
}

// ---- 新建（Windows 习惯：立即创建默认名并进入重命名；仅本地磁盘/文件夹内） ----
type NewKind = 'folder' | 'text' | 'mindmap' | 'whiteboard' | 'flowchart'
const NEW_TPL: Record<NewKind, { base: string; ext: string; template?: string }> = {
  folder: { base: '新建文件夹', ext: '' },
  text: { base: '新建文本文档', ext: '.txt' },
  mindmap: { base: '新建思维导图', ext: '.smm', template: MINDMAP_TEMPLATE },
  whiteboard: { base: '新建白板', ext: '.excalidraw', template: WHITEBOARD_TEMPLATE },
  flowchart: { base: '新建流程图', ext: '.drawio', template: DRAWIO_TEMPLATE }
}
async function newItem(kind: NewKind) {
  if (!currentPolicy.value || onSharedDrive.value || readOnly.value) return
  const t = NEW_TPL[kind]
  let final = t.base + t.ext
  // 重名自动加序号（Windows 同款格式，含空格）：新建文件夹 (2)、新建文本文档 (2).txt
  const names = new Set(items.value.map(x => x.name))
  let i = 2
  while (names.has(final)) { final = `${t.base} (${i})${t.ext}`; i++ }
  try {
    if (kind === 'folder') await fsApi.mkdir(currentPolicy.value.id, path.value, final)
    else await fsApi.writeText(currentPolicy.value.id, joinPath(path.value, final), t.template || '')
    await load()
    // Windows 行为：创建后名称处于可编辑状态
    renameTarget.value = joinPath(path.value, final)
    renameVal.value = final
    renameShow.value = true
  } catch (e: any) { toast.error(e.message) }
}
// ---- 上传（拖入/选择即自动上传，走 transfer 后台并发队列；文件夹保留目录结构） ----
function pickFiles() {
  fileInput.value?.click()
}
function pickFolder() {
  folderInput.value?.click()
}
// 工具栏「上传」下拉：文件 / 整个文件夹
function uploadMenu(e: MouseEvent) {
  ctx.show(e.clientX, e.clientY + 6, [
    { label: '上传文件…', icon: 'upload', onClick: pickFiles },
    { label: '上传文件夹…', icon: 'folder', onClick: pickFolder }
  ])
}
// 把文件加入后台上传队列并自动弹出传输面板
function startUpload(files: File[]) {
  if (!currentPolicy.value || !files.length) return
  if (onSharedDrive.value || readOnly.value) return
  const pid = currentPolicy.value.id
  const parent = path.value
  transfer.addFiles(pid, parent, files)
  transfer.panel(true)
  toast.success(`已加入 ${files.length} 个文件到上传队列`)
}
// 工具栏「新建」下拉（Windows 资源管理器同款）；创意文档项按系统功能门控
function newMenu(e: MouseEvent) {
  ctx.show(e.clientX, e.clientY + 6, [
    { label: '文件夹', icon: 'folder', onClick: () => newItem('folder') },
    { label: '文本文档', icon: 'notepad', onClick: () => newItem('text') },
    ...(apps.isAvailable('mindmap') ? [{ label: '思维导图', icon: 'mindmap', onClick: () => newItem('mindmap') }] : []),
    ...(apps.isAvailable('whiteboard') ? [{ label: '白板', icon: 'whiteboard', onClick: () => newItem('whiteboard') }] : []),
    ...(apps.isAvailable('flowchart') ? [{ label: '流程图', icon: 'flowchart', onClick: () => newItem('flowchart') }] : [])
  ])
}
function onFilePicked(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && currentPolicy.value) {
    startUpload(Array.from(input.files))
  }
  input.value = ''
}
// 把拖放条目展开为带 __cpRel 的文件列表（文件夹经 webkitGetAsEntry 递归遍历；
// 空目录显式补建；读取失败逐项上报，避免整批静默丢失）
async function droppedFiles(e: DragEvent): Promise<File[]> {
  const r = await collectDropFiles(e.dataTransfer!)
  if (r.problems.length) {
    console.warn('[CloudPan 拖拽读取失败]', r.problems)
    toast.error(`部分拖入内容读取失败：${r.problems[0]}${r.problems.length > 1 ? `（共 ${r.problems.length} 项）` : ''}`)
  }
  // 空目录（内部没有文件）：没有文件上传就不会被自动建出来，这里逐级显式创建
  if (r.emptyDirs.length && currentPolicy.value) {
    const pid = currentPolicy.value.id
    const done = new Set<string>()
    for (const dir of r.emptyDirs) {
      let p = '/'
      for (const seg of dir.split('/')) {
        const key = p + '/' + seg
        if (!done.has(key)) {
          done.add(key)
          fsApi.mkdir(pid, p, seg).catch(() => { /* 已存在/无权限：忽略 */ })
        }
        p = key
      }
    }
  }
  for (const d of r.files) (d.file as any).__cpRel = d.rel
  return r.files.map(d => d.file)
}
// 共享盘（可写共享）内的上传：走 /shared/:id/upload 直传（扁平，与 SharedBrowser 一致）
async function sharedUploadFiles(files: File[]) {
  const c = sharedCtx.value
  if (!c || !files.length) return
  for (const f of files) {
    await userShareApi.upload(c.shareId, c.rel, f)
  }
  toast.success('上传完成')
  load()
}
const sharedFileInput = ref<HTMLInputElement>()
function sharedPickFiles() {
  if (!inWritableShare.value) return
  sharedFileInput.value?.click()
}
async function onSharedFilePicked(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) {
    try { await sharedUploadFiles(Array.from(input.files)) } catch (err: any) { toast.error(err.message) }
  }
  input.value = ''
}
// 共享盘内可写共享的新建（仅文件夹，共享上传接口不支持文本文件）
async function sharedMkdir(rel: string) {
  const name = await uiDlg.prompt('新建文件夹', '新建文件夹', '创建')
  if (!name) return
  const c = sharedCtx.value
  if (!c) return
  try {
    await userShareApi.mkdir(c.shareId, rel, name)
    load()
  } catch (e: any) { toast.error(e.message) }
}
function sharedNewMenu(e: MouseEvent) {
  if (!inWritableShare.value) return
  ctx.show(e.clientX, e.clientY + 6, [
    { label: '文件夹', icon: 'folder', onClick: () => sharedMkdir(sharedCtx.value!.rel) }
  ])
}
async function onDrop(e: DragEvent) {
  if (!currentPolicy.value || !e.dataTransfer) return
  if (e.dataTransfer.files.length || e.dataTransfer.items?.length) {
    if (onSharedDrive.value) {
      if (!inWritableShare.value) { toast.error('此共享为只读，不能上传'); return }
      const r = await collectDropFiles(e.dataTransfer)
      if (r.problems.length) toast.error(`部分拖入内容读取失败：${r.problems[0]}`)
      try { await sharedUploadFiles(r.files.map(d => d.file)) } catch (err: any) { toast.error(err.message) }
      return
    }
    if (readOnly.value) { toast.error('该用户组为只读，仅可查看和下载'); return }
    const files = await droppedFiles(e)
    if (files.length) startUpload(files)
    return
  }
  // 内部拖拽：拖到空白处视为移动到当前目录（多选时整组一起移动）
  const srcs = e.dataTransfer.getData('application/x-cp-path').split('\n').filter(Boolean)
  if (srcs.length) startInternalMove(srcs, path.value)
}
async function onDropTo(f: FileItem, e: DragEvent) {
  if (!currentPolicy.value || !e.dataTransfer) return
  // 内部拖拽必须先判断：内部拖拽的 dataTransfer.items 同样非空（自定义类型本身算一项），
  // 若先判"外部文件"分支，内部移动会被 droppedFiles 判空后静默吞掉
  if (e.dataTransfer.types.includes('application/x-cp-path')) {
    if (!f.isDir || onSharedDrive.value || readOnly.value) return
    const srcs = e.dataTransfer.getData('application/x-cp-path').split('\n').filter(Boolean)
    // 不能拖入自身或自身子目录（Windows 同款拒绝）
    const valid = srcs.filter(s => s !== f.path && !s.startsWith(f.path + '/'))
    if (!valid.length) { toast.error('不能移动到其自身内部'); return }
    startInternalMove(valid, f.path)
    return
  }
  if (e.dataTransfer.files.length || e.dataTransfer.items?.length) {
    if (readOnly.value) { toast.error('该用户组为只读，仅可查看和下载'); return }
    if (onSharedDrive.value) {
      // 可写共享：拖入共享文件夹 → /shared/:id/upload（扁平上传，与共享应用一致）
      if (!inWritableShare.value || !f.isDir) { toast.error('此共享为只读，不能上传'); return }
      const sp = sharedPathParse(f.path)
      if (!sp) return
      const r = await collectDropFiles(e.dataTransfer)
      if (r.problems.length) toast.error(`部分拖入内容读取失败：${r.problems[0]}`)
      try {
        for (const d of r.files) await userShareApi.upload(sp.shareId, sp.rel, d.file)
        toast.success(`已上传 ${r.files.length} 个文件到「${f.name}」`)
        load()
      } catch (err: any) { toast.error(err.message) }
      return
    }
    // 外部文件/文件夹拖入文件夹 → 上传到该文件夹（保留目录结构）
    const files = await droppedFiles(e)
    if (!files.length) return
    transfer.addFiles(currentPolicy.value.id, f.path, files)
    transfer.panel(true)
    toast.success(`已加入 ${files.length} 个文件到「${f.name}」`)
  }
}
async function startInternalMove(paths: string[], dstDir: string) {
  if (!currentPolicy.value || onSharedDrive.value || readOnly.value) return
  // 剪切粘贴同款冲突处理：同名文件询问替换、同名目录跳过
  let dstList: { name: string; isDir: boolean }[] = []
  try {
    const d = await fsApi.list(currentPolicy.value.id, dstDir)
    dstList = d.items as any
  } catch { /* 目录列取失败按无冲突处理，后端仍会兜底报错 */ }
  const r = await resolveMoveConflicts(paths, dstList, dstDir)
  if (!r || !r.paths.length) return
  try {
    await fsApi.move(currentPolicy.value.id, r.paths, dstDir, r.overwrite)
    toast.success(`已移动 ${r.paths.length} 项`)
    load()
  } catch (e: any) { toast.error(e.message) }
}
// Windows 式剪切移动冲突处理：目标同名文件 → 询问替换（替换时后端先归档旧版本）；
// 目标同名目录 → 跳过该项（不合并、不覆盖）。返回 null = 用户取消且无可粘贴项
async function resolveMoveConflicts(srcs: string[], dstList: { name: string; isDir: boolean }[], dstDir?: string): Promise<{ paths: string[]; overwrite: boolean } | null> {
  // 原地移动 = 无操作（拖回/粘贴回所在目录，Windows 不做任何提示），先排除避免把自己当成冲突
  const eff = dstDir ? srcs.filter(s => (s.includes('/') ? s.slice(0, s.lastIndexOf('/')) : '/') !== dstDir) : srcs
  const byName = new Map(dstList.map(i => [i.name, i.isDir]))
  const base = (p: string) => p.split('/').pop() || p
  const clean: string[] = [], fileHit: string[] = [], dirHit: string[] = []
  for (const s of eff) {
    const n = base(s)
    if (byName.has(n)) (byName.get(n) ? dirHit : fileHit).push(s)
    else clean.push(s)
  }
  const saySkip = () => { if (dirHit.length) toast.error(`已跳过 ${dirHit.length} 项（目标已有同名目录）`) }
  if (fileHit.length) {
    const msg = `目标位置已存在 ${fileHit.length} 个同名文件${dirHit.length ? `，另有 ${dirHit.length} 个同名目录将被跳过` : ''}。是否替换文件？`
    const ok = await uiDlg.confirm('粘贴：替换文件', msg, { okText: '替换' })
    if (!ok) {
      if (!clean.length) { if (dirHit.length) saySkip(); return null }
      saySkip()
      return { paths: clean, overwrite: false }
    }
    saySkip()
    return { paths: [...clean, ...fileHit], overwrite: true }
  }
  if (dirHit.length) {
    if (!clean.length) { toast.error('不能粘贴：目标已存在同名目录'); return null }
    saySkip()
  }
  return { paths: clean, overwrite: false }
}
function downloadSel() {
  if (!currentPolicy.value || !selPaths.value.length) return
  if (onSharedDrive.value) {
    // 共享盘：逐项走 /shared/:id/download（目录自动 zip）
    for (const p of selPaths.value) {
      const sp = sharedPathParse(p)
      if (sp) window.open(userShareApi.dlUrl(sp.shareId, sp.rel))
    }
    return
  }
  const a = document.createElement('a')
  a.href = downloadUrl(currentPolicy.value.id, selPaths.value)
  a.click()
}
function copyPath(p: string) {
  // HTTP 环境（非安全上下文）下 navigator.clipboard 不可用，copyText 内部回退 execCommand
  copyText(p).then(ok => ok ? toast.success('路径已复制：' + p) : toast.error('复制失败，请手动选择文本复制'))
}

// ---- 剪切/复制/粘贴 ----
function clipItems() {
  if (!currentPolicy.value) return []
  return selPaths.value.map(p => ({ policyId: currentPolicy.value!.id, path: p, name: baseName(p), isDir: !!items.value.find(i => i.path === p)?.isDir }))
}
function cutSel() { clip.set('cut', clipItems()) }
function copySel() { clip.set('copy', clipItems()) }
async function pasteSel() {
  if (!currentPolicy.value || !clip.mode) return
  const same = clip.items.every(i => i.policyId === currentPolicy.value!.id)
  try {
    if (same) {
      if (clip.mode === 'cut') {
        // Windows 式：同名文件询问替换、同名目录跳过（复制走后端自动加序号，无冲突）
        const all = clip.items.map(i => i.path)
        const srcs = all.filter(s => s !== path.value && !path.value.startsWith(s + '/'))
        if (!srcs.length) { toast.error('不能粘贴到其自身内部'); return }
        if (srcs.length < all.length) toast.error('部分项不能粘贴到其自身内部，已跳过')
        const r = await resolveMoveConflicts(srcs, items.value as any, path.value)
        if (!r || !r.paths.length) return
        await fsApi.move(currentPolicy.value.id, r.paths, path.value, r.overwrite)
      } else await fsApi.copy(currentPolicy.value.id, clip.items.map(i => i.path), path.value)
    } else {
      // 跨存储：后端跨策略复制 / 移动（源盘读、目标盘写，目录递归，重名自动加 (1)）
      const items = clip.items.map(i => ({ policyId: i.policyId, path: i.path }))
      if (clip.mode === 'cut') await fsApi.crossMove(currentPolicy.value.id, path.value, items)
      else await fsApi.crossCopy(currentPolicy.value.id, path.value, items)
    }
    clip.clear()
    load()
  } catch (e: any) { toast.error(e.message) }
}

// ---- 重命名/删除/压缩 ----
const renameShow = ref(false)
const renameVal = ref('')
const renameTarget = ref('')
function renameSel() {
  if (selPaths.value.length !== 1 || onSharedDrive.value || readOnly.value) return
  renameTarget.value = selPaths.value[0]
  renameVal.value = baseName(renameTarget.value)
  renameShow.value = true
}
async function doRename() {
  if (!currentPolicy.value || !renameVal.value) return
  // 名称未改动（新建后直接点「确定」是常态）：直接确认，不发重命名请求
  if (renameVal.value === baseName(renameTarget.value)) {
    renameShow.value = false
    load()
    return
  }
  try {
    await fsApi.rename(currentPolicy.value.id, renameTarget.value, renameVal.value)
    renameShow.value = false
    load()
  } catch (e: any) { toast.error(e.message) }
}
async function deleteSel() {
  if (!currentPolicy.value || !selPaths.value.length) return
  if (onSharedDrive.value) {
    // 共享盘删除 = 从创建者的存储删除（物理删除，不可还原）
    const ok = await uiDlg.confirm('删除', `将删除选中 ${selPaths.value.length} 项？文件将从创建者的存储中删除，不可还原。`, { danger: true, okText: '删除' })
    if (!ok) return
    try {
      const byShare = new Map<number, string[]>()
      for (const p of selPaths.value) {
        const sp = sharedPathParse(p)
        if (!sp) continue
        if (!byShare.has(sp.shareId)) byShare.set(sp.shareId, [])
        byShare.get(sp.shareId)!.push(sp.rel)
      }
      for (const [sid, rels] of byShare) await userShareApi.del(sid, rels)
      load()
    } catch (e: any) { toast.error(e.message) }
    return
  }
  if (readOnly.value) { toast.error('该用户组为只读，仅可查看和下载'); return }
  const ok = await uiDlg.confirm('删除', `将删除选中 ${selPaths.value.length} 项？可在回收站还原。`, { danger: true, okText: '删除' })
  if (!ok) return
  try {
    await fsApi.remove(currentPolicy.value.id, selPaths.value)
    load()
  } catch (e: any) { toast.error(e.message) }
}
async function archiveSel() {
  if (!currentPolicy.value) return
  const name = await uiDlg.prompt('压缩打包（.zip / .tar / .tar.gz）', 'archive.zip', '压缩')
  if (!name) return
  try {
    const final = /\.(zip|tar|tar\.gz|tgz|tar\.bz2|tbz2)$/i.test(name) ? name : name + '.zip'
    await fsApi.archive(currentPolicy.value.id, selPaths.value, final)
    toast.success(`压缩任务已开始，完成后会通知你（文件将存为 ${final}）`)
    load()
  } catch (e: any) { toast.error(e.message) }
}

// ---- 批量重命名 ----
const brShow = ref(false)
const brItems = ref<FileItem[]>([])
const brMode = ref<'replace' | 'prefix' | 'suffix' | 'seq' | 'case'>('replace')
const brFind = ref('')
const brRepl = ref('')
const brText = ref('')
const brSeqFmt = ref('_{n:2}')
const brCase = ref<'lower' | 'upper' | 'lowername' | 'uppername'>('lowername')
const brBusy = ref(false)
const brDone = ref(0)

// 拆 文件名/扩展名（扩展名含点，无扩展名时 ext 为空）
function splitName(name: string): { base: string; ext: string } {
  const i = name.lastIndexOf('.')
  if (i <= 0) return { base: name, ext: '' }
  return { base: name.slice(0, i), ext: name.slice(i) }
}

function brTransform(it: FileItem, n: number): string {
  const { base, ext } = splitName(it.name)
  switch (brMode.value) {
    case 'replace': {
      if (!brFind.value) return it.name
      const newBase = base.split(brFind.value).join(brRepl.value)
      return newBase + ext
    }
    case 'prefix': return (brText.value || '') + it.name
    case 'suffix': {
      if (!brText.value) return it.name
      return base + brText.value + ext
    }
    case 'seq': {
      const fmt = brSeqFmt.value || '{n}'
      const m = fmt.match(/\{n(?::(\d+))?\}/)
      const num = m ? String(n + 1).padStart(parseInt(m[1] || '1', 10), '0') : String(n + 1)
      return it.name.replace(/\{n(?::\d+)?\}/g, num)
    }
    case 'case': {
      if (brCase.value === 'lower') return it.name.toLowerCase()
      if (brCase.value === 'upper') return it.name.toUpperCase()
      if (brCase.value === 'lowername') return base.toLowerCase() + ext
      return base.toUpperCase() + ext
    }
  }
  return it.name
}

const brPreview = computed(() => {
  const out: { old: string; new: string; err?: string }[] = []
  const seen = new Map<string, number>()
  brItems.value.forEach((it, i) => {
    const nn = brTransform(it, i)
    if (!nn || nn === it.name) {
      out.push({ old: it.name, new: it.name, err: brMode.value === 'replace' && !brFind.value ? '未填写查找内容' : '名称未变化' })
      return
    }
    const key = nn.toLowerCase()
    if (seen.has(key)) {
      out.push({ old: it.name, new: nn, err: '与另一项重名' })
      return
    }
    seen.set(key, i)
    out.push({ old: it.name, new: nn })
  })
  return out
})

function batchRenameOpen() {
  if (!currentPolicy.value) return
  // 仅对文件批量重命名（文件夹重命名请逐项进行，避免路径引用失效）
  const files = items.value.filter(f => selSet.value.has(f.path) && !f.isDir)
  if (files.length < 2) { toast.show('批量重命名需同时选中 2 个以上文件', 'info'); return }
  brItems.value = files
  brFind.value = ''; brRepl.value = ''; brText.value = ''; brSeqFmt.value = '_{n:2}'
  brMode.value = 'replace'
  brDone.value = 0
  brShow.value = true
}

async function doBatchRename() {
  if (!currentPolicy.value || brBusy.value) return
  brBusy.value = true
  brDone.value = 0
  let ok = 0
  try {
    for (const it of brItems.value) {
      const i = brItems.value.indexOf(it)
      const p = brPreview.value[i]
      if (!p || p.err || p.new === p.old) continue
      await fsApi.rename(currentPolicy.value.id, it.path, p.new)
      ok++
      brDone.value++
    }
    brShow.value = false
    toast.success(`已重命名 ${ok} 个文件`)
    load()
  } catch (e: any) {
    toast.error(`第 ${brDone.value + 1} 项失败：` + (e.message || '未知错误'))
  } finally {
    brBusy.value = false
  }
}

// ---- 离线下载（右键当前文件夹，HTTP/磁力/.torrent） ----
const odShow = ref(false)
const odUrl = ref('')
const odName = ref('')
const odTasks = ref<any[]>([])
let odTimer = 0
function offlineDlg() {
  if (!currentPolicy.value) return
  odUrl.value = ''
  odName.value = ''
  odTasks.value = []
  odShow.value = true
  loadOdTasks()
  clearInterval(odTimer)
  odTimer = window.setInterval(loadOdTasks, 2000)
}
watch(odShow, v => { if (!v) clearInterval(odTimer) })
onBeforeUnmount(() => clearInterval(odTimer))
async function loadOdTasks() {
  try { odTasks.value = (await aget('/offline')).slice(0, 8) } catch {}
}
async function addOffline() {
  if (!odUrl.value || !currentPolicy.value) return
  try {
    await apost('/offline', { policyId: currentPolicy.value.id, dest: path.value, url: odUrl.value, name: odName.value || undefined })
    toast.success('离线任务已创建')
    odUrl.value = ''
    odName.value = ''
    loadOdTasks()
  } catch (e: any) { toast.error(e.message) }
}
async function cancelOd(t: any) {
  try { await adel('/offline/' + t.id); loadOdTasks() } catch (e: any) { toast.error(e.message) }
}
function odTaskName(t: any) {
  try { const p = JSON.parse(t.props); return p.rtName || p.name || p.url } catch { return t.props }
}
function odStatus(s: string) {
  return ({ queued: '排队中', processing: '下载中', finished: '完成', error: '失败', canceled: '已取消' } as any)[s] || s
}

// ---- 站内共享（目标：指定用户 / 用户组 / 所有人）----
const usShow = ref(false)
const usTarget = ref<FileItem | null>(null)
// 共享所属策略：从目录右键共享时=当前盘；从「此电脑」右键整盘共享时=被右键的盘（可能≠currentPolicy）
const usPolicy = ref<Policy | null>(null)
const usUsers = ref<any[]>([])
const usGroups = ref<{ id: number; name: string }[]>([])
const usTargetType = ref<'user' | 'group' | 'all'>('user')
const usTargetUser = ref(0)
const usTargetGroup = ref(0)
const usPerm = ref('ro')
// 打开共享对话框（拉取用户/组、重置默认值）
async function openUserShareDlg() {
  try {
    const [users, groups] = await Promise.all([userShareApi.users(), userShareApi.groups()])
    usUsers.value = (users as any[]).filter((u: any) => u.id !== session.user?.id)
    usGroups.value = groups
  } catch { usUsers.value = []; usGroups.value = [] }
  usTargetType.value = 'user'
  usTargetUser.value = usUsers.value[0]?.id || 0
  usTargetGroup.value = usGroups.value[0]?.id || 0
  usPerm.value = 'ro'
  usShow.value = true
}
// 目录右键：共享选中的单个文件夹
async function shareUserSel() {
  if (selPaths.value.length !== 1) return
  if (onSharedDrive.value) { toast.error('共享盘内不能再次共享'); return }
  const f = items.value.find(i => i.path === selPaths.value[0])
  if (!f || !f.isDir) { toast.error('只能共享文件夹'); return }
  if (!currentPolicy.value) return
  usPolicy.value = currentPolicy.value
  usTarget.value = f
  await openUserShareDlg()
}
// 「此电脑」右键整盘共享：path="/"，共享整块盘的目录树（含根下所有子目录）
async function sharePolicyRoot(p: Policy) {
  if (onSharedDrive.value) { toast.error('共享盘内不能再次共享'); return }
  usPolicy.value = p
  usTarget.value = { name: p.name + (p.letter ? ` (${p.letter}:)` : ''), path: '/', isDir: true, size: 0, modTime: 0, ext: '' } as FileItem
  await openUserShareDlg()
}
async function doUserShare() {
  if (!usPolicy.value || !usTarget.value || onSharedDrive.value) return
  if (usTargetType.value === 'user' && !usTargetUser.value) { toast.error('请选择用户'); return }
  if (usTargetType.value === 'group' && !usTargetGroup.value) { toast.error('请选择用户组'); return }
  const isRoot = usTarget.value.path === '/'
  try {
    await userShareApi.create({
      policyId: usPolicy.value.id, path: usTarget.value.path,
      targetType: usTargetType.value,
      targetId: usTargetType.value === 'all' ? 0 : (usTargetType.value === 'group' ? usTargetGroup.value : usTargetUser.value),
      perm: usPerm.value
    })
    toast.success(isRoot ? '整盘共享成功，对方登录后可在「共享」中看到该磁盘' : '共享成功，对方登录后可在「共享」中看到该目录')
    usShow.value = false
  } catch (e: any) { toast.error(e.message) }
}

// ---- 分享 ----
const shareShow = ref(false)
const shareTarget = ref<FileItem | null>(null)
const sharePwd = ref('')
const shareExpire = ref(0)
const shareMaxDl = ref<number>(0)
const shareAllowDl = ref(true)
const sharePreview = ref(true)
const shareEdit = ref(true)
const shareLink = ref('')
const shareEnc = ref(false)
const encBusy = ref(false)
const encProgress = ref('')
function shareSel() {
  if (selPaths.value.length !== 1) return
  if (onSharedDrive.value) { toast.error('共享盘内不能创建分享链接'); return }
  shareTarget.value = items.value.find(i => i.path === selPaths.value[0]) || null
  sharePwd.value = ''; shareExpire.value = 0; shareMaxDl.value = 0; shareLink.value = ''
  shareEnc.value = false; encBusy.value = false; encProgress.value = ''
  shareShow.value = true
}
// 分享对话框打开时重置在线编辑开关为默认值（允许）
watch(shareShow, v => { if (v) shareEdit.value = true })
async function doShare() {
  if (!currentPolicy.value || !shareTarget.value) return
  const t = shareTarget.value
  try {
    if (shareEnc.value) {
      // 端到端加密：本地逐文件加密后上传密文（进度显示在对话框）
      encBusy.value = true
      encProgress.value = '正在收集文件…'
      try {
        const r = await createEncryptedShare(
          { policyId: currentPolicy.value.id, path: t.path, isDir: !!t.isDir, password: sharePwd.value },
          { expireDays: shareExpire.value, allowDownload: shareAllowDl.value, previewEnabled: sharePreview.value },
          p => { encProgress.value = p.done >= p.total ? '加密完成，正在收尾…' : `正在加密 ${p.done + 1}/${p.total}：${p.name}` }
        )
        shareLink.value = location.origin + location.pathname + '#/s/' + r.token
        toast.success(`加密分享已创建（${r.count} 个文件已加密上传）`)
      } finally {
        encBusy.value = false
        encProgress.value = ''
      }
      return
    }
    const s = await shareApi.create({
      policyId: currentPolicy.value.id, path: t.path,
      password: sharePwd.value || undefined, expireDays: shareExpire.value,
      remainDownloads: (Number.isFinite(shareMaxDl.value) && shareMaxDl.value > 0) ? Math.floor(shareMaxDl.value) : 0,
      allowDownload: shareAllowDl.value, previewEnabled: sharePreview.value, allowEdit: shareEdit.value
    })
    shareLink.value = location.origin + location.pathname + '#/s/' + s.token
  } catch (e: any) {
    toast.error(e.message)
    encBusy.value = false
    encProgress.value = ''
  }
}
async function copyLink() {
  const ok = await copyText(shareLink.value)
  if (ok) {
    toast.success('链接已复制')
    shareShow.value = false
  } else {
    // 失败时不关对话框，提示手动选择链接复制
    toast.error('复制失败，请选中下方链接后按 Ctrl+C 复制')
  }
}

// ---- 属性 ----
const propShow = ref(false)
const propData = ref<any>(null)
const versions = ref<any[]>([])
const versionLoading = ref(false)
async function showProps(p: string) {
  if (!currentPolicy.value) return
  try {
    propData.value = await fsApi.properties(currentPolicy.value.id, p)
    propShow.value = true
    // 如果是文件且「版本管理」功能可用，加载版本历史（无权限时不发请求、不显示区块）
    if (canVersion.value && propData.value && propData.value.entry && !propData.value.entry.isDir) {
      await loadVersions(p)
    }
  } catch (e: any) { toast.error(e.message) }
}
async function loadVersions(path: string) {
  if (!currentPolicy.value) return
  versionLoading.value = true
  try {
    // fsApi.* 已解包返回 data（http.ts 统一抛错），这里直接取数组
    const data = await fsApi.fileVersions(currentPolicy.value.id, path)
    versions.value = data || []
  } catch (e: any) { toast.error(e.message) }
  finally { versionLoading.value = false }
}
function downloadVersion(version: number) {
  if (!currentPolicy.value || !propData.value) return
  window.open(fsApi.fileVersionDownloadUrl(currentPolicy.value.id, propData.value.path, version))
}
async function restoreVersion(path: string, version: number) {
  if (!currentPolicy.value) return
  try {
    // fsApi.* 已解包返回 data（http.ts 统一抛错），resolve 即成功
    await fsApi.fileVersionRestore(currentPolicy.value.id, path, version)
    toast.success(`已恢复至版本 ${version}`)
    await loadVersions(path)
    // 刷新当前视图
    refresh()
  } catch (e: any) { toast.error(e.message) }
}
function fmtVersionDate(ts: number) {
  return new Date(ts).toLocaleString('zh-CN')
}

// ---- 直链 ----
const dlShow = ref(false)
const dlTarget = ref('')
const dlHours = ref(24)
const dlUrl = ref('')
const dlData = ref<any>(null)
function dlinkSel() {
  if (selPaths.value.length !== 1) return
  const f = items.value.find(i => i.path === selPaths.value[0])
  if (!f || f.isDir) { toast.error('文件夹不支持直链，请使用分享'); return }
  dlTarget.value = f.path
  dlUrl.value = ''
  dlData.value = f
  dlShow.value = true
}
async function genDl() {
  if (!currentPolicy.value) return
  try {
    const d = await fsApi.dlink(currentPolicy.value.id, dlTarget.value, dlHours.value)
    dlUrl.value = location.origin + d.url
  } catch (e: any) { toast.error(e.message) }
}
async function copyDl() {
  const ok = await copyText(dlUrl.value)
  if (ok) {
    toast.success('直链已复制')
    dlShow.value = false
  } else {
    toast.error('复制失败，请选中上方直链后按 Ctrl+C 复制')
  }
}
function testDl() { window.open(dlUrl.value) }

// ---- 右键菜单（严格遵循 Windows 逻辑） ----
// 空白处：此电脑根视图 = 查看/刷新/粘贴(禁用)/属性，不允许新建；
//         磁盘/文件夹内部 = 查看/排序方式/刷新/粘贴/新建/在终端打开/属性

// ---- 橡皮筋框选（Windows 拖拽多选） ----
const fileArea = ref<HTMLElement>()
const boxSel = ref<null | { x: number; y: number; w: number; h: number }>(null)

function onAreaMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  const target = e.target as HTMLElement
  if (target.closest('.file-item, tr, .dialog-mask, input, button, select, a')) return
  if (!currentPolicy.value) return
  const area = fileArea.value
  if (!area) return
  const addMode = e.ctrlKey
  const base = addMode ? new Set(selSet.value) : new Set<string>()
  if (!addMode) selSet.value = new Set()
  const rect = area.getBoundingClientRect()
  const sx = e.clientX, sy = e.clientY
  const sl = sx - rect.left + area.scrollLeft
  const st = sy - rect.top + area.scrollTop

  const onMove = (ev: MouseEvent) => {
    const l = Math.min(sl, ev.clientX - rect.left + area.scrollLeft)
    const t = Math.min(st, ev.clientY - rect.top + area.scrollTop)
    const w = Math.abs(ev.clientX - sx)
    const h = Math.abs(ev.clientY - sy)
    boxSel.value = { x: l, y: t, w, h }
    // 视口坐标相交测试
    const vx1 = Math.min(sx, ev.clientX), vx2 = Math.max(sx, ev.clientX)
    const vy1 = Math.min(sy, ev.clientY), vy2 = Math.max(sy, ev.clientY)
    const hits = new Set(base)
    area.querySelectorAll('.file-item[data-path], tr[data-path]').forEach(el => {
      const r = el.getBoundingClientRect()
      if (r.right > vx1 && r.left < vx2 && r.bottom > vy1 && r.top < vy2) {
        const p = (el as HTMLElement).dataset.path
        if (p) hits.add(p)
      }
    })
    selSet.value = hits
  }
  const onUp = () => {
    boxSel.value = null
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function onBlankCtx(e: MouseEvent) {
  if (!currentPolicy.value) {
    ctx.show(e.clientX, e.clientY, [
      {
        label: '查看', icon: 'grid', children: [
          { label: '大图标', checked: viewMode.value === 'grid', onClick: () => (viewMode.value = 'grid') },
          { label: '详细信息', checked: viewMode.value === 'list', onClick: () => (viewMode.value = 'list') }
        ]
      },
      { label: '刷新', icon: 'refresh', onClick: refresh },
      { separator: true },
      { label: '粘贴', icon: 'paste', disabled: true },
      { separator: true },
      { label: '属性', icon: 'info', onClick: () => store.open('settings') }
    ])
    return
  }
  const shared = onSharedDrive.value
  const blankMenu: any[] = [
    {
      label: '查看', icon: 'grid', children: [
        { label: '大图标', checked: viewMode.value === 'grid', onClick: () => (viewMode.value = 'grid') },
        { label: '详细信息', checked: viewMode.value === 'list', onClick: () => (viewMode.value = 'list') }
      ]
    },
    {
      label: '排序方式', icon: 'list', children: [
        { label: '名称', checked: sortMode.value === 'name', onClick: () => (sortMode.value = 'name') },
        { label: '大小', checked: sortMode.value === 'size', onClick: () => (sortMode.value = 'size') },
        { label: '修改时间', checked: sortMode.value === 'modTime', onClick: () => (sortMode.value = 'modTime') },
        { label: '类型', checked: sortMode.value === 'type', onClick: () => (sortMode.value = 'type') }
      ]
    },
    { label: '刷新', icon: 'refresh', onClick: refresh },
    { separator: true }
  ]
  if (shared) {
    if (inWritableShare.value) {
      blankMenu.push(
        { label: '新建文件夹', icon: 'folder', onClick: () => sharedMkdir(sharedCtx.value!.rel) },
        { label: '上传文件…', icon: 'upload', onClick: sharedPickFiles },
        { separator: true }
      )
    }
  } else {
    blankMenu.push(
      { label: '粘贴', icon: 'paste', onClick: pasteSel, disabled: !clip.mode || readOnly.value },
      { separator: true },
      {
        label: '新建', icon: 'plus', disabled: readOnly.value, children: [
          { label: '文件夹', icon: 'folder', onClick: () => newItem('folder') },
          { label: '文本文档', icon: 'notepad', onClick: () => newItem('text') },
          ...(apps.isAvailable('mindmap') ? [{ label: '思维导图', icon: 'mindmap', onClick: () => newItem('mindmap') }] : []),
          ...(apps.isAvailable('whiteboard') ? [{ label: '白板', icon: 'whiteboard', onClick: () => newItem('whiteboard') }] : []),
          ...(apps.isAvailable('flowchart') ? [{ label: '流程图', icon: 'flowchart', onClick: () => newItem('flowchart') }] : [])
        ]
      },
      {
        label: '上传', icon: 'upload', disabled: readOnly.value, children: [
          { label: '上传文件…', icon: 'upload', onClick: pickFiles },
          { label: '上传文件夹…', icon: 'folder', onClick: pickFolder }
        ]
      },
      ...(canOffline.value ? [
        { label: '离线下载到此', icon: 'cloud', onClick: offlineDlg }
      ] : []),
      ...(canTerminal.value ? [
        {
          label: '在终端中打开', icon: 'terminal',
          onClick: () => store.open('terminal', { policyId: currentPolicy.value!.id, path: path.value }, { title: '终端' })
        }
      ] : []),
      { separator: true },
      { label: '属性', icon: 'info', onClick: () => showProps(path.value) }
    )
  }
  ctx.show(e.clientX, e.clientY, blankMenu)
}
function onItemCtx(f: FileItem, e: MouseEvent) {
  onItemDown(f, e)
  const starred = !!f.starred
  const shared = onSharedDrive.value
  // 共享盘内：只保留 打开/路径/下载（+ 可写共享的 新建/上传/删除）
  if (shared) {
    const menu: any[] = [
      { label: f.isDir ? '打开' : '预览/打开', icon: 'fwd', onClick: () => openItem(f) },
      { label: '复制路径', icon: 'link', onClick: () => copyPath(f.path) },
      { label: f.isDir ? '下载 (zip)' : '下载', icon: 'download', onClick: downloadSel }
    ]
    if (inWritableShare.value) {
      menu.push(
        { separator: true },
        ...(f.isDir ? [{ label: '新建文件夹', icon: 'folder', onClick: () => sharedMkdir(sharedPathParse(f.path)?.rel || '') }] : []),
        { label: '删除', icon: 'trash', danger: true, onClick: deleteSel }
      )
    }
    ctx.show(e.clientX, e.clientY, menu)
    return
  }

  if (selPaths.value.length > 1) {
    // 多选（Windows：只保留批量操作）
    ctx.show(e.clientX, e.clientY, [
      { label: `下载 ${selPaths.value.length} 项`, icon: 'download', onClick: downloadSel },
      { label: '剪切', icon: 'cut', onClick: cutSel, disabled: readOnly.value },
      { label: '复制', icon: 'copy', onClick: copySel, disabled: readOnly.value },
      { separator: true },
      // 「压缩」功能被组禁用时整体隐藏（不再显示禁用态）
      ...(group.value.allowArchive ? [{ label: '压缩打包', icon: 'archive', onClick: archiveSel, disabled: readOnly.value }] : []),
      { label: '删除', icon: 'trash', danger: true, onClick: deleteSel, disabled: readOnly.value },
      { separator: true },
      { label: '属性', icon: 'info', onClick: () => showProps(selPaths.value[0]) }
    ])
    return
  }

  if (f.isDir) {
    ctx.show(e.clientX, e.clientY, [
      { label: '打开', icon: 'fwd', onClick: () => openItem(f) },
      { label: '复制路径', icon: 'link', onClick: () => copyPath(f.path) },
      { label: '下载 (zip)', icon: 'download', onClick: downloadSel },
      ...(canSharePub.value ? [{ label: '分享', icon: 'share2', onClick: shareSel }] : []),
      ...(canShareUser.value ? [{ label: '共享…', icon: 'user', onClick: shareUserSel }] : []),
      { separator: true },
      // 游客为共享账号：收藏是共享状态，入口隐藏（后端 GuestReadOnly 兜底）
      ...(session.isGuest ? [] : [{ label: starred ? '取消收藏' : '收藏到快速访问', icon: starred ? 'star' : 'starFill', onClick: () => toggleStar(f) }]),
      { label: '剪切', icon: 'cut', onClick: cutSel, disabled: readOnly.value },
      { label: '复制', icon: 'copy', onClick: copySel, disabled: readOnly.value },
      { label: '粘贴到内部', icon: 'paste', onClick: pasteInto(f), disabled: !clip.mode || readOnly.value },
      { label: '重命名', icon: 'rename', onClick: renameSel, disabled: readOnly.value },
      { separator: true },
      // 「压缩」功能被组禁用时整体隐藏（不再显示禁用态）
      ...(group.value.allowArchive ? [{ label: '压缩打包', icon: 'archive', onClick: archiveSel, disabled: readOnly.value }] : []),
      { label: '删除', icon: 'trash', danger: true, onClick: deleteSel, disabled: readOnly.value },
      { separator: true },
      { label: '属性', icon: 'info', onClick: () => showProps(f.path) }
    ])
    return
  }

  ctx.show(e.clientX, e.clientY, [
    { label: '打开', icon: 'fwd', onClick: () => openItem(f) },
    { label: '打开方式', icon: 'openwith', children: buildOpenWith(f) },
    { label: '复制路径', icon: 'link', onClick: () => copyPath(f.path) },
    { label: '下载', icon: 'download', onClick: downloadSel },
    ...(canSharePub.value ? [{ label: '分享', icon: 'share', onClick: shareSel }] : []),
    { label: '提取直链', icon: 'link', onClick: dlinkSel },
    { separator: true },
    ...(session.isGuest ? [] : [{ label: starred ? '取消收藏' : '收藏到快速访问', icon: starred ? 'star' : 'starFill', onClick: () => toggleStar(f) }]),
    { label: '剪切', icon: 'cut', onClick: cutSel, disabled: readOnly.value },
    { label: '复制', icon: 'copy', onClick: copySel, disabled: readOnly.value },
    { label: '重命名', icon: 'rename', onClick: renameSel, disabled: readOnly.value },
    { separator: true },
    ...(f.ext?.toLowerCase() === 'zip' || /\.(tar|tgz|tbz2|gz)$/i.test(f.name || '')
      ? (group.value.allowArchive ? [{ label: '解压到当前目录', icon: 'archive', onClick: extractSel, disabled: readOnly.value }] : [])
      : []),
    // 「压缩」功能被组禁用时整体隐藏（不再显示禁用态）
    ...(group.value.allowArchive ? [{ label: '压缩打包', icon: 'archive', onClick: archiveSel, disabled: readOnly.value }] : []),
    { label: '删除', icon: 'trash', danger: true, onClick: deleteSel, disabled: readOnly.value },
    { separator: true },
    { label: '属性', icon: 'info', onClick: () => showProps(f.path) }
  ])
}

// 解压到当前目录（zip 右键）
async function extractSel() {
  if (!currentPolicy.value || selPaths.value.length !== 1) return
  try {
    await fsApi.archive(currentPolicy.value.id, selPaths.value, '', true)
    toast.success('解压任务已开始，完成后会通知你')
    load()
  } catch (e: any) { toast.error(e.message) }
}
// 粘贴到某个文件夹内部（Windows 文件夹右键"粘贴"）
function pasteInto(f: FileItem) {
  return async () => {
    if (!currentPolicy.value || !clip.mode) return
    const same = clip.items.every(i => i.policyId === currentPolicy.value!.id)
    try {
      if (same) {
        if (clip.mode === 'cut') {
          // 与剪切粘贴同款冲突处理：同名文件询问替换、同名目录跳过
          const all = clip.items.map(i => i.path)
          const srcs = all.filter(s => s !== f.path && !f.path.startsWith(s + '/'))
          if (!srcs.length) { toast.error('不能粘贴到其自身内部'); return }
          if (srcs.length < all.length) toast.error('部分项不能粘贴到其自身内部，已跳过')
          const dl = await fsApi.list(currentPolicy.value.id, f.path)
          const r = await resolveMoveConflicts(srcs, dl.items as any, f.path)
          if (!r || !r.paths.length) return
          await fsApi.move(currentPolicy.value.id, r.paths, f.path, r.overwrite)
        } else await fsApi.copy(currentPolicy.value.id, clip.items.map(i => i.path), f.path)
        clip.clear()
      } else {
        const items = clip.items.map(i => ({ policyId: i.policyId, path: i.path }))
        if (clip.mode === 'cut') await fsApi.crossMove(currentPolicy.value.id, f.path, items)
        else await fsApi.crossCopy(currentPolicy.value.id, f.path, items)
      }
      load()
    } catch (e: any) { toast.error(e.message) }
  }
}
function onPolicyCtx(p: Policy, e: MouseEvent) {
  const menu: any[] = [
    { label: '打开', icon: 'fwd', onClick: () => openPolicy(p) },
    // 整盘共享：把该磁盘根目录（含全部子目录）共享给指定用户/组/所有人
    ...(canShareUser.value ? [
      { label: '共享整个磁盘…', icon: 'share', onClick: () => sharePolicyRoot(p) }
    ] : []),
    ...(canTerminal.value ? [
      {
        label: '在终端中打开', icon: 'terminal',
        onClick: () => store.open('terminal', { policyId: p.id, path: '/' }, { title: '终端' })
      }
    ] : [])
  ]
  if (session.user?.role === 'admin') {
    menu.push({ separator: true })
    menu.push({ label: '管理存储', icon: 'admin', onClick: () => store.open('admin') })
  }
  ctx.show(e.clientX, e.clientY, menu)
}
async function toggleStar(f: FileItem) {
  if (!currentPolicy.value) return
  if (f.starred) await fsApi.starRemove(currentPolicy.value.id, f.path)
  else await fsApi.starAdd(currentPolicy.value.id, f.path, f.name)
  load(); loadStars()
}

// ---- 工具 ----
function joinPath(a: string, b: string) { return (a === '/' ? '' : a) + '/' + b }
function baseName(p: string) { return p.slice(p.lastIndexOf('/') + 1) }
// 使用率：按后端按角色算好的 totalBytes（管理员=分区大小，普通用户=本人配额）。
// 总容量未知/不限量时返回 -1，进度条中性显示、不报红（修复旧版硬编码 10GB 导致大盘误红）。
function usagePct(p: Policy) {
  if (!p.totalBytes || p.totalBytes <= 0) return -1
  return Math.min(100, Math.round((p.usageBytes / p.totalBytes) * 100))
}
// 盘卡片副标题：已用 / 总容量（剩余可悬停查看）
function driveBarStyle(p: Policy) {
  const pct = usagePct(p)
  return { width: (pct < 0 ? 3 : Math.max(3, pct)) + '%' }
}
function driveSub(p: Policy) {
  if (!p.totalBytes || p.totalBytes <= 0) return fmt(p.usageBytes) + ' 已用'
  return `${fmt(p.usageBytes)} / ${fmt(p.totalBytes)} 已用`
}
function driveRemain(p: Policy) {
  if (!p.totalBytes || p.totalBytes <= 0) return ''
  return `剩余 ${fmt(Math.max(0, p.totalBytes - p.usageBytes))}`
}
// 注意：JS 位运算为 32 位，1<<40 会回绕成 256 —— TB 常量必须用 Math.pow
const TB = Math.pow(2, 40)
function fmt(n: number) {
  if (n > TB) return (n / TB).toFixed(2) + ' TB'
  if (n >= 1 << 30) return (n / (1 << 30)).toFixed(2) + ' GB'
  if (n > 1 << 20) return (n / (1 << 20)).toFixed(1) + ' MB'
  if (n > 1024) return (n / (1 << 10)).toFixed(1) + ' KB'
  return n + ' B'
}
const fmtSize = fmt
function fmtTime(ms: number) {
  const d = new Date(ms)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${d.toTimeString().slice(0, 5)}`
}
</script>

<style scoped>
/* 多标签 */
.exp-tabs {
  display: flex; align-items: flex-end; gap: 4px; padding: 6px 10px 0;
  border-bottom: 1px solid var(--stroke-b); overflow-x: auto; flex: none;
}
.exp-tab {
  display: flex; align-items: center; gap: 6px; padding: 5px 8px; min-width: 100px; max-width: 180px;
  border-radius: 8px 8px 0 0; font-size: 12px; color: var(--text-2); cursor: pointer;
  border: 1px solid transparent; border-bottom: none; flex: none;
}
.exp-tab:hover { background: var(--hover-b); }
.exp-tab.active { background: var(--card); color: var(--text); border-color: var(--stroke-b); }
.exp-tab .t-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.exp-tab .t-close {
  width: 16px; height: 16px; border-radius: 4px; display: flex; align-items: center;
  justify-content: center; opacity: 0.45; flex: none;
}
.exp-tab .t-close:hover { background: var(--hover-b); opacity: 1; color: var(--danger); }
.exp-tab-add {
  width: 26px; height: 26px; border-radius: 6px; display: flex; align-items: center;
  justify-content: center; cursor: pointer; color: var(--text-3); flex: none;
}
.exp-tab-add:hover { background: var(--hover-b); color: var(--text); }

/* 游客临时空间提示条 */
.guest-ttl-bar {
  display: flex; align-items: center; gap: 6px; padding: 4px 12px; flex: none;
  font-size: 12px; color: var(--text-2);
  background: var(--hover-b); border-bottom: 1px solid var(--stroke-b);
}
.guest-ttl-bar :deep(svg) { color: var(--accent, var(--text-2)); flex: none; }

.side-title { font-size: 11.5px; color: var(--text-3); padding: 8px 10px 4px; }
.side-item {
  display: flex; align-items: center; gap: 9px; padding: 6px 10px; border-radius: 5px;
  font-size: 13px; cursor: pointer; color: var(--text-2);
}
.side-item:hover { background: var(--hover-b); color: var(--text); }
.side-item.active { background: #3b91d825; color: var(--text); }
.side-item span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sel-rect { position: absolute; border: 1px solid var(--theme-2); background: #3b91d825; z-index: 100; }
.rubber-band {
  position: absolute; border: 1px solid var(--theme-2);
  background: rgba(59,145,216,0.14); border-radius: 2px; z-index: 60; pointer-events: none;
}
.g-badge {
  position: absolute; top: 6px; left: 8px; z-index: 2;
  background: linear-gradient(135deg, var(--theme-1), var(--theme-2));
  color: #fff; font-size: 10px; padding: 1px 6px; border-radius: 8px;
}
/* 实时协作「正在编辑」徽章（绿点 + 悬停提示协作者名单） */
.editing-dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  background: #4caf50; box-shadow: 0 0 5px rgba(76, 175, 80, 0.85);
  vertical-align: middle;
}
.f-name .editing-dot { margin-right: 5px; }
.editing-badge {
  display: inline-flex; align-items: center; gap: 5px; flex: none;
  font-size: 11px; color: #4caf50;
}
/* Win11 叠加复选框：悬停或选中时显示 */
.f-check {
  position: absolute; top: 6px; right: 8px; z-index: 3; width: 17px; height: 17px;
  margin: 0; cursor: pointer; opacity: 0; transition: opacity 0.1s; accent-color: var(--theme-2);
}
.file-item:hover .f-check, .file-item.selected .f-check { opacity: 1; }
.file-list td input[type="checkbox"], .file-list th input[type="checkbox"] { width: 15px; height: 15px; margin: 0; accent-color: var(--theme-2); cursor: pointer; }
.tool-btn.global-on { color: var(--theme-2); background: #3b91d820; }
.od-sep { height: 1px; background: var(--stroke-b); margin: 14px -6px 10px; }
.od-list { max-height: 220px; overflow: auto; }
.od-item { padding: 7px 2px; border-bottom: 1px solid var(--hover-b); }
.od-item:last-child { border-bottom: none; }
.od-name { font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; user-select: text; }
.od-status { font-size: 12px; color: var(--text-3); flex: none; }
.file-list thead th { user-select: none; white-space: nowrap; }
.file-list thead th:hover { color: var(--text); background: var(--hover-b); }
.file-list thead th.sort-active { color: var(--theme-2); }
.sort-arrow { font-size: 10px; }
.f-thumb { width: 52px; height: 52px; object-fit: cover; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
.preview-pane { width: 244px; flex: none; border-left: 1px solid var(--stroke); padding: 14px; overflow: auto; background: var(--card); }
.pp-head { font-size: 12px; color: var(--text-3); margin-bottom: 10px; }
.pp-thumb { height: 132px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; background: var(--bg50); border-radius: 8px; overflow: hidden; }
.pp-img { max-width: 100%; max-height: 100%; object-fit: contain; }
.pp-name { font-size: 14px; font-weight: 600; word-break: break-all; margin-bottom: 12px; line-height: 1.4; }
.pp-row { display: flex; justify-content: space-between; gap: 8px; font-size: 12.5px; padding: 5px 0; border-bottom: 1px solid var(--bg50); color: var(--text-3); }
.pp-row b { color: var(--text); font-weight: 500; text-align: right; word-break: break-all; }
.pp-actions { display: flex; gap: 8px; margin-top: 10px; }
.pp-actions .btn { flex: 1; padding: 6px 0; }

/* 此电脑：驱动器卡片（Win11 资源管理器标准样式） */
.sec-title { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 10px; }
.drive-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px; max-width: 820px; }
.drive-card {
  display: flex; gap: 14px; align-items: center; padding: 16px 18px;
  border-radius: var(--radius-sm); border: 1px solid var(--stroke-b); cursor: default;
  background: var(--card); transition: background 0.12s, border-color 0.12s, transform 0.12s;
}
.drive-card:hover { background: var(--hover-b); transform: translateY(-1px); }
.drive-card.sel { background: #3b91d822; border-color: #3b91d855; }
.drive-name {
  font-size: 13.5px; font-weight: 600; color: var(--text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.drive-bar { height: 6px; border-radius: 3px; background: rgba(125,125,135,0.28); margin: 9px 0 6px; overflow: hidden; }
.dark .drive-bar { background: rgba(255,255,255,0.14); }
.drive-bar-fill {
  height: 100%; border-radius: 3px;
  background: linear-gradient(90deg, var(--theme-1), var(--theme-2));
  transition: width 0.3s;
}
.drive-bar-fill.full { background: #e74c3c; }
.drive-sub { font-size: 11px; color: var(--text-3); }
</style>
/* ZTESTMARKERQWX 9f3a */
