/**
 * Shared animation variants for Framer Motion
 * Eliminates repeated variant definitions across components
 */

// ===== CONTAINER / STAGGER =====
export const staggerContainer = (staggerDelay = 0.15, startDelay = 0.2) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: staggerDelay,
      delayChildren: startDelay,
    },
  },
});

// ===== FADE VARIANTS =====
export const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
};

export const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
};

export const fadeInDown = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
};

export const fadeInLeft = {
  hidden: { opacity: 0, x: -50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
};

export const fadeInRight = {
  hidden: { opacity: 0, x: 50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
};

// ===== SCALE VARIANTS =====
export const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 200, damping: 15 },
  },
};

// ===== CARD VARIANTS =====
export const cardVariants = {
  hidden: { opacity: 0, y: 50, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
};

export const cardHover = {
  y: -8,
  boxShadow: '0 20px 40px rgba(19, 236, 55, 0.15)',
  transition: { duration: 0.3 },
};

// ===== BUTTON VARIANTS =====
export const buttonVariants = {
  initial: { scale: 1 },
  hover: {
    scale: 1.02,
    boxShadow: '0 10px 30px rgba(19, 236, 55, 0.3)',
  },
  tap: { scale: 0.98 },
};

export const buttonHoverLift = {
  scale: 1.05,
  boxShadow: '0 10px 30px rgba(19, 236, 55, 0.4)',
  transition: { duration: 0.2 },
};

// ===== PAGE TRANSITION =====
export const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.5 } },
  exit: { opacity: 0 },
};

// ===== LINK HOVER =====
export const linkHover = {
  x: 5,
  color: '#13ec37',
  transition: { duration: 0.2 },
};

// ===== NAV ITEM =====
export const navItemVariants = {
  hover: {
    y: -2,
    color: '#13ec37',
    transition: { duration: 0.2 },
  },
};

// ===== FLOATING / DECORATIVE =====
export const floatingAnimation = (duration = 5, yRange = 20) => ({
  y: [0, -yRange, 0],
  rotate: [0, 5, 0],
  transition: {
    duration,
    repeat: Infinity,
    ease: 'easeInOut',
  },
});
