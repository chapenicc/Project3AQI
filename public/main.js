import {
  getNext5DaysForecast,
  generateAdvice,
  getTomorrowForecast,
} from "./predic.js";
import { FindSensors } from "./firebase.js";

// เปลี่ยนพื้นหลังตามอุณหภูมิและโอกาสฝน
function pickBackgroundClass({ temperature = 0, rainChance = 0 }) {
  if (rainChance >= 70) return "rainy"; // ฝนตกหนัก
  if (rainChance >= 40) return "cloudy"; // มีเมฆหรือฝนปรอย
  if (temperature >= 35) return "hot"; // ร้อนจัด
  if (temperature <= 20) return "cold"; // หนาว
  return "sunny"; // ปกติ
}

// ฟังก์ชันดึงค่า CO, CO2, PM2.5, RainChance, Temperature ของวันพรุ่งนี้
async function displayTomorrowValues() {
  try {
    const { forecast } = await getTomorrowForecast();
    console.log("Tomorrow forecast:", forecast);

    const mapping = [
      { selector: ".pm25-tomorrow", key: "pm25" },
      { selector: ".rainChance-tomorrow", key: "rainChance" },
      { selector: ".temperature-tomorrow", key: "temperature" },
    ];

    mapping.forEach(({ selector, key }) => {
      const el = document.querySelector(selector);
      if (!el) return;
      const raw = forecast?.[key];
      el.textContent = typeof raw === "number" ? raw.toFixed(1) : "--";
    });

    const container = document.querySelector(".predic-card.main-predic");
    if (container) {
      container.classList.remove("sunny", "rainy", "cloudy", "hot", "cold");
      const bgClass = pickBackgroundClass({
        temperature: forecast?.temperature,
        rainChance: forecast?.rainChance,
      });
      container.classList.add(bgClass);
    }
  } catch (err) {
    console.error("Error in displayTomorrowValues:", err);
  }
}

// โหลดพยากรณ์ 5 วัน และแสดงการ์ด
export async function LoadForecast() {
  const fc = document.getElementById("forecastContainer");
  if (!fc) return;

  const data = await getNext5DaysForecast();
  fc.innerHTML = "";

  data.forEach(({ date, forecast, rainChance }) => {
    const dayLabel = getDayLabel(date);

    if (forecast) {
      const temp = forecast.temperature ?? 0;
      const pm25 = forecast.pm25 ?? 0;
      const icon = forecast.icon || pickIcon({ temperature: temp, rainChance });
      const rainPct = rainChance ?? 0;

      fc.innerHTML += `
        <div class="forecast-item">
          <span><strong>${dayLabel}</strong></span>
          <img src="./png/${icon}.png" alt="${icon}" />
          <span><strong>${temp.toFixed(2)}</strong>°C</span>
          <span>PM2.5: <strong>${pm25.toFixed(0)}</strong> µg/m³</span>
          <span>Rain: <strong>${rainPct}</strong>%</span>
        </div>`;
    } else {
      fc.innerHTML += `
        <div class="forecast-item">
          <span><strong>${dayLabel}</strong></span>
          <img src="./png/unknown.png" alt="No Data" />
          <span>--°C</span>
          <span>-- µg/m³</span>
          <span>--%</span>
        </div>`;
    }
  });
}

// 📈 โหลดข้อมูลใหม่เฉพาะตอนจะวาดกราฟ
async function LoadForecastForGraph() {
  const data = await getNext5DaysForecast();

  const labels = [];
  const temps = [];
  const pm25s = [];

  data.forEach(({ date, forecast }) => {
    const dayLabel = getDayLabel(date);
    labels.push(dayLabel);

    const temp = forecast?.temperature ?? 0;
    const pm25 = forecast?.pm25 ?? 0;

    temps.push(temp);
    pm25s.push(pm25);
  });

  return { labels, temps, pm25s };
}

