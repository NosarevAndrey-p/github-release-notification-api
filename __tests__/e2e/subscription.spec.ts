import { test, expect } from '@playwright/test';
import pg from 'pg';
import { mockGithub } from './mockGithubServer.js';

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:postgres@127.0.0.1:5434/repo_subscriber_test',
});

test.describe('E2E - Subscription Flow', () => {
  
  test.beforeAll(async () => {
    await mockGithub.start();
  });

  test.afterAll(async () => {
    await mockGithub.stop();
    await pool.end();
  });

  test.beforeEach(async () => {
    mockGithub.reset();
    await pool.query('TRUNCATE TABLE subscriptions, repositories RESTART IDENTITY CASCADE');
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

    // 6. Query the Mailpit API to retrieve the confirmation and unsubscribe links from the sent email
    interface MailpitMessage {
      ID: string;
      Subject: string;
      To: Array<{ Name: string; Address: string }>;
    }
    interface MailpitMessagesResponse {
      messages?: MailpitMessage[];
    }

    const mailpitApi = 'http://127.0.0.1:8025/api/v1';
    await expect.poll(async () => {
      const res = await page.request.get(`${mailpitApi}/messages`);
      if (!res.ok()) return null;
      const data = await res.json() as MailpitMessagesResponse;
      const msg = data.messages?.find((m) => m.To[0]?.Address === email && m.Subject.includes(repo));
      return msg ? msg.ID : null;
    }, {
      message: 'Wait for confirmation email in Mailpit',
      timeout: 5000,
      intervals: [500],
    }).not.toBeNull();

    const messagesRes = await page.request.get(`${mailpitApi}/messages`);
    const messagesData = await messagesRes.json() as MailpitMessagesResponse;
    const targetMsg = messagesData.messages?.find((m) => m.To[0]?.Address === email && m.Subject.includes(repo));
    if (!targetMsg) {
      throw new Error('Target message not found in Mailpit');
    }
    const messageId = targetMsg.ID;

    const msgRes = await page.request.get(`${mailpitApi}/message/${messageId}`);
    expect(msgRes.ok()).toBe(true);
    const msgData = await msgRes.json() as { HTML: string };
    const htmlBody = msgData.HTML;

    const confirmMatch = htmlBody.match(/href="([^"]*\/api\/confirm\/[^"]*)"/);
    const unsubscribeMatch = htmlBody.match(/href="([^"]*\/api\/unsubscribe\/[^"]*)"/);

    expect(confirmMatch).not.toBeNull();
    expect(unsubscribeMatch).not.toBeNull();

    if (!confirmMatch || !unsubscribeMatch) {
      throw new Error('Confirmation or unsubscribe links not found in email body');
    }

    const confirmUrl = confirmMatch[1];
    const unsubscribeUrl = unsubscribeMatch[1];
    
    // 7. Confirm the subscription by calling the API directly
    const confirmRes = await page.request.get(confirmUrl);
    expect(confirmRes.ok()).toBe(true);
    const confirmBody = await confirmRes.json();
    expect(confirmBody.message).toContain('subscription confirmed successfully');
    
    // 8. Refresh the dashboard list and check if the badge becomes "Confirmed"
    await page.click('#btn-refresh');
    await expect(row.locator('.badge')).toHaveText('Confirmed');

    // 9. Simulate a new GitHub release by changing mock GitHub response to v2.0.0
    mockGithub.setLatestRelease(repo, 'v2.0.0');

    // 10. Wait for background scanner (runs every 1s) to pick up the change and update DB.
    // We poll the database directly until the repository's last seen tag becomes v2.0.0
    await expect.poll(async () => {
      const res = await pool.query('SELECT last_seen_tag FROM repositories WHERE full_name = $1', [repo]);
      return res.rows[0]?.last_seen_tag;
    }, {
      message: 'Wait for scanner to detect and update repository last_seen_tag to v2.0.0',
      timeout: 5000,
      intervals: [500],
    }).toBe('v2.0.0');

    // 11. Refresh dashboard page and check if UI shows the new release tag
    await page.click('#btn-refresh');
    await expect(row.locator('td').nth(2)).toContainText('v2.0.0');

    // 12. Simulate unsubscribing by calling the API directly
    const unsubscribeRes = await page.request.get(unsubscribeUrl);
    expect(unsubscribeRes.ok()).toBe(true);
    const unsubscribeBody = await unsubscribeRes.json();
    expect(unsubscribeBody.message).toContain('unsubscribed successfully');

    // 13. Refresh dashboard and verify repository is gone (since no other subscribers, the repo should be cleaned up too)
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
