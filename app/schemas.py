from pydantic import BaseModel, Field
from typing import Any

class ProductRequirement(BaseModel):
    product_category: str | None = None
    product_description: str | None = None
    voltage_kv: float | None = None
    conductor_material: str | None = None
    cores: int | None = None
    cross_section_mm2: float | None = None
    insulation: str | None = None
    armour: str | None = None
    outer_sheath: str | None = None
    standards: list[str] = Field(default_factory=list)
    quantity: float | None = None
    unit: str | None = None
    source_reference: str | None = None

class TenderRequirements(BaseModel):
    tender_title: str | None = None
    reference_number: str | None = None
    buyer: str | None = None
    submission_deadline: str | None = None
    description: str | None = None
    scope_of_supply: str | None = None
    products: list[ProductRequirement] = Field(default_factory=list)
    required_tests: list[str] = Field(default_factory=list)
    acceptance_requirements: list[str] = Field(default_factory=list)
    mandatory_conditions: list[str] = Field(default_factory=list)

class QuestionRequest(BaseModel):
    question: str = Field(min_length=2, max_length=2000)

class ApiResponse(BaseModel):
    success: bool = True
    message: str
    data: Any = None
