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
datamodel-codegen --input ../models.yaml --output src/models_auto.py --input-file-type openapi  --encoding UTF-8

# typescript. 假设命令行在 frontend 文件夹
npx openapi-typescript ../models.yaml -o src/models/models_auto.ts
```
typescript 导入自动生成的 models 稍微麻烦一点，参考 https://github.com/koxudaxi/datamodel-code-generator

另外，typescript 无法强制覆盖已经存在的 models_auto.ts，需要手动删除原有的文件，再生成新的
