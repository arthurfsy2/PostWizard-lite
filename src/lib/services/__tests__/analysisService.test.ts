import { describe, it, expect, beforeEach } from 'vitest';
import { AnalysisService } from '../analysisService';
import { Email } from '../../types';

describe('AnalysisService', () => {
  let service: AnalysisService;

  beforeEach(() => {
    service = new AnalysisService();
  });

  const createMockEmail = (body: string): Email => ({
    id: 'email_123',
    postcardId: 'CN-1234567',
    subject: 'Postcrossing Postcard ID: CN-1234567',
    body,
    from: 'postcrossing@example.com',
    to: 'test@gmail.com',
    receivedAt: new Date(),
    isRead: false,
  });

  describe('analyzeEmail', () => {
    it('should extract recipient name from email', async () => {
      const email = createMockEmail('Hello! My name is John Smith and I live in Portugal.');
      
      const result = await service.analyzeEmail(email);

      expect(result.recipientName).toBe('John Smith');
    });

    it('should extract country from email', async () => {
      const email = createMockEmail('I live in Portugal and love it here.');
      
      const result = await service.analyzeEmail(email);

      expect(result.country).toBe('Portugal');
    });

    it('should extract city from email', async () => {
      const email = createMockEmail('I live in Lisbon, the beautiful capital.');
      
      const result = await service.analyzeEmail(email);

      expect(result.city).toBe('Lisbon');
    });

    it('should extract interests from email', async () => {
      const email = createMockEmail('I enjoy reading, music, and traveling in my free time.');
      
      const result = await service.analyzeEmail(email);

      expect(result.interests).toContain('reading');
      expect(result.interests).toContain('music');
      expect(result.interests).toContain('travel');
    });

    it('should extract Postcrossing experience', async () => {
      const email = createMockEmail("I've been on Postcrossing for 3 years and love it!");
      
      const result = await service.analyzeEmail(email);

      expect(result.postcrossingExperience).toContain("I've been on Postcrossing for 3 years");
    });

    it('should mark new users correctly', async () => {
      const email = createMockEmail('Hello! I just joined Postcrossing and excited to receive cards.');
      
      const result = await service.analyzeEmail(email);

      expect(result.postcrossingExperience).toBe('New to Postcrossing');
    });

    it('should extract personal info - age', async () => {
      const email = createMockEmail('I am 25 years old and work as a teacher.');
      
      const result = await service.analyzeEmail(email);

      expect(result.personalInfo.age).toBe('25');
    });

    it('should extract personal info - occupation', async () => {
      const email = createMockEmail('I work as a software engineer in a tech company.');
      
      const result = await service.analyzeEmail(email);

      expect(result.personalInfo.occupation).toBe('software engineer in a tech company');
    });

    it('should extract favorite music', async () => {
      const email = createMockEmail('I like listening to jazz and classical music.');
      
      const result = await service.analyzeEmail(email);

      expect(result.personalInfo.favoriteMusic).toBe('jazz and classical music');
    });

    it('should handle missing information gracefully', async () => {
      const email = createMockEmail('Hello! This is a short email with no specific details.');
      
      const result = await service.analyzeEmail(email);

      expect(result.recipientName).toBe('Unknown');
      expect(result.country).toBe('Unknown');
      expect(result.city).toBe('Unknown');
      expect(result.interests).toEqual(['general']);
    });
  });

  describe('extractInterests', () => {
    it('should detect common interest keywords', async () => {
      const testCases = [
        { text: 'I love reading books', expected: ['reading'] },
        { text: 'Music is my passion', expected: ['music'] },
        { text: 'I enjoy photography and travel', expected: ['travel', 'photography'] },
        { text: 'Sports and gaming are my hobbies', expected: ['sports', 'gaming'] },
      ];

      for (const { text, expected } of testCases) {
        const email = createMockEmail(text);
        const result = await service.analyzeEmail(email);
        
        expected.forEach(interest => {
          expect(result.interests).toContain(interest);
        });
      }
    });
  });

  describe('analyzeEmails (batch)', () => {
    it('should analyze multiple emails', async () => {
      const emails: Email[] = [
        { ...createMockEmail('My name is Alice. I live in France.'), postcardId: 'CN-1111111' },
        { ...createMockEmail('My name is Bob. I live in Germany.'), postcardId: 'CN-2222222' },
        { ...createMockEmail('My name is Carol. I live in Spain.'), postcardId: 'CN-3333333' },
      ];

      const results = await service.analyzeEmails(emails);

      expect(results.size).toBe(3);
      expect(results.get('CN-3333333')?.recipientName).toBe('Carol');
    });

    it('should handle empty array', async () => {
      const results = await service.analyzeEmails([]);
      expect(results.size).toBe(0);
    });
  });
});
