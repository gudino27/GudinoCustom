import React from 'react';
import { AlertTriangle, Calculator } from 'lucide-react';
import { calculateCurrentPayPeriodAmount } from '../utils/payrollCalculations';

const PaycheckCalculatorModal = ({
  show,
  payrollInfo,
  payPeriodHours,
  payPeriodOvertime,
  employeeTaxRate,
  setEmployeeTaxRate,
  onSaveTaxRate,
  savingTaxRate,
  onClose,
  t,
}) => {
  if (!show || !payrollInfo) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content calculator-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Calculator size={22} /> {t("timeclock.paycheck_calculator_title")}
          </h3>
          <button className="btn-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="calculator-body">
          {/* Gross Pay Section */}
          <div className="calc-section">
            <h4>{t("timeclock.gross_pay_before_taxes")}</h4>
            {payrollInfo.employment_type === "hourly" ? (
              <div className="gross-breakdown">
                <div className="breakdown-item">
                  <span>
                    {t("timeclock.regular_hours")}:{" "}
                    {(payPeriodHours - payPeriodOvertime).toFixed(6)}{" "}
                    {t("timeclock.hrs")}
                  </span>
                  <span>
                    @ ${payrollInfo.hourly_rate?.toFixed(2)}
                    {t("timeclock.per_hour")}
                  </span>
                  <span className="amount">
                    $
                    {(
                      (payPeriodHours - payPeriodOvertime) *
                      (payrollInfo.hourly_rate || 0)
                    ).toFixed(2)}
                  </span>
                </div>
                {payPeriodOvertime > 0 && (
                  <div className="breakdown-item">
                    <span>
                      {t("timeclock.overtime_hours")}:{" "}
                      {payPeriodOvertime.toFixed(6)} {t("timeclock.hrs")}
                    </span>
                    <span>
                      @ ${payrollInfo.overtime_rate?.toFixed(2)}
                      {t("timeclock.per_hour")}
                    </span>
                    <span className="amount">
                      $
                      {(
                        payPeriodOvertime *
                        (payrollInfo.overtime_rate || 0)
                      ).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="total-line">
                  <strong>{t("timeclock.gross_total")}</strong>
                  <strong>
                    $
                    {calculateCurrentPayPeriodAmount(
                      payrollInfo,
                      payPeriodHours,
                      payPeriodOvertime
                    ).toFixed(2)}
                  </strong>
                </div>
              </div>
            ) : (
              <div className="gross-breakdown">
                <div className="breakdown-item">
                  <span>{t("timeclock.salary_pay_period_amount")}</span>
                  <span className="amount">
                    $
                    {calculateCurrentPayPeriodAmount(
                      payrollInfo,
                      payPeriodHours,
                      payPeriodOvertime
                    ).toFixed(2)}
                  </span>
                </div>
                <div className="total-line">
                  <strong>{t("timeclock.gross_total")}</strong>
                  <strong>
                    $
                    {calculateCurrentPayPeriodAmount(
                      payrollInfo,
                      payPeriodHours,
                      payPeriodOvertime
                    ).toFixed(2)}
                  </strong>
                </div>
              </div>
            )}
          </div>

          {/* Tax Rate Input Section */}
          <div className="calc-section tax-section">
            <h4>{t("timeclock.your_tax_rate")}</h4>
            <p className="tax-description">
              {t("timeclock.tax_rate_description")}
            </p>
            <div className="tax-input-group">
              <label>{t("timeclock.total_tax_rate_label")}</label>
              <div className="input-with-suffix">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={employeeTaxRate}
                  onChange={(e) =>
                    setEmployeeTaxRate(parseFloat(e.target.value) || 0)
                  }
                  placeholder="25"
                />
                <span className="suffix">%</span>
              </div>
              <button
                className="btn-save-tax"
                onClick={onSaveTaxRate}
                disabled={savingTaxRate}
              >
                {savingTaxRate
                  ? t("timeclock.saving")
                  : t("timeclock.save_my_rate")}
              </button>
            </div>
            <div className="tax-examples">
              <p>
                <strong>{t("timeclock.common_examples")}</strong>
              </p>
              <ul>
                <li>{t("timeclock.tax_example_low")}</li>
                <li>{t("timeclock.tax_example_mid")}</li>
                <li>{t("timeclock.tax_example_high")}</li>
              </ul>
            </div>
          </div>

          {/* Deductions Breakdown */}
          <div className="calc-section">
            <h4>{t("timeclock.estimated_deductions")}</h4>
            <div className="deductions-breakdown">
              <div className="deduction-item">
                <span>
                  {t("timeclock.taxes_label", { rate: employeeTaxRate })}
                </span>
                <span className="deduction-amount">
                  -$
                  {(
                    calculateCurrentPayPeriodAmount(
                      payrollInfo,
                      payPeriodHours,
                      payPeriodOvertime
                    ) *
                    (employeeTaxRate / 100)
                  ).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Net Pay Section */}
          <div className="calc-section net-pay-section">
            <div className="net-pay-line">
              <h3>{t("timeclock.estimated_take_home_pay")}</h3>
              <h3 className="net-amount">
                $
                {(
                  calculateCurrentPayPeriodAmount(
                    payrollInfo,
                    payPeriodHours,
                    payPeriodOvertime
                  ) *
                  (1 - employeeTaxRate / 100)
                ).toFixed(2)}
              </h3>
            </div>
            <p className="disclaimer" style={{ display: "flex", gap: "0.5rem" }}>
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{t("timeclock.estimate_disclaimer")}</span>
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-close-modal" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaycheckCalculatorModal;
