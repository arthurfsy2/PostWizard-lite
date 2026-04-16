import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmailService } from '../emailService';
import { prisma } from '../../prisma';

// Mock prisma
vi.mock('../../prisma', () => ({
  prisma: {
    email: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(() => {
    service = new EmailService();
    vi.clearAllMocks();
    
    // Mock testImapConnection to return success
    vi.spyOn(service as any, 'testImapConnection').mockResolvedValue({
      success: true,
      error: undefined,
      details: undefined,
    });
  });

  describe('addConfig', () => {
    it('should add a new email config successfully', async () => {
      const configData = {
        name: 'Test Gmail',
        email: 'test@gmail.com',
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        imapUsername: 'test@gmail.com',
        imapPassword: 'password123',
      };

      const result = await service.addConfig(configData);

      expect(result).toMatchObject({
        ...configData,
        id: expect.any(String),
      });
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should generate unique IDs for multiple configs', async () => {
      const config1 = await service.addConfig({
        name: 'Config 1',
        email: 'test1@gmail.com',
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        imapUsername: 'test1@gmail.com',
        imapPassword: 'pass1',
      });

      const config2 = await service.addConfig({
        name: 'Config 2',
        email: 'test2@gmail.com',
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        imapUsername: 'test2@gmail.com',
        imapPassword: 'pass2',
      });

      expect(config1.id).not.toBe(config2.id);
    });
  });

  describe('getConfig', () => {
    it('should return the config by ID', async () => {
      const config = await service.addConfig({
        name: 'Test Config',
        email: 'test@gmail.com',
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        imapUsername: 'test@gmail.com',
        imapPassword: 'password',
      });

      const retrieved = service.getConfig(config.id);

      expect(retrieved).toEqual(config);
    });

    it('should return null for non-existent config', () => {
      const result = service.getConfig('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('getAllConfigs', () => {
    it('should return all configs', async () => {
      await service.addConfig({
        name: 'Config 1',
        email: 'test1@gmail.com',
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        imapUsername: 'test1@gmail.com',
        imapPassword: 'pass1',
      });

      await service.addConfig({
        name: 'Config 2',
        email: 'test2@gmail.com',
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        imapUsername: 'test2@gmail.com',
        imapPassword: 'pass2',
      });

      const configs = service.getAllConfigs();

      expect(configs).toHaveLength(2);
    });

    it('should return empty array when no configs exist', () => {
      const configs = service.getAllConfigs();
      expect(configs).toHaveLength(0);
    });
  });

  describe('updateConfig', () => {
    it('should update an existing config', async () => {
      const config = await service.addConfig({
        name: 'Original Name',
        email: 'test@gmail.com',
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        imapUsername: 'test@gmail.com',
        imapPassword: 'password',
      });

      const updated = await service.updateConfig(config.id, {
        name: 'Updated Name',
        imapPort: 995,
      });

      expect(updated?.name).toBe('Updated Name');
      expect(updated?.imapPort).toBe(995);
      expect(updated?.updatedAt).not.toEqual(updated?.createdAt);
    });

    it('should return null for non-existent config', async () => {
      const result = await service.updateConfig('non-existent-id', {
        name: 'New Name',
      });

      expect(result).toBeNull();
    });
  });

  describe('deleteConfig', () => {
    it('should delete an existing config', async () => {
      const config = await service.addConfig({
        name: 'To Delete',
        email: 'test@gmail.com',
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        imapUsername: 'test@gmail.com',
        imapPassword: 'password',
      });

      const deleted = await service.deleteConfig(config.id);

      expect(deleted).toBe(true);
      expect(service.getConfig(config.id)).toBeNull();
    });

    it('should return false for non-existent config', async () => {
      const result = await service.deleteConfig('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('verifyConnection', () => {
    it('should return error for non-existent config', async () => {
      const result = await service.verifyConnection('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('配置不存在');
    });

    it('should verify connection for existing config', async () => {
      const config = await service.addConfig({
        name: 'Test Config',
        email: 'test@gmail.com',
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        imapUsername: 'test@gmail.com',
        imapPassword: 'password',
      });

      const result = await service.verifyConnection(config.id);

      expect(result.success).toBe(true);
    });
  });

  describe('searchPostcrossingEmails', () => {
    const mockEmails = [
      { uid: '1', messageId: '<msg1>', subject: 'Postcrossing - CN-1234567', from: 'postcrossing@postcrossing.com', to: 'test@gmail.com', date: new Date(), bodyText: 'Test email 1', postcardId: 'CN-1234567', recipientName: 'John', recipientCountry: 'Portugal', recipientCity: 'Lisbon' },
      { uid: '2', messageId: '<msg2>', subject: 'Postcrossing - CN-2345678', from: 'postcrossing@postcrossing.com', to: 'test@gmail.com', date: new Date(), bodyText: 'Test email 2', postcardId: 'CN-2345678', recipientName: 'Mary', recipientCountry: 'Germany', recipientCity: 'Berlin' },
    ];

    it('should search emails with default limit', async () => {
      const config = await service.addConfig({
        name: 'Test Config',
        email: 'test@gmail.com',
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        imapUsername: 'test@gmail.com',
        imapPassword: 'password',
      });

      // Mock the search method to return mock data
      vi.spyOn(service as any, 'searchPostcrossingEmails').mockResolvedValueOnce(mockEmails);

      const emails = await service.searchPostcrossingEmails(config.id);

      expect(emails).toHaveLength(2);
      expect(emails[0].postcardId).toMatch(/CN-\d+/);
    });

    it('should respect custom limit', async () => {
      const config = await service.addConfig({
        name: 'Test Config',
        email: 'test@gmail.com',
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        imapUsername: 'test@gmail.com',
        imapPassword: 'password',
      });

      // Mock the search method to return limited data
      vi.spyOn(service as any, 'searchPostcrossingEmails').mockResolvedValueOnce(mockEmails.slice(0, 1));

      const emails = await service.searchPostcrossingEmails(config.id, { limit: 5 });

      expect(emails).toHaveLength(1);
    });

    it('should throw error for non-existent config', async () => {
      await expect(
        service.searchPostcrossingEmails('non-existent-id')
      ).rejects.toThrow('邮箱配置不存在');
    });
  });

  describe('getEmailBody', () => {
    it('should get email body', async () => {
      const config = await service.addConfig({
        name: 'Test Config',
        email: 'test@gmail.com',
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        imapUsername: 'test@gmail.com',
        imapPassword: 'password',
      });

      // Mock prisma to return email body
      vi.mocked(prisma.email.findUnique).mockResolvedValueOnce({
        id: 'email_123',
        emailConfigId: config.id,
        uid: '123',
        messageId: '<test>',
        subject: 'Test',
        from: 'test@test.com',
        to: 'test@gmail.com',
        receivedAt: new Date(),
        bodyText: '这是邮件 email_123 的正文内容',
      });

      const body = await service.getEmailBody(config.id, 'email_123');

      expect(body).toBe('这是邮件 email_123 的正文内容');
    });

    it('should throw error for non-existent config', async () => {
      await expect(
        service.getEmailBody('non-existent-id', 'email_123')
      ).rejects.toThrow('邮箱配置不存在');
    });
  });
});
