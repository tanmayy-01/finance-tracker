const TransactionModel = require('../models/transactionModel');
const BudgetModel = require('../models/budgetModel');
const { getReportDateRange } = require('../utils/dateHelpers');

const ReportController = {
  getReports(req, res) {
    const userId = req.user.id;
    const { type = 'income_vs_expense', timeRange = 'this_month', startDate: customStart, endDate: customEnd } = req.query;

    const { startDate, endDate } = getReportDateRange(timeRange, customStart, customEnd);

    if (type === 'income_vs_expense') {
      const totals = TransactionModel.getIncomeVsExpenseSummary(userId, startDate, endDate);
      const monthlyBreakdown = TransactionModel.getMonthlyBreakdown(userId, startDate, endDate);

      const netSavings = totals.total_income - totals.total_expenses;
      const savingsRate = totals.total_income > 0 ? Math.round((netSavings / totals.total_income) * 100) : 0;

      return res.json({
        reportType: 'income_vs_expense',
        startDate,
        endDate,
        total_income: totals.total_income,
        total_expenses: totals.total_expenses,
        net_savings: netSavings,
        savings_rate: savingsRate,
        monthlyBreakdown
      });
    } else if (type === 'category_spending') {
      const categories = TransactionModel.getCategorySpendingReport(userId, startDate, endDate);
      const totalSpending = categories.reduce((sum, c) => sum + c.amount, 0);
      const enrichedCategories = categories.map(c => ({
        ...c,
        percent: totalSpending > 0 ? Math.round((c.amount / totalSpending) * 1000) / 10 : 0
      }));

      return res.json({
        reportType: 'category_spending',
        startDate,
        endDate,
        total_spending: totalSpending,
        categories: enrichedCategories,
        topCategory: enrichedCategories[0] || null
      });
    } else if (type === 'budget_utilization') {
      const budgets = BudgetModel.getAll(userId);
      const utilization = budgets.map(b => {
        const catIds = b.category_ids ? b.category_ids.split(',').map(id => id.trim()).filter(Boolean) : [];
        const spent = BudgetModel.getSpent(userId, catIds, startDate, endDate);
        const percent = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
        const variance = b.amount - spent;

        return {
          id: b.id,
          name: b.name,
          budget_amount: b.amount,
          spent_amount: spent,
          variance,
          utilization_percent: percent,
          status: spent > b.amount ? 'Exceeded' : (percent >= (b.alert_threshold || 80) ? 'Near Limit' : 'Within Budget')
        };
      });

      return res.json({
        reportType: 'budget_utilization',
        startDate,
        endDate,
        budgets: utilization
      });
    }

    res.status(400).json({ error: 'Invalid report type specified.' });
  }
};

module.exports = ReportController;
