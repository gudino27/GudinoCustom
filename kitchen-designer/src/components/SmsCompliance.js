import { useState, useEffect } from "react";
import "./css/sms-compliance.css";
import WebsitePrivacy from "./WebsitePrivacy";
import Navigation from "./ui/Navigation";
import Footer from "./ui/Footer";
import Collapsible from "./ui/Collapsible";
import { useLanguage } from "../contexts/LanguageContext";

const SmsCompliance = ({ defaultTab = "consent" }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const ConsentContent = () => (
    <>
      <h1 className="sms-header">{t("smsCompliance.consent.header")}</h1>

      <Collapsible title={t("smsCompliance.consent.policy.title")}>
        <p>{t("smsCompliance.consent.policy.content")}</p>
      </Collapsible>

      <Collapsible title={t("smsCompliance.consent.process.title")}>
        <p>{t("smsCompliance.consent.process.intro")}</p>
        <ul className="sms-list">
          <li><strong>{t("smsCompliance.consent.process.timing")}</strong></li>
          <li><strong>{t("smsCompliance.consent.process.training")}</strong></li>
          <li><strong>{t("smsCompliance.consent.process.explanation")}</strong></li>
          <li><strong>{t("smsCompliance.consent.process.documentation")}</strong></li>
          <li><strong>{t("smsCompliance.consent.process.optout")}</strong></li>
        </ul>

        <div className="sms-highlight-box">
          <strong>{t("smsCompliance.consent.script.label")}</strong>
          <br /><br />
          {t("smsCompliance.consent.script.content")}
        </div>

        <div className="sms-section-header">{t("smsCompliance.consent.document.title")}</div>
        <ul className="sms-list">
          <li>{t("smsCompliance.consent.document.date")}</li>
          <li>{t("smsCompliance.consent.document.customer")}</li>
          <li>{t("smsCompliance.consent.document.staff")}</li>
          <li>{t("smsCompliance.consent.document.project")}</li>
          <li>{t("smsCompliance.consent.document.confirmation")}</li>
        </ul>
      </Collapsible>

      <Collapsible title={t("smsCompliance.consent.when.title")}>
        <p>{t("smsCompliance.consent.when.intro")}</p>
        <ul className="sms-list">
          <li>{t("smsCompliance.consent.when.created")}</li>
          <li>{t("smsCompliance.consent.when.modified")}</li>
          <li>{t("smsCompliance.consent.when.reminders")}</li>
        </ul>
      </Collapsible>

      <Collapsible title={t("smsCompliance.consent.samples.title")}>
        <Collapsible title={t("smsCompliance.consent.samples.ready.title")}>
          <div className="sms-sample-message">
            {t("smsCompliance.consent.samples.ready.content")}
          </div>
        </Collapsible>

        <Collapsible title={t("smsCompliance.consent.samples.modified.title")}>
          <div className="sms-sample-message">
            {t("smsCompliance.consent.samples.modified.content")}
          </div>
        </Collapsible>

        <Collapsible title={t("smsCompliance.consent.samples.reminder.title")}>
          <div className="sms-sample-message">
            {t("smsCompliance.consent.samples.reminder.content")}
          </div>
        </Collapsible>
      </Collapsible>

      <Collapsible title={t("smsCompliance.consent.frequency.title")}>
        <p>{t("smsCompliance.consent.frequency.content")}</p>
      </Collapsible>

      <Collapsible title={t("smsCompliance.consent.optout.title")}>
        <p>{t("smsCompliance.consent.optout.content")}</p>
      </Collapsible>
    </>
  );

  const TermsContent = () => (
    <>
      <h1 className="sms-header">{t("smsCompliance.terms.header")}</h1>

      <Collapsible title={t("smsCompliance.terms.frequency.title")}>
        <p>{t("smsCompliance.terms.frequency.intro")}</p>
        <ul className="sms-list">
          <li>{t("smsCompliance.terms.frequency.ready")}</li>
          <li>{t("smsCompliance.terms.frequency.changes")}</li>
          <li>{t("smsCompliance.terms.frequency.reminders")}</li>
        </ul>
      </Collapsible>

      <Collapsible title={t("smsCompliance.terms.optout.title")}>
        <p>{t("smsCompliance.terms.optout.intro")}</p>
        <ul className="sms-list">
          <li><strong>{t("smsCompliance.terms.optout.stop")}</strong></li>
          <li>{t("smsCompliance.terms.optout.confirmation")}</li>
          <li>{t("smsCompliance.terms.optout.nofurther")}</li>
        </ul>
      </Collapsible>

      <Collapsible title={t("smsCompliance.terms.help.title")}>
        <p>{t("smsCompliance.terms.help.content")}</p>
      </Collapsible>

      <Collapsible title={t("smsCompliance.terms.rates.title")}>
        <p>{t("smsCompliance.terms.rates.content")}</p>
      </Collapsible>

      <Collapsible title={t("smsCompliance.terms.carriers.title")}>
        <p>{t("smsCompliance.terms.carriers.intro")}</p>
        <ul className="sms-list">
          <li>{t("smsCompliance.terms.carriers.verizon")}</li>
          <li>{t("smsCompliance.terms.carriers.att")}</li>
          <li>{t("smsCompliance.terms.carriers.tmobile")}</li>
          <li>{t("smsCompliance.terms.carriers.sprint")}</li>
          <li>{t("smsCompliance.terms.carriers.uscellular")}</li>
          <li>{t("smsCompliance.terms.carriers.cricket")}</li>
          <li>{t("smsCompliance.terms.carriers.metropcs")}</li>
          <li>{t("smsCompliance.terms.carriers.boost")}</li>
          <li>{t("smsCompliance.terms.carriers.virgin")}</li>
          <li>{t("smsCompliance.terms.carriers.others")}</li>
        </ul>
      </Collapsible>

      <Collapsible title={t("smsCompliance.terms.availability.title")}>
        <p>{t("smsCompliance.terms.availability.content")}</p>
      </Collapsible>

      <Collapsible title={t("smsCompliance.terms.contact.title")}>
        <p>
          {t("smsCompliance.terms.contact.company")}
          <br />
          {t("smsCompliance.terms.contact.phone")}
          <br />
          {t("smsCompliance.terms.contact.optout")}
          <br />
          {t("smsCompliance.terms.contact.help")}
        </p>
      </Collapsible>
    </>
  );

  const PrivacyContent = () => (
    <>
      <h1 className="sms-header">{t("smsCompliance.privacy.header")}</h1>

      <Collapsible title={t("smsCompliance.privacy.collect.title")}>
        <p>{t("smsCompliance.privacy.collect.intro")}</p>
        <ul className="sms-list">
          <li>{t("smsCompliance.privacy.collect.phone")}</li>
          <li>{t("smsCompliance.privacy.collect.name")}</li>
          <li>{t("smsCompliance.privacy.collect.status")}</li>
        </ul>
      </Collapsible>

      <Collapsible title={t("smsCompliance.privacy.use.title")}>
        <p>{t("smsCompliance.privacy.use.intro")}</p>
        <ul className="sms-list">
          <li>{t("smsCompliance.privacy.use.ready")}</li>
          <li>{t("smsCompliance.privacy.use.changes")}</li>
          <li>{t("smsCompliance.privacy.use.reminders")}</li>
          <li>{t("smsCompliance.privacy.use.optout")}</li>
          <li>{t("smsCompliance.privacy.use.compliance")}</li>
        </ul>
      </Collapsible>

      <Collapsible title={t("smsCompliance.privacy.sharing.title")}>
        <p>
          <strong>{t("smsCompliance.privacy.sharing.never")}</strong>
        </p>
        <p>{t("smsCompliance.privacy.sharing.only")}</p>
      </Collapsible>

      <Collapsible title={t("smsCompliance.privacy.security.title")}>
        <p>{t("smsCompliance.privacy.security.intro")}</p>
        <ul className="sms-list">
          <li>{t("smsCompliance.privacy.security.storage")}</li>
          <li>{t("smsCompliance.privacy.security.access")}</li>
          <li>{t("smsCompliance.privacy.security.updates")}</li>
          <li>{t("smsCompliance.privacy.security.compliance")}</li>
        </ul>
      </Collapsible>

      <Collapsible title={t("smsCompliance.privacy.retention.title")}>
        <p>{t("smsCompliance.privacy.retention.intro")}</p>
        <ul className="sms-list">
          <li>{t("smsCompliance.privacy.retention.duration")}</li>
          <li>{t("smsCompliance.privacy.retention.after")}</li>
          <li>{t("smsCompliance.privacy.retention.deletion")}</li>
        </ul>
      </Collapsible>

      <Collapsible title={t("smsCompliance.privacy.rights.title")}>
        <p>{t("smsCompliance.privacy.rights.intro")}</p>
        <ul className="sms-list">
          <li><strong>{t("smsCompliance.privacy.rights.optout")}</strong></li>
          <li><strong>{t("smsCompliance.privacy.rights.delete")}</strong></li>
          <li><strong>{t("smsCompliance.privacy.rights.update")}</strong></li>
          <li><strong>{t("smsCompliance.privacy.rights.access")}</strong></li>
        </ul>
      </Collapsible>

      <Collapsible title={t("smsCompliance.privacy.withdrawal.title")}>
        <p>{t("smsCompliance.privacy.withdrawal.content")}</p>
      </Collapsible>

      <Collapsible title={t("smsCompliance.privacy.changes.title")}>
        <p>{t("smsCompliance.privacy.changes.content")}</p>
      </Collapsible>

      <Collapsible title={t("smsCompliance.privacy.contact.title")}>
        <p>
          {t("smsCompliance.privacy.contact.intro")}
          <br />
          {t("smsCompliance.privacy.contact.company")}
          <br />
          {t("smsCompliance.privacy.contact.phone")}
          <br />
          {t("smsCompliance.privacy.contact.email")}
        </p>

        <p>
          <em>{t("smsCompliance.privacy.contact.updated")} {new Date().toLocaleDateString()}</em>
        </p>
      </Collapsible>
    </>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "website":
        return <WebsitePrivacy />;
      case "consent":
        return <ConsentContent />;
      case "terms":
        return <TermsContent />;
      case "privacy":
        return <PrivacyContent />;
      default:
        return <WebsitePrivacy />;
    }
  };

  return (
    <div>
      <Navigation />
      <div style={{ height: "3vh" }}></div>
      <div className="sms-compliance-container">
        <div className="sms-tabs-container">
          <button
            className={`sms-tab-button ${
              activeTab === "website" ? "active" : ""
            }`}
            onClick={() => setActiveTab("website")}
          >
            Website Privacy
          </button>
          <button
            className={`sms-tab-button ${
              activeTab === "consent" ? "active" : ""
            }`}
            onClick={() => setActiveTab("consent")}
          >
            SMS Consent
          </button>
          <button
            className={`sms-tab-button ${
              activeTab === "terms" ? "active" : ""
            }`}
            onClick={() => setActiveTab("terms")}
          >
            SMS Terms
          </button>
          <button
            className={`sms-tab-button ${
              activeTab === "privacy" ? "active" : ""
            }`}
            onClick={() => setActiveTab("privacy")}
          >
            SMS Privacy
          </button>
        </div>

        <div className="sms-content">{renderContent()}</div>
      </div>
      <div style={{ height: "2vh" }}></div>
      <Footer />
    </div>
  );
};

export default SmsCompliance;
