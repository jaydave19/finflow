from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import User, CreditCard, Expense
from auth import get_current_user
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/cards", tags=["Credit Cards"])


# ─── Schemas ────────────────────────────────────────────────────────────────

class CardCreate(BaseModel):
    cardName: str
    bankName: str
    last4: str
    cardNetwork: Optional[str] = "Visa"
    creditLimit: float
    billingCycleDay: Optional[int] = 1
    dueDateDay: Optional[int] = 20
    color: Optional[str] = "#1E3A8A"


class CardUpdate(BaseModel):
    cardName: Optional[str] = None
    bankName: Optional[str] = None
    last4: Optional[str] = None
    cardNetwork: Optional[str] = None
    creditLimit: Optional[float] = None
    billingCycleDay: Optional[int] = None
    dueDateDay: Optional[int] = None
    color: Optional[str] = None


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _card_spent(db: Session, card_id: str) -> float:
    """Sum of non-deleted expenses linked to this credit card."""
    result = db.query(func.coalesce(func.sum(Expense.amount), 0.0)).filter(
        Expense.card_id == card_id,
        Expense.is_deleted == False,
    ).scalar()
    return float(result or 0.0)


def _serialize_card(card: CreditCard, spent: float) -> dict:
    available = max(0.0, card.credit_limit - spent)
    utilization = round((spent / card.credit_limit * 100), 1) if card.credit_limit > 0 else 0.0
    return {
        "id": card.id,
        "cardName": card.card_name,
        "bankName": card.bank_name,
        "last4": card.last4,
        "cardNetwork": card.card_network,
        "creditLimit": card.credit_limit,
        "currentSpent": round(spent, 2),
        "availableCredit": round(available, 2),
        "utilizationRate": utilization,
        "billingCycleDay": card.billing_cycle_day,
        "dueDateDay": card.due_date_day,
        "color": card.color,
        "createdAt": card.created_at.isoformat() if card.created_at else None,
    }


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.get("/")
def get_cards(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cards = (
        db.query(CreditCard)
        .filter(CreditCard.user_id == current_user.id, CreditCard.is_deleted == False)
        .order_by(CreditCard.created_at.asc())
        .all()
    )

    card_data = []
    total_limit = 0.0
    total_spent = 0.0

    for card in cards:
        spent = _card_spent(db, card.id)
        total_limit += card.credit_limit
        total_spent += spent
        # Attach tx count for summary
        tx_count = db.query(Expense).filter(
            Expense.card_id == card.id,
            Expense.is_deleted == False,
        ).count()
        serialized = _serialize_card(card, spent)
        serialized["txCount"] = tx_count
        card_data.append(serialized)

    overall_util = round((total_spent / total_limit * 100), 1) if total_limit > 0 else 0.0

    return {
        "cards": card_data,
        "summary": {
            "totalCreditLimit": round(total_limit, 2),
            "totalSpent": round(total_spent, 2),
            "totalAvailable": round(max(0.0, total_limit - total_spent), 2),
            "overallUtilization": overall_util,
            "cardsCount": len(card_data),
        },
    }


@router.get("/{card_id}")
def get_card(
    card_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = db.query(CreditCard).filter(
        CreditCard.id == card_id,
        CreditCard.user_id == current_user.id,
        CreditCard.is_deleted == False,
    ).first()
    if not card:
        raise HTTPException(status_code=404, detail="Credit card not found")

    # Fetch linked expenses
    expenses = (
        db.query(Expense)
        .filter(Expense.card_id == card_id, Expense.is_deleted == False)
        .order_by(Expense.date.desc(), Expense.created_at.desc())
        .limit(50)
        .all()
    )

    transactions = []
    for e in expenses:
        transactions.append({
            "id": e.id,
            "date": e.date,
            "amount": e.amount,
            "note": e.note,
            "paymentMethod": e.payment_method,
            "categoryName": e.category.name if e.category else "Uncategorized",
            "categoryColor": e.category.color if e.category else "#6366F1",
            "tags": e.tags or [],
        })

    spent = _card_spent(db, card.id)
    return {
        **_serialize_card(card, spent),
        "transactions": transactions,
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_card(
    card_in: CardCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if len(card_in.last4) != 4 or not card_in.last4.isdigit():
        raise HTTPException(status_code=400, detail="last4 must be exactly 4 digits")

    if card_in.creditLimit <= 0:
        raise HTTPException(status_code=400, detail="Credit limit must be positive")

    card = CreditCard(
        user_id=current_user.id,
        card_name=card_in.cardName,
        bank_name=card_in.bankName,
        last4=card_in.last4,
        card_network=card_in.cardNetwork or "Visa",
        credit_limit=card_in.creditLimit,
        billing_cycle_day=card_in.billingCycleDay or 1,
        due_date_day=card_in.dueDateDay or 20,
        color=card_in.color or "#1E3A8A",
    )
    db.add(card)
    db.commit()
    db.refresh(card)

    return {"id": card.id, "message": "Credit card added successfully"}


@router.put("/{card_id}")
def update_card(
    card_id: str,
    card_in: CardUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = db.query(CreditCard).filter(
        CreditCard.id == card_id,
        CreditCard.user_id == current_user.id,
        CreditCard.is_deleted == False,
    ).first()
    if not card:
        raise HTTPException(status_code=404, detail="Credit card not found")

    if card_in.cardName is not None:
        card.card_name = card_in.cardName
    if card_in.bankName is not None:
        card.bank_name = card_in.bankName
    if card_in.last4 is not None:
        card.last4 = card_in.last4
    if card_in.cardNetwork is not None:
        card.card_network = card_in.cardNetwork
    if card_in.creditLimit is not None:
        card.credit_limit = card_in.creditLimit
    if card_in.billingCycleDay is not None:
        card.billing_cycle_day = card_in.billingCycleDay
    if card_in.dueDateDay is not None:
        card.due_date_day = card_in.dueDateDay
    if card_in.color is not None:
        card.color = card_in.color

    db.commit()
    return {"message": "Credit card updated successfully"}


@router.delete("/{card_id}")
def delete_card(
    card_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = db.query(CreditCard).filter(
        CreditCard.id == card_id,
        CreditCard.user_id == current_user.id,
        CreditCard.is_deleted == False,
    ).first()
    if not card:
        raise HTTPException(status_code=404, detail="Credit card not found")

    card.is_deleted = True
    card.deleted_at = datetime.utcnow()
    db.commit()

    return {"message": "Credit card removed successfully", "id": card_id}
