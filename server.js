/**
 * Vietjet Air Demo - Backend Server (Node.js)
 * Features:
 * - Loads environment variables from .env (OPENWEATHER_API_KEY) without hardcoding
 * - Serves static frontend files (index.html, style.css, script.js, images/)
 * - GET /api/weather?city=<city_name>  : Current weather via Open-Meteo API
 * - GET /api/forecast?city=<city_name> : 5-day weather forecast via OpenWeatherMap API
 * - Handles city not found (404) and slow API / timeout responses (504)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const dns = require('dns');

// Prioritize IPv4 to avoid dual-stack DNS lookup delays on Windows
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

/**
 * Load environment variables from .env file into process.env
 */
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;

  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(envPath);
      return;
    }
  } catch (_) {
    // Fallback to manual parsing below
  }

  try {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) return;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key && process.env[key] === undefined) {
        process.env[key] = val;
      }
    });
  } catch (err) {
    console.error('[Env Loader Error]:', err.message);
  }
}

loadEnvFile();

const PORT = process.env.PORT || 3000;
const API_TIMEOUT_MS = 6000; // 6 seconds timeout for upstream weather API calls

// Common Vietnamese city aliases & airport IATA codes mapping
const CITY_ALIASES = {
  sgn: 'Hồ Chí Minh',
  hcm: 'Hồ Chí Minh',
  tphcm: 'Hồ Chí Minh',
  'tp.hcm': 'Hồ Chí Minh',
  'tp hcm': 'Hồ Chí Minh',
  'tp. hồ chí minh': 'Hồ Chí Minh',
  'tp hồ chí minh': 'Hồ Chí Minh',
  'thành phố hồ chí minh': 'Hồ Chí Minh',
  'sài gòn': 'Hồ Chí Minh',
  'sai gon': 'Hồ Chí Minh',
  saigon: 'Hồ Chí Minh',
  han: 'Hà Nội',
  'ha noi': 'Hà Nội',
  hanoi: 'Hà Nội',
  dad: 'Đà Nẵng',
  'da nang': 'Đà Nẵng',
  danang: 'Đà Nẵng',
  pqc: 'Phú Quốc',
  'phu quoc': 'Phú Quốc',
  phuquoc: 'Phú Quốc',
  cxr: 'Nha Trang',
  'nha trang': 'Nha Trang',
  nhatrang: 'Nha Trang',
  dli: 'Đà Lạt',
  'da lat': 'Đà Lạt',
  dalat: 'Đà Lạt',
  hph: 'Hải Phòng',
  'hai phong': 'Hải Phòng',
  hui: 'Huế',
  hue: 'Huế',
  vca: 'Cần Thơ',
  'can tho': 'Cần Thơ'
};

// Specific query mapping for OpenWeatherMap direct query compatibility
const OPENWEATHER_CITY_MAP = {
  'hồ chí minh': 'Thành phố Hồ Chí Minh',
  'phú quốc': 'Duong Dong',
  'đà lạt': 'Dalat'
};

/**
 * Normalize user input city name before querying weather APIs
 * @param {string} rawCity
 * @returns {string}
 */
function normalizeCityName(rawCity) {
  if (!rawCity || typeof rawCity !== 'string') return '';

  // Remove parenthetical airport code if passed like "TP. Hồ Chí Minh (SGN)"
  let cleaned = rawCity.replace(/\([A-Z]{3}\)/gi, '').trim();

  const lower = cleaned.toLowerCase();
  if (CITY_ALIASES[lower]) {
    return CITY_ALIASES[lower];
  }

  // Strip prefixes like "TP.", "TP ", "T.P.", "Thành phố " that geocoders may reject
  cleaned = cleaned
    .replace(/^(tp\.|tp\s+|t\.p\.\s*|thành phố\s+|thanh pho\s+)/i, '')
    .trim();

  const lowerCleaned = cleaned.toLowerCase();
  if (CITY_ALIASES[lowerCleaned]) {
    return CITY_ALIASES[lowerCleaned];
  }

  return cleaned;
}

/**
 * Map Open-Meteo WMO Weather interpretation codes (WW) to concise Vietnamese descriptions & icons
 * @param {number} code - WMO weather code
 * @param {number} isDay - 1 for day, 0 for night
 */
