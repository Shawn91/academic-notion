import sys
from pathlib import Path
from typing import Any

from fastapi import FastAPI, status, Body, Request
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
async def upload_works_endpoint(request: Request):
    """data 是可以直接传递给 upload_works，符合 notion.create.pages 参数要求的上传数据"""
    request_data = await request.json()
    result = upload_works(request_data["data"], request_data["access_token"])
    # 只返回出错，插入失败的即可
    result = [r.data for r in result if isinstance(r, ErrorResult)]
    return ApiResponse(success=len(result) == len(request_data["data"]), data=result, code=status.HTTP_200_OK)


@app.post("/search-by-title", response_model=ApiResponse)
async def search_by_title_endpoint(request: SearchByTitleRequest):
    try:
        result = search_by_title(query=request.query, search_for=request.search_for, access_token=request.access_token)
        if isinstance(result, ErrorResult):
            return ApiResponse(success=False, code=status.HTTP_404_NOT_FOUND, message="No results found")
        return ApiResponse(success=True, data=result)
    except APIResponseError as e:
        return ApiResponse(success=False, code=status.HTTP_500_INTERNAL_SERVER_ERROR, message=str(e))


@app.post("/page-database/", response_model=ApiResponse)
async def page_database_endpoint(request: Request):
    request_data = await request.json()
    pd_id = request_data["PDId"]
    pd_type = request_data["PDType"]
    access_token = request_data["access_token"]
    result = get_page_database_by_id(pd_id=pd_id, pd_type=pd_type, access_token=access_token)
    return ApiResponse(success=True, data=result)


# 如果使用 GET 请求，access token 就要放在 url 中，不够安全，因此使用 POST
@app.post("/exchange-code-for-token", response_model=ApiResponse)
async def exchange_code_for_token_endpoint(code: str = Body(..., embed=True)):
    token_result = exchange_code_for_token(code=code)
    if isinstance(token_result, ErrorResult):
        return ApiResponse(success=False, code=token_result.code, message=token_result.message)
    return ApiResponse(data=token_result, success=True)


if __name__ == "__main__":
    app.run(debug=not Config.IS_PRODUCTION)
