<template>
  <!-- dock：浮动胶囊 dock-box（开始/搜索/小组件 + 任务 + 主题 + 控制 + 日期），
       最大化窗口时自动收起（open-dock 弹跳提示），鼠标贴近底部 60px 时回弹 -->
  <div class="w12-dockbox" :class="{ hide: dockHidden, peek: peek }">
    <!-- dock-start：开始 + 搜索 + 小组件 -->
    <div class="w12-dock w12-dock-start">
      <button class="w12-dockbtn w12-startbtn" :class="{ show: panel === 'start' }" title="开始" @click.stop="openPanel('start')">
        <svg class="menu" aria-hidden="true" focusable="false" viewBox="0,0,440,439" xmlns="http://www.w3.org/2000/svg" overflow="hidden">
          <defs><clipPath id="w12clip-start1"><rect x="134" y="59" width="440" height="439"/></clipPath></defs>
          <g clip-path="url(#w12clip-start1)" transform="translate(-134 -59)">
            <path d="M233.479 67.5001 475.521 67.5001C525.767 67.5001 566.5 108.233 566.5 158.479L566.5 490.5 142.5 490.5 142.5 158.479C142.5 108.233 183.233 67.5001 233.479 67.5001Z" stroke="#7F7F7F" stroke-width="14.6667" stroke-linecap="round" stroke-miterlimit="8" fill="#A6A6A6" fill-rule="evenodd" style="fill: var(--w12-bg70);"/>
            <path d="M208.5 132.5 334.716 132.5" stroke="#888" stroke-width="14.6667" stroke-linecap="round" stroke-miterlimit="8" fill="none" fill-rule="evenodd"/>
            <path d="M208.5 175.5 386.34 175.5" stroke="#888" stroke-width="14.6667" stroke-linecap="round" stroke-miterlimit="8" fill="none" fill-rule="evenodd"/>
            <path d="M208.5 221.5 271.608 221.5" stroke="#888" stroke-width="14.6667" stroke-linecap="round" stroke-miterlimit="8" fill="none" fill-rule="evenodd"/>
          </g>
        </svg>
        <img src="/icons/win12/logo.svg" class="ico" alt="" />
      </button>
      <button class="w12-dockbtn w12-searchbtn" :class="{ show: panel === 'search' }" title="搜索" @click.stop="openPanel('search')">
        <svg class="out" width="26" height="26" viewBox="0,0,228,229" xmlns="http://www.w3.org/2000/svg" overflow="hidden"><defs><clipPath id="w12clip-search-out-0"><rect x="548" y="268" width="228" height="229"/></clipPath><linearGradient x1="738.799" y1="300.076" x2="608.064" y2="486.786" gradientUnits="userSpaceOnUse" spreadMethod="reflect" id="w12fill-search-out-1"><stop offset="0" stop-color="#A6A6A6"/><stop offset="0.18" stop-color="#A6A6A6"/><stop offset="0.91" stop-color="#595959"/><stop offset="1" stop-color="#595959"/></linearGradient></defs><g clip-path="url(#w12clip-search-out-0)" transform="translate(-548 -268)"><path d="M640 268.696C690.41 268.696 731.276 309.574 731.276 360 731.276 378.91 725.529 396.477 715.687 411.049L713.816 413.318 771.4 470.903C777.068 476.571 777.068 485.761 771.4 491.429 765.732 497.097 756.542 497.097 750.874 491.429L693.292 433.847 691.033 435.711C676.465 445.556 658.904 451.305 640 451.304 589.59 451.305 548.724 410.426 548.724 360 548.724 309.574 589.59 268.696 640 268.696Z" fill="url(#w12fill-search-out-1)" fill-rule="evenodd"/></g></svg>
        <svg class="in" width="20" height="20" viewBox="0,0,134,134" xmlns="http://www.w3.org/2000/svg" overflow="hidden"><defs><clipPath id="w12clip-search-in-0"><rect x="573" y="293" width="134" height="134"/></clipPath><linearGradient x1="611.068" y1="280.509" x2="668.932" y2="439.491" gradientUnits="userSpaceOnUse" spreadMethod="reflect" id="w12fill-search-in-1"><stop offset="0" stop-color="#82CDF6"/><stop offset="0.18" stop-color="#82CDF6"/><stop offset="0.91" stop-color="#4297D6"/><stop offset="1" stop-color="#4297D6"/></linearGradient></defs><g clip-path="url(#w12clip-search-in-0)" transform="translate(-573 -293)"><path d="M574 360C574 323.549 603.549 294 640 294 676.451 294 706 323.549 706 360 706 396.451 676.451 426 640 426 603.549 426 574 396.451 574 360Z" fill="url(#w12fill-search-in-1)" fill-rule="evenodd"/></g></svg>
      </button>
      <button class="w12-dockbtn w12-widgetsbtn" :class="{ show: panel === 'widgets' }" title="小组件" @click.stop="openPanel('widgets')">
        <svg viewBox="0,0,260,260" xmlns="http://www.w3.org/2000/svg" overflow="hidden" class="wid1"><defs><clipPath id="w12clip-wid1-0"><rect x="510" y="230" width="260" height="260"/></clipPath><linearGradient x1="551.891" y1="207.391" x2="728.109" y2="512.609" gradientUnits="userSpaceOnUse" spreadMethod="reflect" id="w12fill-wid1-1"><stop offset="0" stop-color="#7AB1FA"/><stop offset="0.18" stop-color="#7AB1FA"/><stop offset="0.91" stop-color="#4C6EDC"/><stop offset="1" stop-color="#4C6EDC"/></linearGradient></defs><g clip-path="url(#w12clip-wid1-0)" transform="translate(-510 -230)"><path d="M511 274.001C511 250.252 530.252 231 554.001 231L725.999 231C749.748 231 769 250.252 769 274.001L769 445.999C769 469.748 749.748 489 725.999 489L554.001 489C530.252 489 511 469.748 511 445.999Z" fill="url(#w12fill-wid1-1)" fill-rule="evenodd"/></g></svg>
        <svg viewBox="0,0,175,206" xmlns="http://www.w3.org/2000/svg" overflow="hidden" class="wid2"><defs><filter id="w12fxa0" x="-10%" y="-10%" width="120%" height="120%" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse"><feComponentTransfer color-interpolation-filters="sRGB"><feFuncR type="discrete" tableValues="0 0"/><feFuncG type="discrete" tableValues="0 0"/><feFuncB type="discrete" tableValues="0 0"/><feFuncA type="linear" slope="0.4" intercept="0"/></feComponentTransfer><feGaussianBlur stdDeviation="5.81042 5.77778"/></filter><filter id="w12fxa1" x="-10%" y="-10%" width="120%" height="120%" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse"><feComponentTransfer color-interpolation-filters="sRGB"><feFuncR type="discrete" tableValues="0 0"/><feFuncG type="discrete" tableValues="0 0"/><feFuncB type="discrete" tableValues="0 0"/><feFuncA type="linear" slope="0.4" intercept="0"/></feComponentTransfer><feGaussianBlur stdDeviation="4 4"/></filter><filter id="w12fxa2" x="-10%" y="-10%" width="120%" height="120%" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse"><feComponentTransfer color-interpolation-filters="sRGB"><feFuncR type="discrete" tableValues="0 0"/><feFuncG type="discrete" tableValues="0 0"/><feFuncB type="discrete" tableValues="0 0"/><feFuncA type="linear" slope="0.4" intercept="0"/></feComponentTransfer><feGaussianBlur stdDeviation="4 4"/></filter><filter id="w12fxa3" x="-10%" y="-10%" width="120%" height="120%" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse"><feComponentTransfer color-interpolation-filters="sRGB"><feFuncR type="discrete" tableValues="0 0"/><feFuncG type="discrete" tableValues="0 0"/><feFuncB type="discrete" tableValues="0 0"/><feFuncA type="linear" slope="0.4" intercept="0"/></feComponentTransfer><feGaussianBlur stdDeviation="4 4"/></filter><clipPath id="w12clip-wid2-4"><rect x="615" y="214" width="175" height="206"/></clipPath><clipPath id="w12clip-wid2-5"><rect x="-6.53674" y="-6.5" width="101.068" height="115"/></clipPath><clipPath id="w12clip-wid2-6"><rect x="0" y="0" width="89" height="104"/></clipPath><linearGradient x1="644.325" y1="249.245" x2="754.675" y2="380.755" gradientUnits="userSpaceOnUse" spreadMethod="reflect" id="w12fill-wid2-7"><stop offset="0" stop-color="#775CFE"/><stop offset="0.43" stop-color="#775CFE"/><stop offset="0.83" stop-color="#2473DC"/><stop offset="1" stop-color="#2473DC"/></linearGradient><clipPath id="w12clip-wid2-8"><rect x="-5" y="-5" width="67" height="42"/></clipPath><clipPath id="w12clip-wid2-9"><rect x="0" y="0" width="57" height="35"/></clipPath><clipPath id="w12clip-wid2-10"><rect x="-5" y="-5" width="103" height="42"/></clipPath><clipPath id="w12clip-wid2-11"><rect x="0" y="0" width="93" height="35"/></clipPath><clipPath id="w12clip-wid2-12"><rect x="-5" y="-5" width="80" height="42"/></clipPath><clipPath id="w12clip-wid2-13"><rect x="0" y="0" width="72" height="35"/></clipPath></defs><g clip-path="url(#w12clip-wid2-4)" transform="translate(-615 -214)"><g clip-path="url(#w12clip-wid2-5)" filter="url(#w12fxa0)" transform="matrix(1.98876 0 0 2 614 213)"><g clip-path="url(#w12clip-wid2-6)"><path d="M18.2408 33.043C18.2408 24.8162 24.9475 18.1472 33.2208 18.1472L56.0574 18.1472C64.3306 18.1472 71.0374 24.8162 71.0374 33.043L71.0374 71.2513C71.0374 79.4781 64.3306 86.1472 56.0574 86.1472L33.2208 86.1472C24.9475 86.1472 18.2408 79.4781 18.2408 71.2513Z" fill="#FF0000" fill-rule="evenodd"/></g></g><path d="M647 276.792C647 260.338 660.338 247 676.792 247L722.208 247C738.662 247 752 260.338 752 276.792L752 353.208C752 369.662 738.662 383 722.208 383L676.792 383C660.338 383 647 369.662 647 353.208Z" fill="url(#w12fill-wid2-7)" fill-rule="evenodd"/><g clip-path="url(#w12clip-wid2-8)" filter="url(#w12fxa1)" transform="translate(649 260)"><g clip-path="url(#w12clip-wid2-9)"><path d="M17.3857 17.3857 39.7776 17.3858" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" stroke-miterlimit="8" fill="none" fill-rule="evenodd"/></g></g><path d="M664.5 275.5 686.892 275.5" stroke="#FFFFFF" stroke-width="8.66667" stroke-linecap="round" stroke-miterlimit="8" fill="none" fill-rule="evenodd"/><g clip-path="url(#w12clip-wid2-10)" filter="url(#w12fxa2)" transform="translate(649 282)"><g clip-path="url(#w12clip-wid2-11)"><path d="M17.3857 17.3857 75.9099 17.3858" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" stroke-miterlimit="8" fill="none" fill-rule="evenodd"/></g></g><path d="M664.5 297.5 723.024 297.5" stroke="#FFFFFF" stroke-width="8.66667" stroke-linecap="round" stroke-miterlimit="8" fill="none" fill-rule="evenodd"/><g clip-path="url(#w12clip-wid2-12)" filter="url(#w12fxa3)" transform="translate(649 305)"><g clip-path="url(#w12clip-wid2-13)"><path d="M17.3857 17.3857 54.5358 17.3858" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" stroke-miterlimit="8" fill="none" fill-rule="evenodd"/></g></g><path d="M664.5 320.5 701.65 320.5" stroke="#FFFFFF" stroke-width="8.66667" stroke-linecap="round" stroke-miterlimit="8" fill="none" fill-rule="evenodd"/></g></svg>
        <svg viewBox="0,0,174,298" xmlns="http://www.w3.org/2000/svg" overflow="hidden" class="wid3"><defs><filter id="w12fxb0" x="-10%" y="-10%" width="120%" height="120%" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse"><feComponentTransfer color-interpolation-filters="sRGB"><feFuncR type="discrete" tableValues="0 0"/><feFuncG type="discrete" tableValues="0 0"/><feFuncB type="discrete" tableValues="0 0"/><feFuncA type="linear" slope="0.4" intercept="0"/></feComponentTransfer><feGaussianBlur stdDeviation="5.81079 5.7971"/></filter><filter id="w12fxb1" x="-10%" y="-10%" width="120%" height="120%" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse"><feComponentTransfer color-interpolation-filters="sRGB"><feFuncR type="discrete" tableValues="0 0"/><feFuncG type="discrete" tableValues="0 0"/><feFuncB type="discrete" tableValues="0 0"/><feFuncA type="linear" slope="0.4" intercept="0"/></feComponentTransfer><feGaussianBlur stdDeviation="4 4"/></filter><filter id="w12fxb2" x="-10%" y="-10%" width="120%" height="120%" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse"><feComponentTransfer color-interpolation-filters="sRGB"><feFuncR type="discrete" tableValues="0 0"/><feFuncG type="discrete" tableValues="0 0"/><feFuncB type="discrete" tableValues="0 0"/><feFuncA type="linear" slope="0.4" intercept="0"/></feComponentTransfer><feGaussianBlur stdDeviation="4 4"/></filter><filter id="w12fxb3" x="-10%" y="-10%" width="120%" height="120%" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse"><feComponentTransfer color-interpolation-filters="sRGB"><feFuncR type="discrete" tableValues="0 0"/><feFuncG type="discrete" tableValues="0 0"/><feFuncB type="discrete" tableValues="0 0"/><feFuncA type="linear" slope="0.4" intercept="0"/></feComponentTransfer><feGaussianBlur stdDeviation="4 4"/></filter><clipPath id="w12clip-wid3-4"><rect x="498" y="214" width="174" height="298"/></clipPath><clipPath id="w12clip-wid3-5"><rect x="-6.53714" y="-6.52174" width="98.0572" height="162.04"/></clipPath><clipPath id="w12clip-wid3-6"><rect x="0" y="0" width="88" height="150"/></clipPath><linearGradient x1="668.609" y1="288.246" x2="496.391" y2="432.754" gradientUnits="userSpaceOnUse" spreadMethod="reflect" id="w12fill-wid3-7"><stop offset="0" stop-color="#C45DD5"/><stop offset="0.18" stop-color="#C45DD5"/><stop offset="0.69" stop-color="#A266E4"/><stop offset="1" stop-color="#A266E4"/></linearGradient><clipPath id="w12clip-wid3-8"><rect x="-5" y="-5" width="86" height="42"/></clipPath><clipPath id="w12clip-wid3-9"><rect x="0" y="0" width="77" height="35"/></clipPath><clipPath id="w12clip-wid3-10"><rect x="-5" y="-5" width="67" height="42"/></clipPath><clipPath id="w12clip-wid3-11"><rect x="0" y="0" width="58" height="35"/></clipPath><clipPath id="w12clip-wid3-12"><rect x="-5" y="-5" width="92" height="42"/></clipPath><clipPath id="w12clip-wid3-13"><rect x="0" y="0" width="85" height="35"/></clipPath></defs><g clip-path="url(#w12clip-wid3-4)" transform="translate(-498 -214)"><g clip-path="url(#w12clip-wid3-5)" filter="url(#w12fxb0)" transform="matrix(1.98864 0 0 1.99333 498 214)"><g clip-path="url(#w12clip-wid3-6)"><path d="M18.0166 36.3921C18.0166 26.2201 26.2821 17.9741 36.4781 17.9741L51.3493 17.9741C61.5454 17.9741 69.8109 26.2201 69.8109 36.3921L69.8109 113.436C69.8109 123.608 61.5454 131.854 51.3493 131.854L36.4781 131.854C26.2821 131.854 18.0166 123.608 18.0166 113.436Z" fill="#FF0000" fill-rule="evenodd"/></g></g><path d="M531 283.713C531 263.437 547.437 247 567.713 247L597.287 247C617.563 247 634 263.437 634 283.713L634 437.287C634 457.563 617.563 474 597.287 474L567.713 474C547.437 474 531 457.563 531 437.287Z" fill="url(#w12fill-wid3-7)" fill-rule="evenodd"/><g clip-path="url(#w12clip-wid3-8)" filter="url(#w12fxb1)" transform="translate(534 259)"><g clip-path="url(#w12clip-wid3-9)"><path d="M17.3857 17.3857 59.5683 17.3858" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" stroke-miterlimit="8" fill="none" fill-rule="evenodd"/></g></g><path d="M549.5 274.5 591.683 274.5" stroke="#FFFFFF" stroke-width="8.66667" stroke-linecap="round" stroke-miterlimit="8" fill="none" fill-rule="evenodd"/><g clip-path="url(#w12clip-wid3-10)" filter="url(#w12fxb2)" transform="translate(534 281)"><g clip-path="url(#w12clip-wid3-11)"><path d="M17.3857 17.3857 40.3525 17.3858" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" stroke-miterlimit="8" fill="none" fill-rule="evenodd"/></g></g><path d="M549.5 296.5 572.467 296.5" stroke="#FFFFFF" stroke-width="8.66667" stroke-linecap="round" stroke-miterlimit="8" fill="none" fill-rule="evenodd"/><g clip-path="url(#w12clip-wid3-12)" filter="url(#w12fxb3)" transform="translate(534 302)"><g clip-path="url(#w12clip-wid3-13)"><path d="M17.3857 17.3857 67.3293 17.3858" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" stroke-miterlimit="8" fill="none" fill-rule="evenodd"/></g></g><path d="M549.5 317.5 599.444 317.5" stroke="#FFFFFF" stroke-width="8.66667" stroke-linecap="round" stroke-miterlimit="8" fill="none" fill-rule="evenodd"/></g></svg>
        <svg viewBox="0,0,141,113" xmlns="http://www.w3.org/2000/svg" overflow="hidden" class="wid4"><defs><filter id="w12fxc0" x="-10%" y="-10%" width="120%" height="120%" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse"><feComponentTransfer color-interpolation-filters="sRGB"><feFuncR type="discrete" tableValues="0 0"/><feFuncG type="discrete" tableValues="0 0"/><feFuncB type="discrete" tableValues="0 0"/><feFuncA type="linear" slope="0.4" intercept="0"/></feComponentTransfer><feGaussianBlur stdDeviation="5.77778 5.77778"/></filter><filter id="w12fxc1" x="-10%" y="-10%" width="120%" height="120%" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse"><feComponentTransfer color-interpolation-filters="sRGB"><feFuncR type="discrete" tableValues="0 0"/><feFuncG type="discrete" tableValues="0 0"/><feFuncB type="discrete" tableValues="0 0"/><feFuncA type="linear" slope="0.4" intercept="0"/></feComponentTransfer><feGaussianBlur stdDeviation="4 4"/></filter><clipPath id="w12clip-wid4-2"><rect x="629" y="380" width="141" height="113"/></clipPath><clipPath id="w12clip-wid4-3"><rect x="-6" y="-3" width="154" height="121"/></clipPath><clipPath id="w12clip-wid4-4"><rect x="0" y="0" width="143" height="115"/></clipPath><linearGradient x1="670.387" y1="386.075" x2="728.613" y2="486.925" gradientUnits="userSpaceOnUse" spreadMethod="reflect" id="w12fill-wid4-5"><stop offset="0" stop-color="#D854CB"/><stop offset="0.13" stop-color="#D854CB"/><stop offset="1" stop-color="#A266E4"/></linearGradient><clipPath id="w12clip-wid4-6"><rect x="-5" y="-5" width="105" height="69"/></clipPath><clipPath id="w12clip-wid4-7"><rect x="0" y="0" width="98" height="63"/></clipPath></defs><g clip-path="url(#w12clip-wid4-2)" transform="translate(-629 -380)"><g clip-path="url(#w12clip-wid4-3)" filter="url(#w12fxc0)" transform="translate(628 379)"><g clip-path="url(#w12clip-wid4-4)"><path d="M18.97 46.5177C18.97 31.4582 31.1781 19.25 46.2377 19.25L96.7623 19.25C111.822 19.25 124.03 31.4582 124.03 46.5177L124.03 68.4823C124.03 83.5418 111.822 95.75 96.7623 95.75L46.2377 95.75C31.1781 95.75 18.97 83.5418 18.97 68.4823Z" fill="#FF0000" fill-rule="evenodd"/></g></g><path d="M648 425.733C648 410.969 659.969 399 674.733 399L724.267 399C739.031 399 751 410.969 751 425.733L751 447.267C751 462.031 739.031 474 724.267 474L674.733 474C659.969 474 648 462.031 648 447.267Z" fill="url(#w12fill-wid4-5)" fill-rule="evenodd"/><g clip-path="url(#w12clip-wid4-6)" filter="url(#w12fxc1)" transform="translate(653 407)"><g clip-path="url(#w12clip-wid4-7)"><path d="M17.3857 45.3857C24.6516 31.6825 31.9177 17.9794 39.5617 17.3963 47.2057 16.8131 56.4457 40.5542 63.2497 41.887 70.0537 43.2198 79.3357 31.3285 80.3857 25.3933" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" stroke-miterlimit="8" fill="none" fill-rule="evenodd"/></g></g><path d="M668.5 450.5C675.766 436.797 683.032 423.094 690.676 422.511 698.32 421.928 707.56 445.669 714.364 447.001 721.168 448.334 730.45 436.443 731.5 430.508" stroke="#FFFFFF" stroke-width="8.66667" stroke-linecap="round" stroke-miterlimit="8" fill="none" fill-rule="evenodd"/></g></svg>
      </button>
    </div>

    <!-- 运行窗口任务胶囊（1:1：每窗 38px，渐变指示条，min 时图标弹跳收起） -->
    <div class="w12-taskbar" :class="{ on: tasks.length > 0 }">
      <a v-for="w in tasks" :key="w.id" class="w12-tapp"
        :class="{ foc: store.activeId === w.id && !w.minimized && !w.minimizing, min: w.minimized || w.minimizing }"
        :title="w.title" @click.stop="clickWin(w)">
        <AppIcon :name="w.icon" :size="26" />
      </a>
    </div>

    <!-- 主题切换：白天=太阳 / 夜间=月亮，居中交叉淡化 -->
    <div class="w12-dock">
      <button class="w12-dockbtn w12-themebtn" :class="{ dk: session.dark }" title="切换白天/夜间" @click.stop="toggleTheme">
        <svg class="sun" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="4.4" fill="currentColor"/>
          <g stroke="currentColor" stroke-width="1.9" stroke-linecap="round">
            <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7"/>
          </g>
        </svg>
        <svg class="moon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" fill="currentColor"/>
        </svg>
      </button>
    </div>

    <!-- 控制中心（电池）胶囊：铃铛 + wifi + 蓝牙 + 电池 -->
    <div class="w12-dock">
      <button class="w12-dockbtn w12-ctrlbtn" :class="{ show: panel === 'ctrl' || notify.open }" title="控制中心" @click.stop="openPanel('ctrl')" ref="ctrlBtn">
        <span class="sico" title="通知" @click.stop="openNotify">
          <svg viewBox="0 0 24 24" fill="none"><path d="M6 9.5a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 19.5a2.2 2.2 0 0 0 4 0" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>
          <span v-if="notify.unread" class="w12-bell-badge">{{ notify.unread > 99 ? '99+' : notify.unread }}</span>
        </span>
        <span class="sico" title="WLAN">
          <svg viewBox="0 0 24 24" fill="none"><path d="M4 9.5a12 12 0 0 1 16 0M7 13a8 8 0 0 1 10 0M10 16.4a4 4 0 0 1 4 0" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="12" cy="19" r="1" fill="currentColor"/></svg>
        </span>
        <svg class="batt" viewBox="1 7 29 15" width="28" height="14">
          <path d="M4 7 C2.355 7 1 8.355 1 10 L1 19 C1 20.645 2.355 22 4 22 L24 22 C25.645 22 27 20.645 27 19 L27 10 C27 8.355 25.645 7 24 7 L4 7 Z M4 9 L24 9 C24.565 9 25 9.435 25 10 L25 19 C25 19.565 24.565 20 24 20 L4 20 C3.435 20 3 19.565 3 19 L3 10 C3 9.435 3.435 9 4 9 Z" fill="currentColor" fill-rule="evenodd"/>
          <rect x="5" y="11" :width="18 * battery" height="7" fill="currentColor"/>
        </svg>
      </button>
    </div>

    <!-- 日期胶囊（1:1：占满 40px 栏高，时间两行 + 翻面） -->
    <div class="w12-dock w12-datedock">
      <button class="w12-datebtn" :class="{ show: panel === 'datebox' }" title="日期和时间" @click.stop="openPanel('datebox')" ref="dateBtn">
        <p class="t">{{ clock }}</p>
        <p class="d">{{ date }}</p>
        <span class="chev">
          <svg width="10" height="10" viewBox="0 0 16 16"><path d="M3.5 6L8 10.5 12.5 6" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
      </button>
    </div>
  </div>

  <!-- dock 收起时的弹跳提示（1:1） -->
  <button class="w12-opendock" :class="{ on: dockHidden && !peek }" @click="peek = true" title="显示任务栏">
    <svg width="16" height="16" viewBox="0 0 16 16"><path d="M2.5 11.5L8 6l5.5 5.5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>

  <!-- 面板 -->
  <WinStartMenu v-if="panel === 'start'" :shown="shown" @close="closePanel" @search="openPanel('search')" />
  <WinSearchWin v-if="panel === 'search'" :shown="shown" @close="closePanel" />
  <WinWidgets v-if="panel === 'widgets'" :shown="shown" @close="closePanel" />
  <WinControl v-if="panel === 'ctrl'" :shown="shown" :left="ctrlLeft" @click.stop @close="closePanel" />
  <WinDateBox v-if="panel === 'datebox'" :shown="shown" :left="dateLeft" @click.stop />


  <!-- 通知中心 -->
  <div v-if="notify.open" class="notify-panel" @click.stop>
    <div class="np-head">
      <span>通知</span>
      <div class="np-actions">
        <button v-if="notify.unread" class="np-all" @click="notify.markAll()">全部已读</button>
        <button v-if="notify.list.length" class="np-all np-clear" @click="notify.clear()">清除</button>
      </div>
    </div>
    <div class="np-body">
      <div v-if="!notify.list.length" class="np-empty">暂无通知</div>
      <div v-for="n in notify.list" :key="n.id" class="np-item" :class="{ unread: !n.read }" @click="notify.markRead(n.id)">
        <div class="np-title">
          <AppIcon :name="n.type === 'task' ? 'cloud' : n.type === 'quota' ? 'drive' : 'info'" :size="15" />
          <span>{{ n.title }}</span>
        </div>
        <div class="np-content">{{ n.content }}</div>
        <div class="np-time">{{ fmtTime(n.createdAt) }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useWindows, type WinState } from '../../stores/windows'
