from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


# declarative base class
class Base(DeclarativeBase):
    pass


class AccessToken(Base):
    """根据当前的测试来看，用户+workspace对应一个固定不变的 access_token 和 bot_id
    notion 返回的 access token 相关数据格式为
    {'access_token': 'secret_GiWfkPZxl4TNmwIVPHiWKSc0w0ptDeAtJ88bKCTq5bT',
     'bot_id': '4508aed7-c1a4-429a-be23-0439a31998d3',
     'duplicated_template_id': None,
     'owner': {'type': 'user',
               'user': {'id': 'cc83df32-0517-4503-81aa-f8c24a67d8f8',
                        'object': 'user'}},
     'request_id': 'bb559033-faab-44c9-8204-444687e52f57',
     'token_type': 'bearer',
     'workspace_icon': None,
     'workspace_id': 'bcd261e7-7a99-4e9d-8879-d59797d89959',
     'workspace_name': "Yuxiang's Workspace"}

     其中 owner 字段值也可能是 {"workspace": true}。不过目前测试来看，没有发现这种情况，所以暂时不考虑

     bot_id 根据文档，建议设置为 primary key

     duplicated_template_id 只适用于当 integration 提供了 template database/page 后，
     用户选择使用该 template 生成自己的 page/database 时，生成的 page/database id
    """

    __tablename__ = "access_token"

    access_token: Mapped[str] = mapped_column()
    bot_id: Mapped[str] = mapped_column(primary_key=True)
    duplicated_template_id: Mapped[str] = mapped_column(nullable=True)
    # 当 owner 为 user 时，提取 user id
    owner_user_id: Mapped[str] = mapped_column(index=True, nullable=True)
    token_type: Mapped[str] = mapped_column()
    workspace_icon: Mapped[str] = mapped_column(nullable=True)
    workspace_id: Mapped[str] = mapped_column()
    workspace_name: Mapped[str] = mapped_column(nullable=True)
