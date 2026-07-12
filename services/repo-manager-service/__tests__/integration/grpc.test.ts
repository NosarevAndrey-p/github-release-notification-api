import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { PROTO_PATH, PROTO_PACKAGE, PROTO_SERVICE } from '@shared/proto';
import { createGrpcServer } from '../../src/grpcServer.js';
import db from '../../src/db/database.js';
import pg from 'pg';
import { mock } from 'jest-mock-extended';
import { ILogger } from '@shared/logger';

interface RepoManagerClient extends grpc.Client {
  FetchLatestTag(
    argument: { repo_name: string },
    callback: (err: grpc.ServiceError | null, response: { repo_name: string; last_seen_tag?: string }) => void
  ): grpc.ClientUnaryCall;
  FetchLatestTags(
    argument: { repo_names: string[] },
    callback: (err: grpc.ServiceError | null, response: { tags: Record<string, { last_seen_tag?: string }> }) => void
  ): grpc.ClientUnaryCall;
}

describe('gRPC Server Integration', () => {
  let grpcServer: grpc.Server;
  let client: RepoManagerClient;
  let testPool: pg.Pool;
  const mockLogger = mock<ILogger>();
  const port = 50052;

  beforeAll(async () => {
    testPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

    grpcServer = createGrpcServer(db, mockLogger);
    await new Promise<void>((resolve, reject) => {
      grpcServer.bindAsync(`127.0.0.1:${port}`, grpc.ServerCredentials.createInsecure(), (err, _boundPort) => {
        if (err) return reject(err);
        grpcServer.start();
        resolve();
      });
    });

    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let repoManagerProto: any = protoDescriptor;
    for (const part of PROTO_PACKAGE.split('.')) {
      repoManagerProto = repoManagerProto[part];
    }
    client = new repoManagerProto[PROTO_SERVICE](
      `127.0.0.1:${port}`,
      grpc.credentials.createInsecure()
    ) as unknown as RepoManagerClient;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => grpcServer.tryShutdown(() => resolve()));
    await testPool.end();
    await db.close();
  });

  beforeEach(async () => {
    await testPool.query('TRUNCATE TABLE repositories RESTART IDENTITY CASCADE');
  });

  describe('FetchLatestTag', () => {
    it('should return tag for tracked repository', (done) => {
      db.createRepository('owner/repo', 'v2.0.0').then(() => {
        client.FetchLatestTag({ repo_name: 'owner/repo' }, (err, response) => {
          expect(err).toBeNull();
          expect(response.repo_name).toBe('owner/repo');
          expect(response.last_seen_tag).toBe('v2.0.0');
          done();
        });
      });
    });

    it('should return NOT_FOUND if repository is not tracked', (done) => {
      client.FetchLatestTag({ repo_name: 'owner/not-tracked' }, (err, _response) => {
        expect(err).not.toBeNull();
        expect(err!.code).toBe(grpc.status.NOT_FOUND);
        expect(err!.details).toBe('Repository not tracked');
        done();
      });
    });

    it('should return INVALID_ARGUMENT for invalid repository format', (done) => {
      client.FetchLatestTag({ repo_name: 'invalid-format' }, (err, _response) => {
        expect(err).not.toBeNull();
        expect(err!.code).toBe(grpc.status.INVALID_ARGUMENT);
        expect(err!.details).toBe('invalid repo format');
        done();
      });
    });
  });

  describe('FetchLatestTags', () => {
    it('should return tags for multiple repositories', async () => {
      await db.createRepository('owner/repo1', 'v1.0.0');
      await db.createRepository('owner/repo2', null);

      await new Promise<void>((resolve) => {
        client.FetchLatestTags(
          { repo_names: ['owner/repo1', 'owner/repo2', 'owner/repo3'] },
          (err, response) => {
            expect(err).toBeNull();
            expect(response.tags['owner/repo1'].last_seen_tag).toBe('v1.0.0');
            expect(response.tags['owner/repo2'].last_seen_tag).toBeUndefined();
            expect(response.tags['owner/repo3'].last_seen_tag).toBeUndefined();
            resolve();
          }
        );
      });
    });
  });
});