function mapWeatherCode(code, isDay = 1) {
  const weatherMap = {
    0: {
      description: isDay ? 'Trời quang đãng, nắng đẹp' : 'Trời quang đãng, mát mẻ',
      icon: isDay ? 'bi-brightness-high-fill' : 'bi-moon-stars-fill',
      flightNote: 'Thời tiết lý tưởng cho chuyến bay và tham quan'
    },
    1: {
      description: isDay ? 'Trời ít mây, nắng nhẹ' : 'Trời ít mây',
      icon: isDay ? 'bi-cloud-sun-fill' : 'bi-cloud-moon-fill',
      flightNote: 'Thời tiết đẹp, rất thuận lợi để di chuyển'
    },
    2: {
      description: 'Trời có mây rải rác',
      icon: isDay ? 'bi-cloud-sun-fill' : 'bi-cloud-moon-fill',
      flightNote: 'Thời tiết dịu mát, thuận lợi cho hành trình bay'
    },
    3: {
      description: 'Trời nhiều mây, âm u',
      icon: 'bi-clouds-fill',
      flightNote: 'Trời râm mát, hoạt động bay diễn ra bình thường'
    },
    45: {
      description: 'Có sương mù nhẹ',
      icon: 'bi-cloud-fog2-fill',
      flightNote: 'Lưu ý tầm nhìn khi di chuyển ra sân bay'
    },
    48: {
      description: 'Sương mù dày đặc',
      icon: 'bi-cloud-fog2-fill',
      flightNote: 'Lưu ý giữ ấm và chủ động thời gian ra sân bay'
    },
    51: {
      description: 'Mưa phùn nhẹ',
      icon: 'bi-cloud-drizzle-fill',
      flightNote: 'Nên chuẩn bị ô hoặc áo khoác nhẹ khi ra ngoài'
    },
    53: {
      description: 'Mưa phùn rải rác',
      icon: 'bi-cloud-drizzle-fill',
      flightNote: 'Nên mang theo ô/dù khi di chuyển'
    },
    55: {
      description: 'Mưa phùn nặng hạt',
      icon: 'bi-cloud-drizzle-fill',
      flightNote: 'Nên chuẩn bị áo mưa/ô và ra sân bay sớm hơn'
    },
    56: {
      description: 'Mưa phùn lạnh',
      icon: 'bi-cloud-sleet-fill',
      flightNote: 'Thời tiết lạnh ẩm, lưu ý giữ ấm cơ thể'
    },
    57: {
      description: 'Mưa phùn lạnh dày hạt',
      icon: 'bi-cloud-sleet-fill',
      flightNote: 'Thời tiết lạnh ẩm, lưu ý giữ ấm cơ thể'
    },
    61: {
      description: 'Mưa nhỏ rải rác',
      icon: 'bi-cloud-rain-fill',
      flightNote: 'Nhớ mang theo ô/dù khi di chuyển tới sân bay'
    },
    63: {
      description: 'Có mưa vừa',
      icon: 'bi-cloud-rain-fill',
      flightNote: 'Chủ động di chuyển sớm để tránh ùn tắc giao thông'
    },
    65: {
      description: 'Mưa to',
      icon: 'bi-cloud-rain-heavy-fill',
      flightNote: 'Mưa lớn, quý khách nên trừ hao thời gian di chuyển ra sân bay'
    },
    66: {
      description: 'Mưa lạnh nhẹ',
      icon: 'bi-cloud-sleet-fill',
      flightNote: 'Lưu ý mặc ấm và mang theo ô'
    },
    67: {
      description: 'Mưa lạnh nặng hạt',
      icon: 'bi-cloud-sleet-fill',
      flightNote: 'Lưu ý mặc ấm và theo dõi cập nhật chuyến bay'
    },
    71: {
      description: 'Tuyết rơi nhẹ',
      icon: 'bi-snow',
      flightNote: 'Thời tiết lạnh giá, hãy chuẩn bị trang phục giữ nhiệt'
    },
    73: {
      description: 'Tuyết rơi vừa',
      icon: 'bi-snow2',
      flightNote: 'Thời tiết có tuyết, lưu ý giữ ấm và kiểm tra giờ bay'
    },
    75: {
      description: 'Tuyết rơi dày',
      icon: 'bi-snow3',
      flightNote: 'Tuyết rơi dày, quý khách lưu ý theo dõi thông báo chuyến bay'
    },
    77: {
      description: 'Mưa tuyết hạt',
      icon: 'bi-snow',
      flightNote: 'Lưu ý giữ ấm khi hạ cánh'
    },
    80: {
      description: 'Mưa rào nhẹ rải rác',
      icon: 'bi-cloud-rain-fill',
      flightNote: 'Mưa rào thoáng qua, nên mang theo ô gấp gọn'
    },
    81: {
      description: 'Mưa rào vừa',
      icon: 'bi-cloud-rain-heavy-fill',
      flightNote: 'Có mưa rào, quý khách lưu ý đặt xe sớm khi ra sân bay'
    },
    82: {
      description: 'Mưa rào lớn',
      icon: 'bi-cloud-rain-heavy-fill',
      flightNote: 'Mưa rào nặng hạt, nên chủ động thời gian di chuyển'
    },
    85: {
      description: 'Mưa tuyết rào nhẹ',
      icon: 'bi-cloud-snow-fill',
      flightNote: 'Lưu ý trang phục giữ ấm'
    },
    86: {
      description: 'Mưa tuyết rào mạnh',
      icon: 'bi-cloud-snow-fill',
      flightNote: 'Lưu ý trang phục giữ ấm và theo dõi lịch bay'
    },
    95: {
      description: 'Có dông và sấm chớp',
      icon: 'bi-cloud-lightning-rain-fill',
      flightNote: 'Thời tiết có dông, quý khách lưu ý theo dõi thông tin chuyến bay'
    },
    96: {
      description: 'Dông kèm mưa đá nhẹ',
      icon: 'bi-cloud-lightning-rain-fill',
      flightNote: 'Thời tiết xấu, vui lòng theo dõi sát thông báo từ hãng bay'
    },
    99: {
      description: 'Dông bão mạnh kèm mưa đá',
      icon: 'bi-cloud-lightning-rain-fill',
      flightNote: 'Thời tiết xấu, vui lòng theo dõi sát thông báo từ hãng bay'
    }
  };

  return (
    weatherMap[code] || {
      description: 'Thời tiết ổn định',
      icon: 'bi-cloud-sun-fill',
      flightNote: 'Thời tiết thuận lợi cho hành trình của bạn'
    }
  );
}

