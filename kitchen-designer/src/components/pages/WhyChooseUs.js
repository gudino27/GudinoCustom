import "../css/sms-compliance.css";
import Collapsible from "../ui/Collapsible";
import Navigation from "../ui/Navigation";
import Footer from "../ui/Footer";
import SEO from "../ui/SEO";
import { useLanguage } from "../../contexts/LanguageContext";

const WhyChooseUs = () => {
  const { t } = useLanguage();
  
  return (
    <>
      <SEO
        title={t('whyChooseUs.title')}
        description="Discover why homeowners choose Gudino Custom for their kitchen and bathroom projects. Expert craftsmanship, quality materials, professional installation, and exceptional customer service."
        keywords="why choose us, custom woodworking benefits, quality cabinets, professional installation, expert craftsmanship, Washington cabinet maker"
        canonical="https://gudinocustom.com/why-choose-us"
      />
      <div style={{background:"rgb(110,110,110)"}}>
        <Navigation />
      <div style={{ height: "1vh" }}></div>
      <main id="main-content" tabIndex={-1} className="sms-compliance-container">
        <div className="sms-content">
          <h1 className="sms-header">{t('whyChooseUs.title')}</h1>
          <p>
            <em>{t('whyChooseUs.subtitle')}</em>
          </p>

          <Collapsible title={t('whyChooseUs.setsApart.title')} defaultOpen={true}>
            <p>
              {t('whyChooseUs.setsApart.description')}
            </p>

            <ul className="sms-list">
              <li style={{ marginTop: "12px" }}>
                <strong>{t('whyChooseUs.setsApart.inHouse.title')}</strong>
                <p>
                  {t('whyChooseUs.setsApart.inHouse.description')}
                </p>
              </li>
              <li style={{ marginTop: "12px" }}>
                <strong>{t('whyChooseUs.setsApart.perfectFit.title')}</strong>
                <p>
                  {t('whyChooseUs.setsApart.perfectFit.description')}
                </p>
              </li>
              <li style={{ marginTop: "12px" }}>
                <strong>{t('whyChooseUs.setsApart.builtToLast.title')}</strong>
                <p>
                  {t('whyChooseUs.setsApart.builtToLast.description')}
                </p>
              </li>
              <li style={{ marginTop: "12px" }}>
                <strong>{t('whyChooseUs.setsApart.directCommunication.title')}</strong>
                <p>
                  {t('whyChooseUs.setsApart.directCommunication.description')}
                </p>
              </li>
              <li style={{ marginTop: "12px" }}>
                <strong>{t('whyChooseUs.setsApart.betterScheduling.title')}</strong>
                <p>
                  {t('whyChooseUs.setsApart.betterScheduling.description')}
                </p>
              </li>
              <li style={{ marginTop: "12px" }}>
                <strong>{t('whyChooseUs.setsApart.quality.title')}</strong>
                <p>
                  {t('whyChooseUs.setsApart.quality.description')}
                </p>
              </li>
            </ul>

            <div className="sms-highlight-box">
              <strong>{t('whyChooseUs.setsApart.callToAction')}</strong>
              <br /><br />
              {t('whyChooseUs.setsApart.callToActionText')}
            </div>
          </Collapsible>

          <Collapsible title={t('whyChooseUs.bigBox.title')}>
            <p><strong>{t('whyChooseUs.bigBox.problems')}</strong></p>
            <p>
              {t('whyChooseUs.bigBox.description')}
            </p>

            <ul className="sms-list">
              <li style={{ marginTop: "12px" }}>
                <strong>{t('whyChooseUs.bigBox.measurements.title')}</strong>
                <p>
                  {t('whyChooseUs.bigBox.measurements.description')}
                </p>
              </li>
              <li style={{ marginTop: "12px" }}>
                <strong>{t('whyChooseUs.bigBox.delays.title')}</strong>
                <p>
                  {t('whyChooseUs.bigBox.delays.description')}
                </p>
              </li>
              <li style={{ marginTop: "12px" }}>
                <strong>{t('whyChooseUs.bigBox.damaged.title')}</strong>
                <p>
                  {t('whyChooseUs.bigBox.damaged.description')}
                </p>
              </li>
              <li style={{ marginTop: "12px" }}>
                <strong>{t('whyChooseUs.bigBox.quality.title')}</strong>
                <p>
                  {t('whyChooseUs.bigBox.quality.description')}
                </p>
              </li>
              <li style={{ marginTop: "12px" }}>
                <strong>{t('whyChooseUs.bigBox.support.title')}</strong>
                <p>
                  {t('whyChooseUs.bigBox.support.description')}
                </p>
              </li>
            </ul>

            <div className="sms-highlight-box">
              <strong>{t('whyChooseUs.bigBox.callToAction')}</strong>
              <br /><br />
              {t('whyChooseUs.bigBox.callToActionText')}
            </div>
          </Collapsible>

          <Collapsible title={t('whyChooseUs.installation.title')}>
            <p><strong>{t('whyChooseUs.installation.problems')}</strong></p>
            <p>
              {t('whyChooseUs.installation.description')}
            </p>

            <ul className="sms-list">
              <li style={{ marginTop: "12px" }}>
                <strong>{t('whyChooseUs.installation.notLevel.title')}</strong>
                <p>
                  {t('whyChooseUs.installation.notLevel.description')}
                </p>
              </li>
              <li style={{ marginTop: "12px" }}>
                <strong>{t('whyChooseUs.installation.poorAttachment.title')}</strong>
                <p>
                  {t('whyChooseUs.installation.poorAttachment.description')}
                </p>
              </li>
              <li style={{ marginTop: "12px" }}>
                <strong>{t('whyChooseUs.installation.misaligned.title')}</strong>
                <p>
                  {t('whyChooseUs.installation.misaligned.description')}
                </p>
              </li>
              <li style={{ marginTop: "12px" }}>
                <strong>{t('whyChooseUs.installation.support.title')}</strong>
                <p>
                  {t('whyChooseUs.installation.support.description')}
                </p>
              </li>
              <li style={{ marginTop: "12px" }}>
                <strong>{t('whyChooseUs.installation.gaps.title')}</strong>
                <p>
                  {t('whyChooseUs.installation.gaps.description')}
                </p>
              </li>
              <li style={{ marginTop: "12px" }}>
                <strong>{t('whyChooseUs.installation.appliances.title')}</strong>
                <p>
                  {t('whyChooseUs.installation.appliances.description')}
                </p>
              </li>
            </ul>

            <div className="sms-highlight-box">
              <strong>{t('whyChooseUs.installation.callToAction')}</strong>
              <br /><br />
              {t('whyChooseUs.installation.callToActionText')}
            </div>
          </Collapsible>
        </div>
      </main>
      <div style={{ height: "3vh" }}></div>
      </div>
      <Footer />
    </>
  );
};

export default WhyChooseUs;
