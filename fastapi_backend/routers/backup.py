from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from database import get_db
from models import User, Expense, Income, Category, Budget, Notification
from auth import get_current_user

router = APIRouter(prefix="/api/backup", tags=["Data Backup & Restore"])

@router.get("/export")
def export_backup(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    categories = db.query(Category).filter(Category.user_id == current_user.id, Category.is_deleted == False).all()
    expenses = db.query(Expense).filter(Expense.user_id == current_user.id, Expense.is_deleted == False).all()
    incomes = db.query(Income).filter(Income.user_id == current_user.id, Income.is_deleted == False).all()
    budgets = db.query(Budget).filter(Budget.user_id == current_user.id).all()
    notifications = db.query(Notification).filter(Notification.user_id == current_user.id).all()

    return {
        "version": "1.0",
        "exportedAt": datetime.utcnow().isoformat(),
        "user": {
            "name": current_user.name,
            "email": current_user.email,
            "currency": current_user.currency,
            "theme": current_user.theme,
            "notificationPrefs": current_user.notification_prefs,
        },
        "categories": [
            {
                "name": c.name,
                "icon": c.icon,
                "color": c.color,
                "monthly_budget": c.monthly_budget,
                "is_default": c.is_default,
            }
            for c in categories
        ],
        "expenses": [
            {
                "amount": e.amount,
                "date": e.date,
                "category_name": e.category.name if e.category else None,
                "payment_method": e.payment_method,
                "note": e.note,
                "tags": e.tags,
                "is_recurring": e.is_recurring,
                "recurrence_type": e.recurrence_type,
                "next_due_date": e.next_due_date,
                "ipo_details": e.ipo_details,
            }
            for e in expenses
        ],
        "incomes": [
            {
                "amount": i.amount,
                "source": i.source,
                "date": i.date,
                "note": i.note,
            }
            for i in incomes
        ],
        "budgets": [
            {
                "month": b.month,
                "year": b.year,
                "overall_budget": b.overall_budget,
            }
            for b in budgets
        ],
        "notifications": [
            {
                "type": n.type,
                "message": n.message,
                "is_read": n.is_read,
                "link": n.link,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notifications
        ],
    }

@router.post("/import")
def import_backup(
    payload: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = payload.get("data")
    mode = payload.get("mode", "merge")

    if not data or not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Invalid backup JSON format")

    if mode == "replace":
        db.query(Expense).filter(Expense.user_id == current_user.id).delete()
        db.query(Income).filter(Income.user_id == current_user.id).delete()
        db.query(Budget).filter(Budget.user_id == current_user.id).delete()
        db.query(Notification).filter(Notification.user_id == current_user.id).delete()
        db.query(Category).filter(Category.user_id == current_user.id, Category.is_default == False).delete()
        db.flush()

    # Category map
    existing_cats = db.query(Category).filter(Category.user_id == current_user.id).all()
    cat_map = {c.name.lower(): c.id for c in existing_cats}

    for c in data.get("categories", []):
        name = c.get("name")
        if name and name.lower() not in cat_map:
            new_cat = Category(
                user_id=current_user.id,
                name=name,
                icon=c.get("icon", "Tag"),
                color=c.get("color", "#3B82F6"),
                monthly_budget=c.get("monthly_budget", 0.0),
                is_default=False,
            )
            db.add(new_cat)
            db.flush()
            cat_map[name.lower()] = new_cat.id

    imported_expenses = 0
    for e in data.get("expenses", []):
        cat_id = None
        if e.get("category_name"):
            cat_id = cat_map.get(e["category_name"].lower())

        db.add(Expense(
            user_id=current_user.id,
            category_id=cat_id,
            amount=e.get("amount", 0.0),
            date=e.get("date", datetime.utcnow().strftime("%Y-%m-%d")),
            payment_method=e.get("payment_method", "UPI"),
            note=e.get("note", ""),
            tags=e.get("tags", []),
            is_recurring=e.get("is_recurring", False),
            recurrence_type=e.get("recurrence_type"),
            next_due_date=e.get("next_due_date"),
            ipo_details=e.get("ipo_details"),
        ))
        imported_expenses += 1

    imported_incomes = 0
    for i in data.get("incomes", []):
        db.add(Income(
            user_id=current_user.id,
            amount=i.get("amount", 0.0),
            source=i.get("source", "Other"),
            date=i.get("date", datetime.utcnow().strftime("%Y-%m-%d")),
            note=i.get("note", ""),
        ))
        imported_incomes += 1

    for b in data.get("budgets", []):
        existing_b = db.query(Budget).filter(
            Budget.user_id == current_user.id,
            Budget.month == b.get("month"),
            Budget.year == b.get("year"),
        ).first()
        if not existing_b:
            db.add(Budget(
                user_id=current_user.id,
                month=b.get("month"),
                year=b.get("year"),
                overall_budget=b.get("overall_budget", 0.0),
            ))

    db.commit()
    return {
        "message": f"Data restored successfully in {mode} mode.",
        "importedExpenses": imported_expenses,
        "importedIncomes": imported_incomes,
    }
