import uuid
import datetime
from sqlalchemy import Column, String, Float, Boolean, Integer, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    avatar = Column(Text, nullable=True)
    currency = Column(String(10), default="INR")
    theme = Column(String(20), default="system")
    notification_prefs = Column(JSON, default=lambda: {"email": True, "inApp": True, "daysBefore": 3})
    reset_code = Column(String(10), nullable=True)
    reset_code_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    expenses = relationship("Expense", back_populates="user", cascade="all, delete-orphan")
    incomes = relationship("Income", back_populates="user", cascade="all, delete-orphan")
    categories = relationship("Category", back_populates="user", cascade="all, delete-orphan")
    budgets = relationship("Budget", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    credit_cards = relationship("CreditCard", back_populates="user", cascade="all, delete-orphan")
    debit_cards = relationship("DebitCard", back_populates="user", cascade="all, delete-orphan")
    people = relationship("Person", back_populates="user", cascade="all, delete-orphan")
    ledger_entries = relationship("LedgerEntry", back_populates="user", cascade="all, delete-orphan")
    ledger_settlements = relationship("LedgerSettlement", back_populates="user", cascade="all, delete-orphan")
    loans = relationship("Loan", back_populates="user", cascade="all, delete-orphan")
    loan_schedules = relationship("LoanSchedule", back_populates="user", cascade="all, delete-orphan")
    loan_prepayments = relationship("LoanPrepayment", back_populates="user", cascade="all, delete-orphan")
    loan_rate_changes = relationship("LoanRateChange", back_populates="user", cascade="all, delete-orphan")
    investments = relationship("Investment", back_populates="user", cascade="all, delete-orphan")
    investment_transactions = relationship("InvestmentTransaction", back_populates="user", cascade="all, delete-orphan")

class Category(Base):
    __tablename__ = "categories"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    icon = Column(String(50), default="Tag")
    color = Column(String(20), default="#3B82F6")
    monthly_budget = Column(Float, default=0.0)
    is_default = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="categories")
    expenses = relationship("Expense", back_populates="category")

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(String, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    card_id = Column(String, ForeignKey("credit_cards.id", ondelete="SET NULL"), nullable=True)
    debit_card_id = Column(String, ForeignKey("debit_cards.id", ondelete="SET NULL"), nullable=True)
    amount = Column(Float, nullable=False)
    date = Column(String(10), nullable=False)  # YYYY-MM-DD
    payment_method = Column(String(50), default="UPI")
    note = Column(Text, default="")
    tags = Column(JSON, default=list)
    is_recurring = Column(Boolean, default=False)
    recurrence_type = Column(String(20), nullable=True)
    next_due_date = Column(String(10), nullable=True)
    ipo_details = Column(JSON, nullable=True)
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="expenses")
    category = relationship("Category", back_populates="expenses")
    credit_card = relationship("CreditCard", back_populates="expenses")
    debit_card = relationship("DebitCard", back_populates="expenses")

class Income(Base):
    __tablename__ = "incomes"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Float, nullable=False)
    source = Column(String(100), nullable=False)
    date = Column(String(10), nullable=False)
    note = Column(Text, default="")
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="incomes")

class Budget(Base):
    __tablename__ = "budgets"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    overall_budget = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="budgets")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(50), default="info")
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    link = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="notifications")


class CreditCard(Base):
    __tablename__ = "credit_cards"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    card_name = Column(String(100), nullable=False)
    bank_name = Column(String(100), nullable=False)
    last4 = Column(String(4), nullable=False)
    card_network = Column(String(30), default="Visa")
    credit_limit = Column(Float, default=0.0)
    billing_cycle_day = Column(Integer, default=1)
    due_date_day = Column(Integer, default=20)
    color = Column(String(20), default="#1E3A8A")
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="credit_cards")
    expenses = relationship("Expense", back_populates="credit_card")

class DebitCard(Base):
    __tablename__ = "debit_cards"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    card_name = Column(String(100), nullable=False)
    bank_name = Column(String(100), nullable=False)
    last4 = Column(String(4), nullable=False)
    card_network = Column(String(30), default="Visa")
    account_balance = Column(Float, default=0.0)  # Current bank account balance
    color = Column(String(20), default="#1E3A8A")
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="debit_cards")
    expenses = relationship("Expense", back_populates="debit_card")

class Person(Base):
    __tablename__ = "people"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    photo = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="people")
    entries = relationship("LedgerEntry", back_populates="person", cascade="all, delete-orphan")