import { useSession } from '../../stores/session'
import { useNotify } from '../../stores/notify'
import AppIcon from '../../components/AppIcon.vue'
import WinStartMenu from './WinStartMenu.vue'
import WinSearchWin from './WinSearchWin.vue'
import WinWidgets from './WinWidgets.vue'
import WinControl from './WinControl.vue'
import WinDateBox from './WinDateBox.vue'

const store = useWindows()
const session = useSession()
const notify = useNotify()

type PanelId = 'start' | 'search' | 'widgets' | 'ctrl' | 'datebox'
const panel = ref<PanelId | null>(null)
const shown = ref(false)
let closeTimer: number

function openPanel(p: PanelId) {
  if (panel.value === p) { closePanel(); return }
  window.clearTimeout(closeTimer)
  panel.value = p
  shown.value = false
  if (p === 'ctrl' || p === 'datebox') positionPanel(p)
  setTimeout(() => (shown.value = true), 20)
}
function closePanel() {
  if (!panel.value) return
  shown.value = false
  const p = panel.value
  closeTimer = window.setTimeout(() => { if (panel.value === p) panel.value = null }, 220)
}

// 1:1：ctrl/datebox 面板在对应 dock 按钮上方展开（left = 按钮 - 123/-125）
const ctrlLeft = ref(0)
const dateLeft = ref(0)
function positionPanel(p: PanelId) {
  const el = (p === 'ctrl' ? (ctrlBtn.value as any)?.$el : (dateBtn.value as any)?.$el) as HTMLElement | null
  const btn = el?.querySelector('button') || el
  const r = (btn as HTMLElement)?.getBoundingClientRect()
  const W = 350
  const left = r ? Math.max(10, Math.min(window.innerWidth - W - 10, r.left + r.width / 2 - W / 2)) : window.innerWidth - W - 20
  if (p === 'ctrl') ctrlLeft.value = left
  else dateLeft.value = left
}
const ctrlBtn = ref<any>(null)
const dateBtn = ref<any>(null)

