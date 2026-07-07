import { BadRequestError } from '@shared/errors';

const repoRegex = /^[^/]+\/[^/]+$/;

export class ValidatorService {
  static validateRepo(repo: string | undefined): asserts repo is string {
    if (!repo) throw new BadRequestError('repo is required');
    if (!repoRegex.test(repo)) throw new BadRequestError('invalid repo format');
  }
}
