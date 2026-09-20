// 天气共享工具：城市表 + WMO 码映射 + 风向（从 WxCard 抽出，桌面卡/日历天气条/小组件共用）
export interface City { name: string; lat: number; lon: number }

export const CITIES: City[] = [
  { name: '北京', lat: 39.9042, lon: 116.4074 },
  { name: '上海', lat: 31.2304, lon: 121.4737 },
  { name: '广州', lat: 23.1291, lon: 113.2644 },
  { name: '深圳', lat: 22.5431, lon: 114.0579 },
  { name: '成都', lat: 30.5728, lon: 104.0668 },
  { name: '杭州', lat: 30.2741, lon: 120.1551 },
  { name: '西安', lat: 34.3416, lon: 108.9398 },
  { name: '哈尔滨', lat: 45.8038, lon: 126.535 }
]

// WMO 天气码 → 中文（Open-Meteo weather_code）
export const WMO: Record<number, string> = { 0: '晴', 1: '大致晴', 2: '多云', 3: '阴', 45: '雾', 48: '雾凇', 51: '毛毛雨', 53: '毛毛雨', 55: '毛毛雨', 61: '小雨', 63: '中雨', 65: '大雨', 66: '冻雨', 67: '冻雨', 71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒', 80: '阵雨', 81: '阵雨', 82: '强阵雨', 85: '阵雪', 86: '阵雪', 95: '雷雨', 96: '雷雨冰雹', 99: '雷雨冰雹' }

export function wmoIcon(code: number, hour?: number): string {
  const night = hour != null && (hour < 6 || hour >= 19)
  if (code === 0) return night ? '🌙' : '☀️'
  if (code <= 2) return code === 1 ? '🌤️' : '⛅'
  if (code === 3) return '☁️'
  if (code >= 45 && code <= 48) return '🌫️'
  if (code >= 71 && code <= 77) return '🌨️'
  if (code >= 80 && code <= 86) return '🌦️'
  if (code >= 95) return '⛈️'
  return '🌧️'
}

export const WIND8 = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']

export function windDir(deg: number): string {
  return WIND8[Math.round(deg / 45) % 8]
}
