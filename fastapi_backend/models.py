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
    ledgers = relationship("Ledger", back_populates="user", cascade="all, delete-orphan")
    loans = relationship("Loan", back_populates="user", cascade="all, delete-orphan")
    investments = relationship("Investment", back_populates="user", cascade="all, delete-orphan")

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

class Ledger(Base):
    __tablename__ = "ledgers"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    person_name = Column(String(100), nullable=False)
    amount = Column(Float, nullable=False)
    type = Column(String(20), nullable=False) # "I_OWE" or "THEY_OWE"
    status = Column(String(20), default="PENDING") # "PENDING", "SETTLED"
    due_date = Column(String(10), nullable=True)
    note = Column(Text, default="")
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="ledgers")

class Loan(Base):
    __tablename__ = "loans"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    loan_name = Column(String(100), nullable=False)
    bank_name = Column(String(100), nullable=False)
    loan_type = Column(String(50), nullable=False) # Personal, Home, Auto, Education
    principal_amount = Column(Float, nullable=False)
    interest_rate = Column(Float, nullable=False) # Annual Percentage
    tenure_months = Column(Integer, nullable=False)
    emi_amount = Column(Float, nullable=False)
    start_date = Column(String(10), nullable=False)
    status = Column(String(20), default="ACTIVE") # ACTIVE, CLOSED
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="loans")

class Investment(Base):
    __tablename__ = "investments"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    investment_name = Column(String(100), nullable=False)
    investment_type = Column(String(50), nullable=False) # Mutual Funds, Stocks, FD, Gold, Crypto
    amount_invested = Column(Float, nullable=False)
    current_value = Column(Float, nullable=True)
    start_date = Column(String(10), nullable=False)
    status = Column(String(20), default="ACTIVE") # ACTIVE, WITHDRAWN
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="investments")
