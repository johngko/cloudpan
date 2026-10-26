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
      <div class="seg">
        <button class="tool-btn" :disabled="!canBack" @click="back" title="后退"><AppIcon name="back" :size="16" /></button>
        <button class="tool-btn" :disabled="!fwdStack.length" @click="fwd" title="前进"><AppIcon name="fwd" :size="16" /></button>
        <button class="tool-btn" :disabled="!currentPolicy || path === '/'" @click="goUp" title="上级"><AppIcon name="up" :size="16" /></button>
        <button class="tool-btn" @click="refresh" title="刷新"><AppIcon name="refresh" :size="16" /></button>
      </div>
      <div class="crumb" style="flex: 1; margin: 0 8px">
        <span v-if="aggView">{{ aggView.label }}</span>
        <span v-else-if="!currentPolicy">此电脑</span>
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
        <button v-if="globalMode" class="tool-btn" :class="{ 'global-on': contentMode }" :title="contentMode ? '当前：搜文件内容（本地盘文本文件，懒索引）' : '当前：搜文件名（点击切到内容检索）'"
          @click="toggleContent">
          <AppIcon :name="contentMode ? 'txt' : 'search'" :size="15" />
        </button>
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="app-toolbar" style="padding: 4px 10px">
      <button class="tool-btn m-nav" title="侧栏" @click.stop="navOpen = !navOpen"><AppIcon name="list" :size="15" /></button>
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
      <button class="tool-btn m-hide" :class="{ 'global-on': previewMode }" title="预览窗格（Alt+P）" @click="togglePreview">
        <AppIcon name="preview" :size="15" />
      </button>
      <button class="tool-btn" @click="viewMode = viewMode === 'grid' ? 'list' : 'grid'">
        <AppIcon :name="viewMode === 'grid' ? 'list' : 'grid'" :size="15" />
      </button>
    </div>

    <div style="flex: 1; position: relative; display: flex; overflow: hidden">
      <!-- 侧栏 -->
      <div class="exp-side" :class="{ 'm-open': navOpen }" @click="navOpen = false">
        <div class="side-title">快速访问</div>
        <div v-for="s in stars" :key="s.id" class="side-item" :title="s.name"
          @click="clickStar(s)">
          <AppIcon :name="s.isDir === false ? iconOfName(s.name) : 'folder'" :size="15" /><span>{{ s.name }}</span>
        </div>
        <div v-if="!stars.length" class="side-item" style="color: var(--text-3)">收藏的文件夹/文件会显示在这里</div>
        <div class="side-title" style="margin-top: 10px">标签</div>
        <div v-for="t in tags" :key="'tg' + t.id" class="side-item"
          :class="{ active: aggView && aggView.kind === 'tag' && aggView.id === t.id }" :title="t.name"
          @click="openAggView('tag', t.id, '标签: ' + t.name)">
          <span class="tag-dot" :style="{ background: t.color }"></span><span style="flex: 1">{{ t.name }}</span>
          <span style="font-size: 10.5px; color: var(--text-3)">{{ t.count }}</span>
        </div>
        <div v-if="!tags.length" class="side-item" style="color: var(--text-3)">文件右键「标签」可打标签</div>
        <div class="side-item" style="margin-top: 4px" :class="{ active: aggView && aggView.kind === 'recent' }"
          @click="openAggView('recent', 0, '最近使用')">
          <AppIcon name="clock" :size="15" /><span>最近使用</span>
        </div>
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
            @dblclick="openSharedDrive" @pointerup="onSharedTap($event)">
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
              @click="selectedDrive = p.id" @dblclick="openPolicy(p)" @pointerup="onDriveTap(p, $event)"
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
              @click="selectedDrive = p.id" @dblclick="openPolicy(p)" @pointerup="onDriveTap(p, $event)"
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
        <div v-if="viewMode === 'grid'" class="file-grid" :class="{ virtual: virtualGrid }" ref="gridEl" @scroll.passive="onViewScroll">
          <div v-if="virtualGrid && gridPadTop" class="vt-pad" :style="{ height: gridPadTop + 'px' }"></div>
          <FileGrid :items="gridItems" :sel-set="selSet" :editing="editing"
            :icon-of="iconOf" :is-thumb="isThumb" :thumb-url="thumbUrl" :name-parts="nameParts"
            :tag-color="tagColor" :tag-name="tagName"
            @item-down="onItemDown" @item-open="onItemOpen" @item-ctx="onItemCtx"
            @item-drag="onItemDrag" @item-drop="onDropTo" @check-toggle="toggleCheck" @item-up="onItemUp" />
          <div v-if="virtualGrid && gridPadBottom" class="vt-pad" :style="{ height: gridPadBottom + 'px' }"></div>
        </div>
        <div v-else class="file-list" :class="{ virtual: virtualList }" ref="listEl" @scroll.passive="onViewScroll">
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
              <!-- 窗口化：上占位行（高度=被折叠掉的行，撑住滚动条总高） -->
              <tr v-if="virtualList && listWin.padTop" class="vpad" :style="{ height: listWin.padTop + 'px' }"><td :colspan="5"></td></tr>
              <FileList :items="listItems" :sel-set="selSet" :editing="editing"
                :icon-of="iconOf" :name-parts="nameParts" :fmt="fmt" :fmt-time="fmtTime"
                :tag-color="tagColor" :tag-name="tagName"
                @item-down="onItemDown" @item-open="onItemOpen" @item-ctx="onItemCtx"
                @item-drag="onItemDrag" @item-drop="onDropTo" @check-toggle="toggleCheck" @item-up="onItemUp" />
              <!-- 窗口化：下占位行 -->
              <tr v-if="virtualList && listWin.padBottom" class="vpad" :style="{ height: listWin.padBottom + 'px' }"><td :colspan="5"></td></tr>
            </tbody>
          </table>
        </div>
        <!-- 搜索中骨架：盖在列表上，避免旧结果滞留造成「没反应」的错觉 -->
        <div v-if="searchSkel" class="search-skel" aria-hidden="true">
          <div v-for="i in 7" :key="i" class="skel-row">
            <span class="skel-ico"></span>
            <span class="skel-bar" :style="{ width: (38 + (i * 9) % 46) + '%' }"></span>
          </div>
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
        <div class="pp-tags" v-if="!onSharedDrive && !session.isGuest">
          <span v-for="tid in selItem.tags || []" :key="tid" class="pp-tag"
            :style="{ color: tagColor(tid), borderColor: tagColor(tid) }">{{ tagName(tid) }}</span>
          <button class="pp-tag add" @click="openTagMenuForSel($event)">＋ 标签</button>
        </div>
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
      <span class="sb-path">{{ currentPolicy ? (onSharedDrive ? sharedStatusPath : currentPolicy.name + path) : '此电脑' }}</span>
      <span v-if="currentPolicy" class="sb-pill">{{ items.length }} 个项目</span>
      <span v-if="selPaths.length" class="sb-pill on">已选中 {{ selPaths.length }} 项</span>
      <span style="flex: 1"></span>
      <span v-if="clip.mode" class="sb-pill">{{ clip.mode === 'cut' ? '已剪切' : '已复制' }} {{ clip.items.length }} 项</span>
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
        <div class="row" v-if="shareTarget && (shareTarget as any).isDir">
          <label style="display: flex; align-items: center; gap: 6px">
            <input type="checkbox" v-model="shareCollect" :disabled="shareEnc" />文件收集模式（只进不出：访客只能上传，看不到目录内已有文件）
          </label>
        </div>
        <div class="row" style="display: flex; gap: 18px">
          <label style="display: flex; align-items: center; gap: 6px"><input type="checkbox" v-model="shareAllowDl" :disabled="shareCollect" />允许下载</label>
          <label style="display: flex; align-items: center; gap: 6px"><input type="checkbox" v-model="sharePreview" :disabled="shareCollect" />允许预览</label>
          <label style="display: flex; align-items: center; gap: 6px"><input type="checkbox" v-model="shareEdit" :disabled="shareEnc || shareCollect" />允许在线编辑</label>
        </div>
        <div class="row">
          <label style="display: flex; align-items: center; gap: 6px">
            <input type="checkbox" v-model="shareEnc" :disabled="encBusy || shareCollect" />端到端加密（E2E）
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
        <div v-if="shareLink" class="row" style="background: var(--accent-weak); border-radius: 6px; padding: 10px; font-size: 12.5px; word-break: break-all; user-select: text; cursor: text" title="点选后可手动复制">
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
        <div v-if="dlUrl" class="row" style="background: var(--accent-weak); border-radius: 6px; padding: 10px; font-size: 12px; word-break: break-all; user-select: text">
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
                <span class="od-status" :style="t.status === 'error' ? 'color: var(--danger)' : t.status === 'finished' ? 'color: var(--success)' : ''">
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
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useWindows } from '../stores/windows'
import { useSession } from '../stores/session'
import { useAppState } from '../stores/appstate'
import { canUseOffline } from '../stores/apps'
import { useClipboard } from '../stores/ui'
import { useTransfer } from '../stores/transfer'
import { fsApi, shareApi, officeApi, type Policy, type FileItem } from '../api/modules'
import { rawUrl, downloadUrl } from '../api/modules'
import { get as aget, post as apost } from '../api/http'
import { useContextMenu } from '../stores/ui'
import { useUiDialog, useToast } from '../stores/dialog'
import { userShareApi } from '../api/modules'
import { collectDropFiles } from '../utils/drop'
import { createEncryptedShare } from '../utils/shareEncrypt'
import { copyText } from '../utils/clipboard'
import { withViewTransition, vtNavigate } from '../utils/viewTransition'
import { sortEntries, nextSort } from './explorer/sortEntries'
import type { TaskItem } from '../api/modules'
import { uniqueName, batchRename } from './explorer/fileNames'
import { joinPath, sharedPathParse } from './explorer/paths'
import { fileIcon } from './explorer/fileIcons'
import { ARCHIVE_EXTS, IMG_EXTS } from './explorer/exts'
import { newTab, activeIdxAfterClose, recordHistory, backTarget, fwdTarget, parentPath, type ExplorerTab } from './explorer/tabs'
import { nextSelection, toggleInSet, isAllSelected } from './explorer/selection'
import { computeWindow, VIRTUAL_THRESHOLD } from './explorer/virtualWindow'
import { splitHighlight } from './explorer/highlight'
import { newEntries, blankMenu, itemMenu, policyMenu } from './explorer/menus'
import FileGrid from './explorer/FileGrid.vue'
import FileList from './explorer/FileList.vue'
import AppIcon from '../components/AppIcon.vue'
import { isMobileLayout, isTouchLayout } from '../utils/mobile'

