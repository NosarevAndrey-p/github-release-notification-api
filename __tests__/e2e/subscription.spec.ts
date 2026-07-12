import { test, expect } from '@playwright/test';
import pg from 'pg';
import { mockGithub } from './mockGithubServer.js';

const subPool = new pg.Pool({
  connectionString: 'postgresql://postgres:postgres@127.0.0.1:5434/subscription_test_db',
});

const notifPool = new pg.Pool({
  connectionString: 'postgresql://postgres:postgres@127.0.0.1:5434/repo_manager_test_db',
});

interface MailpitMessage {
  ID: string;
  To: { Address: string }[];
}

interface MailpitDetail {
  HTML: string;
}

async function getLatestEmailLinks(toEmail: string): Promise<{ confirmUrl?: string; unsubscribeUrl?: string }> {
  try {
    const res = await fetch('http://127.0.0.1:8025/api/v1/messages');
    if (!res.ok) {
      return {};
    }
    const data = await res.json() as { messages: MailpitMessage[] };
    if (!data.messages || data.messages.length === 0) {
      return {};
    }
    
    // Find the latest message sent to our target email
    const message = data.messages.find(m => m.To.some(t => t.Address === toEmail));
    if (!message) {
      return {};
    }
    
    // Fetch the full message content to get the HTML body
    const detailRes = await fetch(`http://127.0.0.1:8025/api/v1/message/${message.ID}`);
    if (!detailRes.ok) {
      return {};
    }
    const detail = await detailRes.json() as MailpitDetail;
    const html = detail.HTML || '';
    
    // Extract links using regex (decoding standard HTML entity references if any)
    const confirmMatch = html.match(/href="([^"]*\/api\/confirm\/[^"]*)"/);
    const unsubscribeMatch = html.match(/href="([^"]*\/api\/unsubscribe\/[^"]*)"/);
    
    return {
      confirmUrl: confirmMatch ? confirmMatch[1].replace(/&amp;/g, '&') : undefined,
      unsubscribeUrl: unsubscribeMatch ? unsubscribeMatch[1].replace(/&amp;/g, '&') : undefined,
    };
  } catch {
    return {};
  }
}

