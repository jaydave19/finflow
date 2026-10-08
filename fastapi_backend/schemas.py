from pydantic import BaseModel, EmailStr, ConfigDict, Field, AliasChoices, field_validator
from typing import Optional, List, Any, Dict

# User & Auth
class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    email: EmailStr
    code: str = Field(
        ...,
        validation_alias=AliasChoices("code", "verificationCode", "resetCode"),
    )
    newPassword: str = Field(
        ...,
        validation_alias=AliasChoices("newPassword", "new_password", "password"),
    )

    @field_validator("code", "newPassword", mode="before")
    @classmethod
    def normalize_reset_fields(cls, value):
        if value is None:
            return value
        return str(value).strip()

    @field_validator("newPassword")
    @classmethod
    def validate_new_password(cls, value):
        if len(value) < 6:
            raise ValueError("Password must be at least 6 characters long")
        return value

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    avatar: Optional[str] = None
    currentPassword: Optional[str] = None
    newPassword: Optional[str] = None

class SettingsUpdate(BaseModel):
    currency: Optional[str] = None
    theme: Optional[str] = None
    notificationPrefs: Optional[Dict[str, Any]] = None

class UserOut(BaseModel):
    id: str
    name: str
    email: str
    avatar: Optional[str] = None
    currency: str
    theme: str
    notificationPrefs: Optional[Dict[str, Any]] = None

class AuthResponse(BaseModel):
    user: UserOut
    accessToken: str
    refreshToken: str

# Category
class CategoryBase(BaseModel):
    name: str
    icon: str = "Tag"
    color: str = "#3B82F6"
    monthlyBudget: Optional[float] = 0.0

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    monthlyBudget: Optional[float] = None

class CategoryOut(BaseModel):
    id: str
    name: str
    icon: str
    color: str
    monthlyBudget: float
    isDefault: bool

# Expense & Stock/IPO
class IPODetails(BaseModel):
    ipoName: Optional[str] = None
    sharesCount: Optional[int] = None
    bidPrice: Optional[float] = None
    lotSize: Optional[int] = 1
    status: Optional[str] = "Blocked"  # Blocked, Allotted, Refunded, Sold
    mandateStatus: Optional[str] = None

class ExpenseCreate(BaseModel):
    amount: float
    categoryId: Optional[str] = None
    cardId: Optional[str] = None
    debitCardId: Optional[str] = None
    date: str
    paymentMethod: Optional[str] = "UPI"
    note: Optional[str] = ""
    tags: Optional[List[str]] = []
    isRecurring: Optional[bool] = False
    recurrenceType: Optional[str] = None
    nextDueDate: Optional[str] = None
    ipoDetails: Optional[Dict[str, Any]] = None

class ExpenseUpdate(BaseModel):
    amount: Optional[float] = None
    categoryId: Optional[str] = None
    cardId: Optional[str] = None
    debitCardId: Optional[str] = None
    date: Optional[str] = None
    paymentMethod: Optional[str] = None
    note: Optional[str] = None
    tags: Optional[List[str]] = None
    isRecurring: Optional[bool] = None
    recurrenceType: Optional[str] = None
    nextDueDate: Optional[str] = None
    ipoDetails: Optional[Dict[str, Any]] = None

class ExpenseOut(BaseModel):
    id: str
    amount: float
    date: str
    paymentMethod: str
    note: Optional[str]
    tags: List[str]
    isRecurring: bool
    recurrenceType: Optional[str]
    nextDueDate: Optional[str]
    ipoDetails: Optional[Dict[str, Any]]
    category: Optional[Dict[str, Any]]

# Income
class IncomeCreate(BaseModel):
    amount: float
    source: str
    date: str
    note: Optional[str] = ""

class IncomeUpdate(BaseModel):
    amount: Optional[float] = None
    source: Optional[str] = None
    date: Optional[str] = None
    note: Optional[str] = None

class IncomeOut(BaseModel):
    id: str
    amount: float
    source: str
    date: str
    note: Optional[str]

# Budget
class CategoryBudgetItem(BaseModel):
    categoryId: str
    monthlyBudget: float

class BudgetSetRequest(BaseModel):
    month: int
    year: int
    overallBudget: Optional[float] = None
    categoryBudgets: Optional[List[CategoryBudgetItem]] = None

# Ledger (People / IOU)
class LedgerCreate(BaseModel):
    personName: str
    amount: float
    type: str # "I_OWE" or "THEY_OWE"
    dueDate: Optional[str] = None
    note: Optional[str] = ""

class LedgerUpdate(BaseModel):
    personName: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[str] = None
    status: Optional[str] = None
    dueDate: Optional[str] = None
    note: Optional[str] = None

# Loans
class LoanCreate(BaseModel):
    loanName: str
    bankName: str
    loanType: str
    principalAmount: float
    interestRate: float
    tenureMonths: int
    emiAmount: float
    startDate: str

class LoanUpdate(BaseModel):
    loanName: Optional[str] = None
    bankName: Optional[str] = None
    loanType: Optional[str] = None
    principalAmount: Optional[float] = None
    interestRate: Optional[float] = None
    tenureMonths: Optional[int] = None
    emiAmount: Optional[float] = None
    startDate: Optional[str] = None
    status: Optional[str] = None

# Investments
class InvestmentCreate(BaseModel):
    investmentName: str
    investmentType: str
    amountInvested: float
    currentValue: Optional[float] = None
    startDate: str

class InvestmentUpdate(BaseModel):
    investmentName: Optional[str] = None
    investmentType: Optional[str] = None
    amountInvested: Optional[float] = None
    currentValue: Optional[float] = None
    startDate: Optional[str] = None
    status: Optional[str] = None
