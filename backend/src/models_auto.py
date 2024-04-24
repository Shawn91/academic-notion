# generated by datamodel-codegen:
#   filename:  models.yaml
#   timestamp: 2024-04-24T07:19:13+00:00

from __future__ import annotations

from typing import Any, Dict, List

from typing_extensions import Literal, NotRequired, TypedDict


class NCreateEditBy(TypedDict):
    type: Literal['user']
    id: str


class NCover(TypedDict):
    type: Literal['external']
    external: Dict[str, Any]


class NIcon(TypedDict):
    type: Literal['emoji']
    emoji: str


class NParent(TypedDict):
    type: Literal['workspace', 'page_id', 'database_id']
    workspace: NotRequired[bool]
    database_id: NotRequired[str]
    page_id: NotRequired[str]


class NProperty(TypedDict):
    id: str
    type: str
    name: str
    rich_text: NotRequired[Dict[str, Any]]


class NAnnotations(TypedDict):
    bold: bool
    italic: bool
    strikethrough: bool
    underline: bool
    code: bool
    color: Literal[
        'blue',
        'blue_background',
        'brown',
        'brown_background',
        'default',
        'gray',
        'gray_background',
        'green',
        'green_background',
        'orange',
        'orange_background',
        'pink',
        'pink_background',
        'purple',
        'purple_background',
        'red',
        'red_background',
        'yellow',
        'yellow_background',
    ]


class NTextLink(TypedDict):
    content: NotRequired[str]
    link: NotRequired[str]


class Database(TypedDict):
    id: NotRequired[str]


class Data(TypedDict):
    start: NotRequired[str]
    end: NotRequired[str]


class LinkPreview(TypedDict):
    url: NotRequired[str]


class Page(TypedDict):
    id: NotRequired[str]


class TemplateMention(TypedDict):
    type: NotRequired[Literal['template_mention_date', 'template_mention_user']]
    template_mention_date: NotRequired[Literal['today', 'now']]
    template_mention_user: NotRequired[Literal['me']]


class User(TypedDict):
    id: NotRequired[str]
    object: NotRequired[Literal['user']]


class NMention(TypedDict):
    type: NotRequired[
        Literal['database', 'date', 'link_preview', 'page', 'template_mention', 'user']
    ]
    database: NotRequired[Database]
    data: NotRequired[Data]
    link_preview: NotRequired[LinkPreview]
    page: NotRequired[Page]
    template_mention: NotRequired[TemplateMention]
    user: NotRequired[User]


class NEquation(TypedDict):
    expression: str


class NRichText(TypedDict):
    annotations: NAnnotations
    href: NotRequired[str]
    plain_text: str
    text: NotRequired[NTextLink]
    mention: NotRequired[NMention]
    equation: NotRequired[NEquation]
    type: Literal['text', 'mention', 'equation']


class NPDInfo(TypedDict):
    id: str
    object: Literal['page', 'database']
    created_time: str
    last_edited_time: str
    created_by: NCreateEditBy
    last_edited_by: NCreateEditBy
    cover: NotRequired[NCover]
    icon: NotRequired[NIcon]
    parent: NParent
    archived: bool
    in_trash: bool
    properties: Dict[str, NProperty]
    description: List[Dict[str, Any]]
    is_inline: bool
    public_url: NotRequired[str]
    title: List[NRichText]
    url: NotRequired[str]


WorkType = Literal[
    'book-section',
    'monograph',
    'report-component',
    'report',
    'peer-review',
    'book-track',
    'journal-article',
    'book-part',
    'other',
    'book',
    'journal-volume',
    'book-set',
    'reference-entry',
    'proceedings-article',
    'journal',
    'component',
    'book-chapter',
    'proceedings-series',
    'report-series',
    'proceedings',
    'database',
    'standard',
    'reference-book',
    'posted-content',
    'journal-issue',
    'dissertation',
    'grant',
    'dataset',
    'book-series',
    'edited-book',
]


class PublishInfo(TypedDict):
    publisher: NotRequired[str]
    containerTitle: NotRequired[str]
    issue: NotRequired[str]
    volume: NotRequired[str]
    pages: NotRequired[str]
    year: NotRequired[int]
    month: NotRequired[int]
    day: NotRequired[int]


class Author(TypedDict):
    familyName: NotRequired[str]
    givenName: NotRequired[str]
    fullName: NotRequired[str]
    ORCID: NotRequired[str]


class DigitalResource(TypedDict):
    url: NotRequired[str]
    contentType: NotRequired[str]


class ClinicalTrial(TypedDict):
    id: NotRequired[str]
    registry: NotRequired[str]


Platform = Literal['arXiv']


class Work(TypedDict):
    title: NotRequired[str]
    subtitle: NotRequired[str]
    authors: NotRequired[List[Author]]
    abstract: NotRequired[str]
    subjects: NotRequired[List[str]]
    DOI: NotRequired[str]
    platform: NotRequired[Platform]
    platformId: NotRequired[str]
    url: NotRequired[str]
    authorComments: NotRequired[List[str]]
    publishInfo: NotRequired[PublishInfo]
    referencedByCount: NotRequired[int]
    type: NotRequired[WorkType]
    ISBN: NotRequired[List[str]]
    digitalResources: NotRequired[List[DigitalResource]]
    clinicalTrial: NotRequired[List[ClinicalTrial]]
    references: NotRequired[List[Work]]
