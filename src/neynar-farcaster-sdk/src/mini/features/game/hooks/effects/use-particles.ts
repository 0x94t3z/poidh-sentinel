"use client";

import { useState, useRef } from "react";
import { useGameLoop } from "../initialization/use-game-loop";

export type Particle = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
};

export type EmitConfig = {
  x: number;
  y: number;
  count?: number;
  colors?: string[];
  speed?: number;
  spread?: number;
  gravity?: number;
  life?: number;
  angle?: number; // Base angle in degrees (default: -90 for upward)
};

/**
 * Particle emitter hook for visual effects
 *
 * Creates particles for confetti, explosions, sparkles, etc.
 * Particles move based on velocity and gravity, fading out over time.
 *
 * @returns Object with particles array, emit function, and clear function
 *
 * @example
 * ```typescript
 * const { particles, emit } = useParticles();
 *
 * // Player scores
 * emit({
 *   x: playerX,
 *   y: playerY,
 *   count: 30,
 *   colors: ['#FFD700', '#FFA500'],
 *   spread: 180, // Upward cone
 * });
 *
 * // Render particles
 * {particles.map(p => (
 *   <div
 *     key={p.id}
 *     style={{
 *       position: 'absolute',
 *       left: p.x,
 *       top: p.y,
 *       width: p.size,
 *       height: p.size,
 *       backgroundColor: p.color,
 *       opacity: p.life,
 *       borderRadius: '50%',
 *     }}
 *   />
 * ))}
 * ```
 */
export function useParticles() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const nextIdRef = useRef(0);

  useGameLoop((deltaTime) => {
    setParticles((prev) => {
      if (prev.length === 0) return prev;

      return prev
        .map((particle) => {
          const dt = deltaTime / 1000; // Convert to seconds

          // Update position
          const x = particle.x + particle.vx * dt;
          const y = particle.y + particle.vy * dt;

          // Apply gravity
          const gravity = 200; // pixels per second squared
          const vy = particle.vy + gravity * dt;

          // Decrease life (1.0 to 0.0 over lifespan)
          const life = Math.max(0, particle.life - dt);

          return {
            ...particle,
            x,
            y,
            vy,
            life,
          };
        })
        .filter((p) => p.life > 0);
    });
  }, 60);

  const emit = (config: EmitConfig) => {
    const {
      x,
      y,
      count = 20,
      colors = ["#FFD700", "#FFA500", "#FF6347"],
      speed = 200, // pixels per second
      spread = 360,
      life = 1,
      angle = -90, // Default upward
    } = config;

    const newParticles: Particle[] = [];

    for (let i = 0; i < count; i++) {
      // Random angle within spread, centered on base angle
      const baseAngleRad = angle * (Math.PI / 180);
      const spreadRad = spread * (Math.PI / 180);
      const randomAngle = baseAngleRad + (Math.random() - 0.5) * spreadRad;

      // Random speed variation (pixels per second)
      const particleSpeed = speed * (0.7 + Math.random() * 0.6);

      // Calculate velocity (pixels per second)
      const vx = Math.cos(randomAngle) * particleSpeed;
      const vy = Math.sin(randomAngle) * particleSpeed;

      // Random color from palette
      const color = colors[Math.floor(Math.random() * colors.length)];

      // Random size
      const size = 6 + Math.random() * 6;

      newParticles.push({
        id: `particle-${nextIdRef.current++}`,
        x,
        y,
        vx,
        vy,
        life,
        color,
        size,
      });
    }

    setParticles((prev) => [...prev, ...newParticles]);
  };

  const clear = () => {
    setParticles([]);
  };

  return {
    particles,
    emit,
    clear,
  };
}
