/**
 * Vietjet Air Demo Landing Page - Vanilla JavaScript
 * Features:
 * - Dynamic flight search & filtering
 * - Trip type toggle (Round trip vs One way)
 * - Swap locations
 * - Date picker initialization & validation
 * - Bootstrap modal for ticket booking demo
 * - Mobile navbar auto-close
 */

document.addEventListener('DOMContentLoaded', () => {
  // Flight Sample Data (as specified in requirements)
  const defaultFlights = [
    {
      id: 1,
      fromCode: 'SGN',
      fromName: 'TP. Hồ Chí Minh',
      toCode: 'HAN',
      toName: 'Hà Nội',
      flightNumber: 'VJ128',
      type: 'Một chiều',
      departureTime: '06:15',
      arrivalTime: '08:25',
      duration: '2h 10m',
      price: 4000000,
      formattedPrice: '4.000.000 VND',
      featured: true
    },
    {
      id: 2,
      fromCode: 'SGN',
      fromName: 'TP. Hồ Chí Minh',
      toCode: 'DAD',
      toName: 'Đà Nẵng',
      flightNumber: 'VJ624',
      type: 'Một chiều',
      departureTime: '09:30',
      arrivalTime: '10:50',
      duration: '1h 20m',
      price: 1500000,
      formattedPrice: '1.500.000 VND',
      featured: true
    },
    {
      id: 3,
      fromCode: 'HAN',
      fromName: 'Hà Nội',
      toCode: 'SGN',
      toName: 'TP. Hồ Chí Minh',
      flightNumber: 'VJ155',
      type: 'Một chiều',
      departureTime: '14:20',
      arrivalTime: '16:35',
      duration: '2h 15m',
      price: 3500000,
      formattedPrice: '3.500.000 VND',
      featured: true
    },
    {
      id: 4,
      fromCode: 'SGN',
      fromName: 'TP. Hồ Chí Minh',
      toCode: 'PQC',
      toName: 'Phú Quốc',
      flightNumber: 'VJ321',
      type: 'Một chiều',
      departureTime: '11:00',
      arrivalTime: '12:05',
      duration: '1h 05m',
      price: 1800000,
      formattedPrice: '1.800.000 VND',
      featured: true
    },
    {
      id: 5,
      fromCode: 'HAN',
      fromName: 'Hà Nội',
      toCode: 'DAD',
      toName: 'Đà Nẵng',
      flightNumber: 'VJ507',
      type: 'Một chiều',
      departureTime: '17:45',
      arrivalTime: '19:05',
      duration: '1h 20m',
      price: 1700000,
      formattedPrice: '1.700.000 VND',
      featured: true
    }
  ];

  // DOM Elements
  const flightContainer = document.getElementById('flightCardsContainer');
  const searchAlert = document.getElementById('searchAlert');
  const searchAlertText = document.getElementById('searchAlertText');
  const resetSearchBtn = document.getElementById('resetSearchBtn');
  
  // Search Form Elements
  const searchForm = document.getElementById('flightSearchForm');
  const fromCitySelect = document.getElementById('fromCity');
  const toCitySelect = document.getElementById('toCity');
  const departDateInput = document.getElementById('departDate');
  const returnDateInput = document.getElementById('returnDate');
  const passengersSelect = document.getElementById('passengers');
  const swapBtn = document.getElementById('swapCitiesBtn');
  const tripTabs = document.querySelectorAll('.trip-tab-btn');
  const returnDateGroup = document.getElementById('returnDateGroup');
  
  // Filter Chips
  const filterChips = document.querySelectorAll('.filter-chip');

  // Booking Modal Elements
  const bookingModalEl = document.getElementById('bookingModal');
  const bookingModal = new bootstrap.Modal(bookingModalEl);
  const modalRoute = document.getElementById('modalRoute');
  const modalFlightCode = document.getElementById('modalFlightCode');
  const modalFlightDate = document.getElementById('modalFlightDate');
  const modalFlightType = document.getElementById('modalFlightType');
  const modalFlightPassengers = document.getElementById('modalFlightPassengers');
  const modalFlightPrice = document.getElementById('modalFlightPrice');
  const modalConfirmForm = document.getElementById('modalConfirmForm');
  const bookingSuccessAlert = document.getElementById('bookingSuccessAlert');
  const bookingFormContainer = document.getElementById('bookingFormContainer');

  let currentTripType = 'round-trip'; // or 'one-way'
  let activeSelectedFlight = null;

  // Initialize Dates
  function initDates() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const returnDefault = new Date(today);
    returnDefault.setDate(today.getDate() + 5);

    const formatDate = (date) => date.toISOString().split('T')[0];

    const todayStr = formatDate(today);
    const tomorrowStr = formatDate(tomorrow);
    const returnDefaultStr = formatDate(returnDefault);

    if (departDateInput) {
      departDateInput.min = todayStr;
      departDateInput.value = tomorrowStr;
    }

    if (returnDateInput) {
      returnDateInput.min = tomorrowStr;
      returnDateInput.value = returnDefaultStr;
    }

    if (departDateInput && returnDateInput) {
      departDateInput.addEventListener('change', () => {
        returnDateInput.min = departDateInput.value;
        if (returnDateInput.value && returnDateInput.value < departDateInput.value) {
          returnDateInput.value = departDateInput.value;
        }
      });
    }
  }

  // Format Currency
  function formatVND(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' VND';
  }

  // Render Flight Cards
  function renderFlights(flights) {
    if (!flightContainer) return;

    if (flights.length === 0) {
      flightContainer.innerHTML = `
        <div class="col-12 text-center py-5">
          <div class="p-4 bg-white rounded-3 shadow-sm d-inline-block">
            <i class="bi bi-airplane-engines text-danger fs-1 mb-3 d-block"></i>
            <h5 class="fw-bold">Không tìm thấy chuyến bay phù hợp</h5>
            <p class="text-muted mb-3">Vui lòng thử chọn điểm đi/điểm đến khác hoặc xem danh sách tất cả các chặng bay phổ biến.</p>
            <button class="btn btn-vj-primary btn-sm" id="emptyStateResetBtn">
              <i class="bi bi-arrow-clockwise"></i> Xem tất cả chuyến bay
            </button>
          </div>
        </div>
      `;
      const emptyStateReset = document.getElementById('emptyStateResetBtn');
      if (emptyStateReset) {
        emptyStateReset.addEventListener('click', () => {
          renderFlights(defaultFlights);
          clearActiveFilterChips();
          document.querySelector('.filter-chip[data-filter="all"]')?.classList.add('active');
          if (searchAlert) searchAlert.classList.add('d-none');
        });
      }
      return;
    }

    flightContainer.innerHTML = flights.map(flight => `
      <div class="col-md-6 col-lg-4">
        <div class="flight-card" data-flight-id="${flight.id}">
          <div class="flight-header">
            <span class="flight-code">
              <i class="bi bi-airplane-fill"></i> ${flight.flightNumber}
            </span>
            <span class="flight-type-badge">
              <i class="bi bi-arrow-right-circle"></i> ${flight.type}
            </span>
          </div>

          <div class="flight-route-info">
            <div class="route-point">
              <div class="city-code">${flight.fromCode}</div>
              <div class="city-name">${flight.fromName}</div>
            </div>

            <div class="flight-connector">
              <span class="flight-duration">${flight.duration}</span>
              <div class="flight-path-line">
                <i class="bi bi-airplane"></i>
              </div>
            </div>

            <div class="route-point destination">
              <div class="city-code">${flight.toCode}</div>
              <div class="city-name">${flight.toName}</div>
            </div>
          </div>

          <div class="flight-footer">
            <div>
              <span class="price-label">Giá chỉ từ</span>
              <span class="price-value">${flight.formattedPrice}</span>
            </div>
            <button class="btn btn-vj-primary btn-book-ticket" data-flight-id="${flight.id}">
              Đặt vé
            </button>
          </div>
        </div>
      </div>
    `).join('');

    // Attach Event Listeners to "Đặt vé" buttons
    attachBookingButtons();
  }

  // Attach Booking Modal Button Handlers
  function attachBookingButtons() {
    const bookButtons = document.querySelectorAll('.btn-book-ticket');
    bookButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const flightId = parseInt(e.target.getAttribute('data-flight-id'), 10);
        const flight = defaultFlights.find(f => f.id === flightId) || activeSelectedFlight;
        
        if (flight) {
          openBookingModal(flight);
        }
      });
    });
  }

  // Open Booking Modal with Selected Flight Info
  function openBookingModal(flight) {
    activeSelectedFlight = flight;
    
    // Fill Modal Data
    if (modalRoute) {
      modalRoute.textContent = `${flight.fromName} (${flight.fromCode}) ➔ ${flight.toName} (${flight.toCode})`;
    }
    if (modalFlightCode) {
      modalFlightCode.textContent = flight.flightNumber;
    }
    if (modalFlightType) {
      modalFlightType.textContent = flight.type;
    }
    if (modalFlightDate) {
      const chosenDate = departDateInput ? departDateInput.value : '2026-09-28';
      const [year, month, day] = chosenDate.split('-');
      modalFlightDate.textContent = `${day}/${month}/${year}`;
    }
    if (modalFlightPassengers) {
      modalFlightPassengers.textContent = passengersSelect ? passengersSelect.value : '1 Hành khách';
    }
    if (modalFlightPrice) {
      modalFlightPrice.textContent = flight.formattedPrice;
    }

    // Reset Modal Form State
    if (bookingFormContainer) bookingFormContainer.classList.remove('d-none');
    if (bookingSuccessAlert) bookingSuccessAlert.classList.add('d-none');
    if (modalConfirmForm) modalConfirmForm.reset();

    // Show modal
    bookingModal.show();
  }

  // Handle Booking Form Submit in Modal
  if (modalConfirmForm) {
    modalConfirmForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('passengerName')?.value.trim();
      const phone = document.getElementById('passengerPhone')?.value.trim();
      const email = document.getElementById('passengerEmail')?.value.trim();

      if (!name || !phone || !email) {
        alert('Vui lòng điền đầy đủ họ tên, số điện thoại và email!');
        return;
      }

      // Generate random demo booking code
      const bookingCode = 'VJ' + Math.floor(100000 + Math.random() * 900000);
      const bookingCodeEl = document.getElementById('demoBookingCode');
      if (bookingCodeEl) {
        bookingCodeEl.textContent = bookingCode;
      }

      // Hide form and display success alert
      if (bookingFormContainer) bookingFormContainer.classList.add('d-none');
      if (bookingSuccessAlert) bookingSuccessAlert.classList.remove('d-none');
    });
  }

  // Trip Type Tabs (Khứ hồi / Một chiều)
  tripTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tripTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTripType = tab.getAttribute('data-trip');

      if (currentTripType === 'one-way') {
        if (returnDateGroup) {
          returnDateGroup.classList.add('disabled');
        }
        if (returnDateInput) {
          returnDateInput.disabled = true;
        }
      } else {
        if (returnDateGroup) {
          returnDateGroup.classList.remove('disabled');
        }
        if (returnDateInput) {
          returnDateInput.disabled = false;
        }
      }
    });
  });

  // Swap Locations Button
  if (swapBtn && fromCitySelect && toCitySelect) {
    swapBtn.addEventListener('click', () => {
      const tempVal = fromCitySelect.value;
      fromCitySelect.value = toCitySelect.value;
      toCitySelect.value = tempVal;
    });
  }

  // Search Flight Handler
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const fromVal = fromCitySelect ? fromCitySelect.value : '';
      const toVal = toCitySelect ? toCitySelect.value : '';

      if (!fromVal || !toVal) {
        alert('Vui lòng chọn cả điểm khởi hành và điểm đến!');
        return;
      }

      if (fromVal === toVal) {
        alert('Điểm khởi hành và điểm đến không thể giống nhau. Vui lòng chọn lại!');
        return;
      }

      // Find matching flights
      const matches = defaultFlights.filter(f => f.fromCode === fromVal && f.toCode === toVal);

      // Scroll to flights section smoothly
      const flightSec = document.getElementById('chuyen-bay');
      if (flightSec) {
        flightSec.scrollIntoView({ behavior: 'smooth' });
      }

      const fromName = fromCitySelect.options[fromCitySelect.selectedIndex].text;
      const toName = toCitySelect.options[toCitySelect.selectedIndex].text;

      // Update Search Alert Info
      if (searchAlert && searchAlertText) {
        searchAlert.classList.remove('d-none');
        if (matches.length > 0) {
          searchAlertText.innerHTML = `<strong>Đang hiển thị kết quả cho tuyến:</strong> ${fromName} ➔ ${toName}`;
          renderFlights(matches);
        } else {
          // If route not in predefined 5, dynamically construct a realistic result for better UX
          const dynamicFlight = {
            id: 99,
            fromCode: fromVal,
            fromName: fromName.split(' (')[0],
            toCode: toVal,
            toName: toName.split(' (')[0],
            flightNumber: 'VJ' + Math.floor(200 + Math.random() * 500),
            type: currentTripType === 'one-way' ? 'Một chiều' : 'Khứ hồi',
            departureTime: '08:45',
            arrivalTime: '10:55',
            duration: '2h 10m',
            price: 2450000,
            formattedPrice: '2.450.000 VND',
            featured: false
          };
          activeSelectedFlight = dynamicFlight;
          searchAlertText.innerHTML = `<strong>Chuyến bay tìm kiếm:</strong> ${fromName} ➔ ${toName} (Chuyến bay tăng cường Vietjet)`;
          renderFlights([dynamicFlight]);
        }
      }

      // Automatically fetch weather for the destination city when searching flights
      const destCityClean = toName.split(' (')[0];
      if (weatherCityInput) {
        weatherCityInput.value = destCityClean;
      }
      updateActiveWeatherChip(destCityClean);
      fetchCityWeather(destCityClean);

      clearActiveFilterChips();
    });
  }

  // Also update destination weather when user changes "Điểm đến" dropdown
  if (toCitySelect) {
    toCitySelect.addEventListener('change', () => {
      const toName = toCitySelect.options[toCitySelect.selectedIndex].text;
      const destCityClean = toName.split(' (')[0];
      if (weatherCityInput) {
        weatherCityInput.value = destCityClean;
      }
      updateActiveWeatherChip(destCityClean);
      fetchCityWeather(destCityClean);
    });
  }

  // Reset Search Alert
  if (resetSearchBtn) {
    resetSearchBtn.addEventListener('click', () => {
      if (searchAlert) searchAlert.classList.add('d-none');
      renderFlights(defaultFlights);
      clearActiveFilterChips();
      document.querySelector('.filter-chip[data-filter="all"]')?.classList.add('active');
    });
  }

  // Filter Chips Functionality
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      clearActiveFilterChips();
      chip.classList.add('active');

      const filterType = chip.getAttribute('data-filter');

      if (filterType === 'all') {
        renderFlights(defaultFlights);
        if (searchAlert) searchAlert.classList.add('d-none');
      } else if (filterType === 'from-sgn') {
        const filtered = defaultFlights.filter(f => f.fromCode === 'SGN');
        renderFlights(filtered);
        if (searchAlert && searchAlertText) {
          searchAlert.classList.remove('d-none');
          searchAlertText.innerHTML = `<strong>Lọc chuyến bay:</strong> Khởi hành từ TP. Hồ Chí Minh (SGN)`;
        }
      } else if (filterType === 'from-han') {
        const filtered = defaultFlights.filter(f => f.fromCode === 'HAN');
        renderFlights(filtered);
        if (searchAlert && searchAlertText) {
          searchAlert.classList.remove('d-none');
          searchAlertText.innerHTML = `<strong>Lọc chuyến bay:</strong> Khởi hành từ Hà Nội (HAN)`;
        }
      } else if (filterType === 'under-2m') {
        const filtered = defaultFlights.filter(f => f.price <= 2000000);
        renderFlights(filtered);
        if (searchAlert && searchAlertText) {
          searchAlert.classList.remove('d-none');
          searchAlertText.innerHTML = `<strong>Lọc chuyến bay:</strong> Vé giá rẻ dưới 2.000.000 VND`;
        }
      }
    });
  });

  function clearActiveFilterChips() {
    filterChips.forEach(c => c.classList.remove('active'));
  }

  // =========================================================================
  // Current Weather Lookup Logic (Calls Backend /api/weather -> Open-Meteo)
  // =========================================================================
  const weatherSearchForm = document.getElementById('weatherSearchForm');
  const weatherCityInput = document.getElementById('weatherCityInput');
  const weatherSubmitBtn = document.getElementById('weatherSubmitBtn');
  const weatherChips = document.querySelectorAll('.weather-chip');

  const weatherLoadingState = document.getElementById('weatherLoadingState');
  const weatherLoadingCity = document.getElementById('weatherLoadingCity');
  const weatherSlowWarning = document.getElementById('weatherSlowWarning');

  const weatherErrorState = document.getElementById('weatherErrorState');
  const weatherErrorIcon = document.getElementById('weatherErrorIcon');
  const weatherErrorTitle = document.getElementById('weatherErrorTitle');
  const weatherErrorMessage = document.getElementById('weatherErrorMessage');
  const weatherRetryBtn = document.getElementById('weatherRetryBtn');
  const weatherDefaultCityBtn = document.getElementById('weatherDefaultCityBtn');

  const weatherSuccessState = document.getElementById('weatherSuccessState');
  const weatherDisplayCity = document.getElementById('weatherDisplayCity');
  const weatherDisplayCountry = document.getElementById('weatherDisplayCountry');
  const weatherUpdatedLabel = document.getElementById('weatherUpdatedLabel');
  const weatherDisplayIcon = document.getElementById('weatherDisplayIcon');
  const weatherDisplayTemp = document.getElementById('weatherDisplayTemp');
  const weatherDisplayDesc = document.getElementById('weatherDisplayDesc');
  const weatherDisplayFeelsLike = document.getElementById('weatherDisplayFeelsLike');
  const weatherDisplayHumidity = document.getElementById('weatherDisplayHumidity');
  const weatherDisplayWind = document.getElementById('weatherDisplayWind');
  const weatherDisplayFlightNote = document.getElementById('weatherDisplayFlightNote');

  // 5-Day Forecast DOM Elements (OpenWeatherMap)
  const forecastCityTitle = document.getElementById('forecastCityTitle');
  const forecastLoadingState = document.getElementById('forecastLoadingState');
  const forecastErrorState = document.getElementById('forecastErrorState');
  const forecastErrorMessage = document.getElementById('forecastErrorMessage');
  const forecastDaysContainer = document.getElementById('forecastDaysContainer');

  // Determine Backend Base URL (supports running on http://localhost:3000 or external static server)
  const BACKEND_BASE_URL =
    window.location.protocol === 'file:' ||
    (window.location.hostname && window.location.port && window.location.port !== '3000')
      ? 'http://localhost:3000'
      : '';

  const FRONTEND_TIMEOUT_MS = 8000; // 8s client-side timeout
  const SLOW_RESPONSE_THRESHOLD_MS = 2000; // Show slow warning after 2s

  let activeWeatherController = null;
  let activeForecastController = null;
  let lastQueriedCity = 'Hà Nội';

  function showWeatherState(state) {
    weatherLoadingState?.classList.toggle('d-none', state !== 'loading');
    weatherErrorState?.classList.toggle('d-none', state !== 'error');
    weatherSuccessState?.classList.toggle('d-none', state !== 'success');
  }

  function showForecastState(state) {
    forecastLoadingState?.classList.toggle('d-none', state !== 'loading');
    forecastErrorState?.classList.toggle('d-none', state !== 'error');
    forecastDaysContainer?.classList.toggle('d-none', state !== 'success');
  }

  function updateActiveWeatherChip(cityName) {
    const normalized = cityName.trim().toLowerCase();
    weatherChips.forEach(chip => {
      const chipCity = (chip.getAttribute('data-city') || '').toLowerCase();
      if (
        chipCity === normalized ||
        (normalized.includes('hồ chí minh') && chipCity.includes('hồ chí minh'))
      ) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  }

  /**
   * Fetch 5-Day Forecast from Backend (/api/forecast -> OpenWeatherMap API)
   */
  async function fetchFiveDayForecast(cityQuery) {
    const trimmedCity = (cityQuery || '').trim();
    if (!trimmedCity) return;

    if (activeForecastController) {
      activeForecastController.abort();
    }
    const controller = new AbortController();
    activeForecastController = controller;

    if (forecastCityTitle) {
      forecastCityTitle.textContent = trimmedCity;
    }
    showForecastState('loading');

    const timeoutTimer = setTimeout(() => {
      controller.abort('TIMEOUT');
    }, FRONTEND_TIMEOUT_MS);

    try {
      const endpoint = `${BACKEND_BASE_URL}/api/forecast?city=${encodeURIComponent(trimmedCity)}`;
      const response = await fetch(endpoint, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json'
        }
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data || !data.success) {
        if (forecastErrorMessage) {
          forecastErrorMessage.textContent =
            data?.message || `Không thể tải dự báo 5 ngày cho "${trimmedCity}".`;
        }
        showForecastState('error');
        return;
      }

      renderFiveDayForecast(data);
    } catch (error) {
      if (controller.signal.aborted && activeForecastController !== controller) {
        return;
      }
      if (forecastErrorMessage) {
        forecastErrorMessage.textContent =
          error.name === 'AbortError' || controller.signal.reason === 'TIMEOUT'
            ? 'OpenWeatherMap API phản hồi quá chậm (Timeout). Vui lòng thử lại!'
            : 'Không thể kết nối đến Backend (/api/forecast).';
      }
      showForecastState('error');
    } finally {
      clearTimeout(timeoutTimer);
    }
  }

  /**
   * Render 5-Day Forecast Cards into #forecastDaysContainer
   */
  function renderFiveDayForecast(data) {
    if (!forecastDaysContainer) return;

    if (forecastCityTitle && data.city) {
      forecastCityTitle.textContent = data.city;
    }

    const days = Array.isArray(data.days) ? data.days : [];
    if (days.length === 0) {
      if (forecastErrorMessage) {
        forecastErrorMessage.textContent = 'Không có dữ liệu dự báo 5 ngày cho thành phố này.';
      }
      showForecastState('error');
      return;
    }

    forecastDaysContainer.innerHTML = days
      .map(
        (day) => `
      <div class="forecast-day-card">
        <div>
          <div class="forecast-day-name">${day.dayOfWeek}</div>
          <div class="forecast-day-date">${day.formattedDate}</div>
        </div>
        <div class="forecast-icon-wrap">
          <img
            src="${day.iconUrl}"
            alt="${day.description}"
            class="forecast-owm-icon"
            loading="lazy"
          />
        </div>
        <div>
          <div class="forecast-day-temp">${day.formattedTemperature}</div>
          <div class="forecast-day-range">Thấp/Cao: ${day.formattedRange}</div>
          <div class="forecast-day-desc">${day.description}</div>
        </div>
      </div>
    `
      )
      .join('');

    showForecastState('success');
  }

  async function fetchCityWeather(cityQuery) {
    const trimmedCity = (cityQuery || '').trim();
    if (!trimmedCity) {
      renderWeatherError(
        'Vui lòng nhập tên thành phố',
        'Bạn chưa nhập tên thành phố cần tra cứu. Hãy nhập ví dụ: Hà Nội, Đà Nẵng, Phú Quốc...',
        'bi-info-circle-fill'
      );
      return;
    }

    lastQueriedCity = trimmedCity;

    // Trigger 5-day forecast fetch (OpenWeatherMap) in parallel
    fetchFiveDayForecast(trimmedCity);

    // Cancel any in-flight request
    if (activeWeatherController) {
      activeWeatherController.abort();
    }
    const controller = new AbortController();
    activeWeatherController = controller;

    // Show loading state
    if (weatherLoadingCity) weatherLoadingCity.textContent = trimmedCity;
    if (weatherSlowWarning) weatherSlowWarning.classList.add('d-none');
    if (weatherSubmitBtn) weatherSubmitBtn.disabled = true;
    showWeatherState('loading');

    // Timer to inform user if API response is slow (> 2 seconds)
    const slowWarningTimer = setTimeout(() => {
      if (weatherSlowWarning) {
        weatherSlowWarning.classList.remove('d-none');
      }
    }, SLOW_RESPONSE_THRESHOLD_MS);

    // Timer to abort request if API takes too long (> 8 seconds)
    const timeoutTimer = setTimeout(() => {
      controller.abort('TIMEOUT');
    }, FRONTEND_TIMEOUT_MS);

    try {
      const endpoint = `${BACKEND_BASE_URL}/api/weather?city=${encodeURIComponent(trimmedCity)}`;
      const response = await fetch(endpoint, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json'
        }
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data || !data.success) {
        // Case 1: City Not Found (404)
        if (response.status === 404 || data?.error === 'CITY_NOT_FOUND') {
          renderWeatherError(
            'Không tìm thấy thành phố',
            data?.message || `Không tìm thấy thông tin thời tiết cho thành phố "${trimmedCity}". Vui lòng kiểm tra lại chính tả!`,
            'bi-geo-alt'
          );
          return;
        }

        // Case 2: Slow API / Gateway Timeout (504)
        if (response.status === 504 || data?.error === 'API_TIMEOUT') {
          renderWeatherError(
            'API thời tiết phản hồi quá chậm',
            data?.message || 'Dịch vụ thời tiết Open-Meteo đang phản hồi quá thời gian quy định. Vui lòng thử lại sau ít phút!',
            'bi-hourglass-bottom'
          );
          return;
        }

        // Case 3: Other errors
        renderWeatherError(
          'Không thể tải dữ liệu thời tiết',
          data?.message || 'Đã xảy ra lỗi khi lấy dữ liệu thời tiết. Vui lòng thử lại.',
          'bi-exclamation-triangle-fill'
        );
        return;
      }

      // Render valid weather data
      renderWeatherSuccess(data);
    } catch (error) {
      // Ignore abort if triggered by a newer request replacing this one
      if (controller.signal.aborted && activeWeatherController !== controller) {
        return;
      }

      if (error.name === 'AbortError' || controller.signal.reason === 'TIMEOUT') {
        renderWeatherError(
          'API phản hồi quá chậm (Timeout)',
          `Quá thời gian chờ (${FRONTEND_TIMEOUT_MS / 1000}s) khi lấy thời tiết cho "${trimmedCity}". Vui lòng kiểm tra mạng hoặc nhấn Thử lại!`,
          'bi-clock-history'
        );
        return;
      }

      renderWeatherError(
        'Lỗi kết nối tới Backend Server',
        'Không thể kết nối đến máy chủ Backend (/api/weather). Hãy đảm bảo server đang chạy (node server.js).',
        'bi-wifi-off'
      );
    } finally {
      clearTimeout(slowWarningTimer);
      clearTimeout(timeoutTimer);
      if (activeWeatherController === controller && weatherSubmitBtn) {
        weatherSubmitBtn.disabled = false;
      }
    }
  }

  function renderWeatherSuccess(data) {
    if (weatherDisplayCity) {
      weatherDisplayCity.textContent = data.city || lastQueriedCity;
    }
    if (weatherDisplayCountry) {
      const regionParts = [];
      if (data.admin1 && data.admin1.toLowerCase() !== (data.city || '').toLowerCase()) {
        regionParts.push(data.admin1);
      }
      if (data.country) {
        regionParts.push(data.country);
      }
      weatherDisplayCountry.textContent = regionParts.join(', ') || 'Điểm đến Vietjet';
    }
    if (weatherUpdatedLabel) {
      if (data.updatedAt) {
        const timePart = data.updatedAt.split('T')[1] || '';
        weatherUpdatedLabel.textContent = timePart ? `Cập nhật lúc ${timePart}` : 'Cập nhật mới nhất';
      } else {
        weatherUpdatedLabel.textContent = 'Cập nhật mới nhất';
      }
    }
    if (weatherDisplayIcon) {
      weatherDisplayIcon.className = `bi ${data.icon || 'bi-cloud-sun-fill'}`;
    }
    if (weatherDisplayTemp) {
      weatherDisplayTemp.textContent = data.exactTemperature || data.formattedTemperature || `${data.temperature}°C`;
    }
    if (weatherDisplayDesc) {
      weatherDisplayDesc.textContent = data.description || 'Thời tiết ổn định';
    }
    if (weatherDisplayFeelsLike) {
      weatherDisplayFeelsLike.textContent = data.apparentTemperature || '--°C';
    }
    if (weatherDisplayHumidity) {
      weatherDisplayHumidity.textContent = data.humidity || '--%';
    }
    if (weatherDisplayWind) {
      weatherDisplayWind.textContent = data.windSpeed || '-- km/h';
    }
    if (weatherDisplayFlightNote) {
      weatherDisplayFlightNote.textContent =
        data.flightNote || 'Thời tiết thuận lợi cho hành trình bay của bạn.';
    }

    showWeatherState('success');
  }

  function renderWeatherError(title, message, iconClass = 'bi-exclamation-triangle-fill') {
    if (weatherErrorTitle) weatherErrorTitle.textContent = title;
    if (weatherErrorMessage) weatherErrorMessage.textContent = message;
    if (weatherErrorIcon) weatherErrorIcon.className = `bi ${iconClass}`;
    showWeatherState('error');
  }

  // Weather Form Submit Event
  if (weatherSearchForm) {
    weatherSearchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const cityVal = weatherCityInput ? weatherCityInput.value : '';
      updateActiveWeatherChip(cityVal);
      fetchCityWeather(cityVal);
    });
  }

  // Quick City Chips Click Event
  weatherChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const city = chip.getAttribute('data-city') || '';
      if (weatherCityInput) {
        weatherCityInput.value = city;
      }
      updateActiveWeatherChip(city);
      fetchCityWeather(city);
    });
  });

  // Retry & Default City Buttons on Error State
  if (weatherRetryBtn) {
    weatherRetryBtn.addEventListener('click', () => {
      fetchCityWeather(lastQueriedCity);
    });
  }

  if (weatherDefaultCityBtn) {
    weatherDefaultCityBtn.addEventListener('click', () => {
      const defaultCity = 'Hà Nội';
      if (weatherCityInput) weatherCityInput.value = defaultCity;
      updateActiveWeatherChip(defaultCity);
      fetchCityWeather(defaultCity);
    });
  }

  // Close mobile navbar on nav link click
  const navLinks = document.querySelectorAll('.navbar-nav .nav-link, .navbar-nav .btn-vj-primary');
  const navbarCollapse = document.getElementById('navbarNav');
  if (navbarCollapse) {
    const bsCollapse = bootstrap.Collapse.getInstance(navbarCollapse) || new bootstrap.Collapse(navbarCollapse, { toggle: false });
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (navbarCollapse.classList.contains('show')) {
          bsCollapse.hide();
        }
      });
    });
  }

  // Navbar shadow on scroll
  const navbar = document.querySelector('.vj-navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      navbar?.classList.add('scrolled');
    } else {
      navbar?.classList.remove('scrolled');
    }
  });

  // Initialize page
  initDates();
  renderFlights(defaultFlights);
  fetchCityWeather('Hà Nội');
});