/**
 * Map OpenWeatherMap icon code (e.g. "01d", "10n") to Bootstrap Icon class
 * @param {string} owmIcon
 */
function mapOwmIconToBootstrap(owmIcon = '02d') {
  const prefix = owmIcon.slice(0, 2);
  const isNight = owmIcon.endsWith('n');
  const map = {
    '01': isNight ? 'bi-moon-stars-fill' : 'bi-brightness-high-fill',
    '02': isNight ? 'bi-cloud-moon-fill' : 'bi-cloud-sun-fill',
    '03': 'bi-cloud-fill',
    '04': 'bi-clouds-fill',
    '09': 'bi-cloud-drizzle-fill',
    '10': 'bi-cloud-rain-fill',
    '11': 'bi-cloud-lightning-rain-fill',
    '13': 'bi-snow',
    '50': 'bi-cloud-fog2-fill'
  };
  return map[prefix] || 'bi-cloud-sun-fill';
}

/**
 * Fetch helper with AbortController timeout
 * @param {string} url
 * @param {number} timeoutMs
 */
async function fetchWithTimeout(url, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Vietjet-Weather-Demo/1.0'
      }
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send JSON HTTP response with CORS headers
 */
function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

/**
 * Handle GET /api/weather?city=<city_name> (Current Weather via Open-Meteo)
 */
