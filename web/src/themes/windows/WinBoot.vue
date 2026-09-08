<template>
  <!-- 阶段一：BIOS 启动（boot.html 1:1：dos 字体 + Starting + 双进度条 + F2 提示） -->
  <div v-if="stage === 0" class="w12-bios">
    <div class="w12-bios-info">
      <div class="w12-bios-loading">
        <p>Starting</p>
        <div class="w12-bios-track">
          <div class="w12-bios-load" :style="{ width: loadW + 'px' }"></div>
          <div class="w12-bios-back" :style="{ width: backW + 'px' }"></div>
        </div>
      </div>
      <p class="w12-bios-hint">Press F2 or touch screen to enter SETUP</p>
    </div>
  </div>

  <!-- 阶段二：#loadback（desktop.html 1:1：彩色花朵 logo + 转环，随后淡出进登录） -->
  <div v-else class="w12-loadback" :class="{ hide: fading }">
    <svg class="w12-lb-logo" :class="{ on: logoOn }" viewBox="21,18,320,315" width="250" height="250" xmlns="http://www.w3.org/2000/svg" overflow="hidden">
      <defs>
        <filter id="w12fx0" x="-10%" y="-10%" width="120%" height="120%" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse"><feComponentTransfer color-interpolation-filters="sRGB"><feFuncR type="discrete" tableValues="0 0"/><feFuncG type="discrete" tableValues="0 0"/><feFuncB type="discrete" tableValues="0 0"/><feFuncA type="linear" slope="0.4" intercept="0"/></feComponentTransfer><feGaussianBlur stdDeviation="5.81006 5.77778"/></filter>
        <filter id="w12fx1" x="-10%" y="-10%" width="120%" height="120%" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse"><feComponentTransfer color-interpolation-filters="sRGB"><feFuncR type="discrete" tableValues="0 0"/><feFuncG type="discrete" tableValues="0 0"/><feFuncB type="discrete" tableValues="0 0"/><feFuncA type="linear" slope="0.4" intercept="0"/></feComponentTransfer><feGaussianBlur stdDeviation="5.77778 5.77778"/></filter>
        <filter id="w12fx2" x="-10%" y="-10%" width="120%" height="120%" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse"><feComponentTransfer color-interpolation-filters="sRGB"><feFuncR type="discrete" tableValues="0 0"/><feFuncG type="discrete" tableValues="0 0"/><feFuncB type="discrete" tableValues="0 0"/><feFuncA type="linear" slope="0.4" intercept="0"/></feComponentTransfer><feGaussianBlur stdDeviation="7.36593 7.36776"/></filter>
        <filter id="w12fx3" x="-10%" y="-10%" width="120%" height="120%" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse"><feComponentTransfer color-interpolation-filters="sRGB"><feFuncR type="discrete" tableValues="0 0"/><feFuncG type="discrete" tableValues="0 0"/><feFuncB type="discrete" tableValues="0 0"/><feFuncA type="linear" slope="0.521569" intercept="0"/></feComponentTransfer><feGaussianBlur stdDeviation="6 6"/></filter>
        <clipPath id="w12clip4"><rect x="468" y="169" width="362" height="356"/></clipPath>
        <clipPath id="w12clip5"><rect x="-6.53632" y="-6.5" width="101.061" height="108"/></clipPath>
        <clipPath id="w12clip6"><rect x="0" y="0" width="90" height="95"/></clipPath>
        <linearGradient x1="525.053" y1="357.279" x2="645.947" y2="458.721" gradientUnits="userSpaceOnUse" spreadMethod="reflect" id="w12fill7"><stop offset="0" stop-color="#775CFE"/><stop offset="0.18" stop-color="#775CFE"/><stop offset="0.83" stop-color="#2473DC"/><stop offset="1" stop-color="#2473DC"/></linearGradient>
        <clipPath id="w12clip8"><rect x="-6.5" y="-6.5" width="125" height="115"/></clipPath>
        <clipPath id="w12clip9"><rect x="0" y="0" width="112" height="105"/></clipPath>
        <linearGradient x1="511.623" y1="213.086" x2="642.377" y2="368.914" gradientUnits="userSpaceOnUse" spreadMethod="reflect" id="w12fill10"><stop offset="0" stop-color="#C45DD5"/><stop offset="0.18" stop-color="#C45DD5"/><stop offset="0.69" stop-color="#A266E4"/><stop offset="1" stop-color="#A266E4"/></linearGradient>
        <clipPath id="w12clip11"><rect x="-7.53336" y="-7.53522" width="128.067" height="124.08"/></clipPath>
        <clipPath id="w12clip12"><rect x="0" y="0" width="113" height="107"/></clipPath>
        <linearGradient x1="617.245" y1="376.897" x2="771.755" y2="466.103" gradientUnits="userSpaceOnUse" spreadMethod="reflect" id="w12fill13"><stop offset="0" stop-color="#61A2F9"/><stop offset="0.18" stop-color="#61A2F9"/><stop offset="0.91" stop-color="#3159D7"/><stop offset="1" stop-color="#3159D7"/></linearGradient>
        <clipPath id="w12clip14"><rect x="-6.5" y="-6.5" width="130" height="137"/></clipPath>
        <clipPath id="w12clip15"><rect x="0" y="0" width="118" height="124"/></clipPath>
        <linearGradient x1="643.458" y1="199.26" x2="791.542" y2="375.74" gradientUnits="userSpaceOnUse" spreadMethod="reflect" id="w12fill16"><stop offset="0" stop-color="#8A66FE"/><stop offset="0.19" stop-color="#8A66FE"/><stop offset="1" stop-color="#2473DC"/></linearGradient>
      </defs>
      <g clip-path="url(#w12clip4)" transform="translate(-468 -169)">
        <g clip-path="url(#w12clip5)" filter="url(#w12fx0)" transform="matrix(1.98889 0 0 2 499 310)"><g clip-path="url(#w12clip6)"><path d="M71.8132 77.0858 26.981 77.0858C22.0288 77.0858 18.0143 73.1038 18.0143 68.1917L18.0143 19.9983C27.6747 18.8595 31.5867 17.632 40.5532 18.2527 49.5197 18.8734 62.1334 21.5426 71.8132 23.7225L71.8132 77.0858Z" fill="#FF0000" fill-rule="evenodd"/></g></g>
        <path d="M639 467 549.834 467C539.984 467 532 459.036 532 449.212L532 352.825C551.213 350.547 558.994 348.093 576.827 349.334 594.661 350.575 619.748 355.914 639 360.273L639 467Z" fill="url(#w12fill7)" fill-rule="evenodd"/>
        <g clip-path="url(#w12clip8)" filter="url(#w12fx1)" transform="matrix(2 0 0 2 468 189)"><g clip-path="url(#w12clip9)"><path d="M17.9142 86.9142 17.9142 29.4144C17.9142 23.063 23.0408 17.9142 29.3649 17.9142L87.6795 17.9142C91.3242 35.2574 94.0833 41.1006 93.9062 52.6006 93.729 64.1006 89.0466 75.4763 86.6168 86.9142 70.0706 84.6993 65.4194 82.6717 53.5245 82.4844 41.5652 82.296 29.7843 85.4376 17.9142 86.9142Z" fill="#FF0000" fill-rule="evenodd"/></g></g>
        <path d="M501 360 501 245C501 232.298 511.253 222 523.901 222L640.531 222C647.82 256.686 653.338 268.373 652.984 291.373 652.63 314.373 643.265 337.124 638.405 360 605.313 355.57 596.01 351.515 572.221 351.14 548.302 350.764 524.74 357.047 501 360Z" fill="url(#w12fill10)" fill-rule="evenodd"/>
        <g clip-path="url(#w12clip11)" filter="url(#w12fx2)" transform="matrix(1.99115 0 0 1.99065 579 312)"><g clip-path="url(#w12clip12)"><path d="M90.4862 22.6918 90.4862 74.1822C90.4862 79.8698 85.8764 84.4806 80.1899 84.4806L28.7099 84.4806C25.6989 69.2628 22.7773 68.0805 22.6877 54.0451 22.5938 39.3223 26.7026 33.1429 28.7099 22.6918L90.4862 22.6918Z" fill="#FF0000" fill-rule="evenodd"/></g></g>
        <path d="M762 360 762 462.5C762 473.822 752.821 483 741.499 483L638.994 483C632.999 452.707 627.181 450.353 627.003 422.414 626.816 393.105 634.997 380.805 638.994 360L762 360Z" fill="url(#w12fill13)" fill-rule="evenodd"/>
        <g clip-path="url(#w12clip14)" filter="url(#w12fx3)" transform="matrix(2 0 0 2 594 169)"><g clip-path="url(#w12clip15)"><path d="M18.7308 18.4142 86.1097 18.4142C93.5523 18.4142 99.5858 24.4663 99.5858 31.932L99.5858 99.5195C79.053 102.327 71.9105 106.654 58.5202 105.134L18.7308 99.5195C21.1161 80.9213 23.4541 75.8406 23.5014 62.3231 23.5527 47.6868 20.321 33.0505 18.7308 18.4142Z" fill="#FF0000" fill-rule="evenodd"/></g></g>
        <path d="M639 203 769.833 203C784.285 203 796 214.752 796 229.248L796 360.486C756.13 365.937 742.262 374.34 716.261 371.389L639 360.486C643.632 324.373 648.171 314.508 648.263 288.26 648.363 259.84 642.088 231.42 639 203Z" fill="url(#w12fill16)" fill-rule="evenodd"/>
      </g>
    </svg>
    <svg class="w12-lb-spin" :class="{ on: logoOn }" width="50" height="50" viewBox="0 0 16 16">
      <circle cx="8px" cy="8px" r="7px" style="stroke: #ffffff30; fill: none; stroke-width: 2px;"></circle>
      <circle cx="8px" cy="8px" r="7px"></circle>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
// 阶段一 = boot.html（BIOS 双进度条，20 步 × 300ms，步长曲线 [0,0,1,3,7,17,20]）
// 阶段二 = desktop.html #loadback（花朵 logo + 转环，~1.3s 后淡出进登录）
const stage = ref(0)
const loadW = ref(0)
const backW = ref(400)
const logoOn = ref(false)
const fading = ref(false)

onMounted(() => {
  const progress = [0, 0, 1, 3, 7, 17, 20]
  let i = 0
  const timer = window.setInterval(() => {
    setProgress(progress[i])
    i++
    if (i >= progress.length) {
      window.clearInterval(timer)
      stage.value = 1
      window.setTimeout(() => (logoOn.value = true), 100)
      window.setTimeout(() => (fading.value = true), 1500)
      window.setTimeout(() => router.replace('/login'), 1800)
    }
  }, 300)
})

function setProgress(n: number) {
  loadW.value = (400 / 20) * n
  backW.value = (400 / 20) * (20 - n)
}
</script>
