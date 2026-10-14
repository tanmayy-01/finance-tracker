function getDateRangeForTimeFrame(timeFrame, customStart, customEnd) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  if (timeFrame === 'monthly') {
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    return {
      startDate: `${year}-${month}-01`,
      endDate: `${year}-${month}-${String(lastDay).padStart(2, '0')}`
    };
  } else if (timeFrame === 'yearly') {
    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`
    };
  } else if (timeFrame === 'custom' && customStart && customEnd) {
    return {
      startDate: customStart,
      endDate: customEnd
    };
  }
  // Default to current month
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  return {
    startDate: `${year}-${month}-01`,
    endDate: `${year}-${month}-${String(lastDay).padStart(2, '0')}`
  };
}

function getReportDateRange(timeRange, customStart, customEnd) {
  const now = new Date();
  if (timeRange === 'this_month') {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    return {
      startDate: `${year}-${month}-01`,
      endDate: `${year}-${month}-${String(lastDay).padStart(2, '0')}`
    };
  } else if (timeRange === 'last_30_days') {
    const prior = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return {
      startDate: prior.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0]
    };
  } else if (timeRange === 'last_3_months') {
    const prior = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      startDate: prior.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  } else if (timeRange === 'year_to_date') {
    return {
      startDate: `${now.getFullYear()}-01-01`,
      endDate: now.toISOString().split('T')[0]
    };
  } else if (timeRange === 'custom' && customStart && customEnd) {
    return {
      startDate: customStart,
      endDate: customEnd
    };
  }
  return {
    startDate: `${now.getFullYear()}-01-01`,
    endDate: now.toISOString().split('T')[0]
  };
}

module.exports = {
  getDateRangeForTimeFrame,
  getReportDateRange
};
