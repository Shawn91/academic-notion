import { ARXIV_SUBJECTS, Author, PublishInfo, Work, WorkType } from 'src/models/models';
import { CrossrefClient } from '@jamesgopsill/crossref-client';
import wretch from 'wretch';
import { extractDateNumsFromStr, extractPages, extractVolume, mergeObjects, waitForElement } from 'src/services/utils';

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

export class ScienceDirectScraper extends Scraper {
  SEARCH_URL = 'https://www.sciencedirect.com/search?'; // 搜索结果页 url
  WORK_URL = 'https://www.sciencedirect.com/science/article/'; // 文献详情页 url

  /**
   * @param searchResult 当前是搜索结果页还是文献详情页
   */
  extractPublishInfo(parentElement: Element, work: Work, searchResult = true) {
    if (searchResult) {
      // journalAndDateEle 文本是 "Journal of Nuclear Materials, July 2023"。其中期刊和日期分别属于一个 span
      // 中间的逗号是用 css 实现的，而非 html 里的
      const journalAndDateEle = parentElement.querySelector('.srctitle-date-fields');
      if (!journalAndDateEle) return;
      const journalAndDateSpans = journalAndDateEle.querySelectorAll(':scope > span');
      if (journalAndDateSpans.length !== 2) return;
      work['publishInfo'] = { containerTitle: journalAndDateSpans[0].textContent as string };
      const date = extractDateNumsFromStr(journalAndDateSpans[1].textContent as string);
      if (date) {
        work['publishInfo'] = Object.assign(work['publishInfo'], date);
      }
    } else {
      const publishInfo: PublishInfo = {};
      const journalEle = parentElement.querySelector('#publication-title');
      if (journalEle && journalEle.textContent) publishInfo['containerTitle'] = journalEle.textContent;
      // dateInfoEle 是格式类似 "Volume 101, 28 February 2022, Pages 226-233",
      // "Volume 219, Part A, January 2024, 112744", "Available online 1 February 2024" 的文本
      const dateInfoEle = parentElement.querySelector('.publication-volume div');
      if (dateInfoEle) {
        const volume = extractVolume(dateInfoEle.textContent as string);
        if (volume) publishInfo['volume'] = volume;
        const pages = extractPages(dateInfoEle.textContent as string);
        if (pages) publishInfo['pages'] = pages;
        const date = extractDateNumsFromStr(dateInfoEle.textContent as string);
        if (date) Object.assign(publishInfo, date);
      }
      if (Object.keys(publishInfo).length > 0) work['publishInfo'] = publishInfo;
    }
  }

  extractAuthors(parentElement: Element, work: Work, searchResult = true) {
    if (searchResult) {
      const authorsEles = parentElement.querySelectorAll('.Authors  li');
      if (!authorsEles) return;
      work['authors'] = Array.from(authorsEles).map((ele) => ({ fullName: ele.textContent as string }));
    } else {
      const authorsEles = parentElement.querySelectorAll('button[data-xocs-content-type="author"]');
      const authors: Author[] = [];
      Array.from(authorsEles).forEach((ele) => {
        const givenNameEle = ele.querySelector('.given-name');
        const surNameEle = ele.querySelector('.surname');
        if (givenNameEle && givenNameEle.textContent && surNameEle && surNameEle.textContent) {
          authors.push({
            givenName: givenNameEle.textContent,
            familyName: surNameEle.textContent,
            fullName: `${givenNameEle.textContent} ${surNameEle.textContent}`,
          });
        }
      });
      if (authors.length > 0) work['authors'] = authors;
    }
  }

  /**
   * 只有登录用户才能获取下载链接
   */
  extractDownloadLinks(parentElement: Element, work: Work, searchResult = true) {
    let downloadLinkEle;
    if (searchResult) {
      downloadLinkEle = parentElement.querySelector('.DownloadPdf a');
    } else {
      downloadLinkEle = parentElement.querySelector('.ViewPDF a');
    }
    if (!downloadLinkEle) return;
    work['digitalResources'] = [
      {
        resourceLink: ('https://www.sciencedirect.com' + downloadLinkEle.getAttribute('href')) as string,
        contentType: 'application/pdf',
      },
    ];
  }

