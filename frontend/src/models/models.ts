// crossref.org 的 API 提供了很多 metadata 信息
// json api 的全部字段内容见 https://api.crossref.org/swagger-ui/index.html#/Types/get_types
// 字段含义见 https://github.com/CrossRef/rest-api-doc/blob/master/api_format.md
// xml api 有字段解释，https://data.crossref.org/reports/help/schema_doc/5.3.1/index.html，但是与 json api 并非完美对应
import { components } from './models_auto';

export type NPDInfo = components['schemas']['NPDInfo'];
export type NProperty = components['schemas']['NProperty'];
export type WorkType = components['schemas']['WorkType'];
export type PublishInfo = components['schemas']['PublishInfo'];
export type Author = components['schemas']['Author'];
export type Work = components['schemas']['Work'];
export type Platform = components['schemas']['Platform'];
export type DigitalResource = components['schemas']['DigitalResource'];
export type NAccessTokenWithWorkspace = components['schemas']['NAccessToken'];

// 这里的 WorkPropertyKeys 包含了 Work 中定义的所有属性名，以及这些属性名的组合/再处理得到的新属性（例如 date 就是 year+month+day 得到）
export type WorkPropertyKeys = keyof Work | keyof PublishInfo | keyof DigitalResource | 'date';

// key 是 database/page 的属性名（如果是 database，也就是列的列名），value 中 PDPropertyName 还是属性名，PDProperty 是该列的属性，
// WorkPropertyLabel 是 DisplayedWorkProperties 中的各个 Label 值，仅用于展示用
export type PDToWorkMapping = {
  [key: string]: {
    PDPropertyName: string;
    PDProperty: NProperty;
    workPropertyName: WorkPropertyKeys;
    workPropertyLabel: string;
  };
};

/**
 * 本地保存的某个数据库与文献的对应关系
 */
export type SavedPDToWorkMapping = {
  mapping: PDToWorkMapping;
  lastSaveTime?: Date;
};

/**
 * arxiv 网站对文献的主题分类
 */
