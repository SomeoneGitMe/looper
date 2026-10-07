import { motion } from "framer-motion";
import { ReactNode } from "react";

export default function Card({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`rounded-2xl border border-red-900/30 bg-[#0c0c0c]/90 backdrop-blur-sm p-5 md:p-6 ${className}`}
    >
      {children}
    </motion.section>
  );
}