const props = defineProps<{ winId: number; props: any }>()
const store = useWindows()
const session = useSession()
const apps = useAppState()
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
// 手机布局下的侧栏抽屉开合（桌面端该状态不生效）
const navOpen = ref(false)
const selectedDrive = ref(0)

// ---- 多标签（每个标签页保存：盘符路径/搜索/视图/前进后退历史）----
// 结构定义与历史语义的纯逻辑见 ./explorer/tabs
type Tab = ExplorerTab
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
// 内容检索模式（仅全局搜索时可用；随标签页持久化）
const contentMode = computed<boolean>({
  get: () => (activeTab.value?.globalMode ?? false) && !!activeTab.value?.contentMode,
  set: v => { if (activeTab.value) activeTab.value.contentMode = v }
})
const viewMode = computed<'grid' | 'list'>({
  get: () => activeTab.value?.viewMode ?? 'grid',
  // 网格/列表切换走 View Transition：同一批条目两种排布做一次交叉淡化（B15）
  set: v => { withViewTransition(() => { if (activeTab.value) activeTab.value.viewMode = v }) }
})
const history = computed<string[]>(() => activeTab.value?.history ?? [])
const fwdStack = computed<string[]>(() => activeTab.value?.fwdStack ?? [])

function addTab(policyId: number | null = null, p = '/') {
  tabs.value.push(newTab(policyId, p))
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
  const next = activeIdxAfterClose(tabs.value.length, i, activeIdx.value)
  if (next === null) { store.close(props.winId); return }
  activeIdx.value = next
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
  const next = nextSort({ mode: sortMode.value, dir: sortDir.value }, m)
  sortMode.value = next.mode
  sortDir.value = next.dir
}
// 排序纯逻辑见 ./explorer/sortEntries（文件夹恒在前，方向只作用于同类型内部）
const sortedItems = computed(() => sortEntries(items.value, sortMode.value, sortDir.value))

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
  loadTags()
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
      contentMode: !!t.contentMode,
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
  window.addEventListener('cp-refresh-shared', onRefreshShared)
  window.addEventListener('keydown', onKey)
  startEditPoll()
  bindVirtual()
})
onBeforeUnmount(() => {
  window.removeEventListener('cp-refresh-explorer', onRefreshEvent)
  window.removeEventListener('cp-refresh-shared', onRefreshShared)
  window.removeEventListener('keydown', onKey)
  cancelLongPress()
  if (editTimer) window.clearInterval(editTimer)
  if (editScrollTimer) clearTimeout(editScrollTimer)
  if (skelTimer) clearTimeout(skelTimer)
  if (vwRO) vwRO.disconnect()
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

// 共享盘上传完成（上传泵派发）：只刷新对应共享的视图，避免误刷自己盘的目录
function onRefreshShared(e: any) {
  const sid = e.detail?.shareId
  if (!sid || sid !== sharedCtx.value?.shareId) return
  load()
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
  // Ctrl+Shift+N 新建文件夹（Windows 习惯）
  if (ctrl && e.shiftKey && (k === 'n' || k === 'N')) { e.preventDefault(); newItem('folder'); return }
  if (e.altKey && (k === 'p' || k === 'P')) { e.preventDefault(); togglePreview(); return }
  // Alt+Enter 属性（须排在下面的 Enter 之前：Alt+Enter 的 key 也是 Enter）
  if (e.altKey && k === 'Enter' && selPaths.value.length === 1) { e.preventDefault(); showProps(selPaths.value[0]); return }
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
// 侧栏收藏点击：目录直接进入；文件进入所在目录并自动选中（load() 内消费 pendingSelect）
function clickStar(s: { policyId: number; path: string; name: string; isDir: boolean }) {
  if (s.isDir === false) {
    pendingSelect.value = s.path
    openPolicyId(s.policyId, s.path.slice(0, s.path.lastIndexOf('/') || 1) || '/')
  } else {
    openPolicyId(s.policyId, s.path)
  }
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
// 历史/前进栈都挂在当前标签内（纯逻辑见 ./explorer/tabs）
function pushHistory(p: string) {
  const t = activeTab.value
  if (t) recordHistory(t.history, t.fwdStack, p)
}
function back() {
  const t = activeTab.value
  if (!t) return
  const cur = backTarget(t.history, path.value)
  if (cur === null) return
  t.fwdStack.push(path.value)
  path.value = cur
  navDir = 'back'
  load()
}
function fwd() {
  const t = activeTab.value
  if (!t) return
  const next = fwdTarget(t.fwdStack)
  if (next === null) return
  t.history.push(path.value)
  path.value = next
  navDir = 'fwd'
  load()
}
function goUp() {
  if (path.value === '/') return
  goto(parentPath(path.value))
}
function goto(p: string) {
  if (!currentPolicy.value) return
  pushHistory(p)
  path.value = p
  navDir = 'fwd'
  load()
}

// 本次 load 结果用哪个方向的 View Transition（back=从左滑回，fwd=向右滑入/钻入）
let navDir: 'back' | 'fwd' | null = null

async function load() {
  if (!currentPolicy.value) return
  aggView.value = null // 任何目录导航都退出聚合视图
  loading.value = true
  searching.value = false
  selSet.value = new Set()
  try {
    if (currentPolicy.value.id === SHARED_POLICY) {
      await loadShared()
      return
    }
    const d = await fsApi.list(currentPolicy.value.id, path.value)
    const dir = navDir; navDir = null
    vtNavigate(() => { items.value = d.items }, dir)
    // 侧栏「文件收藏」跳转：进入所在目录后自动选中该文件（预览面板即时可见）
    if (pendingSelect.value) {
      const want = pendingSelect.value
      pendingSelect.value = ''
      if (d.items.some(x => x.path === want)) selSet.value = new Set([want])
    }
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
  if (aggView.value) { const v = aggView.value; openAggView(v.kind, v.id, v.label); loadTags(); return }
  if (globalMode.value && keyword.value) { doSearch(); return }
  if (keyword.value) doSearch()
  else load()
  loadStars()
  loadTags()
}

// 当前列表是否来自搜索结果（用于清空关键词时恢复目录列表）
const searching = ref(false)

// ---- 标签体系 + 最近使用（跨盘聚合的「虚拟文件夹」）----
// 列表接口的目录装饰已带每条路径的 tags（见 fs.go List），条目/预览直接用；
// 聚合视图（标签视图/最近视图）把对象映射成 FileItem 混排展示，打开走条目自身 policyId（同全局搜索语义）。
const TAG_PALETTE = ['#3b91d8', '#5db56a', '#e8964a', '#e05d5d', '#e2c04b', '#8a6fd8', '#d86fa8', '#7f8c99']
const tags = ref<{ id: number; name: string; color: string; count: number }[]>([])
const aggView = ref<null | { kind: 'tag' | 'recent'; id: number; label: string }>(null)
const pendingSelect = ref('') // 侧栏点文件收藏：跳目录后待选中路径

async function loadTags() {
  try { tags.value = await fsApi.tagList() } catch { tags.value = [] }
}
function tagColor(id: number) { return tags.value.find(t => t.id === id)?.color || '#8a93a0' }
function tagName(id: number) { return tags.value.find(t => t.id === id)?.name || '' }
function iconOfName(name: string) {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : ''
  return fileIcon({ ext, isDir: false } as any, session.osTheme)
}
function aggToItem(o: { policyId: number; path: string; name: string; isDir: boolean }, ts: number): FileItem {
  const ext = o.isDir ? '' : (o.name.includes('.') ? o.name.slice(o.name.lastIndexOf('.') + 1).toLowerCase() : '')
  return { name: o.name, path: o.path, isDir: o.isDir, size: 0, modTime: ts, ext, policyId: o.policyId, letter: '' } as unknown as FileItem
}
async function openAggView(kind: 'tag' | 'recent', id: number, label: string) {
  aggView.value = { kind, id, label }
  loading.value = true
  searching.value = false
  keyword.value = ''
  selSet.value = new Set()
  try {
    if (kind === 'tag') {
      const objs = await fsApi.tagObjects(id)
      items.value = objs.map(o => aggToItem(o, new Date(o.createdAt).getTime() || Date.now()))
    } else {
      const objs = await fsApi.recentList()
      items.value = objs.map(o => aggToItem(o, new Date(o.openedAt).getTime() || Date.now()))
    }
    store.setTitle(props.winId, label)
  } catch { items.value = [] } finally { loading.value = false }
}

/** 整组替换语义：在当前标签集上切换一个标签后提交（条目来自列表装饰时 tags 已就位） */
async function toggleTagFor(f: FileItem, tagId: number) {
  if (onSharedDrive.value || session.isGuest) return
  const pid = (f as any).policyId || currentPolicy.value?.id
  if (!pid) return
  const cur = new Set<number>(f.tags || [])
  if (cur.has(tagId)) cur.delete(tagId)
  else cur.add(tagId)
  try {
    await fsApi.tagSet(pid, f.path, f.name, f.isDir, [...cur])
    f.tags = [...cur]
    loadTags()
  } catch (e: any) { toast.error(e.message) }
}
/** 多选批量：以第一个选中项的标签状态决定 增/删，作用到全部选中项 */
async function toggleTagForSelection(tagId: number) {
  const targets = items.value.filter(i => selSet.value.has(i.path))
  if (!targets.length) return
  const has = new Set(targets[0].tags || []).has(tagId)
  for (const f of targets) {
    const cur = new Set<number>(f.tags || [])
    if (has) cur.delete(tagId)
    else if (cur.size < 10) cur.add(tagId)
    const pid = (f as any).policyId || currentPolicy.value?.id
    if (!pid) continue
    try {
      await fsApi.tagSet(pid, f.path, f.name, f.isDir, [...cur])
      f.tags = [...cur]
    } catch { /* 单项失败不阻断批量 */ }
  }
  loadTags()
}
/** 新建标签（名称 prompt + 调色板轮转色）并立即应用到目标条目 */
async function createTagAndApply(target: FileItem | null) {
  const name = await uiDlg.prompt('新建标签', '', '创建')
  if (!name || !name.trim()) return
  const color = TAG_PALETTE[tags.value.length % TAG_PALETTE.length]
  try {
    const t = await fsApi.tagCreate(name.trim(), color)
    await loadTags()
    if (target && selPaths.value.length > 1) await toggleTagForSelection(t.id)
    else if (target) await toggleTagFor(target, t.id)
  } catch (e: any) { toast.error(e.message) }
}
/** 标签子菜单（右键菜单与预览面板「＋ 标签」共用；checked = 当前条目已有该标签） */
function buildTagMenu(f: FileItem | null): any[] {
  if (!f || onSharedDrive.value || session.isGuest) return []
  const cur = new Set<number>(f.tags || [])
  const multi = selPaths.value.length > 1
  const items2: any[] = tags.value.map(t => ({
    label: t.name,
    checked: multi ? cur.has(t.id) : cur.has(t.id),
    onClick: () => multi ? toggleTagForSelection(t.id) : toggleTagFor(f, t.id)
  }))
  if (items2.length) {
    items2.push({ separator: true })
    items2.push({ label: '清除本条标签', onClick: () => multi ? clearTagsSelection() : toggleTagClear(f) })
  }
  items2.push({ label: '新建标签…', icon: 'plus', onClick: () => createTagAndApply(f) })
  return items2
}
async function toggleTagClear(f: FileItem) {
  if (!(f.tags || []).length) return
  const pid = (f as any).policyId || currentPolicy.value?.id
  if (!pid) return
  try { await fsApi.tagSet(pid, f.path, f.name, f.isDir, []); f.tags = []; loadTags() } catch (e: any) { toast.error(e.message) }
}
async function clearTagsSelection() {
  for (const f of items.value.filter(i => selSet.value.has(i.path))) await toggleTagClear(f)
}
/** 预览面板「＋ 标签」：在按钮处弹同一份标签菜单 */
function openTagMenuForSel(e: MouseEvent) {
  if (!selItem.value) return
  ctx.show(e.clientX, e.clientY, buildTagMenu(selItem.value))
}

// ---- PDF 工具箱（pdfcpu 云端处理；见 apps/PdfBox.vue） ----
function pdfTargetPolicy(f: FileItem): number | undefined {
  return (f as any).policyId || currentPolicy.value?.id
}
async function pdfInfoFor(f: FileItem) {
  const pid = pdfTargetPolicy(f)
  if (!pid) return
  try {
    const r = await fsApi.pdfInfo(pid, f.path)
    uiDlg.alert('PDF 信息', `${f.name}：共 ${r.pages} 页`)
  } catch (e: any) { toast.error(e.message || 'PDF 解析失败') }
}
function openPdfBox(files: FileItem[]) {
  const pid = pdfTargetPolicy(files[0])
  if (!pid) return
  store.open('pdfbox', { policyId: pid, paths: files.map(x => x.path) },
    { title: files.length === 1 ? `PDF 工具箱 - ${files[0].name}` : `PDF 合并（${files.length} 个）`, icon: 'pdfreader' })
}
function buildPdfMenu(f: FileItem): any[] {
  return [
    { label: '页数信息', onClick: () => pdfInfoFor(f) },
    { label: '工具箱（拆分…）', onClick: () => openPdfBox([f]) }
  ]
}
/** 多选菜单项：选中里 ≥2 个 PDF 才出现 */
function buildPdfMergeMenu(): any | null {
  if (selPaths.value.length < 2) return null
  const pdfs = items.value.filter(i => selSet.value.has(i.path) && i.ext === 'pdf')
  if (pdfs.length < 2) return null
  return { label: `合并为 PDF（${pdfs.length} 份）`, icon: 'pdfreader', onClick: () => openPdfBox(pdfs) }
}

// 搜索命中高亮：切分逻辑在 ./explorer/highlight（纯逻辑 + 单测）。
// 非搜索态直接返回整段（同一个 <template> 渲染，不会多出 DOM），
// 所以「搜索态高亮」对普通浏览零影响。
function nameParts(name: string) {
  return searching.value ? splitHighlight(name, keyword.value) : [{ t: name, hit: false }]
}

// 搜索中骨架：延迟 150ms 才显示 —— 本地搜索常常几十毫秒就回来了，
// 立刻显示会一闪而过，比没有更糟
const searchSkel = ref(false)
let skelTimer: ReturnType<typeof setTimeout> | undefined
watch([loading, searching], () => {
  clearTimeout(skelTimer)
  if (loading.value && searching.value) skelTimer = setTimeout(() => { searchSkel.value = true }, 150)
  else searchSkel.value = false
}, { immediate: true })

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
    if (globalMode.value && contentMode.value) {
      // 内容全文检索（懒索引，仅本地盘文本文件）：返回包装体带 partial/note
      const r = await fsApi.searchContent(keyword.value)
      if (seq !== searchSeq) return
      if (r.partial && r.note) toast.show(r.note)
      items.value = r.items.map((h: any) => ({
        name: h.name, isDir: h.isDir, size: h.size, modTime: h.modTime, ext: h.ext,
        path: h.path, policyId: h.policyId, letter: h.letter, policyName: h.policyName,
        snippet: h.snippet
      }))
    } else if (globalMode.value) {
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

function toggleContent() {
  if (!globalMode.value) globalMode.value = true
  if (activeTab.value) activeTab.value.contentMode = !activeTab.value.contentMode
  doSearch()
}

// ---- 选择 ----
// 选择语义纯逻辑见 ./explorer/selection（右键保持整组 / Ctrl 切换 / Shift 区间）
function onItemDown(f: FileItem, e: MouseEvent) {
  const pe = e as PointerEvent
  // 手机布局 + 触屏：换成"点按"语义（鼠标分支原样保留，桌面行为不变）
  //   · 单击未选中项 → 选中
  //   · 再单击已选中项 → 打开（手机上双击既别扭又和缩放手势冲突）
  //   · 长按 500ms → 右键菜单
  if (pe.pointerType && pe.pointerType !== 'mouse' && isMobileLayout()) {
    const onlyThis = selSet.value.size === 1 && selSet.value.has(f.path)
    // 关键：不能在按下时就打开——用户长按"已选中项"想调菜单时会先被打开。
    // 这里只记录意图，真正的"打开"推迟到抬手（见 onItemUp），长按触发后会被取消。
    tapOpenPending = onlyThis
    if (!onlyThis) {
      const nx = nextSelection(selSet.value, sortedItems.value.map(x => x.path), { path: f.path })
      if (nx) selSet.value = nx // 触屏单点路径不会返回 null（无修饰键），这里做防御
    }
    startLongPress(f, pe)
    return
  }
  const next = nextSelection(selSet.value, sortedItems.value.map(x => x.path), {
    path: f.path, button: e.button, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey
  })
  if (next) selSet.value = next
}

// ---- 触屏长按出菜单 ----
// 长按是手机上打开右键菜单的通行做法；位移超过 8px（滚动/拖拽）或抬手都要取消，
// 否则用户滚列表时会莫名弹出菜单。
// 触屏"再点已选中项即打开"的待定意图（抬手时才真正打开）
let tapOpenPending = false
let lpTimer: ReturnType<typeof setTimeout> | undefined
let lpOff: (() => void) | undefined
function cancelLongPress() {
  if (lpTimer) { clearTimeout(lpTimer); lpTimer = undefined }
  if (lpOff) { lpOff(); lpOff = undefined }
}
function startLongPress(f: FileItem, e: PointerEvent) {
  cancelLongPress()
  const sx = e.clientX, sy = e.clientY
  lpTimer = setTimeout(() => {
    lpTimer = undefined
    lpOff?.(); lpOff = undefined
    tapOpenPending = false // 已进入长按：抬手时不要再打开
    // 多选状态下不弹菜单，保住"批量操作整组"的语义
    if (selSet.value.size > 1) return
    showItemMenu(f, sx, sy)
  }, 500)
  const onMove = (ev: PointerEvent) => {
    if (Math.abs(ev.clientX - sx) > 8 || Math.abs(ev.clientY - sy) > 8) cancelLongPress()
  }
  const onUp = () => cancelLongPress()
  document.addEventListener('pointermove', onMove, { passive: true })
  document.addEventListener('pointerup', onUp, { passive: true })
  document.addEventListener('pointercancel', onUp, { passive: true })
  lpOff = () => {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onUp)
    document.removeEventListener('pointercancel', onUp)
  }
}

// 「此电脑」里的驱动器卡片：鼠标保持双击打开；手机布局下触屏单击即打开。
// 不补这一条，手机上打开资源管理器后会停在"此电脑"，点不进去任何盘。
function onDriveTap(p: Policy, e: PointerEvent) {
  if (e.pointerType === 'mouse') return
  if (isMobileLayout()) openPolicy(p)
}
function onSharedTap(e: PointerEvent) {
  if (e.pointerType === 'mouse') return
  if (isMobileLayout()) openSharedDrive()
}

/** 触屏抬手：若本次是"再点已选中项"，此时才打开（长按出菜单的情况已在定时器里取消） */
function onItemUp(f: FileItem, e: MouseEvent) {
  const pe = e as PointerEvent
  if (!(pe.pointerType && pe.pointerType !== 'mouse' && isMobileLayout())) return
  cancelLongPress()
  if (!tapOpenPending) return
  tapOpenPending = false
  openItem(f)
}

/** 触屏双击的"打开"要吞掉：单击已打开过，再来一次会把多开应用开出第二个窗口 */
function onItemOpen(f: FileItem) {
  if (isTouchLayout() && isMobileLayout()) return
  openItem(f)
}

// ---- 复选框多选（Windows 11 资源管理器同款叠加勾选） ----
function toggleCheck(f: FileItem) { selSet.value = toggleInSet(selSet.value, f.path) }
const allSelected = computed(() => isAllSelected(sortedItems.value.map(x => x.path), selSet.value))
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
    // 桌面窗口内嵌打开（配置了 Document Server 时窗口内即完整 ONLYOFFICE 编辑器，
    // 关闭仅关窗不刷新页面；/office 整页仅保留给公开分享链接）
    store.open('officeeditor', {
      shareId: sp.shareId, rel: sp.rel, name: f.name, size: f.size, ext,
      perm: currentShare.value?.perm || 'ro'
    }, { title: f.name + ' - Office', icon: 'office', w: 1240, h: 780 })
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
  fsApi.recentRecord(pid, f.path, f.name, false).catch(() => {}) // 最近使用上报（尽力而为；后端 upsert+裁剪）
  const siblings = sortedItems.value
    .filter((x: any) => !x.isDir)
    .map((x: any) => ({ policyId: (x as any).policyId || pid, path: x.path, name: x.name, size: x.size, ext: (x.ext || '').toLowerCase() }))
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic', 'heif'].includes(ext)) {
    // 默认图片打开统一走 Picasa（图片查看器已下线）；list 供左右翻页
    store.open('picasa', { ...p, list: siblings.filter(x => ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic', 'heif'].includes(x.ext)) }, { title: f.name + ' - Picasa 图片预览', icon: 'image', w: 980, h: 660 })
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
    // 桌面窗口内嵌打开（配置了 Document Server 时窗口内即完整 ONLYOFFICE 编辑器，
    // 关闭仅关窗不刷新页面；/office 整页仅保留给公开分享链接）
    store.open('officeeditor', p, { title: f.name + ' - Office', icon: 'office', w: 1240, h: 780 })
  } else if (TEXT_EXTS.includes(ext) || !ext) {
    store.open('notepad', p, { title: f.name + ' - 记事本', icon: 'notepad', w: 780, h: 560 })
  } else if (['eml', 'mht', 'mhtml'].includes(ext) && apps.isAvailable('eml_viewer')) {
    // EML/MHT：默认走 EML 查看器（此前双击落入下载分支）
    store.open('emlviewer', p, { title: f.name + ' - EML 查看器', icon: 'mail', w: 1000, h: 700 })
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
// 扩展名清单与图标映射共用（见 ./explorer/exts）
// 新建创意文档模板（思维导图/白板/流程图，写入即带最小可编辑骨架）
const MINDMAP_TEMPLATE = JSON.stringify({ root: { data: { text: '中心主题' }, children: [] }, theme: { template: 'avocado', config: {} }, layout: 'logicalStructure', config: {}, view: null }, null, 2)
const WHITEBOARD_TEMPLATE = JSON.stringify({ type: 'excalidraw', version: 2, source: 'cloudpan', elements: [], appState: { viewBackgroundColor: '#ffffff', gridSize: null }, files: {} })
const DRAWIO_TEMPLATE = '<mxfile host="CloudPan" agent="CloudPan" version="24.7.7" type="device">\n  <diagram id="page1" name="第 1 页">\n    <mxGraphModel dx="800" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0">\n      <root>\n        <mxCell id="0"/>\n        <mxCell id="1" parent="0"/>\n      </root>\n    </mxGraphModel>\n  </diagram>\n</mxfile>'

// ---- 实时协作「正在编辑」徽章：30s 批量只读查询 Office 文件的协作状态 ----
// 只读查询不把自己登记为编辑者；编辑者由整页编辑器的 20s 心跳维护（90s 无心跳视为离开）
//
// 降载：以前是「当前目录全部 Office 文件」整批上报，万级目录就是万级条目的 POST。
// 现在只查「当前渲染窗口内 + 选中」的条目 —— 窗口化开启时窗口只有几十项；
// 小目录本就全量渲染，窗口=全量，行为不变。结果按项「合并」而非整体替换：
// 窗口外的条目保留上一次查到的徽章，避免滚动时徽章忽隐忽现。
const editing = ref<Record<string, string>>({}) // path -> "张三、李四"
let editTimer: number | undefined
const EDIT_EXTS = OFFICE_EXTS.filter(x => x !== 'pdf') // pdf 不进 DS 协作

/** 本轮要查的路径集合：当前渲染窗口（未窗口化时=全量）+ 选中项，去重 */
function editPollPaths(): string[] {
  const set = new Set<string>()
  for (const f of (virtualGrid.value ? gridItems.value : virtualList.value ? listItems.value : sortedItems.value)) set.add(f.path)
  for (const p of selPaths.value) set.add(p)
  return Array.from(set)
}

async function pollEditing() {
  if (!apps.isAvailable('office')) { editing.value = {}; return }
  const byPath = new Map(sortedItems.value.map(f => [f.path, f]))
  const files = editPollPaths()
    .map(p => byPath.get(p))
    .filter((f): f is FileItem => !!f && !f.isDir && EDIT_EXTS.includes(f.ext || ''))
  // 合并：先保留旧结果，只更新本轮查到的项，并清掉已不在当前目录的键
  const out: Record<string, string> = { ...editing.value }
  for (const p of Object.keys(out)) if (!byPath.has(p)) delete out[p]
  if (!files.length) { editing.value = out; return }
  try {
    const items = files.map(f => {
      const sp = onSharedDrive.value ? sharedPathParse(f.path) : null
      return sp
        ? { key: f.path, shareId: sp.shareId, rel: sp.rel }
        : { key: f.path, policyId: currentPolicy.value?.id, path: f.path }
    })
    const r = await officeApi.statusBatch(items)
    for (const f of files) {
      const names = r[f.path]?.editors?.map(e => e.name).filter(Boolean)
      if (names?.length) out[f.path] = names.join('、')
      else delete out[f.path] // 本轮查过且没人编辑 → 清掉（含编辑者已离开的情况）
    }
    editing.value = out
  } catch { /* 网络异常保留上一次状态 */ }
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
  if (app === 'picasa') withList.list = siblings.filter(x => ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'heic', 'heif'].includes(x.ext))
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
    // 与双击一致：桌面窗口内嵌打开（配置 DS 时窗口内即完整 ONLYOFFICE 编辑器）
  }
  const p = withList
  const map: Record<string, { title: string; icon: string; w: number; h: number }> = {
    mediaviewer: { title: f.name + ' - 媒体播放器', icon: 'media', w: 880, h: 580 },
    notepad: { title: f.name + ' - 记事本', icon: 'notepad', w: 780, h: 560 },
    officeeditor: { title: f.name + ' - Office', icon: 'office', w: 1240, h: 780 },
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
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'heic', 'heif'].includes(ext)) {
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

// 图标映射纯逻辑见 ./explorer/fileIcons（按主题分两套映射）
function iconOf(f: FileItem) { return fileIcon(f, session.osTheme) }
// ---- 内部拖拽移动 + 图片缩略图 ----
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
  // 重名自动加序号（Windows 同款格式，含空格）：新建文件夹 (2)、新建文本文档 (2).txt
  const final = uniqueName(t.base, t.ext, items.value.map(x => x.name))
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
// 「新建」条目：工具栏下拉与空白右键共用（创意文档项按系统功能门控）
function buildNewItems() {
  return newEntries({
    mindmap: apps.isAvailable('mindmap'),
    whiteboard: apps.isAvailable('whiteboard'),
    flowchart: apps.isAvailable('flowchart'),
    onNew: newItem
  })
}
// 工具栏「新建」下拉（Windows 资源管理器同款）
function newMenu(e: MouseEvent) {
  ctx.show(e.clientX, e.clientY + 6, buildNewItems())
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
// 共享盘（可写共享）内的上传：走统一上传泵（分片 + 秒传 + 断点续传 + 重试 + 进度面板），
// 服务端把落盘属主记为共享创建者（占创建者配额）；大文件不再受单次直传限制
function sharedUploadFiles(files: File[]) {
  const c = sharedCtx.value
  if (!c || !files.length) return
  transfer.addFiles(0, c.rel, files, c.shareId)
  transfer.panel(true)
  toast.success(`已加入 ${files.length} 个文件到上传队列`)
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
      // 可写共享：拖入共享文件夹 → 统一上传泵（分片+秒传+续传），落盘进共享创建者目录
      if (!inWritableShare.value || !f.isDir) { toast.error('此共享为只读，不能上传'); return }
      const sp = sharedPathParse(f.path)
      if (!sp) return
      const r = await collectDropFiles(e.dataTransfer)
      if (r.problems.length) toast.error(`部分拖入内容读取失败：${r.problems[0]}`)
      if (!r.files.length) return
      transfer.addFiles(0, sp.rel, r.files.map(d => d.file), sp.shareId)
      transfer.panel(true)
      toast.success(`已加入 ${r.files.length} 个文件到「${f.name}」的队列`)
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

// 批量重命名：纯逻辑见 ./explorer/fileNames(batchRename)，这里只做 ref → 参数的适配
function brTransform(it: FileItem, n: number): string {
  return batchRename(it.name, n, {
    mode: brMode.value,
    find: brFind.value,
    repl: brRepl.value,
    text: brText.value,
    seqFmt: brSeqFmt.value,
    caseMode: brCase.value
  })
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
  try { odTasks.value = (await aget<TaskItem[]>('/offline')).slice(0, 8) } catch {}
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
const shareCollect = ref(false)
const encBusy = ref(false)
const encProgress = ref('')
// 收集模式强制「只进不出」：关掉下载/预览/编辑开关的呈现（后端 Create 也强制）
watch(shareCollect, v => { if (v) { shareAllowDl.value = false; sharePreview.value = false; shareEdit.value = false } })
function shareSel() {
  if (selPaths.value.length !== 1) return
  if (onSharedDrive.value) { toast.error('共享盘内不能创建分享链接'); return }
  shareTarget.value = items.value.find(i => i.path === selPaths.value[0]) || null
  sharePwd.value = ''; shareExpire.value = 0; shareMaxDl.value = 0; shareLink.value = ''
  shareEnc.value = false; shareCollect.value = false; encBusy.value = false; encProgress.value = ''
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
      allowDownload: shareAllowDl.value, previewEnabled: sharePreview.value, allowEdit: shareEdit.value,
      collectOnly: shareCollect.value || undefined
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

// ---- 大文件夹窗口化渲染（虚拟滚动） ----
// 仅当条目数超过阈值时启用；小目录仍全量渲染，DOM 结构与样式与改动前完全一致。
// 交互面无损：框选本就用视口坐标只命中所见条目、拖拽取自身元素、选择/打开全走数据，
// 上下占位高度撑住滚动条总高，故滚动位置与坐标语义不变。
const gridEl = ref<HTMLElement>()
const listEl = ref<HTMLElement>()
const vwTop = ref(0)
const vwViewport = ref(0)
const vwCols = ref(1)
const vwRowH = ref(0)
const vwListRowH = ref(0)

const virtualGrid = computed(() => viewMode.value === 'grid' && sortedItems.value.length > VIRTUAL_THRESHOLD)
const virtualList = computed(() => viewMode.value === 'list' && sortedItems.value.length > VIRTUAL_THRESHOLD)

// 与 base.css 的 .file-grid 保持一致（项宽/间距/内边距），用于按容器宽度推算列数
const GRID_ITEM_W = 100
const GRID_GAP = 6
const GRID_PAD = 12
// 固定行高的兜底值（与下方 .virtual 的 CSS 一致）：首次渲染即按它窗口化，
// 避免「先全渲染 3000 项再收敛」；真实值由 measureView 从 DOM 量得后自动修正
const GRID_ROW_H_FALLBACK = 118 // 112 项高 + 6 间距
const LIST_ROW_H_FALLBACK = 36
const VIEWPORT_FALLBACK = 800

/** 量取当前视图容器的列数/行高/可视高度/滚动位置 */
function measureView() {
  if (viewMode.value === 'grid') {
    const el = gridEl.value
    if (!el) return
    const inner = el.clientWidth - GRID_PAD * 2
    vwCols.value = Math.max(1, Math.floor((inner + GRID_GAP) / (GRID_ITEM_W + GRID_GAP)))
    const item = el.querySelector('.file-item') as HTMLElement | null
    if (item) vwRowH.value = item.offsetHeight + GRID_GAP
    vwViewport.value = el.clientHeight
    vwTop.value = el.scrollTop
  } else {
    const el = listEl.value
    if (!el) return
    vwCols.value = 1
    const row = el.querySelector('tbody tr:not(.vpad)') as HTMLElement | null
    if (row) vwListRowH.value = row.offsetHeight
    vwViewport.value = el.clientHeight
    vwTop.value = el.scrollTop
  }
}

const gridWin = computed(() => computeWindow({
  total: sortedItems.value.length, windowed: virtualGrid.value,
  scrollTop: vwTop.value, viewportH: vwViewport.value || VIEWPORT_FALLBACK,
  rowH: vwRowH.value || GRID_ROW_H_FALLBACK, perRow: vwCols.value
}))
const listWin = computed(() => computeWindow({
  total: sortedItems.value.length, windowed: virtualList.value,
  scrollTop: vwTop.value, viewportH: vwViewport.value || VIEWPORT_FALLBACK,
  rowH: vwListRowH.value || LIST_ROW_H_FALLBACK, perRow: 1
}))
const gridItems = computed(() => virtualGrid.value ? sortedItems.value.slice(gridWin.value.start, gridWin.value.end) : sortedItems.value)
const listItems = computed(() => virtualList.value ? sortedItems.value.slice(listWin.value.start, listWin.value.end) : sortedItems.value)
// 网格占位：用「跨整行的占位元素」而不是容器 padding。
// 关键坑：容器是 border-box，padding 一旦超过自身高度就会把滚动容器本身撑高（不再内部滚动、
// 内容被外层 overflow:hidden 裁掉），实测把 clientHeight 从 453 撑到 38792。故窗口化时
// 取消容器纵向内边距，留白交给占位元素承担。
const gridPadTop = computed(() => (virtualGrid.value ? GRID_PAD + gridWin.value.padTop : 0))
const gridPadBottom = computed(() => (virtualGrid.value ? GRID_PAD + gridWin.value.padBottom : 0))

let vwRaf = 0
function onViewScroll() {
  if (vwRaf) return
  vwRaf = requestAnimationFrame(() => { vwRaf = 0; measureView() })
}
let vwRO: ResizeObserver | null = null
/** 容器换了（切视图/换盘/换目录）就重新绑定测量：先量一次，再随尺寸变化量 */
function bindVirtual() {
  nextTick(() => {
    const el = viewMode.value === 'grid' ? gridEl.value : listEl.value
    if (vwRO) { vwRO.disconnect(); vwRO = null }
    measureView()
    if (el && typeof ResizeObserver !== 'undefined') {
      vwRO = new ResizeObserver(() => measureView())
      vwRO.observe(el)
    }
  })
}
// 切视图 / 换盘 / 换目录 → 重新绑定（含滚动值重取，避免带上一个目录的残留）
watch([viewMode, () => currentPolicy.value?.id, () => path.value], () => bindVirtual())
// 滚动停下后补查一次「正在编辑」：轮询只看窗口，滚到新区域需要立刻补上徽章
// （300ms 防抖：拖动滚动条时不至于每帧发请求；空窗口/无 office 文件时函数自身直接返回）
let editScrollTimer: ReturnType<typeof setTimeout> | undefined
watch(vwTop, () => {
  clearTimeout(editScrollTimer)
  editScrollTimer = setTimeout(pollEditing, 300)
})
// 条目到齐后再量一次行高（固定行高的 CSS 只在窗口化时生效，量到真实值即修正兜底常数）
watch(() => sortedItems.value.length, () => { if (virtualGrid.value || virtualList.value) nextTick(measureView) })

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
  const noPolicy = !currentPolicy.value
  const menu = blankMenu({
    noPolicy,
    shared: onSharedDrive.value,
    writable: inWritableShare.value,
    readOnly: readOnly.value,
    viewGrid: viewMode.value === 'grid',
    sortMode: sortMode.value,
    hasClip: !!clip.mode,
    canOffline: canOffline.value,
    canTerminal: canTerminal.value,
    newItems: buildNewItems(),
    on: {
      setView: v => (viewMode.value = v),
      setSort: m => setSort(m),
      refresh,
      paste: pasteSel,
      sharedMkdir: () => sharedMkdir(sharedCtx.value!.rel),
      sharedPickFiles,
      pickFiles,
      pickFolder,
      offline: offlineDlg,
      terminal: () => store.open('terminal', { policyId: currentPolicy.value!.id, path: path.value }, { title: '终端' }),
      props: noPolicy ? () => store.open('settings') : () => showProps(path.value)
    }
  })
  ctx.show(e.clientX, e.clientY, menu)
}
/** 弹出条目菜单：鼠标右键与触屏长按共用，坐标由调用方给出 */
function showItemMenu(f: FileItem, x: number, y: number) {
  const multi = selPaths.value.length > 1
  const menu = itemMenu({
    f,
    tags: buildTagMenu(f),
    pdf: !multi && !onSharedDrive.value && !readOnly.value && f.ext === 'pdf'
      ? { label: 'PDF 工具箱', icon: 'pdfreader', children: buildPdfMenu(f) } : undefined,
    pdfMerge: multi ? buildPdfMergeMenu() : undefined,
    multi,
    multiCount: selPaths.value.length,
    shared: onSharedDrive.value,
    writable: inWritableShare.value,
    readOnly: readOnly.value,
    guest: session.isGuest,
    canSharePub: canSharePub.value,
    canShareUser: canShareUser.value,
    allowArchive: !!group.value.allowArchive,
    hasClip: !!clip.mode,
    on: {
      open: () => openItem(f),
      openWith: () => buildOpenWith(f),
      copyPath: () => copyPath(f.path),
      download: downloadSel,
      share: shareSel,
      shareUser: shareUserSel,
      dlink: dlinkSel,
      toggleStar: () => toggleStar(f),
      cut: cutSel,
      copy: copySel,
      pasteInto: pasteInto(f),
      rename: renameSel,
      archive: archiveSel,
      extract: extractSel,
      del: deleteSel,
      props: () => showProps(multi ? selPaths.value[0] : f.path),
      sharedMkdir: () => sharedMkdir(sharedPathParse(f.path)?.rel || '')
    }
  })
  ctx.show(x, y, menu)
}

/** 鼠标右键：先按既有语义选中（右键作用于整组），再弹菜单 */
function onItemCtx(f: FileItem, e: MouseEvent) {
  onItemDown(f, e)
  showItemMenu(f, e.clientX, e.clientY)
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
  const menu = policyMenu({
    isAdmin: session.user?.role === 'admin',
    canShareUser: canShareUser.value,
    canTerminal: canTerminal.value,
    on: {
      open: () => openPolicy(p),
      shareRoot: () => sharePolicyRoot(p),
      terminal: () => store.open('terminal', { policyId: p.id, path: '/' }, { title: '终端' }),
      admin: () => store.open('admin')
    }
  })
  ctx.show(e.clientX, e.clientY, menu)
}
async function toggleStar(f: FileItem) {
  if (!currentPolicy.value) return
  if (f.starred) await fsApi.starRemove(currentPolicy.value.id, f.path)
  else await fsApi.starAdd(currentPolicy.value.id, f.path, f.name, f.isDir)
  load(); loadStars()
}

// ---- 工具 ----
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
  display: flex; align-items: flex-end; gap: 5px; padding: 8px 12px 0;
  border-bottom: 1px solid var(--stroke-b); overflow-x: auto; flex: none;
}
.exp-tab {
  display: flex; align-items: center; gap: 7px; padding: 7px 10px; min-width: 100px; max-width: 180px;
  border-radius: 9px 9px 0 0; font-size: 12px; color: var(--text-2); cursor: pointer;
  border: 1px solid transparent; border-bottom: none; flex: none; position: relative;
  transition: background 0.15s ease, color 0.15s ease;
}
.exp-tab:hover { background: var(--hover-b); }
.exp-tab.active { background: var(--card); color: var(--text); border-color: var(--stroke-b); }
/* 活动标签顶部主题渐变指示条（Fluent 签名细节） */
.exp-tab.active::before {
  content: ''; position: absolute; top: 0; left: 12px; right: 12px; height: 2.5px;
  border-radius: 2px; background: linear-gradient(90deg, var(--theme-1), var(--theme-2));
}
.exp-tab .t-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.exp-tab .t-close {
  width: 16px; height: 16px; border-radius: 5px; display: flex; align-items: center;
  justify-content: center; opacity: 0.45; flex: none; transition: background 0.12s ease, opacity 0.12s ease;
}
.exp-tab .t-close:hover { background: var(--danger-bg); opacity: 1; color: var(--danger); }
.exp-tab-add {
  width: 26px; height: 26px; border-radius: 8px; display: flex; align-items: center;
  justify-content: center; cursor: pointer; color: var(--text-3); flex: none;
  transition: background 0.12s ease, color 0.12s ease;
}
.exp-tab-add:hover { background: var(--hover-b); color: var(--text); }

/* 游客临时空间提示条 */
.guest-ttl-bar {
  display: flex; align-items: center; gap: 6px; padding: 5px 12px; flex: none;
  font-size: 12px; color: var(--text-2);
  background: var(--accent-weak); border-bottom: 1px solid var(--stroke-b);
}
.guest-ttl-bar :deep(svg) { color: var(--accent, var(--text-2)); flex: none; }

.side-title { font-size: 11px; font-weight: 600; color: var(--text-3); padding: 10px 10px 6px; letter-spacing: 0.5px; }
/* 侧栏：macOS Finder 式毛玻璃 vibrancy（半透明 + 饱和提升，透出窗口底材） */
.exp-side {
  width: 210px; flex: none; border-right: 1px solid var(--stroke); overflow: auto; padding: 10px 8px;
  background: color-mix(in srgb, var(--card) 62%, transparent);
  backdrop-filter: blur(24px) saturate(1.5);
  -webkit-backdrop-filter: blur(24px) saturate(1.5);
}
/* 窗口级响应式（容器查询按「窗口宽度」而非屏幕宽度）：拖窄 Explorer 窗口时
   预览窗格 → 侧栏收窄 → 侧栏收进 ☰ 抽屉，逐级让位给文件列表。
   与 html[data-mobile] 的整屏手机布局互不干扰（后者按屏幕判定，优先级更高）。 */
.app-root { container-type: inline-size; }
@container (max-width: 920px) {
  .preview-pane { display: none; }
}
@container (max-width: 640px) {
  .exp-side { width: 172px; }
}
@container (max-width: 520px) {
  .m-nav { display: inline-flex; }
  .exp-side {
    position: absolute; top: 0; bottom: 0; left: 0; z-index: 30;
    width: min(230px, 78%);
    background: var(--card);
    border-right: 1px solid var(--stroke-b);
    transform: translateX(-100%);
    transition: transform 0.18s ease;
    box-shadow: 2px 0 14px rgba(0, 0, 0, 0.18);
  }
  .exp-side.m-open { transform: translateX(0); }
}
.side-item {
  display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 8px;
  font-size: 13px; cursor: pointer; color: var(--text-2); margin-bottom: 2px;
  transition: background 0.15s ease, color 0.15s ease;
}
.side-item:hover { background: var(--hover-b); color: var(--text); }
.side-item.active { background: var(--accent-weak); color: var(--text); font-weight: 500; }
/* 选中项图标染主题色（AppIcon 根元素 = svg 或 img，均带本组件作用域属性） */
.side-item.active svg { color: var(--theme-2); }
.side-item span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sel-rect { position: absolute; border: 1px solid var(--theme-2); background: var(--accent-weak); z-index: 100; }
.rubber-band {
  position: absolute; border: 1px solid color-mix(in srgb, var(--theme-2) 75%, transparent);
  background: var(--accent-weak); border-radius: 4px; z-index: 60; pointer-events: none;
}

/* 分段式导航组（macOS 工具栏语言）：后退/前进/上级/刷新收进一个胶囊底座 */
.seg {
  display: flex; align-items: center; gap: 1px; padding: 2px; flex: none;
  background: color-mix(in srgb, var(--text) 5%, transparent);
  border: 1px solid var(--stroke-b); border-radius: 10px;
}
.seg .tool-btn { padding: 5px 8px; border-radius: 8px; }
.seg .tool-btn + .tool-btn { margin-left: 1px; }
/* 条目级样式（角标/编辑徽章/复选框/缩略图/高亮）已随条目迁到
   ./explorer/FileGrid.vue 与 FileList.vue —— 本组件是 scoped，跨组件选择器够不着 */
.file-list th input[type="checkbox"] { width: 15px; height: 15px; margin: 0; accent-color: var(--theme-2); cursor: pointer; }
.tool-btn.global-on { color: var(--theme-2); background: var(--accent-weak); }
.od-sep { height: 1px; background: var(--stroke-b); margin: 14px -6px 10px; }
.od-list { max-height: 220px; overflow: auto; }
.od-item { padding: 7px 2px; border-bottom: 1px solid var(--hover-b); }
.od-item:last-child { border-bottom: none; }
.od-name { font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; user-select: text; }
.od-status { font-size: 12px; color: var(--text-3); flex: none; }
.file-list thead th { user-select: none; white-space: nowrap; }
.file-list thead th:hover { color: var(--text); background: var(--hover-b); }
.file-list thead th.sort-active { color: var(--theme-2); font-weight: 600; box-shadow: inset 0 -2px 0 var(--theme-2); }
.sort-arrow { font-size: 10px; }
.preview-pane { width: 248px; flex: none; border-left: 1px solid var(--stroke-b); padding: 16px 14px; overflow: auto; background: var(--bg50); }
.pp-head { font-size: 11.5px; font-weight: 600; color: var(--text-3); letter-spacing: 1px; margin-bottom: 12px; }
.pp-thumb { height: 148px; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; background: var(--hover-b); border-radius: var(--radius); overflow: hidden; }
.pp-img { max-width: 100%; max-height: 100%; object-fit: contain; }
.pp-name { font-size: 14px; font-weight: 600; word-break: break-all; margin-bottom: 12px; line-height: 1.4; }
.pp-row { display: flex; justify-content: space-between; gap: 8px; font-size: 12.5px; padding: 6px 0; border-bottom: 1px solid var(--bg50); color: var(--text-3); }
.pp-row b { color: var(--text); font-weight: 500; text-align: right; word-break: break-all; }
.pp-actions { display: flex; gap: 8px; margin-top: 10px; }
.pp-actions .btn { flex: 1; padding: 6px 0; }
/* 预览面板标签区：描边彩色胶囊 + 虚线「＋ 标签」按钮 */
.pp-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.pp-tag {
  font-size: 11.5px; line-height: 1; padding: 4px 10px; border-radius: 999px;
  border: 1px solid; background: color-mix(in srgb, currentColor 12%, transparent);
}
.pp-tag.add { color: var(--text-3); border-style: dashed; cursor: pointer; }
.pp-tag.add:hover { color: var(--text); }
/* 侧栏标签色点 */
.tag-dot { width: 10px; height: 10px; border-radius: 3px; flex: none; }

/* 此电脑：驱动器卡片（Win11 资源管理器标准样式） */
.sec-title { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 12px; letter-spacing: 0.2px; }
.drive-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; max-width: 820px; }
.drive-card {
  display: flex; gap: 14px; align-items: center; padding: 16px 18px;
  border-radius: var(--radius); border: 1px solid var(--stroke-b); cursor: default;
  background: var(--card);
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.18s var(--anim-pop), box-shadow 0.18s ease;
}
.drive-card:hover { background: var(--hover-b); transform: translateY(-2px); box-shadow: var(--shadow); }
.drive-card.sel {
  background: var(--accent-weak); border-color: color-mix(in srgb, var(--theme-2) 45%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--theme-2) 22%, transparent);
}
.drive-name {
  font-size: 13.5px; font-weight: 600; color: var(--text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.drive-bar { height: 5px; border-radius: 3px; background: rgba(125,125,135,0.22); margin: 9px 0 7px; overflow: hidden; }
.dark .drive-bar { background: rgba(255,255,255,0.14); }
.drive-bar-fill {
  height: 100%; border-radius: 3px;
  background: linear-gradient(90deg, var(--theme-1), var(--theme-2));
  transition: width 0.4s var(--anim-pop);
}
.drive-bar-fill.full { background: var(--danger); }
.drive-sub { font-size: 11px; color: var(--text-3); }

/* 搜索中骨架（.fileArea 内绝对定位，盖住旧结果；自身不参与鼠标交互） */
.search-skel {
  position: absolute; inset: 0; z-index: 5; pointer-events: none;
  padding: 16px 20px; display: flex; flex-direction: column; gap: 13px;
  background: var(--bg70);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  animation: skel-in 0.12s ease;
}
.skel-row { display: flex; align-items: center; gap: 12px; }
.skel-ico { width: 22px; height: 22px; border-radius: 4px; flex: none; }
.skel-bar { height: 10px; border-radius: 5px; }
.skel-ico, .skel-bar {
  background: linear-gradient(90deg, var(--hover-b) 25%, color-mix(in srgb, var(--text-3) 20%, transparent) 37%, var(--hover-b) 63%);
  background-size: 400% 100%;
  animation: skel-shimmer 1.3s ease-in-out infinite;
}
@keyframes skel-shimmer { from { background-position: 100% 0 } to { background-position: 0 0 } }
@keyframes skel-in { from { opacity: 0 } to { opacity: 1 } }

/* 大文件夹窗口化：行高必须固定，窗口计算才成立。
   只挂在 .virtual 上 —— 普通目录（≤ 阈值）不套用，渲染与样式与改动前一致 */
.file-grid.virtual { padding-top: 0; padding-bottom: 0; }
/* 占位元素：跨整行（auto-fill 的整行），不参与鼠标交互 */
.file-grid .vt-pad { grid-column: 1 / -1; pointer-events: none; }
/* 占位行：不显示内容、不响应鼠标、不参与 hover 高亮 */
.file-list .vpad { pointer-events: none; }
.file-list .vpad td { padding: 0; border: none; }
.file-list .vpad:hover td { background: transparent; }

/* 状态栏：Finder/deepin 式信息胶囊（路径常驻，计数/剪贴板为小圆片） */
.sb-path { color: var(--text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sb-pill {
  padding: 2px 10px; border-radius: 999px; flex: none;
  background: color-mix(in srgb, var(--text) 6%, transparent);
}
.sb-pill.on { background: var(--accent-weak); color: var(--theme-2); font-weight: 500; }

/* 三系融合微调：macOS 下侧栏更通透（突出 vibrancy），deepin 下条目更圆润 */
.theme-macos .exp-side { background: color-mix(in srgb, var(--card) 45%, transparent); }
.theme-deepin .side-item { border-radius: 10px; }
.theme-deepin .seg { border-radius: 12px; }
</style>
/* ZTESTMARKERQWX 9f3a */
