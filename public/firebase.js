// firebase.js
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

// ✅ Initialize Firebase services
const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);
const db = getDatabase();
const dbref = ref(db);

// ✅ ฟังก์ชันดึงข้อมูลจาก Realtime Database
function FindSensors() {
  const elements = {
    co: document.querySelectorAll(".co"),
    co2: document.querySelectorAll(".co2"),
    hcho: document.querySelectorAll(".hcho"),
    pm10: document.querySelectorAll(".pm10"),
    pm2_5: document.querySelectorAll(".pm2_5"),
    pm1_0: document.querySelectorAll(".pm1_0"),
    temp: document.querySelectorAll(".temp"),
    humidity: document.querySelectorAll(".humidity"),
    airpressure: document.querySelectorAll(".airpressure"),
    windspeed: document.querySelectorAll(".windspeed"),
    rainChance: document.querySelectorAll(".rainChance"),
  };

  get(child(dbref, "/realtime/"))
    .then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        console.log("✅ ข้อมูลที่ได้จาก Realtime Database:", data);

        for (const key in elements) {
          const value = data[key] ?? "--";
          elements[key].forEach(el => el.textContent = value);
        }
      } else {
        console.warn("⚠️ ไม่มีข้อมูลที่ path /realtime/");
        showErrorText("ไม่มีข้อมูล");
      }
    })
    .catch((error) => {
      console.error("❌ Error fetching sensor data:", error);
      showErrorText("Error");
    });

  function showErrorText(text) {
    for (const key in elements) {
      elements[key].forEach(el => el.textContent = text);
    }
  }
}

// ✅ Export ทุกอย่างที่จำเป็น
export {
  firestore, // ใช้ใน predic.js
  db,
  dbref,
  FindSensors // ใช้ใน main.js
};
