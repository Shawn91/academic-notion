import sys
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, status, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

sys.path.append(str(Path(__file__).parent.resolve()))

from models import SearchByTitleRequest, ApiResponse
from config import Config
from notion_api.api import (
    search_by_title,
    ErrorResult,
    APIResponseError,
    upload_works,
    get_page_database_by_id,
    exchange_code_for_token,
)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def create_response(success: bool, data: Any = None, message: str = "", code: int = 0) -> JSONResponse:
    return JSONResponse(content={"success": success, "message": message, "data": data, "code": code})


@app.post("/upload-works", response_model=ApiResponse)
def upload_works_endpoint(data: list = Body(...)):
    """data 是可以直接传递给 upload_works，符合 notion.create.pages 参数要求的上传数据"""
    result = upload_works(data)
    # 只返回出错，插入失败的即可
    result = [r for r in result if isinstance(r, ErrorResult)]
    return ApiResponse(success=len(result) == len(data), data=result, code=status.HTTP_200_OK)


@app.post("/search-by-title", response_model=ApiResponse)
def search_by_title_endpoint(request: SearchByTitleRequest):
    try:
        result = search_by_title(query=request.query, search_for=request.search_for)
        if result is ErrorResult:
            return ApiResponse(success=False, code=status.HTTP_404_NOT_FOUND, message="No results found")
        return ApiResponse(success=True, data=result)
    except APIResponseError as e:
        return ApiResponse(success=False, code=status.HTTP_500_INTERNAL_SERVER_ERROR, message=str(e))


@app.get("/page-database/", response_model=ApiResponse)
def page_database_endpoint(
    PDId: str = Query(),
    PDType: Literal["page", "database"] = Query(),
):
    result = get_page_database_by_id(pd_id=PDId, pd_type=PDType)
    return ApiResponse(success=True, data=result)


@app.post("/exchange-code-for-token", response_model=ApiResponse)
def exchange_code_for_token_endpoint(code: str = Body(..., embed=True)):
    return exchange_code_for_token(code=code)


if __name__ == "__main__":
    app.run(debug=not Config.IS_PRODUCTION)
