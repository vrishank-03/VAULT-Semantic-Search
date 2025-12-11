// frontend/src/components/SignatureAnimation.js
// [VISUAL] "Orbital Core" - Now perfectly aligned to Top-Left Logo (128px, 128px)
// [LOGIC] Logic adjusted to lock orbit around the brand asset.

import React, { useRef, useEffect } from 'react';

const SignatureAnimation = () => {
    const canvasRef = useRef(null);

    useEffect(() => {
        console.log('[SignatureAnimation] Initializing canvas context...');
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let animationFrameId;

        // --- CONFIGURATION ---
        const BG_COLOR = '#050505';
        const NODE_COLOR = 'rgba(255, 255, 255, 0.55)';
        const ACCENT_COLOR = 'rgba(6, 182, 212, 1)'; // Cyan-500
        const LINK_COLOR = 'rgba(100, 116, 139, 0.2)';

        // Increased particle count slightly for denser "constellation" effect around logo
        const PARTICLE_COUNT = 180;
        const CONNECTION_DIST = 110;

        let width, height;
        let particles = [];
        let mouseX = 0;
        let mouseY = 0;

        // 3D Point Generator
        const createParticle = (i, total) => {
            const phi = Math.acos(1 - 2 * (i + 0.5) / total);
            const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
            // Increased radius variance to fill the screen better from the corner
            const r = 250 + Math.random() * 150;

            return {
                x: r * Math.sin(phi) * Math.cos(theta),
                y: r * Math.sin(phi) * Math.sin(theta),
                z: r * Math.cos(phi),
                // Store base positions for potential reset/interaction logic
                baseX: r * Math.sin(phi) * Math.cos(theta),
                baseY: r * Math.sin(phi) * Math.sin(theta),
                baseZ: r * Math.cos(phi),
                size: Math.random() * 2 + 0.5,
                color: Math.random() > 0.85 ? ACCENT_COLOR : NODE_COLOR
            };
        };

        const init = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            particles = [];
            const count = width < 768 ? 80 : PARTICLE_COUNT;

            console.log(`[SignatureAnimation] Resized. Width: ${width}, Particles: ${count}`);

            for (let i = 0; i < count; i++) {
                particles.push(createParticle(i, count));
            }
        };

        let rotationX = 0;
        let rotationY = 0;

        const render = () => {
            ctx.fillStyle = BG_COLOR;
            ctx.fillRect(0, 0, width, height);

            // [CRITICAL FIX] Anchor Point Calculation
            // Logo is at Top: 4rem (64px) + Left: 4rem (64px).
            // Logo size is w-32 (128px).
            // Center of Logo = 64px (margin) + 64px (half-size) = 128px.

            const isDesktop = width >= 1024;
            const cx = isDesktop ? 128 : width / 2;
            const cy = isDesktop ? 128 : height * 0.35;

            // Mouse Interaction (Subtle Parallax)
            // Damped sensitivity to keep it elegant
            const targetRotX = (mouseY - cy) * 0.0001;
            const targetRotY = (mouseX - cx) * 0.0001;

            rotationX += (targetRotX - rotationX) * 0.05;
            rotationY += (targetRotY - rotationY) * 0.05;

            const idleSpeed = 0.0008; // Slower, more majestic rotation

            ctx.lineWidth = 0.8;

            particles.forEach((p) => {
                // Rotation Math
                let x1 = p.x * Math.cos(rotationY + idleSpeed) - p.z * Math.sin(rotationY + idleSpeed);
                let z1 = p.z * Math.cos(rotationY + idleSpeed) + p.x * Math.sin(rotationY + idleSpeed);
                let y1 = p.y * Math.cos(rotationX) - z1 * Math.sin(rotationX);
                let z2 = z1 * Math.cos(rotationX) + p.y * Math.sin(rotationX);

                // Projection
                // Adjusted fov (800 -> 900) for less distortion at edges
                const scale = 900 / (900 + z2);
                const px = cx + x1 * scale;
                const py = cy + y1 * scale;

                p.px = px;
                p.py = py;
                p.scale = scale;

                // Draw Node
                const alpha = Math.max(0.05, (scale - 0.4));
                ctx.beginPath();
                ctx.arc(px, py, p.size * scale, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = alpha;
                ctx.fill();
                ctx.globalAlpha = 1;
            });

            // Draw Connections
            ctx.strokeStyle = LINK_COLOR;
            for (let i = 0; i < particles.length; i++) {
                const p1 = particles[i];
                // Connect neighbors
                for (let j = 1; j <= 8; j++) {
                    const p2 = particles[(i + j) % particles.length];
                    const dx = p1.px - p2.px;
                    const dy = p1.py - p2.py;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < CONNECTION_DIST) {
                        const alpha = (1 - dist / CONNECTION_DIST) * 0.3 * p1.scale;
                        ctx.beginPath();
                        ctx.moveTo(p1.px, p1.py);
                        ctx.lineTo(p2.px, p2.py);
                        ctx.globalAlpha = alpha;
                        ctx.stroke();
                        ctx.globalAlpha = 1;
                    }
                }
            }

            animationFrameId = requestAnimationFrame(render);
        };

        const handleResize = () => init();
        const handleMouseMove = (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('mousemove', handleMouseMove);

        init();
        render();

        return () => {
            console.log('[SignatureAnimation] Cleaning up...');
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return <canvas ref={canvasRef} className="absolute inset-0 z-0" />;
};

export default SignatureAnimation;