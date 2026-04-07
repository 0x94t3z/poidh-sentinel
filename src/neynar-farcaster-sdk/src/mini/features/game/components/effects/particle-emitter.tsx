"use client";

import type { Particle } from "../../hooks/effects/use-particles";

export type ParticleEmitterProps = {
  particles: Particle[];
  className?: string;
};

/**
 * Particle emitter component
 *
 * Renders particles from useParticles hook.
 * Each particle is rendered as a colored circle that moves and fades out.
 *
 * @param particles - Array of particles to render
 * @param className - Additional CSS classes
 *
 * @example
 * ```typescript
 * const { particles, emit } = useParticles();
 *
 * return (
 *   <div className="relative">
 *     <ParticleEmitter particles={particles} />
 *     <button onClick={() => emit({ x: 100, y: 100 })}>
 *       Emit Particles
 *     </button>
 *   </div>
 * );
 * ```
 */
export function ParticleEmitter({
  particles,
  className = "",
}: ParticleEmitterProps) {
  return (
    <>
      {particles.map((particle) => (
        <div
          key={particle.id}
          className={`absolute pointer-events-none rounded-full ${className}`}
          style={{
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            opacity: particle.life,
            transform: "translate(-50%, -50%)",
            transition: "none",
          }}
        />
      ))}
    </>
  );
}
