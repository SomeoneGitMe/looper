import { motion } from "framer-motion";
import { ReactNode } from "react";

export default function Button({
  children,
  onClick,
  variant = "primary",
  className = "",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  disabled?: boolean;
}) {
  const baseClasses = "rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200";
  
  const variants = {
    primary: "bg-red-600 text-white hover:bg-red-700 shadow-[0_0_20px_rgba(220,38,38,0.3)]",
    secondary: "border border-red-900/40 text-neutral-300 hover:border-red-600/60 hover:text-white",
    ghost: "text-neutral-400 hover:text-white",
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variants[variant]} ${disabled ? "opacity-40 cursor-not-allowed" : ""} ${className}`}
    >
      {children}
    </motion.button>
  );
}