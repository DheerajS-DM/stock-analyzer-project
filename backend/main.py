import os
from pathlib import Path
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from supabase import create_client, Client
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import atexit

# --- Setup & Configuration ---

env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_ANON_KEY")
supabase: Client = None

if url and key:
    try:
        supabase = create_client(url, key)
        print("Supabase Connected")
    except Exception as e:
        print(f"Supabase Connection Failed: {e}")

app = FastAPI(title="Stock Value Analyzer", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Global Config ---

# Top 100 US Stocks (Hardcoded List)
TRACKED_STOCKS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK-B",
    "JNJ", "V", "PG", "JPM", "MA", "HD", "DIS", "MCD", "KO", "PEP", "NFLX", "INTC",
    "AMD", "IBM", "ORCL", "QCOM", "CSCO", "ADBE", "CRM", "INTU", "NOW", "SNOW",
    "DDOG", "CRWD", "ZM", "TWLO", "SQ", "PYPL", "DASH", "UBER", "LYFT", "SPOT",
    "ROKU", "TTD", "BA", "GE", "F", "GM", "T", "VZ", "TMUS", "CMCSA",
    "NKE", "SBUX", "WMT", "COST", "TGT", "LOW", "CVX", "XOM", "PFE", "MRK",
    "ABBV", "LLY", "AVGO", "TXN", "AMAT", "MU", "LRCX", "ADI", "KLAC", "PANW",
    "FTNT", "ZS", "NET", "PLTR", "U", "RBLX", "COIN", "HOOD", "DKNG", "SHOP",
    "MDB", "TEAM", "OKTA", "DOCU", "ESTC", "PATH", "GME", "AMC", "SOFI", "AFRM",
    "UPST", "OPEN", "LCID", "RIVN", "NIO", "BABA", "JD", "BIDU", "TSM", "ASML"
]

# --- Core Algorithm ---

def calculate_hybrid_value(symbol: str, decay_weight=0.7, tech_weight=0.3) -> dict:
    try:
        symbol = symbol.upper().strip()
        end_date = datetime.now()
        start_date = end_date - timedelta(days=1460) 
        
        data = yf.download(symbol, start=start_date, end=end_date, progress=False)
        
        if data.empty or len(data) < 200:
            return {"error": f"Insufficient data for {symbol}"}
        
        close_data = data['Close']
        if isinstance(close_data, pd.DataFrame):
            prices = close_data.iloc[:, 0]
        else:
            prices = close_data
            
        prices_list = prices.tolist()
        current_price = float(prices_list[-1])
        dates = [d.strftime("%Y-%m-%d") for d in data.index]

        # 1. Exponential Decay Model
        max_date = datetime.strptime(dates[-1], "%Y-%m-%d")
        ages_days = np.array([(max_date - datetime.strptime(d, "%Y-%m-%d")).days for d in dates])
        ages_years = ages_days / 365.25
        
        exp_weights = np.exp(-1.0 * ages_years)
        exp_weights = exp_weights / exp_weights.sum()
        
        weighted_avg = np.average(prices_list, weights=exp_weights)
        
        decay_ratio = current_price / weighted_avg
        decay_score = max(0, min(100, 50 + (1.0 - decay_ratio) * 100))

        # 2. Technical Analysis (RSI)
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        current_rsi = float(rsi.iloc[-1])
        
        tech_score = 100 - current_rsi

        # Final Score
        final_score = (decay_score * decay_weight) + (tech_score * tech_weight)
        
        if final_score > 70:
            signal = "STRONG BUY"
        elif final_score > 60:
            signal = "BUY"
        elif final_score < 40:
            signal = "SELL"
        else:
            signal = "HOLD"

        # Save to Database
        if supabase:
            try:
                db_record = {
                    "symbol": symbol,
                    "current_price": round(current_price, 2),
                    "final_score": round(final_score, 1),
                    "weighted_avg": round(weighted_avg, 2),
                    "signal": signal,
                    "margin": round(final_score - 50, 1),
                    "updated_at": datetime.now().isoformat()
                }
                supabase.table("stocks").upsert(db_record).execute()
            except Exception as db_err:
                print(f"DB Save skipped: {db_err}")

        return {
            "symbol": symbol,
            "current_price": round(current_price, 2),
            "final_score": round(final_score, 1),
            "signal": signal,
            "weighted_avg": round(weighted_avg, 2),
            "base_threshold": 50.0,
            "weight_recent": 0.0, 
            "components": {
                "fundamental_value": f"${weighted_avg:.2f}",
                "fundamental_score": round(decay_score, 1),
                "technical_rsi": round(current_rsi, 1),
                "technical_score": round(tech_score, 1)
            },
            "value_coefficient": round(decay_ratio, 3), 
            "margin": round(final_score - 50, 1) 
        }
        
    except Exception as e:
        print(f"Error calculating {symbol}: {e}")
        return {"error": str(e), "symbol": symbol}

# --- Scheduler Logic ---

def scheduled_analysis():
    print(f"[SCHEDULER] Starting daily analysis for {len(TRACKED_STOCKS)} stocks...")
    
    success_count = 0
    error_count = 0
    
    for symbol in TRACKED_STOCKS:
        try:
            result = calculate_hybrid_value(symbol)
            if "error" not in result:
                success_count += 1
            else:
                error_count += 1
                print(f" [ERR] {symbol}: {result.get('error')}")
        except Exception as e:
            error_count += 1
            print(f" [ERR] {symbol}: Exception {str(e)}")
    
    print(f"[SCHEDULER] Complete. {success_count} analyzed, {error_count} errors")

# Initialize Background Scheduler
scheduler = BackgroundScheduler()
scheduler.add_job(scheduled_analysis, CronTrigger(day_of_week='mon-fri', hour=9, minute=30))
scheduler.start()
atexit.register(lambda: scheduler.shutdown())

# --- API Endpoints ---

@app.get("/")
def root():
    return {"status": "Stock Value Analyzer running", "endpoints": ["/health", "/analyze/{symbol}", "/stocks"]}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.get("/stocks")
def top_stocks():
    """
    Priority: 1. DB (Fast) -> 2. Realtime Fallback (Slow)
    """
    if supabase:
        try:
            response = supabase.table("stocks").select("*").order("final_score", desc=True).execute()
            if response.data and len(response.data) > 0:
                return {
                    "stocks": response.data,
                    "total": len(response.data),
                    "source": "database_cache"
                }
        except Exception as e:
            print(f"DB Fetch failed: {e}")

    # Fallback to manual calculation if DB is empty/down
    results = []
    for symbol in TRACKED_STOCKS:
        result = calculate_hybrid_value(symbol)
        if "error" not in result:
            results.append(result)
    
    results.sort(key=lambda x: x['final_score'], reverse=True)
    return {"stocks": results, "total": len(results), "source": "real_time_computed"}

@app.get("/analyze/{symbol}")
def analyze_stock(symbol: str):
    return calculate_hybrid_value(symbol.upper())

@app.get("/history/{symbol}")
def get_stock_history(symbol: str):
    try:
        stock = yf.Ticker(symbol)
        hist = stock.history(period="1y")
        
        chart_data = []
        for date, row in hist.iterrows():
            chart_data.append({
                "date": date.strftime("%Y-%m-%d"),
                "price": round(row['Close'], 2)
            })
            
        return {"data": chart_data}
    except Exception as e:
        return {"error": str(e)}

@app.get("/trigger-scheduler")
def trigger_scheduler():
    try:
        scheduled_analysis()
        return {"status": "scheduler_triggered"}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)