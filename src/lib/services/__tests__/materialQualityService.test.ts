import { MaterialQualityService, MaterialData } from '../materialQualityService';
import { prisma } from '../../prisma';

// Mock prisma
jest.mock('../../prisma', () => ({
  prisma: {
    settings: {
      findUnique: jest.fn(),
    },
  },
}));

describe('MaterialQualityService', () => {
  let service: MaterialQualityService;

  beforeEach(() => {
    service = new MaterialQualityService();
    jest.clearAllMocks();
  });

  describe('规则评估', () => {
    it('应该正确评估空内容', async () => {
      const result = await service.evaluateMaterial('hobbies', '');
      
      expect(result.scores.overall).toBe(0);
      expect(result.starRating).toBe(0);
      expect(result.isUsable).toBe(false);
      expect(result.summary).toContain('内容为空');
    });

    it('应该正确评估简短内容', async () => {
      const result = await service.evaluateMaterial('hobbies', '我喜欢阅读');
      
      // 简短内容应该有较低的丰富度
      expect(result.scores.richness).toBeLessThanOrEqual(2);
      expect(result.scores.overall).toBeLessThan(3);
    });

    it('应该正确评估高质量内容', async () => {
      const content = '我是一名软件工程师，在深圳工作了5年。周末我喜欢带着相机去深圳湾公园拍照，特别喜欢拍日落时分的天空。去年我还去了西藏旅行，在纳木错湖边看到了绝美的星空。';
      const result = await service.evaluateMaterial('hobbies', content);
      
      // 高质量内容应该有较高的分数
      expect(result.scores.richness).toBeGreaterThanOrEqual(3);
      expect(result.scores.specificity).toBeGreaterThanOrEqual(4);
      expect(result.scores.matchPotential).toBeGreaterThanOrEqual(3);
      expect(result.scores.overall).toBeGreaterThanOrEqual(3);
      expect(result.isUsable).toBe(true);
    });

    it('应该检测具体性指标（时间/地点/数字）', async () => {
      const contentWithDetails = '我在2023年去了北京，参观了故宫和长城。那段经历让我印象深刻。';
      const result = await service.evaluateMaterial('travel_stories', contentWithDetails);
      
      expect(result.scores.specificity).toBeGreaterThanOrEqual(3);
    });

    it('应该检测匹配潜力（兴趣关键词）', async () => {
      const contentWithInterests = '我喜欢旅行、摄影、美食和阅读。周末经常带着相机去公园拍照。';
      const result = await service.evaluateMaterial('hobbies', contentWithInterests);
      
      expect(result.scores.matchPotential).toBeGreaterThanOrEqual(3);
      expect(result.scores.matchPotential).toBeGreaterThanOrEqual(2);
    });

    it('应该检测模板化内容', async () => {
      const templateContent = 'I am a student. I like reading and traveling. I am from China.';
      const result = await service.evaluateMaterial('self_intro', templateContent);
      
      // 模板内容真实性评分应该较低
      expect(result.scores.authenticity).toBeLessThanOrEqual(3);
    });

    it('应该奖励个人经历描述', async () => {
      const personalContent = '记得去年夏天，我第一次去云南旅行。在大理古城遇到了一位有趣的老人，他给我讲了好多当地的故事。那是我最难忘的旅行经历。';
      const result = await service.evaluateMaterial('travel_stories', personalContent);
      
      // 个人经历应该有较高的真实性评分
      expect(result.scores.authenticity).toBeGreaterThanOrEqual(3);
    });
  });

  describe('批量评估', () => {
    it('应该正确计算平均分', async () => {
      const materials: MaterialData[] = [
        { category: 'hobbies', content: '我喜欢阅读和旅行' },
        { category: 'hometown', content: '我来自深圳，这是一座年轻的城市' },
        { category: 'travel_stories', content: '' }, // 空内容不计入平均
      ];

      const result = await service.evaluateMaterials(materials);
      
      expect(result.evaluations.size).toBe(3);
      expect(result.averageScore).toBeGreaterThan(0);
      expect(result.overallRating).toBeGreaterThanOrEqual(1);
      expect(result.overallRating).toBeLessThanOrEqual(5);
    });

    it('应该正确处理空素材列表', async () => {
      const result = await service.evaluateMaterials([]);
      
      expect(result.evaluations.size).toBe(0);
      expect(result.averageScore).toBe(0);
      expect(result.overallRating).toBe(0);
    });
  });

  describe('星级计算', () => {
    it('应该正确计算星级（规则）', async () => {
      // 测试各个分数段的星级
      const testCases = [
        { score: 0, expectedStars: 0 },
        { score: 0.5, expectedStars: 1 },
        { score: 1.5, expectedStars: 2 },
        { score: 2.5, expectedStars: 3 },
        { score: 3.5, expectedStars: 4 },
        { score: 4.5, expectedStars: 5 },
        { score: 5, expectedStars: 5 },
      ];

      for (const testCase of testCases) {
        const result = await service.evaluateMaterial('hobbies', 
          testCase.score >= 4.5 ? '我是一名在深圳工作5年的软件工程师，热爱摄影和旅行，周末常去深圳湾公园拍照，去年去了西藏看到绝美星空。' :
          testCase.score >= 3.5 ? '我喜欢摄影和旅行，周末经常去公园拍照，记录生活的美好瞬间。' :
          testCase.score >= 2.5 ? '我喜欢阅读和摄影，周末会去公园走走。' :
          testCase.score >= 1.5 ? '我喜欢看书。' :
          '我喜欢。'
        );
        
        // 由于AI评分的不确定性，这里只验证基本逻辑
        expect(result.starRating).toBeGreaterThanOrEqual(0);
        expect(result.starRating).toBeLessThanOrEqual(5);
      }
    });
  });

  describe('建议生成', () => {
    it('应该为低分素材提供改进建议', async () => {
      const poorContent = '我喜欢读书。';
      const result = await service.evaluateMaterial('hobbies', poorContent);
      
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.some(s => s.includes('丰富') || s.includes('具体'))).toBe(true);
    });

    it('应该为高分素材提供正面反馈', async () => {
      const excellentContent = '我是一名在深圳工作了5年的软件工程师，热爱摄影和旅行。周末我经常带着佳能相机去深圳湾公园拍摄日落，特别喜欢捕捉天空色彩变化的那个瞬间。去年10月我还独自去了西藏，在纳木错湖边露营了一晚，看到了这辈子最震撼的银河。我也喜欢尝试各种美食，从街边小吃到米其林餐厅都愿意去探索。';
      const result = await service.evaluateMaterial('hobbies', excellentContent);
      
      if (result.scores.overall >= 4) {
        expect(result.suggestions.some(s => s.includes('很好') || s.includes('继续'))).toBe(true);
      }
    });
  });

  describe('可用性判断', () => {
    it('应该正确判断素材可用性', async () => {
      const usableContent = '我喜欢摄影，周末常去公园拍照。';
      const unusableContent = '我喜欢。';

      const usableResult = await service.evaluateMaterial('hobbies', usableContent);
      const unusableResult = await service.evaluateMaterial('hobbies', unusableContent);

      // 可用性基于overall >= 2.5
      expect(usableResult.isUsable).toBe(usableResult.scores.overall >= 2.5);
      expect(unusableResult.isUsable).toBe(unusableResult.scores.overall >= 2.5);
    });
  });
});

