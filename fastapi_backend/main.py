from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base, SessionLocal
from models import User, Category, Expense, Income, Budget
from auth import get_password_hash
from routers import auth, users, expenses, income, categories, budgets, reports, backup, notifications

# Initialize tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="FinFlow API (FastAPI)",
    description="Full-stack PostgreSQL/SQLite expense & IPO blocked capital tracking backend",
    version="1.0.0",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(expenses.router)
app.include_router(income.router)
app.include_router(categories.router)
app.include_router(budgets.router)
app.include_router(reports.router)
app.include_router(backup.router)
app.include_router(notifications.router)

@app.get("/api/health", tags=["Health"])
def health_check():
    return {
        "status": "ok",
        "service": "FinFlow FastAPI Backend",
        "timestamp": datetime.utcnow().isoformat(),
    }

@app.on_event("startup")
def seed_demo_data():
    db = SessionLocal()
    try:
        # Check if demo user already exists
        demo = db.query(User).filter(User.email == "demo@example.com").first()
        if not demo:
            demo = User(
                name="Alex Morgan",
                email="demo@example.com",
                password_hash=get_password_hash("Password123!"),
                avatar="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
                currency="INR",
                theme="system",
            )
            db.add(demo)
            db.flush()

            # Seed default categories
            cats = [
                {"name": "Food & Dining", "icon": "Utensils", "color": "#EF4444", "budget": 0.0},
                {"name": "Groceries", "icon": "ShoppingCart", "color": "#10B981", "budget": 0.0},
                {"name": "Transportation & Fuel", "icon": "Bus", "color": "#F59E0B", "budget": 0.0},
                {"name": "Housing & Rent", "icon": "Home", "color": "#6366F1", "budget": 0.0},
                {"name": "Stock Market & IPOs", "icon": "Landmark", "color": "#4F46E5", "budget": 0.0},
                {"name": "Shopping & Lifestyle", "icon": "ShoppingBag", "color": "#EC4899", "budget": 0.0},
                {"name": "Healthcare & Medical", "icon": "HeartPulse", "color": "#14B8A6", "budget": 0.0},
                {"name": "Utilities & Bills", "icon": "Zap", "color": "#8B5CF6", "budget": 0.0},
                {"name": "Entertainment & OTT", "icon": "Tv", "color": "#06B6D4", "budget": 0.0},
                {"name": "Others", "icon": "Tag", "color": "#64748B", "budget": 0.0},
            ]
            cat_map = {}
            for c in cats:
                new_c = Category(
                    user_id=demo.id,
                    name=c["name"],
                    icon=c["icon"],
                    color=c["color"],
                    monthly_budget=0.0,
                    is_default=True,
                )
                db.add(new_c)
                db.flush()
                cat_map[c["name"]] = new_c.id

            today = datetime.utcnow().strftime("%Y-%m-%d")
            # Seed demo transactions
            db.add(Expense(
                user_id=demo.id,
                category_id=cat_map.get("Stock Market & IPOs"),
                amount=14950.0,
                date=today,
                payment_method="UPI",
                note="Tata Tech IPO Application",
                tags=["ipo", "mandate", "stocks"],
                ipo_details={
                    "ipoName": "Tata Tech IPO",
                    "sharesCount": 30,
                    "bidPrice": 500.0,
                    "lotSize": 1,
                    "status": "Blocked",
                    "mandateStatus": "UPI ASBA Mandate Accepted",
                }
            ))
            db.add(Expense(
                user_id=demo.id,
                category_id=cat_map.get("Housing & Rent"),
                amount=18500.0,
                date=today,
                payment_method="Net Banking",
                note="Apartment Monthly Rent",
                is_recurring=True,
                recurrence_type="monthly",
                next_due_date=today,
            ))
            db.add(Expense(
                user_id=demo.id,
                category_id=cat_map.get("Groceries"),
                amount=3420.0,
                date=today,
                payment_method="Card",
                note="Supermarket supplies & veggies",
            ))
            db.add(Income(
                user_id=demo.id,
                amount=95000.0,
                source="Salary",
                date=today,
                note="Tech Lead Monthly Salary",
            ))
            # No overall budget set by default
            db.add(Budget(
                user_id=demo.id,
                month=datetime.utcnow().month,
                year=datetime.utcnow().year,
                overall_budget=0.0,
            ))
            db.commit()
            print("FastAPI Seed: Demo user and initial financial data populated.")
    finally:
        db.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
