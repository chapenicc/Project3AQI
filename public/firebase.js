import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getDatabase, ref, get, child } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// ✅ Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCSZPuWoGaD6PRtQ1HDPGOAsSZuYLnqE5M",
  authDomain: "air-qulity-in-u.firebaseapp.com",
  databaseURL: "https://air-qulity-in-u-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "air-qulity-in-u",
  storageBucket: "air-qulity-in-u.appspot.com",
  messagingSenderId: "433092144908",
  appId: "1:433092144908:web:cc97993d889c1fe255a329",
  measurementId: "G-YYCL81F35Q"
};

// Initialize Firebase services
const app       = initializeApp(firebaseConfig);
const firestore = getFirestore(app);
const db        = getDatabase(app);
const dbref     = ref(db);

// ฟังก์ชันดึงข้อมูลจาก Realtime Database และแสดงผลพร้อมหน่วยและทศนิยมตาม key
function FindSensors() {
  const elements = {
    co:          document.querySelectorAll('.co'),
    co2:         document.querySelectorAll('.co2'),
    hcho:        document.querySelectorAll('.hcho'),
    pm10:        document.querySelectorAll('.pm10'),
    pm2_5:       document.querySelectorAll('.pm2_5'),
    temperature: document.querySelectorAll('.temperature'),
    humidity:    document.querySelectorAll('.humidity'),
    airpressure: document.querySelectorAll('.airpressure'),
    windspeed:   document.querySelectorAll('.windspeed'),
    rainChance:  document.querySelectorAll('.rainChance'),
    pm1:         document.querySelectorAll('.pm1')
  };

  // กำหนดจำนวนทศนิยมเฉพาะ key
  const precisionMap = {
    airpressure: 2,   // 2 ตำแหน่งทศนิยมสำหรับ airpressure
    default:     2    // ค่า default
  };

  // กำหนดหน่วยแสดงผลเพิ่มเติม
  const unitMap = {
    co:          ' ppm',
    co2:         ' ppm',
    hcho:        ' ppm',
    pm10:        ' µg/m³',
    pm2_5:       ' µg/m³',
    pm1:         ' µg/m³',
    temperature: ' °C',
    humidity:    ' %',
    airpressure: ' hPa',
    windspeed:   ' m/s',
    rainChance:  ' %'  
  };

  get(child(dbref, '/realtime'))
    .then(snapshot => {
      if (!snapshot.exists()) {
        throw new Error('No data at /realtime');
      }
      const raw = snapshot.val();
      // แยกค่าจาก object ถ้ามี
      const data = {
        ...raw,
        rainChance: raw.rainChance?.rainChance ?? raw.rainChance,
      };

      for (const [key, nodes] of Object.entries(elements)) {
        let value = data[key] != null ? data[key] : '--';
        // จัดรูปแบบตัวเลข
        if (typeof value === 'number') {
          const dec = precisionMap[key] ?? precisionMap.default;
          value = value.toFixed(dec);
        }
        // เพิ่มหน่วย
        const unit = unitMap[key] || '';
        nodes.forEach(el => el.textContent = `${value}${unit}`);
      }
    })
    .catch(err => {
      console.error('❌ Error fetching sensor data:', err);
      Object.values(elements).forEach(nodes =>
        nodes.forEach(el => el.textContent = 'Error')
      );
    });
}

export {
  firestore,
  db,
  dbref,
  FindSensors
};
