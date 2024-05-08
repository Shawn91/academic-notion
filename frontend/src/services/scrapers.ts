import { ARXIV_SUBJECTS, Work, WorkType } from 'src/models/models';
import { CrossrefClient } from '@jamesgopsill/crossref-client';
import wretch from 'wretch';
import { extractDateNumsFromStr, mergeObjects } from 'src/services/utils';

const crossrefClient = new CrossrefClient();

function intToStrWithZero(n: number | undefined): string | undefined {
  if (n === undefined) return undefined;
  if (n < 10) return `0${n}`;
  return `${n}`;
}

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
        year: resJson.issued?.dateParts?.at(0)?.at(0)?.toString(),
        month: intToStrWithZero(resJson.issued?.dateParts?.at(0)?.at(1)),
        day: intToStrWithZero(resJson.issued?.dateParts?.at(0)?.at(2)),
      },
      authors: resJson.author?.map((author) => ({
        familyName: author.family,
        givenName: author.given,
        ORCID: author.ORCID,
      })),
      digitalResources: resJson.link?.map((link) => ({
        resourceLink: link.URL,
        contentType: link.contentType,
      })),
      clinicalTrial: resJson.clinicalTrialNumber?.map((trial) => ({
        id: trial.clinicalTrialNumber,
        registry: trial.registry,
      })),
    };
  }
}

abstract class Scraper {
  /**
   * 判断是否是当前 scraper 所支持的 url
   */
  abstract matchUrl(url: string): boolean;

  /**
   * scraper 入口函数
   */
  abstract parseDoc(doc: Document): Promise<Work[]>;
}

/**
 * 获取 arxiv 网站搜索结果页的论文信息
 */
export class ArxivScraper extends Scraper {
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

  matchUrl(url: string): boolean {
    return url.startsWith('https://arxiv.org/abs/') || url.startsWith('https://arxiv.org/search/');
  }

  async parseDoc(doc: Document): Promise<Work[]> {
    const workIds = this.getWorkIds(doc);
    // 向 background script 发送搜索结果页所有文献的 id，以便后端可以获取文献的详细信息
    const res = await chrome.runtime.sendMessage({ data: workIds, message: 'fetch-arxiv-works-info' });
    // 将获取到的 xml 格式文献信息解析后，发送给 popup
    return this.parseWorks(res.data);
  }