// dock 自动收起：有全屏（最大化）窗口且无面板时收起；鼠标贴近底部 60px 回弹（1:1）
const peek = ref(false)
const dockHidden = computed(() =>
  store.wins.some(w => w.maximized) && !peek.value && panel.value === null)
function onMove(e: MouseEvent) { peek.value = e.clientY > window.innerHeight - 60 }

const tasks = computed(() => store.taskbarWins)
function clickWin(w: WinState) {
  if (store.activeId === w.id && !w.minimized) store.minimize(w.id)
  else store.focus(w.id)
}

const clock = ref('')
const date = ref('')
function tick() {
  const d = new Date()
  clock.value = d.toTimeString().slice(0, 8)
  date.value = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}
let timer: number
onMounted(() => {
  tick(); timer = setInterval(tick, 1000)
  document.addEventListener('click', onGlobalClick)
  document.addEventListener('mousemove', onMove)
  notify.startPolling()
  getBattery()
})
onBeforeUnmount(() => {
  clearInterval(timer)
  window.clearTimeout(closeTimer)
  document.removeEventListener('click', onGlobalClick)
  document.removeEventListener('mousemove', onMove)
  notify.stopPolling()
})
function onGlobalClick() { closePanel(); notify.close() }

// 电池（1:1：navigator.getBattery，不支持则显示满电）
const battery = ref(1)
function getBattery() {
  const nb = (navigator as any).getBattery
  if (typeof nb !== 'function') return
  nb.call(navigator).then((b: any) => {
    const upd = () => (battery.value = Math.max(0.05, b.level))
    upd()
    b.addEventListener?.('levelchange', upd)
  }).catch(() => {})
}

// 铃铛 = 直接开/关通知中心（Win11 同款；通知面板由 store 的 open 驱动，不走本地 panel 状态）
function openNotify() {
  if (notify.open) { notify.close(); return }
  closePanel()
  notify.openPanel()
}

function toggleTheme() { session.setDark(!session.dark) }
function fmtTime(s: string) {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<style>
/* 铃铛未读角标（w12 专属，避免全局泄漏） */
.w12-bell-badge {
  position: absolute; top: -2px; right: -4px;
  min-width: 14px; height: 14px; padding: 0 3px; border-radius: 7px;
  background: var(--danger); color: #fff; font-size: 9px; font-weight: 600;
  line-height: 14px; text-align: center;
}
.w12-ctrlbtn .sico { position: relative; display: flex; }
</style>
