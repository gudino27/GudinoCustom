import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import './palette.css';

/**
 * Where a palette item being dragged will land on the floor plan: a green
 * dashed footprint when it can go there, red when it is blocked. Drawn over
 * the plan (absolutely positioned inside the plan container) and never takes
 * pointer events. The live region carries the result for screen readers.
 */
const PlanDropPreview = ({ preview }) => {
  const { t } = useLanguage();
  if (!preview) return null;
  const { box, allowed, reason, name } = preview;
  const status = allowed
    ? t('designer.palette.dropHere')
    : reason === 'door'
      ? t('designer.palette.blockedDoor')
      : reason === 'wall'
        ? t('designer.palette.blockedWall')
        : t('designer.palette.blockedOverlap');
  const labelBelow = box.top < 28;
  return (
    <div
      aria-hidden="true"
      className={`kd-drop-preview ${allowed ? 'kd-drop-preview--ok' : 'kd-drop-preview--blocked'}`}
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
    >
      <div className="kd-drop-box" />
      <div
        className="kd-drop-label"
        style={labelBelow ? { top: '100%', marginTop: 4 } : { bottom: '100%', marginBottom: 4 }}
      >
        {name} · {status}
      </div>
    </div>
  );
};

export default PlanDropPreview;
