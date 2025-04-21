const admin = require('firebase-admin');
const averageRTDBtoFirestore = require('./averageRTDBtoFirestore');
const serviceAccount = require('./serviceAccountKey.json'); // 👈 แก้ให้ตรงชื่อไฟล์ของคุณ

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://air-qulity-in-u-default-rtdb.asia-southeast1.firebasedatabase.app/" // 👈 แก้ให้ตรงโปรเจกต์ของคุณ
});

// ✅ วันที่ที่ต้องการรัน manual
const dateToRun = '2025-04-22'; // เปลี่ยนวันตามต้องการ

// 👉 ปรับ rainChance ให้เร็วขึ้นโดยแก้ fetchRainChance ด้านในก่อน
averageRTDBtoFirestore(dateToRun, {
  rainRetry: 1,     // ✅ ลด retry เหลือ 1
  retryDelay: 1000  // ✅ หน่วงแค่ 1 วินาที
})
  .then(() => {
    console.log(`✅ Manual run success for ${dateToRun}`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Manual run failed:', err);
    process.exit(1);
  });
