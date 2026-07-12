import { BadRequestError } from '../types/errors.js';

const repoRegex = /^[^/]+\/[^/]+$/;
const tokenRegex = /^[0-9a-f-]{36}$/i;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ValidatorService {
  static validateEmail(email: string | undefined): asserts email is string {
    if (!email) throw new BadRequestError('email is required');
    if (!emailRegex.test(email)) throw new BadRequestError('invalid email format');
  }

  static validateRepo(repo: string | undefined): asserts repo is string {
    if (!repo) throw new BadRequestError('repo is required');
    if (!repoRegex.test(repo)) throw new BadRequestError('invalid repo format');
  }

  static validateToken(token: string | undefined): asserts token is string {
    if (!token) throw new BadRequestError('token is required');
    if (!tokenRegex.test(token)) throw new BadRequestError('invalid token');
  }
}
