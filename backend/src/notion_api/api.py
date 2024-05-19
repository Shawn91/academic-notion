"""
TODO: 自动调整 api 发送速率
根据 https://developers.notion.com/reference/request-limits，每15分钟最多 2700 个请求。
目前尚不清楚这个是整个 app 的限制，还是根据 user access token 的 per user 限制（有网友表示是 per user）。
如果返回的 HTTP 代码是 429，表示超过了限制，此时返回结果的 header 中会包含多少秒后可以重试。

Notion API 的信息
1. 创建 database 的新 item 时：
    * 传入了不存在的字段名：
        * http code=400; error code = 'validation_error'; message='{字段名} is not a property that exists.'
    * 传入的字段名的类型错误（如数据库中 rich_text 类型，但是传入时写的是 'multi_select' 类型）
        * http code=400; error code = 'validation_error'; message='{字段名} is expected to be {类型}.'
    * 传入的字段名的类型写正确，但是传的值类型错误（如实际是 rich_text 类型，传入时写的也是 rich_text，但是传的值就是数字）
        * http code=400; error code = 'validation_error'; message='{字段名} is expected to be {类型}.'
    * Status 类型字段传入不存在的值
        * http code=400; error code = 'validation_error';
          message='Invalid status option. Status option "{传的值}" does not exist".'
    * select, multi_select 类型字段传入不存在的值
        * 成功
    * 一次传入多个类型错误
        * 返回其中一种错误
    * 日期传入的值格式不对，默认格式是 "2022-01-01"
        * http code=400; error code = 'validation_error';
          message='body failed validation: body.properties.Date.date.start should be a valid ISO 8601 date string,
                   instead was `"2022/01/02"`.
    * URL 类型数据传入的是普通字符串
        * 插入成功
"""
import json
import string
from dataclasses import dataclass
from typing import Literal, Any

import httpx
from notion_client import APIResponseError, AsyncClient
from notion_client.helpers import async_collect_paginated_api

from config import Config
from database.db_client import save_user, save_access_token
from models import NPDInfo, NUser, NAccessToken

notion = AsyncClient(auth=Config.NOTION_SECRET)
# 这个 httpx_auth 可以直接作为参数传递给 httpx.Client，这样所有请求都会带上这个 auth。也可以在每次请求时传递。
# 这个 auth 本质上就是将 username 和 password 拼接后，转换为 base64 字符串，再添加到请求 header 中，这是 http 协议的基础认证方法
httpx_auth = httpx.BasicAuth(username=Config.NOTION_CLIENT_ID, password=Config.NOTION_SECRET)
httpx_client = httpx.Client()


@dataclass
class ErrorResult:
    message: str
    code: int | str
    data: Any | None = None


async def search_by_title(
    query: str, search_for: Literal["database", "page"], access_token: str = ""
) -> list[NPDInfo] | ErrorResult:
    """根据标题查找 page 或 database"""
    # page_size 最大值就是 100，即每次最多返回 100 条结果
    options = {
        "query": query,
        "filter": {"value": search_for, "property": "object"},
        "sort": {"direction": "descending", "timestamp": "last_edited_time"},
        "page_size": 100,
    }
    if access_token:
        options["auth"] = access_token
    try:
        search_results: list[NPDInfo] = await async_collect_paginated_api(
            notion.search,
            **options,
        )
        return search_results
    except APIResponseError as error:
        return ErrorResult(message="Notion API error", code=error.status)


async def upload_works(work_to_database_properties: list[dict], access_token: str) -> list[NPDInfo | ErrorResult]:
    """work_to_database_properties 是已经整理好格式的上传内容，直接将元素传递给 notion.pages.create 即可"""
    results = []
    for properties in work_to_database_properties:
        try:
            results.append(await notion.pages.create(**properties, auth=access_token))
        except APIResponseError as error:
            results.append(
                ErrorResult(
                    message=json.loads(error.body).get("message", "Notion API error"), code=error.code, data=properties
                )
            )
    return results


async def get_page_database_by_id(
    pd_id: str, pd_type: Literal["page", "database"], access_token: str
) -> NPDInfo | ErrorResult:
    try:
        if pd_type == "page":
            pd = await notion.pages.retrieve(page_id=pd_id, auth=access_token)
        else:
            pd = await notion.databases.retrieve(database_id=pd_id, auth=access_token)
        return pd
    except APIResponseError as error:
        return ErrorResult(message=json.loads(error.body).get("message", "Notion API error"), code=error.code)


async def exchange_code_for_token(code: str) -> NAccessToken | ErrorResult:
    """用户通过 notion 的 oauth 登录后，拿到的是一个 code，将这个 code 发送到后端，由后端再次向 notion 获取 access token"""
    token_url = "https://api.notion.com/v1/oauth/token"
    token_data = {
        "grant_type": "authorization_code",
        "code": code,
    }
    token_headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(token_url, json=token_data, headers=token_headers, auth=httpx_auth)
    response_json = response.json()
    if response_json.get("error"):  # 有 error 字段说明出错了
        return ErrorResult(message=response_json.get("error_description"), code=400)
    try:
        access_token_model = NAccessToken.parse_obj(response_json)
    except Exception as e:
        return ErrorResult(message=str(e), code=500)
    save_access_token(access_token_model=access_token_model)
    return access_token_model


async def get_user_info(user_id: string, access_token: string) -> NUser | ErrorResult:
    try:
        user_dict = await notion.users.retrieve(user_id=user_id, auth=access_token)
        user_model = NUser.parse_obj(user_dict)
        save_user(user=user_model)
        return user_model
    except APIResponseError as error:
        return ErrorResult(message=error.body, code=error.status)