  /**
   * 只有登录用户才能在搜索结果页获取摘要
   */
  extractAbstract(parentElement: Element, work: Work, searchResult = true) {
    if (searchResult) {
      const abstractEle = parentElement.querySelector('.abstract-section');
      if (!abstractEle) return;
      work['abstract'] = abstractEle.textContent as string;
    } else {
      const abstractEle = parentElement.querySelector('#abstracts');
      if (!abstractEle) return;
      const abstract = abstractEle.querySelector('.author div')?.textContent;
      if (abstract) work['abstract'] = abstract;
      const highlights = Array.from(abstractEle.querySelectorAll('.author-highlights li'));
      if (highlights.length > 0) {
        work['highlights'] = highlights.map((ele) => ele.textContent as string);
      }
    }
  }

  /**
   * 只有详情页才能看到关键词，搜索结果页拿不到关键词
   */
  extractKeywords(parentElement: Element, work: Work) {
    const keywordsEle = Array.from(parentElement.querySelectorAll('.keyword'));
    if (keywordsEle.length === 0) return;
    work['subjects'] = keywordsEle.map((ele) => ele.textContent as string);
  }

  /**
   * 抽取论文被引用次数。只有论文详情页有，搜索结果页没有
   */
  extractReferencedByCount(parentElement: Element, work: Work) {
    const referencedByCountStr = parentElement.querySelector('#citing-articles-header')?.textContent;
    if (!referencedByCountStr) return;
    const match = referencedByCountStr.match(/\d+/);
    if (match) work['referencedByCount'] = parseInt(match[0]);
  }

  matchUrl(url: string): boolean {
    return url.startsWith(this.SEARCH_URL) || url.startsWith(this.WORK_URL);
  }

  async parseSearchResultDoc(doc: Document): Promise<Work[]> {
    const works: Work[] = [];
    await this.expandAbstracts();
    // 'result-item-content' 这个 class 是所有搜索结果的 div container 的 class
    document.querySelectorAll('.result-item-content').forEach((workEle) => {
      const work: Work = {};
      const titleEle = workEle.querySelector('h2 a');
      if (titleEle) {
        work['title'] = titleEle.textContent as string;
      } else {
        return;
      }
      work['url'] = ('https://www.sciencedirect.com' + titleEle.getAttribute('href')) as string;
      this.extractPublishInfo(workEle, work);
      this.extractAuthors(workEle, work);
      this.extractDownloadLinks(workEle, work);
      this.extractAbstract(workEle, work);
      works.push(work);
    });
    return works;
  }

  /**
   * 获取文献详情页的文献信息
   */
  parseWorkDoc(doc: Document): Work {
    const work: Work = {};
    const titleEle = doc.querySelector('#screen-reader-main-title');
    if (!titleEle) return work;
    work['title'] = titleEle.textContent as string;
    work['url'] = doc.documentURI;
    this.extractPublishInfo(doc.body, work, false);
    this.extractAuthors(doc.body, work, false);
    this.extractDownloadLinks(doc.body, work, false);
    this.extractAbstract(doc.body, work, false);
    this.extractKeywords(doc.body, work);
    this.extractReferencedByCount(doc.body, work);
    return work;
  }

  async parseDoc(doc: Document): Promise<Work[]> {
    if (doc.documentURI.startsWith(this.SEARCH_URL)) {
      return await this.parseSearchResultDoc(doc);
    } else if (doc.documentURI.startsWith(this.WORK_URL)) {
      const work = this.parseWorkDoc(doc);
      return Promise.resolve([work]);
    }
    return Promise.resolve([]); // 不会走到这里，只是为了防止类型检查报错
  }

  /**
   * 在搜索结果页，可以查看每个文献的摘要，但是需要点一个按钮，然后异步加载
   * 只有登录用户才能在搜索结果页获取摘要
   */
  async expandAbstracts() {
    document.querySelectorAll('.PreviewLinks').forEach((container) => {
      // 摘要已经展开，不用再次展开
      if (container.querySelector('.preview-body-container')) return;
      container
        .querySelector('button[aria-label="Abstract"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    for (const container of Array.from(document.querySelectorAll('.preview-body-container'))) {
      await waitForElement(container, ['.abstract-section', '.empty-abstract']);
    }
  }
}

export async function scrapeWorks(doc: Document): Promise<Work[] | null> {
  for (const scraper of [new ArxivScraper(), new GoogleScholarScraper(), new ScienceDirectScraper()]) {
    if (scraper.matchUrl(doc.location.href)) {
      return await scraper.parseDoc(doc);
    }
  }
  return null;
}
