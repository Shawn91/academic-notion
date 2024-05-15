# 1. 论文网站注意事项
## 1.1 arXiv
### 1.1.1 Zotero 的处理
在 arXiv 的搜索结果页，zotero 只会抽取有 DOI 的论文，有时就算有 DIO 也会抽取失败。原因不详
### 1.1.2 信息提取注意事项
1. 有 API。https://info.arxiv.org/help/api/basics.html
2. 需要注意，有的论文后来又正式发表了，因此需要尽可能提取正式发表后的信息。但是arxiv 提供的 PDF 格式论文可能并非正式发表时的版本，此时又要标注文本来自 arxiv
3. arxiv 除了提供 PDF 版本原文外，有的还会提供压缩包，里面包含了更原始的文档，如图片、latex排版数据等。
4. 每个文章都有标签，标签大全见 https://arxiv.org/category_taxonomy
### 1.1.3 提取流程
1. 在 arxiv 的搜索结果页，点击 icon
2. background script 调用 executeScript 插入一个 popup iframe 到搜索结果页
3. 插入 popup 后，background script 发送一个 popup-open 消息给 content script
4. content script获取当前页面所有论文的 id，传送给 background script
5. background script 接收到所有 ids 后，调用 arxiv api，获取所有论文的信息，再传递给 popup 用于展示
# 2. 数据模型
在项目根目录下有个 models.yaml 文件，它是使用 OpenAPI 格式定义了所有数据模型。

可以通过工具，自动根据 models.yaml 生成对应的 typescript 和 python 的 models 文件，以实现类型标注

```shell
# python. 假设命令行在 backend 文件夹
datamodel-codegen --input ../models.yaml --output src/models/models_auto.py --input-file-type openapi  --encoding UTF-8 --use-double-quotes

# typescript. 假设命令行在 frontend 文件夹
npx openapi-typescript ../models.yaml -o src/models/models_auto.ts
```
typescript 导入自动生成的 models 稍微麻烦一点，参考 https://github.com/koxudaxi/datamodel-code-generator

另外，typescript 无法强制覆盖已经存在的 models_auto.ts，需要手动删除原有的文件，再生成新的

# 3. Notion 用户登录
正常的登录流程是：
1. 前端打开一个 `https://api.notion.com/v1/oauth/authorize` 地址，供用户登录其 notion 账号。
2. 登录成功后，notion 会访问 redirect uri（这个地址需要开发者在 integration 的设置页设置好），并在访问的同时携带一个 code
3. redirect uri 收到 notion 的 code，将其发送到后端，后端拿着这个 code，再发送到 `https://api.notion.com/v1/oauth/token` ， 从而拿到用户的 access token，并保存在数据库

在上述请求过程中，经过测试，发现如下注意事项：
* 无论是获取 code，还是使用 code 获取 access token 请求中，官方文档都要求在请求参数中添加上 redirect uri。然而经过测试，这两处都不需要添加。
  * integration 的设置中，允许添加多个 redirect uri，如果有多个 redirect uri 时，或许两处都需要添加？暂不确定
* integration 从 private 转换为 public 后，最好重新生成一下 OAuth client secret。否则容易获取 access token 失败

以下是不同情况下的 access token 请求的返回值。从下面的试验来看，
* access token，以及随着 access_token 一起返回的 bot_id（notion 文档建议数据库中以 bot_id 来索引 access token），都是绑定在 workspace 上的某一个用户。

* 一个用户有多个 workspace 时，每个 workspace 对应一个 access token 和 bot_id，对同一个 workspace 增删授权 pages/databases，不改变 access token 和 bot id

* 一个 workspace 多个用户都授权访问，则每个用户的 access token 和 bot id 都不同


```
1. 首次授权，同时授权两个 workspace 的 pages。似乎最终只能添加一个 workspace，即最后点击 "allow access" 时，页面显示的那个 workspace

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

 2. 在有授权pages的情况下，再次登录并添加已有授权的 workspace 的新 pages 授权。无论这个 pages 是来自 workspace 内的 private 部分，还是共享部分
 {'access_token': 'secret_GiWfkPZxl4TNmwIVPHiWKSc0w0ptDeAtJ88bKCTq5bT',
 'bot_id': '4508aed7-c1a4-429a-be23-0439a31998d3',
 'duplicated_template_id': None,
 'owner': {'type': 'user',
           'user': {'id': 'cc83df32-0517-4503-81aa-f8c24a67d8f8',
                    'object': 'user'}},
 'request_id': 'f7bab50c-afd2-468f-9da8-c3ed343d737b',
 'token_type': 'bearer',
 'workspace_icon': None,
 'workspace_id': 'bcd261e7-7a99-4e9d-8879-d59797d89959',
 'workspace_name': "Yuxiang's Workspace"}

  3. 在有授权pages的情况下，再次登录并添加从未授权的 workspace 的 pages 授权
  {'access_token': 'secret_9F1nfugVsWViIx4fiqf8bgXXtw7hD5TZcxrIGWgmPFY',
 'bot_id': '279b7448-6bf5-4ffe-bf9a-0bf5aa72a7e5',
 'duplicated_template_id': None,
 'owner': {'type': 'user',
           'user': {'id': 'cc83df32-0517-4503-81aa-f8c24a67d8f8',
                    'object': 'user'}},
 'request_id': 'e805bea3-a7c8-4005-a7e1-101a3e727982',
 'token_type': 'bearer',
 'workspace_icon': None,
 'workspace_id': 'd85ea4e8-d7fb-4924-ada6-97a11fbfad8c',
 'workspace_name': 'Example Team'}

 4. 在已经授权新 workspace 情况下，再次授权已经授权的 workspace
 {'access_token': 'secret_GiWfkPZxl4TNmwIVPHiWKSc0w0ptDeAtJ88bKCTq5bT',
 'bot_id': '4508aed7-c1a4-429a-be23-0439a31998d3',
 'duplicated_template_id': None,
 'owner': {'type': 'user',
           'user': {'id': 'cc83df32-0517-4503-81aa-f8c24a67d8f8',
                    'object': 'user'}},
 'request_id': 'cb0ce459-37c6-487f-ac61-414965424582',
 'token_type': 'bearer',
 'workspace_icon': None,
 'workspace_id': 'bcd261e7-7a99-4e9d-8879-d59797d89959',
 'workspace_name': "Yuxiang's Workspace"}

5. 一个共享的 workspace，owner 已经添加授权的情况下，其他member再添加授权
{'access_token': 'secret_IuDYbPJaWrOyvsgHXNC1VauKwI2qX3B1p0KYtre5JqM',
 'bot_id': 'a5548c96-95bb-4f8f-8e41-799b8727cec1',
 'duplicated_template_id': None,
 'owner': {'type': 'user',
           'user': {'id': 'cf36cd9a-d012-43ca-8fce-e3b042facea0',
                    'object': 'user'}},
 'request_id': 'bcd3dc8b-e1c2-4af0-83a5-50ad335c12b6',
 'token_type': 'bearer',
 'workspace_icon': None,
 'workspace_id': 'bcd261e7-7a99-4e9d-8879-d59797d89959',
 'workspace_name': "Yuxiang's Workspace"}
```