async function handleWeatherApi(reqUrl, res) {
  const rawCity = reqUrl.searchParams.get('city') || '';
  const simulateDelayMs = parseInt(reqUrl.searchParams.get('delay') || '0', 10);
  const customTimeoutMs = parseInt(reqUrl.searchParams.get('timeout') || String(API_TIMEOUT_MS), 10);

  const normalizedCity = normalizeCityName(rawCity);

  if (!normalizedCity) {
    return sendJson(res, 400, {
      success: false,
      error: 'EMPTY_CITY',
      message: 'Vui lòng nhập tên thành phố để tra cứu thời tiết.'
    });
  }

  try {
    if (simulateDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(simulateDelayMs, 15000)));
    }

    // 1. Call Open-Meteo Geocoding API to resolve coordinates from city name
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      normalizedCity
    )}&count=5&language=vi&format=json`;

    const geoRes = await fetchWithTimeout(geoUrl, customTimeoutMs);
    if (!geoRes.ok) {
      throw new Error(`Geocoding API returned status ${geoRes.status}`);
    }

    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      return sendJson(res, 404, {
        success: false,
        error: 'CITY_NOT_FOUND',
        message: `Không tìm thấy thành phố "${rawCity.trim()}". Vui lòng kiểm tra lại chính tả hoặc thử tên thành phố khác!`
      });
    }

    const location =
      geoData.results.find((item) => item.country_code === 'VN') || geoData.results[0];

    const { latitude, longitude, name, country, admin1 } = location;

    // 2. Call Open-Meteo Weather Forecast API for current weather
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&timezone=auto`;

    const weatherRes = await fetchWithTimeout(weatherUrl, customTimeoutMs);
    if (!weatherRes.ok) {
      throw new Error(`Weather Forecast API returned status ${weatherRes.status}`);
    }

    const weatherData = await weatherRes.json();
    const current = weatherData.current;

    if (!current || typeof current.temperature_2m !== 'number') {
      throw new Error('Dữ liệu thời tiết trả về từ Open-Meteo không hợp lệ.');
    }

    const tempUnit = weatherData.current_units?.temperature_2m || '°C';
    const windUnit = weatherData.current_units?.wind_speed_10m || 'km/h';
    const humidityUnit = weatherData.current_units?.relative_humidity_2m || '%';

    const mappedWeather = mapWeatherCode(current.weather_code, current.is_day);

    return sendJson(res, 200, {
      success: true,
      query: rawCity.trim(),
      city: name,
      admin1: admin1 || '',
      country: country || '',
      coordinates: {
        latitude,
        longitude
      },
      temperature: current.temperature_2m,
      temperatureUnit: tempUnit,
      formattedTemperature: `${Math.round(current.temperature_2m)}${tempUnit}`,
      exactTemperature: `${current.temperature_2m}${tempUnit}`,
      apparentTemperature: `${Math.round(current.apparent_temperature)}${tempUnit}`,
      humidity: `${current.relative_humidity_2m}${humidityUnit}`,
      windSpeed: `${current.wind_speed_10m} ${windUnit}`,
      weatherCode: current.weather_code,
      isDay: current.is_day === 1,
      description: mappedWeather.description,
      icon: mappedWeather.icon,
      flightNote: mappedWeather.flightNote,
      updatedAt: current.time
    });
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return sendJson(res, 504, {
        success: false,
        error: 'API_TIMEOUT',
        message:
          'Dịch vụ thời tiết (Open-Meteo) phản hồi quá chậm. Vui lòng kiểm tra kết nối hoặc thử lại sau ít phút!'
      });
    }

    console.error('[Weather API Error]:', err.message);
    return sendJson(res, 502, {
      success: false,
      error: 'UPSTREAM_ERROR',
      message: 'Không thể kết nối đến dịch vụ thời tiết Open-Meteo lúc này. Vui lòng thử lại sau!'
    });
  }
}

/**
 * Aggregate OpenWeatherMap 3-hour forecast slots (40 items) into 5 daily forecast items
 * @param {Array} list - OpenWeatherMap forecast list
 */
