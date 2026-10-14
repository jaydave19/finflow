from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models import User, Investment, InvestmentTransaction
from auth import get_current_user
from schemas import InvestmentCreate, InvestmentUpdate, InvestmentTransactionCreate
from typing import Optional

router = APIRouter(prefix="/api/investments", tags=["Investments"])

def _serialize_investment(inv: Investment, db: Session) -> dict:
    txs = db.query(InvestmentTransaction).filter(InvestmentTransaction.investment_id == inv.id).order_by(desc(InvestmentTransaction.date)).all()
    
    current_value = inv.current_value if inv.current_value is not None else inv.amount_invested
    profit_loss = current_value - inv.amount_invested
    return_pct = (profit_loss / inv.amount_invested * 100) if inv.amount_invested > 0 else 0

    return {
        "id": inv.id,
        "investmentName": inv.investment_name,
        "investmentType": inv.investment_type,
        "platform": inv.platform,
        "amountInvested": inv.amount_invested,
        "currentValue": current_value,
        "startDate": inv.start_date,
        "unitsQuantity": inv.units_quantity,
        "buyPrice": inv.buy_price,
        "notes": inv.notes,
        "goalTag": inv.goal_tag,
        
        "interestRate": inv.interest_rate,
        "tenureMonths": inv.tenure_months,
        "maturityDate": inv.maturity_date,
        "maturityAmount": inv.maturity_amount,
        "autoRenew": inv.auto_renew,
        "sipAmount": inv.sip_amount,
        "sipDate": inv.sip_date,
        "yearlyDeposit": inv.yearly_deposit,
        "lockInEnd": inv.lock_in_end,
        
        "status": inv.status,
        "createdAt": inv.created_at.isoformat() if inv.created_at else None,
        
        "dashboard": {
            "profitLoss": profit_loss,
            "returnPct": return_pct,
        },
        "transactions": [
            {
                "id": t.id,
                "date": t.date,
                "type": t.type,
                "amount": t.amount,
                "units": t.units,
                "price": t.price,
                "realizedPl": t.realized_pl,
                "taxTag": t.tax_tag
            } for t in txs
        ]
    }

