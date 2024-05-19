from typing import Union

from pydantic import Field

from models.api_models import SearchByTitleRequest, ApiResponse
from models.models_auto import (
    Work,
    NPDInfo,
    NUser,
    NAccessToken,
    NAccessTokenOwnerUser,
    NAccessTokenOwnerWorkspace,
)

#
# class NAccessToken(RawNAccessToken):
#     """自动生成的 RawAccessToken 的 owner 字段有两个可能的值，pydantic 无法自动区分，因此这里继承后，使用 discriminator 来区分"""
#
#     owner: Union[NAccessTokenOwnerUser, NAccessTokenOwnerWorkspace] = Field(..., discriminator="type")
