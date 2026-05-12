import React, { useState, useCallback } from 'react'
import StepWelcome from '../components/onboarding/StepWelcome'
import StepPermissions from '../components/onboarding/StepPermissions'
import StepTestRecording from '../components/onboarding/StepTestRecording'
import StepReady from '../components/onboarding/StepReady'

const STEPS = [StepWelcome, StepPermissions, StepTestRecording, StepReady]

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0)
  const [fading, setFading] = useState(false)

  const goToStep = useCallback((next) => {
    setFading(true)
    setTimeout(() => {
      setStep(next)
      setFading(false)
    }, 200)
  }, [])

  const handleNext = useCallback(() => {
    if (step < STEPS.length - 1) goToStep(step + 1)
  }, [step, goToStep])

  const StepComponent = STEPS[step]

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center select-none"
      style={{ background: '#0f0f0f' }}
    >
      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-10">
        {STEPS.map((_, i) => (
          <div
            key={i}
            style={{
              height: 7,
              width: i === step ? 22 : 7,
              borderRadius: 4,
              background: i < step
                ? '#3b82f6'
                : i === step
                ? '#3b82f6'
                : 'rgba(255,255,255,0.12)',
              opacity: i < step ? 0.45 : 1,
              transition: 'width 300ms ease, background 300ms, opacity 300ms'
            }}
          />
        ))}
      </div>

      {/* Step card */}
      <div
        style={{
          width: '100%',
          maxWidth: 500,
          padding: '0 28px',
          opacity: fading ? 0 : 1,
          transform: fading ? 'translateY(10px)' : 'translateY(0)',
          transition: 'opacity 200ms ease, transform 200ms ease'
        }}
      >
        <StepComponent
          onNext={handleNext}
          onComplete={onComplete}
        />
      </div>

      {/* Step counter */}
      <p className="mt-10 text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
        {step + 1} of {STEPS.length}
      </p>
    </div>
  )
}
