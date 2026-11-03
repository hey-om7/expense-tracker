import React from 'react';

const FeatureCard = ({ step, stepIndex, totalSteps, onNext, onSkip, onDone }) => {
  const isLastStep = stepIndex === totalSteps - 1;

  return (
    <div className="feature-card-container">
      <div className="feature-card">
        {/* Step indicator dots */}
        <div className="feature-card__dots">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              className={`feature-card__dot ${i === stepIndex ? 'feature-card__dot--active' : ''} ${i < stepIndex ? 'feature-card__dot--done' : ''}`}
            />
          ))}
        </div>

        {/* Icon + Title */}
        <div className="feature-card__header">
          <div className="feature-card__icon-wrap">
            <span className="material-symbols-outlined feature-card__icon">{step.icon}</span>
          </div>
          <h3 className="feature-card__title">{step.title}</h3>
        </div>

        {/* Description */}
        <p className="feature-card__desc">{step.description}</p>

        {/* Actions */}
        <div className="feature-card__actions">
          <button
            onClick={onSkip}
            className="feature-card__btn feature-card__btn--skip"
          >
            Skip
          </button>
          {isLastStep ? (
            <button
              onClick={onDone}
              className="feature-card__btn feature-card__btn--done"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
              Done
            </button>
          ) : (
            <button
              onClick={onNext}
              className="feature-card__btn feature-card__btn--next"
            >
              Next
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
            </button>
          )}
        </div>

        {/* Step counter text */}
        <p className="feature-card__counter">
          {stepIndex + 1} of {totalSteps}
        </p>
      </div>
    </div>
  );
};

export default FeatureCard;
