import { useState } from "react";
import { motion } from "framer-motion";

/**
 * Optional admin passcode gate. Off by default (Settings → passcode empty).
 * The passcode only guards this device's UI — it is not encryption, so it is
 * a convenience lock, not real security.
 */
export function LockScreen({
  passcode,
  onUnlock,
}: {
  passcode: string;
  onUnlock: () => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  const submit = () => {
    if (value === passcode) {
      onUnlock();
    } else {
      setError(true);
      setValue("");
      setTimeout(() => setError(false), 1200);
    }
  };

  return (
    <div className="lock-screen">
      <motion.div
        className="logo"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      >
        🅿️
      </motion.div>
      <div>
        <h1>ALC Valet</h1>
        <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
          Enter your admin passcode
        </div>
      </div>
      <motion.input
        className="pin"
        type="password"
        inputMode="numeric"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        aria-label="Passcode"
        animate={error ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
        style={error ? { borderColor: "var(--bad)" } : undefined}
      />
      {error && <div className="error-text">Wrong passcode</div>}
      <button
        className="btn primary"
        style={{ minWidth: 200 }}
        onClick={submit}
      >
        Unlock
      </button>
    </div>
  );
}
