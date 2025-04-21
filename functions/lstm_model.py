import firebase_admin
from firebase_admin import credentials, firestore
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from keras.models import Sequential
from keras.layers import LSTM, Dense
from sklearn.preprocessing import MinMaxScaler

# (Optional) enforce Bangkok timezone for “today”
try:
    from zoneinfo import ZoneInfo
    tz = ZoneInfo("Asia/Bangkok")
    now = lambda: datetime.now(tz)
except ImportError:
    import pytz
    tz = pytz.timezone("Asia/Bangkok")
    now = lambda: datetime.now(tz)

# === Helper: Convert numpy types to Python native types ===
def convert_numpy_types(data_dict):
    return {
        k: (int(v) if isinstance(v, (np.integer,)) else float(v))
            if isinstance(v, (np.floating, np.integer))
            else v
        for k, v in data_dict.items()
    }

# === Init Firebase ===
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()
sensor_ref = db.collection('sensor_data')

# === 1. หาวันล่าสุดที่มีข้อมูล ===
latest_docs = sensor_ref \
    .order_by('date', direction=firestore.Query.DESCENDING) \
    .limit(1) \
    .get()

if not latest_docs:
    raise RuntimeError("No sensor data at all!")

latest_raw = latest_docs[0].to_dict().get('date')
latest = (datetime.fromisoformat(latest_raw)
          if isinstance(latest_raw, str)
          else latest_raw)
if latest.tzinfo is None:
    latest = latest.replace(tzinfo=tz)

# === 2. ตั้งค่า window ===
MAX_DAYS = 90
MIN_DAYS = 30
start_90 = latest - timedelta(days=MAX_DAYS)

# === 3. ดึงข้อมูลย้อนหลังช่วง 90 วัน ===
docs_90 = sensor_ref.where('date', '>=', start_90).get()
if len(docs_90) >= MIN_DAYS:
    raw = [d.to_dict() for d in docs_90]
else:
    docs_fallback = sensor_ref \
        .order_by('date') \
        .limit_to_last(MIN_DAYS) \
        .get()
    raw = [d.to_dict() for d in docs_fallback]

if not raw:
    raise RuntimeError("No data to train with!")

# === 4. เตรียม DataFrame & เติม rainChance ===
df = pd.DataFrame(raw)
df['date'] = pd.to_datetime(df['date'], errors='coerce')
df = df.sort_values('date').ffill().dropna()

# ให้แน่ใจว่าเรามีคอลัมน์ rainChance (เติม default=0 ถ้า missing)
if 'rainChance' not in df.columns:
    df['rainChance'] = 0.0

# === 5. สร้าง X_raw โดยเพิ่ม rainChance ===
features = ['pm25', 'pm10', 'no2', 'o3', 'humidity', 'temperature', 'rainChance']
X_raw = df[features].values

# === 6. Scale & reshape ===
scaler = MinMaxScaler()
X_scaled = scaler.fit_transform(X_raw)
X_scaled = X_scaled.reshape((X_scaled.shape[0], 1, X_scaled.shape[1]))

# === 7. สร้าง & train LSTM ===
model = Sequential([
    LSTM(64, input_shape=(1, len(features))),
    Dense(len(features))
])
model.compile(loss='mse', optimizer='adam')
model.fit(X_scaled, X_scaled, epochs=10, batch_size=8, verbose=1)

# === 8. Predict next 5 days (convert rainChance → % and clamp ≥ 0) ===
rain_idx = features.index('rainChance')
predictions = []
current = X_scaled[-1]

for _ in range(5):
    p_scaled = model.predict(current.reshape(1, 1, len(features)))
    p = scaler.inverse_transform(p_scaled)[0]
    # clamp negative, convert to percentage
    raw_rc = p[rain_idx]
    pct_rc = max(raw_rc, 0) * 100
    p[rain_idx] = pct_rc
    predictions.append(p)
    current = p_scaled

# === 9. บันทึกผลลง Firestore (ใช้ “วันนี้” แทน latest sensor) ===
today = now().date()

# 9.1 One‑day prediction
one_day = dict(zip(features, predictions[0]))
one_day['rainChance'] = round(one_day['rainChance'], 2)
one_day['date'] = (today + timedelta(days=1)).strftime('%Y-%m-%d')
one_day = convert_numpy_types(one_day)
db.collection('predictions').document('next_day').set(one_day)

# 9.2 Next 5 days predictions
next_5 = {}
for i, p in enumerate(predictions, start=1):
    day_str = (today + timedelta(days=i)).strftime('%Y-%m-%d')
    entry = dict(zip(features, p))
    entry['rainChance'] = round(entry['rainChance'], 2)
    next_5[day_str] = convert_numpy_types(entry)

db.collection('predictions').document('next_5_days').set(next_5)

print("✅ Predictions updated successfully.")