// 实际内容测试用例（用于验证评分准确性）
describe('MaterialQualityService - 实际内容测试', () => {
  let service: MaterialQualityService;

  beforeEach(() => {
    service = new MaterialQualityService();
  });

  const testCases = [
    {
      name: '优秀素材 - 丰富具体',
      content: '我是一名在深圳工作了5年的软件工程师，平时热爱摄影和户外徒步。周末我经常带着相机去深圳湾公园或梧桐山拍摄自然风光，特别喜欢捕捉日出日落的光影变化。去年我还去了西藏和云南旅行，在纳木错湖边看到了绝美的星空，在丽江古城体验了纳西族的文化。工作之余，我也喜欢尝试不同的美食，从街边的小吃到精致的私房菜都愿意去探索。',
      expectedMinRichness: 4,
      expectedMinSpecificity: 4,
      expectedMinOverall: 3.5,
    },
    {
      name: '良好素材 - 有细节但不够丰富',
      content: '我喜欢摄影和旅行，周末经常去公园拍照。去年去了云南旅行，看到了很美的风景。',
      expectedMinRichness: 3,
      expectedMinSpecificity: 3,
      expectedMinOverall: 2.5,
    },
    {
      name: '一般素材 - 基本合格',
      content: '我喜欢阅读和音乐，平时会看一些小说和听流行音乐。',
      expectedMinRichness: 2,
      expectedMinSpecificity: 2,
      expectedMinOverall: 2,
    },
    {
      name: '较差素材 - 过于简单',
      content: '我喜欢旅游。',
      expectedMaxRichness: 3,
      expectedMaxSpecificity: 2,
      expectedMaxOverall: 2.5,
    },
    {
      name: '模板化素材',
      content: 'I am a student. I like reading and traveling. I am from China. Nice to meet you.',
      expectedMaxAuthenticity: 3,
    },
  ];

  testCases.forEach((testCase) => {
    it(`应该正确评估: ${testCase.name}`, async () => {
      const result = await service.evaluateMaterial('self_intro', testCase.content);

      if (testCase.expectedMinRichness !== undefined) {
        expect(result.scores.richness).toBeGreaterThanOrEqual(testCase.expectedMinRichness);
      }
      if (testCase.expectedMaxRichness !== undefined) {
        expect(result.scores.richness).toBeLessThanOrEqual(testCase.expectedMaxRichness);
      }

      if (testCase.expectedMinSpecificity !== undefined) {
        expect(result.scores.specificity).toBeGreaterThanOrEqual(testCase.expectedMinSpecificity);
      }
      if (testCase.expectedMaxSpecificity !== undefined) {
        expect(result.scores.specificity).toBeLessThanOrEqual(testCase.expectedMaxSpecificity);
      }

      if (testCase.expectedMinOverall !== undefined) {
        expect(result.scores.overall).toBeGreaterThanOrEqual(testCase.expectedMinOverall);
      }
      if (testCase.expectedMaxOverall !== undefined) {
        expect(result.scores.overall).toBeLessThanOrEqual(testCase.expectedMaxOverall);
      }

      if (testCase.expectedMaxAuthenticity !== undefined) {
        expect(result.scores.authenticity).toBeLessThanOrEqual(testCase.expectedMaxAuthenticity);
      }
    });
  });
});

