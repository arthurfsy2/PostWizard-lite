// 英文停用词表（150+ 词）
export const englishStopWords = new Set([
  // 冠词
  'a', 'an', 'the',
  
  // 系动词
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  
  // 代词
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
  'you', 'your', 'yours', 'yourself', 'yourselves',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
  'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 
  'themselves', 'what', 'which', 'who', 'whom', 'this', 'that',
  'these', 'those',
  
  // 连词、介词
  'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while',
  'of', 'at', 'by', 'for', 'with', 'through', 'during', 'before',
  'after', 'above', 'below', 'up', 'down', 'in', 'out', 'on',
  'off', 'over', 'under', 'again', 'further', 'then', 'once',
  
  // 助动词、情态动词
  'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
  'can', 'could', 'would', 'should', 'may', 'might', 'must',
  'shall', 'will',
  
  // 其他常见停用词
  'about', 'against', 'into', 'to', 'from', 'here', 'there',
  'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
  'own', 'same', 'so', 'than', 'too', 'very', 'just', 'now',
  
  // Postcrossing 特定停用词
  'postcard', 'card', 'postcrossing', 'thanks', 'thank', 'dear',
  'hello', 'hi', 'greetings', 'best', 'wishes', 'regards',
]);
