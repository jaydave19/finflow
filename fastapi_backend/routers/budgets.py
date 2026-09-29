from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import User, Budget, Expense, Category
from schemas import BudgetSetRequest
from auth import get_current_user

router = APIRouter(prefix="/api/budgets", tags=["Budgets"])

@router.get("/")
def get_budgets(
    month: int = Query(default=datetime.utcnow().month),
    year: int = Query(default=datetime.utcnow().year),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    month_start = f"{year}-{str(month).zfill(2)}-01"
    month_end = f"{year}-{str(month).zfill(2)}-31"

    budget_record = db.query(Budget).filter(
        Budget.user_id == current_user.id,
        Budget.month == month,
        Budget.year == year,
    ).first()
    overall_budget = budget_record.overall_budget if budget_record else 0.0

    total_spent_res = db.query(func.coalesce(func.sum(Expense.amount), 0.0)).filter(
        Expense.user_id == current_user.id,
        Expense.is_deleted == False,
        Expense.date >= month_start,
        Expense.date <= month_end,
    ).scalar()
    total_spent = float(total_spent_res or 0.0)

    categories = db.query(Category).filter(
        Category.user_id == current_user.id,
        Category.is_deleted == False,
    ).order_by(Category.name.asc()).all()

    cat_list = []
    for c in categories:
        spent = db.query(func.coalesce(func.sum(Expense.amount), 0.0)).filter(
            Expense.user_id == current_user.id,
            Expense.category_id == c.id,
            Expense.is_deleted == False,
            Expense.date >= month_start,
            Expense.date <= month_end,
        ).scalar()
        spent_val = float(spent or 0.0)
        b = float(c.monthly_budget or 0.0)
        percentage = round((spent_val / b) * 100) if b > 0 else 0

        cat_list.append({
            "id": c.id,
            "name": c.name,
            "icon": c.icon,
            "color": c.color,
            "budget": b,
            "spent": spent_val,
            "remaining": max(0.0, b - spent_val),
            "percentage": min(100, percentage),
            "isExceeded": b > 0 and spent_val > b,
            "isWarning": b > 0 and spent_val >= b * 0.8 and spent_val <= b,
        })

    pct_used = round((total_spent / overall_budget) * 100) if overall_budget > 0 else 0

    return {
        "month": month,
        "year": year,
        "overallBudget": overall_budget,
        "totalSpent": total_spent,
        "remainingBudget": max(0.0, overall_budget - total_spent),
        "percentageUsed": min(100, pct_used),
        "isOverallExceeded": overall_budget > 0 and total_spent > overall_budget,
        "isOverallWarning": overall_budget > 0 and total_spent >= overall_budget * 0.8 and total_spent <= overall_budget,
        "categories": cat_list,
    }

@router.put("/")
def set_budget(
    req: BudgetSetRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if req.overallBudget is not None:
        b = db.query(Budget).filter(
            Budget.user_id == current_user.id,
            Budget.month == req.month,
            Budget.year == req.year,
        ).first()
        if b:
            b.overall_budget = req.overallBudget
        else:
            b = Budget(
                user_id=current_user.id,
                month=req.month,
                year=req.year,
                overall_budget=req.overallBudget,
            )
            db.add(b)

    if req.categoryBudgets:
        for item in req.categoryBudgets:
            cat = db.query(Category).filter(
                Category.id == item.categoryId,
                Category.user_id == current_user.id,
            ).first()
            if cat:
                cat.monthly_budget = item.monthlyBudget

    db.commit()
    return {"message": "Budget saved successfully"}
