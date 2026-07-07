import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { PROTO_PATH, PROTO_PACKAGE, PROTO_SERVICE } from '@shared/proto';
import { IRepoManagerService } from '../../types/repo-manager.js';

export class GrpcRepoManagerService implements IRepoManagerService {
  private client: any;

  constructor({ gRPCUrl }: { gRPCUrl: string }) {
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    const repoManagerProto = (protoDescriptor as any)[PROTO_PACKAGE];
    this.client = new repoManagerProto[PROTO_SERVICE](
      gRPCUrl,
      grpc.credentials.createInsecure()
    );
  }

  fetchLatestTag(repoName: string): Promise<string | null> {
    return new Promise((resolve) => {
      this.client.FetchLatestTag({ repo_name: repoName }, (err: any, response: any) => {
        if (err) {
          return resolve(null);
        }
        resolve(response.last_seen_tag || null);
      });
    });
  }

  fetchLatestTags(repoNames: string[]): Promise<Record<string, string | null>> {
    if (repoNames.length === 0) return Promise.resolve({});
    return new Promise((resolve) => {
      this.client.FetchLatestTags({ repo_names: repoNames }, (err: any, response: any) => {
        if (err) {
          const fallback: Record<string, string | null> = {};
          repoNames.forEach((r) => {
            fallback[r] = null;
          });
          return resolve(fallback);
        }

        const result: Record<string, string | null> = {};
        repoNames.forEach((r) => {
          const val = response.tags[r];
          result[r] = val && val.last_seen_tag ? val.last_seen_tag : null;
        });
        resolve(result);
      });
    });
  }
}
