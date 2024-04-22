"""
Notion API 请求和返回值的 models
"""
from typing import TypedDict, Optional, Literal


class CreateEditBy(TypedDict):
    """由谁创建或修改"""

    type: Literal["user"]
    id: str


class Cover(TypedDict):
    """封面图"""

    type: Literal["external"]
    external: dict


class Icon(TypedDict):
    """图标"""

    type: Literal["emoji"]
    emoji: str


class Parent(TypedDict):
    type: Literal["workspace", "page_id"]  # 这里只列举了目前已知值
    workspace: bool
    database_id: str
    page_id: str  # 如果 parent 是 page，那么这里就是 page 的 id


class Property(TypedDict):
    """属性（即每个表格的每一列信息）"""

    id: str
    type: str  # 这一列是文本、日期、多选等
    name: str  # 这一列展示出来的列名
    rich_text: dict


class Annotations(TypedDict):
    """文本样式注解。目前已知的应用场景是 Page 或 Database 的 title 的样式"""

    bold: bool
    italic: bool
    strikethrough: bool
    underline: bool
    code: bool
    color: str


class TextLink(TypedDict):
    content: str
    link: Optional[str]


class PageDatabaseTitle(TypedDict):
    annotations: Annotations
    href: Optional[str]
    plain_text: str
    text: TextLink
    type: Literal["text"]  # 已知值有 "text"


class PageDatabase(TypedDict):
    """一条搜索结果，即一个 page 或 database 的信息"""

    id: str  # page 或 database 的 id
    object: Literal["page", "database"]
    created_time: str
    last_edited_time: str
    created_by: CreateEditBy
    last_edited_by: CreateEditBy
    cover: Optional[Cover]  # 封面图
    icon: Optional[Icon]  # 图标
    created_time: str
    parent: dict
    archived: bool
    in_trash: bool
    properties: dict[str, Property]  # key 是展示出来的列名（即 Property.name）
    parent: Parent
    description: list  # 内容不详
    is_inline: bool  # 应该是只有 database 才有
    public_url: Optional[str]
    title: list[PageDatabaseTitle]  # page 或 database 的 title。尚不清楚为何返回的是一个 list
    url: Optional[str]


class SearchByTitleResponse(TypedDict):
    """根据标题查找 page 或 database 时的 response。
    具体的查找结果字段是在 results 字段中，具体字段名参考 PageDatabase
    """

    has_more: bool  # 如果结果太多，可能只返回返回部分搜索结果，这个值表示当前返回值是否是最后一部分结果
    next_cursor: Optional[str]  # 如果还有返回结果，这个值表示下一次请求的 cursor
    object: Literal["list"]  # 当前返回的 results 字段类型是 dict 还是 list。似乎目前都是 list
    results: list[PageDatabase]  # 搜索结果内容
    page_or_database: dict  # 目前看到的已知值都是空 dict
    type: str  # 目前已知值有 "page_or_database"
    request_id: str  # 本次请求的 ID
