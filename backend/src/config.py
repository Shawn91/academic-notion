from pathlib import Path

from dotenv import dotenv_values

CODE_ROOT = Path(__file__).parent.resolve()

env = dotenv_values(f"{CODE_ROOT.parent}/.env")


class Config:
    IS_PRODUCTION = env["PRODUCTION"] == "1"
    NOTION_CLIENT_ID = env["NOTION_CLIENT_ID"]
    NOTION_SECRET = env["NOTION_SECRET"]
    NOTION_TEST_DATABASE = env.get("NOTION_TEST_DATABASE")
