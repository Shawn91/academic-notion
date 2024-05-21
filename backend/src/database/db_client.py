from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import sessionmaker

from src.database.db_models import AccessToken, User, Base
from src.models import NAccessToken, NUser

engine = create_engine(f"sqlite:///{Path(__file__).resolve().parent}/database.db")
# 使用 with Session.begin()，会自动在 with 内部代码到结尾时自动提交事务，出错时也会自动 rollback
Session = sessionmaker(engine)
Base.metadata.create_all(engine, checkfirst=True)


def save_access_token(access_token_model: NAccessToken) -> bool:
    try:
        owner_user_id = access_token_model.owner.user.id
        with Session.begin() as session:
            insert_statement = (
                insert(AccessToken)
                .values(
                    access_token=access_token_model.access_token,
                    bot_id=access_token_model.bot_id,
                    owner_user_id=owner_user_id,
                    duplicated_template_id=access_token_model.duplicated_template_id,
                    token_type=access_token_model.token_type,
                    workspace_icon=access_token_model.workspace_icon,
                    workspace_id=access_token_model.workspace_id,
                    workspace_name=access_token_model.workspace_name,
                )
                .on_conflict_do_nothing(index_elements=["bot_id"])  # 已经存在则跳过
            )
            session.execute(insert_statement)
        return True
    except Exception as e:
        return False


def save_user(user: NUser) -> bool:
    try:
        with Session.begin() as session:
            insert_stmt = insert(User).values(
                id=user.id, type=user.type.value, email=user.person.email, name=user.name, avatar_url=user.avatar_url
            )
            insert_stmt = insert_stmt.on_conflict_do_nothing(index_elements=["id"])
            session.execute(insert_stmt)
        return True
    except Exception as e:
        print(e)
        return False
