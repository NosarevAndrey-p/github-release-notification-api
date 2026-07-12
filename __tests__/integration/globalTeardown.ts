import { execSync } from 'child_process';
import path from 'path';

export default async function globalTeardown() {
  console.info('\n[Jest Global Teardown] Stopping test database container...');
  
  const composePath = path.join(process.cwd(), 'docker-compose.test.yml');
  
  // Stop container and remove volumes
  execSync(`docker compose -f "${composePath}" down -v`, { stdio: 'inherit' });
  
  console.info('[Jest Global Teardown] Database stopped and volumes cleaned up.');
}
