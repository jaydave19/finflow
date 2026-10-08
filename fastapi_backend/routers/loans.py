from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models import User, Loan
from auth import get_current_user
from schemas import LoanCreate, LoanUpdate
from typing import Optional

router = APIRouter(prefix="/api/loans", tags=["Loans"])

def _serialize_loan(loan: Loan) -> dict:
    return {
        "id": loan.id,
        "loanName": loan.loan_name,
        "bankName": loan.bank_name,
        "loanType": loan.loan_type,
        "principalAmount": loan.principal_amount,
        "interestRate": loan.interest_rate,
        "tenureMonths": loan.tenure_months,
        "emiAmount": loan.emi_amount,
        "startDate": loan.start_date,
        "status": loan.status,
        "createdAt": loan.created_at.isoformat() if loan.created_at else None,
    }

@router.get("/")
def get_loans(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    loans = (
        db.query(Loan)
        .filter(Loan.user_id == current_user.id, Loan.is_deleted == False)
        .order_by(desc(Loan.created_at))
        .all()
    )

    data = [_serialize_loan(l) for l in loans]
    
    total_principal = sum(l.principal_amount for l in loans if l.status == "ACTIVE")
    total_emi = sum(l.emi_amount for l in loans if l.status == "ACTIVE")

    return {
        "loans": data,
        "summary": {
            "totalPrincipal": total_principal,
            "totalEmi": total_emi,
            "activeLoansCount": len([l for l in loans if l.status == "ACTIVE"])
        }
    }

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_loan(
    loan_in: LoanCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if loan_in.principalAmount <= 0 or loan_in.emiAmount < 0:
        raise HTTPException(status_code=400, detail="Invalid loan amounts")
    
    loan = Loan(
        user_id=current_user.id,
        loan_name=loan_in.loanName,
        bank_name=loan_in.bankName,
        loan_type=loan_in.loanType,
        principal_amount=loan_in.principalAmount,
        interest_rate=loan_in.interestRate,
        tenure_months=loan_in.tenureMonths,
        emi_amount=loan_in.emiAmount,
        start_date=loan_in.startDate,
    )
    db.add(loan)
    db.commit()
    db.refresh(loan)

    return {"id": loan.id, "message": "Loan added successfully"}

@router.put("/{loan_id}")
def update_loan(
    loan_id: str,
    loan_in: LoanUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    loan = db.query(Loan).filter(
        Loan.id == loan_id,
        Loan.user_id == current_user.id,
        Loan.is_deleted == False,
    ).first()
    
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    if loan_in.loanName is not None:
        loan.loan_name = loan_in.loanName
    if loan_in.bankName is not None:
        loan.bank_name = loan_in.bankName
    if loan_in.loanType is not None:
        loan.loan_type = loan_in.loanType
    if loan_in.principalAmount is not None:
        loan.principal_amount = loan_in.principalAmount
    if loan_in.interestRate is not None:
        loan.interest_rate = loan_in.interestRate
    if loan_in.tenureMonths is not None:
        loan.tenure_months = loan_in.tenureMonths
    if loan_in.emiAmount is not None:
        loan.emi_amount = loan_in.emiAmount
    if loan_in.startDate is not None:
        loan.start_date = loan_in.startDate
    if loan_in.status is not None:
        loan.status = loan_in.status

    db.commit()
    return {"message": "Loan updated successfully"}

@router.delete("/{loan_id}")
def delete_loan(
    loan_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    loan = db.query(Loan).filter(
        Loan.id == loan_id,
        Loan.user_id == current_user.id,
        Loan.is_deleted == False,
    ).first()
    
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    loan.is_deleted = True
    loan.deleted_at = datetime.utcnow()
    db.commit()

    return {"message": "Loan removed successfully"}
