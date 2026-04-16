import { describe, it, expect, beforeEach } from 'vitest';
import { GenerationService } from '../generationService';
import { AnalysisResult } from '../../types';

describe('GenerationService', () => {
  let service: GenerationService;

  beforeEach(() => {
    service = new GenerationService();
  });

  const createMockAnalysis = (overrides?: Partial<AnalysisResult>): AnalysisResult => ({
    recipientName: 'John Smith',
    country: 'Portugal',
    city: 'Lisbon',
    interests: ['reading', 'music', 'travel'],
    postcrossingExperience: "I've been on Postcrossing for 2 years",
    personalInfo: {
      hobbies: ['reading', 'music'],
      age: '25',
      occupation: 'Teacher',
    },
    address: {
      street: 'Rua da Liberdade 123',
      city: 'Lisbon',
      state: 'Lisbon District',
      postalCode: '1250-142',
      country: 'Portugal',
    },
    ...overrides,
  });

  describe('generatePostcard', () => {
    it('should generate complete postcard content', async () => {
      const analysis = createMockAnalysis();
      
      const result = await service.generatePostcard(analysis, 'CN-1234567');

      expect(result.postcardId).toBe('CN-1234567');
      expect(result.recipientName).toBe('John Smith');
      expect(result.country).toBe('Portugal');
      expect(result.senderCity).toBe('Shenzhen');
      expect(result.greeting).toBeDefined();
      expect(result.body).toBeDefined();
      expect(result.closing).toBeDefined();
      expect(result.weather).toBeDefined();
      expect(result.localCulture).toBeDefined();
      expect(result.personalTouch).toBeDefined();
    });

    it('should include recipient name in greeting', async () => {
      const analysis = createMockAnalysis({ recipientName: 'Maria Silva' });
      
      const result = await service.generatePostcard(analysis, 'CN-1234567');

      expect(result.greeting).toMatch(/(Dear|Hello|Hi|Greetings) Maria Silva/);
    });

    it('should mention recipient interests in body', async () => {
      const analysis = createMockAnalysis({ interests: ['photography', 'cooking'] });
      
      const result = await service.generatePostcard(analysis, 'CN-1234567');

      expect(result.body).toContain('photography');
      expect(result.body).toContain('cooking');
    });

    it('should mention recipient country', async () => {
      const analysis = createMockAnalysis({ country: 'Japan' });
      
      const result = await service.generatePostcard(analysis, 'CN-1234567');

      expect(result.body).toContain('Japan');
    });

    it('should handle unknown country gracefully', async () => {
      const analysis = createMockAnalysis({ country: 'Unknown' });
      
      const result = await service.generatePostcard(analysis, 'CN-1234567');

      expect(result.country).toBe('Unknown');
    });

    it('should customize message for Postcrossing enthusiasts', async () => {
      const analysis = createMockAnalysis({ 
        postcrossingExperience: "I've been on Postcrossing for 5 years" 
      });
      
      const result = await service.generatePostcard(analysis, 'CN-1234567');

      expect(result.body).toContain('fellow Postcrossing enthusiast');
    });

    it('should welcome new Postcrossing members', async () => {
      const analysis = createMockAnalysis({ 
        postcrossingExperience: 'New to Postcrossing' 
      });
      
      const result = await service.generatePostcard(analysis, 'CN-1234567');

      expect(result.body).toContain('Welcome to the Postcrossing community');
    });

    it('should include sender city', async () => {
      const analysis = createMockAnalysis();
      
      const result = await service.generatePostcard(analysis, 'CN-1234567');

      expect(result.body).toContain('Shenzhen');
    });

    it('should set custom sender city', async () => {
      service.setSenderCity('Beijing');
      const analysis = createMockAnalysis();
      
      const result = await service.generatePostcard(analysis, 'CN-1234567');

      expect(result.senderCity).toBe('Beijing');
      expect(result.body).toContain('Beijing');
    });
  });

  describe('generatePostcards (batch)', () => {
    it('should generate multiple postcards', async () => {
      const analyses = new Map<string, AnalysisResult>();
      analyses.set('CN-1111111', createMockAnalysis({ recipientName: 'Alice' }));
      analyses.set('CN-2222222', createMockAnalysis({ recipientName: 'Bob' }));
      analyses.set('CN-3333333', createMockAnalysis({ recipientName: 'Carol' }));

      const results = await service.generatePostcards(analyses);

      expect(results.size).toBe(3);
      expect(results.get('CN-1111111')?.recipientName).toBe('Alice');
      expect(results.get('CN-2222222')?.recipientName).toBe('Bob');
      expect(results.get('CN-3333333')?.recipientName).toBe('Carol');
    });

    it('should handle empty map', async () => {
      const analyses = new Map<string, AnalysisResult>();
      const results = await service.generatePostcards(analyses);
      expect(results.size).toBe(0);
    });
  });

  describe('content quality', () => {
    it('should generate varied greetings', async () => {
      const analysis = createMockAnalysis();
      const greetings = new Set<string>();

      // Generate multiple times to check variety
      for (let i = 0; i < 10; i++) {
        const result = await service.generatePostcard(analysis, `CN-${i}`);
        greetings.add(result.greeting);
      }

      // Should have at least 2 different greetings
      expect(greetings.size).toBeGreaterThanOrEqual(2);
    });

    it('should generate varied closings', async () => {
      const analysis = createMockAnalysis();
      const closings = new Set<string>();

      for (let i = 0; i < 10; i++) {
        const result = await service.generatePostcard(analysis, `CN-${i}`);
        closings.add(result.closing);
      }

      expect(closings.size).toBeGreaterThanOrEqual(2);
    });
  });
});
