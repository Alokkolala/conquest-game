'use client'

import { useState } from 'react'

export default function ProModal() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-3 py-1 border border-[#c8a96e] text-[#c8a96e] hover:bg-[#c8a96e] hover:text-black rounded font-semibold transition-colors"
      >
        Upgrade to Pro
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-neutral-900 border border-neutral-700 rounded-lg p-8 max-w-sm w-full mx-4 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="font-cinzel text-xl font-bold text-[#c8a96e]">Conquest Pro</h2>
            <ul className="text-sm text-neutral-300 space-y-2">
              <li>✦ Custom territory themes</li>
              <li>✦ Exclusive piece skins</li>
              <li>✦ Priority matchmaking</li>
              <li>✦ Extended AI coaching</li>
            </ul>
            <p className="text-xs text-neutral-500">Coming soon — join the waitlist</p>
            <button
              onClick={() => setOpen(false)}
              className="w-full py-2 bg-[#c8a96e] hover:bg-[#b8995e] text-black font-semibold rounded text-sm transition-colors"
            >
              Notify Me
            </button>
          </div>
        </div>
      )}
    </>
  )
}
