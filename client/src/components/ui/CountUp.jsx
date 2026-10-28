import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export default function CountUp({ value, duration = 1.6, delay = 0, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obj = { v: Number(el.dataset.v || 0) };
    const tween = gsap.to(obj, {
      v: value,
      duration,
      delay,
      ease: 'power3.out',
      onUpdate: () => {
        el.textContent = Math.round(obj.v).toLocaleString('en-IN');
        el.dataset.v = obj.v;
      },
    });
    return () => tween.kill();
  }, [value, duration, delay]);
  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      0
    </span>
  );
}
