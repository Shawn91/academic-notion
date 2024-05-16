from typing import Any, Literal

from pydantic import BaseModel


class SearchByTitleRequest(BaseModel):
    query: str
    search_for: Literal["database", "page"]
    access_token: str = ""


class ApiResponse(BaseModel):
    success: bool
    message: str = ""
    data: Any = None
    code: int = 0
