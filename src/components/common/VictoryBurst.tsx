import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
}

interface VictoryBurstProps {
  trigger: number;
}

const BURST_COLORS = ['#F59E0B', '#10B981', '#E07A5F', '#FBBF24', '#34D399', '#F97316'];

export const VictoryBurst: React.FC<VictoryBurstProps> = ({ trigger }) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (trigger <= 0) return;

    // Generate ~18 radial starburst particles with slight organic jitter
    const count = 18;
    const generated: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI + (Math.random() - 0.5) * 0.4;
      const distance = 70 + Math.random() * 80;
      generated.push({
        id: i,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        color: BURST_COLORS[i % BURST_COLORS.length],
        size: 5 + (i % 3) * 3,
        rotation: (Math.random() - 0.5) * 180,
      });
    }

    setParticles(generated);
    setIsActive(true);

    const timer = setTimeout(() => {
      setIsActive(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, [trigger]);

  return (
    <AnimatePresence>
      {isActive && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden select-none"
        >
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{
                x: 0,
                y: 0,
                scale: 0,
                opacity: 1,
                rotate: 0,
              }}
              animate={{
                x: p.x,
                y: p.y,
                scale: [0, 1.4, 0.8, 0],
                opacity: [1, 1, 0.8, 0],
                rotate: p.rotation,
              }}
              transition={{
                duration: 1.15,
                ease: [0.16, 1, 0.3, 1], // snappy spring-like cubic bezier
              }}
              style={{
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                borderRadius: p.id % 2 === 0 ? '9999px' : '3px',
                boxShadow: `0 0 8px ${p.color}88`,
              }}
              className="absolute"
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
};
