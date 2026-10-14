/* =========================================================
   FinVibe - Personal Finance & Budget Tracker Application Logic
   ========================================================= */

// Global State
let currentUser = null;
let authToken = localStorage.getItem('finvibe_token') || null;
let userCategories = [];
let pieChartInstance = null;
let lineChartInstance = null;
let reportChartInstance = null;
let txSearchDebounceTimer = null;
let activeReminderFilter = 'all';
let activeCategoryFilter = 'all';

// Default Transaction Filters
let txFilters = {
  page: 1,
  limit: 10,
  search: '',
  category_id: 'all',
  type: 'all',
  startDate: '',
  endDate: '',
  sort: 'date_desc'
};

// ---------------------------------------------------------
// Initialization
// ---------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  if (authToken) {
    verifySession();
  } else {
    showAuthView();
  }
});

// Toast notification helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconClass = type === 'success' ? 'fa-circle-check text-success' :
                    type === 'danger' ? 'fa-circle-exclamation text-danger' :
                    type === 'warning' ? 'fa-triangle-exclamation text-warning' : 'fa-circle-info text-info';

  toast.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Utility: format currency
function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Utility: escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}

// Fetch API Wrapper with Authorization Header
async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
    ...(options.headers || {})
  };

  try {
    const res = await fetch(endpoint, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && authToken) {
        handleLogout();
        showToast('Your session has expired. Please sign in again.', 'warning');
      }
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }
    return data;
  } catch (err) {
    throw err;
  }
}

// ---------------------------------------------------------
// 1. AUTHENTICATION & SESSION
// ---------------------------------------------------------
function showAuthView() {
  document.getElementById('auth-section').classList.remove('hidden');
  document.getElementById('app-container').classList.add('hidden');
}

function showAppView() {
  document.getElementById('auth-section').classList.add('hidden');
  document.getElementById('app-container').classList.remove('hidden');
  updateNavUserProfile();
  navigateTab('dashboard');
}

function switchAuthTab(tab) {
  const loginBtn = document.getElementById('tab-login');
  const regBtn = document.getElementById('tab-register');
  const loginForm = document.getElementById('login-form');
  const regForm = document.getElementById('register-form');
  const authAlert = document.getElementById('auth-alert');
  authAlert.classList.add('hidden');

  if (tab === 'login') {
    loginBtn.classList.add('active');
    regBtn.classList.remove('active');
    loginForm.classList.remove('hidden');
    regForm.classList.add('hidden');
  } else {
    regBtn.classList.add('active');
    loginBtn.classList.remove('active');
    regForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  }
}

async function verifySession() {
  try {
    const res = await apiRequest('/api/auth/me');
    currentUser = res.user;
    showAppView();
  } catch (err) {
    handleLogout();
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const alertEl = document.getElementById('auth-alert');
  alertEl.classList.add('hidden');

  const identifier = document.getElementById('login-identifier').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password })
    });

    authToken = res.token;
    currentUser = res.user;
    localStorage.setItem('finvibe_token', authToken);
    showToast(`Welcome back, ${currentUser.full_name || currentUser.username || 'User'}!`, 'success');
    showAppView();
  } catch (err) {
    alertEl.innerText = err.message;
    alertEl.classList.remove('hidden');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const alertEl = document.getElementById('auth-alert');
  alertEl.classList.add('hidden');

  const full_name = document.getElementById('reg-fullname').value.trim();
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;

  try {
    const res = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ full_name, username, password })
    });

    authToken = res.token;
    currentUser = res.user;
    localStorage.setItem('finvibe_token', authToken);
    showToast('Account created successfully! Welcome to FinVibe.', 'success');
    showAppView();
  } catch (err) {
    alertEl.innerText = err.message;
    alertEl.classList.remove('hidden');
  }
}

// 1-Click Demo Login: Registers or logs in a demo user with rich sample transactions, budgets, & reminders
async function demoLogin() {
  const demoUsername = 'alex_demo';
  const demoPassword = 'password123';

  try {
    // Try login
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: demoUsername, password: demoPassword })
    }).catch(async () => {
      // If demo user doesn't exist yet, register demo user
      const regRes = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          full_name: 'Alex Morgan',
          username: demoUsername,
          password: demoPassword
        })
      });
      
      // Seed rich sample data for demo user
      authToken = regRes.token;
      localStorage.setItem('finvibe_token', authToken);
      await seedDemoData();
      return regRes;
    });

    authToken = res.token;
    currentUser = res.user;
    localStorage.setItem('finvibe_token', authToken);
    showToast('Signed in to Demo Account with sample data!', 'success');
    showAppView();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function seedDemoData() {
  try {
    // Fetch newly seeded categories
    const catRes = await apiRequest('/api/categories');
    const cats = catRes.categories || [];
    const getCatId = (name) => {
      const match = cats.find(c => c.name.toLowerCase().includes(name.toLowerCase()));
      return match ? match.id : null;
    };

    const salaryId = getCatId('salary');
    const freelanceId = getCatId('freelance');
    const groceriesId = getCatId('groceries');
    const housingId = getCatId('housing') || getCatId('rent');
    const utilitiesId = getCatId('utilities');
    const diningId = getCatId('dining');
    const entertainmentId = getCatId('entertainment');
    const transportId = getCatId('transportation');

    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');

    // Add sample transactions
    const sampleTxs = [
      { type: 'income', category_id: salaryId, amount: 4800, date: `${y}-${m}-01`, notes: 'Monthly Tech Salary' },
      { type: 'income', category_id: freelanceId, amount: 950, date: `${y}-${m}-05`, notes: 'Client UI Design Project' },
      { type: 'expense', category_id: housingId, amount: 1400, date: `${y}-${m}-02`, notes: 'Apartment Monthly Rent' },
      { type: 'expense', category_id: groceriesId, amount: 210.50, date: `${y}-${m}-03`, notes: 'Weekly Whole Foods Grocery' },
      { type: 'expense', category_id: utilitiesId, amount: 145.20, date: `${y}-${m}-04`, notes: 'Electricity & High Speed Fiber Internet' },
      { type: 'expense', category_id: diningId, amount: 85.00, date: `${y}-${m}-06`, notes: 'Dinner with team at Italian Bistro' },
      { type: 'expense', category_id: entertainmentId, amount: 45.00, date: `${y}-${m}-07`, notes: 'Cinema tickets and snacks' },
      { type: 'expense', category_id: groceriesId, amount: 165.80, date: `${y}-${m}-10`, notes: 'Trader Joe\'s restocking' },
      { type: 'expense', category_id: transportId, amount: 60.00, date: `${y}-${m}-11`, notes: 'Subway pass and fuel' }
    ];

    for (const tx of sampleTxs) {
      await apiRequest('/api/transactions', { method: 'POST', body: JSON.stringify(tx) });
    }

    // Add sample Budgets
    await apiRequest('/api/budgets', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Monthly Dining & Food',
        category_ids: diningId ? [diningId] : ['all'],
        amount: 250,
        time_frame: 'monthly',
        alert_threshold: 80
      })
    });

    await apiRequest('/api/budgets', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Household & Utilities',
        category_ids: [groceriesId, utilitiesId].filter(Boolean),
        amount: 600,
        time_frame: 'monthly',
        alert_threshold: 80
      })
    });

    // Add sample Payment Reminders
    const nextWeek = new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const nextMonth = new Date(today.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    await apiRequest('/api/reminders', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Electricity & Gas Utility Bill',
        category_id: utilitiesId,
        amount: 140.00,
        due_date: nextWeek,
        frequency: 'monthly',
        notification_method: 'in-app'
      })
    });

    await apiRequest('/api/reminders', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Apartment Rent Payment',
        category_id: housingId,
        amount: 1400.00,
        due_date: nextMonth,
        frequency: 'monthly',
        notification_method: 'in-app'
      })
    });
  } catch (err) {
    console.error('Seed demo data error:', err);
  }
}

