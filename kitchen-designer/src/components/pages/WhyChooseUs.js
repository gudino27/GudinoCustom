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
      <div className="sms-compliance-container">
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
                <strong>Measurements Gone Wrong</strong>
                <p>
                  Third parties or homeowners take the measurements, which can lead to cabinets
                  that don't actually fit when they arrive.
                </p>
              </li>
              <li style={{ marginTop: "12px" }}>
                <strong>Long Waits and Delays</strong>
                <p>
                  Orders can take weeks or months, and delays from backorders or shipping issues
                  are pretty common.
                </p>
              </li>
              <li style={{ marginTop: "12px" }}>
                <strong>Missing or Damaged Pieces</strong>
                <p>
                  Cabinets often arrive incomplete or damaged, which means more waiting while
                  replacements are ordered.
                </p>
              </li>
              <li style={{ marginTop: "12px" }}>
                <strong>Hit-or-Miss Quality</strong>
                <p>
                  Materials and construction can vary a lot, leading to uneven finishes, cheap
                  hardware, or cabinets that don't hold up.
                </p>
              </li>
              <li style={{ marginTop: "12px" }}>
                <strong>Hard to Get Help</strong>
                <p>
                  With multiple vendors in the mix, getting straight answers or timely fixes
                  can be frustrating.
                </p>
              </li>
            </ul>

            <div className="sms-highlight-box">
              <strong>Skip the Hassle</strong>
              <br /><br />
              Avoid the delays and confusion that come with big-box cabinet orders. With us,
              you work directly with the people building and installing your cabinets so things
              get done right the first time.
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
      </div>
      <div style={{ height: "3vh" }}></div>
      </div>
      <Footer />
    </>
  );
};

export default WhyChooseUs;