export const ARXIV_SUBJECTS = {
  'cs.AI': 'Artificial Intelligence',
  'cs.AR': 'Hardware Architecture',
  'cs.CC': 'Computational Complexity',
  'cs.CE': 'Computational Engineering and Finance and Science',
  'cs.CG': 'Computational Geometry',
  'cs.CL': 'Computation and Language',
  'cs.CR': 'Cryptography and Security',
  'cs.CV': 'Computer Vision and Pattern Recognition',
  'cs.CY': 'Computers and Society',
  'cs.DB': 'Databases',
  'cs.DC': 'Distributed Parallel and Cluster Computing',
  'cs.DL': 'Digital Libraries',
  'cs.DM': 'Discrete Mathematics',
  'cs.DS': 'Data Structures and Algorithms',
  'cs.ET': 'Emerging Technologies',
  'cs.FL': 'Formal Languages and Automata Theory',
  'cs.GL': 'General Literature',
  'cs.GR': 'Graphics',
  'cs.GT': 'Computer Science and Game Theory',
  'cs.HC': 'Human-Computer Interaction',
  'cs.IR': 'Information Retrieval',
  'cs.IT': 'Information Theory',
  'cs.LG': 'Machine Learning',
  'cs.LO': 'Logic in Computer Science',
  'cs.MA': 'Multiagent Systems',
  'cs.MM': 'Multimedia',
  'cs.MS': 'Mathematical Software',
  'cs.NA': 'Numerical Analysis',
  'cs.NE': 'Neural and Evolving Computation',
  'cs.NI': 'Networking and Internet Architecture',
  'cs.OH': 'Other Computer Science',
  'cs.OS': 'Operating Systems',
  'cs.PF': 'Performance',
  'cs.PL': 'Programming Languages',
  'cs.RO': 'Robotics',
  'cs.SC': 'Symbolic Computation',
  'cs.SD': 'Sound',
  'cs.SE': 'Software Engineering',
  'cs.SI': 'Social and Information Networks',
  'cs.SY': 'Systems and Control',
  'econ.EM': 'Econometrics',
  'econ.GN': 'General Economics',
  'econ.TH': 'Theoretical Economics',
  'eess.AS': 'Audio and Speech Processing',
  'eess.IV': 'Image and Video Processing',
  'eess.SP': 'Signal Processing',
  'eess.SY': 'Systems and Control',
  'math.AC': 'Commutative Algebra',
  'math.AG': 'Algebraic Geometry',
  'math.AP': 'Analysis of PDEs',
  'math.AT': 'Algebraic Topology',
  'math.CA': 'Classical Analysis and ODEs',
  'math.CO': 'Combinatorics',
  'math.CT': 'Category Theory',
  'math.CV': 'Complex Variables',
  'math.DG': 'Differential Geometry',
  'math.DS': 'Dynamical Systems',
  'math.FA': 'Functional Analysis',
  'math.GM': 'General Mathematics',
  'math.GN': 'General Topology',
  'math.GR': 'Group Theory',
  'math.GT': 'Geometric Topology',
  'math.HO': 'History and Overview',
  'math.IT': 'Information Theory',
  'math.KT': 'K-Theory and Homology',
  'math.LO': 'Logic',
  'math.MG': 'Metric Geometry',
  'math.MP': 'Mathematical Physics',
  'math.NA': 'Numerical Analysis',
  'math.NT': 'Number Theory',
  'math.OA': 'Operator Algebras',
  'math.OC': 'Optimization and Control',
  'math.PR': 'Probability',
  'math.QA': 'Quantum Algebra',
  'math.RA': 'Rings and Algebras',
  'math.RT': 'Representation Theory',
  'math.SG': 'Symplectic Geometry',
  'math.SP': 'Spectral Theory',
  'math.ST': 'Statistics Theory',
  'math-ph': 'Mathematical Physics',
  'ASTRO-PH': 'Astrophysics',
  'astro-ph.CO': 'Cosmology and Nongalactic Astrophysics',
  'astro-ph.EP': 'Earth and Planetary Astrophysics',
  'astro-ph.GA': 'Astrophysics of Galaxies',
  'astro-ph.HE': 'High Energy Astrophysical Phenomena',
  'astro-ph.IM': 'Instrumentation and Methods for Astrophysics',
  'astro-ph.SR': 'Solar and Stellar Astrophysics',
  'COND-MAT': 'Condensed Matter',
  'cond-mat.dis-nn': 'Disordered Systems and Neural Networks',
  'cond-mat.mes-hall': 'Mesoscale and Nanoscale Physics',
  'cond-mat.mtrl-sci': 'Materials Science',
  'cond-mat.other': 'Other Condensed Matter',
  'cond-mat.quant-gas': 'Quantum Gases',
  'cond-mat.soft': 'Soft Condensed Matter',
  'cond-mat.stat-mech': 'Statistical Mechanics',
  'cond-mat.str-el': 'Strongly Correlated Electrons',
  'cond-mat.supr-con': 'Superconductivity',
  'gr-qc': 'General Relativity and Quantum Cosmology',
  'hep-ex': 'High Energy Physics - Experiment',
  'hep-lat': 'High Energy Physics - Lattice',
  'hep-ph': 'High Energy Physics - Phenomenology',
  'hep-th': 'High Energy Physics - Theory',
  'nlin.AO': 'Adaptation and Self-Organizing Systems',
  'nlin.CD': 'Chaotic Dynamics',
  'nlin.CG': 'Cellular Automata and Lattice Gases',
  'nlin.PS': 'Pattern Formation and Solitons',
  'nlin.SI': 'Exactly Solvable and Integrable Systems',
  'nucl-ex': 'Nuclear Experiment',
  'nucl-th': 'Nuclear Theory',
  'physics.acc-ph': 'Accelerator Physics',
  'physics.ao-ph': 'Atmospheric and Oceanic Physics',
  'physics.app-ph': 'Applied Physics',
  'physics.atm-clus': 'Atomic and Molecular Clusters',
  'physics.atom-ph': 'Atomic Physics',
  'physics.bio-ph': 'Biological Physics',
  'physics.chem-ph': 'Chemical Physics',
  'physics.class-ph': 'Classical Physics',
  'physics.comp-ph': 'Computational Physics',
  'physics.data-an': 'Data Analysis and Statistics and Probability',
  'physics.ed-ph': 'Physics Education',
  'physics.flu-dyn': 'Fluid Dynamics',
  'physics.gen-ph': 'General Physics',
  'physics.geo-ph': 'Geophysics',
  'physics.hist-ph': 'History and Philosophy of Physics',
  'physics.ins-det': 'Instrumentation and Detectors',
  'physics.med-ph': 'Medical Physics',
  'physics.optics': 'Optics',
  'physics.plasm-ph': 'Plasma Physics',
  'physics.pop-ph': 'Popular Physics',
  'physics.soc-ph': 'Physics and Society',
  'physics.space-ph': 'Space Physics',
  'quant-ph': 'Quantum Physics',
  'q-bio.BM': 'Biomolecules',
  'q-bio.CB': 'Cell Behavior',
  'q-bio.GN': 'Genomics',
  'q-bio.MN': 'Molecular Networks',
  'q-bio.NC': 'Neurons and Cognition',
  'q-bio.OT': 'Other Quantitative Biology',
  'q-bio.PE': 'Populations and Evolution',
  'q-bio.QM': 'Quantitative Methods',
  'q-bio.SC': 'Subcellular Processes',
  'q-bio.TO': 'Tissues and Organs',
  'q-fin.CP': 'Computational Finance',
  'q-fin.EC': 'Economics',
  'q-fin.GN': 'General Finance',
  'q-fin.MF': 'Mathematical Finance',
  'q-fin.PM': 'Portfolio Management',
  'q-fin.PR': 'Pricing of Securities',
  'q-fin.RM': 'Risk Management',
  'q-fin.ST': 'Statistical Finance',
  'q-fin.TR': 'Trading and Market Microstructure',
  'stat.AP': 'Applications',
  'stat.CO': 'Computation',
  'stat.ME': 'Methodology',
  'stat.ML': 'Machine Learning',
  'stat.OT': 'Other Statistics',
  'stat.TH': 'Statistics Theory',
};
