import { motion } from "framer-motion";

export default function SplashScreen() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between py-16 overflow-hidden"
      style={{
        background: `
          radial-gradient(circle at 50% 0%, rgba(218, 130, 23, 0.51) 0%, transparent 45%),
          radial-gradient(circle at 50% 30%, rgba(255, 255, 255, 0.15) 0%, transparent 50%),
          radial-gradient(circle at 85% 85%, #0c5179d9 0%, transparent 55%),
          radial-gradient(circle at 15% 75%, rgba(0, 0, 0, 0.9) 0%, transparent 60%),
          linear-gradient(135deg, #030a10 0%, #0c5179d9 55%, #02070c 100%)
        `,
      }}
    >
      {/* Light grid overlay with subtle orange and white dot pattern */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle, rgba(255, 255, 255, 0.15) 1.5px, transparent 1.5px),
            radial-gradient(circle, rgba(255, 170, 70, 0.15) 1.5px, transparent 1.5px)
          `,
          backgroundSize: "24px 24px, 48px 48px",
          backgroundPosition: "0 0, 12px 12px",
        }}
      />

      {/* Empty space for vertical layout balance */}
      <div />

      {/* Center content */}
      <div className="flex flex-col items-center text-center relative z-10">
        {/* Logo Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 15, delay: 0.15 }}
          className="mb-6"
        >
          <img
            src="/genops-logo.png"
            alt="GenOps.Live"
            className="w-28 h-28 sm:w-32 sm:h-32 object-contain drop-shadow-2xl rounded-[10%] bg-white/95 p-2 shadow-xl shadow-cyan-950/40"
          />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.45 }}
          className="text-3xl font-extrabold tracking-tight text-white drop-shadow-md"
        >
          GenOps
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.7 }}
          className="text-sm sm:text-base font-medium tracking-wide text-cyan-100/90 mt-2.5 drop-shadow-sm"
        >
          Generator Management System
        </motion.p>
      </div>

      {/* Bottom Loading Progress Bar */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.8 }}
        className="flex flex-col items-center w-full max-w-[280px] sm:max-w-[340px] relative z-10 px-4"
      >
        <span className="text-[11px] font-bold tracking-[0.25em] text-cyan-100/75 uppercase mb-2.5 drop-shadow-sm">
          Loading...
        </span>

        {/* Medium Rounded Track Container */}
        <div className="w-full h-3 sm:h-3.5 bg-black/30 rounded-full overflow-hidden relative shadow-inner p-[1.5px] border border-orange-500/30 backdrop-blur-sm">
          {/* Animated Fill Bar - Gradient combining #0C5179 blue and Orange */}
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1], delay: 0.9 }}
            className="h-full rounded-full relative overflow-hidden flex items-center justify-end pr-2 shadow-md shadow-orange-500/20"
            style={{
              background: "linear-gradient(90deg, #0C5179 0%, #008eb0 35%, #ff8c00 70%, #ff6c00 100%)",
            }}
          >
            {/* Inner Floating Bubble Glow Dots */}
            <div className="flex items-center gap-5 pointer-events-none opacity-85">
              <span className="w-1.5 h-1.5 rounded-full bg-white/70 shadow-sm animate-pulse" />
              <span className="w-2 h-2 rounded-full bg-white/90 shadow-sm" />
              <span className="w-1 h-1 rounded-full bg-white/75 shadow-sm" />
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
