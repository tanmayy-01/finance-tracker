const TransactionModel = require('../models/transactionModel');
const BudgetModel = require('../models/budgetModel');
const ReminderModel = require('../models/reminderModel');
const { getDateRangeForTimeFrame } = require('../utils/dateHelpers');

const DashboardController = {
  getDashboard(req, res) {
    const userId = req.user.id;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const startOfMonth = `${year}-${month}-01`;
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    const endOfMonth = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    // 1. Totals
    const totals = TransactionModel.getTotals(userId, startOfMonth, endOfMonth);

    // 2. Category Expenses (for Pie Chart)
    const categoryExpenses = TransactionModel.getCategoryExpenses(userId);

    // 3. Budgets & Alerts
    const budgets = BudgetModel.getAll(userId);
    let totalBudgetAmount = 0;
    let totalBudgetSpent = 0;
    const budgetAlerts = [];

    const processedBudgets = budgets.map(b => {
      const range = getDateRangeForTimeFrame(b.time_frame, b.start_date, b.end_date);
      const catIds = b.category_ids ? b.category_ids.split(',').map(id => id.trim()).filter(Boolean) : [];

      const spent = BudgetModel.getSpent(userId, catIds, range.startDate, range.endDate);
      const percent = b.amount > 0 ? (spent / b.amount) * 100 : 0;
      const remaining = Math.max(0, b.amount - spent);

      let status = 'on_track';
      if (spent > b.amount) {
        status = 'exceeded';
        budgetAlerts.push({
          id: b.id,
          name: b.name,
          spent,
          amount: b.amount,
          percent: Math.round(percent),
          status: 'exceeded',
          message: `Budget "${b.name}" has exceeded its limit by ₹${(spent - b.amount).toFixed(2)}!`
        });
      } else if (percent >= (b.alert_threshold || 80)) {
        status = 'nearing_limit';
        budgetAlerts.push({
          id: b.id,
          name: b.name,
          spent,
          amount: b.amount,
          percent: Math.round(percent),
          status: 'nearing_limit',
          message: `Budget "${b.name}" is near its limit (${Math.round(percent)}% used)!`
        });
      }

      totalBudgetAmount += b.amount;
      totalBudgetSpent += spent;

      return {
        ...b,
        spent,
        percent: Math.round(percent * 10) / 10,
        remaining,
        status,
        range
      };
    });

    const overallBudgetPercent = totalBudgetAmount > 0 ? Math.min(100, Math.round((totalBudgetSpent / totalBudgetAmount) * 100)) : 0;

    // 4. Budget Progress Line Chart Data
    const lineChartLabels = [];
    const lineChartSpending = [];
    const lineChartBudgetLimit = [];

    const daysInMonth = lastDay;
    const dailyBudgetRate = totalBudgetAmount > 0 ? (totalBudgetAmount / daysInMonth) : 0;
    let runningSpending = 0;

    const dailyExpenses = TransactionModel.getDailyExpenses(userId, startOfMonth, endOfMonth);
    const expenseByDate = {};
    dailyExpenses.forEach(item => {
      expenseByDate[item.date] = item.amount;
    });

    const currentDayOfMonth = now.getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${year}-${month}-${String(day).padStart(2, '0')}`;
      lineChartLabels.push(`Day ${day}`);
      lineChartBudgetLimit.push(Math.round(dailyBudgetRate * day));

      if (day <= currentDayOfMonth) {
        runningSpending += (expenseByDate[dayStr] || 0);
        lineChartSpending.push(Math.round(runningSpending));
      } else {
        lineChartSpending.push(null);
      }
    }

    // 5. Recent Transactions
    const recentTransactions = TransactionModel.getRecent(userId, 5);

    // 6. Upcoming Reminders
    const todayStr = `${year}-${month}-${String(now.getDate()).padStart(2, '0')}`;
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sevenDaysLaterStr = sevenDaysLater.toISOString().split('T')[0];

    const upcomingReminders = ReminderModel.getUpcoming(userId, sevenDaysLaterStr);

    res.json({
      summary: {
        total_income: totals.total_income,
        total_expenses: totals.total_expenses,
        net_balance: totals.total_income - totals.total_expenses,
        month_income: totals.month_income,
        month_expenses: totals.month_expenses,
        total_budget_amount: totalBudgetAmount,
        total_budget_spent: totalBudgetSpent,
        overall_budget_percent: overallBudgetPercent
      },
      pieChart: {
        total_income: totals.total_income,
        categoryExpenses
      },
      lineChart: {
        labels: lineChartLabels,
        spending: lineChartSpending,
        budgetLimit: lineChartBudgetLimit
      },
      budgets: processedBudgets,
      budgetAlerts,
      recentTransactions,
      upcomingReminders: upcomingReminders.map(r => ({
        ...r,
        is_overdue: r.due_date < todayStr,
        is_due_today: r.due_date === todayStr
      }))
    });
  }
};

module.exports = DashboardController;
