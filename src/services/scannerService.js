export async function scan({ db, githubRequest, emailService }) {
  const repos = await db.getConfirmedRepositories();
  if (!repos || repos.length === 0) return;

  for (const repo of repos) {
    const res = await githubRequest(`/repos/${repo.full_name}/releases/latest`);
    const ok = res.ok ?? (res.status >= 200 && res.status < 300);

    if (res.status === 404) {
      continue;
    }

    if (res.status === 429 || res.status === 403) {
      console.warn('Rate limit hit, stopping scan early');
      return;
    }

    if (!ok) {
      console.error(`GitHub release request failed for ${repo.full_name}: ${res.status}`);
      continue;
    }

    const releaseData = await res.json();
    const newTag = releaseData.tag_name;
    const releaseUrl = releaseData.html_url;

    if (!newTag || newTag === repo.last_seen_tag) {
      continue;
    }

    const subscriptions = await db.getConfirmedSubscriptionsByRepoId(repo.id);
    for (const sub of subscriptions) {
      try {
        await emailService.sendReleaseNotificationEmail(
          sub.email,
          repo.full_name,
          newTag,
          releaseUrl,
          sub.unsubscribe_token
        );
      } catch (error) {
        console.error(`Failed to email ${sub.email}`, error);
      }
    }

    await db.updateRepositoryLastSeenTag(repo.id, newTag);
  }
}
