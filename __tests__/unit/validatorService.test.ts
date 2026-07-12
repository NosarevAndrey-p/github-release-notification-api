import { ValidatorService } from '../../src/services/validatorService.js';
import { BadRequestError } from '../../src/types/errors.js';

describe('ValidatorService', () => {
  describe('validateEmail', () => {
    it('should not throw an error for valid emails', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.com',
        '123@example.com',
        'email@domain-one.com',
      ];

      validEmails.forEach(email => {
        expect(() => ValidatorService.validateEmail(email)).not.toThrow();
      });
    });

    it('should throw BadRequestError for missing email', () => {
      expect(() => ValidatorService.validateEmail(undefined)).toThrow(BadRequestError);
      expect(() => ValidatorService.validateEmail(undefined)).toThrow('email is required');
      expect(() => ValidatorService.validateEmail('')).toThrow('email is required');
    });

    it('should throw BadRequestError for invalid email formats', () => {
      const invalidEmails = [
        'plainaddress',
        '@example.com',
        'Joe Smith <email@example.com>',
        'email.example.com',
        'email@example@example.com',
        'email@example.com (Joe Smith)',
        'email@example',
        'email @example.com',
        'email@ example.com',
      ];

      invalidEmails.forEach(email => {
        expect(() => ValidatorService.validateEmail(email)).toThrow(BadRequestError);
        expect(() => ValidatorService.validateEmail(email)).toThrow('invalid email format');
      });
    });
  });

  describe('validateRepo', () => {
    it('should not throw an error for valid repository formats', () => {
      const validRepos = [
        'owner/repo',
        'owner-name/repo_name.js',
        '123/456',
        'a/b',
      ];

      validRepos.forEach(repo => {
        expect(() => ValidatorService.validateRepo(repo)).not.toThrow();
      });
    });

    it('should throw BadRequestError for missing repository', () => {
      expect(() => ValidatorService.validateRepo(undefined)).toThrow(BadRequestError);
      expect(() => ValidatorService.validateRepo(undefined)).toThrow('repo is required');
      expect(() => ValidatorService.validateRepo('')).toThrow('repo is required');
    });

    it('should throw BadRequestError for invalid repository formats', () => {
      const invalidRepos = [
        'owner',
        '/repo',
        'owner/',
        'owner/repo/subrepo',
        'owner//repo',
        '/',
      ];

      invalidRepos.forEach(repo => {
        expect(() => ValidatorService.validateRepo(repo)).toThrow(BadRequestError);
        expect(() => ValidatorService.validateRepo(repo)).toThrow('invalid repo format');
      });
    });
  });

  describe('validateToken', () => {
    it('should not throw an error for valid UUID tokens', () => {
      const validTokens = [
        '12345678-1234-1234-1234-123456789012',
        'abcdef01-abcd-abcd-abcd-abcdef012345',
        'ABCDEF01-ABCD-ABCD-ABCD-ABCDEF012345', // Case insensitivity
      ];

      validTokens.forEach(token => {
        expect(() => ValidatorService.validateToken(token)).not.toThrow();
      });
    });

    it('should throw BadRequestError for missing token', () => {
      expect(() => ValidatorService.validateToken(undefined)).toThrow(BadRequestError);
      expect(() => ValidatorService.validateToken(undefined)).toThrow('token is required');
      expect(() => ValidatorService.validateToken('')).toThrow('token is required');
    });

    it('should throw BadRequestError for invalid token formats', () => {
      const invalidTokens = [
        '12345678',
        '12345678-1234-1234-1234-12345678901', // Too short
        '12345678-1234-1234-1234-1234567890123', // Too long
        '12345678-1234-1234-1234-12345678901g', // Non-hex character
        'invalid-uuid-format',
      ];

      invalidTokens.forEach(token => {
        expect(() => ValidatorService.validateToken(token)).toThrow(BadRequestError);
        expect(() => ValidatorService.validateToken(token)).toThrow('invalid token');
      });
    });
  });
});
