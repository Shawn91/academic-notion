from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import sessionmaker

from database.db_models import AccessToken

engine = create_engine(f"sqlite:///{Path(__file__).resolve().parent}/database.db")
# 使用 with Session.begin()，会自动在 with 内部代码到结尾时自动提交事务，出错时也会自动 rollback
Session = sessionmaker(engine)


def insert_access_token(access_token_data: dict) -> bool:
    owner_user_id = access_token_data.get("owner", {}).get("user", {}).get("id")
    try:
        with Session.begin() as session:
            insert_statement = (
                insert(AccessToken)
                .values(
                    access_token=access_token_data["access_token"],
                    bot_id=access_token_data["bot_id"],
                    owner_user_id=owner_user_id,
                    duplicated_template_id=access_token_data.get("duplicated_template_id"),
                    token_type=access_token_data["token_type"],
                    workspace_icon=access_token_data.get("workspace_icon"),
                    workspace_id=access_token_data["workspace_id"],
                    workspace_name=access_token_data["workspace_name"],
                )
                .on_conflict_do_nothing(index_elements=["bot_id"])  # 已经存在则跳过
            )
            session.execute(insert_statement)
        return True
    except Exception:
        return False
