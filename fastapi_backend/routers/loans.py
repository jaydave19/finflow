import math
from datetime import datetime
from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models import User, Loan, LoanSchedule, LoanPrepayment, LoanRateChange
from auth import get_current_user
from schemas import LoanCreate, LoanUpdate, LoanEMIAction, LoanPrepaymentCreate, LoanRateChangeCreate
from typing import Optional

router = APIRouter(prefix="/api/loans", tags=["Loans"])

def calculate_emi(principal: float, annual_rate: float, tenure_months: int) -> float:
    if annual_rate == 0:
        return principal / tenure_months if tenure_months > 0 else 0
    monthly_rate = annual_rate / 12 / 100
    return principal * monthly_rate * ((1 + monthly_rate) ** tenure_months) / (((1 + monthly_rate) ** tenure_months) - 1)

def generate_amortization_schedule(db: Session, user_id: str, loan_id: str, principal: float, annual_rate: float, emi: float, tenure: int, start_date_str: str, start_emi_number: int = 1):
    try:
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
    except ValueError:
        start_date = datetime.utcnow()

    monthly_rate = annual_rate / 12 / 100
    remaining_balance = principal

    schedules = []
    for i in range(tenure):
        if remaining_balance <= 0.01:
            break
        interest_comp = remaining_balance * monthly_rate
        principal_comp = emi - interest_comp
        if principal_comp > remaining_balance:
            principal_comp = remaining_balance
            emi = principal_comp + interest_comp
            
        remaining_balance -= principal_comp
        due_date = (start_date + relativedelta(months=i)).strftime("%Y-%m-%d")

        sched = LoanSchedule(
            user_id=user_id,
            loan_id=loan_id,
            emi_number=start_emi_number + i,
            due_date=due_date,
            principal_component=principal_comp,
            interest_component=interest_comp,
            total_emi=emi,
            remaining_balance=max(0, remaining_balance),
            status="Pending"
        )
        db.add(sched)
        schedules.append(sched)
    return schedules

def _serialize_loan(loan: Loan, db: Session) -> dict:
    schedules = db.query(LoanSchedule).filter(LoanSchedule.loan_id == loan.id).order_by(LoanSchedule.emi_number).all()
    prepayments = db.query(LoanPrepayment).filter(LoanPrepayment.loan_id == loan.id).order_by(LoanPrepayment.date).all()
    rate_changes = db.query(LoanRateChange).filter(LoanRateChange.loan_id == loan.id).order_by(LoanRateChange.effective_date).all()
    
    total_interest_payable = sum(s.interest_component for s in schedules)
    interest_paid = sum(s.interest_component for s in schedules if s.status == "Paid")
    emis_paid = sum(1 for s in schedules if s.status == "Paid")
    outstanding_principal = schedules[-1].remaining_balance if schedules else loan.principal_amount
    for s in schedules:
        if s.status == "Pending":
            outstanding_principal = s.remaining_balance + s.principal_component
            break

    next_emi = next((s for s in schedules if s.status == "Pending"), None)

    return {
        "id": loan.id,
        "loanName": loan.loan_name,
        "bankName": loan.bank_name,
        "loanType": loan.loan_type,
        "principalAmount": loan.principal_amount,
        "interestRate": loan.interest_rate,
        "rateType": loan.rate_type,
        "tenureMonths": loan.tenure_months,
        "emiAmount": loan.emi_amount,
        "startDate": loan.start_date,
        "firstEmiDate": loan.first_emi_date,
        "processingFee": loan.processing_fee,
        "otherCharges": loan.other_charges,
        "linkedAccount": loan.linked_account,
        "accountNumberMasked": loan.account_number_masked,
        "coBorrower": loan.co_borrower,
        "documentPaths": loan.document_paths,
        "status": loan.status,
        "createdAt": loan.created_at.isoformat() if loan.created_at else None,
        "dashboard": {
            "outstandingPrincipal": outstanding_principal,
            "totalInterestPayable": total_interest_payable,
            "interestPaid": interest_paid,
            "emisPaid": emis_paid,
            "emisRemaining": len(schedules) - emis_paid,
            "nextEmiDate": next_emi.due_date if next_emi else None,
            "percentCompleted": (emis_paid / len(schedules) * 100) if schedules else 0
        },
        "schedules": [
            {
                "id": s.id,
                "emiNumber": s.emi_number,
                "dueDate": s.due_date,
                "principalComponent": s.principal_component,
                "interestComponent": s.interest_component,
                "totalEmi": s.total_emi,
                "remainingBalance": s.remaining_balance,
                "status": s.status,
                "paidDate": s.paid_date,
                "lateFeeApplied": s.late_fee_applied
            } for s in schedules
        ],
        "prepayments": [
            {
                "id": p.id,
                "date": p.date,
                "amount": p.amount,
                "strategy": p.strategy,
                "interestSaved": p.calculated_interest_saved
            } for p in prepayments
        ]
    }

