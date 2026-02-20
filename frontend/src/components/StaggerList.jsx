import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const StaggerList = ({ items = [], getKey, renderItem, className = '', stagger = 0.06 }) => {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{items.map((item, index) => renderItem(item, index))}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: stagger },
        },
      }}
    >
      {items.map((item, index) => (
        <motion.div
          key={getKey ? getKey(item, index) : index}
          variants={{
            hidden: { opacity: 0, y: 8 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.2 }}
        >
          {renderItem(item, index)}
        </motion.div>
      ))}
    </motion.div>
  );
};

export default StaggerList;
