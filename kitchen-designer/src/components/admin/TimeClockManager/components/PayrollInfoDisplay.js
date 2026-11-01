import React from 'react';
import { DollarSign } from 'lucide-react';
import { calculateCurrentPayPeriodAmount } from '../utils/payrollCalculations';

const PayrollInfoDisplay = ({
  payrollInfo,
  payPeriodHours,
  payPeriodOvertime,
  employeeTaxRate,
  onOpenCalculator,
  t,
}) => {
  if (!payrollInfo) return null;

  const grossPay = calculateCurrentPayPeriodAmount(payrollInfo, payPeriodHours, payPeriodOvertime);
  const netPay = grossPay * (1 - employeeTaxRate / 100);

  return (
    <div className="workday-section payroll-info-display">
      <h3 className="section-title">
        <DollarSign size={20} /> {t("timeclock.pay_info")}
      </h3>

      <div className="payroll-info-grid">
        <div className="info-card highlight">
          <div className="info-label">
            {t("timeclock.current_pay_period_earnings")}
          </div>
          <div className="info-value">${grossPay.toFixed(2)}</div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "#6b7280",
              marginTop: "0.25rem",
            }}
          >
            {t("timeclock.based")} {payPeriodHours.toFixed(6)}{" "}
            {t("timeclock.total_hours_worked")}
          </div>
        </div>

        <div className="info-card">
          <div className="info-label">{t("timeclock.my_tax_rate")}</div>
          {employeeTaxRate > 0 ? (
            <div className="info-value">{employeeTaxRate}%</div>
          ) : (
            <div className="info-value" style={{ color: "#9ca3af" }}>
              {t("timeclock.rate_not_set")}
            </div>
          )}
          <button
            className="btn-calculator"
            onClick={onOpenCalculator}
            style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}
          >
            {employeeTaxRate > 0
              ? t("timeclock.update_tax_rate")
              : t("timeclock.set_tax_rate")}
          </button>
        </div>

        {employeeTaxRate > 0 && (
          <div
            className="info-card"
            style={{
              background: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
              borderColor: "#10b981",
            }}
          >
            <div className="info-label">
              {t("timeclock.estimated_take_home_pay")}
            </div>
            <div
              className="info-value"
              style={{ color: "#065f46", fontSize: "1.5rem" }}
            >
              ${netPay.toFixed(2)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PayrollInfoDisplay;
