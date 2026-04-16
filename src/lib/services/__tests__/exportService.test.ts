import { describe, it, expect, beforeEach } from 'vitest';
import { ExportService } from '../exportService';
import { PostcardContent } from '../../types';

describe('ExportService', () => {
  let service: ExportService;

  beforeEach(() => {
    service = new ExportService();
  });

  const createMockPostcard = (overrides?: Partial<PostcardContent>): PostcardContent => ({
    postcardId: 'CN-1234567',
    recipientName: 'John Smith',
    country: 'Portugal',
    city: 'Lisbon',
    greeting: 'Dear John Smith,',
    body: 'Greetings from Shenzhen! This is the main content of the postcard.',
    closing: 'Best wishes from Shenzhen',
    senderCity: 'Shenzhen',
    weather: 'The weather today is sunny and warm.',
    localCulture: 'Our city is famous for its diverse cuisine.',
    personalTouch: "P.S. Thank you for being part of the Postcrossing community!",
    ...overrides,
  });

  describe('exportToMarkdown', () => {
    it('should export postcard as Markdown', () => {
      const postcard = createMockPostcard();
      
      const result = service.exportToMarkdown(postcard);

      expect(result.format).toBe('markdown');
      expect(result.filename).toBe('postcard_CN-1234567.md');
      expect(result.content).toContain('# Postcard to John Smith');
      expect(result.content).toContain('**Postcard ID:** CN-1234567');
      expect(result.content).toContain('**Country:** Portugal');
      expect(result.content).toContain('Dear John Smith,');
      expect(result.content).toContain('Greetings from Shenzhen!');
    });

    it('should include all sections in Markdown', () => {
      const postcard = createMockPostcard();
      
      const result = service.exportToMarkdown(postcard);

      expect(result.content).toContain('## Content');
      expect(result.content).toContain('## Additional Information');
      expect(result.content).toContain('**Weather:**');
      expect(result.content).toContain('**Local Culture:**');
      expect(result.content).toContain('**Personal Touch:**');
    });

    it('should respect includeRecipient option', () => {
      const postcard = createMockPostcard();
      
      const result = service.exportToMarkdown(postcard, { includeRecipient: false });

      expect(result.content).not.toContain('**Country:**');
      expect(result.content).not.toContain('**Sender City:**');
      expect(result.content).toContain('**Postcard ID:**');
    });

    it('should respect includeSignature option', () => {
      const postcard = createMockPostcard();
      
      const result = service.exportToMarkdown(postcard, { includeSignature: false });

      expect(result.content).not.toContain('## Additional Information');
      expect(result.content).not.toContain('**Weather:**');
      expect(result.content).toContain('Dear John Smith,');
    });
  });

  describe('exportBatchToMarkdown', () => {
    it('should export multiple postcards as single Markdown file', () => {
      const postcards = [
        createMockPostcard({ postcardId: 'CN-1111111', recipientName: 'Alice' }),
        createMockPostcard({ postcardId: 'CN-2222222', recipientName: 'Bob' }),
        createMockPostcard({ postcardId: 'CN-3333333', recipientName: 'Carol' }),
      ];

      const result = service.exportBatchToMarkdown(postcards);

      expect(result.format).toBe('markdown');
      expect(result.filename).toBe('postcards_batch_3.md');
      expect(result.content).toContain('**Total:** 3 postcards');
      expect(result.content).toContain('## 1. Postcard to Alice');
      expect(result.content).toContain('## 2. Postcard to Bob');
      expect(result.content).toContain('## 3. Postcard to Carol');
    });

    it('should include all postcards content', () => {
      const postcards = [
        createMockPostcard({ postcardId: 'CN-1111111', body: 'Content for Alice' }),
        createMockPostcard({ postcardId: 'CN-2222222', body: 'Content for Bob' }),
      ];

      const result = service.exportBatchToMarkdown(postcards);

      expect(result.content).toContain('Content for Alice');
      expect(result.content).toContain('Content for Bob');
    });
  });

  describe('exportToHtml', () => {
    it('should export postcard as HTML', () => {
      const postcard = createMockPostcard();
      
      const result = service.exportToHtml(postcard);

      expect(result.format).toBe('html');
      expect(result.filename).toBe('postcard_CN-1234567.html');
      expect(result.content).toContain('<!DOCTYPE html>');
      expect(result.content).toContain('<title>Postcard to John Smith</title>');
      expect(result.content).toContain('Dear John Smith,');
      expect(result.content).toContain('class="postcard"');
    });

    it('should include proper HTML structure', () => {
      const postcard = createMockPostcard();
      
      const result = service.exportToHtml(postcard);

      expect(result.content).toContain('<html');
      expect(result.content).toContain('<head>');
      expect(result.content).toContain('<body>');
      expect(result.content).toContain('<style>');
      expect(result.content).toContain('</html>');
    });

    it('should include responsive design', () => {
      const postcard = createMockPostcard();
      
      const result = service.exportToHtml(postcard);

      expect(result.content).toContain('viewport');
      expect(result.content).toContain('max-width: 800px');
    });

    it('should respect fontSize option', () => {
      const postcard = createMockPostcard();
      
      const small = service.exportToHtml(postcard, { fontSize: 'small' });
      const medium = service.exportToHtml(postcard, { fontSize: 'medium' });
      const large = service.exportToHtml(postcard, { fontSize: 'large' });

      expect(small.content).toContain('font-size: 14px');
      expect(medium.content).toContain('font-size: 16px');
      expect(large.content).toContain('font-size: 18px');
    });
  });

  describe('exportToJson', () => {
    it('should export postcard as JSON', () => {
      const postcard = createMockPostcard();
      
      const result = service.exportToJson(postcard);

      expect(result.format).toBe('json');
      expect(result.filename).toBe('postcard_CN-1234567.json');
      
      const parsed = JSON.parse(result.content);
      expect(parsed.postcardId).toBe('CN-1234567');
      expect(parsed.recipientName).toBe('John Smith');
      expect(parsed.country).toBe('Portugal');
      expect(parsed.greeting).toBe('Dear John Smith,');
    });

    it('should produce valid JSON', () => {
      const postcard = createMockPostcard();
      
      const result = service.exportToJson(postcard);

      expect(() => JSON.parse(result.content)).not.toThrow();
    });

    it('should produce pretty-printed JSON', () => {
      const postcard = createMockPostcard();
      
      const result = service.exportToJson(postcard);

      expect(result.content).toContain('\n');
      expect(result.content).toContain('  ');
    });
  });

  describe('exportBatchToJson', () => {
    it('should export multiple postcards as single JSON file', () => {
      const postcards = [
        createMockPostcard({ postcardId: 'CN-1111111' }),
        createMockPostcard({ postcardId: 'CN-2222222' }),
      ];

      const result = service.exportBatchToJson(postcards);

      expect(result.format).toBe('json');
      expect(result.filename).toBe('postcards_batch_2.json');
      
      const parsed = JSON.parse(result.content);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
    });
  });

  describe('exportToPdf', () => {
    it('should export postcard as PDF', () => {
      const postcard = createMockPostcard();
      
      const result = service.exportToPdf(postcard);

      expect(result.format).toBe('pdf');
      expect(result.filename).toBe('postcard_CN-1234567.pdf');
      expect(result.content).toContain('data:application/pdf');
      expect(result.content).toContain('base64');
    });
  });

  describe('exportBatchToPdf', () => {
    it('should export multiple postcards as multi-page PDF', () => {
      const postcards = [
        createMockPostcard({ postcardId: 'CN-1111111', recipientName: 'Alice' }),
        createMockPostcard({ postcardId: 'CN-2222222', recipientName: 'Bob' }),
        createMockPostcard({ postcardId: 'CN-3333333', recipientName: 'Carol' }),
      ];

      const result = service.exportBatchToPdf(postcards);

      expect(result.format).toBe('pdf');
      expect(result.filename).toBe('postcards_batch_3.pdf');
      expect(result.content).toContain('data:application/pdf');
    });
  });

  describe('exportAll (batch)', () => {
    it('should export multiple postcards as single batch file for markdown', () => {
      const postcards = [
        createMockPostcard({ postcardId: 'CN-1111111', recipientName: 'Alice' }),
        createMockPostcard({ postcardId: 'CN-2222222', recipientName: 'Bob' }),
        createMockPostcard({ postcardId: 'CN-3333333', recipientName: 'Carol' }),
      ];

      const results = service.exportAll(postcards, 'markdown');

      // Markdown 批量导出返回单个合并文件
      expect(results).toHaveLength(1);
      expect(results[0].filename).toBe('postcards_batch_3.md');
      expect(results[0].content).toContain('Alice');
      expect(results[0].content).toContain('Bob');
      expect(results[0].content).toContain('Carol');
    });

    it('should export multiple postcards as single batch file for pdf', () => {
      const postcards = [
        createMockPostcard({ postcardId: 'CN-1111111' }),
        createMockPostcard({ postcardId: 'CN-2222222' }),
      ];

      const results = service.exportAll(postcards, 'pdf');

      // PDF 批量导出返回单个多页文件
      expect(results).toHaveLength(1);
      expect(results[0].filename).toBe('postcards_batch_2.pdf');
    });

    it('should export multiple postcards as single batch file for json', () => {
      const postcards = [
        createMockPostcard({ postcardId: 'CN-1111111' }),
        createMockPostcard({ postcardId: 'CN-2222222' }),
      ];

      const results = service.exportAll(postcards, 'json');

      // JSON 批量导出返回单个文件
      expect(results).toHaveLength(1);
      expect(results[0].filename).toBe('postcards_batch_2.json');
      
      const parsed = JSON.parse(results[0].content);
      expect(parsed).toHaveLength(2);
    });

    it('should export individual files for html format', () => {
      const postcards = [
        createMockPostcard({ postcardId: 'CN-1111111' }),
        createMockPostcard({ postcardId: 'CN-2222222' }),
      ];

      const results = service.exportAll(postcards, 'html');

      // HTML 批量导出返回多个独立文件
      expect(results).toHaveLength(2);
      expect(results[0].filename).toBe('postcard_CN-1111111.html');
      expect(results[1].filename).toBe('postcard_CN-2222222.html');
    });
  });

  describe('filename generation', () => {
    it('should generate consistent filenames', () => {
      const postcard = createMockPostcard({ postcardId: 'CN-9999999' });

      expect(service.exportToMarkdown(postcard).filename).toBe('postcard_CN-9999999.md');
      expect(service.exportToHtml(postcard).filename).toBe('postcard_CN-9999999.html');
      expect(service.exportToJson(postcard).filename).toBe('postcard_CN-9999999.json');
      expect(service.exportToPdf(postcard).filename).toBe('postcard_CN-9999999.pdf');
    });

    it('should generate correct batch filenames', () => {
      const postcards = [
        createMockPostcard({ postcardId: 'CN-1111111' }),
        createMockPostcard({ postcardId: 'CN-2222222' }),
      ];

      expect(service.exportBatchToMarkdown(postcards).filename).toBe('postcards_batch_2.md');
      expect(service.exportBatchToPdf(postcards).filename).toBe('postcards_batch_2.pdf');
      expect(service.exportBatchToJson(postcards).filename).toBe('postcards_batch_2.json');
    });
  });

  describe('content integrity', () => {
    it('should preserve all postcard data in export', () => {
      const postcard = createMockPostcard({
        postcardId: 'CN-TEST123',
        recipientName: 'Test User',
        country: 'Test Country',
        greeting: 'Test Greeting',
        body: 'Test Body Content',
        closing: 'Test Closing',
      });

      const markdown = service.exportToMarkdown(postcard);
      const html = service.exportToHtml(postcard);
      const json = service.exportToJson(postcard);

      // Check Markdown contains key data
      expect(markdown.content).toContain('Test User');
      expect(markdown.content).toContain('Test Country');
      expect(markdown.content).toContain('Test Greeting');
      expect(markdown.content).toContain('Test Body Content');

      // Check HTML contains key data
      expect(html.content).toContain('Test User');
      expect(html.content).toContain('Test Greeting');

      // Check JSON contains all data
      const parsed = JSON.parse(json.content);
      expect(parsed.postcardId).toBe('CN-TEST123');
      expect(parsed.recipientName).toBe('Test User');
      expect(parsed.country).toBe('Test Country');
      expect(parsed.greeting).toBe('Test Greeting');
      expect(parsed.body).toBe('Test Body Content');
    });
  });

  describe('export options', () => {
    it('should handle all export options correctly', () => {
      const postcards = [
        createMockPostcard({ postcardId: 'CN-1111111' }),
        createMockPostcard({ postcardId: 'CN-2222222' }),
      ];

      const options = {
        includeRecipient: false,
        includeSignature: false,
        fontSize: 'small' as const,
      };

      const markdown = service.exportBatchToMarkdown(postcards, options);
      const html = service.exportToHtml(postcards[0], options);
      const pdf = service.exportBatchToPdf(postcards, options);

      expect(markdown.content).not.toContain('**Country:**');
      expect(html.content).not.toContain('**Country:**');
      expect(markdown.content).not.toContain('## Additional Information');
    });
  });
});
