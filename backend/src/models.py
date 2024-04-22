from enum import Enum
from typing import TypedDict, Optional, List


class WorkType(Enum):
    BOOK_SECTION = 'book-section'
    MONOGRAPH = 'monograph'
    REPORT_COMPONENT = 'report-component'
    REPORT = 'report'
    PEER_REVIEW = 'peer-review'
    BOOK_TRACK = 'book-track'
    JOURNAL_ARTICLE = 'journal-article'
    BOOK_PART = 'book-part'
    OTHER = 'other'
    BOOK = 'book'
    JOURNAL_VOLUME = 'journal-volume'
    BOOK_SET = 'book-set'
    REFERENCE_ENTRY = 'reference-entry'
    PROCEEDINGS_ARTICLE = 'proceedings-article'
    JOURNAL = 'journal'
    COMPONENT = 'component'
    BOOK_CHAPTER = 'book-chapter'
    PROCEEDINGS_SERIES = 'proceedings-series'
    REPORT_SERIES = 'report-series'
    PROCEEDINGS = 'proceedings'
    DATABASE = 'database'
    STANDARD = 'standard'
    REFERENCE_BOOK = 'reference-book'
    POSTED_CONTENT = 'posted-content'
    JOURNAL_ISSUE = 'journal-issue'
    DISSERTATION = 'dissertation'
    GRANT = 'grant'
    DATASET = 'dataset'
    BOOK_SERIES = 'book-series'
    EDITED_BOOK = 'edited-book'


class PublishInfo(TypedDict, total=False):
    publisher: Optional[str]
    containerTitle: Optional[str]
    issue: Optional[str]
    volume: Optional[str]
    pages: Optional[str]
    year: Optional[int]
    month: Optional[int]
    day: Optional[int]


class Author(TypedDict, total=False):
    familyName: str
    givenName: Optional[str]
    fullName: Optional[str]
    ORCID: Optional[str]


class DigitalResource(TypedDict, total=False):
    url: str
    contentType: Optional[str]


class ClinicalTrial(TypedDict):
    id: str
    registry: str


class Platform(Enum):
    ARXIV = 'arXiv'


class Work(TypedDict, total=False):
    title: str
    subtitle: Optional[str]
    authors: Optional[List[Author]]
    abstract: Optional[str]
    subjects: Optional[List[str]]
    DOI: Optional[str]
    platform: Optional[Platform]
    platformId: Optional[str]
    url: Optional[str]
    authorComments: Optional[List[str]]
    publishInfo: Optional[PublishInfo]
    referencedByCount: Optional[int]
    type: Optional[WorkType]
    ISBN: Optional[List[str]]
    digitalResources: Optional[List[DigitalResource]]
    clinicalTrial: Optional[List[ClinicalTrial]]
    references: Optional[List['Work']]
