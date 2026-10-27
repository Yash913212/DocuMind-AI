import React, { useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";

const CINEMATIC_EASE = [0.22, 1, 0.36, 1];

export function CinematicLayer() {
  return (
    <div className="cine-fx pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden="true">
      <div className="cine-vignette" />
    </div>
  );
}

export function Reveal({
  children,
  className = "",
  delay = 0,
  y = 20,
  amount = 0.08,
  once = true,
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y }}
      whileInView={
        reduceMotion
          ? undefined
          : { opacity: 1, y: 0 }
      }
      viewport={{ once, amount }}
      transition={{ duration: 0.5, delay, ease: CINEMATIC_EASE }}
    >
      {children}
    </motion.div>
  );
}

export function CountUp({ value = 0, duration = 1.5, className = "" }) {
  const reduceMotion = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [display, setDisplay] = useState(() => (reduceMotion ? value : 0));

  useEffect(() => {
    if (!inView) return;

    let frame;
    let startTime;
    const totalDuration = Math.max((reduceMotion ? 0 : duration) * 1000, 1);

    const tick = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / totalDuration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(Math.round(value * eased));

      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, duration, reduceMotion]);

  return (
    <span ref={ref} className={className}>
      {display.toLocaleString("en-US")}
    </span>
  );
}

export function Magnetic({
  children,
  className = "",
  strength = 0.22,
  ...props
}) {
  const reduceMotion = useReducedMotion();
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 180, damping: 18, mass: 0.15 });
  const springY = useSpring(y, { stiffness: 180, damping: 18, mass: 0.15 });

  const handlePointerMove = (event) => {
    if (reduceMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((event.clientX - rect.left - rect.width / 2) * strength);
    y.set((event.clientY - rect.top - rect.height / 2) * strength);
  };

  const resetPosition = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      {...props}
      type={props.type || "button"}
      className={className}
      style={{ x: springX, y: springY }}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPosition}
      whileHover={reduceMotion ? undefined : { scale: 1.025 }}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
    >
      {children}
    </motion.button>
  );
}
