import React, { useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';

// headingLevel renders the title inside a real heading so policy pages have an
// outline (WCAG 1.3.1). Sections are h2 by default; nested ones pass 3.
const Collapsible = ({ title, children, defaultOpen = false, headingLevel = 2 }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = `collapsible-content-${useId()}`;
  const Heading = `h${Math.min(Math.max(headingLevel, 1), 6)}`;

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="collapsible">
      <Heading className="collapsible-heading">
        <button
          className="collapsible-header"
          type="button"
          onClick={toggleOpen}
          aria-expanded={isOpen}
          aria-controls={contentId}
        >
          <span className="collapsible-title sms-section-header text-center">
            {title}
          </span>
          <ChevronRight
            className={`collapsible-caret ${isOpen ? 'open' : ''}`}
            size={20}
            aria-hidden="true"
          />
        </button>
      </Heading>
      {/* Closed sections stay in the page, hidden, rather than unmounted:
          `hidden` keeps them out of sight and out of the accessibility tree
          exactly as before, while search engines and AI assistants that read
          the rendered page still find the text (Cabinet Care, Why Choose Us,
          the policies). */}
      <div id={contentId} className="collapsible-content" hidden={!isOpen}>
        {children}
      </div>
    </div>
  );
};

export default Collapsible;
