import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function globalTeardown() {
  console.info('\n[Jest Global Teardown] Stopping test database container...');
  
  const composePath = path.resolve(__dirname, '../../../../docker-compose.test.yml');
  
  // Stop container and remove volumes
  execSync(`docker compose -f "${composePath}" down -v`, { stdio: 'inherit' });
  
  console.info('[Jest Global Teardown] Database stopped and volumes cleaned up.');
}