async function waitForEmailAndExtractLinks(toEmail: string, type: 'confirm' | 'unsubscribe', retries = 15, delayMs = 300): Promise<string> {
  for (let i = 0; i < retries; i++) {
    const links = await getLatestEmailLinks(toEmail);
    if (type === 'confirm' && links.confirmUrl) {
      return links.confirmUrl;
    }
    if (type === 'unsubscribe' && links.unsubscribeUrl) {
      return links.unsubscribeUrl;
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  throw new Error(`Timeout waiting for email of type ${type} to ${toEmail}`);
}

async function clearMailbox(): Promise<void> {
  try {
    await fetch('http://127.0.0.1:8025/api/v1/messages', { method: 'DELETE' });
  } catch {
    // Ignore if Mailpit API is not reachable or clear fails
  }
}

test.describe('E2E - Subscription Flow', () => {
  
  test.beforeAll(async () => {
    await mockGithub.start();
  });

  test.afterAll(async () => {
    await mockGithub.stop();
    await subPool.end();
    await notifPool.end();
  });

  test.beforeEach(async () => {
    mockGithub.reset();
    await clearMailbox();
    await subPool.query('TRUNCATE TABLE subscriptions RESTART IDENTITY CASCADE');
    await notifPool.query('TRUNCATE TABLE repositories RESTART IDENTITY CASCADE');
  });

  test('should manage the whole subscription lifecycle (subscribe, confirm, scan for updates, unsubscribe)', async ({ page }) => {
    const email = 'e2e-tester@example.com';
    const repo = 'playwright/test-repo';
    
    mockGithub.setRepo(repo, 98765);
    mockGithub.setLatestRelease(repo, 'v1.0.0');

    // 1. Visit the home page (it should show the email login card)
    await page.goto('/');
    await expect(page.locator('#auth-section')).toBeVisible();
    await expect(page.locator('#dashboard-section')).toBeHidden();

    // 2. Submit the email form
    await page.fill('#user-email-input', email);
    await page.click('#btn-load-dashboard');

    // 3. Verify dashboard is loaded with empty state
    await expect(page.locator('#auth-section')).toBeHidden();
    await expect(page.locator('#dashboard-section')).toBeVisible();
    await expect(page.locator('#active-user-email')).toHaveText(email);
    await expect(page.locator('#subscriptions-empty')).toBeVisible();

    // 4. Subscribe to a repository (in owner/repo format)
    await page.fill('#repo-input', repo);
    await page.click('#btn-subscribe');

    // 5. Verify success alert is shown and list is updated (with Pending badge)
    await expect(page.locator('#subscribe-alert')).toHaveClass(/alert-success/);
    await expect(page.locator('#subscribe-alert')).toContainText('subscription successful');
    
    await expect(page.locator('#subscriptions-empty')).toBeHidden();
    await expect(page.locator('#subscriptions-list-wrapper')).toBeVisible();
    
    const row = page.locator('#subscriptions-table-body tr').first();
    await expect(row.locator('.repo-link')).toHaveText(repo);
    await expect(row.locator('.badge')).toHaveText('Pending');
    await expect(row.locator('td').nth(2)).toContainText('v1.0.0');

    // 6. Retrieve the confirmation link from the Mailpit SMTP inbox instead of DB
    const confirmUrl = await waitForEmailAndExtractLinks(email, 'confirm');
    
    // 7. Confirm the subscription by navigating the extracted confirm link
    const confirmRes = await page.request.get(confirmUrl);
    expect(confirmRes.ok()).toBe(true);
    const confirmBody = await confirmRes.json() as { message: string };
    expect(confirmBody.message).toContain('subscription confirmed successfully');
    
    // 8. Refresh the dashboard list and check if the badge becomes "Confirmed"
    await page.click('#btn-refresh');
    await expect(row.locator('.badge')).toHaveText('Confirmed');

    // Clear mailbox so we can cleanly catch the next release notification email
    await clearMailbox();

    // 9. Simulate a new GitHub release by changing mock GitHub response to v2.0.0
    mockGithub.setLatestRelease(repo, 'v2.0.0');

    // 10. Wait for background scanner (runs every 1s) to pick up the change and update DB.
    await expect.poll(async () => {
      const res = await notifPool.query('SELECT last_seen_tag FROM repositories WHERE full_name = $1', [repo]);
      return res.rows[0]?.last_seen_tag;
    }, {
      message: 'Wait for scanner to detect and update repository last_seen_tag to v2.0.0',
      timeout: 5000,
      intervals: [500],
    }).toBe('v2.0.0');

    // 11. Refresh dashboard page and check if UI shows the new release tag
    await page.click('#btn-refresh');
    await expect(row.locator('td').nth(2)).toContainText('v2.0.0');

    // 12. Retrieve the unsubscribe link from the release notification email in Mailpit
    const unsubscribeUrl = await waitForEmailAndExtractLinks(email, 'unsubscribe');

    // 13. Simulate unsubscribing by requesting the extracted unsubscribe link
    const unsubscribeRes = await page.request.get(unsubscribeUrl);
    expect(unsubscribeRes.ok()).toBe(true);
    const unsubscribeBody = await unsubscribeRes.json() as { message: string };
    expect(unsubscribeBody.message).toContain('unsubscribed successfully');

    // 14. Refresh dashboard and verify repository is gone
    await page.click('#btn-refresh');
    await expect(page.locator('#subscriptions-empty')).toBeVisible();
    await expect(page.locator('#subscriptions-list-wrapper')).toBeHidden();
  });

  test('should handle validation errors and non-existent repos in E2E', async ({ page }) => {
    const email = 'error-tester@example.com';
    const invalidRepo = 'non-existent/repo';

    // Set mock to return 404 for non-existent repo
    mockGithub.setRepo(invalidRepo, null);

    await page.goto('/');
    await page.fill('#user-email-input', email);
    await page.click('#btn-load-dashboard');

    // Try subscribing to invalid repo format
    await page.fill('#repo-input', 'invalid_format');
    await page.click('#btn-subscribe');
    await expect(page.locator('#subscribe-alert')).toHaveClass(/alert-danger/);
    await expect(page.locator('#subscribe-alert')).toContainText('invalid repo format');

    // Try subscribing to non-existent repo (mocked as 404)
    await page.fill('#repo-input', invalidRepo);
    await page.click('#btn-subscribe');
    await expect(page.locator('#subscribe-alert')).toHaveClass(/alert-danger/);
    await expect(page.locator('#subscribe-alert')).toContainText('repository not found');
  });
});