class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    person_id = Column(String, ForeignKey("people.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(20), nullable=False) # 'gave' or 'took'
    amount = Column(Float, nullable=False)
    date = Column(String(10), nullable=False)
    reason = Column(Text, nullable=True)
    due_date = Column(String(10), nullable=True)
    payment_method = Column(String(50), nullable=True)
    attachment = Column(Text, nullable=True)
    interest_rate = Column(Float, nullable=True)
    interest_type = Column(String(20), nullable=True)
    is_settled = Column(Boolean, default=False)
    settled_amount = Column(Float, default=0.0)
    status = Column(String(20), default="Pending")
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="ledger_entries")
    person = relationship("Person", back_populates="entries")
    settlements = relationship("LedgerSettlement", back_populates="entry", cascade="all, delete-orphan")

class LedgerSettlement(Base):
    __tablename__ = "ledger_settlements"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    entry_id = Column(String, ForeignKey("ledger_entries.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Float, nullable=False)
    date = Column(String(10), nullable=False)
    payment_method = Column(String(50), nullable=True)
    note = Column(Text, nullable=True)
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="ledger_settlements")
    entry = relationship("LedgerEntry", back_populates="settlements")

class Loan(Base):
    __tablename__ = "loans"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    loan_name = Column(String(100), nullable=False)
    bank_name = Column(String(100), nullable=False)
    loan_type = Column(String(50), nullable=False) 
    principal_amount = Column(Float, nullable=False)
    interest_rate = Column(Float, nullable=False) 
    rate_type = Column(String(20), default="Fixed") 
    tenure_months = Column(Integer, nullable=False)
    emi_amount = Column(Float, nullable=False)
    start_date = Column(String(10), nullable=False)
    first_emi_date = Column(String(10), nullable=True)
    processing_fee = Column(Float, default=0.0)
    other_charges = Column(Float, default=0.0)
    linked_account = Column(String(100), nullable=True)
    account_number_masked = Column(String(20), nullable=True)
    co_borrower = Column(String(100), nullable=True)
    document_paths = Column(JSON, default=list)
    status = Column(String(20), default="ACTIVE") # ACTIVE, CLOSED, OVERDUE
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="loans")
    schedules = relationship("LoanSchedule", back_populates="loan", cascade="all, delete-orphan")
    prepayments = relationship("LoanPrepayment", back_populates="loan", cascade="all, delete-orphan")
    rate_changes = relationship("LoanRateChange", back_populates="loan", cascade="all, delete-orphan")

class LoanSchedule(Base):
    __tablename__ = "loan_schedules"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    loan_id = Column(String, ForeignKey("loans.id", ondelete="CASCADE"), nullable=False)
    emi_number = Column(Integer, nullable=False)
    due_date = Column(String(10), nullable=False)
    principal_component = Column(Float, nullable=False)
    interest_component = Column(Float, nullable=False)
    total_emi = Column(Float, nullable=False)
    remaining_balance = Column(Float, nullable=False)
    status = Column(String(20), default="Pending") # Pending, Paid, Skipped, Late
    paid_date = Column(String(10), nullable=True)
    late_fee_applied = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="loan_schedules")
    loan = relationship("Loan", back_populates="schedules")

class LoanPrepayment(Base):
    __tablename__ = "loan_prepayments"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    loan_id = Column(String, ForeignKey("loans.id", ondelete="CASCADE"), nullable=False)
    date = Column(String(10), nullable=False)
    amount = Column(Float, nullable=False)
    strategy = Column(String(50), nullable=False) # reduce_tenure, reduce_emi
    calculated_interest_saved = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="loan_prepayments")
    loan = relationship("Loan", back_populates="prepayments")

class LoanRateChange(Base):
    __tablename__ = "loan_rate_changes"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    loan_id = Column(String, ForeignKey("loans.id", ondelete="CASCADE"), nullable=False)
    effective_date = Column(String(10), nullable=False)
    new_rate = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="loan_rate_changes")
    loan = relationship("Loan", back_populates="rate_changes")

class Investment(Base):
    __tablename__ = "investments"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    investment_name = Column(String(100), nullable=False)
    investment_type = Column(String(50), nullable=False)
    platform = Column(String(100), nullable=True)
    amount_invested = Column(Float, nullable=False, default=0.0)
    current_value = Column(Float, nullable=True)
    start_date = Column(String(10), nullable=False)
    units_quantity = Column(Float, nullable=True)
    buy_price = Column(Float, nullable=True)
    notes = Column(String, nullable=True)
    goal_tag = Column(String(50), nullable=True)
    
    # Type-specific fields
    interest_rate = Column(Float, nullable=True) # FD/RD, SGB/Bonds
    tenure_months = Column(Integer, nullable=True) # FD/RD
    maturity_date = Column(String(10), nullable=True) # FD/RD, SGB/Bonds
    maturity_amount = Column(Float, nullable=True) # FD/RD
    auto_renew = Column(Boolean, default=False) # FD
    sip_amount = Column(Float, nullable=True) # SIP
    sip_date = Column(Integer, nullable=True) # SIP 1-31
    yearly_deposit = Column(Float, nullable=True) # PPF
    lock_in_end = Column(String(10), nullable=True) # PPF
    
    status = Column(String(20), default="ACTIVE") # ACTIVE, WITHDRAWN, SOLD
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="investments")
    transactions = relationship("InvestmentTransaction", back_populates="investment", cascade="all, delete-orphan")

class InvestmentTransaction(Base):
    __tablename__ = "investment_transactions"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    investment_id = Column(String, ForeignKey("investments.id", ondelete="CASCADE"), nullable=False)
    date = Column(String(10), nullable=False)
    type = Column(String(20), nullable=False) # BUY, SELL, SIP, DIVIDEND
    amount = Column(Float, nullable=False)
    units = Column(Float, nullable=True)
    price = Column(Float, nullable=True)
    realized_pl = Column(Float, nullable=True) # For SELL
    tax_tag = Column(String(20), nullable=True) # STCG, LTCG
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="investment_transactions")
    investment = relationship("Investment", back_populates="transactions")

class StatementUpload(Base):
    __tablename__ = "statement_uploads"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    bank_name = Column(String(100), nullable=False)
    account_id = Column(String(100), nullable=True)
    period_type = Column(String(50), nullable=False)
    file_name = Column(String(255), nullable=False)
    parsed_count = Column(Integer, default=0)
    saved_count = Column(Integer, default=0)
    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class TransactionRule(Base):
    __tablename__ = "transaction_rules"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    keyword = Column(String(255), nullable=False)
    category_id = Column(String, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
