"""
TODO: 自动调整 api 发送速率
根据 https://developers.notion.com/reference/request-limits，每15分钟最多 2700 个请求。
目前尚不清楚这个是整个 app 的限制，还是根据 user access token 的 per user 限制（有网友表示是 per user）。
如果返回的 HTTP 代码是 429，表示超过了限制，此时返回结果的 header 中会包含多少秒后可以重试。
"""
from dataclasses import dataclass
from typing import Literal, TypedDict, Optional

from notion_client import Client, APIResponseError
from notion_client.helpers import collect_paginated_api

from config import Config
from notion_api.models import PageDatabase

notion = Client(auth=Config.NOTION_SECRET)


@dataclass
class ErrorResult:
    message: str
    code: int


class SearchByTitleResult(TypedDict):
    """函数 search_by_title 的返回值。不是 notion api 的原始返回值"""

    title: str
    id: str
    url: Optional[str]


def search_by_title(query: str, search_for: Literal["database", "page"]) -> list[SearchByTitleResult] | ErrorResult:
    """根据标题查找 page 或 database"""
    # page_size 最大值就是 100，即每次最多返回 100 条结果
    try:
        search_results: list[PageDatabase] = collect_paginated_api(
            notion.search,
            **{
                "query": query,
                "filter": {"value": search_for, "property": "object"},
                "sort": {"direction": "descending", "timestamp": "last_edited_time"},
                "page_size": 100,
            }
        )
    except APIResponseError as error:
        return ErrorResult(message="Notion API error", code=error.status)
    return [
        {"title": result["title"][0]["plain_text"], "id": result["id"], "url": result["url"]}
        for result in search_results
    ]
