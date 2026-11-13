'use client';

import { useRef, type ReactNode } from 'react';
import { motion, useInView, useReducedMotion, useScroll, useTransform, Variant } from 'framer-motion';

interface Props {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  initialVisible?: boolean;
  depth?: boolean;
}

export default function AnimatedSection({
  children,
  className = '',
  delay = 0,
  direction = 'up',
  initialVisible = false,
  depth = false,
}: Props) {
  const ref = useRef(null);
  const reducedMotion = useReducedMotion();
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  // Vertical reveals avoid off-screen horizontal content on narrow viewports.
  const resolvedDirection = direction === 'left' || direction === 'right' ? 'up' : direction;

  const dirVariants: Record<string, { hidden: Variant; visible: Variant }> = {
    up: {
      hidden: { opacity: 0, y: 40 },
      visible: { opacity: 1, y: 0 }
    },
    down: {
      hidden: { opacity: 0, y: -40 },
      visible: { opacity: 1, y: 0 }
    },
    left: {
      hidden: { opacity: 0, x: -40 },
      visible: { opacity: 1, x: 0 }
    },
    right: {
      hidden: { opacity: 0, x: 40 },
      visible: { opacity: 1, x: 0 }
    },
    none: {
      hidden: { opacity: 0 },
      visible: { opacity: 1 }
    }
  };

  const v = dirVariants[resolvedDirection] || dirVariants.up;

  return (
    <div ref={ref} className={className} style={{ minWidth: 0 }}>
      <DepthSurface enabled={depth}>
      <motion.div
        initial={initialVisible || reducedMotion ? 'visible' : 'hidden'}
        animate={initialVisible || reducedMotion || isInView ? 'visible' : 'hidden'}
        variants={v}
        transition={{ duration: reducedMotion ? 0 : 0.8, delay: reducedMotion ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
      </DepthSurface>
    </div>
  );
}


function DepthSurface({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return enabled ? <ScrollDepth>{children}</ScrollDepth> : <>{children}</>;
}

function ScrollDepth({ children }: { children: ReactNode }) {
  const depthRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: depthRef, offset: ['start end', 'end start'] });
  const depthY = useTransform(scrollYProgress, [0, 0.5, 1], [28, 0, -28]);
  const depthRotate = useTransform(scrollYProgress, [0, 0.5, 1], [5, 0, -3]);
  const depthScale = useTransform(scrollYProgress, [0, 0.4, 1], [0.96, 1, 0.98]);
  return (
    <div ref={depthRef} style={{ perspective: 1200 }}>
      <motion.div style={reducedMotion ? undefined : {
        y: depthY, rotateX: depthRotate, scale: depthScale, transformPerspective: 1200,
      }}>
        {children}
      </motion.div>
    </div>
  );
}
