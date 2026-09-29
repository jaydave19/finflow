import io
from datetime import datetime, date
from typing import Optional
from fastapi import APIRouter, Depends, Query, Response, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
import pandas as pd
from database import get_db
from models import User, Expense, Income, Category
from auth import get_current_user

router = APIRouter(prefix="/api/reports", tags=["Reports & Analytics"])

@router.get("/monthly")
def get_monthly_report(
    month: int = Query(default=datetime.utcnow().month),
    year: int = Query(default=datetime.utcnow().year),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_month_start = f"{year}-{str(month).zfill(2)}-01"
    current_month_end = f"{year}-{str(month).zfill(2)}-31"

    prev_month = 12 if month == 1 else month - 1
    prev_year = year - 1 if month == 1 else year
    prev_month_start = f"{prev_year}-{str(prev_month).zfill(2)}-01"
    prev_month_end = f"{prev_year}-{str(prev_month).zfill(2)}-31"

    # Current month expenses
    expenses = db.query(Expense).filter(
        Expense.user_id == current_user.id,
        Expense.is_deleted == False,
        Expense.date >= current_month_start,
        Expense.date <= current_month_end,
    ).all()

    total_expense = sum(e.amount for e in expenses)
    transaction_count = len(expenses)

    # Previous month expenses
    prev_exp_sum = db.query(func.coalesce(func.sum(Expense.amount), 0.0)).filter(
        Expense.user_id == current_user.id,
        Expense.is_deleted == False,
        Expense.date >= prev_month_start,
        Expense.date <= prev_month_end,
    ).scalar()
    prev_total_expense = float(prev_exp_sum or 0.0)

    expense_change_pct = round(((total_expense - prev_total_expense) / prev_total_expense) * 100) if prev_total_expense > 0 else 0

    # Current month incomes
    incomes = db.query(Income).filter(
        Income.user_id == current_user.id,
        Income.is_deleted == False,
        Income.date >= current_month_start,
        Income.date <= current_month_end,
    ).all()
    total_income = sum(i.amount for i in incomes)
    net_savings = total_income - total_expense
    savings_rate = round((net_savings / total_income) * 100) if total_income > 0 else 0

    # Category Breakdown
    cat_amounts: dict = {}
    cat_counts: dict = {}
    for e in expenses:
        cat_name = e.category.name if e.category else "Uncategorized"
        cat_color = e.category.color if e.category else "#64748B"
        cat_icon = e.category.icon if e.category else "Tag"
        cat_id = e.category_id or "other"

        if cat_name not in cat_amounts:
            cat_amounts[cat_name] = {"id": cat_id, "color": cat_color, "icon": cat_icon, "amount": 0.0}
            cat_counts[cat_name] = 0
        cat_amounts[cat_name]["amount"] += e.amount
        cat_counts[cat_name] += 1

    category_breakdown = []
    for name, info in sorted(cat_amounts.items(), key=lambda x: x[1]["amount"], reverse=True):
        if info["amount"] > 0:
            category_breakdown.append({
                "id": info["id"],
                "name": name,
                "icon": info["icon"],
                "color": info["color"],
                "amount": info["amount"],
                "count": cat_counts[name],
                "percentage": round((info["amount"] / total_expense) * 100) if total_expense > 0 else 0,
            })

    highest_category = category_breakdown[0] if category_breakdown else None
    lowest_category = category_breakdown[-1] if category_breakdown else None

    # Top 5 highest expenses
    top_5 = sorted(expenses, key=lambda e: e.amount, reverse=True)[:5]
    top_5_list = [
        {
            "id": e.id,
            "amount": e.amount,
            "date": e.date,
            "paymentMethod": e.payment_method,
            "note": e.note,
            "categoryName": e.category.name if e.category else "Uncategorized",
            "categoryColor": e.category.color if e.category else "#64748B",
            "ipoDetails": e.ipo_details,
        }
        for e in top_5
    ]

    # Daily spending trend
    daily_map: dict = {}
    for e in expenses:
        daily_map[e.date] = daily_map.get(e.date, 0.0) + e.amount

    daily_spending = [
        {"date": d, "day": int(d.split("-")[2]), "amount": amt}
        for d, amt in sorted(daily_map.items())
    ]

    # Payment Methods
    pm_map: dict = {}
    for e in expenses:
        pm = e.payment_method or "UPI"
        if pm not in pm_map:
            pm_map[pm] = {"amount": 0.0, "count": 0}
        pm_map[pm]["amount"] += e.amount
        pm_map[pm]["count"] += 1

    payment_methods = [
        {
            "method": pm,
            "amount": val["amount"],
            "count": val["count"],
            "percentage": round((val["amount"] / total_expense) * 100) if total_expense > 0 else 0,
        }
        for pm, val in sorted(pm_map.items(), key=lambda x: x[1]["amount"], reverse=True)
    ]

    # Day of week
    day_names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    day_stats = {d: {"amount": 0.0, "count": 0} for d in day_names}
    for e in expenses:
        try:
            dt = datetime.strptime(e.date, "%Y-%m-%d")
            # In Python weekday(): Mon=0 ... Sun=6. Let's map to Sun=0
            dow_idx = (dt.weekday() + 1) % 7
            day_label = day_names[dow_idx]
            day_stats[day_label]["amount"] += e.amount
            day_stats[day_label]["count"] += 1
        except Exception:
            pass

    day_of_week_spending = [
        {"day": d, "amount": day_stats[d]["amount"], "count": day_stats[d]["count"]}
        for d in day_names
    ]

    # Stock Market & IPO Blocked Capital summary
    all_ipo_expenses = db.query(Expense).filter(
        Expense.user_id == current_user.id,
        Expense.is_deleted == False,
        Expense.ipo_details.isnot(None),
    ).all()

    total_ipo_blocked = 0.0
    active_ipo_count = 0
    active_ipos = []
    for e in all_ipo_expenses:
        details = e.ipo_details or {}
        st = details.get("status", "Blocked")
        if st in ("Blocked", "Applied"):
            total_ipo_blocked += e.amount
            active_ipo_count += 1
            active_ipos.append({
                "id": e.id,
                "amount": e.amount,
                "date": e.date,
                "note": e.note,
                "details": details,
            })

    # Past 6-Months Trend
    monthly_trends = []
    for i in range(5, -1, -1):
        m_idx = month - i
        y_val = year
        while m_idx <= 0:
            m_idx += 12
            y_val -= 1
        m_start = f"{y_val}-{str(m_idx).zfill(2)}-01"
        m_end = f"{y_val}-{str(m_idx).zfill(2)}-31"

        exp_sum = db.query(func.coalesce(func.sum(Expense.amount), 0.0)).filter(
            Expense.user_id == current_user.id,
            Expense.is_deleted == False,
            Expense.date >= m_start,
            Expense.date <= m_end,
        ).scalar()
        inc_sum = db.query(func.coalesce(func.sum(Income.amount), 0.0)).filter(
            Income.user_id == current_user.id,
            Income.is_deleted == False,
            Income.date >= m_start,
            Income.date <= m_end,
        ).scalar()

        m_date = date(y_val, m_idx, 1)
        monthly_trends.append({
            "label": f"{m_date.strftime('%b')} {y_val}",
            "month": m_idx,
            "year": y_val,
            "expense": float(exp_sum or 0.0),
            "income": float(inc_sum or 0.0),
            "savings": float(inc_sum or 0.0) - float(exp_sum or 0.0),
        })

    return {
        "month": month,
        "year": year,
        "summary": {
            "totalIncome": total_income,
            "totalExpense": total_expense,
            "netSavings": net_savings,
            "savingsRate": savings_rate,
            "transactionCount": transaction_count,
            "prevTotalExpense": prev_total_expense,
            "expenseChangePct": expense_change_pct,
            "averageDailySpend": round(total_expense / len(daily_spending)) if daily_spending else 0,
            "totalIpoBlocked": total_ipo_blocked,
            "activeIpoCount": active_ipo_count,
        },
        "categoryBreakdown": category_breakdown,
        "highestCategory": highest_category,
        "lowestCategory": lowest_category,
        "top5Expenses": top_5_list,
        "dailySpending": daily_spending,
        "paymentMethods": payment_methods,
        "dayOfWeekSpending": day_of_week_spending,
        "monthlyTrends": monthly_trends,
        "activeIpos": active_ipos,
    }

@router.get("/insights")
def get_insights(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = datetime.utcnow()
    month = now.month
    year = now.year

    current_month_start = f"{year}-{str(month).zfill(2)}-01"
    current_month_end = f"{year}-{str(month).zfill(2)}-31"

    prev_month = 12 if month == 1 else month - 1
    prev_year = year - 1 if month == 1 else year
    prev_month_start = f"{prev_year}-{str(prev_month).zfill(2)}-01"
    prev_month_end = f"{prev_year}-{str(prev_month).zfill(2)}-31"

    insights = []

    # Category comparisons
    categories = db.query(Category).filter(Category.user_id == current_user.id, Category.is_deleted == False).all()
    for cat in categories:
        cur_spent = db.query(func.coalesce(func.sum(Expense.amount), 0.0)).filter(
            Expense.user_id == current_user.id,
            Expense.category_id == cat.id,
            Expense.is_deleted == False,
            Expense.date >= current_month_start,
            Expense.date <= current_month_end,
        ).scalar()
        prev_spent = db.query(func.coalesce(func.sum(Expense.amount), 0.0)).filter(
            Expense.user_id == current_user.id,
            Expense.category_id == cat.id,
            Expense.is_deleted == False,
            Expense.date >= prev_month_start,
            Expense.date <= prev_month_end,
        ).scalar()

        c_val = float(cur_spent or 0.0)
        p_val = float(prev_spent or 0.0)
        if p_val > 0:
            diff = round(((c_val - p_val) / p_val) * 100)
            if diff >= 20:
                insights.append({
                    "id": f"diff-{cat.name}",
                    "type": "warning",
                    "title": f"{cat.name} spending spiked",
                    "message": f"You spent {diff}% more on {cat.name} this month compared to last month (₹{int(c_val):,} vs ₹{int(p_val):,}).",
                })
            elif diff <= -20:
                insights.append({
                    "id": f"save-{cat.name}",
                    "type": "positive",
                    "title": f"Great job on {cat.name}!",
                    "message": f"You cut down {cat.name} spending by {abs(diff)}% compared to last month.",
                })

    # IPO blocked insight
    ipo_expenses = db.query(Expense).filter(
        Expense.user_id == current_user.id,
        Expense.is_deleted == False,
        Expense.ipo_details.isnot(None),
    ).all()
    ipo_total = 0.0
    active_ipo_bids = 0
    for e in ipo_expenses:
        st = (e.ipo_details or {}).get("status", "Blocked")
        if st in ("Blocked", "Applied"):
            ipo_total += e.amount
            active_ipo_bids += 1

    if ipo_total > 0:
        insights.append({
            "id": "ipo-blocked",
            "type": "info",
            "title": "IPO Capital Blocked in Mandates",
            "message": f"You currently have ₹{int(ipo_total):,} blocked across {active_ipo_bids} active IPO application(s). Funds will be debited only upon allotment or unblocked otherwise.",
        })

    if len(insights) < 3:
        insights.append({
            "id": "savings-tip",
            "type": "tip",
            "title": "50/30/20 Rule Recommendation",
            "message": "Aim to allocate 50% of income to needs, 30% to wants, and 20% to savings and investment channels.",
        })

    return {"insights": insights}

@router.get("/export")
def export_report(
    format: str = Query("csv"),
    month: int = Query(default=datetime.utcnow().month),
    year: int = Query(default=datetime.utcnow().year),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    m_start = f"{year}-{str(month).zfill(2)}-01"
    m_end = f"{year}-{str(month).zfill(2)}-31"

    expenses = db.query(Expense).filter(
        Expense.user_id == current_user.id,
        Expense.is_deleted == False,
        Expense.date >= m_start,
        Expense.date <= m_end,
    ).order_by(Expense.date.asc()).all()

    data = []
    for e in expenses:
        ipo = e.ipo_details or {}
        ipo_desc = f"{ipo.get('ipoName', '')} ({ipo.get('status', '')})" if ipo else ""
        data.append({
            "Date": e.date,
            "Category": e.category.name if e.category else "Uncategorized",
            "Amount": e.amount,
            "Payment Method": e.payment_method,
            "Note": e.note or "",
            "IPO/Share Details": ipo_desc,
        })

    df = pd.DataFrame(data)

    if format.lower() == "csv":
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        return Response(
            content=csv_buffer.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=Expense_Report_{year}_{month}.csv"}
        )

    if format.lower() == "xlsx":
        excel_buffer = io.BytesIO()
        with pd.ExcelWriter(excel_buffer, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Expenses")
        excel_buffer.seek(0)
        return Response(
            content=excel_buffer.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=Expense_Report_{year}_{month}.xlsx"}
        )

    raise HTTPException(status_code=400, detail="Invalid format. Supported: csv, xlsx")
