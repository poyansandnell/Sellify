type PanelProps = {
  device: "phone" | "pad";
  badge: string;
  title: string;
  subtitle: string;
  img: string;
  theme?: "indigo" | "violet" | "deep";
};

const THEMES: Record<string, { bg: string; badgeBg: string }> = {
  indigo: {
    bg: "linear-gradient(160deg, #eef0ff 0%, #dfe3ff 34%, #6366f1 130%)",
    badgeBg: "rgba(99,102,241,0.14)",
  },
  violet: {
    bg: "linear-gradient(160deg, #f4efff 0%, #e6dcff 34%, #7c5cf0 130%)",
    badgeBg: "rgba(124,92,240,0.14)",
  },
  deep: {
    bg: "linear-gradient(165deg, #3730a3 0%, #4f46e5 55%, #818cf8 120%)",
    badgeBg: "rgba(255,255,255,0.16)",
  },
};

export function Panel({ device, badge, title, subtitle, img, theme = "indigo" }: PanelProps) {
  const dark = theme === "deep";
  const frameW = device === "phone" ? "72vw" : "46vw";
  return (
    <div
      className="relative h-screen w-screen overflow-hidden"
      style={{ background: THEMES[theme].bg, fontFamily: "'Plus Jakarta Sans','Inter',system-ui,sans-serif" }}
    >
      {/* soft glow behind device */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{
          top: "38%",
          width: "110vw",
          height: "110vw",
          background: dark
            ? "radial-gradient(circle, rgba(255,255,255,0.22) 0%, transparent 60%)"
            : "radial-gradient(circle, rgba(255,255,255,0.85) 0%, transparent 60%)",
        }}
      />
      {/* header */}
      <div className="relative flex flex-col items-center text-center" style={{ paddingTop: "5.5vh", paddingLeft: "7vw", paddingRight: "7vw" }}>
        <div
          className="font-extrabold uppercase"
          style={{
            fontSize: device === "phone" ? "1.5vw" : "1.15vw",
            letterSpacing: "0.22em",
            color: dark ? "#ffffff" : "#4f46e5",
            background: THEMES[theme].badgeBg,
            borderRadius: 999,
            padding: "0.6vw 1.8vw",
            marginBottom: "1.8vh",
          }}
        >
          {badge}
        </div>
        <h1
          className="font-extrabold"
          style={{
            fontSize: device === "phone" ? "6.4vw" : "4.6vw",
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            color: dark ? "#ffffff" : "#1e1b4b",
            maxWidth: "88vw",
          }}
        >
          {title}
        </h1>
        <p
          className="font-medium"
          style={{
            marginTop: "1.4vh",
            fontSize: device === "phone" ? "2.9vw" : "2.1vw",
            lineHeight: 1.35,
            color: dark ? "rgba(255,255,255,0.85)" : "#4b4a67",
            maxWidth: "80vw",
          }}
        >
          {subtitle}
        </p>
      </div>
      {/* device frame */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: device === "phone" ? "22.5%" : "21.5%", width: frameW }}>
        <div
          style={{
            background: "#0b0b14",
            borderRadius: device === "phone" ? "9.5vw / 4.4vh" : "6vw / 4.5vh",
            padding: device === "phone" ? "1.9vw" : "1.2vw",
            boxShadow: "0 4vh 9vh rgba(30,27,75,0.45)",
          }}
        >
          <img
            src={img}
            alt=""
            className="block w-full"
            style={{ borderRadius: device === "phone" ? "7.6vw / 3.5vh" : "4.8vw / 3.6vh" }}
          />
        </div>
      </div>
    </div>
  );
}