@router.get("/")
def get_investments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investments = (
        db.query(Investment)
        .filter(Investment.user_id == current_user.id, Investment.is_deleted == False)
        .order_by(desc(Investment.created_at))
        .all()
    )

    data = [_serialize_investment(i, db) for i in investments]
    
    total_invested = sum(i.amount_invested for i in investments if i.status == "ACTIVE")
    total_current = sum((i.current_value if i.current_value is not None else i.amount_invested) for i in investments if i.status == "ACTIVE")
    
    return {
        "investments": data,
        "summary": {
            "totalInvested": total_invested,
            "currentValue": total_current,
            "totalProfit": total_current - total_invested,
            "overallReturnPct": ((total_current - total_invested) / total_invested * 100) if total_invested > 0 else 0,
            "activeCount": len([i for i in investments if i.status == "ACTIVE"])
        }
    }

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_investment(
    inv_in: InvestmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inv = Investment(
        user_id=current_user.id,
        investment_name=inv_in.investmentName,
        investment_type=inv_in.investmentType,
        platform=inv_in.platform,
        amount_invested=inv_in.amountInvested,
        current_value=inv_in.currentValue,
        start_date=inv_in.startDate,
        units_quantity=inv_in.unitsQuantity,
        buy_price=inv_in.buyPrice,
        notes=inv_in.notes,
        goal_tag=inv_in.goalTag,
        interest_rate=inv_in.interestRate,
        tenure_months=inv_in.tenureMonths,
        maturity_date=inv_in.maturityDate,
        maturity_amount=inv_in.maturityAmount,
        auto_renew=inv_in.autoRenew,
        sip_amount=inv_in.sipAmount,
        sip_date=inv_in.sipDate,
        yearly_deposit=inv_in.yearlyDeposit,
        lock_in_end=inv_in.lockInEnd,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    
    # Add initial BUY transaction
    if inv.amount_invested > 0:
        tx = InvestmentTransaction(
            user_id=current_user.id,
            investment_id=inv.id,
            date=inv.start_date,
            type="BUY",
            amount=inv.amount_invested,
            units=inv.units_quantity,
            price=inv.buy_price
        )
        db.add(tx)
        db.commit()

    return {"id": inv.id, "message": "Investment added successfully"}

@router.put("/{inv_id}")
def update_investment(
    inv_id: str,
    inv_in: InvestmentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inv = db.query(Investment).filter(Investment.id == inv_id, Investment.user_id == current_user.id, Investment.is_deleted == False).first()
    
    if not inv:
        raise HTTPException(status_code=404, detail="Investment not found")

    if inv_in.investmentName is not None: inv.investment_name = inv_in.investmentName
    if inv_in.investmentType is not None: inv.investment_type = inv_in.investmentType
    if inv_in.platform is not None: inv.platform = inv_in.platform
    if inv_in.amountInvested is not None: inv.amount_invested = inv_in.amountInvested
    if inv_in.currentValue is not None: inv.current_value = inv_in.currentValue
    if inv_in.startDate is not None: inv.start_date = inv_in.startDate
    if inv_in.unitsQuantity is not None: inv.units_quantity = inv_in.unitsQuantity
    if inv_in.buyPrice is not None: inv.buy_price = inv_in.buyPrice
    if inv_in.notes is not None: inv.notes = inv_in.notes
    if inv_in.goalTag is not None: inv.goal_tag = inv_in.goalTag
    if inv_in.interestRate is not None: inv.interest_rate = inv_in.interestRate
    if inv_in.tenureMonths is not None: inv.tenure_months = inv_in.tenureMonths
    if inv_in.maturityDate is not None: inv.maturity_date = inv_in.maturityDate
    if inv_in.maturityAmount is not None: inv.maturity_amount = inv_in.maturityAmount
    if inv_in.autoRenew is not None: inv.auto_renew = inv_in.autoRenew
    if inv_in.sipAmount is not None: inv.sip_amount = inv_in.sipAmount
    if inv_in.sipDate is not None: inv.sip_date = inv_in.sipDate
    if inv_in.yearlyDeposit is not None: inv.yearly_deposit = inv_in.yearlyDeposit
    if inv_in.lockInEnd is not None: inv.lock_in_end = inv_in.lockInEnd
    if inv_in.status is not None: inv.status = inv_in.status

    db.commit()
    return {"message": "Investment updated successfully"}

@router.post("/{inv_id}/transactions")
def add_transaction(
    inv_id: str,
    tx_in: InvestmentTransactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    inv = db.query(Investment).filter(Investment.id == inv_id, Investment.user_id == current_user.id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investment not found")
        
    tx = InvestmentTransaction(
        user_id=current_user.id,
        investment_id=inv.id,
        date=tx_in.date,
        type=tx_in.type,
        amount=tx_in.amount,
        units=tx_in.units,
        price=tx_in.price,
        realized_pl=tx_in.realizedPl,
        tax_tag=tx_in.taxTag
    )
    db.add(tx)
    
    # Adjust primary investment amounts
    if tx_in.type == "BUY" or tx_in.type == "SIP":
        inv.amount_invested += tx_in.amount
        if tx_in.units:
            inv.units_quantity = (inv.units_quantity or 0) + tx_in.units
    elif tx_in.type == "SELL":
        # Simplified: we don't reduce amount_invested here unless full sell, we let user manually update current_value, or if units drop to 0
        if tx_in.units and inv.units_quantity:
            inv.units_quantity -= tx_in.units
            if inv.units_quantity <= 0:
                inv.status = "SOLD"

    db.commit()
    return {"message": f"{tx_in.type} transaction recorded"}

@router.delete("/{inv_id}")
def delete_investment(
    inv_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inv = db.query(Investment).filter(
        Investment.id == inv_id,
        Investment.user_id == current_user.id,
        Investment.is_deleted == False,
    ).first()
    
    if not inv:
        raise HTTPException(status_code=404, detail="Investment not found")

    inv.is_deleted = True
    inv.deleted_at = datetime.utcnow()
    db.commit()

    return {"message": "Investment removed successfully"}
