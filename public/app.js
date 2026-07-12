document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const authSection = document.getElementById('auth-section');
  const authForm = document.getElementById('auth-form');
  const userEmailInput = document.getElementById('user-email-input');
  
  const dashboardSection = document.getElementById('dashboard-section');
  const activeUserEmail = document.getElementById('active-user-email');
  const btnChangeEmail = document.getElementById('btn-change-email');
  
  const subscribeForm = document.getElementById('subscribe-form');
  const repoInput = document.getElementById('repo-input');
  const btnSubscribe = document.getElementById('btn-subscribe');
  const btnSubscribeText = document.getElementById('btn-subscribe-text');
  const btnSubscribeSpinner = document.getElementById('btn-subscribe-spinner');
  const subscribeAlert = document.getElementById('subscribe-alert');
  
  const btnRefresh = document.getElementById('btn-refresh');
  const subscriptionsLoading = document.getElementById('subscriptions-loading');
  const subscriptionsEmpty = document.getElementById('subscriptions-empty');
  const subscriptionsListWrapper = document.getElementById('subscriptions-list-wrapper');
  const subscriptionsTableBody = document.getElementById('subscriptions-table-body');

  let currentEmail = '';

  // Local Storage Check
  const storedEmail = localStorage.getItem('repo_subscriber_email');
  if (storedEmail) {
    login(storedEmail);
  }

  // Auth form submit
  authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = userEmailInput.value.trim();
    if (email) {
      localStorage.setItem('repo_subscriber_email', email);
      login(email);
    }
  });

  // Change email click
  btnChangeEmail.addEventListener('click', () => {
    localStorage.removeItem('repo_subscriber_email');
    currentEmail = '';
    
    // UI state
    dashboardSection.classList.add('hidden');
    authSection.classList.remove('hidden');
    
    // Clear forms/alerts
    authForm.reset();
    subscribeForm.reset();
    hideAlert(subscribeAlert);
  });

  // Subscribe form submit
  subscribeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(subscribeAlert);
    
    const rawRepo = repoInput.value.trim();
    if (!rawRepo) return;
    
    const repo = cleanRepoInput(rawRepo);
    
    // Loading state
    setSubscribeLoading(true);
    
    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: currentEmail, repo })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Success
        let alertClass = 'alert-success';
        if (data.message && data.message.includes('resent')) {
          alertClass = 'alert-warning';
        }
        showAlert(subscribeAlert, data.message || 'Subscribed successfully!', alertClass);
        subscribeForm.reset();
        
        // Refresh the list
        await fetchSubscriptions();
      } else {
        // Error response
        showAlert(subscribeAlert, data.error || 'Failed to subscribe.', 'alert-danger');
      }
    } catch (err) {
      console.error(err);
      showAlert(subscribeAlert, 'An unexpected network error occurred.', 'alert-danger');
    } finally {
      setSubscribeLoading(false);
    }
  });

  // Refresh click
  btnRefresh.addEventListener('click', () => {
    fetchSubscriptions();
  });

  // Helpers
  function login(email) {
    currentEmail = email;
    activeUserEmail.textContent = email;
    
    authSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    
    fetchSubscriptions();
  }

  async function fetchSubscriptions() {
    if (!currentEmail) return;
    
    // Loading State
    subscriptionsLoading.classList.remove('hidden');
    subscriptionsEmpty.classList.add('hidden');
    subscriptionsListWrapper.classList.add('hidden');
    
    try {
      const response = await fetch(`/api/subscriptions?email=${encodeURIComponent(currentEmail)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch subscriptions');
      }
      
      const subscriptions = await response.json();
      renderSubscriptions(subscriptions);
    } catch (err) {
      console.error(err);
      subscriptionsLoading.classList.add('hidden');
      subscriptionsEmpty.classList.remove('hidden');
      subscriptionsEmpty.querySelector('p').textContent = 'Error loading subscriptions. Please try again.';
    } finally {
      subscriptionsLoading.classList.add('hidden');
    }
  }

  function renderSubscriptions(subscriptions) {
    if (!subscriptions || subscriptions.length === 0) {
      subscriptionsEmpty.classList.remove('hidden');
      subscriptionsEmpty.querySelector('p').textContent = "You haven't subscribed to any repositories yet.";
      return;
    }
    
    subscriptionsTableBody.innerHTML = '';
    
    subscriptions.forEach(sub => {
      const tr = document.createElement('tr');
      
      // Repo column
      const tdRepo = document.createElement('td');
      const aRepo = document.createElement('a');
      aRepo.href = `https://github.com/${sub.repo}`;
      aRepo.target = '_blank';
      aRepo.rel = 'noopener noreferrer';
      aRepo.className = 'repo-link';
      aRepo.textContent = sub.repo;
      tdRepo.appendChild(aRepo);
      
      // Status column
      const tdStatus = document.createElement('td');
      const badge = document.createElement('span');
      if (sub.confirmed) {
        badge.className = 'badge badge-confirmed';
        badge.textContent = 'Confirmed';
      } else {
        badge.className = 'badge badge-pending';
        badge.textContent = 'Pending';
      }
      tdStatus.appendChild(badge);
      
      // Last tag column
      const tdTag = document.createElement('td');
      if (sub.last_seen_tag) {
        const code = document.createElement('code');
        code.className = 'tag-code';
        code.textContent = sub.last_seen_tag;
        tdTag.appendChild(code);
      } else {
        const span = document.createElement('span');
        span.className = 'tag-none';
        span.textContent = 'No releases yet';
        tdTag.appendChild(span);
      }
      
      tr.appendChild(tdRepo);
      tr.appendChild(tdStatus);
      tr.appendChild(tdTag);
      
      subscriptionsTableBody.appendChild(tr);
    });
    
    subscriptionsListWrapper.classList.remove('hidden');
  }

  function cleanRepoInput(input) {
    input = input.trim();
    // Remove trailing slashes
    input = input.replace(/\/+$/, '');
    
    try {
      if (input.startsWith('http://') || input.startsWith('https://')) {
        const url = new URL(input);
        if (url.hostname === 'github.com' || url.hostname.endsWith('.github.com')) {
          const parts = url.pathname.split('/').filter(Boolean);
          if (parts.length >= 2) {
            return `${parts[0]}/${parts[1]}`;
          }
        }
      }
    } catch {
      // Fall through if URL parsing fails
    }
    
    return input;
  }

  function setSubscribeLoading(isLoading) {
    if (isLoading) {
      btnSubscribe.disabled = true;
      btnSubscribeText.textContent = 'Subscribing...';
      btnSubscribeSpinner.classList.remove('hidden');
    } else {
      btnSubscribe.disabled = false;
      btnSubscribeText.textContent = 'Subscribe';
      btnSubscribeSpinner.classList.add('hidden');
    }
  }

  function showAlert(element, message, typeClass) {
    element.textContent = message;
    element.className = `alert ${typeClass}`;
    element.classList.remove('hidden');
  }

  function hideAlert(element) {
    element.classList.add('hidden');
    element.textContent = '';
  }
});