function handleLogout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('finvibe_token');
  showAuthView();
  showToast('You have been signed out.', 'info');
}

function updateNavUserProfile() {
  if (!currentUser) return;
  const nameEl = document.getElementById('nav-user-name');
  const emailEl = document.getElementById('nav-user-email');
  const avatarEl = document.getElementById('nav-user-avatar');

  nameEl.innerText = currentUser.full_name || currentUser.username || 'User';
  emailEl.innerText = currentUser.username ? '@' + currentUser.username : (currentUser.email || '');

  if (currentUser.profile_pic) {
    avatarEl.innerHTML = `<img src="${currentUser.profile_pic}" alt="Profile">`;
  } else {
    avatarEl.innerHTML = `<i class="fa-solid fa-user"></i>`;
  }
}

// ---------------------------------------------------------
// Navigation & Tab Switching
// ---------------------------------------------------------
function navigateTab(tabName) {
  // Update nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('data-tab') === tabName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Switch view
  document.querySelectorAll('.tab-view').forEach(view => {
    view.classList.remove('active');
  });

  const targetView = document.getElementById(`view-${tabName}`);
  if (targetView) {
    targetView.classList.add('active');
  }

  // Close notifications dropdown if open
  document.getElementById('alerts-dropdown').classList.add('hidden');

  // Load specific tab data
  if (tabName === 'dashboard') {
    loadDashboard();
  } else if (tabName === 'transactions') {
    loadCategories().then(() => fetchTransactions(1));
  } else if (tabName === 'budgets') {
    loadCategories().then(() => loadBudgets());
  } else if (tabName === 'categories') {
    loadCategories().then(() => renderCategoriesGrid());
  } else if (tabName === 'reports') {
    loadCategories().then(() => generateReport());
  } else if (tabName === 'reminders') {
    loadCategories().then(() => loadReminders());
  } else if (tabName === 'profile') {
    populateProfileForm();
  }
}

// ---------------------------------------------------------
// 2. DASHBOARD VIEW
// ---------------------------------------------------------
async function loadDashboard() {
  const dateDisplay = document.getElementById('dashboard-date-display');
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  dateDisplay.innerText = `Welcome back, ${currentUser.full_name || 'User'}! Today is ${now.toLocaleDateString('en-US', options)}.`;

  try {
    const data = await apiRequest('/api/dashboard');
    
    // 1. Metric Cards
    document.getElementById('dash-total-income').innerText = formatCurrency(data.summary.total_income);
    document.getElementById('dash-month-income').innerText = `This Month: ${formatCurrency(data.summary.month_income)}`;
    document.getElementById('dash-total-expenses').innerText = formatCurrency(data.summary.total_expenses);
    document.getElementById('dash-month-expenses').innerText = `This Month: ${formatCurrency(data.summary.month_expenses)}`;
    
    const netBalance = data.summary.net_balance;
    const netEl = document.getElementById('dash-net-balance');
    netEl.innerText = formatCurrency(netBalance);
    netEl.className = 'stat-value ' + (netBalance >= 0 ? 'text-success' : 'text-danger');

    // Overall Budget Progress
    const budgetPct = data.summary.overall_budget_percent || 0;
    document.getElementById('dash-budget-percent').innerText = `${budgetPct}%`;
    const fillEl = document.getElementById('dash-budget-progress-fill');
    fillEl.style.width = `${Math.min(100, budgetPct)}%`;
    fillEl.className = 'budget-progress-bar-fill ' + (budgetPct > 100 ? 'progress-red' : (budgetPct >= 80 ? 'progress-amber' : 'progress-green'));
    document.getElementById('dash-budget-ratio').innerText = `${formatCurrency(data.summary.total_budget_spent)} spent of ${formatCurrency(data.summary.total_budget_amount)} budgeted`;

    // 2. Render Budget & Reminder Alerts
    renderDashboardAlerts(data.budgetAlerts || [], data.upcomingReminders || []);

    // 3. Render Charts
    renderIncomeExpensePieChart(data.pieChart);
    renderBudgetProgressLineChart(data.lineChart);

    // 4. Recent Transactions
    renderRecentTransactions(data.recentTransactions || []);

    // 5. Upcoming Reminders Preview
    renderMiniReminders(data.upcomingReminders || []);

  } catch (err) {
    showToast('Failed to load dashboard data: ' + err.message, 'danger');
  }
}

function renderDashboardAlerts(budgetAlerts, reminders) {
  const container = document.getElementById('dashboard-alerts-banner');
  const alertDot = document.getElementById('nav-alert-dot');
  const alertsList = document.getElementById('alerts-list');
  const alertsCount = document.getElementById('alerts-count');
  const remindersBadge = document.getElementById('reminders-badge');

  container.innerHTML = '';
  alertsList.innerHTML = '';

  const totalAlertsCount = budgetAlerts.length + reminders.filter(r => r.is_overdue || r.is_due_today).length;
  
  if (totalAlertsCount > 0) {
    alertDot.classList.remove('hidden');
    alertsCount.innerText = `${totalAlertsCount} active`;
    remindersBadge.classList.remove('hidden');
    remindersBadge.innerText = reminders.length;
    container.classList.remove('hidden');
  } else {
    alertDot.classList.add('hidden');
    alertsCount.innerText = '0 active';
    remindersBadge.classList.add('hidden');
    container.classList.add('hidden');
    alertsList.innerHTML = '<div class="empty-state-sm">No active alerts. All budgets on track!</div>';
  }

  // Populate Banners and Dropdown items
  budgetAlerts.forEach(alert => {
    const isExceeded = alert.status === 'exceeded';
    const banner = document.createElement('div');
    banner.className = `banner-alert ${isExceeded ? 'danger' : 'warning'}`;
    banner.innerHTML = `
      <div><i class="fa-solid fa-triangle-exclamation"></i> <strong>${isExceeded ? 'Budget Exceeded' : 'Budget Warning'}:</strong> ${escapeHtml(alert.message)}</div>
      <button class="btn btn-sm btn-outline" onclick="navigateTab('budgets')">View Budget</button>
    `;
    container.appendChild(banner);

    const dropdownItem = document.createElement('div');
    dropdownItem.className = `alert-item ${isExceeded ? 'alert-exceeded' : ''}`;
    dropdownItem.innerHTML = `<strong>${escapeHtml(alert.name)}:</strong> ${escapeHtml(alert.message)}`;
    alertsList.appendChild(dropdownItem);
  });

  reminders.filter(r => r.is_overdue || r.is_due_today).forEach(r => {
    const isOverdue = r.is_overdue;
    const banner = document.createElement('div');
    banner.className = `banner-alert ${isOverdue ? 'danger' : 'warning'}`;
    banner.innerHTML = `
      <div><i class="fa-regular fa-bell"></i> <strong>${isOverdue ? 'Bill Overdue' : 'Bill Due Today'}:</strong> "${escapeHtml(r.title)}" (${formatCurrency(r.amount)}) due on ${r.due_date}.</div>
      <button class="btn btn-sm btn-outline" onclick="navigateTab('reminders')">Mark as Paid</button>
    `;
    container.appendChild(banner);

    const dropdownItem = document.createElement('div');
    dropdownItem.className = 'alert-item alert-due';
    dropdownItem.innerHTML = `<strong>${escapeHtml(r.title)}:</strong> Due ${isOverdue ? 'was due ' + r.due_date : 'Today'} (${formatCurrency(r.amount)})`;
    alertsList.appendChild(dropdownItem);
  });
}

