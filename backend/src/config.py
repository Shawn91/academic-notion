import os
from pathlib import Path

from dotenv import load_dotenv

CODE_ROOT = Path(__file__).parent.resolve()
load_dotenv(f"{CODE_ROOT.parent}/.env")


class Config:
    IS_PRODUCTION = os.environ["PRODUCTION"] == "1"
    NOTION_CLIENT_ID = os.environ["NOTION_CLIENT_ID"]
    NOTION_SECRET = os.environ["NOTION_SECRET"]
    NOTION_TEST_DATABASE = os.environ.get("NOTION_TEST_DATABASE")
    # vercel 的 postgresql 的链接路径是 postgres:// 开头，但是 sqlalchemy 要求是 postgresql:// 开头，替换一下即可
    POSTGRES_URL = os.environ.get("POSTGRES_URL").replace("postgres://", "postgresql://")
