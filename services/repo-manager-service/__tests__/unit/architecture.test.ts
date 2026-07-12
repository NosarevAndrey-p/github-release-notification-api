import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.resolve(__dirname, '../../src');

function getFiles(dir: string): string[] {
  const subdirs = fs.readdirSync(dir);
  const files = subdirs.map((subdir) => {
    const res = path.resolve(dir, subdir);
    return fs.statSync(res).isDirectory() ? getFiles(res) : res;
  });
  return files.flat().filter(file => file.endsWith('.ts') && !file.endsWith('.d.ts'));
}

function getLayer(filePath: string): string {
  const relativePath = path.relative(SRC_DIR, filePath);
  const parts = relativePath.split(path.sep);
  const firstDir = parts[0];

  if (firstDir === 'types' || firstDir === 'domain') {
    return 'Domain';
  } else if (firstDir === 'services' || firstDir === 'application') {
    return 'Application';
  } else if (firstDir === 'db' || firstDir === 'config' || firstDir === 'constants') {
    return 'Infrastructure';
  } else if (
    firstDir === 'routes' ||
    firstDir === 'middleware' ||
    relativePath === 'app.ts' ||
    relativePath === 'server.ts' ||
    relativePath === 'grpcServer.ts'
  ) {
    return 'Presentation';
  }
  return 'Unknown';
}

describe('Architectural Dependency Tests', () => {
  it('should not violate layered architecture boundaries', () => {
    const files = getFiles(SRC_DIR);
    
    const rootServer = path.resolve(SRC_DIR, '../server.ts');
    if (fs.existsSync(rootServer)) {
      files.push(rootServer);
    }

    const violations: string[] = [];

    for (const file of files) {
      const fileLayer = getLayer(file);
      if (fileLayer === 'Unknown') continue;

      const content = fs.readFileSync(file, 'utf-8');
      const importRegex = /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
      let match;

      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];

        if (importPath.startsWith('.')) {
          const fileDir = path.dirname(file);
          const resolvedPath = path.resolve(fileDir, importPath);

          let targetFile = resolvedPath;
          if (!fs.existsSync(targetFile)) {
            const cleanPath = targetFile.replace(/\.(js|ts)$/, '');
            if (fs.existsSync(cleanPath + '.ts')) {
              targetFile = cleanPath + '.ts';
            } else if (fs.existsSync(path.join(cleanPath, 'index.ts'))) {
              targetFile = path.join(cleanPath, 'index.ts');
            } else if (fs.existsSync(cleanPath)) {
              targetFile = cleanPath;
            }
          }

          if (targetFile.startsWith(SRC_DIR) || targetFile === rootServer) {
            const targetLayer = getLayer(targetFile);

            if (targetLayer !== 'Unknown') {
              if (fileLayer === 'Domain' && targetLayer !== 'Domain') {
                violations.push(
                  `Layer Violation: Domain file ${path.relative(SRC_DIR, file)} imports from ${targetLayer} (${importPath})`
                );
              }
              if (fileLayer === 'Application' && targetLayer === 'Presentation') {
                violations.push(
                  `Layer Violation: Application file ${path.relative(SRC_DIR, file)} imports from ${targetLayer} (${importPath})`
                );
              }
              if (fileLayer === 'Infrastructure' && targetLayer === 'Presentation') {
                violations.push(
                  `Layer Violation: Infrastructure file ${path.relative(SRC_DIR, file)} imports from ${targetLayer} (${importPath})`
                );
              }
            }
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