@router.get("/")
def get_loans(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    loans = db.query(Loan).filter(Loan.user_id == current_user.id, Loan.is_deleted == False).order_by(desc(Loan.created_at)).all()
    data = [_serialize_loan(l, db) for l in loans]
    
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
    if loan_in.principalAmount <= 0:
        raise HTTPException(status_code=400, detail="Principal amount must be positive")
    
    emi = loan_in.emiAmount
    if emi <= 0:
        emi = calculate_emi(loan_in.principalAmount, loan_in.interestRate, loan_in.tenureMonths)

    loan = Loan(
        user_id=current_user.id,
        loan_name=loan_in.loanName,
        bank_name=loan_in.bankName,
        loan_type=loan_in.loanType,
        principal_amount=loan_in.principalAmount,
        interest_rate=loan_in.interestRate,
        rate_type=loan_in.rateType,
        tenure_months=loan_in.tenureMonths,
        emi_amount=emi,
        start_date=loan_in.startDate,
        first_emi_date=loan_in.firstEmiDate,
        processing_fee=loan_in.processingFee,
        other_charges=loan_in.otherCharges,
        linked_account=loan_in.linkedAccount,
        account_number_masked=loan_in.accountNumberMasked,
        co_borrower=loan_in.coBorrower,
    )
    db.add(loan)
    db.commit()
    db.refresh(loan)
    
    generate_amortization_schedule(
        db=db,
        user_id=current_user.id,
        loan_id=loan.id,
        principal=loan.principal_amount,
        annual_rate=loan.interest_rate,
        emi=loan.emi_amount,
        tenure=loan.tenure_months,
        start_date_str=loan.first_emi_date or loan.start_date
    )
    db.commit()

    return {"id": loan.id, "message": "Loan added successfully"}

@router.put("/{loan_id}")
def update_loan(
    loan_id: str,
    loan_in: LoanUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    loan = db.query(Loan).filter(Loan.id == loan_id, Loan.user_id == current_user.id, Loan.is_deleted == False).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    if loan_in.loanName is not None: loan.loan_name = loan_in.loanName
    if loan_in.bankName is not None: loan.bank_name = loan_in.bankName
    if loan_in.status is not None: loan.status = loan_in.status
    db.commit()
    return {"message": "Loan updated successfully"}

@router.put("/{loan_id}/emi/{schedule_id}")
def update_emi_status(
    loan_id: str,
    schedule_id: str,
    action: LoanEMIAction,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sched = db.query(LoanSchedule).filter(LoanSchedule.id == schedule_id, LoanSchedule.loan_id == loan_id, LoanSchedule.user_id == current_user.id).first()
    if not sched:
        raise HTTPException(status_code=404, detail="EMI schedule not found")
    
    sched.status = action.status
    sched.paid_date = action.paidDate
    sched.late_fee_applied = action.lateFeeApplied
    db.commit()
    return {"message": f"EMI marked as {action.status}"}

@router.post("/{loan_id}/prepayment")
def add_prepayment(
    loan_id: str,
    prepayment: LoanPrepaymentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    loan = db.query(Loan).filter(Loan.id == loan_id, Loan.user_id == current_user.id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
        
    schedules = db.query(LoanSchedule).filter(LoanSchedule.loan_id == loan.id).order_by(LoanSchedule.emi_number).all()
    pending = [s for s in schedules if s.status == "Pending"]
    
    if not pending:
        raise HTTPException(status_code=400, detail="No pending EMIs to prepay against")
        
    current_outstanding = pending[0].remaining_balance + pending[0].principal_component
    new_principal = max(0, current_outstanding - prepayment.amount)
    
    db.query(LoanSchedule).filter(LoanSchedule.loan_id == loan.id, LoanSchedule.status == "Pending").delete()
    
    new_emi = loan.emi_amount
    new_tenure = len(pending)
    
    if prepayment.strategy == "reduce_emi":
        new_emi = calculate_emi(new_principal, loan.interest_rate, new_tenure)
    else:
        if new_principal > 0:
            monthly_rate = loan.interest_rate / 12 / 100
            if monthly_rate > 0:
                n = math.log(new_emi / (new_emi - new_principal * monthly_rate)) / math.log(1 + monthly_rate)
                new_tenure = math.ceil(n)
            else:
                new_tenure = math.ceil(new_principal / new_emi)
                
    loan.emi_amount = new_emi
    generate_amortization_schedule(
        db=db,
        user_id=current_user.id,
        loan_id=loan.id,
        principal=new_principal,
        annual_rate=loan.interest_rate,
        emi=new_emi,
        tenure=new_tenure,
        start_date_str=pending[0].due_date,
        start_emi_number=pending[0].emi_number
    )
    
    prep = LoanPrepayment(
        user_id=current_user.id,
        loan_id=loan.id,
        date=prepayment.date,
        amount=prepayment.amount,
        strategy=prepayment.strategy
    )
    db.add(prep)
    db.commit()
    return {"message": "Prepayment recorded and schedule recalculated"}

@router.delete("/{loan_id}")
def delete_loan(
    loan_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    loan = db.query(Loan).filter(Loan.id == loan_id, Loan.user_id == current_user.id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    loan.is_deleted = True
    db.commit()
    return {"message": "Loan removed successfully"}
