import React from 'react'

function FeatureRow({ icon, title, desc }) {
  return (
    <div className="flex items-start gap-4 py-3.5">
      <div
        className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg"
        style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.18)' }}
      >
        {icon}
      </div>
      <div className="text-left">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
    </div>
  )
}

export default function StepWelcome({ onNext }) {
  return (
    <div className="flex flex-col items-center text-center">
      {/* Logo mark */}
      <div
        className="flex items-center justify-center mb-6"
        style={{ width: 80, height: 80, borderRadius: 20, background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect x="2" y="2" width="36" height="36" rx="9" fill="rgba(255,255,255,0.06)" />
          <text x="20" y="27" textAnchor="middle" fill="white" fontSize="16" fontWeight="700" fontFamily="system-ui, -apple-system, sans-serif">RQ</text>
        </svg>
      </div>

      <h1 className="text-[28px] font-semibold text-white mb-2 tracking-tight">Welcome to RecordQA</h1>
      <p className="text-gray-400 text-[15px] mb-8 leading-relaxed">
        Screen recordings your team will actually act on
      </p>

      {/* Feature rows */}
      <div
        className="w-full rounded-xl mb-8 divide-y"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          '--tw-divide-opacity': 1,
          borderColor: 'rgba(255,255,255,0.07)'
        }}
      >
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }} className="px-4">
          <FeatureRow
            icon={
              <svg width="18" height="18" fill="none" stroke="#3b82f6" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zm-7.518-.267A8.25 8.25 0 1120.25 10.5M8.288 14.212A5.25 5.25 0 1117.25 10.5" />
              </svg>
            }
            title="Click highlighting"
            desc="Developers see exactly what button you clicked"
          />
        </div>
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }} className="px-4">
          <FeatureRow
            icon={
              <svg width="18" height="18" fill="none" stroke="#3b82f6" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
              </svg>
            }
            title="Keystroke overlay"
            desc="Every shortcut shown visually, automatically"
          />
        </div>
        <div className="px-4">
          <FeatureRow
            icon={
              <svg width="18" height="18" fill="none" stroke="#3b82f6" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
              </svg>
            }
            title="Auto zoom"
            desc="Smart zoom follows your clicks"
          />
        </div>
      </div>

      <button
        onClick={onNext}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
        style={{ height: 48, fontSize: 15 }}
      >
        Get Started
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </button>
    </div>
  )
}
