import { ARXIV_SUBJECTS, Platform, Work, WorkType } from 'src/models/models';
import { CrossrefClient } from '@jamesgopsill/crossref-client';
import wretch from 'wretch';
import { extractDateNumsFromStr, mergeObjects } from 'src/services/utils';

const crossrefClient = new CrossrefClient();

/**
 * 给定 DOI，从 crossref.org 的 api 中获取论文信息
 */
export class DOIScraper {
  static async fetchWorkByDOI(doi: string): Promise<Work | null> {
    const res = await crossrefClient.work(doi);
    if (!(res.ok && res.status == 200)) return null;
    const resJson = res.content.message;
    return {
      title: resJson.title[0],
      abstract: resJson.abstract,
      referencedByCount: resJson.isReferencedByCount,
      DOI: resJson.DOI,
      url: resJson.URL, // 这个地址实际上是 crossref 提供的 DOI 链接，点击后会自动跳转到实际的文献页面
      type: resJson.type as WorkType,
      subtitle: resJson.subtitle?.at(0),
      subjects: resJson.subject,
      ISBN: resJson.ISBN,
      publishInfo: {
        publisher: resJson.publisher,
        containerTitle: resJson.containerTitle?.at(0),
        issue: resJson.issue,
        volume: resJson.volume,
        pages: resJson.page,
        year: resJson.issued?.dateParts?.at(0)?.at(0),
        month: resJson.issued?.dateParts?.at(0)?.at(1),
        day: resJson.issued?.dateParts?.at(0)?.at(2),
      },
      authors: resJson.author?.map((author) => ({
        familyName: author.family,
        givenName: author.given,
        ORCID: author.ORCID,
      })),
      digitalResources: resJson.link?.map((link) => ({
        resourceLink: link.URL,
        description: link.contentType,
      })),
      clinicalTrial: resJson.clinicalTrialNumber?.map((trial) => ({
        id: trial.clinicalTrialNumber,
        registry: trial.registry,
      })),
    };
  }
}

/**
 * 获取 arxiv 网站搜索结果页的论文信息
 */
export class ArxivScraper {
  /**
   * id 有两种格式：hep-th/9901001 或 0704.0001v1。
   * 对应的论文详情页 link 为 https://arxiv.org/abs/hep-th/9901001 或 https://arxiv.org/abs/0704.0001v1
   */
  static extractIdFromUrl(url: string): string | null {
    // 定义正则表达式，匹配 https://arxiv.org/abs/ 之后的所有字符
    const regex = /https:\/\/arxiv\.org\/abs\/(.+)/;
    const matches = url.match(regex);
    if (matches && matches.length > 1) {
      return matches[1];
    } else {
      return null;
    }
  }

  /**
   * 从 journal_ref 字段中提取期刊名、卷号、年份、页码
   * 所有 journal_ref 都是 "Phys.Lett. B305 (1993) 115-118" 即期刊名、卷号、年份、页码
   * 有可能是 “J.Hasty Results 1 (2008) 1-9; Erratum: J.Hasty Results 2 (2008) 1-2” 这样用 ; 分隔了多个期刊或勘误信息
   * 取第一个再解析即可
   */
  static extractPublishInfoFromJournalRef(journalRef: string): {
    containerTitle?: string;
    volume?: string;
    yearNum?: number;
    pages?: string;
  } {
    const oneJournalRef = journalRef.split(';')[0];
    const info = oneJournalRef.split(' ');
    const pages = info.pop() as string;
    const year = info.pop();
    const containerTitle = info.shift();
    const volume = info.join(' ');
    const yearNum = year ? parseInt(year.slice(1, 5)) : undefined;
    return { containerTitle, volume, yearNum, pages };
  }

  /**
   * 获取当前搜索结果页面的所有文献 id
   */
  static getWorkIds(doc: Document): string[] {
    return Array.from(doc.querySelectorAll('a'))
      .filter((linkEle) => linkEle.href?.startsWith('https://arxiv.org/abs/'))
      .map((linkEle) => this.extractIdFromUrl(linkEle.href) as string);
  }

