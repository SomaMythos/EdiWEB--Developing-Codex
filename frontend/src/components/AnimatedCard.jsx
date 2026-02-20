import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const AnimatedCard = ({ children, className = '', delay = 0, ...props }) => {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <div className={className} {...props}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.25, delay }}
      whileHover={{ y: -2 }}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default AnimatedCard;
