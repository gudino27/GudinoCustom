import React, { useRef, useState } from "react";
import { Home, Bath } from "lucide-react";
import MainNavBar from "../ui/Navigation";
import { useLanguage } from "../../contexts/LanguageContext";
import DesignerOrContactChoice from "../ui/DesignerOrContactChoice";
import Footer from "../ui/Footer";
import { announce } from "../ui/LiveRegion";
import { DIMENSION_LIMITS } from "../../hooks/designer/useRoomManagement";
import { fitPlanScale } from "../../utils/designer/roomScale";
import InchInput from "./InchInput";

const DimensionsSetup = ({
  activeRoom,
  switchRoom,
  currentRoomData,
  setCurrentRoomData,
  handleDimensionsSubmit,
  kitchenData,
  bathroomData,
}) => {
  const { t } = useLanguage();

  const [mobileView, setMobileView] = useState("form"); // 'form' or 'choice'
  const [errors, setErrors] = useState({});
  const fieldRefs = {
    width: useRef(null),
    height: useRef(null),
    wallHeight: useRef(null),
  };

  const fieldLabels = {
    width: t("designer.roomWidth"),
    height: t("designer.roomDepth"),
    wallHeight: t("designer.wallHeight"),
  };
  const fieldUnits = {
    width: t("designer.unit.ft"),
    height: t("designer.unit.ft"),
    wallHeight: t("designer.unit.in"),
  };

  const rangeHint = (field) =>
    t("designer.hint.range", {
      min: DIMENSION_LIMITS[field].min,
      max: DIMENSION_LIMITS[field].max,
      unit: fieldUnits[field],
    });

  const errorMessage = (field) => {
    if (!errors[field]) return null;
    if (errors[field] === "required") {
      return t("designer.error.required", { field: fieldLabels[field] });
    }
    return t("designer.error.range", {
      field: fieldLabels[field],
      min: DIMENSION_LIMITS[field].min,
      max: DIMENSION_LIMITS[field].max,
      unit: fieldUnits[field],
    });
  };

  // Each box also points at how to type it: feet (12' 6") or inches (96 1/2)
  const describedBy = (field) =>
    `${errors[field] ? `kd-${field}-error ` : ""}kd-${field}-hint ${
      field === "wallHeight" ? "kd-inches-format-hint" : "kd-feet-format-hint"
    }`;

  // Validate, then show, announce and focus the first problem (WCAG 3.3.1)
  const onSubmit = () => {
    const result = handleDimensionsSubmit();
    if (result && result.ok === false) {
      setErrors(result.errors);
      const firstField = ["width", "height", "wallHeight"].find(
        (field) => result.errors[field]
      );
      announce(t("designer.error.dimensionsRequired"));
      if (firstField && fieldRefs[firstField].current) {
        fieldRefs[firstField].current.focus();
      }
      return;
    }
    setErrors({});
  };

  // `rawValue`: a number from the length box, or "" when it is cleared
  const updateDimension = (field, rawValue) => {
    const val = rawValue === "" ? "" : Number(rawValue);
    setCurrentRoomData({
      ...currentRoomData,
      // the scale the saved plan px were drawn at, before the size changes
      // (the design step moves them to the new one: roomAtScale)
      planScale:
        currentRoomData.planScale ?? fitPlanScale(currentRoomData.dimensions),
      dimensions: {
        ...currentRoomData.dimensions,
        [field]: val,
      },
    });
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  return (
    <>
      <MainNavBar />
      <main
        id="main-content"
        tabIndex={-1}
        className="min-h-screen p-8 focus:outline-none"
        style={{ background: "rgb(110,110,110)" }}
      >
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-6">
          {/* Mobile switch - only visible on small screens */}
          <div className="w-full md:hidden mb-2">
            <div className="flex rounded-lg overflow-hidden bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setMobileView("form")}
                aria-pressed={mobileView === "form"}
                className={`flex-1 py-3 text-sm font-semibold text-center ${
                  mobileView === "form"
                    ? "bg-blue-700 text-white"
                    : "bg-transparent text-gray-700"
                }`}
              >
                {t("designer.tabDesigner")}
              </button>
              <button
                type="button"
                onClick={() => setMobileView("choice")}
                aria-pressed={mobileView === "choice"}
                className={`flex-1 py-3 text-sm font-semibold text-center ${
                  mobileView === "choice"
                    ? "bg-green-700 text-white"
                    : "bg-transparent text-gray-700"
                }`}
              >
                {t("designer.tabQuickForm")}
              </button>
            </div>
          </div>

          <div
            className={`md:w-1/2 w-full flex ${
              mobileView === "choice" ? "hidden md:flex" : ""
            }`}
          >
            <div className="relative bg-white rounded-2xl shadow-xl p-8 flex-1 border-2 border-blue-200 flex flex-col">
              {/* Most Popular Badge */}
              <div className="absolute top-4 right-4 bg-blue-700 text-white text-xs font-bold px-3 py-1 rounded-full">
                {t("designer.badge")}
              </div>

              {/* Application header and branding */}
              <h1 className="text-4xl font-bold text-gray-800 mb-2 text-center">
                {t("designer.setupHeading")}
              </h1>
              <p className="text-gray-700 mb-8 text-center">
                {t("designer.designYourRoom", {
                  room:
                    activeRoom === "kitchen"
                      ? t("designer.kitchen")
                      : t("designer.bathroom"),
                })}
              </p>
              <div className="space-y-6 flex-1">
                {/* Room Type Selection */}
                {/* Toggle between kitchen and bathroom design modes */}
                <fieldset className="min-w-0">
                  <legend className="block text-sm font-semibold text-gray-700 mb-2">
                    {t("designer.roomType")}
                  </legend>
                  <div className="flex gap-4">
                    {/* Kitchen selection button */}
                    <button
                      type="button"
                      onClick={() => switchRoom("kitchen")}
                      aria-pressed={activeRoom === "kitchen"}
                      className={`flex-1 p-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                        activeRoom === "kitchen"
                          ? "border-blue-700 bg-blue-50 text-blue-800"
                          : "border-gray-500 hover:border-gray-600"
                      }`}
                    >
                      <Home size={20} />
                      {t("designer.kitchen")}
                    </button>
                    {/* Bathroom selection button */}
                    <button
                      type="button"
                      onClick={() => switchRoom("bathroom")}
                      aria-pressed={activeRoom === "bathroom"}
                      className={`flex-1 p-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                        activeRoom === "bathroom"
                          ? "border-blue-700 bg-blue-50 text-blue-800"
                          : "border-gray-500 hover:border-gray-600"
                      }`}
                    >
                      <Bath size={20} />
                      {t("designer.bathroom")}
                    </button>
                  </div>
                </fieldset>
                {/* Room Dimensions Input */}
                {/* Grid layout for width and depth input fields */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Room width input */}
                  <div>
                    <label
                      htmlFor="kd-room-width"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      {fieldLabels.width}
                    </label>
                    <InchInput
                      id="kd-room-width"
                      ref={fieldRefs.width}
                      unit="ft"
                      live
                      enforceRange={false}
                      value={currentRoomData.dimensions.width}
                      onCommit={(v) => updateDimension("width", v)}
                      onEmpty={() => updateDimension("width", "")}
                      className="w-full p-4 border-2 border-gray-500 rounded-xl focus:border-blue-700 focus:ring-2 focus:ring-blue-200 transition-all"
                      placeholder="12"
                      invalid={!!errors.width}
                      describedBy={describedBy("width")}
                    />
                    <p id="kd-width-hint" className="text-xs text-gray-700 mt-1">
                      {rangeHint("width")}
                    </p>
                    {errors.width && (
                      <p id="kd-width-error" className="text-sm text-red-700 mt-1">
                        {errorMessage("width")}
                      </p>
                    )}
                  </div>
                  {/* Room depth input */}
                  <div>
                    <label
                      htmlFor="kd-room-depth"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      {fieldLabels.height}
                    </label>
                    <InchInput
                      id="kd-room-depth"
                      ref={fieldRefs.height}
                      unit="ft"
                      live
                      enforceRange={false}
                      value={currentRoomData.dimensions.height}
                      onCommit={(v) => updateDimension("height", v)}
                      onEmpty={() => updateDimension("height", "")}
                      className="w-full p-4 border-2 border-gray-500 rounded-xl focus:border-blue-700 focus:ring-2 focus:ring-blue-200 transition-all"
                      placeholder="10"
                      invalid={!!errors.height}
                      describedBy={describedBy("height")}
                    />
                    <p id="kd-height-hint" className="text-xs text-gray-700 mt-1">
                      {rangeHint("height")}
                    </p>
                    {errors.height && (
                      <p id="kd-height-error" className="text-sm text-red-700 mt-1">
                        {errorMessage("height")}
                      </p>
                    )}
                  </div>
                </div>
                <p id="kd-feet-format-hint" className="text-xs text-gray-700">
                  {t("designer.hint.feetInches")}
                </p>
                {/* Wall height input */}
                {/* Single input for ceiling/wall height measurement */}
                <div>
                  <label
                    htmlFor="kd-wall-height"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    {fieldLabels.wallHeight}
                  </label>
                  <InchInput
                    id="kd-wall-height"
                    ref={fieldRefs.wallHeight}
                    live
                    enforceRange={false}
                    value={currentRoomData.dimensions.wallHeight}
                    onCommit={(v) => updateDimension("wallHeight", v)}
                    onEmpty={() => updateDimension("wallHeight", "")}
                    className="w-full p-4 border-2 border-gray-500 rounded-xl focus:border-blue-700 focus:ring-2 focus:ring-blue-200 transition-all"
                    placeholder="96"
                    invalid={!!errors.wallHeight}
                    describedBy={describedBy("wallHeight")}
                  />
                  <p id="kd-wallHeight-hint" className="text-xs text-gray-700 mt-1">
                    {rangeHint("wallHeight")}
                  </p>
                  <p id="kd-inches-format-hint" className="text-xs text-gray-700 mt-1">
                    {t("designer.hint.fraction")}
                  </p>
                  {errors.wallHeight && (
                    <p id="kd-wallHeight-error" className="text-sm text-red-700 mt-1">
                      {errorMessage("wallHeight")}
                    </p>
                  )}
                </div>
                {/* Submit button to proceed to design interface */}
                <button
                  type="button"
                  onClick={onSubmit}
                  className="w-full bg-gradient-to-r from-blue-700 to-indigo-700 text-white font-bold py-4 px-8 rounded-xl hover:from-blue-800 hover:to-indigo-800 transform hover:scale-[1.02] transition-all duration-200 shadow-lg"
                >
                  {t("designer.startDesigning")}
                </button>

                {/* Show existing design status */}

                {/* Display current progress if user has existing designs */}
                <div className="text-center text-sm text-gray-700">
                  {kitchenData.elements.length > 0 && (
                    <p>
                      {t("designer.kitchenInProgress", {
                        count: kitchenData.elements.length,
                      })}
                    </p>
                  )}
                  {bathroomData.elements.length > 0 && (
                    <p>
                      {t("designer.bathroomInProgress", {
                        count: bathroomData.elements.length,
                      })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div
            className={`${
              mobileView === "form" ? "hidden md:flex" : "flex"
            } md:w-1/2 w-full`}
          >
            <DesignerOrContactChoice className="flex-1" />
          </div>

        </div>
      </main>
      <Footer/>

    </>
  );
};

export default DimensionsSetup;