  /**
   * 获取所有搜索结果中的文献相关信息
   * 这里后用 arxiv api 发送请求，根据id获取其他具体信息，而非直接从 html 中获取。
   * 这样可以尽可能避免 html 样式变化导致爬取内容失败
   *
   * @returns {Promise<string>} xml 格式的字符串
   */
  static async fetchRawWorksInfo(ids: string[]): Promise<string> {
    return await wretch(`http://export.arxiv.org/api/query?max_results=${ids.length}&id_list=${ids.join(',')}`)
      .get()
      .text();
  }

  /**
   * 输入 arxiv api 返回的多个论文的信息组成的 xml，解析成 Work 对象
   * @param rawWorksXML xml 格式的字符串。arxiv api 返回值
   */
  static parseWorks(rawWorksXML: string): Work[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawWorksXML, 'text/xml');
    const workElements = doc.getElementsByTagName('entry');
    return Array.from(workElements).map((workEle) => {
      // 出版信息
      const publishDate = workEle.getElementsByTagName('published')?.[0]?.textContent;
      const journalRef = workEle.querySelector('arxiv\\:journal_ref')?.textContent;
      let publishInfo;
      if (publishDate) {
        publishInfo = extractDateNumsFromStr(publishDate);
      }
      if (journalRef) {
        const publishInfoFromJournalRef = this.extractPublishInfoFromJournalRef(journalRef);
        if (!publishInfo) {
          publishInfo = publishInfoFromJournalRef;
        } else {
          publishInfo = mergeObjects(publishInfo, publishInfoFromJournalRef);
        }
      }

      // 作者
      const authorEles = workEle.getElementsByTagName('author');
      let authors;
      if (authorEles.length > 0) {
        authors = Array.from(authorEles).map((authorEle) => {
          return { fullName: authorEle.textContent };
        });
      }

      // 详情页、下载链接、DOI等
      let url: string | undefined;
      let digitalResources;
      const linkEles = workEle.getElementsByTagName('link');
      if (linkEles.length > 0) {
        Array.from(linkEles).forEach((linkEle) => {
          // 如果有 DOI 时，取 DOI 的链接；没有 DOI 时，取 arxiv 链接
          if (linkEle.getAttribute('rel') === 'alternate' && !url) {
            url = linkEle.getAttribute('href') as string;
          }
          if (linkEle.getAttribute('rel') === 'related') {
            if (linkEle.getAttribute('title') === 'pdf') {
              digitalResources = {
                url: linkEle.getAttribute('href'),
                contentType: linkEle.getAttribute('type'),
              };
            }
            if (linkEle.getAttribute('title') === 'doi') {
              url = linkEle.getAttribute('href') as string;
            }
          }
        });
      }

      // DOI
      const doi = workEle.querySelector('arxiv\\:doi')?.textContent;
      if (doi) {
        url = `https://dx.doi.org/${doi}`;
      }

      // 主题 subjects
      const subjects: string[] = [];
      const subjectEles = workEle.getElementsByTagName('category');
      if (subjectEles.length > 0) {
        Array.from(subjectEles).forEach((categoryEle) => {
          const term = categoryEle.getAttribute('term');
          if (term && term in ARXIV_SUBJECTS) {
            subjects.push(ARXIV_SUBJECTS[term as keyof typeof ARXIV_SUBJECTS]);
          }
        });
      }

      // 作者评论
      const comments: string[] = [];
      const commentEles = workEle.querySelectorAll('arxiv\\:comment');
      if (commentEles.length > 0) {
        Array.from(commentEles).forEach((commentEle) => {
          const comment = commentEle.textContent;
          if (comment) {
            comments.push(comment);
          }
        });
      }

      return {
        title: workEle.getElementsByTagName('title')?.[0].textContent,
        platform: 'arXiv',
        platformId: workEle.getElementsByTagName('id')?.[0].textContent,
        publishInfo: publishInfo,
        abstract: workEle.getElementsByTagName('summary')?.[0].textContent,
        authors: authors,
        url: url,
        digitalResources: digitalResources,
        subjects: subjects,
        authorComments: comments,
        DOI: doi,
      } as Work;
    });
  }
}
