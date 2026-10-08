"""
IPO Tracker Router
Dedicated endpoint for tracking IPO / stock applications.
Data is stored in the Expense table with ipo_details populated.
These are intentionally excluded from standard expense totals
(filtered out in reports) so blocked capital doesn't inflate budgets.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models import User, Expense, Category
from auth import get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/api/ipos", tags=["IPO / Stock Tracker"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class IpoCreate(BaseModel):
    ipoName: str
    amount: float
    applicationDate: str           # YYYY-MM-DD
    paymentMethod: Optional[str] = "UPI"
    sharesCount: Optional[int] = None
    bidPrice: Optional[float] = None
    lotSize: Optional[int] = 1
    status: Optional[str] = "Blocked"   # Blocked | Allotted | Refunded | Sold
    mandateStatus: Optional[str] = None
    soldPrice: Optional[float] = None
    bankName: Optional[str] = None
    dematAccount: Optional[str] = None
    note: Optional[str] = None


class IpoUpdate(BaseModel):
    ipoName: Optional[str] = None
    amount: Optional[float] = None
    applicationDate: Optional[str] = None
    paymentMethod: Optional[str] = None
    sharesCount: Optional[int] = None
    bidPrice: Optional[float] = None
    lotSize: Optional[int] = None
    status: Optional[str] = None
    mandateStatus: Optional[str] = None
    soldPrice: Optional[float] = None
    bankName: Optional[str] = None
    dematAccount: Optional[str] = None
    note: Optional[str] = None


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _serialize_ipo(e: Expense) -> dict:
    details = e.ipo_details or {}
    shares = details.get("sharesCount")
    bid_p = details.get("bidPrice")
    sold_p = details.get("soldPrice")

    # Compute Profit/Loss
    profit_loss = None
    profit_loss_pct = None
    total_realized_value = None

    if sold_p is not None:
        try:
            sold_p_val = float(sold_p)
            # If sharesCount is available, calculate based on shares * soldPrice
            if shares and float(shares) > 0:
                shares_val = float(shares)
                total_realized_value = round(shares_val * sold_p_val, 2)
                # cost is e.amount (or shares * bid_price)
                cost = e.amount if e.amount and e.amount > 0 else (shares_val * float(bid_p or 0))
                profit_loss = round(total_realized_value - cost, 2)
                profit_loss_pct = round((profit_loss / cost) * 100, 2) if cost > 0 else 0.0
            elif bid_p and float(bid_p) > 0:
                # Per share percentage
                bid_val = float(bid_p)
                profit_loss_pct = round(((sold_p_val - bid_val) / bid_val) * 100, 2)
                if e.amount and e.amount > 0:
                    profit_loss = round(e.amount * (profit_loss_pct / 100), 2)
                    total_realized_value = round(e.amount + profit_loss, 2)
        except Exception:
            pass

    return {
        "id": e.id,
        "ipoName": details.get("ipoName", e.note or "Unknown IPO"),
        "amount": e.amount,
        "applicationDate": e.date,
        "paymentMethod": e.payment_method,
        "sharesCount": shares,
        "bidPrice": bid_p,
        "lotSize": details.get("lotSize", 1),
        "status": details.get("status", "Blocked"),
        "mandateStatus": details.get("mandateStatus"),
        "soldPrice": sold_p,
        "profitLoss": profit_loss,
        "profitLossPct": profit_loss_pct,
        "totalRealizedValue": total_realized_value,
        "bankName": details.get("bankName"),
        "dematAccount": details.get("dematAccount"),
        "note": e.note,
        "createdAt": e.created_at.isoformat() if e.created_at else None,
    }


def _ipo_category_id(db: Session, user_id: str) -> Optional[str]:
    """Find the Stock Market / IPO category for this user (or None)."""
    cat = db.query(Category).filter(
        Category.user_id == user_id,
        Category.name.ilike("%stock%"),
        Category.is_deleted == False,
    ).first()
    if not cat:
        cat = db.query(Category).filter(
            Category.user_id == user_id,
            Category.name.ilike("%ipo%"),
            Category.is_deleted == False,
        ).first()
    return cat.id if cat else None


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.get("/")
def list_ipos(
    statusFilter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Expense).filter(
        Expense.user_id == current_user.id,
        Expense.ipo_details.isnot(None),
        Expense.ipo_details != "null",
        Expense.is_deleted == False,
    ).order_by(desc(Expense.date), desc(Expense.created_at))

    expenses = query.all()

    # Filter out in python in case of empty dict or None
    ipos = [_serialize_ipo(e) for e in expenses if e.ipo_details and isinstance(e.ipo_details, dict) and any(e.ipo_details.values())]

    # Apply optional status filter (done in-memory since ipo_details is JSON)
    if statusFilter and statusFilter != "ALL":
        ipos = [i for i in ipos if i["status"] == statusFilter]

    # Compute aggregate stats
    blocked = [i for i in ipos if i["status"] == "Blocked"]
    allotted = [i for i in ipos if i["status"] == "Allotted"]
    refunded = [i for i in ipos if i["status"] == "Refunded"]
    sold = [i for i in ipos if i["status"] == "Sold"]

    total_profit_loss = sum(i["profitLoss"] for i in sold if i.get("profitLoss") is not None)
    total_realized_value = sum(i["totalRealizedValue"] for i in sold if i.get("totalRealizedValue") is not None)

    stats = {
        "totalBlockedAmount": sum(i["amount"] for i in blocked),
        "blockedCount": len(blocked),
        "totalAllottedAmount": sum(i["amount"] for i in allotted),
        "allottedCount": len(allotted),
        "totalRefundedAmount": sum(i["amount"] for i in refunded),
        "soldCount": len(sold),
        "totalProfitLoss": round(total_profit_loss, 2),
        "totalRealizedValue": round(total_realized_value, 2),
        "totalApplications": len(ipos),
    }

    return {"ipos": ipos, "stats": stats}


@router.get("/{ipo_id}")
def get_ipo(
    ipo_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expense = db.query(Expense).filter(
        Expense.id == ipo_id,
        Expense.user_id == current_user.id,
        Expense.ipo_details.isnot(None),
        Expense.ipo_details != "null",
        Expense.is_deleted == False,
    ).first()
    if not expense or not expense.ipo_details or not isinstance(expense.ipo_details, dict):
        raise HTTPException(status_code=404, detail="IPO application not found")
    return _serialize_ipo(expense)


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_ipo(
    ipo_in: IpoCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if ipo_in.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    ipo_details = {
        "ipoName": ipo_in.ipoName,
        "sharesCount": ipo_in.sharesCount,
        "bidPrice": ipo_in.bidPrice,
        "lotSize": ipo_in.lotSize or 1,
        "status": ipo_in.status or "Blocked",
        "mandateStatus": ipo_in.mandateStatus or "UPI ASBA Mandate Accepted",
        "soldPrice": ipo_in.soldPrice,
        "bankName": ipo_in.bankName,
        "dematAccount": ipo_in.dematAccount,
    }

    expense = Expense(
        user_id=current_user.id,
        category_id=_ipo_category_id(db, current_user.id),
        amount=ipo_in.amount,
        date=ipo_in.applicationDate,
        payment_method=ipo_in.paymentMethod or "UPI",
        note=ipo_in.note or f"{ipo_in.ipoName} IPO Application",
        tags=["ipo", "mandate", "stocks"],
        ipo_details=ipo_details,
    )

    db.add(expense)
    db.commit()
    db.refresh(expense)

    return {"id": expense.id, "message": "IPO application recorded successfully"}


@router.put("/{ipo_id}")
def update_ipo(
    ipo_id: str,
    ipo_in: IpoUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expense = db.query(Expense).filter(
        Expense.id == ipo_id,
        Expense.user_id == current_user.id,
        Expense.ipo_details.isnot(None),
        Expense.ipo_details != "null",
        Expense.is_deleted == False,
    ).first()
    if not expense or not expense.ipo_details or not isinstance(expense.ipo_details, dict):
        raise HTTPException(status_code=404, detail="IPO application not found")

    # Merge updates into existing ipo_details dict
    details = dict(expense.ipo_details or {})

    if ipo_in.ipoName is not None:
        details["ipoName"] = ipo_in.ipoName
    if ipo_in.sharesCount is not None:
        details["sharesCount"] = ipo_in.sharesCount
    if ipo_in.bidPrice is not None:
        details["bidPrice"] = ipo_in.bidPrice
    if ipo_in.lotSize is not None:
        details["lotSize"] = ipo_in.lotSize
    if ipo_in.status is not None:
        details["status"] = ipo_in.status
    if ipo_in.mandateStatus is not None:
        details["mandateStatus"] = ipo_in.mandateStatus
    if ipo_in.soldPrice is not None:
        details["soldPrice"] = ipo_in.soldPrice
    if ipo_in.bankName is not None:
        details["bankName"] = ipo_in.bankName
    if ipo_in.dematAccount is not None:
        details["dematAccount"] = ipo_in.dematAccount

    expense.ipo_details = details

    if ipo_in.amount is not None:
        expense.amount = ipo_in.amount
    if ipo_in.applicationDate is not None:
        expense.date = ipo_in.applicationDate
    if ipo_in.paymentMethod is not None:
        expense.payment_method = ipo_in.paymentMethod
    if ipo_in.note is not None:
        expense.note = ipo_in.note

    db.commit()
    return {"message": "IPO application updated successfully"}


@router.delete("/{ipo_id}")
def delete_ipo(
    ipo_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expense = db.query(Expense).filter(
        Expense.id == ipo_id,
        Expense.user_id == current_user.id,
        Expense.ipo_details.isnot(None),
        Expense.ipo_details != "null",
        Expense.is_deleted == False,
    ).first()
    if not expense:
        raise HTTPException(status_code=404, detail="IPO application not found")

    expense.is_deleted = True
    expense.deleted_at = datetime.utcnow()
    db.commit()

    return {"message": "IPO application removed", "id": ipo_id}


@router.post("/{ipo_id}/restore")
def restore_ipo(
    ipo_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expense = db.query(Expense).filter(
        Expense.id == ipo_id,
        Expense.user_id == current_user.id,
    ).first()
    if not expense:
        raise HTTPException(status_code=404, detail="IPO application not found")

    expense.is_deleted = False
    expense.deleted_at = None
    db.commit()

    return {"message": "IPO application restored", "id": ipo_id}
