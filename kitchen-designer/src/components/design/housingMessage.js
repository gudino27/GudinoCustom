import { getElementName } from './elementName';
import { formatInchesPlain } from '../../utils/designer/planUnits';

// Inches as a fraction to 1/16 ("33 1/4"); the message says "in"
const inches = (n) => formatInchesPlain(n);

/**
 * Why a change to a refrigerator cabinet was declined, in words: `problem`
 * is what utils/designer/housing.js housingChangeProblem returned.
 */
export const housingProblemText = (t, problem, elementTypes) => {
  if (!problem) return '';
  const item = getElementName(t, problem.item.type, elementTypes);
  if (problem.reason === 'width') {
    return t('designer.notice.housingTooNarrow', {
      item,
      need: inches(problem.need),
      open: inches(problem.open),
      current: inches(problem.current),
    });
  }
  if (problem.reason === 'height') {
    return t('designer.notice.housingTooLow', {
      item,
      need: inches(problem.need),
      open: inches(problem.open),
      current: inches(problem.current),
    });
  }
  return t('designer.notice.housingNoFit', { item });
};
