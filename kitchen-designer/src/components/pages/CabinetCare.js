import "../css/sms-compliance.css";
import "../css/home.css";
import Collapsible from "../ui/Collapsible";
import Navigation from "../ui/Navigation";
import Footer from "../ui/Footer";
import SEO from "../ui/SEO";
import { Download } from 'lucide-react';
import { useLanguage } from "../../contexts/LanguageContext";

const CabinetCare = () => {
  const { t } = useLanguage();

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = '/documents/Cabinet_Care,Cleaning&Warranty_Guide.pdf';
    link.download = 'Cabinet-Care-Guide.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  return (
    <>
      <SEO
        title="Cabinet Care & Maintenance Guide"
        description="Expert tips for cleaning and maintaining your custom kitchen cabinets and bathroom vanities. Learn how to protect your investment and keep your cabinets looking new."
        keywords="cabinet care, cabinet maintenance, cleaning wood cabinets, cabinet cleaning tips, protect cabinets, cabinet care guide"
        canonical="https://gudinocustom.com/cabinet-care"
      />
      <div style={{background:"rgb(110,110,110)"}}>
        <Navigation />
        <div style={{ height: "3vh" }}></div>
        <div className="sms-compliance-container">
          <div className="sms-content">
            <h1 className="sms-header">{t("cabinetCare.title")}</h1>
            <p>
              <em>{t("cabinetCare.intro")}</em>
            </p>

            

            <Collapsible title={t("cabinetCare.maintenance.title")}>
              <p
                style={{
                  borderBottom: "2px solid rgba(255, 255, 255, 0.3)",
                  paddingBottom: "12px",
                  marginBottom: "12px",
                }}
              >
                {t("cabinetCare.maintenance.intro")}
              </p>
            </Collapsible>

            <Collapsible title={t("cabinetCare.attention.title")}>
              <ul className="sms-list">
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.attention.sink.title")}</strong>
                </li>
                <p>{t("cabinetCare.attention.sink.content")}</p>
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.attention.oven.title")}</strong>
                </li>
                <p>{t("cabinetCare.attention.oven.content")}</p>
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.attention.appliances.title")}</strong>
                </li>
                <p>{t("cabinetCare.attention.appliances.content")}</p>
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.attention.trash.title")}</strong>
                </li>
                <p>{t("cabinetCare.attention.trash.content")}</p>
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.attention.dishwasher.title")}</strong>
                  <p>{t("cabinetCare.attention.dishwasher.content")}</p>
                </li>
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.attention.cooktop.title")}</strong>
                  <p>{t("cabinetCare.attention.cooktop.content")}</p>
                </li>
              </ul>
              <div className="sms-highlight-box">
                <strong>{t("cabinetCare.attention.important")}</strong>
              </div>
              <div
                style={{
                  borderBottom: "2px solid rgba(255, 255, 255, 0.3)",
                  paddingBottom: "12px",
                  marginBottom: "12px",
                }}
              ></div>
            </Collapsible>

            <Collapsible title={t("cabinetCare.guidelines.title")}>
              <ul className=" sms-list">
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.guidelines.routine.title")}</strong>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.guidelines.routine.item1")}
                  </p>
                  <p>{t("cabinetCare.guidelines.routine.item2")}</p>
                  <p>{t("cabinetCare.guidelines.routine.item3")}</p>
                  <p>{t("cabinetCare.guidelines.routine.item4")}</p>
                  <p>{t("cabinetCare.guidelines.routine.item5")}</p>
                </li>
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.guidelines.periodic.title")}</strong>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.guidelines.periodic.item1")}
                  </p>
                  <p>{t("cabinetCare.guidelines.periodic.item2")}</p>
                  <p>{t("cabinetCare.guidelines.periodic.item3")}</p>
                  <p>{t("cabinetCare.guidelines.periodic.item4")}</p>
                </li>
              </ul>
              <div className="sms-highlight-box">
                <strong>{t("cabinetCare.guidelines.important")}</strong>
              </div>
              <div
                style={{
                  borderBottom: "2px solid rgba(255, 255, 255, 0.3)",
                  paddingBottom: "12px",
                  marginBottom: "12px",
                }}
              ></div>
            </Collapsible>

            <Collapsible title={t("cabinetCare.environment.title")}>
              <ul className=" sms-list">
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.environment.humidity.title")}</strong>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.environment.humidity.item1")}
                  </p>
                  <p>{t("cabinetCare.environment.humidity.item2")}</p>
                  <p>{t("cabinetCare.environment.humidity.item3")}</p>
                </li>
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.environment.sunlight.title")}</strong>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.environment.sunlight.item1")}
                  </p>
                  <p>{t("cabinetCare.environment.sunlight.item2")}</p>
                  <p>{t("cabinetCare.environment.sunlight.item3")}</p>
                </li>
                <li style={{ marginTop: "12px" }}>
                  <strong>
                    {t("cabinetCare.environment.temperature.title")}
                  </strong>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.environment.temperature.item1")}
                  </p>
                  <p>{t("cabinetCare.environment.temperature.item2")}</p>
                  <p>{t("cabinetCare.environment.temperature.item3")}</p>
                </li>
              </ul>
              <div className="sms-highlight-box">
                <strong>{t("cabinetCare.environment.important")}</strong>
              </div>
              <div
                style={{
                  borderBottom: "2px solid rgba(255, 255, 255, 0.3)",
                  paddingBottom: "12px",
                  marginBottom: "12px",
                }}
              ></div>
            </Collapsible>

            <Collapsible title={t("cabinetCare.cleaning.title")}>
              <p>{t("cabinetCare.cleaning.intro")}</p>
              <ul className="sms-list">
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.cleaning.routine.title")}</strong>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.cleaning.routine.item1")}
                  </p>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.cleaning.routine.item2")}
                  </p>
                </li>
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.cleaning.grease.title")}</strong>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.cleaning.grease.content")}{" "}
                    <strong>
                      {t("cabinetCare.cleaning.grease.recommendation")}
                    </strong>{" "}
                    {t("cabinetCare.cleaning.grease.aftercare")}
                  </p>
                </li>
              </ul>
              <p
                style={{
                  marginTop: "12px",
                  borderBottom: "2px solid rgba(255, 255, 255, 0.3)",
                  paddingBottom: "12px",
                  marginBottom: "12px",
                }}
              >
                {t("cabinetCare.cleaning.woodGrain")}
              </p>
            </Collapsible>

            <Collapsible title={t("cabinetCare.avoid.title")}>
              <p>{t("cabinetCare.avoid.intro")}</p>
              <ul className="sms-list">
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.avoid.harsh.title")}</strong>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.avoid.harsh.item1")}
                  </p>
                  <p>
                    {t("cabinetCare.avoid.harsh.item2")}{" "}
                    <strong>{t("cabinetCare.avoid.harsh.examples")}</strong>
                  </p>
                </li>
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.avoid.waxes.title")}</strong>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.avoid.waxes.item1")}
                  </p>
                  <p>{t("cabinetCare.avoid.waxes.item2")}</p>
                  <p>{t("cabinetCare.avoid.waxes.item3")}</p>
                  <p>
                    {t("cabinetCare.avoid.waxes.item4")}{" "}
                    <strong>{t("cabinetCare.avoid.waxes.examples")}</strong>
                  </p>
                </li>
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.avoid.abrasives.title")}</strong>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.avoid.abrasives.item1")}
                  </p>
                  <p>
                    {t("cabinetCare.avoid.abrasives.item2")}{" "}
                    <strong>{t("cabinetCare.avoid.abrasives.examples")}</strong>
                  </p>
                </li>
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.avoid.sponges.title")}</strong>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.avoid.sponges.item1")}{" "}
                    {t("cabinetCare.avoid.sponges.item2")}
                  </p>
                </li>
              </ul>
              <div
                style={{
                  marginTop: "12px",
                  borderBottom: "2px solid rgba(255, 255, 255, 0.3)",
                  paddingBottom: "12px",
                  marginBottom: "12px",
                }}
              ></div>
            </Collapsible>

            <Collapsible title={t("cabinetCare.specialty.title")}>
              <ul className="sms-list">
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.specialty.glass.title")}</strong>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.specialty.glass.item1")}
                  </p>
                  <p>
                    {t("cabinetCare.specialty.glass.item2")}{" "}
                    {t("cabinetCare.specialty.glass.item3")}
                  </p>
                </li>
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.specialty.maple.title")}</strong>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.specialty.maple.item1")}
                  </p>
                  <p>{t("cabinetCare.specialty.maple.item2")}</p>
                  <p>
                    {t("cabinetCare.specialty.maple.item3")}{" "}
                    {t("cabinetCare.specialty.maple.item4")}{" "}
                    <strong>{t("cabinetCare.specialty.maple.product")}</strong>
                  </p>
                  <p>{t("cabinetCare.specialty.maple.item5")}</p>
                </li>
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.specialty.bread.title")}</strong>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.specialty.bread.item1")}{" "}
                    {t("cabinetCare.specialty.bread.item2")}
                  </p>
                  <p>{t("cabinetCare.specialty.bread.item3")}</p>
                  <p>{t("cabinetCare.specialty.bread.item4")}</p>
                </li>
              </ul>
            </Collapsible>

            <Collapsible title={t("cabinetCare.warranty.title")}>
              <ul className="sms-list">
                <li
                  style={{
                    marginTop: "12px",
                    borderBottom: "2px solid rgba(255, 255, 255, 0.3)",
                    paddingBottom: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <strong>{t("cabinetCare.warranty.who.title")}</strong>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.warranty.who.item1")}{" "}
                    {t("cabinetCare.warranty.who.item2")}{" "}
                    <strong>
                      {t("cabinetCare.warranty.who.item3")}{" "}
                      {t("cabinetCare.warranty.who.item4")}
                    </strong>
                  </p>
                </li>
                <li
                  style={{
                    marginTop: "12px",
                    borderBottom: "2px solid rgba(255, 255, 255, 0.3)",
                    paddingBottom: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <strong>{t("cabinetCare.warranty.what.title")}</strong>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.warranty.what.item1")}{" "}
                    <strong>
                      {t("cabinetCare.warranty.what.company")}{" "}
                      {t("cabinetCare.warranty.what.item2")}
                    </strong>{" "}
                    {t("cabinetCare.warranty.what.item3")}
                  </p>
                </li>
                <li>
                  <strong>{t("cabinetCare.warranty.willDo.title")}</strong>
                  <p style={{ marginTop: "12px" }}>
                    <strong>{t("cabinetCare.warranty.willDo.item1")}</strong>{" "}
                    {t("cabinetCare.warranty.willDo.item2")}{" "}
                    {t("cabinetCare.warranty.willDo.item3")}
                  </p>
                </li>
              </ul>
              <div
                style={{
                  marginTop: "12px",
                  borderBottom: "2px solid rgba(255, 255, 255, 0.3)",
                  paddingBottom: "12px",
                  marginBottom: "12px",
                }}
              ></div>
            </Collapsible>

            <Collapsible title={t("cabinetCare.lifetime.title")}>
              <ul className="sms-list">
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.lifetime.effect.title")}</strong>
                </li>
                <p style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.lifetime.effect.item1")}</strong>{" "}
                  {t("cabinetCare.lifetime.effect.item2")}{" "}
                  {t("cabinetCare.lifetime.effect.item3")}{" "}
                  {t("cabinetCare.lifetime.effect.item4")}{" "}
                  {t("cabinetCare.lifetime.effect.item5")}{" "}
                  {t("cabinetCare.lifetime.effect.item6")}{" "}
                  {t("cabinetCare.lifetime.effect.item7")}
                </p>
              </ul>
              <div
                style={{
                  marginTop: "12px",
                  borderBottom: "2px solid rgba(255, 255, 255, 0.3)",
                  paddingBottom: "12px",
                  marginBottom: "12px",
                }}
              ></div>
            </Collapsible>

            <Collapsible title={t("cabinetCare.notCovered.title")}>
              <ul className="sms-list">
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.notCovered.hairline.title")}</strong>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.notCovered.hairline.item1")}{" "}
                    {t("cabinetCare.notCovered.hairline.item2")}{" "}
                    {t("cabinetCare.notCovered.hairline.item3")}
                  </p>
                </li>
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.notCovered.mellowing.title")}</strong>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.notCovered.mellowing.item1")}{" "}
                    {t("cabinetCare.notCovered.mellowing.item2")}
                  </p>
                </li>
                <li style={{ marginTop: "12px" }}>
                  <strong>
                    {t("cabinetCare.notCovered.installation.title")}
                  </strong>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.notCovered.installation.item1")}{" "}
                    {t("cabinetCare.notCovered.installation.item2")}{" "}
                    {t("cabinetCare.notCovered.installation.item3")}
                  </p>
                  <p>
                    {t("cabinetCare.notCovered.installation.item4")}{" "}
                    {t("cabinetCare.notCovered.installation.item5")}
                  </p>
                </li>
              </ul>
              <div
                style={{
                  marginTop: "12px",
                  borderBottom: "2px solid rgba(255, 255, 255, 0.3)",
                  paddingBottom: "12px",
                  marginBottom: "12px",
                }}
              ></div>
            </Collapsible>

            <Collapsible title={t("cabinetCare.void.title")}>
              <p style={{ marginTop: "12px" }}>
                {t("cabinetCare.void.intro1")} {t("cabinetCare.void.intro2")}{" "}
                {t("cabinetCare.void.intro3")}
              </p>
              <ul className="sms-list">
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.void.water.title")}</strong>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.void.water.item1")}{" "}
                    {t("cabinetCare.void.water.item2")}
                  </p>
                </li>
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.void.chips.title")}</strong>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.void.chips.item1")}{" "}
                    {t("cabinetCare.void.chips.item2")}
                  </p>
                </li>
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.void.modifications.title")}</strong>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.void.modifications.item1")}{" "}
                    {t("cabinetCare.void.modifications.item2")}
                  </p>
                </li>
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.void.storage.title")}</strong>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.void.storage.item1")}{" "}
                    {t("cabinetCare.void.storage.item2")}
                  </p>
                </li>
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.void.appliance.title")}</strong>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.void.appliance.item1")}{" "}
                    {t("cabinetCare.void.appliance.item2")}
                  </p>
                </li>
              </ul>
              <div
                style={{
                  marginTop: "12px",
                  borderBottom: "2px solid rgba(255, 255, 255, 0.3)",
                  paddingBottom: "12px",
                  marginBottom: "12px",
                }}
              ></div>
            </Collapsible>

            <Collapsible title={t("cabinetCare.exceptions.title")}>
              <ul className="sms-list">
                <li style={{ marginTop: "12px" }}>
                  <strong>
                    {t("cabinetCare.exceptions.electronic.title")}
                  </strong>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.exceptions.electronic.item1")}{" "}
                    {t("cabinetCare.exceptions.electronic.item2")}
                  </p>
                </li>
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.exceptions.specialty.title")}</strong>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.exceptions.specialty.item1")}{" "}
                    {t("cabinetCare.exceptions.specialty.item2")}
                  </p>
                </li>
                <li style={{ marginTop: "12px" }}>
                  <strong>{t("cabinetCare.exceptions.products.title")}</strong>
                  <p style={{ marginTop: "12px" }}>
                    {t("cabinetCare.exceptions.products.item1")}{" "}
                    {t("cabinetCare.exceptions.products.item2")}
                  </p>
                </li>
              </ul>
            </Collapsible>

            {/* Download Button at Bottom */}
            <div className="feature-button" style={{ textAlign: "center", marginTop: "3rem" }}>
              <button
                onClick={handleDownload}
                className="cta-button"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <Download size={24} />
                Download Complete Guide (PDF)
              </button>
            </div>
          </div>
        </div>
        <div style={{ height: "2vh" }}></div>
      </div>
      <Footer />
    </>
  );
};

export default CabinetCare;