function toggleAlertsDropdown() {
  const dropdown = document.getElementById('alerts-dropdown');
  dropdown.classList.toggle('hidden');
}

// Chart 1: Income vs Expenses Pie Chart
function renderIncomeExpensePieChart(pieData) {
  const ctx = document.getElementById('incomeExpensePieChart').getContext('2d');
  if (pieChartInstance) {
    pieChartInstance.destroy();
  }

  const categoryExpenses = pieData.categoryExpenses || [];
  const labels = ['Total Income'];
  const dataValues = [pieData.total_income || 0];
  const bgColors = ['#10b981'];

  categoryExpenses.forEach(c => {
    labels.push(c.name || 'Expense');
    dataValues.push(c.amount || 0);
    bgColors.push(c.color || '#f43f5e');
  });

  // If no transactions exist, show placeholder
  if (dataValues.reduce((a, b) => a + b, 0) === 0) {
    labels.push('No Transactions');
    dataValues.push(1);
    bgColors.push('#334155');
  }

  pieChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: dataValues,
        backgroundColor: bgColors,
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#475569',
            font: { family: 'Plus Jakarta Sans', size: 11 },
            boxWidth: 12
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const val = context.raw;
              return ` ${context.label}: ${formatCurrency(val)}`;
            }
          }
        }
      },
      cutout: '65%'
    }
  });
}

// Chart 2: Budget Progress Line Chart
function renderBudgetProgressLineChart(lineData) {
  const ctx = document.getElementById('budgetProgressLineChart').getContext('2d');
  if (lineChartInstance) {
    lineChartInstance.destroy();
  }

  const labels = lineData.labels || [];
  const spending = lineData.spending || [];
  const budgetLimit = lineData.budgetLimit || [];

  lineChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Cumulative Actual Spending',
          data: spending,
          borderColor: '#f43f5e',
          backgroundColor: 'rgba(244, 63, 94, 0.1)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 3,
          pointBackgroundColor: '#f43f5e'
        },
        {
          label: 'Budget Limit Trajectory',
          data: budgetLimit,
          borderColor: '#6366f1',
          borderDash: [5, 5],
          backgroundColor: 'transparent',
          tension: 0.1,
          borderWidth: 2,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      scales: {
        x: {
          grid: { color: '#f1f5f9' },
          ticks: { color: '#64748b', font: { size: 10 } }
        },
        y: {
          grid: { color: '#f1f5f9' },
          ticks: {
            color: '#64748b',
            callback: function(val) { return '₹' + val; }
          }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#475569', font: { family: 'Plus Jakarta Sans', size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` ${context.dataset.label}: ${formatCurrency(context.raw)}`;
            }
          }
        }
      }
    }
  });
}

function renderRecentTransactions(txs) {
  const tbody = document.getElementById('dash-recent-transactions-tbody');
  if (!txs || txs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">No transactions recorded yet.</td></tr>';
    return;
  }

  tbody.innerHTML = txs.map(t => {
    const isIncome = t.type === 'income';
    return `
      <tr>
        <td>${t.date}</td>
        <td>
          <span class="category-tag">
            <span class="category-dot" style="background:${t.category_color || '#6366f1'}"></span>
            ${escapeHtml(t.category_name || 'Uncategorized')}
          </span>
        </td>
        <td>
          <span class="type-badge ${t.type}">${t.type}</span>
        </td>
        <td class="${isIncome ? 'amount-income' : 'amount-expense'}">
          ${isIncome ? '+' : '-'}${formatCurrency(t.amount)}
        </td>
        <td class="text-muted">${escapeHtml(t.notes || '—')}</td>
      </tr>
    `;
  }).join('');
}

function renderMiniReminders(reminders) {
  const container = document.getElementById('dash-reminders-list');
  if (!reminders || reminders.length === 0) {
    container.innerHTML = '<div class="text-muted text-center py-4">No upcoming payments due in the next 7 days.</div>';
    return;
  }

  container.innerHTML = reminders.map(r => `
    <div class="reminder-mini-item">
      <div>
        <strong>${escapeHtml(r.title)}</strong>
        <div class="text-muted" style="font-size:0.75rem;">Due: ${r.due_date} (${escapeHtml(r.category_name || 'General')})</div>
      </div>
      <div class="text-right">
        <div class="text-warning font-weight-bold">${formatCurrency(r.amount)}</div>
        <button class="btn btn-sm btn-ghost" onclick="toggleReminderPaid(${r.id})">Mark Paid</button>
      </div>
    </div>
  `).join('');
}

// ---------------------------------------------------------
// 3. CATEGORIES MANAGEMENT
// ---------------------------------------------------------
async function loadCategories() {
  try {
    const res = await apiRequest('/api/categories');
    userCategories = res.categories || [];
    populateCategoryDropdowns();
    return userCategories;
  } catch (err) {
    showToast('Failed to load categories', 'danger');
    return [];
  }
}

