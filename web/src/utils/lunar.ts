// 农历/节气/法定节假日工具（lunar-typescript，6tail 算法）：
// 时钟/日历小组件共用。法定节假日含调休（班/休），数据内置到近年，查不到则静默降级。
import { Solar, HolidayUtil } from 'lunar-typescript'

export interface DayInfo {
  y: number; m: number; d: number
  /** 0=周日 … 6=周六 */
  weekday: number
  /** 农历短名：八月初八 */
  lunarShort: string
  /** 干支+生肖：丙午（马）年 */
  ganzhi: string
  /** 节日名（优先级：法定节假日 > 农历节日 > 节气），无则为 '' */
  label: string
  /** 标签类型：holiday=法定假日(休) work=调休(班) fest=传统节日 jieqi=节气，无则 '' */
  labelKind: 'holiday' | 'work' | 'fest' | 'jieqi' | ''
  isWeekend: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')
const cache = new Map<number, Map<string, { name: string; work: boolean }>>()

// 按年惰性加载法定节假日表（含调休）；越界年份返回空
function holidayOf(y: number, m: number, d: number): { name: string; work: boolean } | undefined {
  let table = cache.get(y)
  if (!table) {
    table = new Map()
    try {
      for (const h of (HolidayUtil.getHolidays(y) || [])) {
        table.set(h._day, { name: h._name, work: h._work })
      }
    } catch { /* 该年无内置数据 */ }
    cache.set(y, table)
  }
  return table.get(`${y}-${pad(m)}-${pad(d)}`)
}

export function dayInfo(dt: Date): DayInfo {
  const y = dt.getFullYear(), m = dt.getMonth() + 1, d = dt.getDate()
  const solar = Solar.fromYmdHms(y, m, d, 0, 0, 0)
  const lunar = solar.getLunar()
  const lunarShort = lunar.getMonthInChinese() + '月' + lunar.getDayInChinese()
  const ganzhi = `${lunar.getYearInGanZhi()}（${lunar.getYearShengXiao()}）年`
  const weekday = dt.getDay()
  const isWeekend = weekday === 0 || weekday === 6

  const h = holidayOf(y, m, d)
  const fests = lunar.getFestivals() || []
  const jq = lunar.getJieQi() || ''

  let label = ''
  let labelKind: DayInfo['labelKind'] = ''
  if (h) {
    label = h.name
    labelKind = h.work ? 'work' : 'holiday'
  } else if (fests.length) {
    label = fests[0]
    labelKind = 'fest'
  } else if (jq) {
    label = jq
    labelKind = 'jieqi'
  }
  return { y, m, d, weekday, lunarShort, ganzhi, label, labelKind, isWeekend }
}

export const WEEKDAYS_CN = ['日', '一', '二', '三', '四', '五', '六']
