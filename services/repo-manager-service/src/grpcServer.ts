import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { PROTO_PATH, PROTO_PACKAGE, PROTO_SERVICE } from '@shared/proto';
import { IRepositoryStore } from './types/database.js';
import { ValidatorService } from './services/validatorService.js';
import { BadRequestError } from '@shared/errors';
import { ILogger } from '@shared/logger';

export function createGrpcServer(db: IRepositoryStore, logger: ILogger) {
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
  const repoManagerProto = (protoDescriptor as any)[PROTO_PACKAGE];

  const server = new grpc.Server();

  server.addService(repoManagerProto[PROTO_SERVICE].service, {
    FetchLatestTag: async (call: any, callback: any) => {
      try {
        const { repo_name } = call.request;
        ValidatorService.validateRepo(repo_name);

        const repo = await db.getRepositoryByFullName(repo_name);
        if (!repo) {
          return callback({
            code: grpc.status.NOT_FOUND,
            message: 'Repository not tracked',
          });
        }

        callback(null, {
          repo_name: repo.full_name,
          last_seen_tag: repo.last_seen_tag || undefined,
        });
      } catch (err) {
        if (err instanceof BadRequestError) {
          callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: err.message,
          });
        } else {
          callback({
            code: grpc.status.INTERNAL,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    },
    FetchLatestTags: async (call: any, callback: any) => {
      try {
        const { repo_names } = call.request;
        if (!Array.isArray(repo_names)) {
          return callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: 'repo_names must be a list',
          });
        }

        for (const repo_name of repo_names) {
          ValidatorService.validateRepo(repo_name);
        }

        const repos = await db.getRepositoriesByFullNames(repo_names);
        const tags: Record<string, { last_seen_tag?: string }> = {};

        // Initialize all requested repos to empty TagValue message (so last_seen_tag is unset)
        repo_names.forEach((name) => {
          tags[name] = {};
        });

        // Populate with database values
        repos.forEach((repo) => {
          tags[repo.full_name] = {
            last_seen_tag: repo.last_seen_tag || undefined,
          };
        });

        callback(null, { tags });
      } catch (err) {
        if (err instanceof BadRequestError) {
          callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: err.message,
          });
        } else {
          callback({
            code: grpc.status.INTERNAL,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    },
  });

  return server;
}
