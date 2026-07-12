import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// When compiled, index.js is at dist/index.js, so the proto file is at ../repomanager/v1/repo_manager.proto
export const PROTO_PATH = join(__dirname, '../repomanager/v1/repo_manager.proto');
export const PROTO_PACKAGE = 'repomanager.v1';
export const PROTO_SERVICE = 'RepoManagerService';
