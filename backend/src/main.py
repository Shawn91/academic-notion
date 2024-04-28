import sys
from pathlib import Path
from pprint import pprint
from typing import Any

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

sys.path.append(str(Path(__file__).parent.resolve()))

from models import SearchByTitleRequest, ApiResponse
from config import Config
from notion_api.api import search_by_title, ErrorResult, notion, APIResponseError


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


@app.post("/upload-works")
async def upload_works_endpoint():
    # Implement your logic here
    pass


@app.post("/search-by-title", response_model=ApiResponse)
async def search_by_title_endpoint(request: SearchByTitleRequest):
    try:
        result = search_by_title(query=request.query, search_for=request.search_for)
        if result is ErrorResult:
            return ApiResponse(success=False, code=status.HTTP_404_NOT_FOUND, message="No results found")
        return ApiResponse(success=True, data=result)
    except APIResponseError as e:
        return ApiResponse(success=False, code=status.HTTP_500_INTERNAL_SERVER_ERROR, message=str(e))


if __name__ == "__main__":
    # app.run(debug=not Config.IS_PRODUCTION)
    try:
        notion.pages.create(
            **{
                "parent": {"database_id": Config.NOTION_TEST_DATABASE, "type": "database_id"},
                "properties": {
                    "Title": {
                        "title": [
                            {
                                "text": {
                                    "content": "VASARI-auto: equitable, efficient, and economical featurisation of glioma MRI"
                                }
                            }
                        ]
                    },
                },
                "children": [
                    {
                        "object": "block",
                        "type": "heading_2",
                        "heading_2": {"rich_text": [{"type": "text", "text": {"content": "Lacinato kale"}}]},
                    },
                ],
            }
        )
    except APIResponseError as error:
        pprint(error)
        pprint(error.code)
        pprint(error.status)
        pprint(str(error))
