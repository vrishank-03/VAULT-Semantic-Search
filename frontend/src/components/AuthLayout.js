// frontend/src/components/AuthLayout.js
// [VISUAL] "DeepMind" Aesthetic Refactor
// [CHANGE] Replaced static grey with 'SignatureAnimation', Cinematic Vignettes, and Glassmorphism.

import React from 'react';
import ThemeToggleButton from './ThemeToggleButton';
import SignatureAnimation from './SignatureAnimation'; // The "Neural Core" you added

const AuthLayout = ({ children }) => {
    return (
        // BASE: Ultra-dark Zinc (#050505) for high contrast OLED-like feel
        <div className="relative min-h-screen w-full bg-[#050505] flex items-center justify-center overflow-hidden font-inter text-zinc-100 selection:bg-blue-500 selection:text-white">

            {/* --- TOP RIGHT: Theme Toggle --- */}
            {/* Uses mix-blend-mode to remain visible against any background */}
            <div className="fixed top-6 right-6 z-50 opacity-80 hover:opacity-100 transition-opacity">
                <ThemeToggleButton />
            </div>

            {/* --- LAYER 0: The Living Core --- */}
            {/* We lower opacity slightly so it doesn't fight with the text */}
            <div className="fixed inset-0 z-0 opacity-100">
                <SignatureAnimation />
            </div>

            {/* --- LAYER 1: Cinematic Vignette --- */}
            {/* This creates the "Spotlight" effect, fading edges to pure black */}
            <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,#050505_85%)] pointer-events-none" />

            {/* --- LAYER 2: Tech Grid Overlay --- */}
            {/* Very subtle white grid to give it that "Blueprint/Architect" vibe */}
            <div
                className="fixed inset-0 z-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
                    backgroundSize: '50px 50px'
                }}
            />

            {/* --- LAYER 3: The "Monolith" Content Box --- */}
            <div className="relative z-10 w-full max-w-md px-4 perspective-1000">
                {/* Glassmorphism Card */}
                <div className="relative group bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] overflow-hidden transition-all duration-500 hover:border-white/10 hover:shadow-[0_0_80px_-20px_rgba(59,130,246,0.15)]">

                    {/* Top 'Laser' Highlight */}
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/60 to-transparent opacity-80" />

                    {/* Inner Content Wrapper */}
                    {/* We strip default paddings so children control their own spacing */}
                    <div className="relative p-1">
                        {children}
                    </div>

                    {/* Bottom Reflection */}
                    <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-30" />
                </div>

                {/* Footer Branding */}
                <div className="mt-8 text-center animate-fade-in-up">
                    <p className="text-zinc-600 text-[10px] tracking-[0.3em] uppercase font-bold hover:text-zinc-400 transition-colors cursor-default">
                        Secured by Vault
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AuthLayout;