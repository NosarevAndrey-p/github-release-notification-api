const GITHUB_API = 'https://api.github.com';

function githubHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

export async function githubRequest(path) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: githubHeaders(),
  });

  return res;
}