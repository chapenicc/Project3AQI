import os
import firebase_admin
from firebase_admin import credentials, firestore
import pandas as pd
import numpy as np
import requests
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

# === OpenWeather config ===

API_KEY = "e5d06f804986aee2b7fbef62dd81435d"

if not API_KEY:
    raise RuntimeError("❌ Please set the OPENWEATHER_API_KEY environment variable")
LAT, LON = 13.85527, 100.58532

def fetch_onecall(next_n_days=5):
    url = (
        f"https://api.openweathermap.org/data/2.5/onecall"
        f"?lat={LAT}&lon={LON}"
        "&exclude=current,minutely,hourly,alerts"
        "&units=metric"
        f"&appid={API_KEY}"
    )
    res = requests.get(url)
    res.raise_for_status()
    daily = res.json().get("daily", [])
    out = {}
    for i, day in enumerate(daily[1:1+next_n_days], start=1):
        date_str = (now().date() + timedelta(days=i)).isoformat()
        out[date_str] = round((day.get("pop") or 0) * 100)
    return out

def fetch_forecast_rain_chance(next_n_days=5):
    """Fallback: ใช้ 5-วัน/3-ชั่วโมง Forecast API"""
    url = (
        f"https://api.openweathermap.org/data/2.5/forecast"
        f"?lat={LAT}&lon={LON}"
        "&units=metric"
        f"&appid={API_KEY}"
    )
    res = requests.get(url)
    res.raise_for_status()
    data = res.json().get("list", [])
    today = now().date()
    daily_pops = {}
    for item in data:
        dt = datetime.fromtimestamp(item["dt"], tz=tz)
        date_str = dt.date().isoformat()
        pop = (item.get("pop") or 0) * 100
        daily_pops.setdefault(date_str, []).append(pop)

    out = {}
    for i in range(1, next_n_days+1):
        d = (today + timedelta(days=i)).isoformat()
        pops = daily_pops.get(d, [])
        out[d] = round(sum(pops)/len(pops)) if pops else 0
    return out

def fetch_rain_chance(next_n_days=5):
    try:
        return fetch_onecall(next_n_days)
    except requests.HTTPError as e:
        if e.response.status_code == 401:
            print("🔄 OneCall API unauthorized. Fallback to Forecast API.")
            return fetch_forecast_rain_chance(next_n_days)
        else:
            raise

# === Init Firebase ===
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()
sensor_ref = db.collection('sensor_data')

# === 1. หาวันล่าสุดที่มีข้อมูล ===
latest_docs = (sensor_ref
    .order_by('date', direction=firestore.Query.DESCENDING)
    .limit(1).get())
if not latest_docs:
    raise RuntimeError("No sensor data at all!")
latest_raw = latest_docs[0].to_dict().get('date')
latest = (datetime.fromisoformat(latest_raw)
          if isinstance(latest_raw, str) else latest_raw)
if latest.tzinfo is None:
    latest = latest.replace(tzinfo=tz)

# === 2. ตั้งค่า window ===
MAX_DAYS, MIN_DAYS = 90, 30
start_90 = latest - timedelta(days=MAX_DAYS)

# === 3. ดึงข้อมูลย้อนหลังช่วง 90 วัน ===
docs_90 = sensor_ref.where('date', '>=', start_90).get()
if len(docs_90) >= MIN_DAYS:
    raw = [d.to_dict() for d in docs_90]
else:
    raw = [d.to_dict() for d in
           sensor_ref.order_by('date').limit_to_last(MIN_DAYS).get()]
if not raw:
    raise RuntimeError("No data to train with!")

# === 4. เตรียม DataFrame ===
df = pd.DataFrame(raw)
df['date'] = pd.to_datetime(df['date'], errors='coerce')
df = df.sort_values('date').ffill().dropna()

# === 5. สร้าง X_raw โดยไม่ใช้ rainChance ===
features = ['pm25', 'pm10', 'no2', 'o3', 'humidity', 'temperature']
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

# === 8. Predict next 5 days ===
predictions = []
current = X_scaled[-1]
for _ in range(5):
    p_scaled = model.predict(current.reshape(1, 1, len(features)))
    p = scaler.inverse_transform(p_scaled)[0]
    predictions.append(p)
    current = p_scaled

# === 9. ดึง rainChance จาก API (fallback อัตโนมัติ) ===
rain_map = fetch_rain_chance(len(predictions))
print("Fetched rainChance:", rain_map)

# === 10. บันทึกผลลง Firestore ===
today = now().date()

# 10.1 One-day prediction
one_day = dict(zip(features, predictions[0]))
one_day_date = (today + timedelta(days=1)).isoformat()
one_day['rainChance'] = rain_map.get(one_day_date)
one_day['date']       = one_day_date
db.collection('predictions').document('next_day') \
  .set(convert_numpy_types(one_day))
print(f"Saved next_day with rainChance={one_day['rainChance']}")

# 10.2 Next 5 days predictions
next_5 = {}
for i, p in enumerate(predictions, start=1):
    date_str = (today + timedelta(days=i)).isoformat()
    entry = dict(zip(features, p))
    entry['rainChance'] = rain_map.get(date_str)
    entry['date']       = date_str
    next_5[date_str]    = convert_numpy_types(entry)

db.collection('predictions').document('next_5_days') \
  .set(next_5)
print("Saved next_5_days with rainChance values.")