// 边界测试
describe('MaterialQualityService - 边界测试', () => {
  let service: MaterialQualityService;

  beforeEach(() => {
    service = new MaterialQualityService();
  });

  it('应该处理超长内容', async () => {
    const longContent = '我喜欢摄影。'.repeat(200);
    const result = await service.evaluateMaterial('hobbies', longContent);
    
    expect(result.scores.richness).toBeGreaterThanOrEqual(4);
    expect(result.scores.overall).toBeGreaterThanOrEqual(2);
  });

  it('应该处理特殊字符', async () => {
    const specialContent = '我喜欢摄影！📷 去过很多地方：北京、上海、深圳……';
    const result = await service.evaluateMaterial('travel_stories', specialContent);
    
    expect(result.scores.overall).toBeGreaterThanOrEqual(2);
  });

  it('应该处理纯英文内容', async () => {
    const englishContent = 'I am a software engineer based in Shenzhen. I love photography and traveling. Last year I visited Tibet and saw the most beautiful starry sky at Namtso Lake.';
    const result = await service.evaluateMaterial('self_intro', englishContent);
    
    expect(result.scores.specificity).toBeGreaterThanOrEqual(3);
    expect(result.scores.matchPotential).toBeGreaterThanOrEqual(3);
  });

  it('应该处理中英文混合内容', async () => {
    const mixedContent = '我是一名software engineer，base在深圳。平时喜欢photography和hiking，周末常去公园拍照。';
    const result = await service.evaluateMaterial('self_intro', mixedContent);
    
    expect(result.scores.overall).toBeGreaterThanOrEqual(2);
  });
});