function buildFiveDayForecast(list) {
  if (!Array.isArray(list) || list.length === 0) return [];

  const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const groupedByDate = new Map();

  for (const item of list) {
    const dtTxt = item.dt_txt || '';
    const [datePart, timePart] = dtTxt.split(' ');
    if (!datePart) continue;

    if (!groupedByDate.has(datePart)) {
      groupedByDate.set(datePart, []);
    }
    groupedByDate.get(datePart).push({ ...item, timePart });
  }

  const allDates = Array.from(groupedByDate.keys());
  // If OpenWeatherMap spans 6 calendar dates (e.g. today + next 5 days), prefer the 5 upcoming days
  // if today only has 1-2 late slots left, otherwise take 5 days
  let selectedDates = allDates;
  if (allDates.length > 5) {
    const firstDaySlots = groupedByDate.get(allDates[0]) || [];
    selectedDates = firstDaySlots.length <= 2 ? allDates.slice(1, 6) : allDates.slice(0, 5);
  } else {
    selectedDates = allDates.slice(0, 5);
  }

  return selectedDates.map((dateStr) => {
    const slots = groupedByDate.get(dateStr) || [];
    let minTemp = Infinity;
    let maxTemp = -Infinity;

    for (const s of slots) {
      const tMin = typeof s.main?.temp_min === 'number' ? s.main.temp_min : s.main?.temp;
      const tMax = typeof s.main?.temp_max === 'number' ? s.main.temp_max : s.main?.temp;
      if (typeof tMin === 'number' && tMin < minTemp) minTemp = tMin;
      if (typeof tMax === 'number' && tMax > maxTemp) maxTemp = tMax;
    }

    // Pick midday slot (12:00:00 or 09:00:00 or 15:00:00) for representative daytime weather icon & temp
    const representative =
      slots.find((s) => s.timePart === '12:00:00') ||
      slots.find((s) => s.timePart === '09:00:00') ||
      slots.find((s) => s.timePart === '15:00:00') ||
      slots[Math.floor(slots.length / 2)] ||
      slots[0];

    const rawDesc = representative?.weather?.[0]?.description || 'Thời tiết ổn định';
    const description = rawDesc.charAt(0).toUpperCase() + rawDesc.slice(1);

    // Ensure daytime icon variant for daily summary card unless only night slots exist
    const rawIcon = representative?.weather?.[0]?.icon || '02d';
    const iconCode = slots.length > 2 ? rawIcon.replace('n', 'd') : rawIcon;

    const repTemp =
      typeof representative?.main?.temp === 'number'
        ? Math.round(representative.main.temp * 10) / 10
        : Math.round(((minTemp + maxTemp) / 2) * 10) / 10;

    const [year, month, day] = dateStr.split('-');
    const dateObj = new Date(`${dateStr}T00:00:00`);
    const dayOfWeek = dayNames[dateObj.getDay()] || '';

    return {
      date: dateStr,
      formattedDate: `${day}/${month}`,
      fullFormattedDate: `${day}/${month}/${year}`,
      dayOfWeek,
      temperature: repTemp,
      formattedTemperature: `${Math.round(repTemp)}°C`,
      tempMin: Math.round(minTemp),
      tempMax: Math.round(maxTemp),
      formattedRange: `${Math.round(minTemp)}°C - ${Math.round(maxTemp)}°C`,
      humidity: representative?.main?.humidity ? `${representative.main.humidity}%` : '--%',
      description,
      iconCode,
      iconUrl: `https://openweathermap.org/img/wn/${iconCode}@2x.png`,
      bootstrapIcon: mapOwmIconToBootstrap(iconCode)
    };
  });
}

/**
 * Handle GET /api/forecast?city=<city_name> (5-Day Forecast via OpenWeatherMap API)
 */