  /**
   * id 有两种格式：hep-th/9901001 或 0704.0001v1。
   * 对应的论文详情页 link 为 https://arxiv.org/abs/hep-th/9901001 或 https://arxiv.org/abs/0704.0001v1
   */
  extractIdFromUrl(url: string): string | null {
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
  extractPublishInfoFromJournalRef(journalRef: string): {
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
   * 获取当前页面的所有文献 id。当前页面可能是文献搜索结果页，也可能是文献详情页
   */
  getWorkIds(doc: Document): string[] {
    // 文献详情页
    if (doc.documentURI?.startsWith('https://arxiv.org/abs/')) {
      return [this.extractIdFromUrl(doc.documentURI) as string];
    } else if (doc.documentURI?.startsWith('https://arxiv.org/search/')) {
      // 搜索结果页
      return Array.from(doc.querySelectorAll('a'))
        .filter((linkEle) => linkEle.href?.startsWith('https://arxiv.org/abs/'))
        .map((linkEle) => this.extractIdFromUrl(linkEle.href) as string);
    }
    return [];
  }

  /**
   * 输入 arxiv api 返回的多个论文的信息组成的 xml，解析成 Work 对象
   * @param rawWorksXML xml 格式的字符串。arxiv api 返回值
   */
  parseWorks(rawWorksXML: string): Work[] {
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
              digitalResources = [
                {
                  resourceLink: linkEle.getAttribute('href'),
                  contentType: linkEle.getAttribute('type'),
                },
              ];
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

export class GoogleScholarScraper extends Scraper {
  matchUrl(url: string): boolean {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname.startsWith('scholar.google.com') && parsedUrl.pathname === '/scholar';
  }

  _extractCitationNum(citationEle: Element | null, work: Work) {
    if (citationEle && citationEle.textContent) {
      const match = citationEle.textContent.match(/[0-9]+/);
      if (match && match.length > 0) {
        work['referencedByCount'] = parseInt(match[0]);
      }
    }
  }

  _extractAuthorsAndPublishInfo(publishInfoEle: Element | null, work: Work) {
    if (publishInfoEle && publishInfoEle.textContent) {
      // publisherWebsiteStr 内容可能有多种情况，可能是发表论文的期刊/出版商的网站，也可能是搜集了这篇论文的某个数据库网站
      const [authorStr, journalAndYearStr, publisherWebsiteStr] = publishInfoEle.textContent
        .split('-')
        .map((s) => s.trim());
      work['authors'] = authorStr.split(',').map((author) => {
        return { fullName: author };
      });
      // 有逗号，说明 journal 和年份信息都有
      if (journalAndYearStr.includes(',')) {
        const lastCommaIndex = journalAndYearStr.lastIndexOf(','); // journal 名字中也可能有逗号，所以需要找到最后一个逗号的位置
        const journalStr = journalAndYearStr.substring(0, lastCommaIndex).trim();
        const yearStr = journalAndYearStr.substring(lastCommaIndex + 1).trim();
        work['publishInfo'] = {
          containerTitle: journalStr,
          year: yearStr.trim(),
        };
      } else {
        // 没有逗号，目前来看是只有年份信息，但是不确定会不会可能只有 journal
        work['publishInfo'] = {
          year: journalAndYearStr.trim(),
        };
      }
    }
  }

  _extractDigitalResources(digitalResourceEles: NodeListOf<Element>, work: Work) {
    if (digitalResourceEles.length > 0) {
      work['digitalResources'] = [];
      digitalResourceEles.forEach((digitalResourceEle) => {
        const urlText = digitalResourceEle.textContent;
        const url = digitalResourceEle.getAttribute('href');
        if (!urlText || !url) return;
        // 对于 [PDF] nih.gov 这样的文本，可以判断当前是链接是 pdf 的下载链接
        if (urlText.startsWith('[PDF]') || url.endsWith('.pdf')) {
          work['digitalResources']?.push({
            resourceLink: url,
            contentType: 'application/pdf',
          });
        } else if (urlText.startsWith('[HTML]')) {
          // 以 [HTML] 开头的，可以判断当前是链接是论文详情页，但是详情页中有正文
          work['digitalResources']?.push({
            resourceLink: url,
            contentType: 'text/html',
          });
        } else if (urlText.startsWith('[')) {
          // 此时，可能是其他格式文本，如 doc 等
          work['digitalResources']?.push({
            resourceLink: url,
            contentType: 'application/octet-stream',
          });
        } else {
          // 其他情况下，视为是论文详情页。此时标题的 link 大概率才是下载链接
          if (!work['url']) work['url'] = url;
        }
      });
    }
  }

  parseDoc(doc: Document): Promise<Work[]> {
    const works: Work[] = [];
    // 'gs_r' 这个 class 是所有搜索结果的 div container 的 class
    doc.querySelectorAll('.gs_r').forEach((workEle) => {
      const titleEle = workEle.querySelector('.gs_rt a');
      // 文献标题的 url。点击后可能是文献详情页，也可能直接就是文献本身下载地址
      const urlELe = workEle.querySelector('.gs_rt a');
      const citationEle = workEle.querySelector('.gs_ri .gs_fl a[href^="/scholar?cites="]');
      // 包含了作者、年份、期刊、出版商网站
      const publishInfoEle = workEle.querySelector('.gs_a');
      // 大部分情况下，digitalResourcesEles 没有元素，说明没有下载链接。少部分情况，可能有一个下载链接。
      // 更少情况下，可能有一个下载链接和一个详情页链接
      const digitalResourceEles = workEle.querySelectorAll('.gs_or_ggsm a');
      const work: Work = {};
      if (titleEle && titleEle.textContent) {
        work['title'] = titleEle.textContent as string;
      } else {
        // 没有标题时，直接返回，不再继续解析
        return;
      }
      if (urlELe) {
        work['url'] = urlELe.getAttribute('href') as string;
      }
      this._extractCitationNum(citationEle, work);
      this._extractAuthorsAndPublishInfo(publishInfoEle, work);
      this._extractDigitalResources(digitalResourceEles, work);
      work['platform'] = 'GoogleScholar';
      works.push(work);
    });
    return Promise.resolve(works); // 包裹在 promise 里是为了和其他 scraper 保持一致
  }
}

export async function scrapeWorks(doc: Document): Promise<Work[] | null> {
  for (const scraper of [new ArxivScraper(), new GoogleScholarScraper()]) {
    if (scraper.matchUrl(doc.location.href)) {
      return await scraper.parseDoc(doc);
    }
  }
  return null;
}
