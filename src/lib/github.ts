const GITHUB_API = 'https://api.github.com';

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

export async function githubRequest(path: string): Promise<Response> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: githubHeaders(),
  });

  return res;
}