function populateCategoryDropdowns() {
  const filterCatSelect = document.getElementById('tx-filter-category');
  const modalCatSelect = document.getElementById('tx-category');
  const remCatSelect = document.getElementById('rem-category');
  const budgetCatList = document.getElementById('budget-categories-list');

  // Transaction Filter dropdown
  if (filterCatSelect) {
    const currentVal = filterCatSelect.value;
    filterCatSelect.innerHTML = '<option value="all">All Categories</option>' + 
      userCategories.map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${c.type})</option>`).join('');
    filterCatSelect.value = currentVal || 'all';
  }

  // Modal Category dropdown
  if (modalCatSelect) {
    updateCategoryDropdownForType(document.querySelector('input[name="tx_type"]:checked')?.value || 'expense');
  }

  // Reminder Category dropdown
  if (remCatSelect) {
    const expenseCats = userCategories.filter(c => c.type === 'expense');
    remCatSelect.innerHTML = expenseCats.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  }

  // Budget Multi-Category checkbox list
  if (budgetCatList) {
    const expenseCats = userCategories.filter(c => c.type === 'expense');
    budgetCatList.innerHTML = `
      <label class="checkbox-label" style="grid-column: span 2; font-weight:700;">
        <input type="checkbox" id="budget-cat-all" value="all" onchange="toggleSelectAllBudgetCats(this)"> All Expenses
      </label>
      ${expenseCats.map(c => `
        <label class="checkbox-label">
          <input type="checkbox" name="budget_cats" value="${c.id}" class="budget-cat-checkbox">
          <span class="category-dot" style="background:${c.color}"></span>
          ${escapeHtml(c.name)}
        </label>
      `).join('')}
    `;
  }
}

function updateCategoryDropdownForType(type) {
  const select = document.getElementById('tx-category');
  if (!select) return;
  const filtered = userCategories.filter(c => c.type === type);
  select.innerHTML = filtered.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
}

function toggleSelectAllBudgetCats(allCheckbox) {
  const checkboxes = document.querySelectorAll('.budget-cat-checkbox');
  checkboxes.forEach(cb => cb.checked = allCheckbox.checked);
}

function renderCategoriesGrid() {
  const grid = document.getElementById('categories-grid');
  let list = userCategories;

  if (activeCategoryFilter !== 'all') {
    list = userCategories.filter(c => c.type === activeCategoryFilter);
  }

  if (list.length === 0) {
    grid.innerHTML = '<div class="text-muted text-center py-4" style="grid-column: 1/-1;">No categories found for this selection.</div>';
    return;
  }

  grid.innerHTML = list.map(c => `
    <div class="category-card-item">
      <div class="cat-info-group">
        <div class="cat-color-badge" style="background:${c.color || '#6366f1'}">
          <i class="fa-solid fa-tag"></i>
        </div>
        <div>
          <div class="cat-name-label">${escapeHtml(c.name)}</div>
          <div class="cat-type-label">${c.type}</div>
        </div>
      </div>
      <div class="cat-actions">
        <button class="btn-icon" title="Edit Category" onclick="openCategoryModal(${JSON.stringify(c).replace(/"/g, '&quot;')})">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn-icon text-danger" title="Delete Category" onclick="deleteCategory(${c.id})">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function filterCategoryCards(type, btn) {
  activeCategoryFilter = type;
  document.querySelectorAll('.segment-tabs .segment-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCategoriesGrid();
}

function openCategoryModal(cat = null) {
  const modal = document.getElementById('modal-category');
  const title = document.getElementById('modal-cat-title');
  const idInput = document.getElementById('category-id');
  const nameInput = document.getElementById('cat-name');
  const typeSelect = document.getElementById('cat-type');
  const colorInput = document.getElementById('cat-color');

  if (cat) {
    title.innerText = 'Edit Category';
    idInput.value = cat.id;
    nameInput.value = cat.name;
    typeSelect.value = cat.type;
    colorInput.value = cat.color || '#6366f1';
  } else {
    title.innerText = 'Add Category';
    idInput.value = '';
    nameInput.value = '';
    typeSelect.value = 'expense';
    colorInput.value = '#6366f1';
  }

  modal.classList.remove('hidden');
}

function selectPresetColor(hex) {
  document.getElementById('cat-color').value = hex;
}

async function handleCategorySubmit(e) {
  e.preventDefault();
  const id = document.getElementById('category-id').value;
  const name = document.getElementById('cat-name').value.trim();
  const type = document.getElementById('cat-type').value;
  const color = document.getElementById('cat-color').value;

  try {
    if (id) {
      await apiRequest(`/api/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, type, color })
      });
      showToast('Category updated successfully!', 'success');
    } else {
      await apiRequest('/api/categories', {
        method: 'POST',
        body: JSON.stringify({ name, type, color })
      });
      showToast('Category added successfully!', 'success');
    }

    closeModal('modal-category');
    await loadCategories();
    renderCategoriesGrid();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function deleteCategory(id) {
  if (!confirm('Are you sure you want to delete this category? Associated transactions will become uncategorized.')) return;
  try {
    await apiRequest(`/api/categories/${id}`, { method: 'DELETE' });
    showToast('Category deleted.', 'info');
    await loadCategories();
    renderCategoriesGrid();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// ---------------------------------------------------------
// 4. TRANSACTIONS MANAGEMENT
// ---------------------------------------------------------
function debounceTxFetch() {
  clearTimeout(txSearchDebounceTimer);
  txSearchDebounceTimer = setTimeout(() => {
    fetchTransactions(1);
  }, 350);
}

function resetTxFilters() {
  document.getElementById('tx-search-input').value = '';
  document.getElementById('tx-filter-type').value = 'all';
  document.getElementById('tx-filter-category').value = 'all';
  document.getElementById('tx-filter-start-date').value = '';
  document.getElementById('tx-filter-end-date').value = '';
  document.getElementById('tx-sort').value = 'date_desc';
  fetchTransactions(1);
}

async function fetchTransactions(page = 1) {
  txFilters.page = page;
  txFilters.search = document.getElementById('tx-search-input')?.value.trim() || '';
  txFilters.type = document.getElementById('tx-filter-type')?.value || 'all';
  txFilters.category_id = document.getElementById('tx-filter-category')?.value || 'all';
  txFilters.startDate = document.getElementById('tx-filter-start-date')?.value || '';
  txFilters.endDate = document.getElementById('tx-filter-end-date')?.value || '';
  txFilters.sort = document.getElementById('tx-sort')?.value || 'date_desc';

  const params = new URLSearchParams({
    page: txFilters.page,
    limit: txFilters.limit,
    search: txFilters.search,
    type: txFilters.type,
    category_id: txFilters.category_id,
    startDate: txFilters.startDate,
    endDate: txFilters.endDate,
    sort: txFilters.sort
  });

  const tbody = document.getElementById('transactions-tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Loading transactions...</td></tr>';

  try {
    const data = await apiRequest(`/api/transactions?${params.toString()}`);
    renderTransactionsTable(data);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderTransactionsTable(data) {
  const tbody = document.getElementById('transactions-tbody');
  const paginationInfo = document.getElementById('tx-pagination-info');
  const paginationControls = document.getElementById('tx-pagination-controls');

  const txs = data.transactions || [];
  const total = data.total || 0;
  const page = data.page || 1;
  const totalPages = data.totalPages || 1;

  if (txs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No transactions matched your criteria.</td></tr>';
    paginationInfo.innerText = 'Showing 0 of 0 transactions';
    paginationControls.innerHTML = '';
    return;
  }

  tbody.innerHTML = txs.map(t => {
    const isIncome = t.type === 'income';
    return `
      <tr>
        <td>${t.date}</td>
        <td>
          <span class="category-tag">
            <span class="category-dot" style="background:${t.category_color || '#6366f1'}"></span>
            ${escapeHtml(t.category_name || 'Uncategorized')}
          </span>
        </td>
        <td>
          <span class="type-badge ${t.type}">${t.type}</span>
        </td>
        <td class="${isIncome ? 'amount-income' : 'amount-expense'}">
          ${isIncome ? '+' : '-'}${formatCurrency(t.amount)}
        </td>
        <td>${escapeHtml(t.notes || '—')}</td>
        <td class="text-right no-print">
          <button class="btn-icon" title="Edit" onclick="openTransactionModal(${JSON.stringify(t).replace(/"/g, '&quot;')})">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn-icon text-danger" title="Delete" onclick="deleteTransaction(${t.id})">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Pagination Info
  const startIdx = (page - 1) * txFilters.limit + 1;
  const endIdx = Math.min(page * txFilters.limit, total);
  paginationInfo.innerText = `Showing ${startIdx}–${endIdx} of ${total} transactions`;

  // Pagination Buttons
  let controlsHtml = `
    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="fetchTransactions(${page - 1})">
      <i class="fa-solid fa-chevron-left"></i>
    </button>
  `;

  for (let p = 1; p <= totalPages; p++) {
    if (totalPages > 7 && (p < page - 2 || p > page + 2) && p !== 1 && p !== totalPages) {
      if (p === page - 3 || p === page + 3) {
        controlsHtml += `<span class="px-1 text-muted">...</span>`;
      }
      continue;
    }
    controlsHtml += `
      <button class="page-btn ${p === page ? 'active' : ''}" onclick="fetchTransactions(${p})">${p}</button>
    `;
  }

  controlsHtml += `
    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="fetchTransactions(${page + 1})">
      <i class="fa-solid fa-chevron-right"></i>
    </button>
  `;
  paginationControls.innerHTML = controlsHtml;
}

function openTransactionModal(tx = null) {
  const modal = document.getElementById('modal-transaction');
  const title = document.getElementById('modal-tx-title');
  const idInput = document.getElementById('tx-id');
  const amountInput = document.getElementById('tx-amount');
  const dateInput = document.getElementById('tx-date');
  const notesInput = document.getElementById('tx-notes');
  const catSelect = document.getElementById('tx-category');

  if (tx) {
    title.innerText = 'Edit Transaction';
    idInput.value = tx.id;
    if (tx.type === 'income') {
      document.getElementById('tx-type-income').checked = true;
    } else {
      document.getElementById('tx-type-expense').checked = true;
    }
    updateCategoryDropdownForType(tx.type);
    catSelect.value = tx.category_id || '';
    amountInput.value = tx.amount;
    dateInput.value = tx.date;
    notesInput.value = tx.notes || '';
  } else {
    title.innerText = 'Add Transaction';
    idInput.value = '';
    document.getElementById('tx-type-expense').checked = true;
    updateCategoryDropdownForType('expense');
    amountInput.value = '';
    dateInput.value = new Date().toISOString().split('T')[0];
    notesInput.value = '';
  }

  modal.classList.remove('hidden');
}

async function handleTransactionSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('tx-id').value;
  const type = document.querySelector('input[name="tx_type"]:checked').value;
  const category_id = document.getElementById('tx-category').value;
  const amount = parseFloat(document.getElementById('tx-amount').value);
  const date = document.getElementById('tx-date').value;
  const notes = document.getElementById('tx-notes').value.trim();

  if (isNaN(amount) || amount <= 0) {
    showToast('Please enter an amount greater than 0', 'danger');
    return;
  }

  try {
    if (id) {
      await apiRequest(`/api/transactions/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ type, category_id, amount, date, notes })
      });
      showToast('Transaction updated successfully!', 'success');
    } else {
      await apiRequest('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({ type, category_id, amount, date, notes })
      });
      showToast('Transaction added successfully!', 'success');
    }

    closeModal('modal-transaction');
    fetchTransactions(txFilters.page);
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function deleteTransaction(id) {
  if (!confirm('Are you sure you want to delete this transaction?')) return;
  try {
    await apiRequest(`/api/transactions/${id}`, { method: 'DELETE' });
    showToast('Transaction deleted.', 'info');
    fetchTransactions(txFilters.page);
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Export Transactions CSV
function exportTransactionsCSV() {
  const params = new URLSearchParams({
    search: txFilters.search,
    type: txFilters.type,
    category_id: txFilters.category_id,
    startDate: txFilters.startDate,
    endDate: txFilters.endDate
  });

  // Trigger download with auth token in fetch or link
  fetch(`/api/transactions/export/csv?${params.toString()}`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  })
  .then(res => res.blob())
  .then(blob => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Transactions CSV exported!', 'success');
  })
  .catch(() => showToast('Failed to export CSV', 'danger'));
}

// Export Transactions PDF (Printable format)
function exportTransactionsPDF() {
  window.print();
}

// ---------------------------------------------------------
// 5. BUDGETS MANAGEMENT
// ---------------------------------------------------------
async function loadBudgets() {
  const grid = document.getElementById('budgets-grid');
  grid.innerHTML = '<div class="text-muted text-center py-4" style="grid-column: 1/-1;">Loading budgets...</div>';

  try {
    const res = await apiRequest('/api/budgets');
    const budgets = res.budgets || [];

    if (budgets.length === 0) {
      grid.innerHTML = `
        <div class="card text-center py-5" style="grid-column: 1/-1;">
          <div class="brand-icon mb-2"><i class="fa-solid fa-bullseye"></i></div>
          <h3>No Budgets Set Yet</h3>
          <p class="text-muted mb-3">Create your first budget to take control of your expenses and set spending goals.</p>
          <button class="btn btn-primary" onclick="openBudgetModal()">+ Create Budget</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = budgets.map(b => {
      let statusColor = 'progress-green';
      let statusLabel = 'On Track';
      let statusBadge = '<span class="badge-sm text-success"><i class="fa-solid fa-circle-check"></i> On Track</span>';

      if (b.status === 'exceeded') {
        statusColor = 'progress-red';
        statusLabel = 'Exceeded';
        statusBadge = '<span class="badge-sm text-danger"><i class="fa-solid fa-triangle-exclamation"></i> Exceeded</span>';
      } else if (b.status === 'nearing_limit') {
        statusColor = 'progress-amber';
        statusLabel = 'Nearing Limit';
        statusBadge = '<span class="badge-sm text-warning"><i class="fa-solid fa-bell"></i> Near Limit</span>';
      }

      const categoryPills = (b.categoryNames || []).map(name => `<span class="budget-cat-pill">${escapeHtml(name)}</span>`).join('');

      return `
        <div class="budget-card-item">
          <div class="budget-card-header">
            <div>
              <div class="budget-title">${escapeHtml(b.name)}</div>
              <div class="text-muted" style="font-size:0.75rem;">${b.range.startDate} to ${b.range.endDate}</div>
            </div>
            <span class="budget-timeframe-tag">${b.time_frame}</span>
          </div>

          <div class="budget-cats-list">
            ${categoryPills}
          </div>

          <div class="budget-nums-row">
            <div>
              <span class="budget-spent-num ${b.status === 'exceeded' ? 'text-danger' : ''}">${formatCurrency(b.spent)}</span>
              <span class="budget-limit-num"> / ${formatCurrency(b.amount)}</span>
            </div>
            <div class="font-weight-bold" style="font-size:1.1rem;">${b.percent}%</div>
          </div>

          <div class="budget-progress-bar-bg">
            <div class="budget-progress-bar-fill ${statusColor}" style="width: ${Math.min(100, b.percent)}%"></div>
          </div>

          <div class="budget-status-row">
            <span>${statusBadge}</span>
            <span class="text-muted">
              ${b.spent > b.amount ? `${formatCurrency(b.spent - b.amount)} over limit` : `${formatCurrency(b.remaining)} remaining`}
            </span>
          </div>

          <div class="budget-card-actions">
            <button class="btn btn-sm btn-ghost" onclick="openBudgetModal(${JSON.stringify(b).replace(/"/g, '&quot;')})">
              <i class="fa-solid fa-pen"></i> Edit
            </button>
            <button class="btn btn-sm btn-ghost text-danger" onclick="deleteBudget(${b.id})">
              <i class="fa-solid fa-trash"></i> Delete
            </button>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    grid.innerHTML = `<div class="text-danger text-center py-4" style="grid-column: 1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

function toggleCustomBudgetDateRange(val) {
  const customDates = document.getElementById('budget-custom-dates');
  if (val === 'custom') {
    customDates.classList.remove('hidden');
  } else {
    customDates.classList.add('hidden');
  }
}

function openBudgetModal(budget = null) {
  const modal = document.getElementById('modal-budget');
  const title = document.getElementById('modal-budget-title');
  const idInput = document.getElementById('budget-id');
  const nameInput = document.getElementById('budget-name');
  const amountInput = document.getElementById('budget-amount');
  const timeframeSelect = document.getElementById('budget-timeframe');
  const startInput = document.getElementById('budget-start-date');
  const endInput = document.getElementById('budget-end-date');
  const thresholdInput = document.getElementById('budget-alert-threshold');

  populateCategoryDropdowns();

  if (budget) {
    title.innerText = 'Edit Budget';
    idInput.value = budget.id;
    nameInput.value = budget.name;
    amountInput.value = budget.amount;
    timeframeSelect.value = budget.time_frame;
    toggleCustomBudgetDateRange(budget.time_frame);
    startInput.value = budget.start_date || '';
    endInput.value = budget.end_date || '';
    thresholdInput.value = budget.alert_threshold || 80;

    // Set category checkboxes
    const catIds = (budget.category_ids || '').split(',').map(s => s.trim());
    if (catIds.includes('all')) {
      const allCb = document.getElementById('budget-cat-all');
      if (allCb) {
        allCb.checked = true;
        toggleSelectAllBudgetCats(allCb);
      }
    } else {
      document.querySelectorAll('.budget-cat-checkbox').forEach(cb => {
        cb.checked = catIds.includes(cb.value);
      });
    }
  } else {
    title.innerText = 'Create Budget';
    idInput.value = '';
    nameInput.value = '';
    amountInput.value = '';
    timeframeSelect.value = 'monthly';
    toggleCustomBudgetDateRange('monthly');
    startInput.value = '';
    endInput.value = '';
    thresholdInput.value = '80';
    const allCb = document.getElementById('budget-cat-all');
    if (allCb) allCb.checked = true;
    document.querySelectorAll('.budget-cat-checkbox').forEach(cb => cb.checked = true);
  }

  modal.classList.remove('hidden');
}

async function handleBudgetSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('budget-id').value;
  const name = document.getElementById('budget-name').value.trim();
  const amount = parseFloat(document.getElementById('budget-amount').value);
  const time_frame = document.getElementById('budget-timeframe').value;
  const start_date = document.getElementById('budget-start-date').value;
  const end_date = document.getElementById('budget-end-date').value;
  const alert_threshold = parseFloat(document.getElementById('budget-alert-threshold').value) || 80;

  // Selected categories
  let category_ids = [];
  const allCb = document.getElementById('budget-cat-all');
  if (allCb && allCb.checked) {
    category_ids = ['all'];
  } else {
    document.querySelectorAll('.budget-cat-checkbox:checked').forEach(cb => {
      category_ids.push(cb.value);
    });
  }

  if (category_ids.length === 0) {
    showToast('Please select at least one category for this budget.', 'danger');
    return;
  }

  try {
    if (id) {
      await apiRequest(`/api/budgets/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, category_ids, amount, time_frame, start_date, end_date, alert_threshold })
      });
      showToast('Budget updated successfully!', 'success');
    } else {
      await apiRequest('/api/budgets', {
        method: 'POST',
        body: JSON.stringify({ name, category_ids, amount, time_frame, start_date, end_date, alert_threshold })
      });
      showToast('Budget created successfully!', 'success');
    }

    closeModal('modal-budget');
    loadBudgets();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function deleteBudget(id) {
  if (!confirm('Are you sure you want to delete this budget?')) return;
  try {
    await apiRequest(`/api/budgets/${id}`, { method: 'DELETE' });
    showToast('Budget deleted.', 'info');
    loadBudgets();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// ---------------------------------------------------------
// 6. FINANCIAL REPORTS
// ---------------------------------------------------------
function handleReportTimeframeChange() {
  const val = document.getElementById('report-timeframe-select').value;
  const startGroup = document.getElementById('report-custom-start-group');
  const endGroup = document.getElementById('report-custom-end-group');

  if (val === 'custom') {
    startGroup.classList.remove('hidden');
    endGroup.classList.remove('hidden');
  } else {
    startGroup.classList.add('hidden');
    endGroup.classList.add('hidden');
    generateReport();
  }
}

async function generateReport() {
  const reportType = document.getElementById('report-type-select').value;
  const timeRange = document.getElementById('report-timeframe-select').value;
  const startDate = document.getElementById('report-start-date').value;
  const endDate = document.getElementById('report-end-date').value;

  const container = document.getElementById('printable-report-container');
  container.innerHTML = '<div class="card text-center py-5">Generating report...</div>';

  const params = new URLSearchParams({
    type: reportType,
    timeRange,
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {})
  });

  try {
    const data = await apiRequest(`/api/reports?${params.toString()}`);
    if (reportType === 'income_vs_expense') {
      renderIncomeVsExpenseReport(data);
    } else if (reportType === 'category_spending') {
      renderCategorySpendingReport(data);
    } else if (reportType === 'budget_utilization') {
      renderBudgetUtilizationReport(data);
    }
  } catch (err) {
    container.innerHTML = `<div class="card text-danger text-center py-5">${escapeHtml(err.message)}</div>`;
  }
}

function renderIncomeVsExpenseReport(data) {
  const container = document.getElementById('printable-report-container');
  const netSavings = data.net_savings || 0;
  const savingsRate = data.savings_rate || 0;

  container.innerHTML = `
    <!-- Report Header -->
    <div class="card">
      <div class="card-header">
        <div>
          <h2>Income vs. Expense Summary Report</h2>
          <p class="card-subtitle">Period: ${data.startDate} to ${data.endDate}</p>
        </div>
      </div>
      <div class="report-summary-bar mt-2">
        <div class="report-metric-box">
          <div class="report-metric-title">Total Income</div>
          <div class="report-metric-value text-success">${formatCurrency(data.total_income)}</div>
        </div>
        <div class="report-metric-box">
          <div class="report-metric-title">Total Expenses</div>
          <div class="report-metric-value text-danger">${formatCurrency(data.total_expenses)}</div>
        </div>
        <div class="report-metric-box">
          <div class="report-metric-title">Net Savings</div>
          <div class="report-metric-value ${netSavings >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(netSavings)}</div>
        </div>
        <div class="report-metric-box">
          <div class="report-metric-title">Savings Rate</div>
          <div class="report-metric-value ${savingsRate >= 0 ? 'text-success' : 'text-danger'}">${savingsRate}%</div>
        </div>
      </div>
    </div>

    <!-- Monthly Trend Chart Card -->
    <div class="card">
      <div class="card-header">
        <h3><i class="fa-solid fa-chart-column"></i> Monthly Cashflow Breakdown</h3>
      </div>
      <div class="chart-container" style="min-height:300px;">
        <canvas id="reportDynamicChart"></canvas>
      </div>
    </div>

    <!-- Monthly Breakdown Table -->
    <div class="card">
      <div class="card-header">
        <h3>Monthly Summary Details</h3>
      </div>
      <div class="table-responsive">
        <table class="app-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Income</th>
              <th>Expenses</th>
              <th>Net Savings</th>
            </tr>
          </thead>
          <tbody>
            ${(data.monthlyBreakdown || []).map(m => `
              <tr>
                <td><strong>${m.month}</strong></td>
                <td class="text-success">+${formatCurrency(m.income)}</td>
                <td class="text-danger">-${formatCurrency(m.expenses)}</td>
                <td class="${(m.income - m.expenses) >= 0 ? 'text-success' : 'text-danger'} font-weight-bold">
                  ${formatCurrency(m.income - m.expenses)}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Render Bar chart for months
  const ctx = document.getElementById('reportDynamicChart').getContext('2d');
  if (reportChartInstance) reportChartInstance.destroy();

  const months = (data.monthlyBreakdown || []).map(m => m.month);
  const incomeVals = (data.monthlyBreakdown || []).map(m => m.income);
  const expVals = (data.monthlyBreakdown || []).map(m => m.expenses);

  reportChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        { label: 'Income', data: incomeVals, backgroundColor: '#10b981' },
        { label: 'Expenses', data: expVals, backgroundColor: '#f43f5e' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: '#f1f5f9' }, ticks: { color: '#64748b' } },
        y: { grid: { color: '#f1f5f9' }, ticks: { color: '#64748b', callback: v => '₹' + v } }
      },
      plugins: {
        legend: { labels: { color: '#475569' } }
      }
    }
  });
}

function renderCategorySpendingReport(data) {
  const container = document.getElementById('printable-report-container');
  const cats = data.categories || [];

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h2>Category-wise Spending Breakdown</h2>
          <p class="card-subtitle">Period: ${data.startDate} to ${data.endDate}</p>
        </div>
      </div>
      <div class="report-summary-bar mt-2">
        <div class="report-metric-box">
          <div class="report-metric-title">Total Spending</div>
          <div class="report-metric-value text-danger">${formatCurrency(data.total_spending)}</div>
        </div>
        <div class="report-metric-box">
          <div class="report-metric-title">Top Expense Category</div>
          <div class="report-metric-value" style="font-size:1.4rem;">
            ${data.topCategory ? escapeHtml(data.topCategory.name) : 'None'}
          </div>
        </div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="card chart-card">
        <div class="card-header">
          <h3>Category Distribution</h3>
        </div>
        <div class="chart-container">
          <canvas id="reportCategoryPieChart"></canvas>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Category Spending Table</h3>
        </div>
        <div class="table-responsive">
          <table class="app-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Total Spent</th>
                <th>Share %</th>
                <th>Transactions</th>
              </tr>
            </thead>
            <tbody>
              ${cats.map(c => `
                <tr>
                  <td>
                    <span class="category-tag">
                      <span class="category-dot" style="background:${c.color}"></span>
                      ${escapeHtml(c.name)}
                    </span>
                  </td>
                  <td class="text-danger font-weight-bold">${formatCurrency(c.amount)}</td>
                  <td>${c.percent}%</td>
                  <td>${c.transaction_count}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Render Category Donut chart
  const ctx = document.getElementById('reportCategoryPieChart').getContext('2d');
  if (reportChartInstance) reportChartInstance.destroy();

  reportChartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: cats.map(c => c.name),
      datasets: [{
        data: cats.map(c => c.amount),
        backgroundColor: cats.map(c => c.color || '#6366f1'),
        borderColor: '#ffffff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#475569' } }
      }
    }
  });
}

function renderBudgetUtilizationReport(data) {
  const container = document.getElementById('printable-report-container');
  const budgets = data.budgets || [];

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h2>Budget Utilization Analysis</h2>
          <p class="card-subtitle">Actual Spending vs. Budget Limits (${data.startDate} to ${data.endDate})</p>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Budget Limit vs. Actual Spending</h3>
      </div>
      <div class="chart-container" style="min-height:300px;">
        <canvas id="reportBudgetChart"></canvas>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Budget Utilization Details</h3>
      </div>
      <div class="table-responsive">
        <table class="app-table">
          <thead>
            <tr>
              <th>Budget Name</th>
              <th>Budget Limit</th>
              <th>Actual Spent</th>
              <th>Variance</th>
              <th>Utilization %</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${budgets.map(b => {
              const statusClass = b.status === 'Exceeded' ? 'text-danger' : (b.status === 'Near Limit' ? 'text-warning' : 'text-success');
              return `
                <tr>
                  <td><strong>${escapeHtml(b.name)}</strong></td>
                  <td>${formatCurrency(b.budget_amount)}</td>
                  <td>${formatCurrency(b.spent_amount)}</td>
                  <td class="${b.variance >= 0 ? 'text-success' : 'text-danger'}">
                    ${b.variance >= 0 ? '+' : ''}${formatCurrency(b.variance)}
                  </td>
                  <td><strong>${b.utilization_percent}%</strong></td>
                  <td><span class="${statusClass} font-weight-bold">${b.status}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Render Bar chart
  const ctx = document.getElementById('reportBudgetChart').getContext('2d');
  if (reportChartInstance) reportChartInstance.destroy();

  reportChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: budgets.map(b => b.name),
      datasets: [
        { label: 'Budget Limit', data: budgets.map(b => b.budget_amount), backgroundColor: '#6366f1' },
        { label: 'Actual Spent', data: budgets.map(b => b.spent_amount), backgroundColor: '#f43f5e' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: '#f1f5f9' }, ticks: { color: '#64748b' } },
        y: { grid: { color: '#f1f5f9' }, ticks: { color: '#64748b', callback: v => '₹' + v } }
      },
      plugins: {
        legend: { labels: { color: '#475569' } }
      }
    }
  });
}

function exportReportPDF() {
  window.print();
}

// ---------------------------------------------------------
// 7. PAYMENT REMINDERS
// ---------------------------------------------------------
async function loadReminders() {
  const container = document.getElementById('reminders-cards-container');
  container.innerHTML = '<div class="text-muted text-center py-4" style="grid-column: 1/-1;">Loading reminders...</div>';

  try {
    const res = await apiRequest('/api/reminders');
    let reminders = res.reminders || [];

    if (activeReminderFilter === 'due') {
      reminders = reminders.filter(r => !r.is_paid && (r.is_overdue || r.is_due_today));
    } else if (activeReminderFilter === 'upcoming') {
      reminders = reminders.filter(r => !r.is_paid && !r.is_overdue && !r.is_due_today);
    } else if (activeReminderFilter === 'paid') {
      reminders = reminders.filter(r => r.is_paid);
    }

    if (reminders.length === 0) {
      container.innerHTML = `
        <div class="card text-center py-5" style="grid-column: 1/-1;">
          <div class="brand-icon mb-2"><i class="fa-regular fa-bell"></i></div>
          <h3>No Reminders Found</h3>
          <p class="text-muted mb-3">Schedule your upcoming bills, loans, or subscriptions.</p>
          <button class="btn btn-primary" onclick="openReminderModal()">+ Add Reminder</button>
        </div>
      `;
      return;
    }

    container.innerHTML = reminders.map(r => {
      let statusClass = 'status-upcoming';
      let tagClass = 'tag-upcoming';
      let tagText = 'Upcoming';

      if (r.is_paid) {
        statusClass = 'status-paid';
        tagClass = 'tag-paid';
        tagText = 'Paid / Completed';
      } else if (r.is_overdue) {
        statusClass = 'status-overdue';
        tagClass = 'tag-overdue';
        tagText = 'Overdue';
      } else if (r.is_due_today) {
        statusClass = 'status-today';
        tagClass = 'tag-today';
        tagText = 'Due Today';
      }

      return `
        <div class="reminder-card-item ${statusClass}">
          <div>
            <div class="reminder-top">
              <div class="reminder-title-text">${escapeHtml(r.title)}</div>
              <span class="reminder-due-tag ${tagClass}">${tagText}</span>
            </div>

            <div class="reminder-details-grid">
              <div>
                <span class="text-muted">Due Date:</span>
                <div><strong>${r.due_date}</strong></div>
              </div>
              <div>
                <span class="text-muted">Amount Due:</span>
                <div><strong class="text-warning">${formatCurrency(r.amount)}</strong></div>
              </div>
              <div>
                <span class="text-muted">Category:</span>
                <div>${escapeHtml(r.category_name || 'General')}</div>
              </div>
              <div>
                <span class="text-muted">Frequency:</span>
                <div style="text-transform: capitalize;">${r.frequency}</div>
              </div>
            </div>
            <div class="text-muted" style="font-size:0.75rem;">
              <i class="fa-solid fa-bell"></i> Method: ${escapeHtml(r.notification_method || 'in-app')}
            </div>
          </div>

          <div class="reminder-actions">
            <button class="btn btn-sm ${r.is_paid ? 'btn-ghost' : 'btn-primary'}" onclick="toggleReminderPaid(${r.id})">
              <i class="fa-solid ${r.is_paid ? 'fa-rotate-left' : 'fa-check'}"></i> ${r.is_paid ? 'Mark Pending' : 'Mark as Paid'}
            </button>
            <div class="d-flex gap-1">
              <button class="btn-icon" title="Edit" onclick="openReminderModal(${JSON.stringify(r).replace(/"/g, '&quot;')})">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="btn-icon text-danger" title="Delete" onclick="deleteReminder(${r.id})">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    container.innerHTML = `<div class="text-danger text-center py-4" style="grid-column: 1/-1;">${escapeHtml(err.message)}</div>`;
  }
}

function filterReminders(filter, btn) {
  activeReminderFilter = filter;
  document.querySelectorAll('#view-reminders .segment-tabs .segment-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadReminders();
}

function openReminderModal(reminder = null) {
  const modal = document.getElementById('modal-reminder');
  const title = document.getElementById('modal-reminder-title');
  const idInput = document.getElementById('reminder-id');
  const titleInput = document.getElementById('rem-title');
  const catSelect = document.getElementById('rem-category');
  const amountInput = document.getElementById('rem-amount');
  const dueInput = document.getElementById('rem-due-date');
  const freqSelect = document.getElementById('rem-frequency');
  const notifSelect = document.getElementById('rem-notification-method');

  populateCategoryDropdowns();

  if (reminder) {
    title.innerText = 'Edit Payment Reminder';
    idInput.value = reminder.id;
    titleInput.value = reminder.title;
    catSelect.value = reminder.category_id || '';
    amountInput.value = reminder.amount || '';
    dueInput.value = reminder.due_date;
    freqSelect.value = reminder.frequency || 'monthly';
    notifSelect.value = reminder.notification_method || 'in-app';
  } else {
    title.innerText = 'Schedule Payment Reminder';
    idInput.value = '';
    titleInput.value = '';
    amountInput.value = '';
    dueInput.value = new Date().toISOString().split('T')[0];
    freqSelect.value = 'monthly';
    notifSelect.value = 'in-app';
  }

  modal.classList.remove('hidden');
}

async function handleReminderSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('reminder-id').value;
  const title = document.getElementById('rem-title').value.trim();
  const category_id = document.getElementById('rem-category').value;
  const amount = parseFloat(document.getElementById('rem-amount').value) || 0;
  const due_date = document.getElementById('rem-due-date').value;
  const frequency = document.getElementById('rem-frequency').value;
  const notification_method = document.getElementById('rem-notification-method').value;

  try {
    if (id) {
      await apiRequest(`/api/reminders/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ title, category_id, amount, due_date, frequency, notification_method })
      });
      showToast('Payment reminder updated!', 'success');
    } else {
      await apiRequest('/api/reminders', {
        method: 'POST',
        body: JSON.stringify({ title, category_id, amount, due_date, frequency, notification_method })
      });
      showToast('Payment reminder scheduled!', 'success');
    }

    closeModal('modal-reminder');
    loadReminders();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function toggleReminderPaid(id) {
  try {
    const res = await apiRequest(`/api/reminders/${id}/toggle-paid`, { method: 'PATCH' });
    showToast(res.message, 'success');
    loadReminders();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function deleteReminder(id) {
  if (!confirm('Are you sure you want to delete this reminder?')) return;
  try {
    await apiRequest(`/api/reminders/${id}`, { method: 'DELETE' });
    showToast('Reminder deleted.', 'info');
    loadReminders();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// ---------------------------------------------------------
// 8. USER PROFILE & SETTINGS
// ---------------------------------------------------------
let pendingAvatarBase64 = null;

function populateProfileForm() {
  if (!currentUser) return;
  document.getElementById('profile-fullname').value = currentUser.full_name || '';
  document.getElementById('profile-username').value = currentUser.username || '';
  document.getElementById('profile-email').value = currentUser.email || '';
  document.getElementById('profile-phone').value = currentUser.phone || '';
  document.getElementById('profile-dob').value = currentUser.date_of_birth || '';
  document.getElementById('profile-address').value = currentUser.address || '';

  document.getElementById('profile-name-heading').innerText = currentUser.full_name || currentUser.username || 'User Profile';
  document.getElementById('profile-email-sub').innerText = currentUser.email;

  const previewImg = document.getElementById('profile-preview-img');
  const placeholder = document.getElementById('profile-avatar-placeholder');

  if (currentUser.profile_pic) {
    previewImg.src = currentUser.profile_pic;
    previewImg.classList.remove('hidden');
    placeholder.classList.add('hidden');
  } else {
    previewImg.classList.add('hidden');
    placeholder.classList.remove('hidden');
  }
}

function handleAvatarFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    showToast('Image size must be less than 2MB', 'danger');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    pendingAvatarBase64 = event.target.result;
    const previewImg = document.getElementById('profile-preview-img');
    const placeholder = document.getElementById('profile-avatar-placeholder');
    previewImg.src = pendingAvatarBase64;
    previewImg.classList.remove('hidden');
    placeholder.classList.add('hidden');
    showToast('Avatar preview updated. Click "Save Profile" to save changes.', 'info');
  };
  reader.readAsDataURL(file);
}

async function handleUpdateProfile(e) {
  e.preventDefault();
  const full_name = document.getElementById('profile-fullname').value.trim();
  const username = document.getElementById('profile-username').value.trim();
  const phone = document.getElementById('profile-phone').value.trim();
  const date_of_birth = document.getElementById('profile-dob').value;
  const address = document.getElementById('profile-address').value.trim();

  const payload = {
    full_name,
    username,
    phone,
    date_of_birth,
    address,
    ...(pendingAvatarBase64 ? { profile_pic: pendingAvatarBase64 } : {})
  };

  try {
    const res = await apiRequest('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    currentUser = res.user;
    pendingAvatarBase64 = null;
    updateNavUserProfile();
    populateProfileForm();
    showToast('Profile updated successfully!', 'success');
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function handleChangePassword(e) {
  e.preventDefault();
  const current_password = document.getElementById('current-password').value;
  const new_password = document.getElementById('new-password').value;
  const confirm_password = document.getElementById('confirm-new-password').value;

  if (new_password !== confirm_password) {
    showToast('New passwords do not match.', 'danger');
    return;
  }

  if (new_password.length < 6) {
    showToast('New password must be at least 6 characters long.', 'danger');
    return;
  }

  try {
    await apiRequest('/api/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ current_password, new_password })
    });

    document.getElementById('change-password-form').reset();
    showToast('Password changed successfully!', 'success');
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// ---------------------------------------------------------
// Modal Helpers
// ---------------------------------------------------------
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}

function handleModalBackdropClick(e, modalId) {
  if (e.target.id === modalId) {
    closeModal(modalId);
  }
}