async function handleForecastApi(reqUrl, res) {
  // Ensure .env is loaded and read OPENWEATHER_API_KEY from environment
  loadEnvFile();
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    return sendJson(res, 500, {
      success: false,
      error: 'MISSING_API_KEY',
      message: 'Chưa cấu hình OPENWEATHER_API_KEY trong file .env ở phía Backend.'
    });
  }

  const rawCity = reqUrl.searchParams.get('city') || '';
  const customTimeoutMs = parseInt(reqUrl.searchParams.get('timeout') || String(API_TIMEOUT_MS), 10);
  const normalizedCity = normalizeCityName(rawCity);

  if (!normalizedCity) {
    return sendJson(res, 400, {
      success: false,
      error: 'EMPTY_CITY',
      message: 'Vui lòng nhập tên thành phố để xem dự báo 5 ngày tới.'
    });
  }

  const owmQueryCity =
    OPENWEATHER_CITY_MAP[normalizedCity.toLowerCase()] || normalizedCity;

  try {
    // 1. Query OpenWeatherMap 5-day / 3-hour forecast API by city name
    let forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(
      owmQueryCity
    )}&units=metric&lang=vi&appid=${encodeURIComponent(apiKey)}`;

    let owmRes = await fetchWithTimeout(forecastUrl, customTimeoutMs);
    let resolvedCityName = normalizedCity;
    let resolvedCountry = '';

    // 2. If direct city name returns 404 (e.g., island/district names like Phú Quốc),
    // fallback to OpenWeatherMap Geocoding API (/geo/1.0/direct) then fetch by lat/lon
    if (owmRes.status === 404) {
      const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
        normalizedCity
      )}&limit=1&appid=${encodeURIComponent(apiKey)}`;

      const geoRes = await fetchWithTimeout(geoUrl, customTimeoutMs);
      if (geoRes.ok) {
        const geoList = await geoRes.json();
        if (Array.isArray(geoList) && geoList.length > 0) {
          const { lat, lon, local_names, name, country } = geoList[0];
          resolvedCityName = local_names?.vi || name || normalizedCity;
          resolvedCountry = country || '';

          forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&lang=vi&appid=${encodeURIComponent(
            apiKey
          )}`;
          owmRes = await fetchWithTimeout(forecastUrl, customTimeoutMs);
        }
      }
    }

    if (owmRes.status === 404) {
      return sendJson(res, 404, {
        success: false,
        error: 'CITY_NOT_FOUND',
        message: `Không tìm thấy dự báo 5 ngày cho thành phố "${rawCity.trim()}" trên OpenWeatherMap.`
      });
    }

    if (owmRes.status === 401) {
      return sendJson(res, 401, {
        success: false,
        error: 'INVALID_API_KEY',
        message: 'OPENWEATHER_API_KEY trong file .env không hợp lệ hoặc chưa được kích hoạt.'
      });
    }

    if (!owmRes.ok) {
      throw new Error(`OpenWeatherMap API returned status ${owmRes.status}`);
    }

    const owmData = await owmRes.json();
    const forecastDays = buildFiveDayForecast(owmData.list);

    return sendJson(res, 200, {
      success: true,
      source: 'OpenWeatherMap',
      query: rawCity.trim(),
      city: owmData.city?.name || resolvedCityName,
      country: owmData.city?.country || resolvedCountry,
      days: forecastDays
    });
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return sendJson(res, 504, {
        success: false,
        error: 'API_TIMEOUT',
        message: 'OpenWeatherMap API phản hồi quá chậm. Vui lòng thử lại sau!'
      });
    }

    console.error('[OpenWeatherMap Forecast Error]:', err.message);
    return sendJson(res, 502, {
      success: false,
      error: 'UPSTREAM_ERROR',
      message: 'Không thể lấy dữ liệu dự báo 5 ngày từ OpenWeatherMap lúc này.'
    });
  }
}

// MIME types for static file serving
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // Route 1: GET /api/weather (Current weather - Open-Meteo)
  if (reqUrl.pathname === '/api/weather' && req.method === 'GET') {
    return handleWeatherApi(reqUrl, res);
  }

  // Route 2: GET /api/forecast (5-Day Forecast - OpenWeatherMap)
  if (reqUrl.pathname === '/api/forecast' && req.method === 'GET') {
    return handleForecastApi(reqUrl, res);
  }

  // Serve Static Files
  let safePath = path.normalize(decodeURIComponent(reqUrl.pathname)).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  const filePath = path.join(__dirname, safePath);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 Forbidden');
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('404 Not Found');
      }
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('500 Internal Server Error');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`=====================================================`);
  console.log(`🚀 Vietjet Air Server đang chạy tại: http://localhost:${PORT}`);
  console.log(`🌤️  Current Weather API (Open-Meteo): http://localhost:${PORT}/api/weather?city=Ha+Noi`);
  console.log(`📅 5-Day Forecast API (OpenWeatherMap): http://localhost:${PORT}/api/forecast?city=Ha+Noi`);
  console.log(`=====================================================`);
});
