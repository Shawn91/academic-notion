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