// สร้างกราฟแบบดีที่สุด
async function afterLoadForecast() {
  const { labels, temps, pm25s } = await LoadForecastForGraph();

  const chartCanvas = document.getElementById("mainChart");
  let chart;

  function createChart(type, label, data, borderColor, bgColor) {
    const ctx = chartCanvas.getContext("2d");
    if (chart) chart.destroy();

    // หาค่า min/max ของข้อมูล
    const min = Math.min(...data);
    const max = Math.max(...data);
    const buffer = (max - min) * 0.1 || 1; // กันกรณี max-min = 0
    const suggestedMin = min - buffer;
    const suggestedMax = max + buffer;

    chart = new Chart(ctx, {
      type: type,
      data: {
        labels: labels,
        datasets: [{
          label: label,
          data: data,
          borderColor: borderColor,
          backgroundColor: bgColor,
          tension: type === "line" ? 0.3 : 0.4,
          fill: true,
          pointBackgroundColor: "white",
          pointBorderColor: borderColor,
          pointRadius: 5,
          pointHoverRadius: 7,
          categoryPercentage: type === "bar" ? 0.6 : undefined,
          barPercentage: type === "bar" ? 0.6 : undefined,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          y: {
            beginAtZero: type === "bar",
            suggestedMin: type === "line" ? suggestedMin : 0,
            suggestedMax: type === "line" ? suggestedMax : undefined,
            grid: { color: "rgba(0,0,0,0.05)" },
            ticks: {
              color: "#030303",
              font: { size: window.innerWidth < 600 ? 10 : 14 }
            }
          },
          x: {
            grid: { display: false },
            ticks: {
              color: "#030303",
              font: { size: window.innerWidth < 600 ? 10 : 14 }
            }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: "#030303",
              font: { size: 14 }
            }
          },
          tooltip: {
            backgroundColor: borderColor,
            titleColor: "white",
            bodyColor: "white",
            cornerRadius: 6,
            padding: 10
          }
        }
      }
    });
  }

  function setActiveButton(buttonId) {
    document.querySelectorAll(".chart-buttons button").forEach((btn) =>
      btn.classList.remove("active")
    );
    document.getElementById(buttonId).classList.add("active");
  }

  document.getElementById("btnTemp").addEventListener("click", () => {
    createChart(
      "line",
      "Temperature (°C)",
      temps,
      "#D4C9BE",
      "rgba(212, 201, 190, 0.5)"
    );
    setActiveButton("btnTemp");
  });

  document.getElementById("btnPM25").addEventListener("click", () => {
    createChart(
      "bar",
      "PM2.5 (µg/m³)",
      pm25s,
      "#123458",
      "rgba(18, 52, 88, 0.5)"
    );
    setActiveButton("btnPM25");
  });

  createChart(
    "line",
    "Temperature (°C)",
    temps,
    "#D4C9BE",
    "rgba(212, 201, 190, 0.5)"
  );
  setActiveButton("btnTemp");
}

// ==== โหลดทุกอย่างตอนเข้าเว็บ ====
async function start() {
  FindSensors();
  await LoadForecast();
  afterLoadForecast();
  startSensorSlider();
  displayTomorrowValues();
}
start();

// ==== ฟังก์ชันเสริม ====
function pickIcon(item) {
  if (!item || typeof item !== "object") return "unknown";
  const temp = item.temperature ?? 0;
  const rain = item.rainChance ?? item.rainchance ?? 0;
  if (rain >= 90) return "storm";
  if (rain >= 70) return "rainy";
  if (rain >= 40) return "cloudy";
  if (temp >= 35) return "hot";
  if (temp <= 20) return "cold";
  return "sunny";
}

function getDayLabel(dateString) {
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  return days[new Date(dateString).getDay()];
}

function startSensorSlider(ms = 3000) {
  const items = document.querySelectorAll(".slider-item");
  if (!items.length) return;
  let idx = 0;
  setInterval(() => {
    items.forEach((i) => i.classList.remove("active"));
    idx = (idx + 1) % items.length;
    items[idx].classList.add("active");
  }, ms);
}

const slider = document.getElementById("slider");
const items = slider?.querySelectorAll(".slider-item") || [];
let currentIndex = 0;
if (slider) {
  slider.addEventListener("click", () => {
    items[currentIndex].classList.remove("active");
    currentIndex = (currentIndex + 1) % items.length;
    items[currentIndex].classList.add("active");
  });
}
